#ifndef WEB_SERVER_H
#define WEB_SERVER_H

#include "esp_err.h"
#include "esp_http_server.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Start the web server
 * 
 * @return ESP_OK on success
 */
esp_err_t web_server_start(void);

/**
 * @brief Stop the web server
 * 
 * @return ESP_OK on success
 */
esp_err_t web_server_stop(void);

#ifdef __cplusplus
}
#endif

#endif // WEB_SERVER_H

