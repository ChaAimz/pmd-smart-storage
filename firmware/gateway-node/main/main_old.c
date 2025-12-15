#include <stdio.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"
#include "nvs_flash.h"
#include "esp_bt.h"
#include "esp_bt_main.h"
#include "esp_ble_mesh_defs.h"
#include "esp_ble_mesh_common_api.h"
#include "esp_ble_mesh_networking_api.h"
#include "esp_ble_mesh_provisioning_api.h"
#include "esp_ble_mesh_config_model_api.h"
#include "esp_ble_mesh_generic_model_api.h"
#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_netif.h"
#include "esp_http_server.h"
#include "esp_mac.h"
#include "lwip/ip4_addr.h"
#include "mqtt_client.h"
#include "cJSON.h"
#include "led_strip.h"
#include "driver/gpio.h"
#include "mesh_storage.h"

#define MACSTR "%02x:%02x:%02x:%02x:%02x:%02x"
#define MAC2STR(a) (a)[0], (a)[1], (a)[2], (a)[3], (a)[4], (a)[5]

static const char *TAG = "GATEWAY_NODE";

/* Forward declarations */
static void mqtt_app_start(void);

/* GPIO Configuration - Adafruit ESP32-C6 Feather */
#define NEOPIXEL_GPIO       GPIO_NUM_9   // NeoPixel LED
#define NEOPIXEL_POWER_GPIO GPIO_NUM_20  // NeoPixel power control
#define NEOPIXEL_COUNT      1
#define BUTTON_GPIO         GPIO_NUM_0   // Boot button (GPIO0 - dedicated button)
#define BUTTON_ACTIVE_LEVEL 0            // Active LOW

/* Factory Reset Configuration */
#define FACTORY_RESET_HOLD_TIME_MS  10000  // Hold button for 10 seconds to factory reset
#define FACTORY_RESET_WARNING_TIME_MS 3000  // Warning at 3 seconds
#define FACTORY_RESET_CRITICAL_TIME_MS 7000 // Critical warning at 7 seconds

/* WiFi Configuration - Now managed by WiFi Manager (stored in NVS) */
// WiFi credentials are configured via Web UI at http://192.168.4.1
// No need to hardcode SSID/Password here anymore

/* MQTT Configuration */
#define MQTT_BROKER_URL "mqtt://172.20.10.3:1883"
#define MQTT_TOPIC_STATUS "smart-storage/status"
#define MQTT_TOPIC_COMMAND "smart-storage/command"
#define MQTT_TOPIC_BUTTON "smart-storage/button"

/* Bluetooth Mesh Configuration */
#define CID_ESP        0x02E5

static esp_mqtt_client_handle_t mqtt_client;
static led_strip_handle_t led_strip;
static bool wifi_connected = false;
static bool wifi_ap_mode = false;
static bool provisioned = false;
static uint16_t node_addr = 0;

static esp_ble_mesh_cfg_srv_t config_server;
static esp_ble_mesh_client_t onoff_client;

// Generic OnOff Server for receiving button press messages from endpoints
static esp_ble_mesh_gen_onoff_srv_t onoff_server = {
    .rsp_ctrl = {
        .get_auto_rsp = ESP_BLE_MESH_SERVER_AUTO_RSP,
        .set_auto_rsp = ESP_BLE_MESH_SERVER_AUTO_RSP,
    },
};

ESP_BLE_MESH_MODEL_PUB_DEFINE(onoff_pub, 2 + 3, ROLE_NODE);

static esp_ble_mesh_model_t root_models[] = {
    ESP_BLE_MESH_MODEL_CFG_SRV(&config_server),
    ESP_BLE_MESH_MODEL_GEN_ONOFF_CLI(NULL, &onoff_client),
    ESP_BLE_MESH_MODEL_GEN_ONOFF_SRV(&onoff_pub, &onoff_server),
};

static esp_ble_mesh_elem_t elements[] = {
    ESP_BLE_MESH_ELEMENT(0, root_models, ESP_BLE_MESH_MODEL_NONE),
};

static esp_ble_mesh_comp_t composition = {
    .cid = CID_ESP,
    .elements = elements,
    .element_count = ARRAY_SIZE(elements),
};

// Device UUID - "ESP BLE Mesh Gateway" in ASCII
static uint8_t dev_uuid[16] = {
    'E', 'S', 'P', ' ', 'G', 'a', 't', 'e',
    'w', 'a', 'y', 0x00, 0x00, 0x00, 0x00, 0x00
};

static esp_ble_mesh_prov_t provision = {
    .uuid = dev_uuid,
};

/* NeoPixel Functions */
static void neopixel_init(void)
{
    // Enable NeoPixel power
    gpio_config_t io_conf = {
        .pin_bit_mask = (1ULL << NEOPIXEL_POWER_GPIO),
        .mode = GPIO_MODE_OUTPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    gpio_config(&io_conf);
    gpio_set_level(NEOPIXEL_POWER_GPIO, 1);  // Turn on NeoPixel power

    vTaskDelay(pdMS_TO_TICKS(10));  // Wait for power to stabilize

    // Configure LED strip
    led_strip_config_t strip_config = {
        .strip_gpio_num = NEOPIXEL_GPIO,
        .max_leds = NEOPIXEL_COUNT,
        .led_pixel_format = LED_PIXEL_FORMAT_GRB,
        .led_model = LED_MODEL_WS2812,
        .flags.invert_out = false,
    };

    led_strip_rmt_config_t rmt_config = {
        .clk_src = RMT_CLK_SRC_DEFAULT,
        .resolution_hz = 10 * 1000 * 1000,  // 10MHz
        .flags.with_dma = false,
    };

    ESP_ERROR_CHECK(led_strip_new_rmt_device(&strip_config, &rmt_config, &led_strip));
    led_strip_clear(led_strip);
}

static void neopixel_set_color(uint8_t r, uint8_t g, uint8_t b)
{
    led_strip_set_pixel(led_strip, 0, r, g, b);
    led_strip_refresh(led_strip);
}

static void neopixel_off(void)
{
    led_strip_clear(led_strip);
}

/* Factory Reset Task */
static void factory_reset_task(void *pvParameters)
{
    uint32_t button_hold_start = 0;
    bool factory_reset_in_progress = false;
    bool warning_shown = false;
    bool critical_warning_shown = false;

    while (1) {
        // Read button state (active LOW)
        int button_state = gpio_get_level(BUTTON_GPIO);

        if (button_state == BUTTON_ACTIVE_LEVEL) {
            // Button is pressed
            if (button_hold_start == 0) {
                // Button just pressed
                button_hold_start = esp_timer_get_time() / 1000; // Convert to ms
                factory_reset_in_progress = true;
                warning_shown = false;
                critical_warning_shown = false;
                ESP_LOGI(TAG, "Button hold detected - hold for %d seconds to factory reset",
                         FACTORY_RESET_HOLD_TIME_MS / 1000);
            } else {
                // Button is being held
                uint32_t hold_duration = (esp_timer_get_time() / 1000) - button_hold_start;

                // Warning at 3 seconds
                if (hold_duration >= FACTORY_RESET_WARNING_TIME_MS && !warning_shown) {
                    warning_shown = true;
                    ESP_LOGW(TAG, "⚠️  Factory reset in %d seconds...",
                             (FACTORY_RESET_HOLD_TIME_MS - hold_duration) / 1000);
                }

                // Critical warning at 7 seconds
                if (hold_duration >= FACTORY_RESET_CRITICAL_TIME_MS && !critical_warning_shown) {
                    critical_warning_shown = true;
                    ESP_LOGW(TAG, "🔴 FACTORY RESET IN %d SECONDS! Release button to cancel!",
                             (FACTORY_RESET_HOLD_TIME_MS - hold_duration) / 1000);
                }

                // Factory reset at 10 seconds
                if (hold_duration >= FACTORY_RESET_HOLD_TIME_MS) {
                    ESP_LOGW(TAG, "");
                    ESP_LOGW(TAG, "========================================");
                    ESP_LOGW(TAG, "🔴 FACTORY RESET TRIGGERED!");
                    ESP_LOGW(TAG, "========================================");
                    ESP_LOGW(TAG, "Clearing all provisioning data...");

                    // Clear all mesh storage
                    esp_err_t err = mesh_storage_clear();
                    if (err == ESP_OK) {
                        ESP_LOGI(TAG, "✓ Provisioning data cleared");
                    } else {
                        ESP_LOGE(TAG, "✗ Failed to clear provisioning data: %s", esp_err_to_name(err));
                    }

                    ESP_LOGW(TAG, "Restarting device in 2 seconds...");
                    vTaskDelay(pdMS_TO_TICKS(2000));

                    ESP_LOGW(TAG, "========================================");
                    ESP_LOGW(TAG, "🔄 RESTARTING...");
                    ESP_LOGW(TAG, "========================================");

                    esp_restart();
                }
            }
        } else {
            // Button is released
            if (factory_reset_in_progress) {
                uint32_t hold_duration = (esp_timer_get_time() / 1000) - button_hold_start;
                if (hold_duration < FACTORY_RESET_HOLD_TIME_MS) {
                    ESP_LOGI(TAG, "Factory reset cancelled (held for %d ms)", hold_duration);
                }
                button_hold_start = 0;
                factory_reset_in_progress = false;
                warning_shown = false;
                critical_warning_shown = false;
            }
        }

        vTaskDelay(pdMS_TO_TICKS(100));
    }
}

/* WiFi Event Callback for LED Updates */
static void wifi_event_led_callback(bool connected)
{
    wifi_connected = connected;

    // Update AP mode status
    wifi_ap_mode = wifi_manager_is_ap_active();

    if (connected) {
        ESP_LOGI(TAG, "💡 LED: WiFi connected - Solid BLUE");

        // Start MQTT when WiFi connects (if not already started)
        if (mqtt_client == NULL) {
            ESP_LOGI(TAG, "🌐 Starting MQTT client...");
            mqtt_app_start();
        }
    } else if (wifi_ap_mode) {
        ESP_LOGI(TAG, "💡 LED: AP mode active - Alternating GREEN/BLUE");
    } else {
        ESP_LOGI(TAG, "💡 LED: WiFi disconnected - Fast blinking BLUE");
    }
}

/* LED Control Task */
static void led_control_task(void *pvParameters)
{
    bool blink_state = false;
    uint8_t ap_mode_color = 0;  // 0 = GREEN, 1 = BLUE for AP mode alternating

    while (1) {
        if (wifi_connected && !wifi_ap_mode) {
            // WiFi connected in Station mode - Solid BLUE
            neopixel_set_color(0, 0, 255);  // Blue

        } else if (wifi_ap_mode && !wifi_connected) {
            // AP Mode only (no WiFi connection) - Alternating GREEN and BLUE
            if (blink_state) {
                if (ap_mode_color == 0) {
                    neopixel_set_color(0, 255, 0);  // Green
                    ap_mode_color = 1;
                } else {
                    neopixel_set_color(0, 0, 255);  // Blue
                    ap_mode_color = 0;
                }
            }
            blink_state = !blink_state;

        } else if (wifi_ap_mode && wifi_connected) {
            // AP+STA mode (both active) - Solid BLUE (WiFi takes priority)
            neopixel_set_color(0, 0, 255);  // Blue

        } else {
            // WiFi disconnected/failed - Fast blinking BLUE
            if (blink_state) {
                neopixel_set_color(0, 0, 255);  // Blue
            } else {
                neopixel_off();
            }
            blink_state = !blink_state;
        }

        // Blink rate: 500ms for normal, 250ms for fast blink when disconnected
        uint32_t delay_ms = (wifi_connected || wifi_ap_mode) ? 500 : 250;
        vTaskDelay(pdMS_TO_TICKS(delay_ms));
    }
}

/* MQTT Event Handler */
static void mqtt_event_handler(void *handler_args, esp_event_base_t base, int32_t event_id, void *event_data)
{
    esp_mqtt_event_handle_t event = event_data;
    
    switch ((esp_mqtt_event_id_t)event_id) {
    case MQTT_EVENT_CONNECTED:
        ESP_LOGI(TAG, "MQTT_EVENT_CONNECTED");
        esp_mqtt_client_subscribe(mqtt_client, MQTT_TOPIC_COMMAND, 0);
        
        // Publish gateway status
        cJSON *status = cJSON_CreateObject();
        cJSON_AddStringToObject(status, "type", "gateway");
        cJSON_AddStringToObject(status, "status", "online");
        char *status_str = cJSON_PrintUnformatted(status);
        esp_mqtt_client_publish(mqtt_client, MQTT_TOPIC_STATUS, status_str, 0, 1, 0);
        free(status_str);
        cJSON_Delete(status);
        break;
        
    case MQTT_EVENT_DISCONNECTED:
        ESP_LOGI(TAG, "MQTT_EVENT_DISCONNECTED");
        break;
        
    case MQTT_EVENT_SUBSCRIBED:
        ESP_LOGI(TAG, "MQTT_EVENT_SUBSCRIBED, msg_id=%d", event->msg_id);
        break;
        
    case MQTT_EVENT_DATA:
        ESP_LOGI(TAG, "MQTT_EVENT_DATA");
        ESP_LOGI(TAG, "TOPIC=%.*s", event->topic_len, event->topic);
        ESP_LOGI(TAG, "DATA=%.*s", event->data_len, event->data);
        
        // Parse command and send to BLE Mesh
        if (strncmp(event->topic, MQTT_TOPIC_COMMAND, event->topic_len) == 0) {
            cJSON *json = cJSON_ParseWithLength(event->data, event->data_len);
            if (json != NULL) {
                cJSON *node_addr_json = cJSON_GetObjectItem(json, "node_addr");
                cJSON *command_json = cJSON_GetObjectItem(json, "command");
                cJSON *led_state_json = cJSON_GetObjectItem(json, "led_state");

                // Handle factory_reset command
                if (cJSON_IsNumber(node_addr_json) && cJSON_IsString(command_json)) {
                    const char *command = cJSON_GetStringValue(command_json);
                    uint16_t node_addr = (uint16_t)node_addr_json->valueint;

                    if (strcmp(command, "factory_reset") == 0) {
                        ESP_LOGI(TAG, "Sending factory reset command to node 0x%04x", node_addr);

                        // Send factory reset message using Generic OnOff with special value
                        // We use onoff=2 as a special value to indicate factory reset
                        // (normal LED control values are 0 or 1)
                        esp_ble_mesh_generic_client_set_state_t set_state = {0};
                        set_state.onoff_set.op_en = false;
                        set_state.onoff_set.onoff = 2;  // Special value for factory reset
                        set_state.onoff_set.tid = 0;    // TID (transaction ID)

                        esp_ble_mesh_client_common_param_t common = {0};
                        common.opcode = ESP_BLE_MESH_MODEL_OP_GEN_ONOFF_SET_UNACK;
                        common.model = &root_models[1];
                        common.ctx.net_idx = 0;
                        common.ctx.app_idx = 0;
                        common.ctx.addr = node_addr;
                        common.ctx.send_ttl = 3;
                        common.msg_timeout = 0;

                        esp_ble_mesh_generic_client_set_state(&common, &set_state);

                        ESP_LOGI(TAG, "✓ Factory reset command sent to node 0x%04x", node_addr);
                    }
                }
                // Handle LED control command
                else if (cJSON_IsNumber(node_addr_json) && cJSON_IsBool(led_state_json)) {
                    uint16_t node_addr = (uint16_t)node_addr_json->valueint;
                    uint8_t led_state = cJSON_IsTrue(led_state_json) ? 1 : 0;

                    ESP_LOGI(TAG, "Sending LED command to node 0x%04x: %s", node_addr, led_state ? "ON" : "OFF");

                    // Send BLE Mesh message
                    esp_ble_mesh_generic_client_set_state_t set_state = {0};
                    set_state.onoff_set.op_en = false;
                    set_state.onoff_set.onoff = led_state;
                    set_state.onoff_set.tid = 0;

                    esp_ble_mesh_client_common_param_t common = {0};
                    common.opcode = ESP_BLE_MESH_MODEL_OP_GEN_ONOFF_SET_UNACK;
                    common.model = &root_models[1];
                    common.ctx.net_idx = 0;
                    common.ctx.app_idx = 0;
                    common.ctx.addr = node_addr;
                    common.ctx.send_ttl = 3;
                    common.msg_timeout = 0;

                    esp_ble_mesh_generic_client_set_state(&common, &set_state);
                }
                cJSON_Delete(json);
            }
        }
        break;
        
    case MQTT_EVENT_ERROR:
        ESP_LOGI(TAG, "MQTT_EVENT_ERROR");
        break;
        
    default:
        break;
    }
}

/* MQTT Initialization */
static void mqtt_app_start(void)
{
    esp_mqtt_client_config_t mqtt_cfg = {
        .broker.address.uri = MQTT_BROKER_URL,
    };
    
    mqtt_client = esp_mqtt_client_init(&mqtt_cfg);
    esp_mqtt_client_register_event(mqtt_client, ESP_EVENT_ANY_ID, mqtt_event_handler, NULL);
    esp_mqtt_client_start(mqtt_client);
}

/* Publish button press to MQTT */
static void publish_button_press(uint16_t src_addr)
{
    if (mqtt_client == NULL) {
        ESP_LOGW(TAG, "MQTT client not initialized");
        return;
    }
    
    cJSON *msg = cJSON_CreateObject();
    cJSON_AddNumberToObject(msg, "node_addr", src_addr);
    cJSON_AddStringToObject(msg, "event", "button_press");
    cJSON_AddNumberToObject(msg, "timestamp", esp_timer_get_time() / 1000000);
    
    char *msg_str = cJSON_PrintUnformatted(msg);
    int msg_id = esp_mqtt_client_publish(mqtt_client, MQTT_TOPIC_BUTTON, msg_str, 0, 1, 0);
    ESP_LOGI(TAG, "Published button press from node 0x%04x, msg_id=%d", src_addr, msg_id);
    
    free(msg_str);
    cJSON_Delete(msg);
}

/* Bluetooth Mesh Callbacks */
static void provisioning_cb(esp_ble_mesh_prov_cb_event_t event, esp_ble_mesh_prov_cb_param_t *param)
{
    switch (event) {
    case ESP_BLE_MESH_PROV_REGISTER_COMP_EVT:
        ESP_LOGI(TAG, "Provisioning registered, err_code %d", param->prov_register_comp.err_code);
        break;
    case ESP_BLE_MESH_NODE_PROV_ENABLE_COMP_EVT:
        ESP_LOGI(TAG, "Provisioning enabled, err_code %d", param->node_prov_enable_comp.err_code);
        break;
    case ESP_BLE_MESH_NODE_PROV_LINK_OPEN_EVT:
        ESP_LOGI(TAG, "Provisioning link opened");
        break;
    case ESP_BLE_MESH_NODE_PROV_LINK_CLOSE_EVT:
        ESP_LOGI(TAG, "Provisioning link closed");
        break;
    case ESP_BLE_MESH_NODE_PROV_COMPLETE_EVT:
        ESP_LOGI(TAG, "========================================");
        ESP_LOGI(TAG, "🎉 PROVISIONING COMPLETE!");
        ESP_LOGI(TAG, "========================================");
        node_addr = param->node_prov_complete.addr;
        provisioned = true;

        // Save complete provisioning data to NVS
        mesh_prov_data_t prov_data = {
            .provisioned = true,
            .node_addr = param->node_prov_complete.addr,
            .net_idx = param->node_prov_complete.net_idx,
            .app_idx = 0, // Will be set when AppKey is added
            .iv_index = param->node_prov_complete.iv_index,
        };

        // Copy NetKey (always available as array)
        memcpy(prov_data.net_key, param->node_prov_complete.net_key, 16);

        // Note: DevKey is managed by BLE Mesh stack internally and not exposed in v5.5.1
        // We only save NetKey, node address, and indices which are sufficient for restore

        // Save to NVS (detailed log printed by save function)
        esp_err_t err = mesh_storage_save_prov_data(&prov_data);
        if (err != ESP_OK) {
            ESP_LOGE(TAG, "❌ Failed to save provisioning data: %s", esp_err_to_name(err));
        }
        break;
    default:
        break;
    }
}

static void config_server_cb(esp_ble_mesh_cfg_server_cb_event_t event, esp_ble_mesh_cfg_server_cb_param_t *param)
{
    if (event == ESP_BLE_MESH_CFG_SERVER_STATE_CHANGE_EVT) {
        ESP_LOGI(TAG, "Config server state changed");

        // Check if AppKey was added or model was bound
        switch (param->ctx.recv_op) {
        case ESP_BLE_MESH_MODEL_OP_APP_KEY_ADD:
            ESP_LOGI(TAG, "========================================");
            ESP_LOGI(TAG, "🔑 AppKey Added!");
            ESP_LOGI(TAG, "   Net Index: 0x%04X", param->value.state_change.appkey_add.net_idx);
            ESP_LOGI(TAG, "   App Index: 0x%04X", param->value.state_change.appkey_add.app_idx);
            ESP_LOGI(TAG, "========================================");

            // Update provisioning data with AppKey index
            mesh_prov_data_t prov_data;
            if (mesh_storage_load_prov_data(&prov_data) == ESP_OK) {
                prov_data.app_idx = param->value.state_change.appkey_add.app_idx;
                // Copy AppKey (app_key is always available as array)
                memcpy(prov_data.app_key, param->value.state_change.appkey_add.app_key, 16);
                mesh_storage_save_prov_data(&prov_data);
            }
            break;

        case ESP_BLE_MESH_MODEL_OP_MODEL_APP_BIND:
            ESP_LOGI(TAG, "========================================");
            ESP_LOGI(TAG, "🔗 Model Bound to AppKey!");
            ESP_LOGI(TAG, "   Element Addr: 0x%04X", param->value.state_change.mod_app_bind.element_addr);
            ESP_LOGI(TAG, "   Model ID:     0x%04X", param->value.state_change.mod_app_bind.model_id);
            ESP_LOGI(TAG, "   Company ID:   0x%04X", param->value.state_change.mod_app_bind.company_id);
            ESP_LOGI(TAG, "   App Index:    0x%04X", param->value.state_change.mod_app_bind.app_idx);
            ESP_LOGI(TAG, "========================================");

            // Save model binding
            mesh_model_binding_t binding = {
                .bound = true,
                .app_idx = param->value.state_change.mod_app_bind.app_idx,
            };

            // Determine model ID string
            const char *model_id = NULL;
            if (param->value.state_change.mod_app_bind.model_id == ESP_BLE_MESH_MODEL_ID_GEN_ONOFF_CLI) {
                model_id = "onoff_cli";
            } else if (param->value.state_change.mod_app_bind.model_id == ESP_BLE_MESH_MODEL_ID_GEN_ONOFF_SRV) {
                model_id = "onoff_srv";
            }

            if (model_id) {
                // Detailed log printed by save function
                mesh_storage_save_model_binding(model_id, &binding);
            }
            break;

        case ESP_BLE_MESH_MODEL_OP_MODEL_PUB_SET:
            ESP_LOGI(TAG, "========================================");
            ESP_LOGI(TAG, "📢 Model Publication Set!");
            ESP_LOGI(TAG, "   Element Addr: 0x%04X", param->value.state_change.mod_pub_set.element_addr);
            ESP_LOGI(TAG, "   Publish Addr: 0x%04X", param->value.state_change.mod_pub_set.pub_addr);
            ESP_LOGI(TAG, "========================================");

            // Save publication settings
            mesh_pub_settings_t pub_settings = {
                .publish_addr = param->value.state_change.mod_pub_set.pub_addr,
                .app_idx = param->value.state_change.mod_pub_set.app_idx,
                .ttl = param->value.state_change.mod_pub_set.pub_ttl,
                .period = param->value.state_change.mod_pub_set.pub_period,
            };

            // Determine model ID string
            model_id = NULL;
            if (param->value.state_change.mod_pub_set.model_id == ESP_BLE_MESH_MODEL_ID_GEN_ONOFF_CLI) {
                model_id = "onoff_cli";
            } else if (param->value.state_change.mod_pub_set.model_id == ESP_BLE_MESH_MODEL_ID_GEN_ONOFF_SRV) {
                model_id = "onoff_srv";
            }

            if (model_id) {
                // Detailed log printed by save function
                mesh_storage_save_pub_settings(model_id, &pub_settings);
            }
            break;
        }
    }
}

static void generic_server_cb(esp_ble_mesh_generic_server_cb_event_t event, esp_ble_mesh_generic_server_cb_param_t *param)
{
    switch (event) {
    case ESP_BLE_MESH_GENERIC_SERVER_STATE_CHANGE_EVT:
    case ESP_BLE_MESH_GENERIC_SERVER_RECV_SET_MSG_EVT:
        // Handle button press from endpoint nodes
        if (param->ctx.recv_op == ESP_BLE_MESH_MODEL_OP_GEN_ONOFF_SET ||
            param->ctx.recv_op == ESP_BLE_MESH_MODEL_OP_GEN_ONOFF_SET_UNACK) {
            ESP_LOGI(TAG, "📩 Received button press from node 0x%04x", param->ctx.addr);
            publish_button_press(param->ctx.addr);
        }
        break;
    case ESP_BLE_MESH_GENERIC_SERVER_RECV_GET_MSG_EVT:
        ESP_LOGD(TAG, "Generic server recv get msg");
        break;
    default:
        break;
    }
}

static void generic_client_cb(esp_ble_mesh_generic_client_cb_event_t event, esp_ble_mesh_generic_client_cb_param_t *param)
{
    switch (event) {
    case ESP_BLE_MESH_GENERIC_CLIENT_GET_STATE_EVT:
        ESP_LOGD(TAG, "Generic client get state");
        break;
    case ESP_BLE_MESH_GENERIC_CLIENT_SET_STATE_EVT:
        ESP_LOGD(TAG, "Generic client set state");
        break;
    case ESP_BLE_MESH_GENERIC_CLIENT_PUBLISH_EVT:
        ESP_LOGD(TAG, "Generic client publish");
        break;
    case ESP_BLE_MESH_GENERIC_CLIENT_TIMEOUT_EVT:
        ESP_LOGW(TAG, "⚠️  Generic client timeout");
        break;
    default:
        break;
    }
}

/* Bluetooth Mesh Initialization */
static esp_err_t ble_mesh_init(void)
{
    esp_err_t err;

    esp_ble_mesh_register_prov_callback(provisioning_cb);
    esp_ble_mesh_register_config_server_callback(config_server_cb);
    esp_ble_mesh_register_generic_server_callback(generic_server_cb);
    esp_ble_mesh_register_generic_client_callback(generic_client_cb);

    err = esp_ble_mesh_init(&provision, &composition);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to initialize BLE Mesh");
        return err;
    }

    err = esp_ble_mesh_node_prov_enable(ESP_BLE_MESH_PROV_ADV | ESP_BLE_MESH_PROV_GATT);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to enable provisioning");
        return err;
    }

    ESP_LOGI(TAG, "✅ BLE Mesh Gateway initialized");

    return ESP_OK;
}

void app_main(void)
{
    esp_err_t err;

    // Set log levels for components (suppress verbose logs)
    esp_log_level_set("mqtt_client", ESP_LOG_WARN);
    esp_log_level_set("MQTT_CLIENT", ESP_LOG_WARN);
    esp_log_level_set("transport_base", ESP_LOG_WARN);
    esp_log_level_set("TRANSPORT_BASE", ESP_LOG_WARN);
    esp_log_level_set("esp-tls", ESP_LOG_WARN);
    esp_log_level_set("wifi", ESP_LOG_WARN);
    esp_log_level_set("BT_GATT", ESP_LOG_WARN);
    esp_log_level_set("BLE_MESH", ESP_LOG_WARN);  // Only show warnings/errors (hide bearer info)
    esp_log_level_set("nvs", ESP_LOG_INFO);  // Show NVS info

    // Keep our application logs at INFO level
    esp_log_level_set(TAG, ESP_LOG_INFO);

    ESP_LOGI(TAG, "Smart Storage Gateway Node starting...");

    // Initialize Mesh Storage (NVS)
    err = mesh_storage_init();
    ESP_ERROR_CHECK(err);

    // Check if already provisioned (load from NVS)
    mesh_prov_data_t prov_data;
    err = mesh_storage_load_prov_data(&prov_data);
    if (err == ESP_OK) {
        provisioned = true;
        node_addr = prov_data.node_addr;

        // mesh_storage_load_prov_data() already prints detailed info
        // Just print a summary here
        ESP_LOGI(TAG, "✅ Device is provisioned (Node: 0x%04X)", prov_data.node_addr);

        // Load model bindings (detailed logs printed by load functions)
        mesh_model_binding_t binding;
        mesh_storage_load_model_binding("onoff_cli", &binding);
        mesh_storage_load_model_binding("onoff_srv", &binding);

        // Load publication settings (detailed logs printed by load functions)
        mesh_pub_settings_t pub_settings;
        mesh_storage_load_pub_settings("onoff_cli", &pub_settings);
    } else {
        ESP_LOGI(TAG, "ℹ️  Device not provisioned yet");
    }

    // Initialize button GPIO for factory reset
    gpio_config_t button_conf = {
        .pin_bit_mask = (1ULL << BUTTON_GPIO),
        .mode = GPIO_MODE_INPUT,
        .pull_up_en = GPIO_PULLUP_ENABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    gpio_config(&button_conf);

    // Initialize NeoPixel
    neopixel_init();

    // Start LED control task
    xTaskCreate(led_control_task, "led_control", 2048, NULL, 5, NULL);

    // Start factory reset monitor task
    xTaskCreate(factory_reset_task, "factory_reset", 2048, NULL, 5, NULL);

    // Initialize WiFi Manager
    ESP_LOGI(TAG, "Initializing WiFi Manager...");
    err = wifi_manager_init();
    ESP_ERROR_CHECK(err);

    // Register WiFi event callback for LED updates
    wifi_manager_set_event_callback(wifi_event_led_callback);

    // Check for saved WiFi credentials
    wifi_credential_t credentials[WIFI_MAX_CREDENTIALS];
    size_t count = 0;
    wifi_manager_get_credentials(credentials, WIFI_MAX_CREDENTIALS, &count);

    if (count == 0) {
        // No saved networks - start in AP mode for initial configuration
        ESP_LOGI(TAG, "📡 No saved WiFi networks - Starting AP mode for configuration");
        ESP_LOGI(TAG, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        ESP_LOGI(TAG, "  Connect to WiFi: %s", WIFI_AP_SSID);
        ESP_LOGI(TAG, "  Password: %s", WIFI_AP_PASS);
        ESP_LOGI(TAG, "  Web UI: http://192.168.4.1");
        ESP_LOGI(TAG, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        ESP_LOGI(TAG, "🔧 Calling wifi_manager_start_ap()...");
        esp_err_t ap_err = wifi_manager_start_ap();
        ESP_LOGI(TAG, "🔧 wifi_manager_start_ap() returned: %s", esp_err_to_name(ap_err));

        // Update LED state for AP mode
        wifi_ap_mode = true;
        wifi_connected = false;

        // Start web server for AP mode configuration
        err = web_server_start();
        if (err != ESP_OK) {
            ESP_LOGE(TAG, "Failed to start web server in AP mode");
        }
    } else {
        // Try to connect to saved network
        ESP_LOGI(TAG, "Found %d saved WiFi network(s), attempting to connect...", count);

        // Try to connect to the first saved network
        ESP_LOGI(TAG, "Connecting to WiFi: %s", credentials[0].ssid);
        err = wifi_manager_connect(credentials[0].ssid);

        if (err == ESP_OK) {
            wifi_connected = true;

            // Start web server after successful WiFi connection
            err = web_server_start();
            if (err == ESP_OK) {
                // Get IP address to display
                wifi_status_t status;
                wifi_manager_get_status(&status);
                if (status.connected) {
                    ESP_LOGI(TAG, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
                    ESP_LOGI(TAG, "  🌐 Web UI available at http://%d.%d.%d.%d",
                             status.ip[0], status.ip[1], status.ip[2], status.ip[3]);
                    ESP_LOGI(TAG, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
                }
            } else {
                ESP_LOGE(TAG, "Failed to start web server");
            }

            // Start MQTT after WiFi connection
            ESP_LOGI(TAG, "🌐 Starting MQTT client...");
            mqtt_app_start();
        } else {
            // Connection failed - AP mode will be started automatically by event handler
            ESP_LOGW(TAG, "Failed to connect to WiFi - AP mode will start automatically");

            // Start web server anyway (will work in AP mode)
            err = web_server_start();
            if (err != ESP_OK) {
                ESP_LOGE(TAG, "Failed to start web server");
            }
        }
    }

    // Note: MQTT will be started automatically when WiFi connects (see wifi_event_led_callback)
    
    // Initialize Bluetooth
    ESP_ERROR_CHECK(esp_bt_controller_mem_release(ESP_BT_MODE_CLASSIC_BT));
    
    esp_bt_controller_config_t bt_cfg = BT_CONTROLLER_INIT_CONFIG_DEFAULT();
    err = esp_bt_controller_init(&bt_cfg);
    if (err) {
        ESP_LOGE(TAG, "Bluetooth controller init failed");
        return;
    }
    
    err = esp_bt_controller_enable(ESP_BT_MODE_BLE);
    if (err) {
        ESP_LOGE(TAG, "Bluetooth controller enable failed");
        return;
    }
    
    err = esp_bluedroid_init();
    if (err) {
        ESP_LOGE(TAG, "Bluedroid init failed");
        return;
    }
    
    err = esp_bluedroid_enable();
    if (err) {
        ESP_LOGE(TAG, "Bluedroid enable failed");
        return;
    }
    
    // Initialize BLE Mesh
    err = ble_mesh_init();
    if (err) {
        ESP_LOGE(TAG, "BLE Mesh init failed");
        return;
    }
    
    ESP_LOGI(TAG, "Gateway Node ready");
}