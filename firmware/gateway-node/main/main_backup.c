#include <stdio.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"
#include "nvs_flash.h"
#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_netif.h"
#include "esp_http_server.h"
#include "esp_mac.h"
#include "lwip/ip4_addr.h"
#include "led_strip.h"
#include "driver/gpio.h"

#define MACSTR "%02x:%02x:%02x:%02x:%02x:%02x"
#define MAC2STR(a) (a)[0], (a)[1], (a)[2], (a)[3], (a)[4], (a)[5]

static const char *TAG = "SIMPLE_TEST";

// GPIO Configuration - Adafruit ESP32-C6 Feather
#define NEOPIXEL_GPIO       GPIO_NUM_9   // NeoPixel LED
#define NEOPIXEL_POWER_GPIO GPIO_NUM_20  // NeoPixel power control
#define NEOPIXEL_COUNT      1

// WiFi AP Configuration
#define WIFI_AP_SSID "Smart-Storage-Gateway"
#define WIFI_AP_PASS "12345678"
#define WIFI_AP_CHANNEL 6
#define WIFI_AP_MAX_CONN 4

// WiFi STA Configuration
#define WIFI_STA_MAX_RETRY 5
#define MAX_SCAN_RESULTS 20

// NVS Storage Keys for WiFi
#define NVS_NAMESPACE "wifi_config"
#define NVS_KEY_SSID "ssid"
#define NVS_KEY_PASSWORD "password"
#define NVS_KEY_CONNECTED "connected"

// WiFi scan result storage
typedef struct {
    char ssid[33];
    int8_t rssi;
    wifi_auth_mode_t authmode;
} wifi_scan_result_t;

static httpd_handle_t server = NULL;
static led_strip_handle_t led_strip = NULL;
static uint8_t client_count = 0;
static bool sta_connected = false;
static bool ap_active = true;
static int sta_retry_count = 0;
static wifi_scan_result_t scan_results[MAX_SCAN_RESULTS];
static uint16_t scan_result_count = 0;
static bool scan_in_progress = false;

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
"    });"
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
    char response[256];
    esp_netif_ip_info_t ip_info;
    char sta_ip_str[16] = "-";

    // Get STA IP if connected
    if (sta_connected) {
        esp_netif_t *sta_netif = esp_netif_get_handle_from_ifkey("WIFI_STA_DEF");
        if (sta_netif && esp_netif_get_ip_info(sta_netif, &ip_info) == ESP_OK) {
            snprintf(sta_ip_str, sizeof(sta_ip_str), IPSTR, IP2STR(&ip_info.ip));
        }
    }

    snprintf(response, sizeof(response),
             "{\"clients\":%d,\"sta_connected\":%s,\"sta_ip\":\"%s\",\"ap_active\":%s}",
             client_count,
             sta_connected ? "true" : "false",
             sta_ip_str,
             ap_active ? "true" : "false");

    httpd_resp_set_type(req, "application/json");
    httpd_resp_send(req, response, strlen(response));
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

        // Shutdown AP mode after successful STA connection
        if (ap_active) {
            ESP_LOGI(TAG, "🛑 Shutting down AP mode in 2 seconds...");
            ESP_LOGI(TAG, "   (AP will no longer be needed)");
            vTaskDelay(pdMS_TO_TICKS(2000));  // Give clients time to see the status
            esp_wifi_set_mode(WIFI_MODE_STA);
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

void app_main(void)
{
    printf("\n\n========================================\n");
    printf("APP_MAIN STARTED!\n");
    printf("========================================\n\n");

    ESP_LOGI(TAG, "Step 1: Initializing NVS...");

    // Initialize NVS
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_LOGI(TAG, "Erasing NVS...");
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);
    ESP_LOGI(TAG, "NVS initialized OK");

    ESP_LOGI(TAG, "🚀 Smart Storage Gateway Starting...");

    ESP_LOGI(TAG, "Step 2: Initializing NeoPixel LED...");
    // Initialize NeoPixel LED
    neopixel_init();
    ESP_LOGI(TAG, "NeoPixel initialized OK");

    ESP_LOGI(TAG, "Step 3: Initializing WiFi...");
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

    ESP_LOGI(TAG, "Step 4: Waiting for WiFi to stabilize...");
    // Wait a bit for WiFi to stabilize
    vTaskDelay(pdMS_TO_TICKS(1000));

    ESP_LOGI(TAG, "Step 5: Starting web server...");
    // Start web server
    start_webserver();
    ESP_LOGI(TAG, "Web server started OK");

    ESP_LOGI(TAG, "Step 6: Starting LED control task...");
    // Start LED control task
    xTaskCreate(led_control_task, "led_control", 2048, NULL, 5, NULL);
    ESP_LOGI(TAG, "LED task started OK");

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

