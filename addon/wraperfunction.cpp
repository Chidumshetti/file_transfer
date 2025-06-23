// File: addon.cpp

#include "E:/FTP/file_transfer/addon/node_modules/node-addon-api/napi.h"
#include <string>
#include <vector>
#include "../backend/headers/network.h"
#include "../backend/headers/Send_recieve.h"

// Declaration of C++ core function
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
// Wrapping run_transfer for Node.js
Napi::Number RunTransferWrapped(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 3 ||
        !info[0].IsString() || !info[1].IsString() || !info[2].IsString()) {
        Napi::TypeError::New(env, "Expected at least 3 string arguments").ThrowAsJavaScriptException();
        return Napi::Number::New(env, -1);
    }

    std::string mode = info[0].As<Napi::String>();
    std::string ip_or_port = info[1].As<Napi::String>();
    std::string port_or_outputdir = info[2].As<Napi::String>();
    std::string directory = (info.Length() >= 4 && info[3].IsString())
                            ? info[3].As<Napi::String>().Utf8Value()
                            : "";

    int result = run_transfer(mode, ip_or_port, port_or_outputdir, directory);
    return Napi::Number::New(env, result);
}

// Wrapping scan_network
Napi::Array ScanNetworkWrapped(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    std::string local_ip = get_network_ip();
    if (local_ip.empty()) {
        return Napi::Array::New(env); // Return empty array on failure
    }

    std::string subnet = get_subnet(local_ip);
    std::vector<std::string> ips = scan_network(subnet, local_ip);

    Napi::Array result = Napi::Array::New(env, ips.size());
    for (size_t i = 0; i < ips.size(); ++i) {
        result[i] = Napi::String::New(env, ips[i]);
    }

    return result;
}

// Wrapping get_network_ip
Napi::String GetLocalIPWrapped(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    std::string ip = get_network_ip();
    return Napi::String::New(env, ip);
}

// Module initialization
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("runTransfer", Napi::Function::New(env, RunTransferWrapped));
    exports.Set("scanNetwork", Napi::Function::New(env, ScanNetworkWrapped));
    exports.Set("getLocalIP", Napi::Function::New(env, GetLocalIPWrapped));
    return exports;
}

NODE_API_MODULE(addon, Init)
