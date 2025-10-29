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

static const char *TAG = "ENDPOINT_NODE";

/* GPIO Configuration */
#define LED_GPIO            GPIO_NUM_8
#define BUTTON_GPIO         GPIO_NUM_9
#define BUTTON_ACTIVE_LEVEL 0

/* Bluetooth Mesh Configuration */
#define CID_ESP             0x02E5
#define PROV_OWN_ADDR       0x0001

/* Node Configuration */
#define NODE_ADDRESS        0x0000  // Will be set during provisioning

/* Deep Sleep Configuration */
#define DEEP_SLEEP_TIMEOUT_MS   5000  // 5 seconds after last activity
#define BUTTON_WAKEUP_LEVEL     0     // Wake on button press (LOW)

static uint8_t dev_uuid[16] = { 0xdd, 0xdd };
static esp_ble_mesh_cfg_srv_t config_server;
static esp_ble_mesh_gen_onoff_srv_t onoff_server;

static esp_ble_mesh_model_t root_models[] = {
    ESP_BLE_MESH_MODEL_CFG_SRV(&config_server),
    ESP_BLE_MESH_MODEL_GEN_ONOFF_SRV(NULL, &onoff_server),
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
};

static esp_timer_handle_t sleep_timer;
static bool button_pressed = false;
static uint16_t node_addr = 0;

/* LED Control Functions */
static void led_init(void)
{
    gpio_reset_pin(LED_GPIO);
    gpio_set_direction(LED_GPIO, GPIO_MODE_OUTPUT);
    gpio_set_level(LED_GPIO, 0);
}

static void led_on(void)
{
    gpio_set_level(LED_GPIO, 1);
    ESP_LOGI(TAG, "LED ON");
}

static void led_off(void)
{
    gpio_set_level(LED_GPIO, 0);
    ESP_LOGI(TAG, "LED OFF");
}

/* Button Control Functions */
static void IRAM_ATTR button_isr_handler(void *arg)
{
    button_pressed = true;
}

static void button_init(void)
{
    gpio_config_t io_conf = {
        .intr_type = GPIO_INTR_NEGEDGE,
        .mode = GPIO_MODE_INPUT,
        .pin_bit_mask = (1ULL << BUTTON_GPIO),
        .pull_up_en = GPIO_PULLUP_ENABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
    };
    gpio_config(&io_conf);
    
    gpio_install_isr_service(0);
    gpio_isr_handler_add(BUTTON_GPIO, button_isr_handler, NULL);
}

/* Deep Sleep Functions */
static void sleep_timer_callback(void *arg)
{
    ESP_LOGI(TAG, "Entering deep sleep mode...");
    
    // Configure button as wakeup source
    esp_sleep_enable_ext0_wakeup(BUTTON_GPIO, BUTTON_WAKEUP_LEVEL);
    
    // Disable GPIO hold if previously set
    gpio_deep_sleep_hold_dis();
    
    // Turn off LED before sleep
    led_off();
    
    // Enter deep sleep
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
    esp_ble_mesh_gen_onoff_set_t set = {
        .onoff = 1,
        .tid = 0,
    };
    
    esp_ble_mesh_model_publish(&root_models[1], ESP_BLE_MESH_MODEL_OP_GEN_ONOFF_SET_UNACK,
                               sizeof(set), (uint8_t *)&set, ROLE_NODE);
    
    ESP_LOGI(TAG, "Button press message sent");
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
        // Blink LED to indicate provisioning success
        led_on();
        vTaskDelay(pdMS_TO_TICKS(1000));
        led_off();
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
    if (event == ESP_BLE_MESH_CFG_SERVER_STATE_CHANGE_EVT) {
        ESP_LOGI(TAG, "Config server state changed");
    }
}

static void generic_server_cb(esp_ble_mesh_generic_server_cb_event_t event, esp_ble_mesh_generic_server_cb_param_t *param)
{
    esp_ble_mesh_gen_onoff_srv_t *srv;
    
    switch (event) {
    case ESP_BLE_MESH_GENERIC_SERVER_STATE_CHANGE_EVT:
        ESP_LOGI(TAG, "Generic OnOff Server state change");
        if (param->ctx.recv_op == ESP_BLE_MESH_MODEL_OP_GEN_ONOFF_SET ||
            param->ctx.recv_op == ESP_BLE_MESH_MODEL_OP_GEN_ONOFF_SET_UNACK) {
            
            srv = param->model;
            if (param->value.state_change.onoff_set.onoff) {
                led_on();
                ESP_LOGI(TAG, "Received command to turn LED ON");
            } else {
                led_off();
                ESP_LOGI(TAG, "Received command to turn LED OFF");
            }
            
            reset_sleep_timer();
        }
        break;
    case ESP_BLE_MESH_GENERIC_SERVER_RECV_GET_MSG_EVT:
        ESP_LOGI(TAG, "Generic OnOff Get message received");
        break;
    case ESP_BLE_MESH_GENERIC_SERVER_RECV_SET_MSG_EVT:
        ESP_LOGI(TAG, "Generic OnOff Set message received");
        break;
    default:
        break;
    }
}

/* Main Application Task */
static void app_task(void *pvParameters)
{
    while (1) {
        if (button_pressed) {
            button_pressed = false;
            
            ESP_LOGI(TAG, "Button pressed!");
            
            // Turn on LED as feedback
            led_on();
            vTaskDelay(pdMS_TO_TICKS(200));
            led_off();
            
            // Send button press message via Bluetooth Mesh
            send_button_press_message();
            
            // Reset sleep timer
            reset_sleep_timer();
        }
        
        vTaskDelay(pdMS_TO_TICKS(100));
    }
}

/* Bluetooth Mesh Initialization */
static esp_err_t ble_mesh_init(void)
{
    esp_err_t err;
    
    esp_ble_mesh_register_prov_callback(provisioning_cb);
    esp_ble_mesh_register_config_server_callback(config_server_cb);
    esp_ble_mesh_register_generic_server_callback(generic_server_cb);
    
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
    
    ESP_LOGI(TAG, "BLE Mesh Node initialized");
    
    return ESP_OK;
}

void app_main(void)
{
    esp_err_t err;
    
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
    
    // Initialize NVS
    err = nvs_flash_init();
    if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        err = nvs_flash_init();
    }
    ESP_ERROR_CHECK(err);
    
    // Initialize GPIO
    led_init();
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
    
    // Create application task
    xTaskCreate(app_task, "app_task", 4096, NULL, 5, NULL);
    
    ESP_LOGI(TAG, "Endpoint Node ready");
}