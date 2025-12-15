#ifndef MESH_STORAGE_H
#define MESH_STORAGE_H

#include <stdint.h>
#include <stdbool.h>
#include "esp_err.h"
#include "esp_ble_mesh_defs.h"

#ifdef __cplusplus
extern "C" {
#endif

// NVS namespace for BLE Mesh storage
#define MESH_NVS_NAMESPACE "ble_mesh"

// NVS keys
#define NVS_KEY_PROVISIONED     "provisioned"
#define NVS_KEY_NODE_ADDR       "node_addr"
#define NVS_KEY_NET_IDX         "net_idx"
#define NVS_KEY_APP_IDX         "app_idx"
#define NVS_KEY_NET_KEY         "net_key"
#define NVS_KEY_APP_KEY         "app_key"
#define NVS_KEY_DEV_KEY         "dev_key"
#define NVS_KEY_IV_INDEX        "iv_index"
#define NVS_KEY_MODEL_BOUND     "model_bound"
#define NVS_KEY_PUB_ADDR        "pub_addr"
#define NVS_KEY_PUB_APP_IDX     "pub_app_idx"
#define NVS_KEY_PUB_TTL         "pub_ttl"
#define NVS_KEY_PUB_PERIOD      "pub_period"

// Structure to store provisioning data
typedef struct {
    bool provisioned;
    uint16_t node_addr;
    uint16_t net_idx;
    uint16_t app_idx;
    uint8_t net_key[16];
    uint8_t app_key[16];
    uint8_t dev_key[16];
    uint32_t iv_index;
} mesh_prov_data_t;

// Structure to store model binding data
typedef struct {
    bool bound;
    uint16_t app_idx;
} mesh_model_binding_t;

// Structure to store publication settings
typedef struct {
    uint16_t publish_addr;
    uint16_t app_idx;
    uint8_t ttl;
    uint8_t period;
} mesh_pub_settings_t;

// Structure to store subscription addresses
#define MAX_SUBSCRIPTION_ADDRS 8
typedef struct {
    uint16_t sub_addrs[MAX_SUBSCRIPTION_ADDRS];
    uint8_t sub_count;
} mesh_subscription_t;

/**
 * @brief Initialize mesh storage (NVS)
 * 
 * @return ESP_OK on success
 */
esp_err_t mesh_storage_init(void);

/**
 * @brief Save provisioning data to NVS
 * 
 * @param prov_data Provisioning data to save
 * @return ESP_OK on success
 */
esp_err_t mesh_storage_save_prov_data(const mesh_prov_data_t *prov_data);

/**
 * @brief Load provisioning data from NVS
 * 
 * @param prov_data Buffer to store loaded data
 * @return ESP_OK on success, ESP_ERR_NOT_FOUND if not provisioned
 */
esp_err_t mesh_storage_load_prov_data(mesh_prov_data_t *prov_data);

/**
 * @brief Save model binding to NVS
 * 
 * @param model_id Model ID (e.g., "onoff_cli", "onoff_srv")
 * @param binding Binding data
 * @return ESP_OK on success
 */
esp_err_t mesh_storage_save_model_binding(const char *model_id, const mesh_model_binding_t *binding);

/**
 * @brief Load model binding from NVS
 * 
 * @param model_id Model ID
 * @param binding Buffer to store loaded binding
 * @return ESP_OK on success, ESP_ERR_NOT_FOUND if not bound
 */
esp_err_t mesh_storage_load_model_binding(const char *model_id, mesh_model_binding_t *binding);

/**
 * @brief Save publication settings to NVS
 * 
 * @param model_id Model ID
 * @param pub_settings Publication settings
 * @return ESP_OK on success
 */
esp_err_t mesh_storage_save_pub_settings(const char *model_id, const mesh_pub_settings_t *pub_settings);

/**
 * @brief Load publication settings from NVS
 *
 * @param model_id Model ID
 * @param pub_settings Buffer to store loaded settings
 * @return ESP_OK on success, ESP_ERR_NOT_FOUND if not configured
 */
esp_err_t mesh_storage_load_pub_settings(const char *model_id, mesh_pub_settings_t *pub_settings);

/**
 * @brief Save subscription addresses to NVS
 *
 * @param model_id Model ID
 * @param subscription Subscription data
 * @return ESP_OK on success
 */
esp_err_t mesh_storage_save_subscription(const char *model_id, const mesh_subscription_t *subscription);

/**
 * @brief Load subscription addresses from NVS
 *
 * @param model_id Model ID
 * @param subscription Buffer to store loaded subscriptions
 * @return ESP_OK on success, ESP_ERR_NOT_FOUND if no subscriptions
 */
esp_err_t mesh_storage_load_subscription(const char *model_id, mesh_subscription_t *subscription);

/**
 * @brief Add a subscription address to a model
 *
 * @param model_id Model ID
 * @param sub_addr Subscription address to add
 * @return ESP_OK on success
 */
esp_err_t mesh_storage_add_subscription(const char *model_id, uint16_t sub_addr);

/**
 * @brief Remove a subscription address from a model
 *
 * @param model_id Model ID
 * @param sub_addr Subscription address to remove
 * @return ESP_OK on success
 */
esp_err_t mesh_storage_remove_subscription(const char *model_id, uint16_t sub_addr);

/**
 * @brief Clear all mesh storage data (unprovision)
 *
 * @return ESP_OK on success
 */
esp_err_t mesh_storage_clear(void);

/**
 * @brief Check if device is provisioned
 * 
 * @return true if provisioned, false otherwise
 */
bool mesh_storage_is_provisioned(void);

#ifdef __cplusplus
}
#endif

#endif // MESH_STORAGE_H

