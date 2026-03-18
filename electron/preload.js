const addon = require("./wraperfunction.node");
const { contextBridge, ipcRenderer } = require("electron");

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
