// File: addon.cpp

#include <napi.h>
#include <string>
#include <vector>
#include <iostream>  
#include "../Backend/headers/network.h"
#include "../Backend/headers/Send_recieve.h"

// Declaration of C++ core function
int run_transfer(const std::string& mode, const std::string& ip_or_port, const std::string& port_or_outputdir, const std::string& directory = "") {
    if (mode == "receive") {
        int port = std::atoi(ip_or_port.c_str());
        const std::string& output_dir = port_or_outputdir;
        return receive_directory(port, output_dir) ? 0 : 1;
    } 
    else if (mode == "send") {
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

    std::string mode     = info[0].As<Napi::String>().Utf8Value();
    std::string ip_or_port       = info[1].As<Napi::String>().Utf8Value();
    std::string port_or_outputdir = info[2].As<Napi::String>().Utf8Value();
    std::string directory = (info.Length() >= 4 && info[3].IsString())
                            ? info[3].As<Napi::String>().Utf8Value()
                            : "";

    int result = run_transfer(mode, ip_or_port, port_or_outputdir, directory);
    return Napi::Number::New(env, result);
}

// Wrapping discover_devices — replaces old scan_network wrapper.
// Returns an array of strings like "192.168.1.5 (DeviceName)".
Napi::Array ScanNetworkWrapped(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    std::vector<std::string> devices = discover_devices();

    // If the only entry is the "no devices" sentinel, return empty array
    if (devices.size() == 1 && devices[0] == "No active app instances found") {
        return Napi::Array::New(env, 0);
    }

    Napi::Array result = Napi::Array::New(env, devices.size());
    for (size_t i = 0; i < devices.size(); ++i) {
        result[i] = Napi::String::New(env, devices[i]);
    }

    return result;
}

// Wrapping get_network_ip
Napi::String GetLocalIPWrapped(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    std::string ip = get_network_ip();
    return Napi::String::New(env, ip);
}

// Wrapping start_discovery_listener
// Call once at app startup so this device responds to DISCOVER_APP broadcasts.
Napi::Value StartDiscoveryListenerWrapped(const Napi::CallbackInfo& info) {
    start_discovery_listener();
    return info.Env().Undefined();
}

// ---------------- CONFIG / DEVICE NAME ----------------

// bool isDeviceNameSet()
Napi::Boolean IsDeviceNameSetWrapped(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    bool set = is_device_name_set();
    return Napi::Boolean::New(env, set);
}

// string getDeviceName()
Napi::String GetDeviceNameWrapped(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    std::string name = get_device_name();
    return Napi::String::New(env, name);
}

// void setDeviceName(string)
Napi::Value SetDeviceNameWrapped(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "Expected a string for device name").ThrowAsJavaScriptException();
        return env.Undefined();
    }
    std::string name = info[0].As<Napi::String>().Utf8Value();
    set_device_name(name);
    return env.Undefined();
}

// Module initialization
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("runTransfer",            Napi::Function::New(env, RunTransferWrapped));
    exports.Set("scanNetwork",            Napi::Function::New(env, ScanNetworkWrapped));
    exports.Set("getLocalIP",             Napi::Function::New(env, GetLocalIPWrapped));
    exports.Set("startDiscoveryListener", Napi::Function::New(env, StartDiscoveryListenerWrapped));
    exports.Set("isDeviceNameSet",        Napi::Function::New(env, IsDeviceNameSetWrapped));
    exports.Set("getDeviceName",          Napi::Function::New(env, GetDeviceNameWrapped));
    exports.Set("setDeviceName",          Napi::Function::New(env, SetDeviceNameWrapped));
    return exports;
}

NODE_API_MODULE(addon, Init)