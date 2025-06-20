#include "../headers/network.h"
#include "../headers/smb.h"
#include "../headers/zipper.h"
#include "../headers/port.h"
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

    // Scan the network
    scan_network(subnet, local_ip);

    // Ask the user for a directory to zip
    cout << "\nEnter directory path to zip: ";
    string dir_path;
    cin >> dir_path;

    string zipped_file = zip_directory(dir_path);
    if (zipped_file.empty()) {
        cerr << "Zipping failed!" << endl;
        return 1;
    }
    cout << "Zipped file: " << zipped_file << endl;

    // Ask the user for target details
    cout << "\nEnter target IP for file transfer: ";
    string target_ip;
    cin >> target_ip;

    if((copy_file_smb(zipped_file, "E:\\"))){
        cout<<"File trasfered succefully !";
    } 
    else {
        cout<<"Unsuccesfull !";
    }

    if(copy_file_robocopy(zipped_file, "E:\\")){
        cout<<"File trasfered succefully !";
    } 
    else {
        cout<<"Unsuccesfull !";
    }

    cout << "\nOperations complete!\n";
    return 0;
}
