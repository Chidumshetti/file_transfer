#include "../headers/zipper.h"

string zip_directory(const string& directory) {
    string zipFile = directory + ".rar";
    string winrarPath = "E:\\FTP\\file_transfer\\winrar\\Rar.exe";
    string command = winrarPath + " a -r \"" + zipFile + "\" \"" + directory + "\" -y";
    
    FILE* pipe = _popen(command.c_str(), "r");
    if (!pipe) {
        cerr << "Failed to execute WinRAR" << endl;
        return "";
    }
    
    char buffer[256];
    while (fgets(buffer, sizeof(buffer), pipe) != nullptr) {
        cout << buffer;
        cout.flush();
    }
    
    int result = _pclose(pipe);
    if (result != 0) {
        cerr << "Failed to zip directory" << endl;
        return "";
    }
    
    cout << "[DONE] " << zipFile << endl;
    return zipFile;
}