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
static void publish_button_press(uint16_t src_addr);

/* GPIO Configuration - Adafruit ESP32-C6 Feather */
#define NEOPIXEL_GPIO       GPIO_NUM_9   // NeoPixel LED
#define NEOPIXEL_POWER_GPIO GPIO_NUM_20  // NeoPixel power control
#define NEOPIXEL_COUNT      1
#define BUTTON_GPIO         GPIO_NUM_5   // Factory Reset button (GPIO5)
#define BUTTON_ACTIVE_LEVEL 0            // Active LOW

/* Factory Reset Configuration */
#define FACTORY_RESET_HOLD_TIME_MS  10000  // Hold button for 10 seconds to factory reset
#define FACTORY_RESET_WARNING_TIME_MS 3000  // Warning at 3 seconds
#define FACTORY_RESET_CRITICAL_TIME_MS 7000 // Critical warning at 7 seconds

/* WiFi AP Configuration */
#define WIFI_AP_SSID "Smart-Storage-Gateway"
#define WIFI_AP_PASS "12345678"
#define WIFI_AP_CHANNEL 6
#define WIFI_AP_MAX_CONN 4

/* WiFi STA Configuration */
#define WIFI_STA_MAX_RETRY 5
#define MAX_SCAN_RESULTS 20

/* NVS Storage Keys for WiFi */
#define NVS_NAMESPACE "wifi_config"
#define NVS_KEY_SSID "ssid"
#define NVS_KEY_PASSWORD "password"
#define NVS_KEY_CONNECTED "connected"

/* MQTT Configuration */
#define MQTT_BROKER_URL "mqtt://172.20.10.3:1883"
#define MQTT_TOPIC_STATUS "smart-storage/status"
#define MQTT_TOPIC_COMMAND "smart-storage/command"
#define MQTT_TOPIC_BUTTON "smart-storage/button"

/* Bluetooth Mesh Configuration */
#define CID_ESP        0x02E5

/* WiFi scan result storage */
typedef struct {
    char ssid[33];
    int8_t rssi;
    wifi_auth_mode_t authmode;
} wifi_scan_result_t;

/* Global Variables */
static esp_mqtt_client_handle_t mqtt_client;
static httpd_handle_t server = NULL;
static led_strip_handle_t led_strip = NULL;
static uint8_t client_count = 0;
static bool wifi_connected = false;
static bool wifi_ap_mode = false;
static bool sta_connected = false;
static bool ap_active = true;
static int sta_retry_count = 0;
static wifi_scan_result_t scan_results[MAX_SCAN_RESULTS];
static uint16_t scan_result_count = 0;
static bool scan_in_progress = false;

/* BLE Mesh Variables */
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

/* WiFi NVS Storage Functions */
static esp_err_t wifi_save_credentials(const char *ssid, const char *password)
{
    nvs_handle_t nvs_handle;
    esp_err_t err;

    err = nvs_open(NVS_NAMESPACE, NVS_READWRITE, &nvs_handle);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to open NVS namespace: %s", esp_err_to_name(err));
        return err;
    }

    // Save SSID
    err = nvs_set_str(nvs_handle, NVS_KEY_SSID, ssid);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to save SSID: %s", esp_err_to_name(err));
        nvs_close(nvs_handle);
        return err;
    }

    // Save password
    err = nvs_set_str(nvs_handle, NVS_KEY_PASSWORD, password);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to save password: %s", esp_err_to_name(err));
        nvs_close(nvs_handle);
        return err;
    }

    // Mark as connected
    err = nvs_set_u8(nvs_handle, NVS_KEY_CONNECTED, 1);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to save connected flag: %s", esp_err_to_name(err));
        nvs_close(nvs_handle);
        return err;
    }

    // Commit changes
    err = nvs_commit(nvs_handle);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to commit NVS: %s", esp_err_to_name(err));
    } else {
        ESP_LOGI(TAG, "💾 WiFi credentials saved to NVS");
        ESP_LOGI(TAG, "   SSID: %s", ssid);
    }

    nvs_close(nvs_handle);
    return err;
}

static esp_err_t wifi_load_credentials(char *ssid, size_t ssid_len, char *password, size_t pass_len)
{
    nvs_handle_t nvs_handle;
    esp_err_t err;

    err = nvs_open(NVS_NAMESPACE, NVS_READONLY, &nvs_handle);
    if (err != ESP_OK) {
        ESP_LOGW(TAG, "No saved WiFi credentials found");
        return err;
    }

    // Check if connected flag is set
    uint8_t connected = 0;
    err = nvs_get_u8(nvs_handle, NVS_KEY_CONNECTED, &connected);
    if (err != ESP_OK || connected == 0) {
        ESP_LOGW(TAG, "No WiFi connection saved");
        nvs_close(nvs_handle);
        return ESP_ERR_NOT_FOUND;
    }

    // Load SSID
    err = nvs_get_str(nvs_handle, NVS_KEY_SSID, ssid, &ssid_len);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to load SSID: %s", esp_err_to_name(err));
        nvs_close(nvs_handle);
        return err;
    }

    // Load password
    err = nvs_get_str(nvs_handle, NVS_KEY_PASSWORD, password, &pass_len);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to load password: %s", esp_err_to_name(err));
        nvs_close(nvs_handle);
        return err;
    }

    ESP_LOGI(TAG, "📂 Loaded WiFi credentials from NVS");
    ESP_LOGI(TAG, "   SSID: %s", ssid);

    nvs_close(nvs_handle);
    return ESP_OK;
}

static esp_err_t wifi_clear_credentials(void)
{
    nvs_handle_t nvs_handle;
    esp_err_t err;

    err = nvs_open(NVS_NAMESPACE, NVS_READWRITE, &nvs_handle);
    if (err != ESP_OK) {
        return err;
    }

    nvs_erase_key(nvs_handle, NVS_KEY_SSID);
    nvs_erase_key(nvs_handle, NVS_KEY_PASSWORD);
    nvs_erase_key(nvs_handle, NVS_KEY_CONNECTED);

    err = nvs_commit(nvs_handle);
    nvs_close(nvs_handle);

    ESP_LOGI(TAG, "🗑️  WiFi credentials cleared from NVS");
    return err;
}

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

    ESP_LOGI(TAG, "✅ NeoPixel initialized");
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

/* WiFi Scan Functions */
static void wifi_scan_done_handler(void)
{
    uint16_t ap_count = 0;
    esp_wifi_scan_get_ap_num(&ap_count);

    if (ap_count == 0) {
        ESP_LOGW(TAG, "No WiFi networks found");
        scan_result_count = 0;
        scan_in_progress = false;
        return;
    }

    wifi_ap_record_t ap_records[MAX_SCAN_RESULTS];
    uint16_t max_aps = MAX_SCAN_RESULTS;

    esp_wifi_scan_get_ap_records(&max_aps, ap_records);
    scan_result_count = max_aps;

    ESP_LOGI(TAG, "📡 Found %d WiFi networks:", scan_result_count);

    for (int i = 0; i < scan_result_count; i++) {
        strncpy(scan_results[i].ssid, (char *)ap_records[i].ssid, sizeof(scan_results[i].ssid) - 1);
        scan_results[i].ssid[sizeof(scan_results[i].ssid) - 1] = '\0';
        scan_results[i].rssi = ap_records[i].rssi;
        scan_results[i].authmode = ap_records[i].authmode;

        ESP_LOGI(TAG, "  %d. %s (RSSI: %d, Auth: %d)",
                 i + 1, scan_results[i].ssid, scan_results[i].rssi, scan_results[i].authmode);
    }

    scan_in_progress = false;
}

static esp_err_t wifi_scan_start(void)
{
    if (scan_in_progress) {
        ESP_LOGW(TAG, "Scan already in progress");
        return ESP_ERR_INVALID_STATE;
    }

    // Check current WiFi mode
    wifi_mode_t current_mode;
    esp_wifi_get_mode(&current_mode);

    // Need to be in APSTA mode to scan
    if (current_mode == WIFI_MODE_AP) {
        ESP_LOGI(TAG, "Switching to APSTA mode for scanning...");
        esp_err_t err = esp_wifi_set_mode(WIFI_MODE_APSTA);
        if (err != ESP_OK) {
            ESP_LOGE(TAG, "Failed to switch to APSTA mode: %s", esp_err_to_name(err));
            return err;
        }
        vTaskDelay(pdMS_TO_TICKS(100));  // Wait for mode switch
    }

    scan_in_progress = true;
    scan_result_count = 0;

    wifi_scan_config_t scan_config = {
        .ssid = NULL,
        .bssid = NULL,
        .channel = 0,
        .show_hidden = false,
        .scan_type = WIFI_SCAN_TYPE_ACTIVE,
        .scan_time.active.min = 100,
        .scan_time.active.max = 300,
    };

    ESP_LOGI(TAG, "🔍 Starting WiFi scan...");
    esp_err_t err = esp_wifi_scan_start(&scan_config, false);

    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to start WiFi scan: %s", esp_err_to_name(err));
        scan_in_progress = false;
        return err;
    }

    return ESP_OK;
}

/* LED Control Task */
static void led_control_task(void *pvParameters)
{
    bool blink_state = false;
    uint8_t color_toggle = 0;  // 0 = GREEN, 1 = BLUE

    while (1) {
        if (sta_connected) {
            // Connected to external WiFi - Solid GREEN
            neopixel_set_color(0, 255, 0);  // Green
        } else if (client_count > 0) {
            // Client connected to AP - Solid BLUE
            neopixel_set_color(0, 0, 255);  // Blue
        } else {
            // No clients - Alternating GREEN and BLUE (AP mode active)
            if (blink_state) {
                if (color_toggle == 0) {
                    neopixel_set_color(0, 255, 0);  // Green
                    color_toggle = 1;
                } else {
                    neopixel_set_color(0, 0, 255);  // Blue
                    color_toggle = 0;
                }
            }
            blink_state = !blink_state;
        }

        vTaskDelay(pdMS_TO_TICKS(500));  // Blink every 500ms
    }
}

// Embedded HTML page (split into parts due to size)
static const char index_html_part1[] =
"<!DOCTYPE html>"
"<html>"
"<head>"
"<meta charset='UTF-8'>"
"<meta name='viewport' content='width=device-width, initial-scale=1.0'>"
"<title>Smart Storage Gateway</title>"
"<style>"
"body { font-family: Arial, sans-serif; margin: 20px; background: #f0f0f0; }"
"h1, h2 { color: #333; }"
".container { background: white; padding: 20px; border-radius: 10px; max-width: 600px; margin: 0 auto; }"
".status { padding: 10px; color: white; border-radius: 5px; margin: 10px 0; }"
".status.ok { background: #4CAF50; }"
".status.warn { background: #FF9800; }"
".status.error { background: #f44336; }"
".info { background: #f9f9f9; padding: 10px; border-left: 4px solid #2196F3; margin: 10px 0; }"
".btn { padding: 10px 20px; background: #2196F3; color: white; border: none; border-radius: 5px; cursor: pointer; margin: 5px; }"
".btn:hover { background: #0b7dda; }"
".btn:disabled { background: #ccc; cursor: not-allowed; }"
".network-list { list-style: none; padding: 0; }"
".network-item { padding: 10px; margin: 5px 0; background: #f9f9f9; border-radius: 5px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; }"
".network-item:hover { background: #e3f2fd; }"
".network-item.selected { background: #bbdefb; border: 2px solid #2196F3; }"
".network-name { font-weight: bold; }"
".network-rssi { color: #666; font-size: 0.9em; }"
".network-lock { color: #f44336; }"
"input[type='password'] { width: 100%; padding: 8px; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }"
"#password-section { display: none; margin-top: 10px; }"
"</style>"
"</head>"
"<body>"
"<div class='container'>"
"<h1>🎉 Smart Storage Gateway</h1>";

static const char index_html_part2[] =
"<div id='ap-status' class='status ok'>✅ AP Mode Active</div>"
"<div class='info'>"
"<p><strong>AP SSID:</strong> Smart-Storage-Gateway</p>"
"<p><strong>AP IP:</strong> 192.168.4.1</p>"
"<p><strong>Connected Clients:</strong> <span id='clients'>0</span></p>"
"</div>"
"<div class='info'>"
"<p><strong>WiFi Status:</strong> <span id='wifi-status'>Not Connected</span></p>"
"<p><strong>WiFi IP:</strong> <span id='wifi-ip'>-</span></p>"
"</div>"
"<div class='info'>"
"<p><strong>BLE Mesh:</strong> <span id='mesh-status'>Not Provisioned</span></p>"
"<p><strong>Node Address:</strong> <span id='node-addr'>-</span></p>"
"<p><strong>Network Key:</strong> <span id='net-key' style='font-family: monospace; font-size: 0.85em;'>-</span></p>"
"<p><strong>Network Index:</strong> <span id='net-idx'>-</span></p>"
"<p><strong>App Key:</strong> <span id='app-key' style='font-family: monospace; font-size: 0.85em;'>-</span></p>"
"<p><strong>App Index:</strong> <span id='app-idx'>-</span></p>"
"<p><strong>MQTT:</strong> <span id='mqtt-status'>Disconnected</span></p>"
"</div>"
"<div class='info' id='model-info' style='display:none;'>"
"<h3 style='margin: 10px 0 5px 0; color: #4CAF50;'>📋 Generic OnOff Client</h3>"
"<p style='margin: 3px 0; font-size: 0.9em;'><strong>Bound:</strong> <span id='cli-bound'>-</span></p>"
"<p style='margin: 3px 0; font-size: 0.9em;'><strong>App Index:</strong> <span id='cli-app-idx'>-</span></p>"
"<p style='margin: 3px 0; font-size: 0.9em;'><strong>Publication:</strong> <span id='cli-pub'>-</span></p>"
"<p style='margin: 3px 0; font-size: 0.9em;'><strong>Subscriptions:</strong> <span id='cli-sub'>-</span></p>"
"<h3 style='margin: 10px 0 5px 0; color: #2196F3;'>📋 Generic OnOff Server</h3>"
"<p style='margin: 3px 0; font-size: 0.9em;'><strong>Bound:</strong> <span id='srv-bound'>-</span></p>"
"<p style='margin: 3px 0; font-size: 0.9em;'><strong>App Index:</strong> <span id='srv-app-idx'>-</span></p>"
"<p style='margin: 3px 0; font-size: 0.9em;'><strong>Publication:</strong> <span id='srv-pub'>-</span></p>"
"<p style='margin: 3px 0; font-size: 0.9em;'><strong>Subscriptions:</strong> <span id='srv-sub'>-</span></p>"
"</div>"
"<div style='margin: 10px 0; display: flex; gap: 10px;'>"
"<button class='btn' onclick='clearProvision()' style='background: #ff4444; flex: 1;'>🗑️ Clear Provision</button>"
"<button class='btn' onclick='clearWiFi()' style='background: #ff8800; flex: 1;'>📡 Clear WiFi</button>"
"</div>"
"<h2>📡 WiFi Networks</h2>"
"<button class='btn' onclick='scanWiFi()' id='scan-btn'>Scan WiFi</button>"
"<div id='scan-status'></div>"
"<ul class='network-list' id='network-list'></ul>"
"<div id='password-section'>"
"<h3>Connect to: <span id='selected-ssid'></span></h3>"
"<input type='password' id='wifi-password' placeholder='Enter WiFi password (leave empty for open networks)'>"
"<button class='btn' onclick='connectWiFi()'>Connect</button>"
"<button class='btn' onclick='cancelConnect()' style='background: #999;'>Cancel</button>"
"</div>"
"</div>";

static const char index_html_part3[] =
"<script>"
"let selectedSSID = null;"
"let selectedAuth = null;"
"function updateStatus() {"
"  fetch('/api/status')"
"    .then(r => r.json())"
"    .then(data => {"
"      document.getElementById('clients').textContent = data.clients;"
"      const wifiStatus = document.getElementById('wifi-status');"
"      const wifiIP = document.getElementById('wifi-ip');"
"      const apStatus = document.getElementById('ap-status');"
"      const meshStatus = document.getElementById('mesh-status');"
"      const nodeAddr = document.getElementById('node-addr');"
"      const netKey = document.getElementById('net-key');"
"      const netIdx = document.getElementById('net-idx');"
"      const appKey = document.getElementById('app-key');"
"      const appIdx = document.getElementById('app-idx');"
"      const mqttStatus = document.getElementById('mqtt-status');"
"      if (data.sta_connected) {"
"        wifiStatus.textContent = '✅ Connected';"
"        wifiIP.textContent = data.sta_ip || '-';"
"        if (!data.ap_active) {"
"          apStatus.className = 'status warn';"
"          apStatus.textContent = '🛑 AP Mode Disabled (Connected to WiFi)';"
"        }"
"      } else {"
"        wifiStatus.textContent = '❌ Not Connected';"
"        wifiIP.textContent = '-';"
"      }"
"      if (data.provisioned) {"
"        meshStatus.textContent = '✅ Provisioned';"
"        nodeAddr.textContent = '0x' + data.node_addr.toString(16).toUpperCase().padStart(4, '0');"
"        netKey.textContent = data.net_key || '-';"
"        netIdx.textContent = '0x' + data.net_idx.toString(16).toUpperCase().padStart(4, '0');"
"        appKey.textContent = data.app_key || '-';"
"        appIdx.textContent = '0x' + data.app_idx.toString(16).toUpperCase().padStart(4, '0');"
"        document.getElementById('model-info').style.display = 'block';"
"        document.getElementById('cli-bound').textContent = data.cli_bound ? '✅ YES' : '❌ NO';"
"        document.getElementById('cli-app-idx').textContent = data.cli_bound ? '0x' + data.cli_app_idx.toString(16).toUpperCase().padStart(4, '0') : '-';"
"        document.getElementById('cli-pub').textContent = data.cli_pub || '-';"
"        document.getElementById('cli-sub').textContent = data.cli_sub || '-';"
"        document.getElementById('srv-bound').textContent = data.srv_bound ? '✅ YES' : '❌ NO';"
"        document.getElementById('srv-app-idx').textContent = data.srv_bound ? '0x' + data.srv_app_idx.toString(16).toUpperCase().padStart(4, '0') : '-';"
"        document.getElementById('srv-pub').textContent = data.srv_pub || '-';"
"        document.getElementById('srv-sub').textContent = data.srv_sub || '-';"
"      } else {"
"        meshStatus.textContent = '❌ Not Provisioned';"
"        nodeAddr.textContent = '-';"
"        netKey.textContent = '-';"
"        netIdx.textContent = '-';"
"        appKey.textContent = '-';"
"        appIdx.textContent = '-';"
"        document.getElementById('model-info').style.display = 'none';"
"      }"
"      mqttStatus.textContent = data.mqtt_connected ? '✅ Connected' : '❌ Disconnected';"
"    });"
"}"
"function clearProvision() {"
"  if (!confirm('⚠️ Clear BLE Mesh provisioning data?\\n\\nThis will:\\n- Remove BLE Mesh provisioning\\n- Restart the device\\n\\n(WiFi credentials will NOT be cleared)\\n\\nContinue?')) return;"
"  fetch('/api/clear_provision', {method: 'POST'})"
"    .then(r => r.json())"
"    .then(data => {"
"      alert('✅ ' + data.message + '\\n\\nDevice will restart in 2 seconds...');"
"    })"
"    .catch(e => alert('❌ Error: ' + e));"
"}"
"function clearWiFi() {"
"  if (!confirm('⚠️ Clear WiFi credentials?\\n\\nThis will:\\n- Remove saved WiFi credentials\\n- Restart the device\\n- Device will start in AP mode\\n\\n(BLE Mesh provisioning will NOT be cleared)\\n\\nContinue?')) return;"
"  fetch('/api/clear_wifi', {method: 'POST'})"
"    .then(r => r.json())"
"    .then(data => {"
"      alert('✅ ' + data.message + '\\n\\nDevice will restart in 2 seconds...');"
"    })"
"    .catch(e => alert('❌ Error: ' + e));"
"}"
"function scanWiFi() {"
"  document.getElementById('scan-btn').disabled = true;"
"  document.getElementById('scan-status').innerHTML = '<div class=\"status warn\">🔍 Scanning...</div>';"
"  document.getElementById('network-list').innerHTML = '';"
"  fetch('/api/scan')"
"    .then(() => {"
"      setTimeout(checkScanResults, 2000);"
"    });"
"}"
"function checkScanResults() {"
"  fetch('/api/scan_results')"
"    .then(r => r.json())"
"    .then(data => {"
"      if (data.status === 'scanning') {"
"        setTimeout(checkScanResults, 1000);"
"        return;"
"      }"
"      document.getElementById('scan-btn').disabled = false;"
"      document.getElementById('scan-status').innerHTML = '<div class=\"status ok\">✅ Scan Complete</div>';"
"      const list = document.getElementById('network-list');"
"      list.innerHTML = '';"
"      data.networks.forEach(net => {"
"        const li = document.createElement('li');"
"        li.className = 'network-item';"
"        li.onclick = () => selectNetwork(net.ssid, net.auth);"
"        li.innerHTML = '<div><span class=\"network-name\">' + net.ssid + '</span> ' + (net.auth !== 'OPEN' ? '<span class=\"network-lock\">🔒</span>' : '') + '</div><div class=\"network-rssi\">' + net.rssi + ' dBm</div>';"
"        list.appendChild(li);"
"      });"
"    });"
"}"
"function selectNetwork(ssid, auth) {"
"  selectedSSID = ssid;"
"  selectedAuth = auth;"
"  document.querySelectorAll('.network-item').forEach(item => item.classList.remove('selected'));"
"  event.currentTarget.classList.add('selected');"
"  document.getElementById('selected-ssid').textContent = ssid;"
"  document.getElementById('password-section').style.display = 'block';"
"  document.getElementById('wifi-password').value = '';"
"  if (auth === 'OPEN') {"
"    document.getElementById('wifi-password').placeholder = 'No password required (open network)';"
"  } else {"
"    document.getElementById('wifi-password').placeholder = 'Enter WiFi password';"
"  }"
"}"
"function cancelConnect() {"
"  document.getElementById('password-section').style.display = 'none';"
"  selectedSSID = null;"
"  selectedAuth = null;"
"  document.querySelectorAll('.network-item').forEach(item => item.classList.remove('selected'));"
"}"
"function connectWiFi() {"
"  if (!selectedSSID) return;"
"  const password = document.getElementById('wifi-password').value;"
"  fetch('/api/connect', {"
"    method: 'POST',"
"    headers: {'Content-Type': 'application/json'},"
"    body: JSON.stringify({ssid: selectedSSID, password: password})"
"  })"
"  .then(r => r.json())"
"  .then(data => {"
"    alert('Connecting to ' + selectedSSID + '... Please wait.');"
"    document.getElementById('password-section').style.display = 'none';"
"    setTimeout(updateStatus, 3000);"
"  });"
"}"
"setInterval(updateStatus, 2000);"
"updateStatus();"
"</script>"
"</body>"
"</html>";

// HTTP GET handler for root
static esp_err_t root_handler(httpd_req_t *req)
{
    httpd_resp_set_type(req, "text/html");
    httpd_resp_send_chunk(req, index_html_part1, strlen(index_html_part1));
    httpd_resp_send_chunk(req, index_html_part2, strlen(index_html_part2));
    httpd_resp_send_chunk(req, index_html_part3, strlen(index_html_part3));
    httpd_resp_send_chunk(req, NULL, 0);  // End of chunks
    return ESP_OK;
}

// HTTP GET handler for status API
static esp_err_t status_handler(httpd_req_t *req)
{
    char response[2048];
    esp_netif_ip_info_t ip_info;
    char sta_ip_str[16] = "-";

    // Get STA IP if connected
    if (sta_connected) {
        esp_netif_t *sta_netif = esp_netif_get_handle_from_ifkey("WIFI_STA_DEF");
        if (sta_netif && esp_netif_get_ip_info(sta_netif, &ip_info) == ESP_OK) {
            snprintf(sta_ip_str, sizeof(sta_ip_str), IPSTR, IP2STR(&ip_info.ip));
        }
    }

    // Check MQTT connection status
    bool mqtt_connected_status = (mqtt_client != NULL && wifi_connected);

    // Load mesh provisioning data from NVS
    char net_key_str[64] = "-";
    char app_key_str[64] = "-";
    uint16_t net_idx = 0;
    uint16_t app_idx = 0;

    // Model binding and subscription data
    bool cli_bound = false;
    uint16_t cli_app_idx = 0;
    char cli_pub_addr[16] = "-";
    char cli_sub_addrs[128] = "-";

    bool srv_bound = false;
    uint16_t srv_app_idx = 0;
    char srv_pub_addr[16] = "-";
    char srv_sub_addrs[128] = "-";

    if (provisioned) {
        mesh_prov_data_t prov_data;
        if (mesh_storage_load_prov_data(&prov_data) == ESP_OK) {
            // Format NetKey as hex string (first 8 bytes for display)
            snprintf(net_key_str, sizeof(net_key_str),
                     "%02X%02X%02X%02X%02X%02X%02X%02X...",
                     prov_data.net_key[0], prov_data.net_key[1],
                     prov_data.net_key[2], prov_data.net_key[3],
                     prov_data.net_key[4], prov_data.net_key[5],
                     prov_data.net_key[6], prov_data.net_key[7]);

            // Check if AppKey is all zeros (not yet configured)
            bool app_key_valid = false;
            for (int i = 0; i < 16; i++) {
                if (prov_data.app_key[i] != 0) {
                    app_key_valid = true;
                    break;
                }
            }

            // Format AppKey as hex string (first 8 bytes for display) only if valid
            if (app_key_valid) {
                snprintf(app_key_str, sizeof(app_key_str),
                         "%02X%02X%02X%02X%02X%02X%02X%02X...",
                         prov_data.app_key[0], prov_data.app_key[1],
                         prov_data.app_key[2], prov_data.app_key[3],
                         prov_data.app_key[4], prov_data.app_key[5],
                         prov_data.app_key[6], prov_data.app_key[7]);
            }

            net_idx = prov_data.net_idx;
            app_idx = prov_data.app_idx;
        }

        // Load Generic OnOff Client binding and subscription
        mesh_model_binding_t cli_binding;
        if (mesh_storage_load_model_binding("onoff_cli", &cli_binding) == ESP_OK) {
            cli_bound = true;
            cli_app_idx = cli_binding.app_idx;
        }

        mesh_pub_settings_t cli_pub;
        if (mesh_storage_load_pub_settings("onoff_cli", &cli_pub) == ESP_OK) {
            snprintf(cli_pub_addr, sizeof(cli_pub_addr), "0x%04X", cli_pub.publish_addr);
        }

        mesh_subscription_t cli_sub;
        if (mesh_storage_load_subscription("onoff_cli", &cli_sub) == ESP_OK) {
            char temp[128] = "";
            for (int i = 0; i < cli_sub.sub_count; i++) {
                char addr[16];
                snprintf(addr, sizeof(addr), "%s0x%04X", i > 0 ? "," : "", cli_sub.sub_addrs[i]);
                strncat(temp, addr, sizeof(temp) - strlen(temp) - 1);
            }
            strncpy(cli_sub_addrs, temp, sizeof(cli_sub_addrs) - 1);
        }

        // Load Generic OnOff Server binding and subscription
        mesh_model_binding_t srv_binding;
        if (mesh_storage_load_model_binding("onoff_srv", &srv_binding) == ESP_OK) {
            srv_bound = true;
            srv_app_idx = srv_binding.app_idx;
        }

        mesh_pub_settings_t srv_pub;
        if (mesh_storage_load_pub_settings("onoff_srv", &srv_pub) == ESP_OK) {
            snprintf(srv_pub_addr, sizeof(srv_pub_addr), "0x%04X", srv_pub.publish_addr);
        }

        mesh_subscription_t srv_sub;
        if (mesh_storage_load_subscription("onoff_srv", &srv_sub) == ESP_OK) {
            char temp[128] = "";
            for (int i = 0; i < srv_sub.sub_count; i++) {
                char addr[16];
                snprintf(addr, sizeof(addr), "%s0x%04X", i > 0 ? "," : "", srv_sub.sub_addrs[i]);
                strncat(temp, addr, sizeof(temp) - strlen(temp) - 1);
            }
            strncpy(srv_sub_addrs, temp, sizeof(srv_sub_addrs) - 1);
        }
    }

    snprintf(response, sizeof(response),
             "{\"clients\":%d,\"sta_connected\":%s,\"sta_ip\":\"%s\",\"ap_active\":%s,"
             "\"provisioned\":%s,\"node_addr\":%d,\"mqtt_connected\":%s,"
             "\"net_idx\":%d,\"app_idx\":%d,\"net_key\":\"%s\",\"app_key\":\"%s\","
             "\"cli_bound\":%s,\"cli_app_idx\":%d,\"cli_pub\":\"%s\",\"cli_sub\":\"%s\","
             "\"srv_bound\":%s,\"srv_app_idx\":%d,\"srv_pub\":\"%s\",\"srv_sub\":\"%s\"}",
             client_count,
             sta_connected ? "true" : "false",
             sta_ip_str,
             ap_active ? "true" : "false",
             provisioned ? "true" : "false",
             node_addr,
             mqtt_connected_status ? "true" : "false",
             net_idx,
             app_idx,
             net_key_str,
             app_key_str,
             cli_bound ? "true" : "false",
             cli_app_idx,
             cli_pub_addr,
             cli_sub_addrs,
             srv_bound ? "true" : "false",
             srv_app_idx,
             srv_pub_addr,
             srv_sub_addrs);

    httpd_resp_set_type(req, "application/json");
    httpd_resp_send(req, response, strlen(response));
    return ESP_OK;
}

// HTTP POST handler for clear provision (BLE Mesh only)
static esp_err_t clear_provision_handler(httpd_req_t *req)
{
    ESP_LOGW(TAG, "🔴 Clear BLE Mesh provision requested via Web UI");

    // Clear custom mesh storage
    esp_err_t err = mesh_storage_clear();
    if (err == ESP_OK) {
        ESP_LOGI(TAG, "✓ Custom mesh storage cleared");
    } else {
        ESP_LOGE(TAG, "✗ Failed to clear custom mesh storage: %s", esp_err_to_name(err));
    }

    // Reset BLE Mesh stack (this clears ESP-IDF internal BLE Mesh NVS)
    ESP_LOGW(TAG, "Resetting BLE Mesh stack...");
    err = esp_ble_mesh_node_local_reset();
    if (err == ESP_OK) {
        ESP_LOGI(TAG, "✓ BLE Mesh stack reset successfully");
    } else {
        ESP_LOGE(TAG, "✗ Failed to reset BLE Mesh stack: %s", esp_err_to_name(err));
    }

    const char *response = "{\"status\":\"ok\",\"message\":\"BLE Mesh provisioning cleared\"}";
    httpd_resp_set_type(req, "application/json");
    httpd_resp_send(req, response, strlen(response));

    // Restart after 2 seconds
    ESP_LOGW(TAG, "Restarting device in 2 seconds...");
    vTaskDelay(pdMS_TO_TICKS(2000));
    esp_restart();

    return ESP_OK;
}

// HTTP POST handler for clear WiFi credentials
static esp_err_t clear_wifi_handler(httpd_req_t *req)
{
    ESP_LOGW(TAG, "🔴 Clear WiFi credentials requested via Web UI");

    // Clear WiFi credentials only
    esp_err_t err = wifi_clear_credentials();
    if (err == ESP_OK) {
        ESP_LOGI(TAG, "✓ WiFi credentials cleared");
    } else {
        ESP_LOGE(TAG, "✗ Failed to clear WiFi credentials: %s", esp_err_to_name(err));
    }

    const char *response = "{\"status\":\"ok\",\"message\":\"WiFi credentials cleared\"}";
    httpd_resp_set_type(req, "application/json");
    httpd_resp_send(req, response, strlen(response));

    // Restart after 2 seconds
    ESP_LOGW(TAG, "Restarting device in 2 seconds...");
    vTaskDelay(pdMS_TO_TICKS(2000));
    esp_restart();

    return ESP_OK;
}

// HTTP GET handler for WiFi scan
static esp_err_t scan_handler(httpd_req_t *req)
{
    // Start scan
    esp_err_t err = wifi_scan_start();

    if (err != ESP_OK) {
        httpd_resp_set_status(req, "500 Internal Server Error");
        httpd_resp_send(req, "{\"error\":\"Failed to start scan\"}", -1);
        return ESP_FAIL;
    }

    httpd_resp_set_type(req, "application/json");
    httpd_resp_send(req, "{\"status\":\"scanning\"}", -1);
    return ESP_OK;
}

// HTTP GET handler for scan results
static esp_err_t scan_results_handler(httpd_req_t *req)
{
    if (scan_in_progress) {
        httpd_resp_set_type(req, "application/json");
        httpd_resp_send(req, "{\"status\":\"scanning\",\"networks\":[]}", -1);
        return ESP_OK;
    }

    // Build JSON response with scan results
    char *response = malloc(4096);
    if (!response) {
        httpd_resp_set_status(req, "500 Internal Server Error");
        httpd_resp_send(req, "{\"error\":\"Out of memory\"}", -1);
        return ESP_FAIL;
    }

    int offset = snprintf(response, 4096, "{\"status\":\"done\",\"networks\":[");

    for (int i = 0; i < scan_result_count && offset < 4000; i++) {
        const char *auth_str = "OPEN";
        if (scan_results[i].authmode != WIFI_AUTH_OPEN) {
            auth_str = "SECURED";
        }

        offset += snprintf(response + offset, 4096 - offset,
                          "%s{\"ssid\":\"%s\",\"rssi\":%d,\"auth\":\"%s\"}",
                          i > 0 ? "," : "",
                          scan_results[i].ssid,
                          scan_results[i].rssi,
                          auth_str);
    }

    snprintf(response + offset, 4096 - offset, "]}");

    httpd_resp_set_type(req, "application/json");
    httpd_resp_send(req, response, -1);
    free(response);
    return ESP_OK;
}

// HTTP POST handler for WiFi connect
static esp_err_t connect_handler(httpd_req_t *req)
{
    char content[256];
    int ret = httpd_req_recv(req, content, sizeof(content) - 1);

    if (ret <= 0) {
        httpd_resp_set_status(req, "400 Bad Request");
        httpd_resp_send(req, "{\"error\":\"Invalid request\"}", -1);
        return ESP_FAIL;
    }

    content[ret] = '\0';

    // Parse JSON (simple parsing for SSID and password)
    char ssid[33] = {0};
    char password[64] = {0};

    // Extract SSID
    char *ssid_start = strstr(content, "\"ssid\":\"");
    if (ssid_start) {
        ssid_start += 8;
        char *ssid_end = strchr(ssid_start, '"');
        if (ssid_end) {
            int len = ssid_end - ssid_start;
            if (len > 0 && len < sizeof(ssid)) {
                strncpy(ssid, ssid_start, len);
            }
        }
    }

    // Extract password
    char *pass_start = strstr(content, "\"password\":\"");
    if (pass_start) {
        pass_start += 12;
        char *pass_end = strchr(pass_start, '"');
        if (pass_end) {
            int len = pass_end - pass_start;
            if (len > 0 && len < sizeof(password)) {
                strncpy(password, pass_start, len);
            }
        }
    }

    if (strlen(ssid) == 0) {
        httpd_resp_set_status(req, "400 Bad Request");
        httpd_resp_send(req, "{\"error\":\"SSID required\"}", -1);
        return ESP_FAIL;
    }

    ESP_LOGI(TAG, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    ESP_LOGI(TAG, "  🔌 Connecting to WiFi...");
    ESP_LOGI(TAG, "  📡 SSID: %s", ssid);
    ESP_LOGI(TAG, "  🔒 Security: %s", strlen(password) > 0 ? "WPA2-PSK" : "Open");
    ESP_LOGI(TAG, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // Configure STA with new credentials
    wifi_config_t sta_config = {0};
    strncpy((char *)sta_config.sta.ssid, ssid, sizeof(sta_config.sta.ssid) - 1);
    strncpy((char *)sta_config.sta.password, password, sizeof(sta_config.sta.password) - 1);
    sta_config.sta.threshold.authmode = strlen(password) > 0 ? WIFI_AUTH_WPA2_PSK : WIFI_AUTH_OPEN;
    sta_config.sta.pmf_cfg.capable = true;
    sta_config.sta.pmf_cfg.required = false;

    // Switch to APSTA mode if not already
    wifi_mode_t current_mode;
    esp_wifi_get_mode(&current_mode);

    if (current_mode == WIFI_MODE_AP) {
        ESP_LOGI(TAG, "Switching to APSTA mode...");
        esp_err_t err = esp_wifi_set_mode(WIFI_MODE_APSTA);
        if (err != ESP_OK) {
            ESP_LOGE(TAG, "Failed to switch to APSTA mode: %s", esp_err_to_name(err));
            httpd_resp_set_status(req, "500 Internal Server Error");
            httpd_resp_send(req, "{\"error\":\"Failed to switch WiFi mode\"}", -1);
            return ESP_FAIL;
        }
        vTaskDelay(pdMS_TO_TICKS(100));  // Wait for mode switch
    }

    esp_wifi_set_config(WIFI_IF_STA, &sta_config);
    sta_retry_count = 0;

    esp_err_t err = esp_wifi_connect();
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to start WiFi connection: %s", esp_err_to_name(err));
        httpd_resp_set_status(req, "500 Internal Server Error");
        httpd_resp_send(req, "{\"error\":\"Failed to connect\"}", -1);
        return ESP_FAIL;
    }

    // Save credentials to NVS (will be marked as connected when IP is obtained)
    // For now, just save the credentials
    wifi_save_credentials(ssid, password);

    httpd_resp_set_type(req, "application/json");
    httpd_resp_send(req, "{\"status\":\"connecting\"}", -1);
    return ESP_OK;
}

static const httpd_uri_t uri_root = {
    .uri       = "/",
    .method    = HTTP_GET,
    .handler   = root_handler,
    .user_ctx  = NULL
};

static const httpd_uri_t uri_status = {
    .uri       = "/api/status",
    .method    = HTTP_GET,
    .handler   = status_handler,
    .user_ctx  = NULL
};

static const httpd_uri_t uri_scan = {
    .uri       = "/api/scan",
    .method    = HTTP_GET,
    .handler   = scan_handler,
    .user_ctx  = NULL
};

static const httpd_uri_t uri_scan_results = {
    .uri       = "/api/scan_results",
    .method    = HTTP_GET,
    .handler   = scan_results_handler,
    .user_ctx  = NULL
};

static const httpd_uri_t uri_connect = {
    .uri       = "/api/connect",
    .method    = HTTP_POST,
    .handler   = connect_handler,
    .user_ctx  = NULL
};

static const httpd_uri_t uri_clear_provision = {
    .uri       = "/api/clear_provision",
    .method    = HTTP_POST,
    .handler   = clear_provision_handler,
    .user_ctx  = NULL
};

static const httpd_uri_t uri_clear_wifi = {
    .uri       = "/api/clear_wifi",
    .method    = HTTP_POST,
    .handler   = clear_wifi_handler,
    .user_ctx  = NULL
};

// Start web server
static esp_err_t start_webserver(void)
{
    httpd_config_t config = HTTPD_DEFAULT_CONFIG();
    config.server_port = 80;
    config.stack_size = 8192;

    ESP_LOGI(TAG, "Starting web server on port %d", config.server_port);

    if (httpd_start(&server, &config) == ESP_OK) {
        httpd_register_uri_handler(server, &uri_root);
        httpd_register_uri_handler(server, &uri_status);
        httpd_register_uri_handler(server, &uri_scan);
        httpd_register_uri_handler(server, &uri_scan_results);
        httpd_register_uri_handler(server, &uri_connect);
        httpd_register_uri_handler(server, &uri_clear_provision);
        httpd_register_uri_handler(server, &uri_clear_wifi);
        ESP_LOGI(TAG, "✅ Web server started successfully");
        return ESP_OK;
    }

    ESP_LOGE(TAG, "❌ Failed to start web server");
    return ESP_FAIL;
}

// WiFi event handler
static void wifi_event_handler(void* arg, esp_event_base_t event_base,
                                int32_t event_id, void* event_data)
{
    if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_AP_START) {
        ESP_LOGI(TAG, "🎉 AP Started - SSID: %s", WIFI_AP_SSID);
        ap_active = true;
        ESP_LOGI(TAG, "💡 LED: Alternating GREEN/BLUE (AP mode, no clients)");

    } else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_AP_STOP) {
        ESP_LOGI(TAG, "🛑 AP Stopped");
        ap_active = false;

    } else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_AP_STACONNECTED) {
        wifi_event_ap_staconnected_t* event = (wifi_event_ap_staconnected_t*) event_data;
        client_count++;
        ESP_LOGI(TAG, "📱 Client connected to AP - MAC: "MACSTR" (Total: %d)", MAC2STR(event->mac), client_count);
        if (!sta_connected) {
            ESP_LOGI(TAG, "💡 LED: Solid BLUE (client connected)");
        }

    } else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_AP_STADISCONNECTED) {
        wifi_event_ap_stadisconnected_t* event = (wifi_event_ap_stadisconnected_t*) event_data;
        if (client_count > 0) client_count--;
        ESP_LOGI(TAG, "📱 Client disconnected from AP - MAC: "MACSTR" (Total: %d)", MAC2STR(event->mac), client_count);
        if (client_count == 0 && !sta_connected) {
            ESP_LOGI(TAG, "💡 LED: Alternating GREEN/BLUE (no clients)");
        }

    } else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START) {
        ESP_LOGI(TAG, "🔌 STA mode started");

    } else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_DISCONNECTED) {
        wifi_event_sta_disconnected_t* disconn_event = (wifi_event_sta_disconnected_t*) event_data;
        sta_connected = false;

        ESP_LOGW(TAG, "⚠️  WiFi Disconnected - Reason: %d", disconn_event->reason);

        if (sta_retry_count < WIFI_STA_MAX_RETRY) {
            esp_wifi_connect();
            sta_retry_count++;
            ESP_LOGI(TAG, "🔄 Retry connecting to WiFi (%d/%d)...", sta_retry_count, WIFI_STA_MAX_RETRY);
        } else {
            ESP_LOGE(TAG, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            ESP_LOGE(TAG, "  ❌ Failed to connect to WiFi");
            ESP_LOGE(TAG, "  🔄 Tried %d times", WIFI_STA_MAX_RETRY);
            ESP_LOGE(TAG, "  💡 Please check WiFi password and try again");
            ESP_LOGE(TAG, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        }
        if (!ap_active) {
            ESP_LOGI(TAG, "💡 LED: Blinking RED (disconnected, no AP)");
        }

    } else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_SCAN_DONE) {
        ESP_LOGI(TAG, "📡 WiFi scan completed");
        wifi_scan_done_handler();

    } else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP) {
        ip_event_got_ip_t* event = (ip_event_got_ip_t*) event_data;
        sta_connected = true;
        wifi_connected = true;
        sta_retry_count = 0;

        // Print detailed connection info
        ESP_LOGI(TAG, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        ESP_LOGI(TAG, "  ✅ WiFi Connected Successfully!");
        ESP_LOGI(TAG, "  📡 IP Address:  " IPSTR, IP2STR(&event->ip_info.ip));
        ESP_LOGI(TAG, "  🌐 Gateway:     " IPSTR, IP2STR(&event->ip_info.gw));
        ESP_LOGI(TAG, "  🔧 Netmask:     " IPSTR, IP2STR(&event->ip_info.netmask));
        ESP_LOGI(TAG, "  ─────────────────────────────────────────────────────");
        ESP_LOGI(TAG, "  🌐 Web UI now accessible at: http://" IPSTR, IP2STR(&event->ip_info.ip));
        ESP_LOGI(TAG, "  💡 LED: Solid GREEN (WiFi connected)");
        ESP_LOGI(TAG, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        // Start MQTT client
        ESP_LOGI(TAG, "🚀 Starting MQTT client...");
        mqtt_app_start();

        // Shutdown AP mode after successful STA connection
        if (ap_active) {
            ESP_LOGI(TAG, "🛑 Shutting down AP mode in 2 seconds...");
            ESP_LOGI(TAG, "   (AP will no longer be needed)");
            vTaskDelay(pdMS_TO_TICKS(2000));  // Give clients time to see the status
            esp_wifi_set_mode(WIFI_MODE_STA);
            ap_active = false;
            ESP_LOGI(TAG, "🛑 AP mode disabled - Gateway now in STA-only mode");
        }
    }
}

// Initialize WiFi in AP mode (will switch to APSTA when user connects to external WiFi)
static void wifi_init_ap(void)
{
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());

    // Create both AP and STA network interfaces (STA for future use)
    esp_netif_t *ap_netif = esp_netif_create_default_wifi_ap();
    esp_netif_create_default_wifi_sta();  // Create but don't use yet

    // Configure AP IP address
    esp_netif_dhcps_stop(ap_netif);

    esp_netif_ip_info_t ip_info;
    IP4_ADDR(&ip_info.ip, 192, 168, 4, 1);
    IP4_ADDR(&ip_info.gw, 192, 168, 4, 1);
    IP4_ADDR(&ip_info.netmask, 255, 255, 255, 0);

    esp_netif_set_ip_info(ap_netif, &ip_info);
    esp_netif_dhcps_start(ap_netif);

    ESP_LOGI(TAG, "✅ AP IP set to 192.168.4.1");

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));

    // Register event handlers
    ESP_ERROR_CHECK(esp_event_handler_register(WIFI_EVENT, ESP_EVENT_ANY_ID, &wifi_event_handler, NULL));
    ESP_ERROR_CHECK(esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP, &wifi_event_handler, NULL));

    // Configure AP
    wifi_config_t ap_config = {
        .ap = {
            .ssid = WIFI_AP_SSID,
            .ssid_len = strlen(WIFI_AP_SSID),
            .channel = WIFI_AP_CHANNEL,
            .password = WIFI_AP_PASS,
            .max_connection = WIFI_AP_MAX_CONN,
            .authmode = WIFI_AUTH_WPA_WPA2_PSK,
            .pmf_cfg = {
                .required = false,
            },
        },
    };

    if (strlen(WIFI_AP_PASS) == 0) {
        ap_config.ap.authmode = WIFI_AUTH_OPEN;
    }

    // Start in AP-only mode
    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_AP));
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_AP, &ap_config));
    ESP_ERROR_CHECK(esp_wifi_start());

    ESP_LOGI(TAG, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    ESP_LOGI(TAG, "  📡 WiFi AP Mode Started");
    ESP_LOGI(TAG, "  SSID: %s", WIFI_AP_SSID);
    ESP_LOGI(TAG, "  Password: %s", WIFI_AP_PASS);
    ESP_LOGI(TAG, "  IP: 192.168.4.1");
    ESP_LOGI(TAG, "  Web UI: http://192.168.4.1");
    ESP_LOGI(TAG, "  ─────────────────────────────────────────────────────");
    ESP_LOGI(TAG, "  � Use Web UI to scan and connect to WiFi");
    ESP_LOGI(TAG, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
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

                    // Clear custom mesh storage
                    esp_err_t err = mesh_storage_clear();
                    if (err == ESP_OK) {
                        ESP_LOGI(TAG, "✓ Custom mesh storage cleared");
                    } else {
                        ESP_LOGE(TAG, "✗ Failed to clear custom mesh storage: %s", esp_err_to_name(err));
                    }

                    // Reset BLE Mesh stack (this clears ESP-IDF internal BLE Mesh NVS)
                    ESP_LOGW(TAG, "Resetting BLE Mesh stack...");
                    err = esp_ble_mesh_node_local_reset();
                    if (err == ESP_OK) {
                        ESP_LOGI(TAG, "✓ BLE Mesh stack reset successfully");
                    } else {
                        ESP_LOGE(TAG, "✗ Failed to reset BLE Mesh stack: %s", esp_err_to_name(err));
                    }

                    // Clear WiFi credentials
                    err = wifi_clear_credentials();
                    if (err == ESP_OK) {
                        ESP_LOGI(TAG, "✓ WiFi credentials cleared");
                    } else {
                        ESP_LOGE(TAG, "✗ Failed to clear WiFi credentials: %s", esp_err_to_name(err));
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

/* BLE Mesh Callbacks */
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
        // Note: We load existing data first to preserve AppKey if it exists
        mesh_prov_data_t prov_data;
        esp_err_t err = mesh_storage_load_prov_data(&prov_data);

        if (err == ESP_OK) {
            // Update only the fields from provisioning complete event
            // Preserve existing AppKey if already set
            prov_data.provisioned = true;
            prov_data.node_addr = param->node_prov_complete.addr;
            prov_data.net_idx = param->node_prov_complete.net_idx;
            prov_data.iv_index = param->node_prov_complete.iv_index;
            memcpy(prov_data.net_key, param->node_prov_complete.net_key, 16);
            // Don't overwrite app_idx and app_key - they will be set by APP_KEY_ADD event
        } else {
            // First time provisioning - create new data
            memset(&prov_data, 0, sizeof(mesh_prov_data_t));
            prov_data.provisioned = true;
            prov_data.node_addr = param->node_prov_complete.addr;
            prov_data.net_idx = param->node_prov_complete.net_idx;
            prov_data.app_idx = 0;
            prov_data.iv_index = param->node_prov_complete.iv_index;
            memcpy(prov_data.net_key, param->node_prov_complete.net_key, 16);
        }

        // Save to NVS
        err = mesh_storage_save_prov_data(&prov_data);
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

        switch (param->ctx.recv_op) {
        case ESP_BLE_MESH_MODEL_OP_APP_KEY_ADD:
            printf("\n========================================\n");
            printf("🔑 APPKEY ADDED!\n");
            printf("========================================\n");
            printf("   Net Index: 0x%04X\n", param->value.state_change.appkey_add.net_idx);
            printf("   App Index: 0x%04X\n", param->value.state_change.appkey_add.app_idx);

            // Update provisioning data with AppKey index and AppKey value
            mesh_prov_data_t prov_data;
            if (mesh_storage_load_prov_data(&prov_data) == ESP_OK) {
                prov_data.app_idx = param->value.state_change.appkey_add.app_idx;
                // Copy AppKey (app_key is always available as array)
                memcpy(prov_data.app_key, param->value.state_change.appkey_add.app_key, 16);
                mesh_storage_save_prov_data(&prov_data);

                printf("💾 AppKey saved to NVS:\n");
                printf("   AppKey: %02X%02X%02X%02X%02X%02X%02X%02X...\n",
                         prov_data.app_key[0], prov_data.app_key[1],
                         prov_data.app_key[2], prov_data.app_key[3],
                         prov_data.app_key[4], prov_data.app_key[5],
                         prov_data.app_key[6], prov_data.app_key[7]);
            }
            printf("========================================\n\n");
            break;

        case ESP_BLE_MESH_MODEL_OP_MODEL_APP_BIND:
            printf("\n========================================\n");
            printf("🔗 MODEL BOUND TO APPKEY!\n");
            printf("========================================\n");
            printf("   Element Addr: 0x%04X\n", param->value.state_change.mod_app_bind.element_addr);
            printf("   Model ID: 0x%04X\n", param->value.state_change.mod_app_bind.model_id);
            printf("   App Index: 0x%04X\n", param->value.state_change.mod_app_bind.app_idx);

            // Determine model ID string
            const char *model_id = NULL;
            if (param->value.state_change.mod_app_bind.model_id == ESP_BLE_MESH_MODEL_ID_GEN_ONOFF_CLI) {
                model_id = "onoff_cli";
                printf("   Model: Generic OnOff Client\n");
            } else if (param->value.state_change.mod_app_bind.model_id == ESP_BLE_MESH_MODEL_ID_GEN_ONOFF_SRV) {
                model_id = "onoff_srv";
                printf("   Model: Generic OnOff Server\n");
            }

            if (model_id) {
                mesh_model_binding_t binding = {
                    .bound = true,
                    .app_idx = param->value.state_change.mod_app_bind.app_idx,
                };
                mesh_storage_save_model_binding(model_id, &binding);
                printf("💾 Model binding saved to NVS\n");
            }
            printf("========================================\n\n");
            break;

        case ESP_BLE_MESH_MODEL_OP_MODEL_SUB_ADD:
            printf("\n========================================\n");
            printf("📬 SUBSCRIPTION ADDED!\n");
            printf("========================================\n");
            printf("   Element Addr: 0x%04X\n", param->value.state_change.mod_sub_add.element_addr);
            printf("   Model ID: 0x%04X\n", param->value.state_change.mod_sub_add.model_id);
            printf("   Sub Addr: 0x%04X\n", param->value.state_change.mod_sub_add.sub_addr);

            // Determine model ID string
            model_id = NULL;
            if (param->value.state_change.mod_sub_add.model_id == ESP_BLE_MESH_MODEL_ID_GEN_ONOFF_CLI) {
                model_id = "onoff_cli";
                printf("   Model: Generic OnOff Client\n");
            } else if (param->value.state_change.mod_sub_add.model_id == ESP_BLE_MESH_MODEL_ID_GEN_ONOFF_SRV) {
                model_id = "onoff_srv";
                printf("   Model: Generic OnOff Server\n");
            }

            if (model_id) {
                mesh_storage_add_subscription(model_id, param->value.state_change.mod_sub_add.sub_addr);
                printf("💾 Subscription saved to NVS\n");
            }
            printf("========================================\n\n");
            break;

        case ESP_BLE_MESH_MODEL_OP_MODEL_SUB_DELETE:
            printf("\n========================================\n");
            printf("📭 SUBSCRIPTION REMOVED!\n");
            printf("========================================\n");
            printf("   Element Addr: 0x%04X\n", param->value.state_change.mod_sub_delete.element_addr);
            printf("   Model ID: 0x%04X\n", param->value.state_change.mod_sub_delete.model_id);
            printf("   Sub Addr: 0x%04X\n", param->value.state_change.mod_sub_delete.sub_addr);

            // Determine model ID string
            model_id = NULL;
            if (param->value.state_change.mod_sub_delete.model_id == ESP_BLE_MESH_MODEL_ID_GEN_ONOFF_CLI) {
                model_id = "onoff_cli";
                printf("   Model: Generic OnOff Client\n");
            } else if (param->value.state_change.mod_sub_delete.model_id == ESP_BLE_MESH_MODEL_ID_GEN_ONOFF_SRV) {
                model_id = "onoff_srv";
                printf("   Model: Generic OnOff Server\n");
            }

            if (model_id) {
                mesh_storage_remove_subscription(model_id, param->value.state_change.mod_sub_delete.sub_addr);
                printf("💾 Subscription removed from NVS\n");
            }
            printf("========================================\n\n");
            break;

        default:
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
    default:
        break;
    }
}

static void generic_client_cb(esp_ble_mesh_generic_client_cb_event_t event, esp_ble_mesh_generic_client_cb_param_t *param)
{
    switch (event) {
    case ESP_BLE_MESH_GENERIC_CLIENT_TIMEOUT_EVT:
        ESP_LOGW(TAG, "⚠️  Generic client timeout");
        break;
    default:
        break;
    }
}

/* BLE Mesh Initialization */
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

    // Load provisioning data from custom NVS to update global variables
    // Note: CONFIG_BLE_MESH_SETTINGS=y automatically restores BLE Mesh stack state
    // We only load from custom NVS to update global variables for Web UI display
    mesh_prov_data_t prov_data;
    if (mesh_storage_load_prov_data(&prov_data) == ESP_OK && prov_data.provisioned) {
        provisioned = true;
        node_addr = prov_data.node_addr;

        printf("\n========================================\n");
        printf("📂 LOADED PROVISIONING DATA FROM NVS\n");
        printf("========================================\n");
        printf("   Node Address: 0x%04X\n", prov_data.node_addr);
        printf("   Net Index: 0x%04X\n", prov_data.net_idx);
        printf("   App Index: 0x%04X\n", prov_data.app_idx);

        // Check if AppKey is valid (not all zeros)
        bool app_key_valid = false;
        for (int i = 0; i < 16; i++) {
            if (prov_data.app_key[i] != 0) {
                app_key_valid = true;
                break;
            }
        }

        if (app_key_valid) {
            printf("   AppKey: %02X%02X%02X%02X%02X%02X%02X%02X...\n",
                     prov_data.app_key[0], prov_data.app_key[1],
                     prov_data.app_key[2], prov_data.app_key[3],
                     prov_data.app_key[4], prov_data.app_key[5],
                     prov_data.app_key[6], prov_data.app_key[7]);
        } else {
            printf("   AppKey: Not configured yet\n");
        }
        printf("========================================\n");
        printf("ℹ️  BLE Mesh stack auto-restored by CONFIG_BLE_MESH_SETTINGS\n");
        printf("✅ BLE Mesh Gateway - Already provisioned\n");
        printf("========================================\n\n");
    } else {
        printf("\nℹ️  No provisioning data found - device is unprovisioned\n\n");

        // Only enable provisioning if device is not already provisioned
        err = esp_ble_mesh_node_prov_enable(ESP_BLE_MESH_PROV_ADV | ESP_BLE_MESH_PROV_GATT);
        if (err != ESP_OK) {
            ESP_LOGE(TAG, "Failed to enable provisioning");
            return err;
        }
        printf("✅ BLE Mesh Gateway - Ready for provisioning\n\n");
    }

    return ESP_OK;
}

/* MQTT Functions */
static void publish_button_press(uint16_t src_addr)
{
    if (mqtt_client == NULL || !wifi_connected) {
        ESP_LOGW(TAG, "Cannot publish - MQTT not connected");
        return;
    }

    char payload[128];
    snprintf(payload, sizeof(payload),
             "{\"node_addr\":\"0x%04x\",\"event\":\"button_press\",\"timestamp\":%lld}",
             src_addr, esp_timer_get_time() / 1000);

    int msg_id = esp_mqtt_client_publish(mqtt_client, MQTT_TOPIC_BUTTON, payload, 0, 1, 0);
    ESP_LOGI(TAG, "📤 Published button press from 0x%04x, msg_id=%d", src_addr, msg_id);
}

static void mqtt_event_handler(void *handler_args, esp_event_base_t base, int32_t event_id, void *event_data)
{
    esp_mqtt_event_handle_t event = event_data;

    switch ((esp_mqtt_event_id_t)event_id) {
    case MQTT_EVENT_CONNECTED:
        ESP_LOGI(TAG, "✅ MQTT Connected");
        esp_mqtt_client_subscribe(mqtt_client, MQTT_TOPIC_COMMAND, 0);

        // Publish status
        char status[128];
        snprintf(status, sizeof(status),
                 "{\"status\":\"online\",\"node_addr\":\"0x%04x\",\"provisioned\":%s}",
                 node_addr, provisioned ? "true" : "false");
        esp_mqtt_client_publish(mqtt_client, MQTT_TOPIC_STATUS, status, 0, 1, 1);
        break;

    case MQTT_EVENT_DISCONNECTED:
        ESP_LOGW(TAG, "⚠️  MQTT Disconnected");
        break;

    case MQTT_EVENT_SUBSCRIBED:
        ESP_LOGI(TAG, "📥 MQTT Subscribed, msg_id=%d", event->msg_id);
        break;

    case MQTT_EVENT_DATA:
        ESP_LOGI(TAG, "📨 MQTT Message Received");
        ESP_LOGI(TAG, "TOPIC=%.*s", event->topic_len, event->topic);
        ESP_LOGI(TAG, "DATA=%.*s", event->data_len, event->data);

        // Parse command and send to BLE Mesh
        if (strncmp(event->topic, MQTT_TOPIC_COMMAND, event->topic_len) == 0) {
            cJSON *json = cJSON_ParseWithLength(event->data, event->data_len);
            if (json != NULL) {
                cJSON *node = cJSON_GetObjectItem(json, "node_addr");
                cJSON *led = cJSON_GetObjectItem(json, "led");
                cJSON *factory_reset = cJSON_GetObjectItem(json, "factory_reset");

                if (node && cJSON_IsString(node)) {
                    uint16_t target_addr;
                    sscanf(node->valuestring, "0x%hx", &target_addr);

                    if (factory_reset && cJSON_IsTrue(factory_reset)) {
                        ESP_LOGW(TAG, "🔴 Factory reset command for node 0x%04x", target_addr);

                        // Send factory reset message using Generic OnOff with special value
                        esp_ble_mesh_generic_client_set_state_t set_state = {0};
                        set_state.onoff_set.op_en = false;
                        set_state.onoff_set.onoff = 2;  // Special value for factory reset
                        set_state.onoff_set.tid = 0;

                        esp_ble_mesh_client_common_param_t common = {0};
                        common.opcode = ESP_BLE_MESH_MODEL_OP_GEN_ONOFF_SET_UNACK;
                        common.model = &root_models[1];
                        common.ctx.net_idx = 0;
                        common.ctx.app_idx = 0;
                        common.ctx.addr = target_addr;
                        common.ctx.send_ttl = 3;
                        common.msg_timeout = 0;

                        esp_ble_mesh_generic_client_set_state(&common, &set_state);
                        ESP_LOGI(TAG, "✓ Factory reset command sent to node 0x%04x", target_addr);
                    }
                    else if (led && cJSON_IsBool(led)) {
                        bool led_state = cJSON_IsTrue(led);
                        ESP_LOGI(TAG, "Sending LED command to node 0x%04x: %s", target_addr, led_state ? "ON" : "OFF");

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
                        common.ctx.addr = target_addr;
                        common.ctx.send_ttl = 3;
                        common.msg_timeout = 0;

                        esp_ble_mesh_generic_client_set_state(&common, &set_state);
                    }
                }
                cJSON_Delete(json);
            }
        }
        break;

    case MQTT_EVENT_ERROR:
        ESP_LOGE(TAG, "❌ MQTT Error");
        break;

    default:
        break;
    }
}

static void mqtt_app_start(void)
{
    if (!wifi_connected) {
        ESP_LOGW(TAG, "WiFi not connected, skipping MQTT");
        return;
    }

    esp_mqtt_client_config_t mqtt_cfg = {
        .broker.address.uri = MQTT_BROKER_URL,
    };

    mqtt_client = esp_mqtt_client_init(&mqtt_cfg);
    esp_mqtt_client_register_event(mqtt_client, ESP_EVENT_ANY_ID, mqtt_event_handler, NULL);
    esp_mqtt_client_start(mqtt_client);

    ESP_LOGI(TAG, "🚀 MQTT Client Started");
}

void app_main(void)
{
    printf("\n\n========================================\n");
    printf("APP_MAIN STARTED!\n");
    printf("========================================\n\n");

    ESP_LOGI(TAG, "Step 1: Initializing NVS...");

    // Initialize NVS
    // Note: We do NOT erase NVS on error to preserve BLE Mesh provisioning data
    // If NVS is corrupted, user must manually erase flash using: idf.py erase-flash
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_LOGW(TAG, "⚠️  NVS error: %s", esp_err_to_name(ret));
        ESP_LOGW(TAG, "⚠️  NVS may be full or version mismatch");
        ESP_LOGW(TAG, "⚠️  To fix: Run 'idf.py erase-flash' and re-flash firmware");
        ESP_LOGW(TAG, "⚠️  WARNING: This will erase ALL data including WiFi and BLE Mesh provisioning!");
        // Do NOT auto-erase to preserve provisioning data
        // ESP_ERROR_CHECK(nvs_flash_erase());
        // ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);
    ESP_LOGI(TAG, "NVS initialized OK");

    ESP_LOGI(TAG, "🚀 Smart Storage Gateway Starting...");

    ESP_LOGI(TAG, "Step 2: Initializing GPIO...");
    // Initialize button GPIO for factory reset
    gpio_config_t button_conf = {
        .pin_bit_mask = (1ULL << BUTTON_GPIO),
        .mode = GPIO_MODE_INPUT,
        .pull_up_en = GPIO_PULLUP_ENABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    gpio_config(&button_conf);
    ESP_LOGI(TAG, "GPIO initialized OK (Button on GPIO%d)", BUTTON_GPIO);

    ESP_LOGI(TAG, "Step 3: Initializing NeoPixel LED...");
    // Initialize NeoPixel LED
    neopixel_init();
    ESP_LOGI(TAG, "NeoPixel initialized OK");

    ESP_LOGI(TAG, "Step 4: Initializing WiFi...");
    // Initialize WiFi in AP mode
    wifi_init_ap();
    ESP_LOGI(TAG, "WiFi initialized OK");

    // Try to load and connect to saved WiFi
    char saved_ssid[33] = {0};
    char saved_password[64] = {0};

    if (wifi_load_credentials(saved_ssid, sizeof(saved_ssid), saved_password, sizeof(saved_password)) == ESP_OK) {
        ESP_LOGI(TAG, "🔄 Auto-connecting to saved WiFi: %s", saved_ssid);

        // Switch to APSTA mode
        esp_wifi_set_mode(WIFI_MODE_APSTA);
        vTaskDelay(pdMS_TO_TICKS(100));

        // Configure and connect
        wifi_config_t sta_config = {0};
        strncpy((char *)sta_config.sta.ssid, saved_ssid, sizeof(sta_config.sta.ssid) - 1);
        strncpy((char *)sta_config.sta.password, saved_password, sizeof(sta_config.sta.password) - 1);
        sta_config.sta.threshold.authmode = strlen(saved_password) > 0 ? WIFI_AUTH_WPA2_PSK : WIFI_AUTH_OPEN;
        sta_config.sta.pmf_cfg.capable = true;
        sta_config.sta.pmf_cfg.required = false;

        esp_wifi_set_config(WIFI_IF_STA, &sta_config);
        esp_wifi_connect();
    } else {
        ESP_LOGI(TAG, "ℹ️  No saved WiFi credentials - staying in AP mode");
    }

    ESP_LOGI(TAG, "Step 5: Waiting for WiFi to stabilize...");
    // Wait a bit for WiFi to stabilize
    vTaskDelay(pdMS_TO_TICKS(1000));

    ESP_LOGI(TAG, "Step 6: Starting web server...");
    // Start web server
    start_webserver();
    ESP_LOGI(TAG, "Web server started OK");

    ESP_LOGI(TAG, "Step 7: Starting LED control task...");
    // Start LED control task
    xTaskCreate(led_control_task, "led_control", 2048, NULL, 5, NULL);
    ESP_LOGI(TAG, "LED task started OK");

    ESP_LOGI(TAG, "Step 8: Starting factory reset monitor task...");
    // Start factory reset monitor task
    xTaskCreate(factory_reset_task, "factory_reset", 2048, NULL, 5, NULL);
    ESP_LOGI(TAG, "Factory reset task started OK");

    ESP_LOGI(TAG, "Step 9: Initializing Bluetooth...");
    // Initialize Bluetooth
    ESP_ERROR_CHECK(esp_bt_controller_mem_release(ESP_BT_MODE_CLASSIC_BT));

    esp_bt_controller_config_t bt_cfg = BT_CONTROLLER_INIT_CONFIG_DEFAULT();
    ret = esp_bt_controller_init(&bt_cfg);
    if (ret) {
        ESP_LOGE(TAG, "Bluetooth controller init failed");
        return;
    }

    ret = esp_bt_controller_enable(ESP_BT_MODE_BLE);
    if (ret) {
        ESP_LOGE(TAG, "Bluetooth controller enable failed");
        return;
    }

    ret = esp_bluedroid_init();
    if (ret) {
        ESP_LOGE(TAG, "Bluedroid init failed");
        return;
    }

    ret = esp_bluedroid_enable();
    if (ret) {
        ESP_LOGE(TAG, "Bluedroid enable failed");
        return;
    }
    ESP_LOGI(TAG, "Bluetooth initialized OK");

    ESP_LOGI(TAG, "Step 10: Initializing Mesh Storage...");
    // Initialize mesh storage
    ret = mesh_storage_init();
    if (ret) {
        ESP_LOGE(TAG, "Mesh storage init failed");
        return;
    }
    ESP_LOGI(TAG, "Mesh storage initialized OK");

    ESP_LOGI(TAG, "Step 11: Initializing BLE Mesh...");
    // Initialize BLE Mesh
    ret = ble_mesh_init();
    if (ret) {
        ESP_LOGE(TAG, "BLE Mesh init failed");
        return;
    }
    ESP_LOGI(TAG, "BLE Mesh initialized OK");

    ESP_LOGI(TAG, "✅ System ready!");
    ESP_LOGI(TAG, "📱 Connect to AP: %s (Password: %s)", WIFI_AP_SSID, WIFI_AP_PASS);
    ESP_LOGI(TAG, "🌐 Web UI: http://192.168.4.1");
    ESP_LOGI(TAG, "💡 LED Status:");
    ESP_LOGI(TAG, "   - Alternating GREEN/BLUE = AP mode, waiting for configuration");
    ESP_LOGI(TAG, "   - Solid BLUE = Client connected to AP");
    ESP_LOGI(TAG, "   - Solid GREEN = Connected to external WiFi (AP disabled)");

    printf("\n========================================\n");
    printf("APP_MAIN COMPLETED SUCCESSFULLY!\n");
    printf("========================================\n\n");
}

