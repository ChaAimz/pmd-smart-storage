idf_component_register(SRCS "main.c"
                    INCLUDE_DIRS "."
                    REQUIRES mqtt json esp_wifi nvs_flash bt esp_event driver led_strip)