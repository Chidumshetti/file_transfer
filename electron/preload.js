const { contextBridge, ipcRenderer } = require("electron");
const path = require("path");

// In packaged exe: resources/wraperfunction.node
// In dev: __dirname/wraperfunction.node
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

contextBridge.exposeInMainWorld("addon", {
  runTransfer: addon.runTransfer,
  scanNetwork: addon.scanNetwork,
  getLocalIP: addon.getLocalIP,
  startDiscoveryListener: addon.startDiscoveryListener,
  isDeviceNameSet: addon.isDeviceNameSet,
  getDeviceName: addon.getDeviceName,
  setDeviceName: addon.setDeviceName,
});

contextBridge.exposeInMainWorld("electronAPI", {
  selectDirectory: () => ipcRenderer.invoke("select-directory"),
});