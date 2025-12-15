#include "wifi_manager.h"
#include "dns_server.h"
#include "nvs_flash.h"
#include "nvs.h"
#include "esp_log.h"
#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_mac.h"
#include "esp_netif.h"
#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"
#include "lwip/ip4_addr.h"
#include <string.h>

static const char *TAG = "WIFI_MANAGER";

#define WIFI_NVS_NAMESPACE "wifi_creds"
#define WIFI_CONNECTED_BIT BIT0
#define WIFI_FAIL_BIT BIT1
#define MAX_RETRY 5

static EventGroupHandle_t s_wifi_event_group;
static int s_retry_num = 0;
static bool s_is_connected = false;
static bool s_ap_active = false;
static char s_current_ssid[WIFI_SSID_MAX_LEN] = {0};
static wifi_event_callback_t s_event_callback = NULL;
static uint8_t s_ap_client_count = 0;
static esp_netif_t *s_ap_netif = NULL;
static esp_netif_t *s_sta_netif = NULL;

// WiFi event handler
static void wifi_event_handler(void* arg, esp_event_base_t event_base,
                                int32_t event_id, void* event_data)
{
    if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START) {
        esp_wifi_connect();
        ESP_LOGI(TAG, "Station mode started, connecting...");
    } else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_DISCONNECTED) {
        if (s_retry_num < MAX_RETRY) {
            esp_wifi_connect();
            s_retry_num++;
            ESP_LOGI(TAG, "Retry to connect to the AP (%d/%d)", s_retry_num, MAX_RETRY);
        } else {
            xEventGroupSetBits(s_wifi_event_group, WIFI_FAIL_BIT);
            ESP_LOGW(TAG, "Failed to connect after %d retries", MAX_RETRY);

            // Start AP mode as fallback if not already active
            if (!s_ap_active) {
                ESP_LOGI(TAG, "Starting AP mode as fallback...");
                wifi_manager_start_ap();
            }
        }
        s_is_connected = false;

        // Notify callback
        if (s_event_callback) {
            s_event_callback(false);
        }
    } else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP) {
        ip_event_got_ip_t* event = (ip_event_got_ip_t*) event_data;
        ESP_LOGI(TAG, "✅ Connected! Got IP:" IPSTR, IP2STR(&event->ip_info.ip));
        s_retry_num = 0;
        s_is_connected = true;
        xEventGroupSetBits(s_wifi_event_group, WIFI_CONNECTED_BIT);

        // Stop AP mode when successfully connected to WiFi
        if (s_ap_active) {
            ESP_LOGI(TAG, "Stopping AP mode (connected to WiFi)");
            wifi_manager_stop_ap();
        }

        // Notify callback
        if (s_event_callback) {
            s_event_callback(true);
        }
    } else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_AP_START) {
        ESP_LOGI(TAG, "🎉 AP mode is now ACTIVE - SSID: %s", WIFI_AP_SSID);
        s_ap_active = true;

        // Start DNS server for captive portal (CRITICAL for iOS)
        esp_err_t dns_err = dns_server_start();
        if (dns_err == ESP_OK) {
            ESP_LOGI(TAG, "✅ DNS server started for captive portal");
        } else {
            ESP_LOGW(TAG, "⚠️  Failed to start DNS server: %s", esp_err_to_name(dns_err));
        }

        // Notify callback about AP mode start (pass current connection state)
        if (s_event_callback) {
            s_event_callback(s_is_connected);
        }
    } else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_AP_STOP) {
        ESP_LOGI(TAG, "AP mode stopped");
        s_ap_active = false;

        // Stop DNS server
        dns_server_stop();
        ESP_LOGI(TAG, "DNS server stopped");

        // Notify callback about AP mode stop (pass current connection state)
        if (s_event_callback) {
            s_event_callback(s_is_connected);
        }
    } else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_AP_STACONNECTED) {
        wifi_event_ap_staconnected_t* event = (wifi_event_ap_staconnected_t*) event_data;
        s_ap_client_count++;
        ESP_LOGI(TAG, "Client connected to AP (MAC: " MACSTR ", Total: %d)",
                 MAC2STR(event->mac), s_ap_client_count);
    } else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_AP_STADISCONNECTED) {
        wifi_event_ap_stadisconnected_t* event = (wifi_event_ap_stadisconnected_t*) event_data;
        if (s_ap_client_count > 0) s_ap_client_count--;
        ESP_LOGI(TAG, "Client disconnected from AP (MAC: " MACSTR ", Total: %d)",
                 MAC2STR(event->mac), s_ap_client_count);
    }
}

esp_err_t wifi_manager_init(void)
{
    ESP_LOGI(TAG, "🔧 wifi_manager_init() starting...");

    s_wifi_event_group = xEventGroupCreate();
    s_ap_active = false;  // Explicitly set to false
    s_is_connected = false;

    // Initialize network interface
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());

    // Create default WiFi AP and STA interfaces
    s_ap_netif = esp_netif_create_default_wifi_ap();
    s_sta_netif = esp_netif_create_default_wifi_sta();

    // Initialize WiFi with default config
    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));

    // Set WiFi country code for better iOS compatibility
    wifi_country_t country = {
        .cc = "TH",           // Thailand country code
        .schan = 1,           // Start channel
        .nchan = 13,          // Number of channels
        .policy = WIFI_COUNTRY_POLICY_AUTO
    };
    ESP_ERROR_CHECK(esp_wifi_set_country(&country));
    ESP_LOGI(TAG, "✅ WiFi country set to TH");

    // Register event handlers
    ESP_ERROR_CHECK(esp_event_handler_register(WIFI_EVENT, ESP_EVENT_ANY_ID, &wifi_event_handler, NULL));
    ESP_ERROR_CHECK(esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP, &wifi_event_handler, NULL));

    // Set WiFi mode to STA only initially (will switch to APSTA when needed)
    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    ESP_LOGI(TAG, "✅ WiFi mode set to STA");

    // Start WiFi
    ESP_ERROR_CHECK(esp_wifi_start());
    ESP_LOGI(TAG, "✅ WiFi started");

    ESP_LOGI(TAG, "✅ WiFi Manager initialized (STA mode), s_ap_active = %d", s_ap_active);
    return ESP_OK;
}

esp_err_t wifi_manager_add_credential(const char *ssid, const char *password)
{
    if (ssid == NULL || password == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    if (strlen(ssid) >= WIFI_SSID_MAX_LEN || strlen(password) >= WIFI_PASS_MAX_LEN) {
        return ESP_ERR_INVALID_ARG;
    }

    nvs_handle_t nvs_handle;
    esp_err_t err = nvs_open(WIFI_NVS_NAMESPACE, NVS_READWRITE, &nvs_handle);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to open NVS: %s", esp_err_to_name(err));
        return err;
    }

    // Get current count
    uint8_t count = 0;
    nvs_get_u8(nvs_handle, "count", &count);

    // Check if SSID already exists
    for (uint8_t i = 0; i < count; i++) {
        char key[16];
        snprintf(key, sizeof(key), "ssid_%d", i);

        char stored_ssid[WIFI_SSID_MAX_LEN];
        size_t len = sizeof(stored_ssid);
        if (nvs_get_str(nvs_handle, key, stored_ssid, &len) == ESP_OK) {
            if (strcmp(stored_ssid, ssid) == 0) {
                // Update password for existing SSID
                snprintf(key, sizeof(key), "pass_%d", i);
                err = nvs_set_str(nvs_handle, key, password);
                if (err == ESP_OK) {
                    err = nvs_commit(nvs_handle);
                    ESP_LOGI(TAG, "Updated credentials for SSID: %s", ssid);
                }
                nvs_close(nvs_handle);
                return err;
            }
        }
    }

    // Add new credential
    if (count >= WIFI_MAX_CREDENTIALS) {
        ESP_LOGW(TAG, "Maximum credentials reached");
        nvs_close(nvs_handle);
        return ESP_ERR_NO_MEM;
    }

    char key[16];
    snprintf(key, sizeof(key), "ssid_%d", count);
    err = nvs_set_str(nvs_handle, key, ssid);
    if (err != ESP_OK) goto cleanup;

    snprintf(key, sizeof(key), "pass_%d", count);
    err = nvs_set_str(nvs_handle, key, password);
    if (err != ESP_OK) goto cleanup;

    count++;
    err = nvs_set_u8(nvs_handle, "count", count);
    if (err != ESP_OK) goto cleanup;

    err = nvs_commit(nvs_handle);
    if (err == ESP_OK) {
        ESP_LOGI(TAG, "Added new WiFi credential: %s", ssid);
    }

cleanup:
    nvs_close(nvs_handle);
    return err;
}

esp_err_t wifi_manager_get_credentials(wifi_credential_t *credentials, size_t max_count, size_t *count)
{
    if (credentials == NULL || count == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    *count = 0;

    nvs_handle_t nvs_handle;
    esp_err_t err = nvs_open(WIFI_NVS_NAMESPACE, NVS_READONLY, &nvs_handle);
    if (err != ESP_OK) {
        return err;
    }

    uint8_t stored_count = 0;
    err = nvs_get_u8(nvs_handle, "count", &stored_count);
    if (err != ESP_OK) {
        nvs_close(nvs_handle);
        return err;
    }

    for (uint8_t i = 0; i < stored_count && i < max_count; i++) {
        char key[16];

        // Get SSID
        snprintf(key, sizeof(key), "ssid_%d", i);
        size_t len = WIFI_SSID_MAX_LEN;
        if (nvs_get_str(nvs_handle, key, credentials[i].ssid, &len) != ESP_OK) {
            continue;
        }

        // Get password
        snprintf(key, sizeof(key), "pass_%d", i);
        len = WIFI_PASS_MAX_LEN;
        if (nvs_get_str(nvs_handle, key, credentials[i].password, &len) != ESP_OK) {
            continue;
        }

        // Check if this is the active connection
        credentials[i].is_active = (strcmp(credentials[i].ssid, s_current_ssid) == 0 && s_is_connected);

        (*count)++;
    }

    nvs_close(nvs_handle);
    return ESP_OK;
}

esp_err_t wifi_manager_delete_credential(const char *ssid)
{
    if (ssid == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    nvs_handle_t nvs_handle;
    esp_err_t err = nvs_open(WIFI_NVS_NAMESPACE, NVS_READWRITE, &nvs_handle);
    if (err != ESP_OK) {
        return err;
    }

    uint8_t count = 0;
    nvs_get_u8(nvs_handle, "count", &count);

    // Find and delete the credential
    int found_idx = -1;
    for (uint8_t i = 0; i < count; i++) {
        char key[16];
        snprintf(key, sizeof(key), "ssid_%d", i);

        char stored_ssid[WIFI_SSID_MAX_LEN];
        size_t len = sizeof(stored_ssid);
        if (nvs_get_str(nvs_handle, key, stored_ssid, &len) == ESP_OK) {
            if (strcmp(stored_ssid, ssid) == 0) {
                found_idx = i;
                break;
            }
        }
    }

    if (found_idx == -1) {
        nvs_close(nvs_handle);
        return ESP_ERR_NOT_FOUND;
    }

    // Shift remaining credentials
    for (uint8_t i = found_idx; i < count - 1; i++) {
        char old_key[16], new_key[16];
        char buffer[WIFI_PASS_MAX_LEN];
        size_t len;

        // Shift SSID
        snprintf(old_key, sizeof(old_key), "ssid_%d", i + 1);
        snprintf(new_key, sizeof(new_key), "ssid_%d", i);
        len = sizeof(buffer);
        if (nvs_get_str(nvs_handle, old_key, buffer, &len) == ESP_OK) {
            nvs_set_str(nvs_handle, new_key, buffer);
        }

        // Shift password
        snprintf(old_key, sizeof(old_key), "pass_%d", i + 1);
        snprintf(new_key, sizeof(new_key), "pass_%d", i);
        len = sizeof(buffer);
        if (nvs_get_str(nvs_handle, old_key, buffer, &len) == ESP_OK) {
            nvs_set_str(nvs_handle, new_key, buffer);
        }
    }

    // Delete last entry
    char key[16];
    snprintf(key, sizeof(key), "ssid_%d", count - 1);
    nvs_erase_key(nvs_handle, key);
    snprintf(key, sizeof(key), "pass_%d", count - 1);
    nvs_erase_key(nvs_handle, key);

    // Update count
    count--;
    nvs_set_u8(nvs_handle, "count", count);

    err = nvs_commit(nvs_handle);
    nvs_close(nvs_handle);

    ESP_LOGI(TAG, "Deleted WiFi credential: %s", ssid);
    return err;
}

esp_err_t wifi_manager_connect(const char *ssid)
{
    if (ssid == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    // Find credentials
    wifi_credential_t credentials[WIFI_MAX_CREDENTIALS];
    size_t count;
    esp_err_t err = wifi_manager_get_credentials(credentials, WIFI_MAX_CREDENTIALS, &count);
    if (err != ESP_OK) {
        return err;
    }

    wifi_credential_t *cred = NULL;
    for (size_t i = 0; i < count; i++) {
        if (strcmp(credentials[i].ssid, ssid) == 0) {
            cred = &credentials[i];
            break;
        }
    }

    if (cred == NULL) {
        ESP_LOGE(TAG, "Credentials not found for SSID: %s", ssid);
        return ESP_ERR_NOT_FOUND;
    }

    // Configure WiFi Station
    wifi_config_t wifi_config = {0};
    strncpy((char *)wifi_config.sta.ssid, cred->ssid, sizeof(wifi_config.sta.ssid));
    strncpy((char *)wifi_config.sta.password, cred->password, sizeof(wifi_config.sta.password));
    wifi_config.sta.threshold.authmode = WIFI_AUTH_WPA2_PSK;

    // Don't change mode - keep APSTA mode
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_config));

    strncpy(s_current_ssid, ssid, sizeof(s_current_ssid));
    s_retry_num = 0;

    // Clear event bits before connecting
    xEventGroupClearBits(s_wifi_event_group, WIFI_CONNECTED_BIT | WIFI_FAIL_BIT);

    ESP_LOGI(TAG, "Connecting to WiFi SSID: %s", ssid);

    // Trigger connection
    esp_wifi_connect();

    // Wait for connection
    EventBits_t bits = xEventGroupWaitBits(s_wifi_event_group,
            WIFI_CONNECTED_BIT | WIFI_FAIL_BIT,
            pdFALSE,
            pdFALSE,
            pdMS_TO_TICKS(10000));

    if (bits & WIFI_CONNECTED_BIT) {
        ESP_LOGI(TAG, "Connected to AP SSID: %s", ssid);
        return ESP_OK;
    } else if (bits & WIFI_FAIL_BIT) {
        ESP_LOGI(TAG, "Failed to connect to SSID: %s", ssid);
        return ESP_FAIL;
    } else {
        ESP_LOGE(TAG, "Unexpected event");
        return ESP_FAIL;
    }
}

esp_err_t wifi_manager_scan(wifi_scan_result_t *results, size_t max_count, size_t *count)
{
    if (results == NULL || count == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    *count = 0;

    // Start WiFi scan
    wifi_scan_config_t scan_config = {
        .ssid = NULL,
        .bssid = NULL,
        .channel = 0,
        .show_hidden = false
    };

    esp_err_t err = esp_wifi_scan_start(&scan_config, true);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "WiFi scan failed: %s", esp_err_to_name(err));
        return err;
    }

    // Get scan results
    uint16_t ap_count = 0;
    esp_wifi_scan_get_ap_num(&ap_count);

    if (ap_count == 0) {
        return ESP_OK;
    }

    wifi_ap_record_t *ap_records = malloc(sizeof(wifi_ap_record_t) * ap_count);
    if (ap_records == NULL) {
        return ESP_ERR_NO_MEM;
    }

    err = esp_wifi_scan_get_ap_records(&ap_count, ap_records);
    if (err != ESP_OK) {
        free(ap_records);
        return err;
    }

    // Copy results
    for (uint16_t i = 0; i < ap_count && i < max_count; i++) {
        strncpy(results[i].ssid, (char *)ap_records[i].ssid, WIFI_SSID_MAX_LEN);
        results[i].rssi = ap_records[i].rssi;
        results[i].auth_mode = ap_records[i].authmode;
        (*count)++;
    }

    free(ap_records);
    ESP_LOGI(TAG, "WiFi scan completed, found %d networks", *count);

    return ESP_OK;
}

esp_err_t wifi_manager_get_status(wifi_status_t *status)
{
    if (status == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    memset(status, 0, sizeof(wifi_status_t));

    status->connected = s_is_connected;
    status->ap_active = s_ap_active;
    status->ap_clients = s_ap_client_count;

    // Determine current mode
    if (s_ap_active && s_is_connected) {
        status->mode = WIFI_MGR_MODE_APSTA;
    } else if (s_ap_active) {
        status->mode = WIFI_MGR_MODE_AP;
    } else if (s_is_connected) {
        status->mode = WIFI_MGR_MODE_STA;
    } else {
        status->mode = WIFI_MGR_MODE_NONE;
    }

    // Station mode info
    if (s_is_connected) {
        strncpy(status->ssid, s_current_ssid, WIFI_SSID_MAX_LEN);

        // Get IP address
        esp_netif_t *netif = esp_netif_get_handle_from_ifkey("WIFI_STA_DEF");
        if (netif != NULL) {
            esp_netif_ip_info_t ip_info;
            if (esp_netif_get_ip_info(netif, &ip_info) == ESP_OK) {
                status->ip[0] = esp_ip4_addr1_16(&ip_info.ip);
                status->ip[1] = esp_ip4_addr2_16(&ip_info.ip);
                status->ip[2] = esp_ip4_addr3_16(&ip_info.ip);
                status->ip[3] = esp_ip4_addr4_16(&ip_info.ip);
            }
        }

        // Get RSSI
        wifi_ap_record_t ap_info;
        if (esp_wifi_sta_get_ap_info(&ap_info) == ESP_OK) {
            status->rssi = ap_info.rssi;
        }
    }

    // AP mode info
    if (s_ap_active) {
        strncpy(status->ap_ssid, WIFI_AP_SSID, WIFI_SSID_MAX_LEN);

        // Get AP IP address (default is 192.168.4.1)
        esp_netif_t *ap_netif = esp_netif_get_handle_from_ifkey("WIFI_AP_DEF");
        if (ap_netif != NULL) {
            esp_netif_ip_info_t ip_info;
            if (esp_netif_get_ip_info(ap_netif, &ip_info) == ESP_OK) {
                status->ap_ip[0] = esp_ip4_addr1_16(&ip_info.ip);
                status->ap_ip[1] = esp_ip4_addr2_16(&ip_info.ip);
                status->ap_ip[2] = esp_ip4_addr3_16(&ip_info.ip);
                status->ap_ip[3] = esp_ip4_addr4_16(&ip_info.ip);
            }
        }
    }

    return ESP_OK;
}

esp_err_t wifi_manager_disconnect(void)
{
    s_is_connected = false;
    memset(s_current_ssid, 0, sizeof(s_current_ssid));

    esp_err_t err = esp_wifi_disconnect();
    if (err == ESP_OK) {
        ESP_LOGI(TAG, "Disconnected from WiFi");
    }

    return err;
}

esp_err_t wifi_manager_start_ap(void)
{
    printf("\n\n*** wifi_manager_start_ap() CALLED ***\n");
    printf("*** s_ap_active = %d ***\n\n", s_ap_active);

    ESP_LOGI(TAG, "🔧 wifi_manager_start_ap() called");
    ESP_LOGI(TAG, "   Current s_ap_active = %d", s_ap_active);

    if (s_ap_active) {
        printf("*** AP already active, forcing restart ***\n");
        ESP_LOGW(TAG, "⚠️  AP mode already active, forcing restart...");
        // Don't return - force restart to apply config
    }

    printf("*** Starting AP mode - SSID: %s ***\n", WIFI_AP_SSID);
    ESP_LOGI(TAG, "🔧 Starting AP mode - SSID: %s", WIFI_AP_SSID);

    esp_err_t err;

    // Get current WiFi mode
    wifi_mode_t current_mode;
    esp_wifi_get_mode(&current_mode);
    printf("*** Current WiFi mode: %d ***\n", current_mode);

    // Only stop WiFi if not already in APSTA mode
    bool need_restart = false;
    if (current_mode != WIFI_MODE_APSTA) {
        printf("*** Stopping WiFi to change mode... ***\n");
        err = esp_wifi_stop();
        printf("*** WiFi stop result: %s ***\n", esp_err_to_name(err));
        if (err != ESP_OK && err != ESP_ERR_WIFI_NOT_STARTED) {
            ESP_LOGE(TAG, "Failed to stop WiFi: %s", esp_err_to_name(err));
            return err;
        }
        vTaskDelay(pdMS_TO_TICKS(100));
        need_restart = true;
    }

    printf("*** Setting APSTA mode... ***\n");
    // Set WiFi mode to APSTA (AP + Station)
    err = esp_wifi_set_mode(WIFI_MODE_APSTA);
    printf("*** esp_wifi_set_mode result: %s ***\n", esp_err_to_name(err));
    if (err != ESP_OK) {
        printf("*** ERROR: Failed to set APSTA mode! ***\n");
        ESP_LOGE(TAG, "Failed to set APSTA mode: %s", esp_err_to_name(err));
        return err;
    }
    printf("*** APSTA mode set successfully ***\n");
    ESP_LOGI(TAG, "✅ WiFi mode set to APSTA");

    printf("*** Clearing STA config... ***\n");
    // Clear STA config first (we're in AP-only mode initially)
    wifi_config_t sta_config = {0};
    err = esp_wifi_set_config(WIFI_IF_STA, &sta_config);
    printf("*** STA config cleared: %s ***\n", esp_err_to_name(err));

    printf("*** Configuring AP... ***\n");
    // Configure AP with our custom SSID (iOS-compatible settings)
    wifi_config_t ap_config = {0};  // Zero initialize first
    memcpy(ap_config.ap.ssid, WIFI_AP_SSID, strlen(WIFI_AP_SSID));
    ap_config.ap.ssid_len = strlen(WIFI_AP_SSID);
    ap_config.ap.channel = WIFI_AP_CHANNEL;
    ap_config.ap.max_connection = WIFI_AP_MAX_CONNECTIONS;
    ap_config.ap.ssid_hidden = 0;           // MUST be visible for iOS
    ap_config.ap.beacon_interval = 100;     // Standard beacon interval
    ap_config.ap.pmf_cfg.required = false;  // PMF not required for compatibility
    ap_config.ap.pmf_cfg.capable = true;    // But capable for modern devices

    // iOS compatibility settings - CRITICAL for connection stability
    ap_config.ap.ftm_responder = false;     // Disable FTM for compatibility
    ap_config.ap.pairwise_cipher = WIFI_CIPHER_TYPE_CCMP;  // Use AES-CCMP for better compatibility

    printf("*** Setting password... ***\n");
    // Set password and auth mode
    if (strlen(WIFI_AP_PASS) == 0) {
        ap_config.ap.authmode = WIFI_AUTH_OPEN;
        printf("*** AP mode: OPEN (no password) ***\n");
        ESP_LOGI(TAG, "🔓 AP mode: OPEN (no password)");
    } else {
        memcpy(ap_config.ap.password, WIFI_AP_PASS, strlen(WIFI_AP_PASS));
        ap_config.ap.authmode = WIFI_AUTH_WPA_WPA2_PSK;
        printf("*** AP mode: WPA/WPA2-PSK ***\n");
        ESP_LOGI(TAG, "🔒 AP mode: WPA/WPA2-PSK with password");
    }

    printf("*** Calling esp_wifi_set_config... ***\n");
    err = esp_wifi_set_config(WIFI_IF_AP, &ap_config);
    printf("*** esp_wifi_set_config result: %s ***\n", esp_err_to_name(err));
    if (err != ESP_OK) {
        printf("*** ERROR: Failed to configure AP! ***\n");
        ESP_LOGE(TAG, "❌ Failed to configure AP: %s", esp_err_to_name(err));
        return err;
    }
    printf("*** AP config set successfully ***\n");
    ESP_LOGI(TAG, "✅ AP configuration set");

    // Configure DHCP server for AP mode BEFORE starting WiFi
    printf("*** Configuring DHCP server for AP... ***\n");
    if (s_ap_netif != NULL) {
        // Stop DHCP server first
        esp_netif_dhcps_stop(s_ap_netif);

        // Set IP address for AP (192.168.4.1)
        esp_netif_ip_info_t ip_info;
        IP4_ADDR(&ip_info.ip, 192, 168, 4, 1);
        IP4_ADDR(&ip_info.gw, 192, 168, 4, 1);
        IP4_ADDR(&ip_info.netmask, 255, 255, 255, 0);

        err = esp_netif_set_ip_info(s_ap_netif, &ip_info);
        if (err != ESP_OK) {
            ESP_LOGW(TAG, "⚠️  Failed to set AP IP: %s", esp_err_to_name(err));
        } else {
            printf("*** AP IP set to 192.168.4.1 ***\n");
            ESP_LOGI(TAG, "✅ AP IP address: 192.168.4.1");
        }

        // Set DNS server (CRITICAL for iOS - point to ourselves)
        esp_netif_dns_info_t dns_info;
        dns_info.ip.u_addr.ip4.addr = ip_info.ip.addr;  // DNS = 192.168.4.1 (ourselves)
        dns_info.ip.type = ESP_IPADDR_TYPE_V4;

        err = esp_netif_set_dns_info(s_ap_netif, ESP_NETIF_DNS_MAIN, &dns_info);
        if (err != ESP_OK) {
            ESP_LOGW(TAG, "⚠️  Failed to set DNS: %s", esp_err_to_name(err));
        } else {
            printf("*** DNS server set to 192.168.4.1 ***\n");
            ESP_LOGI(TAG, "✅ DNS server: 192.168.4.1");
        }

        // Configure DHCP to advertise DNS server
        uint32_t dns_server = ip_info.ip.addr;
        err = esp_netif_dhcps_option(s_ap_netif, ESP_NETIF_OP_SET, ESP_NETIF_DOMAIN_NAME_SERVER,
                                     &dns_server, sizeof(dns_server));
        if (err != ESP_OK) {
            ESP_LOGW(TAG, "⚠️  Failed to set DHCP DNS option: %s", esp_err_to_name(err));
        } else {
            printf("*** DHCP DNS option set ***\n");
            ESP_LOGI(TAG, "✅ DHCP will advertise DNS: 192.168.4.1");
        }

        // Start DHCP server (ESP-IDF v5.x uses default DHCP range automatically)
        err = esp_netif_dhcps_start(s_ap_netif);
        if (err != ESP_OK && err != ESP_ERR_ESP_NETIF_DHCP_ALREADY_STARTED) {
            ESP_LOGW(TAG, "⚠️  Failed to start DHCP server: %s", esp_err_to_name(err));
        } else {
            printf("*** DHCP server started successfully ***\n");
            ESP_LOGI(TAG, "✅ DHCP server started (range: 192.168.4.2 - 192.168.4.254)");
        }
    } else {
        ESP_LOGW(TAG, "⚠️  AP netif is NULL, cannot configure DHCP");
    }

    // Start WiFi only if we stopped it earlier
    if (need_restart) {
        printf("*** Starting WiFi... ***\n");
        err = esp_wifi_start();
        printf("*** esp_wifi_start result: %s ***\n", esp_err_to_name(err));
        if (err != ESP_OK) {
            printf("*** ERROR: Failed to start WiFi! ***\n");
            ESP_LOGE(TAG, "❌ Failed to start WiFi: %s", esp_err_to_name(err));
            return err;
        }
        printf("*** WiFi started successfully ***\n");
    } else {
        printf("*** WiFi already running, no restart needed ***\n");
        ESP_LOGI(TAG, "✅ WiFi already running");
    }

    // Set bandwidth to 20MHz AFTER WiFi start (per ESP-IDF documentation)
    printf("*** Setting AP bandwidth to 20MHz for iOS compatibility... ***\n");
    err = esp_wifi_set_bandwidth(WIFI_IF_AP, WIFI_BW_HT20);
    if (err != ESP_OK) {
        ESP_LOGW(TAG, "⚠️  Failed to set bandwidth: %s (continuing anyway)", esp_err_to_name(err));
    } else {
        printf("*** AP bandwidth set to 20MHz successfully ***\n");
        ESP_LOGI(TAG, "✅ AP bandwidth set to 20MHz");
    }

    printf("*** Waiting for WIFI_EVENT_AP_START event... ***\n");

    ESP_LOGI(TAG, "✅ WiFi started, waiting for AP to become active...");
    ESP_LOGI(TAG, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    ESP_LOGI(TAG, "  📡 AP SSID: %s", WIFI_AP_SSID);
    ESP_LOGI(TAG, "  🔑 Password: %s", strlen(WIFI_AP_PASS) == 0 ? "(none - Open WiFi)" : WIFI_AP_PASS);
    ESP_LOGI(TAG, "  📶 Channel: %d", WIFI_AP_CHANNEL);
    ESP_LOGI(TAG, "  🌐 IP Address: 192.168.4.1");
    ESP_LOGI(TAG, "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    printf("*** wifi_manager_start_ap() completed ***\n\n");
    return ESP_OK;
}

esp_err_t wifi_manager_stop_ap(void)
{
    if (!s_ap_active) {
        ESP_LOGW(TAG, "AP mode not active");
        return ESP_OK;
    }

    // Clear AP configuration
    wifi_config_t ap_config = {0};
    esp_err_t err = esp_wifi_set_config(WIFI_IF_AP, &ap_config);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to stop AP: %s", esp_err_to_name(err));
        return err;
    }

    s_ap_active = false;
    s_ap_client_count = 0;
    ESP_LOGI(TAG, "AP mode stopped");
    return ESP_OK;
}

bool wifi_manager_is_ap_active(void)
{
    return s_ap_active;
}

void wifi_manager_set_event_callback(wifi_event_callback_t callback)
{
    s_event_callback = callback;
}
