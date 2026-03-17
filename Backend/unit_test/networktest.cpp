#include "../headers/network.h"
#include <iostream>
#include <thread>
#include <chrono>

using namespace std;

int main() {
    cout << "Starting test..." << endl;

    // Step 1: Ensure config exists
    ensure_config_exists();

    // Step 2: Start receiver (listener)
    cout << "Starting receiver..." << endl;
    start_discovery_listener();

    // Give listener time to start
    this_thread::sleep_for(chrono::seconds(1));

    // Step 3: Run sender
    cout << "Discovering devices..." << endl;

    vector<string> devices = discover_devices();

    cout << "\nDiscovered Devices:\n";
    for (const auto& d : devices) {
        cout << " - " << d << endl;
    }

    return 0;
}