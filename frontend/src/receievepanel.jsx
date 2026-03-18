import React, { useState, useEffect, useRef } from 'react';

const ReceivePanel = ({ onNavigate }) => {
  const addon = window.addon;
  const electronAPI = window.electronAPI;
  const DEFAULT_PORT = "5000";

  const [outputDir, setOutputDir] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferStatus, setTransferStatus] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const [devices, setDevices] = useState([]);
  const [log, setLog] = useState([]);

  const parseDevice = (raw) => {
    const match = raw.match(/^([\d.]+)\s*\((.+)\)$/);
    if (match) return { ip: match[1], name: match[2] };
    return { ip: raw.trim(), name: "Unknown" };
  };

  const isTransferringRef = useRef(false);
  const keepAliveRef = useRef(null);
  const discoveryActiveRef = useRef(false);

  const addLog = (msg) => {
    const ts = new Date().toLocaleTimeString("en-US", { hour12: false });
    setLog(prev => [...prev.slice(-8), { ts, msg }]);
  };

  const stopDiscoveryListener = () => {
    if (!addon || !discoveryActiveRef.current) return;
    try {
      addon.stopDiscoveryListener && addon.stopDiscoveryListener();
      discoveryActiveRef.current = false;
      addLog("Discovery listener stopped");
    } catch (e) {
      console.error("Failed to stop discovery listener:", e);
    }
  };

  const startListener = () => {
    if (!addon) return;
    try {
      addon.startDiscoveryListener && addon.startDiscoveryListener();
      discoveryActiveRef.current = true;
      addLog("Discovery listener active");
    } catch (e) {
      console.error("Failed to start discovery listener:", e);
      addLog("Discovery listener failed — retrying in 5s");
      setTimeout(startListener, 5000);
    }
  };

  useEffect(() => {
    if (!addon) return;
    try { addon.getLocalIP && addon.getLocalIP(); } catch (e) {}
    startListener();
    return () => {
      if (keepAliveRef.current) clearInterval(keepAliveRef.current);
    };
  }, [addon]);

  useEffect(() => {
    isTransferringRef.current = isTransferring;
  }, [isTransferring]);

  // ── Pick output directory ─────────────────────────────────────────────────
  const handlePickOutputDir = async () => {
    if (!electronAPI) return;
    try {
      const selected = await electronAPI.selectDirectory();
      if (selected) {
        setOutputDir(selected);
        addLog(`Output directory set: ${selected}`);
      }
    } catch (err) {
      addLog("Directory selection failed");
    }
  };

  const handleScan = async () => {
    if (!addon) return;
    setIsScanning(true);
    setDevices([]);
    addLog("Scanning network...");
    await new Promise(resolve => setTimeout(resolve, 50));
    try {
      const raw = addon.scanNetwork();
      const parsed = (raw || []).map(parseDevice);
      setDevices(parsed);
      addLog(`Network scan complete — ${parsed.length} device(s) found`);
    } catch (err) {
      addLog("Network scan failed");
      setDevices([]);
    } finally {
      setIsScanning(false);
    }
  };

  // ── Receive ───────────────────────────────────────────────────────────────
  const handleReceive = async () => {
    if (!outputDir) return;

    // Stop discovery so port is free
    stopDiscoveryListener();

    setIsDiscovering(true);
    addLog("Preparing to listen...");
    await new Promise(resolve => setTimeout(resolve, 1200));
    setIsDiscovering(false);

    setIsListening(true);
    setIsTransferring(true);
    setTransferStatus("waiting");
    setStatusMessage("Listening on port " + DEFAULT_PORT + "...");
    setProgress(0);
    addLog(`Listening on port ${DEFAULT_PORT}`);

    // Subscribe to live progress events from main process stdout intercept
    if (electronAPI?.onTransferProgress) {
      electronAPI.onTransferProgress((data) => {
        if (typeof data.progress === "number") {
          setProgress(data.progress);
          if (data.progress > 0 && data.progress < 100) {
            setStatusMessage(`Receiving... ${data.progress}%`);
            addLog(`Progress: ${data.progress}%`);
          }
        }
        if (data.done) {
          setProgress(100);
          setTransferStatus("success");
          setStatusMessage("Files received successfully.");
          setIsListening(false);
          setIsTransferring(false);
          addLog("Transfer complete — files written to disk");
          electronAPI.removeTransferProgressListener?.();
          setTimeout(() => { startListener(); addLog("Discovery listener restarted"); }, 500);
        }
        if (data.error) {
          setTransferStatus("error");
          setStatusMessage("Receive failed. Transmission error.");
          setIsListening(false);
          setIsTransferring(false);
          addLog("Transfer failed");
          electronAPI.removeTransferProgressListener?.();
          setTimeout(() => { startListener(); addLog("Discovery listener restarted"); }, 500);
        }
      });
    }

    // Defer blocking call so React flushes UI first
    await new Promise(resolve => setTimeout(resolve, 80));

    try {
      const res = await new Promise((resolve, reject) => {
        setTimeout(() => {
          try {
            const result = addon.runTransfer("receive", DEFAULT_PORT, outputDir, "");
            resolve(result);
          } catch (err) { reject(err); }
        }, 0);
      });

      electronAPI?.removeTransferProgressListener?.();

      // Only update if IPC events haven't already resolved it
      if (transferStatus === "waiting" || transferStatus === null) {
        setProgress(100);
        const ok = res === 0;
        setTransferStatus(ok ? "success" : "error");
        setStatusMessage(ok ? "Files received successfully." : "Receive failed. Transmission error.");
        addLog(ok ? "Transfer complete — files written to disk" : "Transfer failed");
      }
    } catch (err) {
      electronAPI?.removeTransferProgressListener?.();
      setProgress(0);
      setTransferStatus("error");
      setStatusMessage(`Error: ${err.message}`);
      addLog(`Error: ${err.message}`);
    } finally {
      setIsListening(false);
      setIsTransferring(false);
      setTimeout(() => { startListener(); addLog("Discovery listener restarted"); }, 500);
    }
  };

  const handleReset = () => {
    electronAPI?.removeTransferProgressListener?.();
    setTransferStatus(null);
    setStatusMessage("");
    setProgress(0);
    setIsListening(false);
    setIsDiscovering(false);
    if (keepAliveRef.current) clearInterval(keepAliveRef.current);
    addLog("Session reset");
  };

  return (
    <div style={styles.root}>
      <style>{`
        @keyframes scanPulse {
          0%, 100% { opacity: 0.15; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes radarSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes fadeInUp {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={styles.sidebar}>
        <div style={styles.logo}>Share All</div>
        <nav style={styles.nav}>
          <button style={styles.navBtn} onClick={() => onNavigate('send')}>SEND</button>
          <button style={{...styles.navBtn, ...styles.navBtnActive}}>RECEIVE</button>
        </nav>
        <div style={styles.sidebarFooter}>
          <div style={{...styles.indicator, ...(isListening ? styles.indicatorActive : {})}}></div>
          <span style={styles.footerLabel}>{isListening ? "LISTENING" : "STANDBY"}</span>
        </div>
      </div>

      <main style={styles.main}>
        <header style={styles.header}>
          <div>
            <div style={styles.headerLabel}>INBOUND TRANSFER</div>
            <h1 style={styles.headerTitle}>Receive Files</h1>
            <div style={{ marginTop: 6, fontFamily: MONO, fontSize: 11, color: "#555" }}>
              DEVICE: <span style={{ color: "#2e7fd9" }}>
                {localStorage.getItem("deviceName") || "—"}
              </span>
            </div>
          </div>
          <div style={styles.portBadge}>
            <span style={styles.portLabel}>PORT</span>
            <span style={styles.portNum}>{DEFAULT_PORT}</span>
          </div>
        </header>

        <div style={styles.content}>
          <div style={styles.grid}>

            {/* Left column */}
            <div style={styles.leftCol}>

              {/* 01 — Output Directory */}
              <section style={styles.section}>
                <div style={styles.sectionHeader}>
                  <span style={styles.sectionNum}>01</span>
                  <span style={styles.sectionTitle}>Output Directory</span>
                </div>
                <p style={styles.sectionDesc}>
                  Designate where incoming files will be written upon receipt.
                </p>
                <button style={styles.btn} onClick={handlePickOutputDir}>
                  SELECT DIRECTORY
                </button>
                {outputDir && (
                  <div style={styles.dirDisplay}>
                    <span style={styles.dirIcon}>›</span>
                    <span style={styles.dirPath}>{outputDir}</span>
                  </div>
                )}
              </section>

              <div style={styles.divider}></div>

              {/* 02 — Receive Mode */}
              <section style={{...styles.section, ...(!outputDir ? styles.sectionLocked : {})}}>
                <div style={styles.sectionHeader}>
                  <span style={styles.sectionNum}>02</span>
                  <span style={styles.sectionTitle}>Receive Mode</span>
                </div>
                <p style={styles.sectionDesc}>
                  Open a socket on port {DEFAULT_PORT} and wait for an incoming transfer.
                </p>

                {isDiscovering && (
                  <div style={styles.discoveryBlock}>
                    <div style={styles.radarContainer}>
                      <div style={styles.radarOuter}>
                        <div style={styles.radarInner}></div>
                        <div style={styles.radarSweep}></div>
                      </div>
                    </div>
                    <div style={styles.discoveryTextBlock}>
                      <div style={styles.discoveryTitle}>INITIALIZING RECEIVER</div>
                      <div style={styles.discoverySubtext}>Opening socket on port {DEFAULT_PORT}...</div>
                      <div style={styles.discoveryDots}>
                        {[0,200,400].map(d => <span key={d} style={{...styles.dot, animationDelay: `${d}ms`}}></span>)}
                      </div>
                    </div>
                  </div>
                )}

                {transferStatus && (
                  <div style={styles.progressBlock}>
                    <div style={styles.progressHeader}>
                      <span style={styles.progressLabel}>RECEIVE PROGRESS</span>
                      <span style={styles.progressPct}>{progress}%</span>
                    </div>
                    <div style={styles.progressBar}>
                      <div style={{
                        ...styles.progressFill,
                        width: `${progress}%`,
                        ...(transferStatus === "error" ? styles.progressError : {}),
                        ...(transferStatus === "success" ? styles.progressSuccess : {}),
                        ...(transferStatus === "waiting" ? styles.progressWaiting : {}),
                      }}></div>
                    </div>
                    <div style={{
                      ...styles.statusBadge,
                      ...(transferStatus === "success" ? styles.statusSuccess : {}),
                      ...(transferStatus === "error" ? styles.statusError : {}),
                      ...(transferStatus === "waiting" ? styles.statusWaiting : {}),
                    }}>
                      {transferStatus === "waiting" ? "AWAITING SENDER" :
                       transferStatus === "success" ? "RECEIVED" :
                       transferStatus === "error" ? "FAILED" : "IDLE"}
                    </div>
                    {statusMessage && <div style={styles.statusMsg}>{statusMessage}</div>}
                  </div>
                )}

                <div style={styles.actionRow}>
                  <button
                    style={{
                      ...styles.btnPrimary,
                      ...(isTransferring ? styles.btnListening : {}),
                      ...(isDiscovering ? styles.btnListening : {}),
                      ...(!outputDir || isTransferring || isDiscovering ? styles.btnDisabled : {})
                    }}
                    onClick={handleReceive}
                    disabled={!outputDir || isTransferring || isDiscovering}
                  >
                    {isDiscovering ? "DISCOVERING..." : isTransferring ? "AWAITING TRANSFER..." : "RECEIVE"}
                  </button>
                  {(transferStatus === "success" || transferStatus === "error") && (
                    <button style={styles.btnGhost} onClick={handleReset}>RESET</button>
                  )}
                </div>
              </section>

              <div style={styles.divider}></div>

              {/* 03 — Network Scan */}
              <section style={styles.section}>
                <div style={styles.sectionHeader}>
                  <span style={styles.sectionNum}>03</span>
                  <span style={styles.sectionTitle}>Network Scan</span>
                </div>
                <p style={styles.sectionDesc}>
                  Optionally scan to verify sender devices visible on the network.
                </p>
                <button
                  style={{...styles.btn, ...(isScanning ? styles.btnDisabled : {})}}
                  onClick={handleScan}
                  disabled={isScanning}
                >
                  {isScanning ? "SCANNING..." : "SCAN NETWORK"}
                </button>

                {isScanning && (
                  <div style={styles.scanningBlock}>
                    <div style={styles.scanningDots}>
                      {[0,200,400].map(d => <span key={d} style={{...styles.dot, animationDelay: `${d}ms`}}></span>)}
                    </div>
                    <span style={styles.scanningLabel}>Probing network hosts...</span>
                  </div>
                )}

                {!isScanning && devices.length > 0 && (
                  <div style={styles.ipList}>
                    {devices.map((dev, i) => (
                      <div key={i} style={styles.ipRow}>
                        <span style={styles.ipDot}></span>
                        <span style={{ ...styles.ipText, color: "#ccc", fontWeight: "600" }}>{dev.name}</span>
                        <span style={{ ...styles.ipText, color: "#555", marginLeft: "8px" }}>{dev.ip}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Right column — Event log + system status */}
            <div style={styles.rightCol}>
              <div style={styles.logHeader}>
                <span style={styles.logTitle}>EVENT LOG</span>
                <span style={styles.logCount}>{log.length} entries</span>
              </div>
              <div style={styles.logBody}>
                {log.length === 0 && <div style={styles.logEmpty}>No events recorded.</div>}
                {log.map((entry, i) => (
                  <div key={i} style={styles.logEntry}>
                    <span style={styles.logTs}>{entry.ts}</span>
                    <span style={styles.logMsg}>{entry.msg}</span>
                  </div>
                ))}
              </div>

              <div style={styles.statusPanel}>
                <div style={styles.statusPanelTitle}>SYSTEM STATUS</div>
                <div style={styles.statusRow}>
                  <span style={styles.statusKey}>LISTENER</span>
                  <span style={{...styles.statusVal, ...(isListening ? styles.statusValOn : {})}}>
                    {isListening ? "ACTIVE" : "INACTIVE"}
                  </span>
                </div>
                <div style={styles.statusRow}>
                  <span style={styles.statusKey}>DISCOVERY</span>
                  <span style={{
                    ...styles.statusVal,
                    ...(discoveryActiveRef.current && !isTransferring ? styles.statusValOn : {})
                  }}>
                    {isTransferring || isDiscovering ? "STOPPED" : discoveryActiveRef.current ? "ACTIVE" : "INACTIVE"}
                  </span>
                </div>
                <div style={styles.statusRow}>
                  <span style={styles.statusKey}>PORT</span>
                  <span style={styles.statusVal}>{DEFAULT_PORT}</span>
                </div>
                <div style={styles.statusRow}>
                  <span style={styles.statusKey}>OUTPUT</span>
                  <span style={{...styles.statusVal, maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>
                    {outputDir || "—"}
                  </span>
                </div>
                <div style={styles.statusRow}>
                  <span style={styles.statusKey}>LAST STATUS</span>
                  <span style={{
                    ...styles.statusVal,
                    ...(transferStatus === "success" ? styles.statusValSuccess : {}),
                    ...(transferStatus === "error" ? styles.statusValError : {}),
                  }}>
                    {transferStatus === "success" ? "OK" : transferStatus === "error" ? "ERR" : "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const MONO = "'Courier New', 'Lucida Console', monospace";
const SANS = "'Trebuchet MS', 'Arial Narrow', sans-serif";

const styles = {
  root: { display: "flex", minHeight: "100vh", backgroundColor: "#0d0d0d", color: "#e0e0e0", fontFamily: SANS },
  sidebar: { width: "200px", minWidth: "200px", backgroundColor: "#111", borderRight: "1px solid #2a2a2a", display: "flex", flexDirection: "column", padding: "32px 0" },
  logo: { fontFamily: MONO, fontSize: "22px", fontWeight: "700", letterSpacing: "6px", color: "#fff", padding: "0 28px", marginBottom: "48px", borderLeft: "3px solid #2e7fd9", paddingLeft: "28px" },
  nav: { display: "flex", flexDirection: "column", gap: "4px", padding: "0 16px", flex: 1 },
  navBtn: { background: "transparent", border: "none", color: "#666", fontFamily: MONO, fontSize: "12px", letterSpacing: "3px", padding: "12px 16px", textAlign: "left", cursor: "pointer", borderRadius: "4px", transition: "all 0.2s" },
  navBtnActive: { color: "#fff", backgroundColor: "#1e1e1e", borderLeft: "2px solid #2e7fd9" },
  sidebarFooter: { padding: "0 28px", display: "flex", alignItems: "center", gap: "8px" },
  indicator: { width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#333", transition: "all 0.3s" },
  indicatorActive: { backgroundColor: "#2e7fd9", boxShadow: "0 0 8px #2e7fd988" },
  footerLabel: { fontFamily: MONO, fontSize: "10px", letterSpacing: "2px", color: "#444" },
  main: { flex: 1, display: "flex", flexDirection: "column" },
  header: { padding: "40px 48px 32px", borderBottom: "1px solid #1e1e1e", display: "flex", justifyContent: "space-between", alignItems: "flex-end" },
  headerLabel: { fontFamily: MONO, fontSize: "11px", letterSpacing: "4px", color: "#2e7fd9", marginBottom: "8px" },
  headerTitle: { fontSize: "32px", fontWeight: "700", letterSpacing: "2px", color: "#fff", margin: 0, textTransform: "uppercase" },
  portBadge: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" },
  portLabel: { fontFamily: MONO, fontSize: "9px", letterSpacing: "3px", color: "#444" },
  portNum: { fontFamily: MONO, fontSize: "28px", color: "#2e7fd9", letterSpacing: "4px" },
  content: { padding: "48px", flex: 1 },
  grid: { display: "flex", gap: "48px" },
  leftCol: { flex: "0 0 480px" },
  rightCol: { flex: 1, display: "flex", flexDirection: "column" },
  section: { marginBottom: "8px", transition: "opacity 0.3s" },
  sectionLocked: { opacity: 0.35, pointerEvents: "none" },
  sectionHeader: { display: "flex", alignItems: "baseline", gap: "16px", marginBottom: "12px" },
  sectionNum: { fontFamily: MONO, fontSize: "11px", color: "#2e7fd9", letterSpacing: "1px" },
  sectionTitle: { fontSize: "15px", fontWeight: "700", letterSpacing: "2px", textTransform: "uppercase", color: "#ccc" },
  sectionDesc: { fontSize: "13px", color: "#555", marginBottom: "20px", letterSpacing: "0.5px", lineHeight: "1.6", fontFamily: MONO, maxWidth: "420px" },
  divider: { height: "1px", backgroundColor: "#1a1a1a", margin: "32px 0" },
  btn: { background: "transparent", border: "1px solid #444", color: "#ccc", fontFamily: MONO, fontSize: "12px", letterSpacing: "3px", padding: "12px 28px", cursor: "pointer", transition: "all 0.2s", textTransform: "uppercase" },
  btnPrimary: { background: "#2e7fd9", border: "none", color: "#fff", fontFamily: MONO, fontSize: "12px", letterSpacing: "3px", padding: "14px 36px", cursor: "pointer", transition: "all 0.2s", textTransform: "uppercase" },
  btnListening: { background: "#1a4a80" },
  btnGhost: { background: "transparent", border: "1px solid #333", color: "#666", fontFamily: MONO, fontSize: "11px", letterSpacing: "2px", padding: "14px 24px", cursor: "pointer", transition: "all 0.2s", textTransform: "uppercase" },
  btnDisabled: { opacity: 0.4, cursor: "not-allowed" },
  dirDisplay: { display: "flex", alignItems: "center", gap: "8px", marginTop: "12px", padding: "10px 14px", border: "1px solid #1e1e1e", backgroundColor: "#141414", maxWidth: "420px" },
  dirIcon: { fontFamily: MONO, color: "#2e7fd9", fontSize: "16px" },
  dirPath: { fontFamily: MONO, fontSize: "12px", color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  progressBlock: { marginBottom: "24px", maxWidth: "420px" },
  progressHeader: { display: "flex", justifyContent: "space-between", marginBottom: "8px" },
  progressLabel: { fontFamily: MONO, fontSize: "10px", letterSpacing: "3px", color: "#555" },
  progressPct: { fontFamily: MONO, fontSize: "10px", color: "#2e7fd9" },
  progressBar: { height: "3px", backgroundColor: "#1e1e1e", marginBottom: "16px" },
  progressFill: { height: "100%", backgroundColor: "#2e7fd9", transition: "width 0.3s ease" },
  progressError: { backgroundColor: "#c0392b" },
  progressSuccess: { backgroundColor: "#3db06e" },
  progressWaiting: { backgroundColor: "#2e7fd9" },
  statusBadge: { display: "inline-block", fontFamily: MONO, fontSize: "10px", letterSpacing: "3px", padding: "6px 14px", border: "1px solid #2a2a2a", color: "#555", marginBottom: "12px" },
  statusWaiting: { borderColor: "#2e7fd9", color: "#2e7fd9" },
  statusSuccess: { borderColor: "#3db06e", color: "#3db06e" },
  statusError: { borderColor: "#c0392b", color: "#c0392b" },
  statusMsg: { fontFamily: MONO, fontSize: "12px", color: "#555", letterSpacing: "0.5px" },
  actionRow: { display: "flex", gap: "12px", alignItems: "center" },
  scanningBlock: { display: "flex", alignItems: "center", gap: "12px", marginTop: "16px" },
  scanningDots: { display: "flex", gap: "5px", alignItems: "center" },
  dot: { display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#2e7fd9", animation: "scanPulse 1s infinite ease-in-out" },
  scanningLabel: { fontFamily: MONO, fontSize: "11px", letterSpacing: "2px", color: "#555" },
  ipList: { marginTop: "12px", display: "flex", flexDirection: "column", gap: "6px" },
  ipRow: { display: "flex", alignItems: "center", gap: "10px" },
  ipDot: { width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#3db06e", display: "inline-block", flexShrink: 0 },
  ipText: { fontFamily: MONO, fontSize: "12px", color: "#666" },
  logHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", backgroundColor: "#111", border: "1px solid #1e1e1e", borderBottom: "none" },
  logTitle: { fontFamily: MONO, fontSize: "10px", letterSpacing: "3px", color: "#555" },
  logCount: { fontFamily: MONO, fontSize: "10px", color: "#333" },
  logBody: { flex: 1, minHeight: "200px", maxHeight: "280px", overflowY: "auto", backgroundColor: "#0a0a0a", border: "1px solid #1e1e1e", padding: "16px" },
  logEmpty: { fontFamily: MONO, fontSize: "11px", color: "#2a2a2a", letterSpacing: "1px" },
  logEntry: { display: "flex", gap: "16px", marginBottom: "8px", alignItems: "flex-start" },
  logTs: { fontFamily: MONO, fontSize: "10px", color: "#333", whiteSpace: "nowrap", flexShrink: 0 },
  logMsg: { fontFamily: MONO, fontSize: "11px", color: "#555", letterSpacing: "0.3px" },
  statusPanel: { border: "1px solid #1e1e1e", borderTop: "none", backgroundColor: "#111", padding: "16px" },
  statusPanelTitle: { fontFamily: MONO, fontSize: "9px", letterSpacing: "3px", color: "#333", marginBottom: "12px" },
  statusRow: { display: "flex", justifyContent: "space-between", marginBottom: "8px" },
  statusKey: { fontFamily: MONO, fontSize: "10px", letterSpacing: "2px", color: "#444" },
  statusVal: { fontFamily: MONO, fontSize: "10px", color: "#666" },
  statusValOn: { color: "#2e7fd9" },
  statusValSuccess: { color: "#3db06e" },
  statusValError: { color: "#c0392b" },
  discoveryBlock: { display: "flex", alignItems: "center", gap: "24px", padding: "24px", marginBottom: "24px", backgroundColor: "#0f1a26", border: "1px solid #1a3050", borderRadius: "4px", maxWidth: "420px", animation: "fadeInUp 0.4s ease-out" },
  radarContainer: { flexShrink: 0 },
  radarOuter: { width: "48px", height: "48px", borderRadius: "50%", border: "2px solid #1a3050", position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" },
  radarInner: { width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#2e7fd9", boxShadow: "0 0 12px #2e7fd9aa", zIndex: 2 },
  radarSweep: { position: "absolute", top: 0, left: "50%", width: "50%", height: "50%", transformOrigin: "bottom left", background: "conic-gradient(from 0deg, transparent, #2e7fd944)", animation: "radarSpin 1.5s linear infinite", zIndex: 1 },
  discoveryTextBlock: { display: "flex", flexDirection: "column", gap: "6px" },
  discoveryTitle: { fontFamily: MONO, fontSize: "11px", letterSpacing: "3px", color: "#2e7fd9", fontWeight: "700" },
  discoverySubtext: { fontFamily: MONO, fontSize: "11px", color: "#456", letterSpacing: "0.5px" },
  discoveryDots: { display: "flex", gap: "5px", alignItems: "center", marginTop: "4px" },
};

export default ReceivePanel;