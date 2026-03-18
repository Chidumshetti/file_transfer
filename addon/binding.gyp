{
  "targets": [
    {
      "target_name": "wraperfunction",
      "sources": [
        "./wraperfunction.cpp",
        "../Backend/programs/network.cpp",
        "../Backend/programs/Send_recieve.cpp",
        "../Backend/programs/socket_utils.cpp"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "../Backend/headers"
      ],
      "defines": [
        "NAPI_CPP_EXCEPTIONS",
        "_WINSOCK_DEPRECATED_NO_WARNINGS"
      ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "msvs_settings": {
        "VCCLCompilerTool": {
          "ExceptionHandling": 1
        }
      },
      "conditions": [
             ["OS=='win'", {
        "libraries": [ "-lws2_32", "-liphlpapi" ]
      }],
      ["OS=='linux'", {
        "libraries": [],
        "cflags": [ "-std=c++17" ]
      }]
      ]
    }
  ]
}