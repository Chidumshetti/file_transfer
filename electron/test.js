const addon = require('./wraperfunction.node');

console.log("Receiver running...");

addon.startDiscoveryListener(); // Make sure you exposed this in addon

// Keep Node process alive
setInterval(() => {}, 1 << 30);