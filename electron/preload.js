const { contextBridge, ipcRenderer } = require("electron");
const path = require("path");

// ── Load native addon ─────────────────────────────────────────────────────────
// In packaged exe: resources/wraperfunction.node
// In dev:          __dirname/wraperfunction.node
let addon;
try {
  addon = require(path.join(process.resourcesPath, "wraperfunction.node"));
  console.log("✅ Addon loaded from resources");
} catch (e) {
  try {
    addon = require(path.join(__dirname, "wraperfunction.node"));
    console.log("✅ Addon loaded from __dirname");
  } catch (e2) {
    console.error("❌ Addon load failed:", e2.message);
    addon = {};
  }
}

// ── Expose addon functions ────────────────────────────────────────────────────
contextBridge.exposeInMainWorld("addon", {
  runTransfer: (...args) => addon.runTransfer?.(...args),
  scanNetwork: (...args) => addon.scanNetwork?.(...args),
  getLocalIP: (...args) => addon.getLocalIP?.(...args),
  startDiscoveryListener: (...args) => addon.startDiscoveryListener?.(...args),
  stopDiscoveryListener: (...args) => addon.stopDiscoveryListener?.(...args),
  isDeviceNameSet: (...args) => addon.isDeviceNameSet?.(...args),
  getDeviceName: (...args) => addon.getDeviceName?.(...args),
  setDeviceName: (...args) => addon.setDeviceName?.(...args),
});

// ── Expose Electron / IPC APIs ────────────────────────────────────────────────
contextBridge.exposeInMainWorld("electronAPI", {

  // Pick a folder
  selectDirectory: () => ipcRenderer.invoke("select-directory"),

  // Pick one or more files — returns string[] of absolute paths
  selectFiles: () => ipcRenderer.invoke("select-files"),

  // ── Live progress ───────────────────────────────────────────────────────────
  // The main process intercepts C++ stdout "Progress: N%" and forwards here.
  // Call onTransferProgress(cb) before starting a transfer. Callback fires with:
  //   { progress: number }          — percentage update (0–100)
  //   { progress: 100, done: true } — transfer finished successfully
  //   { progress: 0,  error: true } — transfer failed
  onTransferProgress: (callback) => {
    ipcRenderer.removeAllListeners("transfer-progress");
    ipcRenderer.on("transfer-progress", (_event, data) => callback(data));
  },

  removeTransferProgressListener: () => {
    ipcRenderer.removeAllListeners("transfer-progress");
  },
});