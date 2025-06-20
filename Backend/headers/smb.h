#include <windows.h>
#include <iostream>

using namespace std;

bool copy_file_smb(const string& local_file, const string& remote_path);
    
bool copy_file_robocopy(const string& local_file, const string& remote_folder);