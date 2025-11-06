#ifndef DNS_SERVER_H
#define DNS_SERVER_H

#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Start DNS server for captive portal
 * 
 * This DNS server responds to all queries with the AP's IP address (192.168.4.1)
 * This is required for iOS captive portal detection
 * 
 * @return ESP_OK on success
 */
esp_err_t dns_server_start(void);

/**
 * @brief Stop DNS server
 * 
 * @return ESP_OK on success
 */
esp_err_t dns_server_stop(void);

#ifdef __cplusplus
}
#endif

#endif // DNS_SERVER_H

