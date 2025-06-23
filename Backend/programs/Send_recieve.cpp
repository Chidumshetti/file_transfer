// Cross-platform TCP directory transfer (no <filesystem> needed)
// Windows (MinGW): g++ -std=c++11 send_dir.cpp -o tcp_transfer.exe -lws2_32
// Linux:           g++ -std=c++11 send_dir.cpp -o tcp_transfer

#include <iostream>
#include <fstream>
#include <vector>
#include <sstream>
#include <algorithm>
#include <cstdio>
#include <cstdlib>
#include <cstring>

#ifdef _WIN32
#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#pragma comment(lib, "ws2_32.lib")
using socket_t = SOCKET;
void init_sockets() { WSADATA wsaData; WSAStartup(MAKEWORD(2, 2), &wsaData); }
void cleanup_sockets() { WSACleanup(); }
void close_socket(socket_t s) { closesocket(s); }
#else
#include <sys/types.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <unistd.h>
#include <dirent.h>
#include <sys/stat.h>
using socket_t = int;
void init_sockets() {}
void cleanup_sockets() {}
void close_socket(socket_t s) { close(s); }
#endif

constexpr int BUFFER_SIZE = 64 * 1024;


// ---------- Directory Traversal -------------
void list_files(const std::string& base, const std::string& path, std::vector<std::string>& files) {
#ifdef _WIN32
    std::string search_path = base + "\\" + path + "\\*";
    WIN32_FIND_DATAA ffd;
    HANDLE hFind = FindFirstFileA(search_path.c_str(), &ffd);
    if (hFind == INVALID_HANDLE_VALUE) return;

    do {
        std::string name = ffd.cFileName;
        if (name == "." || name == "..") continue;
        std::string rel = path.empty() ? name : path + "\\" + name;
        if (ffd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) {
            list_files(base, rel, files);
        } else {
            files.push_back(rel);
        }
    } while (FindNextFileA(hFind, &ffd) != 0);
    FindClose(hFind);
#else
    std::string full_path = base + "/" + path;
    DIR* dir = opendir(full_path.c_str());
    if (!dir) return;

    struct dirent* entry;
    while ((entry = readdir(dir)) != nullptr) {
        std::string name = entry->d_name;
        if (name == "." || name == "..") continue;
        std::string rel = path.empty() ? name : path + "/" + name;

        std::string full = base + "/" + rel;
        struct stat s;
        if (stat(full.c_str(), &s) == 0) {
            if (S_ISDIR(s.st_mode)) {
                list_files(base, rel, files);
            } else {
                files.push_back(rel);
            }
        }
    }
    closedir(dir);
#endif
}

// ------------- Utility -------------------
uint64_t get_file_size(const std::string& path) {
    std::ifstream ifs(path, std::ios::binary | std::ios::ate);
    return ifs ? (uint64_t)ifs.tellg() : 0;
}

void send_uint32(socket_t sock, uint32_t val) {
    val = htonl(val);
    send(sock, reinterpret_cast<char*>(&val), sizeof(val), 0);
}

void send_uint64(socket_t sock, uint64_t val) {
    val = htonll(val);
    send(sock, reinterpret_cast<char*>(&val), sizeof(val), 0);
}

uint32_t recv_uint32(socket_t sock) {
    uint32_t val;
    recv(sock, reinterpret_cast<char*>(&val), sizeof(val), 0);
    return ntohl(val);
}

uint64_t recv_uint64(socket_t sock) {
    uint64_t val;
    recv(sock, reinterpret_cast<char*>(&val), sizeof(val), 0);
    return ntohll(val);
}

void create_dirs(const std::string& filepath) {
    size_t pos = 0;
    while ((pos = filepath.find_first_of("/\\", pos + 1)) != std::string::npos) {
        std::string dir = filepath.substr(0, pos);
#ifdef _WIN32
        CreateDirectoryA(dir.c_str(), NULL);
#else
        mkdir(dir.c_str(), 0775);
#endif
    }
}

// --------- File Transfer Logic -------------

bool send_directory(const std::string& base, const std::string& ip, int port) {
    init_sockets();
    socket_t sock = socket(AF_INET, SOCK_STREAM, 0);
    if (sock < 0) return false;

    sockaddr_in addr{};
    addr.sin_family = AF_INET;
    addr.sin_port = htons(port);
#ifdef _WIN32
    addr.sin_addr.S_un.S_addr = inet_addr(ip.c_str());
#else
    inet_pton(AF_INET, ip.c_str(), &addr.sin_addr);
#endif

    if (connect(sock, (sockaddr*)&addr, sizeof(addr)) < 0) {
        std::cerr << "Connection failed\n";
        close_socket(sock);
        cleanup_sockets();
        return false;
    }

    std::vector<std::string> files;
    list_files(base, "", files);

    uint64_t total_bytes = 0;
    for (auto& rel : files)
        total_bytes += get_file_size(base + "/" + rel);

    uint64_t sent_bytes = 0;

    for (const auto& rel_path : files) {
        std::string full = base + "/" + rel_path;
        uint64_t size = get_file_size(full);

        send_uint32(sock, (uint32_t)rel_path.size());
        send(sock, rel_path.c_str(), rel_path.size(), 0);
        send_uint64(sock, size);

        std::ifstream ifs(full, std::ios::binary);
        char buffer[BUFFER_SIZE];
        while (ifs) {
            ifs.read(buffer, BUFFER_SIZE);
            std::streamsize r = ifs.gcount();
            int sent = 0;
            while (sent < r) {
                int s = send(sock, buffer + sent, r - sent, 0);
                if (s <= 0) return false;
                sent += s;
                sent_bytes += s;
                std::cout << "\rProgress: " << (sent_bytes * 100 / total_bytes) << "%" << std::flush;
            }
        }
    }

    std::cout << "\nAll files sent.\n";
    close_socket(sock);
    cleanup_sockets();
    return true;
}

bool receive_directory(int port, const std::string& output_dir) {
    init_sockets();
    socket_t listen_sock = socket(AF_INET, SOCK_STREAM, 0);
    if (listen_sock < 0) return false;

    sockaddr_in addr{};
    addr.sin_family = AF_INET;
    addr.sin_port = htons(port);
    addr.sin_addr.s_addr = INADDR_ANY;

    bind(listen_sock, (sockaddr*)&addr, sizeof(addr));
    listen(listen_sock, 1);

    std::cout << "Waiting for sender on port " << port << "...\n";

    sockaddr_in client{};
#ifdef _WIN32
    int client_size = sizeof(client);
#else
    socklen_t client_size = sizeof(client);
#endif

    socket_t client_sock = accept(listen_sock, (sockaddr*)&client, &client_size);
    std::cout << "Connected! Receiving files...\n";

    while (true) {
        uint32_t path_len;
        int peek = recv(client_sock, reinterpret_cast<char*>(&path_len), sizeof(path_len), MSG_PEEK);
        if (peek <= 0) break;

        path_len = recv_uint32(client_sock);
        std::string rel_path(path_len, '\0');
        recv(client_sock, &rel_path[0], path_len, 0);
        uint64_t file_size = recv_uint64(client_sock);

        std::string full_path = output_dir + "/" + rel_path;
        create_dirs(full_path);

        std::ofstream ofs(full_path, std::ios::binary);
        uint64_t received = 0;
        char buffer[BUFFER_SIZE];

        while (received < file_size) {
            int chunk_size = static_cast<int>(std::min<uint64_t>(BUFFER_SIZE, file_size - received));
            int r = recv(client_sock, buffer, chunk_size, 0);
            if (r <= 0) return false;
            ofs.write(buffer, r);
            received += r;
        }

        std::cout << "Received: " << rel_path << "\n";
    }

    std::cout << "All files received.\n";
    close_socket(client_sock);
    close_socket(listen_sock);
    cleanup_sockets();
    return true;
}
