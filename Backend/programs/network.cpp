#include "../headers/network.h"

#include <iostream>
#include <fstream>
#include <regex>
#include <vector>
#include <thread>

#include "../headers/socket_utils.h"

using namespace std;


// ---------------- DEVICE NAME ----------------

// Try a couple of common relative locations so this works
// from Backend binaries and from the Electron/addon process.
static std::string resolve_config_path_for_read() {
    const char* candidates[] = {
        "../Backend/config/config.json", // from electron/addon
        "../config/config.json",         // from Backend binary
        "config/config.json",            // fallback
        "config.json"                    // legacy
    };

    for (const char* p : candidates) {
        ifstream f(p);
        if (f.good()) return p;
    }
    // Default to first preferred path
    return "../Backend/config/config.json";
}

static std::string resolve_config_path_for_write() {
    // Prefer existing directories; otherwise fall back to local file.
    const char* preferred = "../Backend/config/config.json";
    {
        ofstream test(preferred, std::ios::app);
        if (test.is_open()) {
            return preferred;
        }
    }
    return "config.json";
}

string get_device_name() {
    const string default_name = "My-Device";

    const string path = resolve_config_path_for_read();
    ifstream file(path);
    if (!file.is_open()) return default_name;

    string content((istreambuf_iterator<char>(file)),
                   istreambuf_iterator<char>());

    size_t pos = content.find("device_name");
    if (pos != string::npos) {
        size_t start = content.find(":", pos);
        size_t q1 = content.find("\"", start);
        size_t q2 = content.find("\"", q1 + 1);

        if (q1 != string::npos && q2 != string::npos) {
            string name = content.substr(q1 + 1, q2 - q1 - 1);
            if (!name.empty()) return name;
        }
    }

    return default_name;
}

void ensure_config_exists() {
    const string path = resolve_config_path_for_write();
    ifstream file(path);
    if (file.good()) return;

    ofstream out(path);
    if (!out.is_open()) return;
    out << "{\n  \"device_name\": \"My-Device\"\n}";
}

bool is_device_name_set() {
    ensure_config_exists();
    string name = get_device_name();
    return !name.empty() && name != "My-Device";
}

void set_device_name(const string& name) {
    if (name.empty()) return;
    const string path = resolve_config_path_for_write();
    ofstream out(path);
    if (!out.is_open()) return;
    out << "{\n  \"device_name\": \"" << name << "\"\n}";
}

// ---------------- NETWORK IP ----------------

string get_network_ip() {
    try {
        init_sockets();

        char hostname[256];
        if (gethostname(hostname, sizeof(hostname)) == -1) {
            throw runtime_error("Error getting hostname");
        }

        struct addrinfo hints{}, *res;
        hints.ai_family = AF_INET;

        if (getaddrinfo(hostname, NULL, &hints, &res) != 0) {
            throw runtime_error("Error getting IP address");
        }

        struct sockaddr_in* addr = (struct sockaddr_in*)res->ai_addr;

        char ip[INET_ADDRSTRLEN];
        inet_ntop(AF_INET, &(addr->sin_addr), ip, sizeof(ip));

        freeaddrinfo(res);
        cleanup_sockets();

        return string(ip);
    } 
    catch (const exception& e) {
        cerr << "Exception: " << e.what() << endl;
        return "";
    }
}

// ---------------- SUBNET ----------------

string get_subnet(const string& ip) {
    size_t last_dot = ip.find_last_of('.');
    if (last_dot == string::npos) return "";
    return ip.substr(0, last_dot) + ".0/24";
}

// ---------------- UDP DISCOVERY (SENDER) ----------------

vector<string> discover_devices() {
    vector<string> devices;

    init_sockets();

    socket_t sock = socket(AF_INET, SOCK_DGRAM, 0);
    if (sock == INVALID_SOCKET) return devices;

    int broadcast = 1;
    setsockopt(sock, SOL_SOCKET, SO_BROADCAST,
               (char*)&broadcast, sizeof(broadcast));

    sockaddr_in addr{};
    addr.sin_family = AF_INET;
    addr.sin_port = htons(8888);
    inet_pton(AF_INET, "255.255.255.255", &addr.sin_addr);

    string msg = "DISCOVER_APP";

    sendto(sock, msg.c_str(), msg.size(), 0,
           (sockaddr*)&addr, sizeof(addr));

    char buffer[1024];
    sockaddr_in sender{};
    socklen_t sender_len = sizeof(sender);

    fd_set fds;

    while (true) {
        FD_ZERO(&fds);
        FD_SET(sock, &fds);

        timeval tv{};
        tv.tv_sec = 3;

        int activity = select(sock + 1, &fds, NULL, NULL, &tv);
        if (activity <= 0) break;

        int len = recvfrom(sock, buffer, sizeof(buffer) - 1, 0,
                           (sockaddr*)&sender, &sender_len);

        if (len > 0) {
            buffer[len] = '\0';
            string msg(buffer);

            char ip[INET_ADDRSTRLEN];
            inet_ntop(AF_INET, &sender.sin_addr, ip, sizeof(ip));

            string device_name = "Unknown";
            size_t pos = msg.find(":");
            if (pos != string::npos) {
                device_name = msg.substr(pos + 1);
            }

            devices.push_back(string(ip) + " (" + device_name + ")");
        }
    }

    close_socket(sock);
    cleanup_sockets();

    if (devices.empty()) {
        devices.push_back("No active app instances found");
    }

    return devices;
}

// ---------------- UDP LISTENER (RECEIVER) ----------------

void start_discovery_listener() {
    thread([]() {
        init_sockets();

        socket_t sock = socket(AF_INET, SOCK_DGRAM, 0);

        int broadcast = 1;
        setsockopt(sock, SOL_SOCKET, SO_BROADCAST,
                   (char*)&broadcast, sizeof(broadcast));

        sockaddr_in addr{};
        addr.sin_family = AF_INET;
        addr.sin_port = htons(8888);
        addr.sin_addr.s_addr = INADDR_ANY;

        bind(sock, (sockaddr*)&addr, sizeof(addr));

        char buffer[1024];

        while (true) {
            sockaddr_in sender{};
            socklen_t sender_len = sizeof(sender);

            int len = recvfrom(sock, buffer, sizeof(buffer) - 1, 0,
                               (sockaddr*)&sender, &sender_len);

            if (len > 0) {
                buffer[len] = '\0';

                if (string(buffer) == "DISCOVER_APP") {
                    string device_name = get_device_name();
                    string response = "APP_HERE:" + device_name;

                    sendto(sock, response.c_str(), response.size(), 0,
                           (sockaddr*)&sender, sender_len);
                }
            }
        }

        close_socket(sock);
        cleanup_sockets();
    }).detach();
}