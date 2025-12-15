# Full Gateway Node - WiFi Manager + BLE Mesh + MQTT
idf_component_register(SRCS "main.c" "mesh_storage.c"
                    INCLUDE_DIRS "."
                    REQUIRES mqtt json esp_wifi nvs_flash bt esp_event esp_http_server lwip driver led_strip)

# Simple test version (backup)
# idf_component_register(SRCS "main_simple_test.c"
#                     INCLUDE_DIRS "."
#                     REQUIRES esp_wifi nvs_flash esp_event esp_http_server lwip driver led_strip)