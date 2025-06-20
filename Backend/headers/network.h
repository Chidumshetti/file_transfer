#define _WIN32_WINNT 0x0600 
#include <iostream>
#include <string>
#include <winsock2.h>
#include <ws2tcpip.h> 
#include <sstream>  
#include <fstream>  
#include <vector>
#include <regex>    
#include <cstdlib>
#include <cstdio>

#pragma comment(lib, "ws2_32.lib")

using namespace std;

string get_network_ip();
string get_subnet(const string& ip);
void scan_network(const string& subnet, const string& local_ip);
