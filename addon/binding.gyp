{
  "targets": [
    {
      "target_name": "wraperfunction",
      "sources": [
        "./wraperfunction.cpp",
        "../Backend/programs/network.cpp",
        "../Backend/programs/Send_recieve.cpp",
      ],
      "include_dirs": [
        "<!(node -p \"require('node-addon-api').include\")",
        "../backend/headers"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "defines": [ "NAPI_CPP_EXCEPTIONS" ],
      "msvs_settings": {
        "VCCLCompilerTool": {
          "ExceptionHandling": 1
        }
      }
    }
  ]
}


