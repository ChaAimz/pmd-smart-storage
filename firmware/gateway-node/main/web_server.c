#include "web_server.h"
#include "wifi_manager.h"
#include "mesh_storage.h"
#include "esp_log.h"
#include "esp_http_server.h"
#include "esp_system.h"
#include "cJSON.h"
#include <string.h>

static const char *TAG = "WEB_SERVER";
static httpd_handle_t server = NULL;

// Forward declarations
static esp_err_t root_handler(httpd_req_t *req);
static esp_err_t wifi_status_handler(httpd_req_t *req);
static esp_err_t wifi_scan_handler(httpd_req_t *req);
static esp_err_t wifi_list_handler(httpd_req_t *req);
static esp_err_t wifi_add_handler(httpd_req_t *req);
static esp_err_t wifi_connect_handler(httpd_req_t *req);
static esp_err_t wifi_delete_handler(httpd_req_t *req);
static esp_err_t wifi_disconnect_handler(httpd_req_t *req);
static esp_err_t mesh_status_handler(httpd_req_t *req);
static esp_err_t mesh_reset_handler(httpd_req_t *req);

// Helper function to convert bytes to hex string
static void bytes_to_hex(const uint8_t *bytes, size_t len, char *hex_str, size_t hex_str_len)
{
    char *ptr = hex_str;
    for (size_t i = 0; i < len && (ptr - hex_str) < (hex_str_len - 3); i++) {
        ptr += snprintf(ptr, hex_str_len - (ptr - hex_str), "%02X ", bytes[i]);
    }
    if (ptr > hex_str && *(ptr - 1) == ' ') {
        *(ptr - 1) = '\0'; // Remove trailing space
    }
}

// Root handler - serve HTML page
static esp_err_t root_handler(httpd_req_t *req)
{
    extern const char html_start[] asm("_binary_index_html_start");
    extern const char html_end[] asm("_binary_index_html_end");
    const size_t html_size = (html_end - html_start);

    httpd_resp_set_type(req, "text/html");
    httpd_resp_send(req, html_start, html_size);
    return ESP_OK;
}

// WiFi status handler
static esp_err_t wifi_status_handler(httpd_req_t *req)
{
    wifi_status_t status;
    wifi_manager_get_status(&status);

    cJSON *root = cJSON_CreateObject();

    // Station mode status
    cJSON_AddBoolToObject(root, "connected", status.connected);
    if (status.connected) {
        cJSON_AddStringToObject(root, "ssid", status.ssid);
        char ip_str[16];
        snprintf(ip_str, sizeof(ip_str), "%d.%d.%d.%d",
                 status.ip[0], status.ip[1], status.ip[2], status.ip[3]);
        cJSON_AddStringToObject(root, "ip", ip_str);
        cJSON_AddNumberToObject(root, "rssi", status.rssi);
    }

    // AP mode status
    cJSON_AddBoolToObject(root, "ap_active", status.ap_active);
    if (status.ap_active) {
        cJSON_AddStringToObject(root, "ap_ssid", status.ap_ssid);
        char ap_ip_str[16];
        snprintf(ap_ip_str, sizeof(ap_ip_str), "%d.%d.%d.%d",
                 status.ap_ip[0], status.ap_ip[1], status.ap_ip[2], status.ap_ip[3]);
        cJSON_AddStringToObject(root, "ap_ip", ap_ip_str);
        cJSON_AddNumberToObject(root, "ap_clients", status.ap_clients);
    }

    // Current mode
    const char *mode_str = "None";
    if (status.mode == WIFI_MGR_MODE_AP) mode_str = "AP";
    else if (status.mode == WIFI_MGR_MODE_STA) mode_str = "Station";
    else if (status.mode == WIFI_MGR_MODE_APSTA) mode_str = "AP+Station";
    cJSON_AddStringToObject(root, "mode", mode_str);

    const char *json_str = cJSON_Print(root);
    httpd_resp_set_type(req, "application/json");
    httpd_resp_send(req, json_str, HTTPD_RESP_USE_STRLEN);

    free((void *)json_str);
    cJSON_Delete(root);
    return ESP_OK;
}

// WiFi scan handler
static esp_err_t wifi_scan_handler(httpd_req_t *req)
{
    wifi_scan_result_t results[20];
    size_t count = 0;

    wifi_manager_scan(results, 20, &count);

    cJSON *root = cJSON_CreateObject();
    cJSON *networks = cJSON_CreateArray();

    for (size_t i = 0; i < count; i++) {
        cJSON *network = cJSON_CreateObject();
        cJSON_AddStringToObject(network, "ssid", results[i].ssid);
        cJSON_AddNumberToObject(network, "rssi", results[i].rssi);

        const char *auth_str = "Open";
        if (results[i].auth_mode == WIFI_AUTH_WPA2_PSK) auth_str = "WPA2";
        else if (results[i].auth_mode == WIFI_AUTH_WPA_WPA2_PSK) auth_str = "WPA/WPA2";
        else if (results[i].auth_mode == WIFI_AUTH_WPA3_PSK) auth_str = "WPA3";

        cJSON_AddStringToObject(network, "auth", auth_str);
        cJSON_AddItemToArray(networks, network);
    }

    cJSON_AddItemToObject(root, "networks", networks);

    const char *json_str = cJSON_Print(root);
    httpd_resp_set_type(req, "application/json");
    httpd_resp_send(req, json_str, HTTPD_RESP_USE_STRLEN);

    free((void *)json_str);
    cJSON_Delete(root);
    return ESP_OK;
}

// WiFi list handler
static esp_err_t wifi_list_handler(httpd_req_t *req)
{
    wifi_credential_t credentials[WIFI_MAX_CREDENTIALS];
    size_t count = 0;

    wifi_manager_get_credentials(credentials, WIFI_MAX_CREDENTIALS, &count);

    cJSON *root = cJSON_CreateObject();
    cJSON *networks = cJSON_CreateArray();

    for (size_t i = 0; i < count; i++) {
        cJSON *network = cJSON_CreateObject();
        cJSON_AddStringToObject(network, "ssid", credentials[i].ssid);
        cJSON_AddBoolToObject(network, "active", credentials[i].is_active);
        cJSON_AddItemToArray(networks, network);
    }

    cJSON_AddItemToObject(root, "networks", networks);

    const char *json_str = cJSON_Print(root);
    httpd_resp_set_type(req, "application/json");
    httpd_resp_send(req, json_str, HTTPD_RESP_USE_STRLEN);

    free((void *)json_str);
    cJSON_Delete(root);
    return ESP_OK;
}

// WiFi add handler
static esp_err_t wifi_add_handler(httpd_req_t *req)
{
    char buf[200];
    int ret = httpd_req_recv(req, buf, sizeof(buf) - 1);
    if (ret <= 0) {
        httpd_resp_send_err(req, HTTPD_400_BAD_REQUEST, "Invalid request");
        return ESP_FAIL;
    }
    buf[ret] = '\0';

    cJSON *root = cJSON_Parse(buf);
    if (root == NULL) {
        httpd_resp_send_err(req, HTTPD_400_BAD_REQUEST, "Invalid JSON");
        return ESP_FAIL;
    }

    cJSON *ssid_json = cJSON_GetObjectItem(root, "ssid");
    cJSON *password_json = cJSON_GetObjectItem(root, "password");

    if (!cJSON_IsString(ssid_json) || !cJSON_IsString(password_json)) {
        cJSON_Delete(root);
        httpd_resp_send_err(req, HTTPD_400_BAD_REQUEST, "Missing ssid or password");
        return ESP_FAIL;
    }

    esp_err_t err = wifi_manager_add_credential(ssid_json->valuestring, password_json->valuestring);
    cJSON_Delete(root);

    if (err == ESP_OK) {
        httpd_resp_set_type(req, "application/json");
        httpd_resp_send(req, "{\"status\":\"ok\"}", HTTPD_RESP_USE_STRLEN);
    } else {
        httpd_resp_send_err(req, HTTPD_500_INTERNAL_SERVER_ERROR, "Failed to add credential");
    }

    return err;
}

// WiFi connect handler
static esp_err_t wifi_connect_handler(httpd_req_t *req)
{
    char buf[100];
    int ret = httpd_req_recv(req, buf, sizeof(buf) - 1);
    if (ret <= 0) {
        httpd_resp_send_err(req, HTTPD_400_BAD_REQUEST, "Invalid request");
        return ESP_FAIL;
    }
    buf[ret] = '\0';

    cJSON *root = cJSON_Parse(buf);
    if (root == NULL) {
        httpd_resp_send_err(req, HTTPD_400_BAD_REQUEST, "Invalid JSON");
        return ESP_FAIL;
    }

    cJSON *ssid_json = cJSON_GetObjectItem(root, "ssid");
    if (!cJSON_IsString(ssid_json)) {
        cJSON_Delete(root);
        httpd_resp_send_err(req, HTTPD_400_BAD_REQUEST, "Missing ssid");
        return ESP_FAIL;
    }

    // Note: This will block for up to 10 seconds
    esp_err_t err = wifi_manager_connect(ssid_json->valuestring);
    cJSON_Delete(root);

    if (err == ESP_OK) {
        httpd_resp_set_type(req, "application/json");
        httpd_resp_send(req, "{\"status\":\"ok\"}", HTTPD_RESP_USE_STRLEN);
    } else {
        httpd_resp_send_err(req, HTTPD_500_INTERNAL_SERVER_ERROR, "Failed to connect");
    }

    return err;
}

// WiFi delete handler
static esp_err_t wifi_delete_handler(httpd_req_t *req)
{
    char query[100];
    if (httpd_req_get_url_query_str(req, query, sizeof(query)) == ESP_OK) {
        char ssid[WIFI_SSID_MAX_LEN];
        if (httpd_query_key_value(query, "ssid", ssid, sizeof(ssid)) == ESP_OK) {
            esp_err_t err = wifi_manager_delete_credential(ssid);
            if (err == ESP_OK) {
                httpd_resp_set_type(req, "application/json");
                httpd_resp_send(req, "{\"status\":\"ok\"}", HTTPD_RESP_USE_STRLEN);
                return ESP_OK;
            }
        }
    }

    httpd_resp_send_err(req, HTTPD_400_BAD_REQUEST, "Invalid request");
    return ESP_FAIL;
}

// WiFi disconnect handler
static esp_err_t wifi_disconnect_handler(httpd_req_t *req)
{
    esp_err_t err = wifi_manager_disconnect();

    if (err == ESP_OK) {
        httpd_resp_set_type(req, "application/json");
        httpd_resp_send(req, "{\"status\":\"ok\"}", HTTPD_RESP_USE_STRLEN);
    } else {
        httpd_resp_send_err(req, HTTPD_500_INTERNAL_SERVER_ERROR, "Failed to disconnect");
    }

    return err;
}

// BLE Mesh status handler
static esp_err_t mesh_status_handler(httpd_req_t *req)
{
    mesh_prov_data_t prov_data;
    esp_err_t err = mesh_storage_load_prov_data(&prov_data);

    cJSON *root = cJSON_CreateObject();
    cJSON_AddBoolToObject(root, "provisioned", (err == ESP_OK && prov_data.provisioned));

    if (err == ESP_OK && prov_data.provisioned) {
        char hex_str[64];

        snprintf(hex_str, sizeof(hex_str), "0x%04X", prov_data.node_addr);
        cJSON_AddStringToObject(root, "node_addr", hex_str);

        snprintf(hex_str, sizeof(hex_str), "0x%04X", prov_data.net_idx);
        cJSON_AddStringToObject(root, "net_idx", hex_str);

        snprintf(hex_str, sizeof(hex_str), "0x%04X", prov_data.app_idx);
        cJSON_AddStringToObject(root, "app_idx", hex_str);

        // Convert keys to hex strings
        bytes_to_hex(prov_data.net_key, 16, hex_str, sizeof(hex_str));
        cJSON_AddStringToObject(root, "net_key", hex_str);

        bytes_to_hex(prov_data.app_key, 16, hex_str, sizeof(hex_str));
        cJSON_AddStringToObject(root, "app_key", hex_str);
    }

    const char *json_str = cJSON_Print(root);
    httpd_resp_set_type(req, "application/json");
    httpd_resp_send(req, json_str, HTTPD_RESP_USE_STRLEN);

    free((void *)json_str);
    cJSON_Delete(root);
    return ESP_OK;
}

// BLE Mesh reset handler
static esp_err_t mesh_reset_handler(httpd_req_t *req)
{
    esp_err_t err = mesh_storage_clear();

    if (err == ESP_OK) {
        httpd_resp_set_type(req, "application/json");
        httpd_resp_send(req, "{\"status\":\"ok\"}", HTTPD_RESP_USE_STRLEN);

        // Restart device after a short delay
        vTaskDelay(pdMS_TO_TICKS(1000));
        esp_restart();
    } else {
        httpd_resp_send_err(req, HTTPD_500_INTERNAL_SERVER_ERROR, "Failed to reset");
    }

    return err;
}

// URI handlers
static const httpd_uri_t uri_root = {
    .uri = "/",
    .method = HTTP_GET,
    .handler = root_handler,
    .user_ctx = NULL
};

static const httpd_uri_t uri_wifi_status = {
    .uri = "/api/wifi/status",
    .method = HTTP_GET,
    .handler = wifi_status_handler,
    .user_ctx = NULL
};

static const httpd_uri_t uri_wifi_scan = {
    .uri = "/api/wifi/scan",
    .method = HTTP_GET,
    .handler = wifi_scan_handler,
    .user_ctx = NULL
};

static const httpd_uri_t uri_wifi_list = {
    .uri = "/api/wifi/list",
    .method = HTTP_GET,
    .handler = wifi_list_handler,
    .user_ctx = NULL
};

static const httpd_uri_t uri_wifi_add = {
    .uri = "/api/wifi/add",
    .method = HTTP_POST,
    .handler = wifi_add_handler,
    .user_ctx = NULL
};

static const httpd_uri_t uri_wifi_connect = {
    .uri = "/api/wifi/connect",
    .method = HTTP_POST,
    .handler = wifi_connect_handler,
    .user_ctx = NULL
};

static const httpd_uri_t uri_wifi_delete = {
    .uri = "/api/wifi/delete",
    .method = HTTP_DELETE,
    .handler = wifi_delete_handler,
    .user_ctx = NULL
};

static const httpd_uri_t uri_wifi_disconnect = {
    .uri = "/api/wifi/disconnect",
    .method = HTTP_POST,
    .handler = wifi_disconnect_handler,
    .user_ctx = NULL
};

static const httpd_uri_t uri_mesh_status = {
    .uri = "/api/mesh/status",
    .method = HTTP_GET,
    .handler = mesh_status_handler,
    .user_ctx = NULL
};

static const httpd_uri_t uri_mesh_reset = {
    .uri = "/api/mesh/reset",
    .method = HTTP_POST,
    .handler = mesh_reset_handler,
    .user_ctx = NULL
};

// Start web server
esp_err_t web_server_start(void)
{
    if (server != NULL) {
        ESP_LOGW(TAG, "Web server already running");
        return ESP_OK;
    }

    httpd_config_t config = HTTPD_DEFAULT_CONFIG();
    config.max_uri_handlers = 16;
    config.stack_size = 8192;

    ESP_LOGI(TAG, "Starting web server on port %d", config.server_port);

    if (httpd_start(&server, &config) == ESP_OK) {
        // Register URI handlers
        httpd_register_uri_handler(server, &uri_root);
        httpd_register_uri_handler(server, &uri_wifi_status);
        httpd_register_uri_handler(server, &uri_wifi_scan);
        httpd_register_uri_handler(server, &uri_wifi_list);
        httpd_register_uri_handler(server, &uri_wifi_add);
        httpd_register_uri_handler(server, &uri_wifi_connect);
        httpd_register_uri_handler(server, &uri_wifi_delete);
        httpd_register_uri_handler(server, &uri_wifi_disconnect);
        httpd_register_uri_handler(server, &uri_mesh_status);
        httpd_register_uri_handler(server, &uri_mesh_reset);

        ESP_LOGI(TAG, "Web server started successfully");
        return ESP_OK;
    }

    ESP_LOGE(TAG, "Failed to start web server");
    return ESP_FAIL;
}

// Stop web server
esp_err_t web_server_stop(void)
{
    if (server == NULL) {
        ESP_LOGW(TAG, "Web server not running");
        return ESP_OK;
    }

    esp_err_t err = httpd_stop(server);
    if (err == ESP_OK) {
        server = NULL;
        ESP_LOGI(TAG, "Web server stopped");
    }

    return err;
}

