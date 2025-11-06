idf_component_register(SRCS "main.c" "mesh_storage.c" "wifi_manager.c" "web_server.c" "dns_server.c"
                    INCLUDE_DIRS "."
                    EMBED_FILES "index.html"
                    REQUIRES mqtt json esp_wifi nvs_flash bt esp_event driver led_strip esp_http_server lwip)