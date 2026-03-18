#include "../headers/network.h"
#include "../headers/socket_utils.h"

// At the very top of network.h, before anything else
#include <iostream>   // std::cout, std::cerr
#include <fstream>    // std::ifstream, std::ofstream
#include <thread>     // std::thread
#include <vector>
#include <string>
#include <regex>


using namespace std;


// ---------------- DEVICE NAME ----------------

static std::string resolve_config_path_for_read() {
    const char* candidates[] = {
        "../Backend/config/config.json",
        "../config/config.json",
        "config/config.json",
        "config.json"
    };

    for (const char* p : candidates) {
        ifstream f(p);
        if (f.good()) return p;
    }
    return "../Backend/config/config.json";
}

static std::string resolve_config_path_for_write() {
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
    init_sockets();

#ifdef _WIN32
    ULONG bufLen = 15000;
    PIP_ADAPTER_ADDRESSES pAddresses = (PIP_ADAPTER_ADDRESSES)malloc(bufLen);
    if (!pAddresses) return "127.0.0.1";

    DWORD ret = GetAdaptersAddresses(AF_INET, GAA_FLAG_INCLUDE_PREFIX, NULL, pAddresses, &bufLen);
    if (ret == ERROR_BUFFER_OVERFLOW) {
        free(pAddresses);
        pAddresses = (PIP_ADAPTER_ADDRESSES)malloc(bufLen);
        if (!pAddresses) return "127.0.0.1";
        ret = GetAdaptersAddresses(AF_INET, GAA_FLAG_INCLUDE_PREFIX, NULL, pAddresses, &bufLen);
    }

    if (ret != NO_ERROR) {
        if (pAddresses) free(pAddresses);
        return "127.0.0.1";
    }

    std::string best_ip = "";
    int best_priority = -1;

    for (PIP_ADAPTER_ADDRESSES pCurr = pAddresses; pCurr; pCurr = pCurr->Next) {
        if (pCurr->OperStatus != IfOperStatusUp) continue;
        if (pCurr->IfType == IF_TYPE_SOFTWARE_LOOPBACK) continue;

        std::wstring wname(pCurr->FriendlyName);
        std::string name(wname.begin(), wname.end());

        auto lower_name = name;
        for (auto &c : lower_name) c = tolower(c);

        if (lower_name.find("wsl") != string::npos ||
            lower_name.find("hyper-v") != string::npos ||
            lower_name.find("virtualbox") != string::npos ||
            lower_name.find("vmware") != string::npos ||
            lower_name.find("vbox") != string::npos) {
            continue;
        }

        int priority = 1;
        if (lower_name.find("wi-fi") != string::npos ||
            lower_name.find("wifi") != string::npos ||
            lower_name.find("wireless") != string::npos) {
            priority = 3;
        } else if (lower_name.find("ethernet") != string::npos ||
                   lower_name.find("lan") != string::npos) {
            priority = 2;
        }

        for (PIP_ADAPTER_UNICAST_ADDRESS pUnicast = pCurr->FirstUnicastAddress; pUnicast; pUnicast = pUnicast->Next) {
            SOCKADDR_IN* sa = (SOCKADDR_IN*)pUnicast->Address.lpSockaddr;
            char ip[INET_ADDRSTRLEN];
            inet_ntop(AF_INET, &sa->sin_addr, ip, sizeof(ip));
            string ipStr(ip);

            if (ipStr.substr(0, 4) == "127.") continue;
            if (ipStr.substr(0, 8) == "169.254.") continue;
            // FIX: Only skip Docker's 172.17.x.x, not the entire 172.x range
            if (ipStr.substr(0, 7) == "172.17.") continue;

            if (priority > best_priority) {
                best_priority = priority;
                best_ip = ipStr;
            }
        }
    }

    free(pAddresses);
    return best_ip.empty() ? "127.0.0.1" : best_ip;

#else

    struct ifaddrs *ifap, *ifa;
    std::string best_ip = "";
    int best_priority = -1;

    if (getifaddrs(&ifap) != 0) return "127.0.0.1";

    for (ifa = ifap; ifa != nullptr; ifa = ifa->ifa_next) {
        if (!ifa->ifa_addr) continue;
        if (ifa->ifa_addr->sa_family != AF_INET) continue;

        std::string ifname(ifa->ifa_name);
        std::string lower_name = ifname;
        for (auto &c : lower_name) c = tolower(c);

        // Skip loopback and virtual interfaces
        if (lower_name == "lo") continue;
        if (lower_name.find("docker") != string::npos) continue;
        if (lower_name.find("vbox") != string::npos) continue;
        if (lower_name.find("vmnet") != string::npos) continue;

        char ip[INET_ADDRSTRLEN];
        struct sockaddr_in* addr = (struct sockaddr_in*)ifa->ifa_addr;
        inet_ntop(AF_INET, &addr->sin_addr, ip, sizeof(ip));
        std::string ipStr(ip);

        if (ipStr.substr(0, 4) == "127.") continue;
        if (ipStr.substr(0, 8) == "169.254.") continue;

        // Priority: wlan/wifi > eth/en > others
        int priority = 1;
        if (lower_name.find("wlan") != string::npos ||
            lower_name.find("wifi") != string::npos ||
            lower_name.find("wlp") != string::npos) {
            priority = 3;
        } else if (lower_name.find("eth") != string::npos ||
                   lower_name.find("enp") != string::npos ||
                   lower_name.find("ens") != string::npos ||
                   lower_name.substr(0, 2) == "en") {
            priority = 2;
        }

        if (priority > best_priority) {
            best_priority = priority;
            best_ip = ipStr;
        }
    }

    freeifaddrs(ifap);
    return best_ip.empty() ? "127.0.0.1" : best_ip;
#endif
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

    // Collect ALL local IPs to filter out self-responses
    vector<string> local_ips;
    {
        char hostname[256];
        if (gethostname(hostname, sizeof(hostname)) == 0) {
            struct addrinfo hints{}, *res, *p;
            hints.ai_family = AF_INET;
            if (getaddrinfo(hostname, NULL, &hints, &res) == 0) {
                for (p = res; p != nullptr; p = p->ai_next) {
                    char ip[INET_ADDRSTRLEN];
                    struct sockaddr_in* addr = (struct sockaddr_in*)p->ai_addr;
                    inet_ntop(AF_INET, &(addr->sin_addr), ip, sizeof(ip));
                    local_ips.push_back(string(ip));
                }
                freeaddrinfo(res);
            }
        }
        // Also add the best local IP in case gethostname misses it
        string best = get_network_ip();
        if (!best.empty() && best != "127.0.0.1") {
            local_ips.push_back(best);
        }
    }

    socket_t sock = socket(AF_INET, SOCK_DGRAM, 0);
    if (sock == INVALID_SOCKET) {
        devices.push_back("No active app instances found");
        return devices;
    }

    // FIX: SO_REUSEADDR so bind doesn't fail if port is still in TIME_WAIT
    int reuse = 1;
    setsockopt(sock, SOL_SOCKET, SO_REUSEADDR, (char*)&reuse, sizeof(reuse));

    int broadcast = 1;
    setsockopt(sock, SOL_SOCKET, SO_BROADCAST, (char*)&broadcast, sizeof(broadcast));

    // FIX: Bind sender to a fixed port so the OS delivers unicast replies to us
    sockaddr_in local{};
    local.sin_family = AF_INET;
    local.sin_port = htons(8889);   // dedicated reply-receive port
    local.sin_addr.s_addr = INADDR_ANY;

    if (bind(sock, (sockaddr*)&local, sizeof(local)) != 0) {
        // Port 8889 may already be in use — fall back to ephemeral (less reliable)
        std::cerr << "[Discovery] Warning: could not bind sender to port 8889, "
                     "using ephemeral port (replies may be lost on some platforms)\n";
    }

    string msg = "DISCOVER_APP";

    // FIX: Send both limited broadcast AND subnet-directed broadcast
    // Many home routers silently drop 255.255.255.255
    sockaddr_in bcast_addr{};
    bcast_addr.sin_family = AF_INET;
    bcast_addr.sin_port = htons(8888);
    inet_pton(AF_INET, "255.255.255.255", &bcast_addr.sin_addr);
    sendto(sock, msg.c_str(), (int)msg.size(), 0,
           (sockaddr*)&bcast_addr, sizeof(bcast_addr));

    // Directed broadcast (e.g. 192.168.1.255)
    string local_ip = get_network_ip();
    if (local_ip != "127.0.0.1") {
        string base = local_ip.substr(0, local_ip.find_last_of('.'));
        string directed = base + ".255";

        sockaddr_in dir_addr{};
        dir_addr.sin_family = AF_INET;
        dir_addr.sin_port = htons(8888);
        inet_pton(AF_INET, directed.c_str(), &dir_addr.sin_addr);
        sendto(sock, msg.c_str(), (int)msg.size(), 0,
               (sockaddr*)&dir_addr, sizeof(dir_addr));
    }

    char buffer[1024];
    fd_set fds;

    while (true) {
        FD_ZERO(&fds);
        FD_SET(sock, &fds);

        timeval tv{};
        tv.tv_sec = 3;
        tv.tv_usec = 0;

        int activity = select((int)sock + 1, &fds, NULL, NULL, &tv);
        if (activity <= 0) break;  // timeout or error — done waiting

        sockaddr_in sender{};
        socklen_t sender_len = sizeof(sender);
        int len = recvfrom(sock, buffer, sizeof(buffer) - 1, 0,
                           (sockaddr*)&sender, &sender_len);

        if (len > 0) {
            buffer[len] = '\0';
            string reply(buffer);

            if (reply.substr(0, 9) != "APP_HERE:") continue;

            char ip[INET_ADDRSTRLEN];
            inet_ntop(AF_INET, &sender.sin_addr, ip, sizeof(ip));
            string sender_ip(ip);

            // Skip self
            bool is_self = false;
            for (const auto& lip : local_ips) {
                if (lip == sender_ip) { is_self = true; break; }
            }
            if (is_self) continue;

            string device_name = reply.substr(9);
            if (device_name.empty()) device_name = "Unknown";

            string entry = sender_ip + " (" + device_name + ")";
            bool duplicate = false;
            for (const auto& d : devices) {
                if (d == entry) { duplicate = true; break; }
            }
            if (!duplicate) devices.push_back(entry);
        }
    }

    close_socket(sock);
    // NOTE: Do NOT call cleanup_sockets() here — the listener thread is still running.

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
        if (sock == INVALID_SOCKET) {
            std::cerr << "[Listener] Failed to create socket\n";
            return;
        }

        // FIX: SO_REUSEADDR must be set BEFORE bind, otherwise a second
        // launch or a quick restart will fail to bind and silently never respond
        int reuse = 1;
        setsockopt(sock, SOL_SOCKET, SO_REUSEADDR, (char*)&reuse, sizeof(reuse));

        int broadcast = 1;
        setsockopt(sock, SOL_SOCKET, SO_BROADCAST, (char*)&broadcast, sizeof(broadcast));

        sockaddr_in addr{};
        addr.sin_family = AF_INET;
        addr.sin_port = htons(8888);
        addr.sin_addr.s_addr = INADDR_ANY;

        // FIX: Check bind result — silent failure here means the listener
        // never receives anything, which is the most common discovery bug
        int ret = bind(sock, (sockaddr*)&addr, sizeof(addr));
        if (ret != 0) {
#ifdef _WIN32
            std::cerr << "[Listener] bind() failed, WSAError=" << WSAGetLastError()
                      << " — port 8888 may already be in use\n";
#else
            std::cerr << "[Listener] bind() failed, errno=" << errno
                      << " — port 8888 may already be in use\n";
#endif
            close_socket(sock);
            cleanup_sockets();
            return;
        }

        std::cout << "[Listener] Bound to port 8888, waiting for discovery broadcasts...\n";

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

                    sendto(sock, response.c_str(), (int)response.size(), 0,
                           (sockaddr*)&sender, sender_len);
                }
            }
        }

        // Unreachable in normal operation (infinite loop), but here for completeness
        close_socket(sock);
        cleanup_sockets();
    }).detach();
}