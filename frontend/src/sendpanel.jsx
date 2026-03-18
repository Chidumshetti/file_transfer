import React, { useState } from 'react';

const SendPanel = ({ onNavigate }) => {
  const addon = window.addon;
  const electronAPI = window.electronAPI;
  const DEFAULT_PORT = "5000";

  const [step, setStep] = useState("scan"); // scan | select | transfer
  const [devices, setDevices] = useState([]);
  const [selectedIp, setSelectedIp] = useState("");

  const parseDevice = (raw) => {
    const match = raw.match(/^([\d.]+)\s*\((.+)\)$/);
    if (match) return { ip: match[1], name: match[2] };
    return { ip: raw.trim(), name: "Unknown" };
  };

  // "directory" now holds either a folder path (string) or a list of files (string[])
  const [directory, setDirectory] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]); // individual files if user picks files
  const [pickMode, setPickMode] = useState("folder"); // "folder" | "files"

  const [isScanning, setIsScanning] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferStatus, setTransferStatus] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [progress, setProgress] = useState(0);

  React.useEffect(() => {
    if (!addon) return;
    try { addon.getLocalIP && addon.getLocalIP(); } catch (e) {}
  }, [addon]);

  const handleScan = async () => {
    if (!addon) return;
    setIsScanning(true);
    setDevices([]);
    setSelectedIp("");
    setStep("scan");
    await new Promise(resolve => setTimeout(resolve, 50));
    try {
      const raw = addon.scanNetwork();
      const parsed = (raw || []).map(parseDevice);
      setDevices(parsed);
      setStep(parsed.length > 0 ? "select" : "scan");
    } catch (err) {
      setDevices([]);
      setStep("scan");
    } finally {
      setIsScanning(false);
    }
  };

  // ── Pick a folder ─────────────────────────────────────────────────────────
  const handlePickDirectory = async () => {
    if (!electronAPI) return;
    try {
      const selected = await electronAPI.selectDirectory();
      if (selected) {
        setDirectory(selected);
        setSelectedFiles([]);
        setPickMode("folder");
      }
    } catch (err) {
      console.error("Directory selection failed:", err);
    }
  };

  // ── Pick individual files ─────────────────────────────────────────────────
  const handlePickFiles = async () => {
    if (!electronAPI) return;
    try {
      const files = await electronAPI.selectFiles();
      if (files && files.length > 0) {
        setSelectedFiles(files);
        setDirectory(""); // clear folder selection
        setPickMode("files");
      }
    } catch (err) {
      console.error("File selection failed:", err);
    }
  };

  // The payload to transfer: if files were picked, use the parent dir of the
  // first file (the C++ sender walks the directory). If a folder was picked,
  // use that directly.
  const transferPayload = pickMode === "files" && selectedFiles.length > 0
    ? selectedFiles[0].replace(/[/\\][^/\\]+$/, "") // parent directory of first file
    : directory;

  const payloadReady = pickMode === "folder" ? !!directory : selectedFiles.length > 0;

  // ── Transfer ──────────────────────────────────────────────────────────────
  const handleTransfer = async () => {
    if (!selectedIp || !payloadReady) return;

    setIsTransferring(true);
    setTransferStatus(null);
    setStatusMessage("Initiating transfer...");
    setStep("transfer");
    setProgress(0);

    // Subscribe to live progress events from main process stdout intercept
    if (electronAPI?.onTransferProgress) {
      electronAPI.onTransferProgress((data) => {
        if (typeof data.progress === "number") {
          setProgress(data.progress);
          if (data.progress > 0 && data.progress < 100) {
            setStatusMessage(`Transferring... ${data.progress}%`);
          }
        }
        if (data.done) {
          setProgress(100);
          setTransferStatus("success");
          setStatusMessage("Transfer complete.");
          setIsTransferring(false);
          electronAPI.removeTransferProgressListener?.();
        }
        if (data.error) {
          setTransferStatus("error");
          setStatusMessage("Transfer failed. Check connection.");
          setIsTransferring(false);
          electronAPI.removeTransferProgressListener?.();
        }
      });
    }

    // Defer blocking call so React flushes UI first
    await new Promise(resolve => setTimeout(resolve, 80));

    try {
      const res = await new Promise((resolve, reject) => {
        setTimeout(() => {
          try {
            const result = addon.runTransfer("send", selectedIp, DEFAULT_PORT, transferPayload);
            resolve(result);
          } catch (err) { reject(err); }
        }, 0);
      });

      electronAPI?.removeTransferProgressListener?.();

      // Only update state if IPC events haven't already resolved it
      if (transferStatus === null) {
        setProgress(100);
        setTransferStatus(res === 0 ? "success" : "error");
        setStatusMessage(res === 0 ? "Transfer complete." : "Transfer failed. Check connection.");
      }
    } catch (err) {
      electronAPI?.removeTransferProgressListener?.();
      setProgress(0);
      setTransferStatus("error");
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsTransferring(false);
    }
  };

  const handleReset = () => {
    electronAPI?.removeTransferProgressListener?.();
    setStep("scan");
    setDevices([]);
    setSelectedIp("");
    setDirectory("");
    setSelectedFiles([]);
    setPickMode("folder");
    setTransferStatus(null);
    setStatusMessage("");
    setProgress(0);
  };

  // Display label for the chosen payload
  const payloadLabel = pickMode === "files" && selectedFiles.length > 0
    ? `${selectedFiles.length} file${selectedFiles.length > 1 ? "s" : ""} selected`
    : directory || null;

  return (
    <div style={styles.root}>
      <style>{`
        @keyframes scanPulse {
          0%, 100% { opacity: 0.15; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>

      <div style={styles.sidebar}>
        <div style={styles.logo}>XFER</div>
        <nav style={styles.nav}>
          <button style={{...styles.navBtn, ...styles.navBtnActive}}>SEND</button>
          <button style={styles.navBtn} onClick={() => onNavigate('receive')}>RECEIVE</button>
        </nav>
        <div style={styles.sidebarFooter}>
          <div style={styles.indicator}></div>
          <span style={styles.footerLabel}>NODE ACTIVE</span>
        </div>
      </div>

      <main style={styles.main}>
        <header style={styles.header}>
          <div>
            <div style={styles.headerLabel}>OUTBOUND TRANSFER</div>
            <h1 style={styles.headerTitle}>Send Files</h1>
            <div style={{ marginTop: 6, fontFamily: MONO, fontSize: 11, color: "#555" }}>
              DEVICE: <span style={{ color: "#2e7fd9" }}>
                {localStorage.getItem("deviceName") || "—"}
              </span>
            </div>
          </div>
          <div style={styles.stepTrack}>
            {["SCAN", "SELECT", "TRANSFER"].map((s, i) => (
              <div key={s} style={styles.stepItem}>
                <div style={{
                  ...styles.stepDot,
                  ...(["scan","select","transfer"].indexOf(step) >= i ? styles.stepDotActive : {})
                }}>{i+1}</div>
                <span style={{
                  ...styles.stepLabel,
                  ...(["scan","select","transfer"].indexOf(step) >= i ? styles.stepLabelActive : {})
                }}>{s}</span>
              </div>
            ))}
          </div>
        </header>

        <div style={styles.content}>

          {/* STEP 1 — SCAN */}
          <section style={styles.section}>
            <div style={styles.sectionHeader}>
              <span style={styles.sectionNum}>01</span>
              <span style={styles.sectionTitle}>Network Discovery</span>
            </div>
            <p style={styles.sectionDesc}>
              Scan your local network to locate available receiving devices before initiating transfer.
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

            {devices.length > 0 && (
              <div style={styles.ipGrid}>
                {devices.map((dev, i) => (
                  <div
                    key={i}
                    style={{...styles.ipTag, ...(selectedIp === dev.ip ? styles.ipTagSelected : {})}}
                    onClick={() => setSelectedIp(dev.ip)}
                  >
                    <span style={styles.ipDot}></span>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <span style={{ color: selectedIp === dev.ip ? "#e05a2b" : "#ccc", fontSize: "12px", fontWeight: "600" }}>{dev.name}</span>
                      <span style={{ fontSize: "10px", color: "#555" }}>{dev.ip}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {step !== "scan" && devices.length === 0 && (
              <div style={styles.emptyNote}>No devices found. Ensure receiver is active.</div>
            )}
          </section>

          <div style={styles.divider}></div>

          {/* STEP 2 — SELECT */}
          <section style={{...styles.section, ...(step === "scan" ? styles.sectionLocked : {})}}>
            <div style={styles.sectionHeader}>
              <span style={styles.sectionNum}>02</span>
              <span style={styles.sectionTitle}>Target &amp; Payload</span>
            </div>
            <p style={styles.sectionDesc}>
              Choose your target device and the files or folder to transmit.
            </p>

            {step !== "scan" && (
              <>
                {/* Target device */}
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>TARGET DEVICE</label>
                  <select
                    style={styles.select}
                    value={selectedIp}
                    onChange={e => setSelectedIp(e.target.value)}
                  >
                    <option value="">-- Select device --</option>
                    {devices.map((dev, i) => (
                      <option key={i} value={dev.ip}>{dev.name} — {dev.ip}</option>
                    ))}
                  </select>
                </div>

                {/* Payload — folder or files */}
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>SOURCE PAYLOAD</label>

                  {/* Toggle row */}
                  <div style={styles.pickToggleRow}>
                    <button
                      style={{...styles.pickToggleBtn, ...(pickMode === "folder" ? styles.pickToggleBtnActive : {})}}
                      onClick={() => setPickMode("folder")}
                    >FOLDER</button>
                    <button
                      style={{...styles.pickToggleBtn, ...(pickMode === "files" ? styles.pickToggleBtnActive : {})}}
                      onClick={() => setPickMode("files")}
                    >FILES</button>
                  </div>

                  {/* Folder picker */}
                  {pickMode === "folder" && (
                    <div style={styles.dirRow}>
                      <div style={styles.dirDisplay}>
                        {directory
                          ? directory
                          : <span style={styles.placeholder}>No folder selected</span>}
                      </div>
                      <button style={styles.btnSmall} onClick={handlePickDirectory}>BROWSE</button>
                    </div>
                  )}

                  {/* File picker */}
                  {pickMode === "files" && (
                    <div style={styles.dirRow}>
                      <div style={styles.dirDisplay}>
                        {selectedFiles.length > 0
                          ? <span style={{ color: "#e05a2b" }}>{selectedFiles.length} file{selectedFiles.length > 1 ? "s" : ""} selected</span>
                          : <span style={styles.placeholder}>No files selected</span>}
                      </div>
                      <button style={styles.btnSmall} onClick={handlePickFiles}>BROWSE</button>
                    </div>
                  )}

                  {/* File list preview */}
                  {pickMode === "files" && selectedFiles.length > 0 && (
                    <div style={styles.fileList}>
                      {selectedFiles.map((f, i) => (
                        <div key={i} style={styles.fileRow}>
                          <span style={styles.fileIcon}>›</span>
                          <span style={styles.fileName}>{f.replace(/.*[/\\]/, "")}</span>
                          <span style={styles.filePath}>{f}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </section>

          <div style={styles.divider}></div>

          {/* STEP 3 — TRANSFER */}
          <section style={{...styles.section, ...(step !== "select" && step !== "transfer" ? styles.sectionLocked : {})}}>
            <div style={styles.sectionHeader}>
              <span style={styles.sectionNum}>03</span>
              <span style={styles.sectionTitle}>Execute Transfer</span>
            </div>
            <p style={styles.sectionDesc}>
              Confirm target and payload, then initiate the transfer sequence.
            </p>

            {(step === "select" || step === "transfer") && (
              <>
                {/* Summary card */}
                {step === "select" && selectedIp && payloadReady && (
                  <div style={styles.summaryCard}>
                    <div style={styles.summaryRow}>
                      <span style={styles.summaryKey}>TARGET</span>
                      <span style={styles.summaryVal}>
                        {devices.find(d => d.ip === selectedIp)?.name || selectedIp} — {selectedIp}
                      </span>
                    </div>
                    <div style={styles.summaryRow}>
                      <span style={styles.summaryKey}>PAYLOAD</span>
                      <span style={styles.summaryVal}>{payloadLabel}</span>
                    </div>
                  </div>
                )}

                {step === "transfer" && (
                  <div style={styles.progressBlock}>
                    <div style={styles.progressHeader}>
                      <span style={styles.progressLabel}>TRANSFER PROGRESS</span>
                      <span style={styles.progressPct}>{progress}%</span>
                    </div>
                    <div style={styles.progressBar}>
                      <div style={{
                        ...styles.progressFill,
                        width: `${progress}%`,
                        ...(transferStatus === "error" ? styles.progressError : {}),
                        ...(transferStatus === "success" ? styles.progressSuccess : {})
                      }}></div>
                    </div>
                    <div style={{
                      ...styles.statusBadge,
                      ...(transferStatus === "success" ? styles.statusSuccess : {}),
                      ...(transferStatus === "error" ? styles.statusError : {}),
                      ...(isTransferring ? styles.statusRunning : {})
                    }}>
                      {isTransferring ? "IN PROGRESS" : transferStatus === "success" ? "SUCCESS" : transferStatus === "error" ? "FAILED" : "IDLE"}
                    </div>
                    {statusMessage && <div style={styles.statusMsg}>{statusMessage}</div>}
                  </div>
                )}

                <div style={styles.actionRow}>
                  <button
                    style={{
                      ...styles.btnPrimary,
                      ...((isTransferring || !selectedIp || !payloadReady) ? styles.btnDisabled : {})
                    }}
                    onClick={handleTransfer}
                    disabled={isTransferring || !selectedIp || !payloadReady}
                  >
                    {isTransferring ? "TRANSFERRING..." : "INITIATE TRANSFER"}
                  </button>
                  {(transferStatus === "success" || transferStatus === "error") && (
                    <button style={styles.btnGhost} onClick={handleReset}>RESET</button>
                  )}
                </div>
              </>
            )}
          </section>
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
  logo: { fontFamily: MONO, fontSize: "22px", fontWeight: "700", letterSpacing: "6px", color: "#fff", padding: "0 28px", marginBottom: "48px", borderLeft: "3px solid #e05a2b", paddingLeft: "28px" },
  nav: { display: "flex", flexDirection: "column", gap: "4px", padding: "0 16px", flex: 1 },
  navBtn: { background: "transparent", border: "none", color: "#666", fontFamily: MONO, fontSize: "12px", letterSpacing: "3px", padding: "12px 16px", textAlign: "left", cursor: "pointer", borderRadius: "4px", transition: "all 0.2s" },
  navBtnActive: { color: "#fff", backgroundColor: "#1e1e1e", borderLeft: "2px solid #e05a2b" },
  sidebarFooter: { padding: "0 28px", display: "flex", alignItems: "center", gap: "8px" },
  indicator: { width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#3db06e", boxShadow: "0 0 6px #3db06e88" },
  footerLabel: { fontFamily: MONO, fontSize: "10px", letterSpacing: "2px", color: "#444" },
  main: { flex: 1, display: "flex", flexDirection: "column" },
  header: { padding: "40px 48px 32px", borderBottom: "1px solid #1e1e1e", display: "flex", justifyContent: "space-between", alignItems: "flex-end" },
  headerLabel: { fontFamily: MONO, fontSize: "11px", letterSpacing: "4px", color: "#e05a2b", marginBottom: "8px" },
  headerTitle: { fontSize: "32px", fontWeight: "700", letterSpacing: "2px", color: "#fff", margin: 0, textTransform: "uppercase" },
  stepTrack: { display: "flex", gap: "32px", alignItems: "center" },
  stepItem: { display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" },
  stepDot: { width: "28px", height: "28px", borderRadius: "50%", border: "1px solid #333", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: "11px", color: "#444", transition: "all 0.3s" },
  stepDotActive: { borderColor: "#e05a2b", color: "#e05a2b", backgroundColor: "#1a0f0a" },
  stepLabel: { fontFamily: MONO, fontSize: "9px", letterSpacing: "2px", color: "#333" },
  stepLabelActive: { color: "#888" },
  content: { padding: "48px", flex: 1 },
  section: { marginBottom: "8px", transition: "opacity 0.3s" },
  sectionLocked: { opacity: 0.35, pointerEvents: "none" },
  sectionHeader: { display: "flex", alignItems: "baseline", gap: "16px", marginBottom: "12px" },
  sectionNum: { fontFamily: MONO, fontSize: "11px", color: "#e05a2b", letterSpacing: "1px" },
  sectionTitle: { fontSize: "15px", fontWeight: "700", letterSpacing: "2px", textTransform: "uppercase", color: "#ccc" },
  sectionDesc: { fontSize: "13px", color: "#555", marginBottom: "20px", letterSpacing: "0.5px", lineHeight: "1.6", fontFamily: MONO, maxWidth: "520px" },
  divider: { height: "1px", backgroundColor: "#1a1a1a", margin: "32px 0" },
  btn: { background: "transparent", border: "1px solid #444", color: "#ccc", fontFamily: MONO, fontSize: "12px", letterSpacing: "3px", padding: "12px 28px", cursor: "pointer", transition: "all 0.2s", textTransform: "uppercase" },
  btnPrimary: { background: "#e05a2b", border: "none", color: "#fff", fontFamily: MONO, fontSize: "12px", letterSpacing: "3px", padding: "14px 36px", cursor: "pointer", transition: "all 0.2s", textTransform: "uppercase" },
  btnGhost: { background: "transparent", border: "1px solid #333", color: "#666", fontFamily: MONO, fontSize: "11px", letterSpacing: "2px", padding: "14px 24px", cursor: "pointer", transition: "all 0.2s", textTransform: "uppercase" },
  btnSmall: { background: "transparent", border: "1px solid #333", color: "#888", fontFamily: MONO, fontSize: "10px", letterSpacing: "2px", padding: "10px 16px", cursor: "pointer", whiteSpace: "nowrap", textTransform: "uppercase" },
  btnDisabled: { opacity: 0.4, cursor: "not-allowed" },
  fieldGroup: { marginBottom: "20px" },
  label: { display: "block", fontFamily: MONO, fontSize: "10px", letterSpacing: "3px", color: "#555", marginBottom: "8px" },
  select: { background: "#161616", border: "1px solid #2a2a2a", color: "#ccc", fontFamily: MONO, fontSize: "13px", padding: "12px 16px", width: "400px", maxWidth: "100%", outline: "none" },
  dirRow: { display: "flex", gap: "8px", alignItems: "stretch" },
  dirDisplay: { flex: 1, background: "#161616", border: "1px solid #2a2a2a", padding: "12px 16px", fontFamily: MONO, fontSize: "12px", color: "#ccc", maxWidth: "400px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  placeholder: { color: "#333" },

  // Folder / Files toggle
  pickToggleRow: { display: "flex", gap: "4px", marginBottom: "10px" },
  pickToggleBtn: { background: "transparent", border: "1px solid #2a2a2a", color: "#555", fontFamily: MONO, fontSize: "10px", letterSpacing: "2px", padding: "7px 18px", cursor: "pointer", transition: "all 0.2s", textTransform: "uppercase" },
  pickToggleBtnActive: { borderColor: "#e05a2b", color: "#e05a2b", backgroundColor: "#1a0f0a" },

  // File list preview
  fileList: { marginTop: "10px", maxWidth: "480px", display: "flex", flexDirection: "column", gap: "4px", maxHeight: "120px", overflowY: "auto" },
  fileRow: { display: "flex", alignItems: "center", gap: "8px", padding: "5px 10px", backgroundColor: "#111", border: "1px solid #1e1e1e" },
  fileIcon: { fontFamily: MONO, color: "#e05a2b", fontSize: "14px", flexShrink: 0 },
  fileName: { fontFamily: MONO, fontSize: "11px", color: "#ccc", whiteSpace: "nowrap", flexShrink: 0 },
  filePath: { fontFamily: MONO, fontSize: "10px", color: "#333", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },

  // Summary card
  summaryCard: { marginBottom: "20px", padding: "16px", border: "1px solid #1e1e1e", backgroundColor: "#111", maxWidth: "480px" },
  summaryRow: { display: "flex", justifyContent: "space-between", marginBottom: "6px", gap: "16px" },
  summaryKey: { fontFamily: MONO, fontSize: "10px", letterSpacing: "2px", color: "#444", flexShrink: 0 },
  summaryVal: { fontFamily: MONO, fontSize: "11px", color: "#888", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },

  progressBlock: { marginBottom: "24px", maxWidth: "480px" },
  progressHeader: { display: "flex", justifyContent: "space-between", marginBottom: "8px" },
  progressLabel: { fontFamily: MONO, fontSize: "10px", letterSpacing: "3px", color: "#555" },
  progressPct: { fontFamily: MONO, fontSize: "10px", color: "#e05a2b" },
  progressBar: { height: "3px", backgroundColor: "#1e1e1e", marginBottom: "16px" },
  progressFill: { height: "100%", backgroundColor: "#e05a2b", transition: "width 0.3s ease" },
  progressError: { backgroundColor: "#c0392b" },
  progressSuccess: { backgroundColor: "#3db06e" },
  statusBadge: { display: "inline-block", fontFamily: MONO, fontSize: "10px", letterSpacing: "3px", padding: "6px 14px", border: "1px solid #2a2a2a", color: "#555", marginBottom: "12px" },
  statusRunning: { borderColor: "#e05a2b", color: "#e05a2b" },
  statusSuccess: { borderColor: "#3db06e", color: "#3db06e" },
  statusError: { borderColor: "#c0392b", color: "#c0392b" },
  statusMsg: { fontFamily: MONO, fontSize: "12px", color: "#555", letterSpacing: "0.5px" },
  actionRow: { display: "flex", gap: "12px", alignItems: "center" },
  ipGrid: { display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "16px" },
  ipTag: { display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", border: "1px solid #2a2a2a", backgroundColor: "#161616", fontFamily: MONO, fontSize: "12px", color: "#888", cursor: "pointer", transition: "all 0.2s" },
  ipTagSelected: { borderColor: "#e05a2b", color: "#e05a2b", backgroundColor: "#1a0f0a" },
  ipDot: { width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#3db06e", display: "inline-block" },
  emptyNote: { fontFamily: MONO, fontSize: "11px", color: "#444", letterSpacing: "1px", marginTop: "12px" },
  scanningBlock: { display: "flex", alignItems: "center", gap: "12px", marginTop: "16px" },
  scanningDots: { display: "flex", gap: "5px", alignItems: "center" },
  dot: { display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#e05a2b", animation: "scanPulse 1s infinite ease-in-out" },
  scanningLabel: { fontFamily: MONO, fontSize: "11px", letterSpacing: "2px", color: "#555" },
};

export default SendPanel;