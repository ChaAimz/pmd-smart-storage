#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include "esp_err.h"
#include "esp_wifi.h"
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

#define WIFI_MAX_CREDENTIALS 5
#define WIFI_SSID_MAX_LEN 32
#define WIFI_PASS_MAX_LEN 64

// AP Mode Configuration
#define WIFI_AP_SSID "Smart-Storage-Gateway"
#define WIFI_AP_PASS "12345678"  // iOS requires password (min 8 chars)
#define WIFI_AP_CHANNEL 6        // Channel 6 is most compatible with iOS
#define WIFI_AP_MAX_CONNECTIONS 4

/**
 * @brief WiFi credential structure
 */
typedef struct {
    char ssid[WIFI_SSID_MAX_LEN];
    char password[WIFI_PASS_MAX_LEN];
    bool is_active;  // Currently connected to this network
} wifi_credential_t;

/**
 * @brief WiFi scan result structure
 */
typedef struct {
    char ssid[WIFI_SSID_MAX_LEN];
    int8_t rssi;
    wifi_auth_mode_t auth_mode;
} wifi_scan_result_t;

/**
 * @brief WiFi manager mode enumeration
 */
typedef enum {
    WIFI_MGR_MODE_NONE = 0,
    WIFI_MGR_MODE_AP,       // Access Point mode only
    WIFI_MGR_MODE_STA,      // Station mode only
    WIFI_MGR_MODE_APSTA     // Both AP and Station mode
} wifi_manager_mode_t;

/**
 * @brief WiFi status structure
 */
typedef struct {
    bool connected;              // Station mode connected
    bool ap_active;              // AP mode active
    wifi_manager_mode_t mode;    // Current WiFi mode
    char ssid[WIFI_SSID_MAX_LEN]; // Connected SSID (Station mode)
    char ap_ssid[WIFI_SSID_MAX_LEN]; // AP SSID
    uint8_t ip[4];               // Station mode IP
    uint8_t ap_ip[4];            // AP mode IP
    int8_t rssi;                 // Station mode signal strength
    uint8_t ap_clients;          // Number of connected AP clients
} wifi_status_t;

/**
 * @brief Initialize WiFi manager
 * 
 * @return ESP_OK on success
 */
esp_err_t wifi_manager_init(void);

/**
 * @brief Add new WiFi credentials
 * 
 * @param ssid WiFi SSID
 * @param password WiFi password
 * @return ESP_OK on success
 */
esp_err_t wifi_manager_add_credential(const char *ssid, const char *password);

/**
 * @brief Get list of saved WiFi credentials
 * 
 * @param credentials Array to store credentials
 * @param max_count Maximum number of credentials to retrieve
 * @param count Actual number of credentials retrieved
 * @return ESP_OK on success
 */
esp_err_t wifi_manager_get_credentials(wifi_credential_t *credentials, size_t max_count, size_t *count);

/**
 * @brief Delete WiFi credentials by SSID
 * 
 * @param ssid WiFi SSID to delete
 * @return ESP_OK on success
 */
esp_err_t wifi_manager_delete_credential(const char *ssid);

/**
 * @brief Connect to a saved WiFi network
 * 
 * @param ssid WiFi SSID to connect to
 * @return ESP_OK on success
 */
esp_err_t wifi_manager_connect(const char *ssid);

/**
 * @brief Scan for available WiFi networks
 * 
 * @param results Array to store scan results
 * @param max_count Maximum number of results to retrieve
 * @param count Actual number of results retrieved
 * @return ESP_OK on success
 */
esp_err_t wifi_manager_scan(wifi_scan_result_t *results, size_t max_count, size_t *count);

/**
 * @brief Get current WiFi status
 * 
 * @param status Pointer to status structure
 * @return ESP_OK on success
 */
esp_err_t wifi_manager_get_status(wifi_status_t *status);

/**
 * @brief Disconnect from current WiFi network
 *
 * @return ESP_OK on success
 */
esp_err_t wifi_manager_disconnect(void);

/**
 * @brief Start AP mode
 *
 * @return ESP_OK on success
 */
esp_err_t wifi_manager_start_ap(void);

/**
 * @brief Stop AP mode
 *
 * @return ESP_OK on success
 */
esp_err_t wifi_manager_stop_ap(void);

/**
 * @brief Check if AP mode is active
 *
 * @return true if AP mode is active
 */
bool wifi_manager_is_ap_active(void);

/**
 * @brief Set callback for WiFi connection events
 *
 * @param callback Function to call when WiFi connects/disconnects
 */
typedef void (*wifi_event_callback_t)(bool connected);
void wifi_manager_set_event_callback(wifi_event_callback_t callback);

#ifdef __cplusplus
}
#endif

#endif // WIFI_MANAGER_H

