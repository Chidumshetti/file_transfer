import React, { useState, useEffect } from 'react';
import './css/TransferPanel.css';
import transferGif from './assets/file.gif';

const TransferPanel = () => {
  const addon = window.addon;
  const electronAPI = window.electronAPI;
  const DEFAULT_PORT = "5000";

  const [mode, setMode] = useState("send");
  const [ip, setIp] = useState("");
  const [directory, setDirectory] = useState("");
  const [outputDir, setOutputDir] = useState("");
  const [result, setResult] = useState("");
  const [ips, setIps] = useState([]);
  const [localIp, setLocalIp] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);
  const [networkScanned, setNetworkScanned] = useState(false);
  const [showNamePopup, setShowNamePopup] = useState(false);
  const [deviceName, setDeviceName] = useState("");
  const [nameError, setNameError] = useState("");

  useEffect(() => {
    if (!addon) {
      console.error("❌ Native addon not found.");
    } else {
      console.log("✅ Native addon loaded:", addon);
      try {
        // Start UDP discovery listener so this device responds to scans
        addon.startDiscoveryListener && addon.startDiscoveryListener();
      } catch (e) {
        console.error("Failed to start discovery listener:", e);
      }

      try {
        const ip = addon.getLocalIP && addon.getLocalIP();
        if (ip) setLocalIp(ip);
      } catch (e) {
        console.error("Failed to get local IP:", e);
      }

      try {
        if (addon.isDeviceNameSet && !addon.isDeviceNameSet()) {
          setShowNamePopup(true);
        }
      } catch (e) {
        console.error("Failed to check device name:", e);
      }
    }
  }, []);

  const handleSaveName = () => {
    if (!addon) return;
    const trimmed = deviceName.trim();
    if (!trimmed) {
      setNameError("Please enter a device name.");
      return;
    }
    try {
      addon.setDeviceName(trimmed);
      setShowNamePopup(false);
      setNameError("");
    } catch (e) {
      setNameError(e.message || "Failed to save name.");
    }
  };

  const handlePickDirectory = async () => {
    if (!electronAPI) return;
    const selected = await electronAPI.selectDirectory();
    if (selected) setDirectory(selected);
  };

  const handlePickOutputDir = async () => {
    if (!electronAPI) return;
    const selected = await electronAPI.selectDirectory();
    if (selected) setOutputDir(selected);
  };

  const handleTransfer = async () => {
    if (!addon) return setResult("❌ Native addon not loaded.");

    if (mode === "send" && (!ip || !directory)) {
      return setResult("❗ Please select IP and directory.");
    }
    if (mode === "receive" && !outputDir) {
      return setResult("❗ Please select an output directory.");
    }

    try {
      setIsTransferring(true);
      setResult("⏳ Transferring files...");

      const res = await new Promise((resolve, reject) => {
        try {
          const result = addon.runTransfer(
            mode,
            mode === "send" ? ip : DEFAULT_PORT,
            mode === "send" ? DEFAULT_PORT : outputDir,
            directory
          );
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });

      setResult(res === 0 ? "✅ Transfer successful." : "❌ Transfer failed.");
    } catch (err) {
      setResult(`❌ Error: ${err.message}`);
    } finally {
      setIsTransferring(false);
    }
  };

  const handleScan = () => {
    if (!addon) return;
    try {
      const scannedIps = addon.scanNetwork();
      setIps(scannedIps || []);
      setNetworkScanned(true);
    } catch (err) {
      console.error("❌ Scan failed:", err);
      setIps([]);
      setNetworkScanned(false);
    }
  };

  return (
    <div className="transfer-container">
      <div className="panel-card">
        <h2>📁 File Transfer Tool</h2>
        {localIp && (
          <p><strong>Local IP:</strong> {localIp}</p>
        )}

        <label>
          Mode:&nbsp;
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="send">Send</option>
            <option value="receive">Receive</option>
          </select>
        </label>

        <br /><br />

        {mode === "send" && (
          <>
            {!networkScanned && (
              <>
                <button onClick={handleScan}>🔍 Scan Network for IPs</button>
                <p>Scan for available target devices before sending files.</p>
              </>
            )}

            {networkScanned && (
              <>
                <label>Select Target IP:</label>
                <select
                  value={ip}
                  onChange={(e) => setIp(e.target.value)}
                  style={{ width: "100%", marginBottom: "10px" }}
                >
                  <option value="">-- Select IP --</option>
                  {ips.map((ip, i) => (
                    <option key={i} value={ip}>
                      {ip}
                    </option>
                  ))}
                </select>

                <button onClick={handlePickDirectory}>📂 Choose Directory to Send</button>
                {directory && <p>📁 {directory}</p>}
              </>
            )}
          </>
        )}

        {mode === "receive" && (
          <>
            <button onClick={handlePickOutputDir}>📥 Choose Output Directory</button>
            {outputDir && <p>📁 {outputDir}</p>}
          </>
        )}

        <br />
        <button onClick={handleTransfer} disabled={isTransferring || (mode === "send" && !networkScanned)}>
          🚀 Run Transfer
        </button>

        {isTransferring && (
          <div className="transfer-animation">
            <img src={transferGif} alt="Transferring..." />
            <p>Transferring files...</p>
          </div>
        )}

        <p className="status"><strong>Status:</strong> {result}</p>

        {mode === "receive" && (
          <>
            <hr />
            <button onClick={handleScan}>🔍 Re-scan Network</button>
            <p><strong>Discovered IPs:</strong></p>
            <ul>
              {ips.length === 0 && <li>No IPs found</li>}
              {ips.map((ip, index) => (
                <li key={index}>{ip}</li>
              ))}
            </ul>
          </>
        )}
      </div>

      {showNamePopup && (
        <div className="device-name-modal-backdrop">
          <div className="device-name-modal">
            <h3>Set Device Name</h3>
            <p>This name will be shown to other devices on the network.</p>
            <input
              type="text"
              value={deviceName}
              onChange={(e) => {
                setDeviceName(e.target.value);
                if (nameError) setNameError("");
              }}
              placeholder="e.g. Office-PC or Laptop"
            />
            {nameError && <p className="error-text">{nameError}</p>}
            <div className="modal-actions">
              <button onClick={handleSaveName}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransferPanel;
