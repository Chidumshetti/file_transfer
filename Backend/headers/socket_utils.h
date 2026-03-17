#pragma once

#ifdef _WIN32
    #define _WIN32_WINNT 0x0600   // Enable modern Winsock APIs

    #include <winsock2.h>
    #include <ws2tcpip.h>         // REQUIRED for inet_ntop, getaddrinfo

    typedef SOCKET socket_t;

    // Windows doesn't have socklen_t → define it
    typedef int socklen_t;

#else
    #include <unistd.h>
    #include <sys/socket.h>
    #include <arpa/inet.h>
    typedef int socket_t;
#endif

// Cross-platform socket lifecycle helpers
void init_sockets();
void cleanup_sockets();
void close_socket(socket_t sock);
