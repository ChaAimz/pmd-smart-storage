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
#include "driver/gpio.h"
#include "driver/rtc_io.h"
#include "esp_sleep.h"
#include "esp_timer.h"
#include "led_strip.h"
#include "nvs.h"
#include "mesh_storage.h"

static const char *TAG = "ENDPOINT_NODE";

/* GPIO Configuration - Using onboard components */
#define LED_GPIO            GPIO_NUM_15  // Red LED onboard
#define NEOPIXEL_GPIO       GPIO_NUM_9   // NeoPixel LED
#define NEOPIXEL_POWER_GPIO GPIO_NUM_20  // NeoPixel power control
#define BUTTON_GPIO         GPIO_NUM_5   // Factory reset button on GPIO5
#define BUTTON_ACTIVE_LEVEL 0

/* NeoPixel Configuration */
#define NEOPIXEL_COUNT      1

/* Factory Reset Configuration */
#define FACTORY_RESET_HOLD_TIME_MS 10000  // 10 seconds
#define FACTORY_RESET_WARNING_1_MS 3000   // First warning at 3 seconds
#define FACTORY_RESET_WARNING_2_MS 7000   // Second warning at 7 seconds

/* Battery Configuration */
#define BATTERY_LOW_THRESHOLD 10  // 10% battery

/* LED State */
typedef enum {
    LED_STATE_LOCATION_INDICATOR,  // Green solid - showing storage location
    LED_STATE_BATTERY_LOW,          // Red blinking - battery < 10%
    LED_STATE_NO_GATEWAY,           // Blue blinking - no gateway connection
    LED_STATE_OTHER                 // Yellow blinking - other states
} led_state_t;

/* Bluetooth Mesh Configuration */
#define CID_ESP             0x02E5
#define PROV_OWN_ADDR       0x0001

/* Node Configuration */
#define NODE_ADDRESS        0x0000  // Will be set during provisioning

/* Deep Sleep Configuration */
#define DEEP_SLEEP_TIMEOUT_MS   300000  // 5 minutes after last activity (for testing/configuration)
#define BUTTON_WAKEUP_LEVEL     0       // Wake on button press (LOW)

/* Factory Reset Configuration */
#define FACTORY_RESET_HOLD_TIME_MS  10000  // Hold button for 10 seconds to factory reset
#define FACTORY_RESET_WARNING_TIME_MS 3000  // Warning at 3 seconds
#define FACTORY_RESET_CRITICAL_TIME_MS 7000 // Critical warning at 7 seconds

// Device UUID - "ESP BLE Mesh Endpoint" in ASCII
static uint8_t dev_uuid[16] = {
    'E', 'S', 'P', ' ', 'E', 'n', 'd', 'p',
    'o', 'i', 'n', 't', 0x00, 0x00, 0x00, 0x00
};
static esp_ble_mesh_cfg_srv_t config_server;

static esp_ble_mesh_gen_onoff_srv_t onoff_server = {
    .rsp_ctrl = {
        .get_auto_rsp = ESP_BLE_MESH_SERVER_AUTO_RSP,
        .set_auto_rsp = ESP_BLE_MESH_SERVER_AUTO_RSP,
    },
    .state = {
        .onoff = 0,
        .target_onoff = 0,
    },
};

// Publication context for Generic OnOff Server
ESP_BLE_MESH_MODEL_PUB_DEFINE(onoff_pub, 2 + 3, ROLE_NODE);

// Generic OnOff Client for sending button press messages
static esp_ble_mesh_client_t onoff_client;

static esp_ble_mesh_model_t root_models[] = {
    ESP_BLE_MESH_MODEL_CFG_SRV(&config_server),
    ESP_BLE_MESH_MODEL_GEN_ONOFF_SRV(&onoff_pub, &onoff_server),
    ESP_BLE_MESH_MODEL_GEN_ONOFF_CLI(NULL, &onoff_client),
};

static esp_ble_mesh_elem_t elements[] = {
    ESP_BLE_MESH_ELEMENT(0, root_models, ESP_BLE_MESH_MODEL_NONE),
};

static esp_ble_mesh_comp_t composition = {
    .cid = CID_ESP,
    .elements = elements,
    .element_count = ARRAY_SIZE(elements),
};

static esp_ble_mesh_prov_t provision = {
    .uuid = dev_uuid,
    .output_size = 0,
    .output_actions = 0,
    .input_size = 0,
    .input_actions = 0,
};

static esp_timer_handle_t sleep_timer;
static uint16_t node_addr = 0;
static led_strip_handle_t led_strip;
static led_state_t current_led_state = LED_STATE_OTHER;
static bool provisioned = false;
static bool gateway_connected = false;
static uint8_t battery_percent = 100;
static bool location_indicator_active = false;

/* Forward Declarations */
static void reset_sleep_timer(void);

/* NeoPixel Control Functions */
static void neopixel_init(void)
{
    // Enable NeoPixel power
    gpio_reset_pin(NEOPIXEL_POWER_GPIO);
    gpio_set_direction(NEOPIXEL_POWER_GPIO, GPIO_MODE_OUTPUT);
    gpio_set_level(NEOPIXEL_POWER_GPIO, 1);

    // Configure NeoPixel LED strip
    led_strip_config_t strip_config = {
        .strip_gpio_num = NEOPIXEL_GPIO,
        .max_leds = NEOPIXEL_COUNT,
        .led_pixel_format = LED_PIXEL_FORMAT_GRB,
        .led_model = LED_MODEL_WS2812,
        .flags.invert_out = false,
    };

    led_strip_rmt_config_t rmt_config = {
        .clk_src = RMT_CLK_SRC_DEFAULT,
        .resolution_hz = 10 * 1000 * 1000, // 10MHz
        .flags.with_dma = false,
    };

    ESP_ERROR_CHECK(led_strip_new_rmt_device(&strip_config, &rmt_config, &led_strip));

    // Clear LED (turn off)
    led_strip_clear(led_strip);
}

static void neopixel_set_color(uint8_t red, uint8_t green, uint8_t blue)
{
    led_strip_set_pixel(led_strip, 0, red, green, blue);
    led_strip_refresh(led_strip);
}

static void neopixel_off(void)
{
    led_strip_clear(led_strip);
}

/* Battery Monitoring (Mock for now - can be replaced with real battery reading) */
static void update_battery_status(void)
{
    // TODO: Replace with actual battery reading from MAX17048 or ADC
    // For now, use mock value
    // battery_percent = read_battery_percentage();

    // Mock: Simulate battery drain over time (for testing)
    static uint32_t last_update = 0;
    uint32_t now = esp_timer_get_time() / 1000000;  // seconds

    if (now - last_update > 60) {  // Update every 60 seconds
        if (battery_percent > 0) {
            battery_percent--;  // Decrease 1% per minute (for testing)
        }
        last_update = now;
        ESP_LOGI(TAG, "Battery: %d%%", battery_percent);
    }
}

/* Update LED state based on system status */
static void update_led_state(void)
{
    update_battery_status();

    // Priority order: Location > Battery Low > No Gateway > Other
    if (location_indicator_active) {
        current_led_state = LED_STATE_LOCATION_INDICATOR;
    } else if (battery_percent < BATTERY_LOW_THRESHOLD) {
        current_led_state = LED_STATE_BATTERY_LOW;
    } else if (!gateway_connected) {
        current_led_state = LED_STATE_NO_GATEWAY;
    } else {
        current_led_state = LED_STATE_OTHER;
    }
}

/* Red LED Control Functions */
static void led_init(void)
{
    gpio_reset_pin(LED_GPIO);
    gpio_set_direction(LED_GPIO, GPIO_MODE_OUTPUT);
    gpio_set_level(LED_GPIO, 0);
}

static void led_on(void)
{
    gpio_set_level(LED_GPIO, 1);
}

static void led_off(void)
{
    gpio_set_level(LED_GPIO, 0);
}

static void led_toggle(void)
{
    static bool led_state = false;
    led_state = !led_state;
    gpio_set_level(LED_GPIO, led_state);
}

/* Button Control Functions */
static void button_init(void)
{
    // Configure GPIO5 for factory reset button
    gpio_config_t io_conf = {
        .intr_type = GPIO_INTR_DISABLE,  // No interrupt - use polling
        .mode = GPIO_MODE_INPUT,
        .pin_bit_mask = (1ULL << BUTTON_GPIO),
        .pull_up_en = GPIO_PULLUP_ENABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
    };
    gpio_config(&io_conf);

    ESP_LOGI(TAG, "Factory reset button initialized on GPIO%d", BUTTON_GPIO);
    ESP_LOGI(TAG, "Hold button for 10 seconds to factory reset");
}

/* Deep Sleep Functions */
static void sleep_timer_callback(void *arg)
{
    // Disable deep sleep until provisioned
    if (!provisioned) {
        ESP_LOGI(TAG, "Not provisioned yet, skipping deep sleep");
        reset_sleep_timer();
        return;
    }

    ESP_LOGI(TAG, "Entering deep sleep mode...");

    // Turn off LED before sleep
    led_off();
    neopixel_off();

    // Enter deep sleep (no wakeup source - will require reset to wake)
    esp_deep_sleep_start();
}

static void reset_sleep_timer(void)
{
    if (sleep_timer != NULL) {
        esp_timer_stop(sleep_timer);
        esp_timer_start_once(sleep_timer, DEEP_SLEEP_TIMEOUT_MS * 1000);
    }
}

static void sleep_timer_init(void)
{
    const esp_timer_create_args_t timer_args = {
        .callback = &sleep_timer_callback,
        .name = "sleep_timer"
    };
    esp_timer_create(&timer_args, &sleep_timer);
    reset_sleep_timer();
}

/* Bluetooth Mesh Message Sending */
static void send_button_press_message(void)
{
    esp_err_t err;

    // Prepare Generic OnOff Set message
    esp_ble_mesh_generic_client_set_state_t set_state = {0};
    set_state.onoff_set.op_en = false;
    set_state.onoff_set.onoff = 1;  // Button pressed = ON
    set_state.onoff_set.tid = 0;

    // Prepare common parameters
    esp_ble_mesh_client_common_param_t common = {0};
    common.opcode = ESP_BLE_MESH_MODEL_OP_GEN_ONOFF_SET_UNACK;
    common.model = &root_models[2];  // Generic OnOff Client (index 2)
    common.ctx.net_idx = 0;
    common.ctx.app_idx = 0;
    common.ctx.addr = 0xC000;  // Group address (All Nodes)
    common.ctx.send_ttl = 3;
    common.msg_timeout = 0;

    // Send message
    err = esp_ble_mesh_generic_client_set_state(&common, &set_state);

    if (err == ESP_OK) {
        ESP_LOGI(TAG, "Button press message sent to 0x%04x", common.ctx.addr);
    } else {
        ESP_LOGE(TAG, "Failed to send button press message: %d", err);
    }
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
        gateway_connected = true;

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

        update_led_state();
        break;
    case ESP_BLE_MESH_NODE_PROV_RESET_EVT:
        ESP_LOGI(TAG, "Provisioning reset");
        break;
    default:
        break;
    }
}

static void config_server_cb(esp_ble_mesh_cfg_server_cb_event_t event, esp_ble_mesh_cfg_server_cb_param_t *param)
{
    ESP_LOGI(TAG, "Config server callback, event %d", event);

    if (event == ESP_BLE_MESH_CFG_SERVER_STATE_CHANGE_EVT) {
        ESP_LOGI(TAG, "Config server state changed");

        // Check if this is a model app bind event
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
            if (param->value.state_change.mod_app_bind.model_id == ESP_BLE_MESH_MODEL_ID_GEN_ONOFF_SRV) {
                model_id = "onoff_srv";
            } else if (param->value.state_change.mod_app_bind.model_id == ESP_BLE_MESH_MODEL_ID_GEN_ONOFF_CLI) {
                model_id = "onoff_cli";
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
            if (param->value.state_change.mod_pub_set.model_id == ESP_BLE_MESH_MODEL_ID_GEN_ONOFF_SRV) {
                model_id = "onoff_srv";
            } else if (param->value.state_change.mod_pub_set.model_id == ESP_BLE_MESH_MODEL_ID_GEN_ONOFF_CLI) {
                model_id = "onoff_cli";
            }

            if (model_id) {
                // Detailed log printed by save function
                mesh_storage_save_pub_settings(model_id, &pub_settings);
            }
            break;

        case ESP_BLE_MESH_MODEL_OP_MODEL_SUB_ADD:
            ESP_LOGI(TAG, "Model subscription add: elem_addr=0x%04x, sub_addr=0x%04x",
                     param->value.state_change.mod_sub_add.element_addr,
                     param->value.state_change.mod_sub_add.sub_addr);
            // Note: Subscription addresses could be saved here if needed
            break;

        default:
            break;
        }
    }
}



/* LED Control Task */
static void led_control_task(void *pvParameters)
{
    static bool blink_state = false;
    static uint8_t last_onoff = 0;
    uint32_t blink_delay = 500;  // 500ms for blinking

    while (1) {
        // Check if onoff state changed
        if (onoff_server.state.onoff != last_onoff) {
            last_onoff = onoff_server.state.onoff;

            if (last_onoff) {
                location_indicator_active = true;
                ESP_LOGI(TAG, "Location indicator ON (from BLE Mesh)");
            } else {
                location_indicator_active = false;
                ESP_LOGI(TAG, "Location indicator OFF (from BLE Mesh)");
            }

            reset_sleep_timer();
        }

        update_led_state();

        switch (current_led_state) {
            case LED_STATE_LOCATION_INDICATOR:
                // Green solid - storage location indicator
                neopixel_set_color(0, 255, 0);  // Green
                break;

            case LED_STATE_BATTERY_LOW:
                // Red blinking - battery < 10%
                if (blink_state) {
                    neopixel_set_color(255, 0, 0);  // Red
                } else {
                    neopixel_off();
                }
                blink_state = !blink_state;
                break;

            case LED_STATE_NO_GATEWAY:
                // Blue blinking - no gateway connection
                if (blink_state) {
                    neopixel_set_color(0, 0, 255);  // Blue
                } else {
                    neopixel_off();
                }
                blink_state = !blink_state;
                break;

            case LED_STATE_OTHER:
                // Yellow blinking - other states
                if (blink_state) {
                    neopixel_set_color(255, 255, 0);  // Yellow
                } else {
                    neopixel_off();
                }
                blink_state = !blink_state;
                break;
        }

        // Red LED control based on gateway connection
        if (gateway_connected) {
            led_toggle();  // Blink when connected
        } else {
            led_on();      // Solid when not connected
        }

        vTaskDelay(pdMS_TO_TICKS(blink_delay));
    }
}

/* Factory Reset Handler - GPIO0 Button */
static void check_factory_reset(void)
{
    static uint32_t button_hold_start = 0;
    static bool factory_reset_in_progress = false;
    static bool warning_shown = false;
    static bool critical_warning_shown = false;

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
            ESP_LOGI(TAG, "Button pressed - hold for 10 seconds to factory reset");
        } else {
            // Button is being held
            uint32_t hold_duration = (esp_timer_get_time() / 1000) - button_hold_start;

            // Warning at 3 seconds
            if (hold_duration >= FACTORY_RESET_WARNING_1_MS && !warning_shown) {
                warning_shown = true;
                ESP_LOGW(TAG, "⚠️  Factory reset in %d seconds...",
                         (FACTORY_RESET_HOLD_TIME_MS - hold_duration) / 1000);
            }

            // Critical warning at 7 seconds
            if (hold_duration >= FACTORY_RESET_WARNING_2_MS && !critical_warning_shown) {
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
                // Short press (< 10 seconds)
                if (hold_duration < 1000) {
                    // Very short press (< 1 second) - treat as button press
                    ESP_LOGI(TAG, "Button pressed!");

                    // Turn off location indicator when button pressed
                    if (location_indicator_active) {
                        location_indicator_active = false;
                        ESP_LOGI(TAG, "Location indicator turned off by button");
                    }

                    // Send button press message via Bluetooth Mesh
                    send_button_press_message();

                    // Reset sleep timer
                    reset_sleep_timer();
                } else {
                    // Medium press (1-10 seconds) - factory reset cancelled
                    ESP_LOGI(TAG, "Factory reset cancelled (held for %d ms)", hold_duration);
                }
            }

            button_hold_start = 0;
            factory_reset_in_progress = false;
            warning_shown = false;
            critical_warning_shown = false;
        }
    }
}

/* Main Application Task */
static void app_task(void *pvParameters)
{
    while (1) {
        // Check for factory reset (button hold) and handle button press
        check_factory_reset();

        vTaskDelay(pdMS_TO_TICKS(100));
    }
}

/* Generic Server Callback */
static void generic_server_cb(esp_ble_mesh_generic_server_cb_event_t event, esp_ble_mesh_generic_server_cb_param_t *param)
{
    switch (event) {
    case ESP_BLE_MESH_GENERIC_SERVER_STATE_CHANGE_EVT:
        ESP_LOGI(TAG, "Generic server state changed: onoff=%d", onoff_server.state.onoff);

        // Check for factory reset command (onoff=2 is special value)
        if (onoff_server.state.onoff == 2) {
            ESP_LOGW(TAG, "🔴 Factory reset command received via MQTT!");
            ESP_LOGW(TAG, "Clearing provisioning data and restarting...");

            // Clear all provisioning data
            mesh_storage_clear();

            // Wait a moment for logs to flush
            vTaskDelay(pdMS_TO_TICKS(500));

            // Restart device
            esp_restart();
        }

        // Update location indicator based on received state (only for normal values 0 or 1)
        if (onoff_server.state.onoff <= 1) {
            location_indicator_active = onoff_server.state.onoff;
            ESP_LOGI(TAG, "Location indicator %s", location_indicator_active ? "ON" : "OFF");
        }

        reset_sleep_timer();
        break;
    case ESP_BLE_MESH_GENERIC_SERVER_RECV_GET_MSG_EVT:
        ESP_LOGI(TAG, "Generic server recv get msg");
        break;
    case ESP_BLE_MESH_GENERIC_SERVER_RECV_SET_MSG_EVT:
        ESP_LOGI(TAG, "Generic server recv set msg: onoff=%d", onoff_server.state.onoff);

        // Check for factory reset command (onoff=2 is special value)
        if (onoff_server.state.onoff == 2) {
            ESP_LOGW(TAG, "🔴 Factory reset command received via MQTT!");
            ESP_LOGW(TAG, "Clearing provisioning data and restarting...");

            // Clear all provisioning data
            mesh_storage_clear();

            // Wait a moment for logs to flush
            vTaskDelay(pdMS_TO_TICKS(500));

            // Restart device
            esp_restart();
        }

        // Update location indicator based on received state (only for normal values 0 or 1)
        if (onoff_server.state.onoff <= 1) {
            location_indicator_active = onoff_server.state.onoff;
            ESP_LOGI(TAG, "Location indicator %s", location_indicator_active ? "ON" : "OFF");
        }

        reset_sleep_timer();
        break;
    default:
        break;
    }
}

/* Generic Client Callback */
static void generic_client_cb(esp_ble_mesh_generic_client_cb_event_t event, esp_ble_mesh_generic_client_cb_param_t *param)
{
    switch (event) {
    case ESP_BLE_MESH_GENERIC_CLIENT_SET_STATE_EVT:
        ESP_LOGI(TAG, "Generic client set state complete");
        break;
    case ESP_BLE_MESH_GENERIC_CLIENT_TIMEOUT_EVT:
        ESP_LOGW(TAG, "Generic client timeout");
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

    // Only enable provisioning if not already provisioned
    if (!provisioned) {
        err = esp_ble_mesh_node_prov_enable(ESP_BLE_MESH_PROV_ADV | ESP_BLE_MESH_PROV_GATT);
        if (err != ESP_OK) {
            ESP_LOGE(TAG, "Failed to enable provisioning");
            return err;
        }
        ESP_LOGI(TAG, "BLE Mesh Node initialized - Ready for provisioning");
    } else {
        ESP_LOGI(TAG, "BLE Mesh Node initialized - Already provisioned");
    }

    return ESP_OK;
}

void app_main(void)
{
    esp_err_t err;

    // Set log levels for components (suppress verbose logs)
    esp_log_level_set("BT_GATT", ESP_LOG_WARN);
    esp_log_level_set("BLE_MESH", ESP_LOG_WARN);  // Only show warnings/errors (hide bearer info)
    esp_log_level_set("BT_BTM", ESP_LOG_WARN);
    esp_log_level_set("BT_L2CAP", ESP_LOG_WARN);
    esp_log_level_set("nvs", ESP_LOG_INFO);  // Show NVS info

    // Keep our application logs at INFO level
    esp_log_level_set(TAG, ESP_LOG_INFO);

    ESP_LOGI(TAG, "Smart Storage Endpoint Node starting...");

    // Check wakeup reason
    esp_sleep_wakeup_cause_t wakeup_reason = esp_sleep_get_wakeup_cause();
    switch (wakeup_reason) {
        case ESP_SLEEP_WAKEUP_EXT0:
            ESP_LOGI(TAG, "Wakeup caused by button press");
            break;
        case ESP_SLEEP_WAKEUP_UNDEFINED:
        default:
            ESP_LOGI(TAG, "First boot or reset");
            break;
    }
    
    // Initialize Mesh Storage (NVS)
    err = mesh_storage_init();
    ESP_ERROR_CHECK(err);

    // Check if already provisioned (load from NVS)
    mesh_prov_data_t prov_data;
    err = mesh_storage_load_prov_data(&prov_data);
    if (err == ESP_OK) {
        provisioned = true;
        node_addr = prov_data.node_addr;
        gateway_connected = true;

        // mesh_storage_load_prov_data() already prints detailed info
        // Just print a summary here
        ESP_LOGI(TAG, "✅ Device is provisioned (Node: 0x%04X)", prov_data.node_addr);

        // Load model bindings (detailed logs printed by load functions)
        mesh_model_binding_t binding;
        mesh_storage_load_model_binding("onoff_srv", &binding);
        mesh_storage_load_model_binding("onoff_cli", &binding);

        // Load publication settings (detailed logs printed by load functions)
        mesh_pub_settings_t pub_settings;
        mesh_storage_load_pub_settings("onoff_srv", &pub_settings);
        mesh_storage_load_pub_settings("onoff_cli", &pub_settings);
    } else {
        ESP_LOGI(TAG, "ℹ️  Device not provisioned yet");
    }

    // Initialize GPIO
    led_init();
    neopixel_init();
    button_init();
    
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
    
    // Initialize sleep timer
    sleep_timer_init();

    // Create LED control task
    xTaskCreate(led_control_task, "led_control", 4096, NULL, 5, NULL);

    // Create application task
    xTaskCreate(app_task, "app_task", 4096, NULL, 5, NULL);

    ESP_LOGI(TAG, "Endpoint Node ready");
}