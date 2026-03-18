#include "../headers/network.h"
#include "../headers/Send_recieve.h"
#include <iostream>

using namespace std;

int main() {
    cout << "Starting network operations...\n";

    // Get local network IP
    string local_ip = get_network_ip();
    if (local_ip.empty()) {
        cerr << "Failed to retrieve local IP!" << endl;
        return 1;
    }
    cout << "Local IP Address: " << local_ip << endl;

    // Get subnet for scanning
    string subnet = get_subnet(local_ip);
    cout << "Subnet for scanning: " << subnet << endl;

    // 🟢 STORE returned IPs
   // std::vector<std::string> ips = scan_network(subnet, local_ip);

    // // 🟢 PRINT the scanned IPs
    // std::cout << "\nDiscovered Devices:\n";
    // for (const std::string& ip : ips) {
    //     std::cout << " - " << ip << std::endl;
    // }

    // string dir_path;
  
    // cout << "\nEnter target IP for file transfer: ";
    // string target_ip;
    // cin >> target_ip;

    // string network_path = "\\\\" + target_ip + "\\D:\\";
    // You can now call run_transfer as needed here, e.g.:
    // int result = run_transfer("send", target_ip, "12345", dir_path);
    cout << "\nOperations complete!\n";
    return 0;
}

int run_transfer(const std::string& mode, const std::string& ip_or_port, const std::string& port_or_outputdir, const std::string& directory = "") {
    if (mode == "receive") {
        int port = std::atoi(ip_or_port.c_str()); // ip_or_port is port in this mode
        const std::string& output_dir = port_or_outputdir;
        return receive_directory(port, output_dir) ? 0 : 1;
    } 
    else if (mode == "send") {
        // ip_or_port = IP address
        // port_or_outputdir = port (string)
        // directory = directory path to send
        int port = std::atoi(port_or_outputdir.c_str());
        return send_directory(directory, ip_or_port, port) ? 0 : 1;

    } 
    else {
        std::cerr << "Invalid mode: " << mode << "\n";
        return 1;
    }
}
