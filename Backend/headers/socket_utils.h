#pragma once

#ifdef _WIN32
    #define _WIN32_WINNT 0x0600

    #include <winsock2.h>
    #include <ws2tcpip.h>
    #include <iphlpapi.h>
    #pragma comment(lib, "ws2_32.lib")
    #pragma comment(lib, "iphlpapi.lib")

    typedef SOCKET socket_t;
    typedef int socklen_t;

    // ✅ REMOVED the circular #define INVALID_SOCKET INVALID_SOCKET
    // winsock2.h already defines it — nothing needed here

#else
    #include <unistd.h>
    #include <sys/socket.h>
    #include <sys/types.h>
    #include <arpa/inet.h>
    #include <netinet/in.h>
    #include <netdb.h>
    #include <ifaddrs.h>
    #include <net/if.h>
    #include <cerrno>

    typedef int socket_t;

    #ifndef INVALID_SOCKET
      #define INVALID_SOCKET  (-1)
    #endif
    #ifndef SOCKET_ERROR
      #define SOCKET_ERROR    (-1)
    #endif

#endif

void init_sockets();
void cleanup_sockets();
void close_socket(socket_t sock);