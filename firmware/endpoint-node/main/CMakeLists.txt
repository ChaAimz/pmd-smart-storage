idf_component_register(SRCS "main.c" "mesh_storage.c"
                    INCLUDE_DIRS "."
                    REQUIRES nvs_flash bt esp_timer driver led_strip)