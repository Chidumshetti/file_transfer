#ifndef TCP_TRANSFER_H
#define TCP_TRANSFER_H

#include <string>
#include <vector>
#include <cstdint>

#include "socket_utils.h"

// Byte order conversions
uint64_t htonll(uint64_t value);
uint64_t ntohll(uint64_t value);

// Directory traversal
void list_files(const std::string& base, const std::string& path, std::vector<std::string>& files);

// Utility functions
uint64_t get_file_size(const std::string& path);
void send_uint32(socket_t sock, uint32_t val);
void send_uint64(socket_t sock, uint64_t val);
uint32_t recv_uint32(socket_t sock);
uint64_t recv_uint64(socket_t sock);
void create_dirs(const std::string& filepath);

// File transfer functions
bool send_directory(const std::string& base, const std::string& ip, int port);
bool receive_directory(int port, const std::string& output_dir);

#endif // TCP_TRANSFER_H
