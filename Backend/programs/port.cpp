#include "../headers/port.h"
bool start_tcp_server(int port) {
    // Initialize Winsock
    WSADATA wsaData;
    if (WSAStartup(MAKEWORD(2, 2), &wsaData) != 0) {
        cerr << "WSAStartup failed!" << endl;
        return false;
    }

    // Create a socket
    SOCKET server_socket = socket(AF_INET, SOCK_STREAM, 0);
    if (server_socket == INVALID_SOCKET) {
        cerr << "Socket creation failed! Error: " << WSAGetLastError() << endl;
        WSACleanup();
        return false;
    }

    // Configure server address structure
    sockaddr_in server_addr{};
    server_addr.sin_family = AF_INET;
    server_addr.sin_port = htons(port);
    server_addr.sin_addr.s_addr = INADDR_ANY; // Listen on all available interfaces

    // Bind socket
    if (bind(server_socket, (struct sockaddr*)&server_addr, sizeof(server_addr)) == SOCKET_ERROR) {
        cerr << "Binding failed! Error: " << WSAGetLastError() << endl;
        closesocket(server_socket);
        WSACleanup();
        return false;
    }

    // Listen for incoming connections
    if (listen(server_socket, SOMAXCONN) == SOCKET_ERROR) {
        cerr << "Listening failed! Error: " << WSAGetLastError() << endl;
        closesocket(server_socket);
        WSACleanup();
        return false;
    }

    cout << "TCP Server started successfully on port " << port << "!\n";
    
    // Accept incoming connection
    sockaddr_in client_addr{};
    int client_size = sizeof(client_addr);
    SOCKET client_socket = accept(server_socket, (struct sockaddr*)&client_addr, &client_size);
    if (client_socket == INVALID_SOCKET) {
        cerr << "Accepting connection failed! Error: " << WSAGetLastError() << endl;
        closesocket(server_socket);
        WSACleanup();
        return false;
    }

    cout << "Client connected! Ready to receive data...\n";

    // Buffer to receive file data
    char buffer[8192];
    ofstream output_file("received_file.zip", ios::binary);
    if (!output_file) {
        cerr << "Failed to create output file!" << endl;
        closesocket(client_socket);
        closesocket(server_socket);
        WSACleanup();
        return false;
    }

    int bytes_received;
    while ((bytes_received = recv(client_socket, buffer, sizeof(buffer), 0)) > 0) {
        output_file.write(buffer, bytes_received);
    }

    if (bytes_received == SOCKET_ERROR) {
        cerr << "Receiving data failed! Error: " << WSAGetLastError() << endl;
    } else {
        cout << "File received successfully!\n";
    }

    // Cleanup
    output_file.close();
    closesocket(client_socket);
    closesocket(server_socket);
    WSACleanup();

    return true;
}
