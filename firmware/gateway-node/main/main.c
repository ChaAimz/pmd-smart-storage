#include <stdio.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/event_groups.h"
#include "esp_log.h"
#include "nvs_flash.h"
#include "esp_bt.h"
#include "esp_bt_main.h"
#include "esp_gap_ble_api.h"
#include "esp_ble_mesh_defs.h"
#include "esp_ble_mesh_common_api.h"
#include "esp_ble_mesh_networking_api.h"
#include "esp_ble_mesh_provisioning_api.h"
#include "esp_ble_mesh_config_model_api.h"
#include "esp_ble_mesh_generic_model_api.h"
#include "esp_wifi.h"
#include "esp_event.h"
#include "mqtt_client.h"
#include "cJSON.h"
#include "led_strip.h"
#include "driver/gpio.h"
#include "nvs.h"

static const char *TAG = "GATEWAY_NODE";

/* GPIO Configuration - Adafruit ESP32-C6 Feather */
#define NEOPIXEL_GPIO       GPIO_NUM_9   // NeoPixel LED
#define NEOPIXEL_POWER_GPIO GPIO_NUM_20  // NeoPixel power control
#define NEOPIXEL_COUNT      1

/* WiFi Configuration */
#define WIFI_SSID      "Veeraphat iPhone 15 Pro"
#define WIFI_PASS      "gggggggg"
#define WIFI_MAX_RETRY 10

/* MQTT Configuration */
#define MQTT_BROKER_URL "mqtt://172.20.10.3:1883"
#define MQTT_TOPIC_STATUS "smart-storage/status"
#define MQTT_TOPIC_COMMAND "smart-storage/command"
#define MQTT_TOPIC_BUTTON "smart-storage/button"

/* Bluetooth Mesh Configuration */
#define CID_ESP        0x02E5

static EventGroupHandle_t s_wifi_event_group;
static esp_mqtt_client_handle_t mqtt_client;
static int s_retry_num = 0;
static led_strip_handle_t led_strip;
static bool wifi_connected = false;
static bool provisioned = false;
static uint16_t node_addr = 0;

#define WIFI_CONNECTED_BIT BIT0
#define WIFI_FAIL_BIT      BIT1

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

/* WiFi Event Handler */
static void wifi_event_handler(void* arg, esp_event_base_t event_base,
                                int32_t event_id, void* event_data)
{
    if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START) {
        esp_wifi_connect();
    } else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_DISCONNECTED) {
        if (s_retry_num < WIFI_MAX_RETRY) {
            esp_wifi_connect();
            s_retry_num++;
            ESP_LOGI(TAG, "Retry to connect to the AP");
        } else {
            xEventGroupSetBits(s_wifi_event_group, WIFI_FAIL_BIT);
        }
        ESP_LOGI(TAG, "Connect to the AP fail");
    } else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP) {
        ip_event_got_ip_t* event = (ip_event_got_ip_t*) event_data;
        ESP_LOGI(TAG, "Got IP:" IPSTR, IP2STR(&event->ip_info.ip));
        s_retry_num = 0;
        wifi_connected = true;
        xEventGroupSetBits(s_wifi_event_group, WIFI_CONNECTED_BIT);
    }
}

/* LED Control Task */
static void led_control_task(void *pvParameters)
{
    bool blink_state = false;

    while (1) {
        if (wifi_connected) {
            // WiFi connected - Blue solid
            neopixel_set_color(0, 0, 255);  // Blue
        } else {
            // WiFi not connected - Blue blinking
            if (blink_state) {
                neopixel_set_color(0, 0, 255);  // Blue
            } else {
                neopixel_off();
            }
            blink_state = !blink_state;
        }

        vTaskDelay(pdMS_TO_TICKS(500));  // 500ms blink rate
    }
}

/* WiFi Initialization */
static void wifi_init_sta(void)
{
    s_wifi_event_group = xEventGroupCreate();

    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    esp_netif_create_default_wifi_sta();

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));

    esp_event_handler_instance_t instance_any_id;
    esp_event_handler_instance_t instance_got_ip;
    ESP_ERROR_CHECK(esp_event_handler_instance_register(WIFI_EVENT,
                                                        ESP_EVENT_ANY_ID,
                                                        &wifi_event_handler,
                                                        NULL,
                                                        &instance_any_id));
    ESP_ERROR_CHECK(esp_event_handler_instance_register(IP_EVENT,
                                                        IP_EVENT_STA_GOT_IP,
                                                        &wifi_event_handler,
                                                        NULL,
                                                        &instance_got_ip));

    wifi_config_t wifi_config = {
        .sta = {
            .ssid = WIFI_SSID,
            .password = WIFI_PASS,
            .threshold.authmode = WIFI_AUTH_OPEN,
            .scan_method = WIFI_ALL_CHANNEL_SCAN,
            .sort_method = WIFI_CONNECT_AP_BY_SIGNAL,
        },
    };
    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_config));
    ESP_ERROR_CHECK(esp_wifi_start());

    ESP_LOGI(TAG, "WiFi initialization finished");

    EventBits_t bits = xEventGroupWaitBits(s_wifi_event_group,
            WIFI_CONNECTED_BIT | WIFI_FAIL_BIT,
            pdFALSE,
            pdFALSE,
            portMAX_DELAY);

    if (bits & WIFI_CONNECTED_BIT) {
        ESP_LOGI(TAG, "Connected to AP SSID:%s", WIFI_SSID);
    } else if (bits & WIFI_FAIL_BIT) {
        ESP_LOGI(TAG, "Failed to connect to SSID:%s", WIFI_SSID);
    } else {
        ESP_LOGE(TAG, "UNEXPECTED EVENT");
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
                cJSON *led_state_json = cJSON_GetObjectItem(json, "led_state");
                
                if (cJSON_IsNumber(node_addr_json) && cJSON_IsBool(led_state_json)) {
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
        ESP_LOGI(TAG, "Provisioning complete");
        node_addr = param->node_prov_complete.addr;
        ESP_LOGI(TAG, "Node address: 0x%04x", node_addr);
        provisioned = true;

        // Save provisioning state to NVS
        nvs_handle_t nvs_handle;
        esp_err_t err = nvs_open("ble_mesh", NVS_READWRITE, &nvs_handle);
        if (err == ESP_OK) {
            nvs_set_u8(nvs_handle, "provisioned", 1);
            nvs_set_u16(nvs_handle, "node_addr", node_addr);
            nvs_commit(nvs_handle);
            nvs_close(nvs_handle);
            ESP_LOGI(TAG, "Provisioning data saved to NVS");
        } else {
            ESP_LOGE(TAG, "Failed to open NVS for saving provisioning data: %d", err);
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
    }
}

static void generic_server_cb(esp_ble_mesh_generic_server_cb_event_t event, esp_ble_mesh_generic_server_cb_param_t *param)
{
    switch (event) {
    case ESP_BLE_MESH_GENERIC_SERVER_STATE_CHANGE_EVT:
        ESP_LOGI(TAG, "Generic server state changed");
        if (param->ctx.recv_op == ESP_BLE_MESH_MODEL_OP_GEN_ONOFF_SET ||
            param->ctx.recv_op == ESP_BLE_MESH_MODEL_OP_GEN_ONOFF_SET_UNACK) {
            ESP_LOGI(TAG, "Received button press from node 0x%04x", param->ctx.addr);
            publish_button_press(param->ctx.addr);
        }
        break;
    case ESP_BLE_MESH_GENERIC_SERVER_RECV_GET_MSG_EVT:
        ESP_LOGI(TAG, "Generic server recv get msg");
        break;
    case ESP_BLE_MESH_GENERIC_SERVER_RECV_SET_MSG_EVT:
        ESP_LOGI(TAG, "Generic server recv set msg");
        if (param->ctx.recv_op == ESP_BLE_MESH_MODEL_OP_GEN_ONOFF_SET ||
            param->ctx.recv_op == ESP_BLE_MESH_MODEL_OP_GEN_ONOFF_SET_UNACK) {
            ESP_LOGI(TAG, "Received button press from node 0x%04x", param->ctx.addr);
            publish_button_press(param->ctx.addr);
        }
        break;
    default:
        break;
    }
}

static void generic_client_cb(esp_ble_mesh_generic_client_cb_event_t event, esp_ble_mesh_generic_client_cb_param_t *param)
{
    switch (event) {
    case ESP_BLE_MESH_GENERIC_CLIENT_GET_STATE_EVT:
        ESP_LOGI(TAG, "Generic client get state");
        break;
    case ESP_BLE_MESH_GENERIC_CLIENT_SET_STATE_EVT:
        ESP_LOGI(TAG, "Generic client set state");
        break;
    case ESP_BLE_MESH_GENERIC_CLIENT_PUBLISH_EVT:
        ESP_LOGI(TAG, "Generic client publish");
        break;
    case ESP_BLE_MESH_GENERIC_CLIENT_TIMEOUT_EVT:
        ESP_LOGI(TAG, "Generic client timeout");
        break;
    default:
        break;
    }
}

/* Handle incoming BLE Mesh messages */
static void ble_mesh_custom_model_cb(esp_ble_mesh_model_cb_event_t event, esp_ble_mesh_model_cb_param_t *param)
{
    switch (event) {
    case ESP_BLE_MESH_MODEL_OPERATION_EVT:
        if (param->model_operation.opcode == ESP_BLE_MESH_MODEL_OP_GEN_ONOFF_SET_UNACK) {
            ESP_LOGI(TAG, "Received button press from node 0x%04x", param->model_operation.ctx->addr);
            publish_button_press(param->model_operation.ctx->addr);
        }
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
    esp_ble_mesh_register_custom_model_callback(ble_mesh_custom_model_cb);

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
    
    ESP_LOGI(TAG, "BLE Mesh Gateway initialized");
    
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

    // Initialize NVS
    err = nvs_flash_init();
    if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_LOGW(TAG, "NVS partition error (0x%x), erasing...", err);
        ESP_ERROR_CHECK(nvs_flash_erase());
        err = nvs_flash_init();
        ESP_LOGI(TAG, "NVS re-initialized after erase");
    } else {
        ESP_LOGI(TAG, "NVS initialized successfully");
    }
    ESP_ERROR_CHECK(err);

    // Check if already provisioned (load from NVS)
    nvs_handle_t nvs_handle;
    err = nvs_open("ble_mesh", NVS_READONLY, &nvs_handle);
    if (err == ESP_OK) {
        uint8_t is_provisioned = 0;
        err = nvs_get_u8(nvs_handle, "provisioned", &is_provisioned);
        if (err == ESP_OK && is_provisioned == 1) {
            uint16_t saved_addr = 0;
            err = nvs_get_u16(nvs_handle, "node_addr", &saved_addr);
            if (err == ESP_OK) {
                provisioned = true;
                node_addr = saved_addr;
                ESP_LOGI(TAG, "Loaded provisioning data from NVS");
                ESP_LOGI(TAG, "Provisioning complete");
                ESP_LOGI(TAG, "Node address: 0x%04x", node_addr);
            }
        }
        nvs_close(nvs_handle);
    }

    // Initialize NeoPixel
    neopixel_init();

    // Start LED control task
    xTaskCreate(led_control_task, "led_control", 2048, NULL, 5, NULL);

    // Initialize WiFi
    wifi_init_sta();
    
    // Initialize MQTT
    mqtt_app_start();
    
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