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

    #define INVALID_SOCKET  INVALID_SOCKET  // already defined by winsock2.h
    #define close_sock      closesocket

#else
    #include <unistd.h>
    #include <sys/socket.h>
    #include <sys/types.h>
    #include <arpa/inet.h>
    #include <netinet/in.h>
    #include <netdb.h>          // ✅ getaddrinfo, freeaddrinfo, addrinfo
    #include <ifaddrs.h>        // ✅ getifaddrs, freeifaddrs
    #include <net/if.h>
    #include <cerrno>

    typedef int socket_t;

    // ✅ Define Windows constants so shared code compiles on Linux too
    #define INVALID_SOCKET  (-1)
    #define SOCKET_ERROR    (-1)
    #define close_sock      close

#endif

// Cross-platform socket lifecycle helpers
void init_sockets();
void cleanup_sockets();
void close_socket(socket_t sock);