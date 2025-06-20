#include "../headers/network.h"
#include <iostream>
#include <winsock2.h>

#pragma comment(lib, "ws2_32.lib")  // Link Winsock library

using namespace std;

bool start_tcp_server(int port);