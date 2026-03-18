# FileTransfer

> **Blazing-fast LAN file transfer** — no internet, no cloud, no limits. Transfer files between devices on the same network at full local network speed.

---

## ⚡ Performance

| Metric | Value |
|---|---|
| Transfer speed | Up to **1 Gbps** (wire speed on LAN) |
| Discovery time | < **3 seconds** (UDP broadcast) |
| CPU usage during transfer | < 5% |
| Latency | < 1ms (local network) |
| File size limit | None |

FileTransfer uses a **native C++ addon** compiled directly into Node.js via N-API. All networking — socket creation, UDP broadcast discovery, TCP file transfer — runs in compiled native code, not interpreted JavaScript. This is why it's fast.

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Electron Shell                        │
│  ┌─────────────────────┐   ┌────────────────────────┐   │
│  │   React Frontend    │   │      main.js           │   │
│  │   (Vite + React)    │◄──│   (Electron Main)      │   │
│  │                     │   │                        │   │
│  │  - Device Discovery │   │  - Window management   │   │
│  │  - File Send UI     │   │  - IPC bridge          │   │
│  │  - Receive Panel    │   │  - App lifecycle       │   │
│  └─────────────────────┘   └──────────┬─────────────┘   │
└─────────────────────────────────────  │ ─────────────────┘
                                        │ N-API calls
                              ┌─────────▼─────────────┐
                              │  wraperfunction.node   │
                              │  (Native C++ Addon)    │
                              │                        │
                              │  - get_network_ip()    │
                              │  - discover_devices()  │
                              │  - start_listener()    │
                              │  - send_file()         │
                              │  - receive_file()      │
                              └─────────┬──────────────┘
                                        │
                              ┌─────────▼──────────────┐
                              │   Backend C++ Layer     │
                              │                        │
                              │  network.cpp           │
                              │  - UDP broadcast       │
                              │  - TCP file transfer   │
                              │  - IP resolution       │
                              │  socket_utils.cpp      │
                              │  - Cross-platform      │
                              │    socket lifecycle    │
                              └────────────────────────┘
```

### How a file transfer works

```
Sender                                    Receiver
  │                                          │
  │── UDP Broadcast "DISCOVER_APP" ─────────►│
  │◄── UDP Reply "APP_HERE:<device>" ────────│
  │                                          │
  │── TCP Connect ──────────────────────────►│
  │── File metadata (name, size) ───────────►│
  │── File chunks (raw bytes) ──────────────►│
  │◄── ACK ──────────────────────────────────│
  │                                          │
```

---

## 📁 Repo Structure

```
file_transfer/
├── addon/                  # Node.js native addon (node-gyp)
│   ├── wraperfunction.cpp  # N-API bindings — exposes C++ to JS
│   ├── binding.gyp         # Build config for node-gyp
│   └── package.json        # addon dependencies (node-addon-api)
│
├── Backend/                # Core C++ networking library
│   ├── headers/
│   │   ├── network.h       # Network function declarations
│   │   └── socket_utils.h  # Cross-platform socket abstractions
│   └── programs/
│       ├── network.cpp     # UDP discovery + TCP transfer logic
│       └── socket_utils.cpp# Socket init/cleanup (Winsock/POSIX)
│
├── frontend/               # React UI (Vite)
│   ├── src/
│   │   ├── SendPanel.jsx   # File sending interface
│   │   └── ReceivePanel.jsx# File receiving interface
│   └── package.json
│
├── electron/               # Electron shell
│   ├── main.js             # Main process + IPC handlers
│   ├── preload.js          # Context bridge (renderer ↔ main)
│   ├── package.json        # electron-builder config
│   └── wraperfunction.node # Compiled addon (copied from addon/)
│
├── config/
│   └── config.json         # Device name config
│
└── .github/
    └── workflows/
        └── ci.yml          # GitHub Actions — builds Linux + Windows
```

---

## 🔧 How It's Built

The build pipeline has 3 stages that must run in order:

### Stage 1 — Compile Native Addon
```bash
cd addon
npm install           # installs node-addon-api
node-gyp configure    # generates platform Makefile/vcxproj
node-gyp build        # compiles wraperfunction.cpp + Backend C++
# output: addon/build/Release/wraperfunction.node
cp build/Release/wraperfunction.node ../electron/
```

### Stage 2 — Build React Frontend
```bash
cd frontend
npm install
npm run build         # output: frontend/build/
cp -r build/ ../electron/build
```

### Stage 3 — Package with Electron Builder
```bash
cd electron
npm install
npx electron-builder --win --x64    # Windows → .exe installer
npx electron-builder --linux --x64  # Linux  → .AppImage + .deb
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- Python 3.x (for node-gyp)
- **Windows:** Visual Studio Build Tools 2019+
- **Linux:** `build-essential`, `libusb-1.0-0-dev`, `libudev-dev`

### Install & Run (Development)

```bash
# 1. Clone the repo
git clone https://github.com/chidumshetti/file_transfer.git
cd file_transfer

# 2. Build the native addon
cd addon && npm install && node-gyp rebuild
cp build/Release/wraperfunction.node ../electron/
cd ..

# 3. Build the frontend
cd frontend && npm install && npm run build
cp -r build/ ../electron/build
cd ..

# 4. Run Electron
cd electron && npm install
npm run electron
```

---

## 📦 CI/CD — GitHub Actions

| OS | Runner | Output |
|---|---|---|
| Ubuntu 22.04 | `ubuntu-22.04` | `.AppImage`, `.deb` |
| Ubuntu 24.04 | `ubuntu-24.04` | `.AppImage`, `.deb` |
| Windows | `windows-latest` | `.exe` (NSIS installer) |

### Releasing a new version

Tag a commit to trigger a GitHub Release with all binaries attached:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Binaries are automatically uploaded to the GitHub Releases page.

---

## 📊 Current Build Size

| Platform | Installer Size | Extracted Size |
|----------|----------------|----------------|
| Windows  |     ~85 MB     |    ~300 MB     |
| ubantu 22|     ~95 MB     |    ~300 MB     |
| Linux  24|     ~85 MB     |    ~300 MB     |

The bulk of the size is **Chromium**, which Electron bundles to render the React frontend. This is a known limitation of Electron.

---



## 🔭 Roadmap

### v2.0 — Tauri Migration (In Progress)

> **Target size: ~10–15 MB installed** (95% reduction from current 300 MB)

The next major version will replace Electron with **Tauri**, which uses the OS's built-in webview instead of bundling Chromium.

#### Why Tauri?

| | Electron (current) | Tauri (v2.0) |
|---|---|---|
| Installed size | ~300 MB | ~10–15 MB |
| RAM usage | ~150 MB | ~30 MB |
| Startup time | ~3–5 seconds | < 1 second |
| Chromium bundled | ✅ Yes (80% of size) | ❌ No (uses OS webview) |
| Rust backend | ❌ | ✅ |

#### Migration Plan

```
Current (Electron)              →    v2.0 (Tauri)
─────────────────────────────────────────────────
main.js (Node)                  →    src-tauri/main.rs (Rust)
preload.js + ipcRenderer        →    Tauri commands + fetch()
wraperfunction.node             →    Node sidecar process
React frontend (unchanged)      →    React frontend (unchanged) ✅
electron-builder                →    tauri build
```

The React frontend and C++ networking code remain **100% unchanged**. Only the Electron wrapper is replaced.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| UI | React 18, Vite |
| Desktop shell | Electron 29 |
| Native addon | C++ via N-API (node-addon-api) |
| Networking | Raw POSIX sockets / Winsock2 |
| Discovery | UDP broadcast on port 8888 |
| Transfer | TCP on port 8889 |
| Build tool | node-gyp, electron-builder |
| CI/CD | GitHub Actions |

---
