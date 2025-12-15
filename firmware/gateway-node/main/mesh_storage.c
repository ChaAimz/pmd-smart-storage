#include "mesh_storage.h"
#include "nvs_flash.h"
#include "nvs.h"
#include "esp_log.h"
#include <string.h>

static const char *TAG = "MESH_STORAGE";

esp_err_t mesh_storage_init(void)
{
    esp_err_t err = nvs_flash_init();
    if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_LOGW(TAG, "NVS partition was truncated, erasing...");
        ESP_ERROR_CHECK(nvs_flash_erase());
        err = nvs_flash_init();
    }
    
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to initialize NVS: %s", esp_err_to_name(err));
        return err;
    }
    
    ESP_LOGI(TAG, "Mesh storage initialized");
    return ESP_OK;
}

esp_err_t mesh_storage_save_prov_data(const mesh_prov_data_t *prov_data)
{
    if (prov_data == NULL) {
        return ESP_ERR_INVALID_ARG;
    }
    
    nvs_handle_t nvs_handle;
    esp_err_t err = nvs_open(MESH_NVS_NAMESPACE, NVS_READWRITE, &nvs_handle);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to open NVS: %s", esp_err_to_name(err));
        return err;
    }
    
    // Save provisioned flag
    err = nvs_set_u8(nvs_handle, NVS_KEY_PROVISIONED, prov_data->provisioned ? 1 : 0);
    if (err != ESP_OK) goto cleanup;
    
    // Save node address
    err = nvs_set_u16(nvs_handle, NVS_KEY_NODE_ADDR, prov_data->node_addr);
    if (err != ESP_OK) goto cleanup;
    
    // Save network index
    err = nvs_set_u16(nvs_handle, NVS_KEY_NET_IDX, prov_data->net_idx);
    if (err != ESP_OK) goto cleanup;
    
    // Save app index
    err = nvs_set_u16(nvs_handle, NVS_KEY_APP_IDX, prov_data->app_idx);
    if (err != ESP_OK) goto cleanup;
    
    // Save network key
    err = nvs_set_blob(nvs_handle, NVS_KEY_NET_KEY, prov_data->net_key, 16);
    if (err != ESP_OK) goto cleanup;
    
    // Save app key
    err = nvs_set_blob(nvs_handle, NVS_KEY_APP_KEY, prov_data->app_key, 16);
    if (err != ESP_OK) goto cleanup;
    
    // Save device key
    err = nvs_set_blob(nvs_handle, NVS_KEY_DEV_KEY, prov_data->dev_key, 16);
    if (err != ESP_OK) goto cleanup;
    
    // Save IV index
    err = nvs_set_u32(nvs_handle, NVS_KEY_IV_INDEX, prov_data->iv_index);
    if (err != ESP_OK) goto cleanup;
    
    // Commit changes
    err = nvs_commit(nvs_handle);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to commit NVS: %s", esp_err_to_name(err));
        goto cleanup;
    }

    // Print detailed save information
    printf("\n========================================\n");
    printf("📝 PROVISIONING DATA SAVED TO NVS\n");
    printf("========================================\n");
    printf("  Provisioned:    %s\n", prov_data->provisioned ? "YES" : "NO");
    printf("  Node Address:   0x%04X\n", prov_data->node_addr);
    printf("  Net Index:      0x%04X\n", prov_data->net_idx);
    printf("  App Index:      0x%04X\n", prov_data->app_idx);
    printf("  IV Index:       0x%08lX\n", (unsigned long)prov_data->iv_index);
    printf("  NetKey (16B):   ");
    for (int i = 0; i < 16; i++) printf("%02X", prov_data->net_key[i]);
    printf("\n");
    printf("  AppKey (16B):   ");
    for (int i = 0; i < 16; i++) printf("%02X", prov_data->app_key[i]);
    printf("\n");
    printf("  DevKey (16B):   ");
    for (int i = 0; i < 16; i++) printf("%02X", prov_data->dev_key[i]);
    printf("\n");
    printf("========================================\n\n");

cleanup:
    nvs_close(nvs_handle);
    return err;
}

esp_err_t mesh_storage_load_prov_data(mesh_prov_data_t *prov_data)
{
    if (prov_data == NULL) {
        return ESP_ERR_INVALID_ARG;
    }
    
    memset(prov_data, 0, sizeof(mesh_prov_data_t));
    
    nvs_handle_t nvs_handle;
    esp_err_t err = nvs_open(MESH_NVS_NAMESPACE, NVS_READONLY, &nvs_handle);
    if (err != ESP_OK) {
        printf("⚠️  Failed to open NVS namespace '%s': %s\n", MESH_NVS_NAMESPACE, esp_err_to_name(err));
        return err;
    }

    // Load provisioned flag
    uint8_t provisioned = 0;
    err = nvs_get_u8(nvs_handle, NVS_KEY_PROVISIONED, &provisioned);
    if (err != ESP_OK || provisioned == 0) {
        printf("ℹ️  NVS key '%s' not found or = 0 (err: %s)\n", NVS_KEY_PROVISIONED, esp_err_to_name(err));
        nvs_close(nvs_handle);
        return ESP_ERR_NOT_FOUND;
    }
    prov_data->provisioned = true;
    
    // Load node address
    err = nvs_get_u16(nvs_handle, NVS_KEY_NODE_ADDR, &prov_data->node_addr);
    if (err != ESP_OK) goto cleanup;
    
    // Load network index
    err = nvs_get_u16(nvs_handle, NVS_KEY_NET_IDX, &prov_data->net_idx);
    if (err != ESP_OK) goto cleanup;
    
    // Load app index
    err = nvs_get_u16(nvs_handle, NVS_KEY_APP_IDX, &prov_data->app_idx);
    if (err != ESP_OK) goto cleanup;
    
    // Load network key
    size_t key_len = 16;
    err = nvs_get_blob(nvs_handle, NVS_KEY_NET_KEY, prov_data->net_key, &key_len);
    if (err != ESP_OK) goto cleanup;
    
    // Load app key
    key_len = 16;
    err = nvs_get_blob(nvs_handle, NVS_KEY_APP_KEY, prov_data->app_key, &key_len);
    if (err != ESP_OK) goto cleanup;
    
    // Load device key
    key_len = 16;
    err = nvs_get_blob(nvs_handle, NVS_KEY_DEV_KEY, prov_data->dev_key, &key_len);
    if (err != ESP_OK) goto cleanup;
    
    // Load IV index
    err = nvs_get_u32(nvs_handle, NVS_KEY_IV_INDEX, &prov_data->iv_index);
    if (err != ESP_OK) goto cleanup;

    // Print detailed load information
    printf("\n========================================\n");
    printf("📂 PROVISIONING DATA LOADED FROM NVS\n");
    printf("========================================\n");
    printf("  Provisioned:    %s\n", prov_data->provisioned ? "YES" : "NO");
    printf("  Node Address:   0x%04X\n", prov_data->node_addr);
    printf("  Net Index:      0x%04X\n", prov_data->net_idx);
    printf("  App Index:      0x%04X\n", prov_data->app_idx);
    printf("  IV Index:       0x%08lX\n", (unsigned long)prov_data->iv_index);
    printf("  NetKey (16B):   ");
    for (int i = 0; i < 16; i++) printf("%02X", prov_data->net_key[i]);
    printf("\n");
    printf("  AppKey (16B):   ");
    for (int i = 0; i < 16; i++) printf("%02X", prov_data->app_key[i]);
    printf("\n");
    printf("  DevKey (16B):   ");
    for (int i = 0; i < 16; i++) printf("%02X", prov_data->dev_key[i]);
    printf("\n");
    printf("========================================\n\n");

cleanup:
    nvs_close(nvs_handle);
    return err;
}

esp_err_t mesh_storage_save_model_binding(const char *model_id, const mesh_model_binding_t *binding)
{
    if (model_id == NULL || binding == NULL) {
        return ESP_ERR_INVALID_ARG;
    }
    
    nvs_handle_t nvs_handle;
    esp_err_t err = nvs_open(MESH_NVS_NAMESPACE, NVS_READWRITE, &nvs_handle);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to open NVS: %s", esp_err_to_name(err));
        return err;
    }
    
    // Create keys for this model
    char bound_key[32];
    char app_idx_key[32];
    snprintf(bound_key, sizeof(bound_key), "%s_bound", model_id);
    snprintf(app_idx_key, sizeof(app_idx_key), "%s_app_idx", model_id);
    
    // Save binding data
    err = nvs_set_u8(nvs_handle, bound_key, binding->bound ? 1 : 0);
    if (err != ESP_OK) goto cleanup;
    
    err = nvs_set_u16(nvs_handle, app_idx_key, binding->app_idx);
    if (err != ESP_OK) goto cleanup;
    
    err = nvs_commit(nvs_handle);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to commit NVS: %s", esp_err_to_name(err));
        goto cleanup;
    }

    ESP_LOGI(TAG, "📝 Model Binding Saved: %s", model_id);
    ESP_LOGI(TAG, "   Bound:      %s", binding->bound ? "YES" : "NO");
    ESP_LOGI(TAG, "   App Index:  0x%04X", binding->app_idx);

cleanup:
    nvs_close(nvs_handle);
    return err;
}

esp_err_t mesh_storage_load_model_binding(const char *model_id, mesh_model_binding_t *binding)
{
    if (model_id == NULL || binding == NULL) {
        return ESP_ERR_INVALID_ARG;
    }
    
    memset(binding, 0, sizeof(mesh_model_binding_t));
    
    nvs_handle_t nvs_handle;
    esp_err_t err = nvs_open(MESH_NVS_NAMESPACE, NVS_READONLY, &nvs_handle);
    if (err != ESP_OK) {
        return err;
    }
    
    // Create keys for this model
    char bound_key[32];
    char app_idx_key[32];
    snprintf(bound_key, sizeof(bound_key), "%s_bound", model_id);
    snprintf(app_idx_key, sizeof(app_idx_key), "%s_app_idx", model_id);
    
    // Load binding data
    uint8_t bound = 0;
    err = nvs_get_u8(nvs_handle, bound_key, &bound);
    if (err != ESP_OK || bound == 0) {
        nvs_close(nvs_handle);
        return ESP_ERR_NOT_FOUND;
    }
    binding->bound = true;
    
    err = nvs_get_u16(nvs_handle, app_idx_key, &binding->app_idx);
    if (err != ESP_OK) {
        nvs_close(nvs_handle);
        return err;
    }

    ESP_LOGI(TAG, "📂 Model Binding Loaded: %s", model_id);
    ESP_LOGI(TAG, "   Bound:      %s", binding->bound ? "YES" : "NO");
    ESP_LOGI(TAG, "   App Index:  0x%04X", binding->app_idx);

    nvs_close(nvs_handle);
    return ESP_OK;
}

esp_err_t mesh_storage_save_pub_settings(const char *model_id, const mesh_pub_settings_t *pub_settings)
{
    if (model_id == NULL || pub_settings == NULL) {
        return ESP_ERR_INVALID_ARG;
    }
    
    nvs_handle_t nvs_handle;
    esp_err_t err = nvs_open(MESH_NVS_NAMESPACE, NVS_READWRITE, &nvs_handle);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to open NVS: %s", esp_err_to_name(err));
        return err;
    }
    
    // Create keys for this model
    char pub_addr_key[32];
    char pub_app_idx_key[32];
    char pub_ttl_key[32];
    char pub_period_key[32];
    snprintf(pub_addr_key, sizeof(pub_addr_key), "%s_pub_addr", model_id);
    snprintf(pub_app_idx_key, sizeof(pub_app_idx_key), "%s_pub_app", model_id);
    snprintf(pub_ttl_key, sizeof(pub_ttl_key), "%s_pub_ttl", model_id);
    snprintf(pub_period_key, sizeof(pub_period_key), "%s_pub_per", model_id);
    
    // Save publication settings
    err = nvs_set_u16(nvs_handle, pub_addr_key, pub_settings->publish_addr);
    if (err != ESP_OK) goto cleanup;
    
    err = nvs_set_u16(nvs_handle, pub_app_idx_key, pub_settings->app_idx);
    if (err != ESP_OK) goto cleanup;
    
    err = nvs_set_u8(nvs_handle, pub_ttl_key, pub_settings->ttl);
    if (err != ESP_OK) goto cleanup;
    
    err = nvs_set_u8(nvs_handle, pub_period_key, pub_settings->period);
    if (err != ESP_OK) goto cleanup;
    
    err = nvs_commit(nvs_handle);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to commit NVS: %s", esp_err_to_name(err));
        goto cleanup;
    }

    ESP_LOGI(TAG, "📝 Publication Settings Saved: %s", model_id);
    ESP_LOGI(TAG, "   Publish Addr:  0x%04X", pub_settings->publish_addr);
    ESP_LOGI(TAG, "   App Index:     0x%04X", pub_settings->app_idx);
    ESP_LOGI(TAG, "   TTL:           %d", pub_settings->ttl);
    ESP_LOGI(TAG, "   Period:        %d", pub_settings->period);

cleanup:
    nvs_close(nvs_handle);
    return err;
}

esp_err_t mesh_storage_load_pub_settings(const char *model_id, mesh_pub_settings_t *pub_settings)
{
    if (model_id == NULL || pub_settings == NULL) {
        return ESP_ERR_INVALID_ARG;
    }
    
    memset(pub_settings, 0, sizeof(mesh_pub_settings_t));
    
    nvs_handle_t nvs_handle;
    esp_err_t err = nvs_open(MESH_NVS_NAMESPACE, NVS_READONLY, &nvs_handle);
    if (err != ESP_OK) {
        return err;
    }
    
    // Create keys for this model
    char pub_addr_key[32];
    char pub_app_idx_key[32];
    char pub_ttl_key[32];
    char pub_period_key[32];
    snprintf(pub_addr_key, sizeof(pub_addr_key), "%s_pub_addr", model_id);
    snprintf(pub_app_idx_key, sizeof(pub_app_idx_key), "%s_pub_app", model_id);
    snprintf(pub_ttl_key, sizeof(pub_ttl_key), "%s_pub_ttl", model_id);
    snprintf(pub_period_key, sizeof(pub_period_key), "%s_pub_per", model_id);
    
    // Load publication settings
    err = nvs_get_u16(nvs_handle, pub_addr_key, &pub_settings->publish_addr);
    if (err != ESP_OK) goto cleanup;
    
    err = nvs_get_u16(nvs_handle, pub_app_idx_key, &pub_settings->app_idx);
    if (err != ESP_OK) goto cleanup;
    
    err = nvs_get_u8(nvs_handle, pub_ttl_key, &pub_settings->ttl);
    if (err != ESP_OK) goto cleanup;
    
    err = nvs_get_u8(nvs_handle, pub_period_key, &pub_settings->period);
    if (err != ESP_OK) goto cleanup;

    ESP_LOGI(TAG, "📂 Publication Settings Loaded: %s", model_id);
    ESP_LOGI(TAG, "   Publish Addr:  0x%04X", pub_settings->publish_addr);
    ESP_LOGI(TAG, "   App Index:     0x%04X", pub_settings->app_idx);
    ESP_LOGI(TAG, "   TTL:           %d", pub_settings->ttl);
    ESP_LOGI(TAG, "   Period:        %d", pub_settings->period);

cleanup:
    nvs_close(nvs_handle);
    return err;
}

esp_err_t mesh_storage_save_subscription(const char *model_id, const mesh_subscription_t *subscription)
{
    if (model_id == NULL || subscription == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    nvs_handle_t nvs_handle;
    esp_err_t err = nvs_open(MESH_NVS_NAMESPACE, NVS_READWRITE, &nvs_handle);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to open NVS: %s", esp_err_to_name(err));
        return err;
    }

    // Create keys for this model
    char sub_count_key[32];
    char sub_addrs_key[32];
    snprintf(sub_count_key, sizeof(sub_count_key), "%s_sub_cnt", model_id);
    snprintf(sub_addrs_key, sizeof(sub_addrs_key), "%s_sub_addrs", model_id);

    // Save subscription count
    err = nvs_set_u8(nvs_handle, sub_count_key, subscription->sub_count);
    if (err != ESP_OK) goto cleanup;

    // Save subscription addresses (as blob)
    if (subscription->sub_count > 0) {
        err = nvs_set_blob(nvs_handle, sub_addrs_key, subscription->sub_addrs,
                          subscription->sub_count * sizeof(uint16_t));
        if (err != ESP_OK) goto cleanup;
    }

    err = nvs_commit(nvs_handle);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to commit NVS: %s", esp_err_to_name(err));
        goto cleanup;
    }

    ESP_LOGI(TAG, "📝 Subscription Saved: %s", model_id);
    ESP_LOGI(TAG, "   Count: %d", subscription->sub_count);
    for (int i = 0; i < subscription->sub_count; i++) {
        ESP_LOGI(TAG, "   [%d] 0x%04X", i, subscription->sub_addrs[i]);
    }

cleanup:
    nvs_close(nvs_handle);
    return err;
}

esp_err_t mesh_storage_load_subscription(const char *model_id, mesh_subscription_t *subscription)
{
    if (model_id == NULL || subscription == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    memset(subscription, 0, sizeof(mesh_subscription_t));

    nvs_handle_t nvs_handle;
    esp_err_t err = nvs_open(MESH_NVS_NAMESPACE, NVS_READONLY, &nvs_handle);
    if (err != ESP_OK) {
        return err;
    }

    // Create keys for this model
    char sub_count_key[32];
    char sub_addrs_key[32];
    snprintf(sub_count_key, sizeof(sub_count_key), "%s_sub_cnt", model_id);
    snprintf(sub_addrs_key, sizeof(sub_addrs_key), "%s_sub_addrs", model_id);

    // Load subscription count
    uint8_t count = 0;
    err = nvs_get_u8(nvs_handle, sub_count_key, &count);
    if (err != ESP_OK || count == 0) {
        nvs_close(nvs_handle);
        return ESP_ERR_NOT_FOUND;
    }
    subscription->sub_count = count;

    // Load subscription addresses
    size_t blob_len = count * sizeof(uint16_t);
    err = nvs_get_blob(nvs_handle, sub_addrs_key, subscription->sub_addrs, &blob_len);
    if (err != ESP_OK) {
        nvs_close(nvs_handle);
        return err;
    }

    ESP_LOGI(TAG, "📂 Subscription Loaded: %s", model_id);
    ESP_LOGI(TAG, "   Count: %d", subscription->sub_count);
    for (int i = 0; i < subscription->sub_count; i++) {
        ESP_LOGI(TAG, "   [%d] 0x%04X", i, subscription->sub_addrs[i]);
    }

    nvs_close(nvs_handle);
    return ESP_OK;
}

esp_err_t mesh_storage_add_subscription(const char *model_id, uint16_t sub_addr)
{
    if (model_id == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    // Load existing subscriptions
    mesh_subscription_t subscription;
    esp_err_t err = mesh_storage_load_subscription(model_id, &subscription);
    if (err == ESP_ERR_NOT_FOUND) {
        // No existing subscriptions, create new
        memset(&subscription, 0, sizeof(mesh_subscription_t));
    } else if (err != ESP_OK) {
        return err;
    }

    // Check if already subscribed
    for (int i = 0; i < subscription.sub_count; i++) {
        if (subscription.sub_addrs[i] == sub_addr) {
            ESP_LOGW(TAG, "Already subscribed to 0x%04X", sub_addr);
            return ESP_OK;
        }
    }

    // Check if we have space
    if (subscription.sub_count >= MAX_SUBSCRIPTION_ADDRS) {
        ESP_LOGE(TAG, "Maximum subscription addresses reached (%d)", MAX_SUBSCRIPTION_ADDRS);
        return ESP_ERR_NO_MEM;
    }

    // Add new subscription
    subscription.sub_addrs[subscription.sub_count] = sub_addr;
    subscription.sub_count++;

    return mesh_storage_save_subscription(model_id, &subscription);
}

esp_err_t mesh_storage_remove_subscription(const char *model_id, uint16_t sub_addr)
{
    if (model_id == NULL) {
        return ESP_ERR_INVALID_ARG;
    }

    // Load existing subscriptions
    mesh_subscription_t subscription;
    esp_err_t err = mesh_storage_load_subscription(model_id, &subscription);
    if (err != ESP_OK) {
        return err;
    }

    // Find and remove the subscription
    bool found = false;
    for (int i = 0; i < subscription.sub_count; i++) {
        if (subscription.sub_addrs[i] == sub_addr) {
            // Shift remaining addresses
            for (int j = i; j < subscription.sub_count - 1; j++) {
                subscription.sub_addrs[j] = subscription.sub_addrs[j + 1];
            }
            subscription.sub_count--;
            found = true;
            break;
        }
    }

    if (!found) {
        ESP_LOGW(TAG, "Subscription 0x%04X not found", sub_addr);
        return ESP_ERR_NOT_FOUND;
    }

    return mesh_storage_save_subscription(model_id, &subscription);
}

esp_err_t mesh_storage_clear(void)
{
    nvs_handle_t nvs_handle;
    esp_err_t err = nvs_open(MESH_NVS_NAMESPACE, NVS_READWRITE, &nvs_handle);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to open NVS: %s", esp_err_to_name(err));
        return err;
    }
    
    err = nvs_erase_all(nvs_handle);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Failed to erase NVS: %s", esp_err_to_name(err));
        nvs_close(nvs_handle);
        return err;
    }
    
    err = nvs_commit(nvs_handle);
    nvs_close(nvs_handle);
    
    ESP_LOGI(TAG, "Mesh storage cleared");
    return err;
}

bool mesh_storage_is_provisioned(void)
{
    nvs_handle_t nvs_handle;
    esp_err_t err = nvs_open(MESH_NVS_NAMESPACE, NVS_READONLY, &nvs_handle);
    if (err != ESP_OK) {
        return false;
    }
    
    uint8_t provisioned = 0;
    err = nvs_get_u8(nvs_handle, NVS_KEY_PROVISIONED, &provisioned);
    nvs_close(nvs_handle);
    
    return (err == ESP_OK && provisioned == 1);
}

