#include "dns_server.h"
#include "esp_log.h"
#include "lwip/sockets.h"
#include "lwip/netdb.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include <string.h>

static const char *TAG = "DNS_SERVER";

#define DNS_PORT 53
#define DNS_MAX_LEN 512
#define DNS_QUERY_FLAG 0x0000
#define DNS_RESPONSE_FLAG 0x8180

static int dns_socket = -1;
static TaskHandle_t dns_task_handle = NULL;
static bool dns_running = false;

// DNS header structure
typedef struct {
    uint16_t id;
    uint16_t flags;
    uint16_t questions;
    uint16_t answers;
    uint16_t authority;
    uint16_t additional;
} __attribute__((packed)) dns_header_t;

// DNS answer structure
typedef struct {
    uint16_t name_ptr;
    uint16_t type;
    uint16_t class;
    uint32_t ttl;
    uint16_t data_len;
    uint32_t ip_addr;
} __attribute__((packed)) dns_answer_t;

static void dns_server_task(void *pvParameters)
{
    char rx_buffer[DNS_MAX_LEN];
    char tx_buffer[DNS_MAX_LEN];
    struct sockaddr_in dest_addr;
    
    ESP_LOGI(TAG, "DNS server task started");
    
    while (dns_running) {
        socklen_t socklen = sizeof(dest_addr);
        int len = recvfrom(dns_socket, rx_buffer, sizeof(rx_buffer) - 1, 0,
                          (struct sockaddr *)&dest_addr, &socklen);
        
        if (len < 0) {
            if (dns_running) {
                ESP_LOGE(TAG, "recvfrom failed: errno %d", errno);
            }
            break;
        }
        
        if (len < sizeof(dns_header_t)) {
            continue;  // Too short to be a valid DNS query
        }
        
        dns_header_t *header = (dns_header_t *)rx_buffer;
        
        // Check if this is a query
        if ((ntohs(header->flags) & 0x8000) == 0 && ntohs(header->questions) > 0) {
            // Build response
            memcpy(tx_buffer, rx_buffer, len);
            dns_header_t *resp_header = (dns_header_t *)tx_buffer;
            
            // Set response flags
            resp_header->flags = htons(DNS_RESPONSE_FLAG);
            resp_header->answers = htons(1);
            resp_header->authority = 0;
            resp_header->additional = 0;
            
            // Add answer (point to query name with compression)
            dns_answer_t *answer = (dns_answer_t *)(tx_buffer + len);
            answer->name_ptr = htons(0xC00C);  // Pointer to query name
            answer->type = htons(1);           // A record
            answer->class = htons(1);          // IN class
            answer->ttl = htonl(60);           // 60 seconds TTL
            answer->data_len = htons(4);       // IPv4 address length
            answer->ip_addr = htonl(0xC0A80401);  // 192.168.4.1
            
            int resp_len = len + sizeof(dns_answer_t);
            
            // Send response
            int err = sendto(dns_socket, tx_buffer, resp_len, 0,
                           (struct sockaddr *)&dest_addr, sizeof(dest_addr));
            if (err < 0) {
                ESP_LOGE(TAG, "sendto failed: errno %d", errno);
            } else {
                ESP_LOGD(TAG, "DNS response sent (192.168.4.1)");
            }
        }
    }
    
    ESP_LOGI(TAG, "DNS server task stopped");
    vTaskDelete(NULL);
}

esp_err_t dns_server_start(void)
{
    if (dns_running) {
        ESP_LOGW(TAG, "DNS server already running");
        return ESP_OK;
    }
    
    struct sockaddr_in dest_addr;
    dest_addr.sin_addr.s_addr = htonl(INADDR_ANY);
    dest_addr.sin_family = AF_INET;
    dest_addr.sin_port = htons(DNS_PORT);
    
    dns_socket = socket(AF_INET, SOCK_DGRAM, IPPROTO_IP);
    if (dns_socket < 0) {
        ESP_LOGE(TAG, "Unable to create socket: errno %d", errno);
        return ESP_FAIL;
    }
    
    // Set socket to non-blocking for clean shutdown
    int flags = fcntl(dns_socket, F_GETFL, 0);
    fcntl(dns_socket, F_SETFL, flags | O_NONBLOCK);
    
    int err = bind(dns_socket, (struct sockaddr *)&dest_addr, sizeof(dest_addr));
    if (err < 0) {
        ESP_LOGE(TAG, "Socket unable to bind: errno %d", errno);
        close(dns_socket);
        dns_socket = -1;
        return ESP_FAIL;
    }
    
    // Set back to blocking
    fcntl(dns_socket, F_SETFL, flags);
    
    ESP_LOGI(TAG, "✅ DNS server socket bound to port %d", DNS_PORT);
    
    dns_running = true;
    xTaskCreate(dns_server_task, "dns_server", 4096, NULL, 5, &dns_task_handle);
    
    ESP_LOGI(TAG, "✅ DNS server started (all queries -> 192.168.4.1)");
    return ESP_OK;
}

esp_err_t dns_server_stop(void)
{
    if (!dns_running) {
        return ESP_OK;
    }
    
    dns_running = false;
    
    if (dns_socket >= 0) {
        shutdown(dns_socket, SHUT_RDWR);
        close(dns_socket);
        dns_socket = -1;
    }
    
    if (dns_task_handle != NULL) {
        vTaskDelay(pdMS_TO_TICKS(100));  // Give task time to exit
        dns_task_handle = NULL;
    }
    
    ESP_LOGI(TAG, "DNS server stopped");
    return ESP_OK;
}

