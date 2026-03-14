const addon = require("./wraperfunction.node");
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("addon", {
  runTransfer: addon.runTransfer,
  scanNetwork: addon.scanNetwork,
  getLocalIP: addon.getLocalIP
});
