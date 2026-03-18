#pragma once

#include <string>
#include <vector>

// Device config
std::string get_device_name();
void ensure_config_exists();

// Network info
std::string get_network_ip();
std::string get_subnet(const std::string& ip);

// UDP discovery
std::vector<std::string> discover_devices();
void start_discovery_listener();