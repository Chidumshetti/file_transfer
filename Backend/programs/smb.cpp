# include "../headers/smb.h"
bool copy_file_smb(const string& local_file, const string& remote_path) {
    if (CopyFile(local_file.c_str(), remote_path.c_str(), FALSE)) {
        cout << "File copied successfully to " << remote_path << endl;
        return true;
    } else {
        cerr << "Failed to copy file! Error: " << GetLastError() << endl;
        return false;
    }
}

bool copy_file_robocopy(const string& local_file, const string& remote_folder) {
    string command = "robocopy \"" + local_file + "\" \"" + remote_folder + "\" /MT:32 /R:1 /W:1";
    int result = system(command.c_str());
    return (result >= 0 && result <= 7); 
}