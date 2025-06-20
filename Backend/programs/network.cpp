#include "../headers/network.h"

string get_network_ip() {
    try {
        WSADATA wsaData;
        if (WSAStartup(MAKEWORD(2, 2), &wsaData) != 0) {
            throw runtime_error("WSAStartup failed!");
        }

        char hostname[256];
        if (gethostname(hostname, sizeof(hostname)) == SOCKET_ERROR) {
            WSACleanup();
            throw runtime_error("Error getting hostname");
        }

        struct addrinfo hints{}, *res;
        hints.ai_family = AF_INET;  // IPv4

        if (getaddrinfo(hostname, NULL, &hints, &res) != 0) {
            WSACleanup();
            throw runtime_error("Error getting IP address");
        }

        struct sockaddr_in* addr = (struct sockaddr_in*)res->ai_addr;
        string ip = inet_ntoa(addr->sin_addr);  // Replacing inet_ntop()

        freeaddrinfo(res);
        WSACleanup();

        return ip;
    } 
    catch (const exception& e) {
        cerr << "Exception: " << e.what() << endl;
        return "";
    }
}

// Function to convert IP into a subnet for scanning
string get_subnet(const string& ip) {
    size_t last_dot = ip.find_last_of('.');
    if (last_dot == string::npos) {
        return "";
    }
    return ip.substr(0, last_dot) + ".0/24";  // Convert to CIDR format (e.g., 192.168.1.0/24)
}

void scan_network(const string& subnet, const string& local_ip) {
    if (subnet.empty()) {
        cout << " Invalid subnet or not connected to a network!" << endl;
        return;
    }

    cout << " Scanning network: " << subnet << "...\n";
    
    string command = "nmap -sn " + subnet + " > nmap_output.txt";  // Redirect output to a file
    system(command.c_str());

    // Read the output from the file
    vector<pair<string, string>> connected_devices;
    string line, ip, mac, device;
    bool found_ip = false;

    ifstream infile("nmap_output.txt");
    while (getline(infile, line)) {
        // Match "Nmap scan report for <IP>"
        smatch match;
        if (regex_search(line, match, regex(R"(Nmap scan report for (\d+\.\d+\.\d+\.\d+))"))) {
            ip = match[1].str();
            found_ip = true;
            mac = "Unknown";
            device = "Unknown";
        }
        // Match "MAC Address: <MAC> (<Vendor>)"
        else if (found_ip && regex_search(line, match, regex(R"(MAC Address: ([0-9A-Fa-f:]+) \((.*?)\))"))) {
            mac = match[1].str();
            device = match[2].str();
        }

        if (found_ip) {
            connected_devices.push_back({ip, device});
            found_ip = false;
        }
    }
    infile.close();
   // system("del nmap_output.txt");  // Delete temp file

    // Display the results
    cout << "\n Local IP Address: " << local_ip << endl;
    cout << " Connected Devices:\n";
    for (const auto& entry : connected_devices) {
        if (!entry.first.empty()) { 
            cout << "  - " << entry.first << " (" << entry.second << ")" << endl;
        }
    }

    cout << "\n Scan complete!\n";
}
