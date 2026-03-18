const addon = require('./wraperfunction.node');
const dgram = require('dgram');

console.log("=== DISCOVERY DIAGNOSTIC ===\n");

// 1. Show local IP
const localIp = addon.getLocalIP();
console.log("Local IP (from addon):", localIp);
console.log("Device name:", addon.getDeviceName());

// 2. Start listener
addon.startDiscoveryListener();
console.log("\n✅ Discovery listener started on UDP 8888");

// 3. Raw UDP test — manually send DISCOVER_APP and show ALL responses (no filtering)
setTimeout(() => {
  console.log("\n--- Raw UDP broadcast test (no filtering) ---");
  
  const client = dgram.createSocket('udp4');
  client.bind(() => {
    client.setBroadcast(true);
    
    const msg = Buffer.from('DISCOVER_APP');
    client.send(msg, 0, msg.length, 8888, '255.255.255.255', (err) => {
      if (err) console.log("❌ Broadcast send error:", err.message);
      else console.log("📡 Sent DISCOVER_APP broadcast to 255.255.255.255:8888");
    });
    
    client.on('message', (data, rinfo) => {
      console.log(`📩 Response from ${rinfo.address}:${rinfo.port} -> "${data.toString()}"`);
    });
    
    // Wait 4s for responses, then show addon scan results
    setTimeout(() => {
      client.close();
      console.log("\n--- Addon scanNetwork() results ---");
      const devices = addon.scanNetwork();
      console.log("Devices:", devices);
      if (devices.length === 0) {
        console.log("\n⚠️  No devices found. Possible causes:");
        console.log("   1. Windows Firewall blocking UDP 8888 (most likely)");
        console.log("   2. Other device not on the same subnet");
        console.log("   3. Other device's discovery listener not running");
        console.log("\n   Fix firewall (run as Admin):");
        console.log('   netsh advfirewall firewall add rule name="ShareAll Discovery" dir=in action=allow protocol=UDP localport=8888');
      }
      process.exit(0);
    }, 5000);
  });
}, 1000);
