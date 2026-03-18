import React, { useState } from 'react';

const DeviceNamePopup = ({ onComplete }) => {
  const [deviceName, setDeviceName] = useState("");
  const [nameError, setNameError] = useState("");
  const addon = window.addon;

  const handleSave = () => {
    const trimmed = deviceName.trim();
    if (!trimmed) {
      setNameError("Please enter a device name.");
      return;
    }
    try {
      addon.setDeviceName(trimmed);
      localStorage.setItem("deviceNameSet", "true");
      localStorage.setItem("deviceName", trimmed);
      onComplete();
    } catch (e) {
      setNameError(e.message || "Failed to save name.");
    }
  };

  return (
    <div style={styles.backdrop}>
      <div style={styles.modal}>

        <div style={styles.topBar}>
          <span style={styles.topLabel}>SYSTEM SETUP</span>
          <span style={styles.topNum}>01 / 01</span>
        </div>

        <h2 style={styles.title}>Device Identity</h2>
        <p style={styles.desc}>
          Assign a name to this machine. It will be broadcast to other devices during network discovery.
        </p>

        <div style={styles.inputWrapper}>
          <span style={styles.inputPrefix}>&gt;</span>
          <input
            style={styles.input}
            type="text"
            value={deviceName}
            onChange={(e) => {
              setDeviceName(e.target.value);
              if (nameError) setNameError("");
            }}
            placeholder="e.g. OFFICE-PC or LAPTOP-01"
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            autoFocus
          />
        </div>

        {nameError && (
          <div style={styles.errorRow}>
            <span style={styles.errorDot}></span>
            <span style={styles.errorText}>{nameError}</span>
          </div>
        )}

        <div style={styles.footer}>
          <button style={styles.btn} onClick={handleSave}>
            SAVE
          </button>
        </div>

      </div>
    </div>
  );
};

const MONO = "'Courier New', 'Lucida Console', monospace";

const styles = {
  backdrop: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0,0,0,0.85)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modal: {
    backgroundColor: "#111",
    border: "1px solid #2a2a2a",
    borderTop: "2px solid #2e7fd9",
    padding: "40px 48px",
    width: "460px",
    maxWidth: "90vw",
    boxShadow: "0 0 60px rgba(0,0,0,0.8)",
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "28px",
  },
  topLabel: {
    fontFamily: MONO,
    fontSize: "10px",
    letterSpacing: "4px",
    color: "#2e7fd9",
  },
  topNum: {
    fontFamily: MONO,
    fontSize: "10px",
    letterSpacing: "2px",
    color: "#333",
  },
  title: {
    fontFamily: MONO,
    fontSize: "22px",
    fontWeight: "700",
    color: "#fff",
    letterSpacing: "3px",
    textTransform: "uppercase",
    margin: "0 0 16px 0",
  },
  desc: {
    fontFamily: MONO,
    fontSize: "12px",
    color: "#555",
    lineHeight: "1.7",
    letterSpacing: "0.4px",
    marginBottom: "32px",
  },
  inputWrapper: {
    display: "flex",
    alignItems: "center",
    border: "1px solid #2e7fd9",
    backgroundColor: "#0a0a0a",
    padding: "0 14px",
    marginBottom: "12px",
  },
  inputPrefix: {
    fontFamily: MONO,
    fontSize: "14px",
    color: "#2e7fd9",
    marginRight: "10px",
    userSelect: "none",
  },
  input: {
    flex: 1,
    background: "transparent",
    border: "none",
    outline: "none",
    fontFamily: MONO,
    fontSize: "13px",
    color: "#e0e0e0",
    letterSpacing: "2px",
    padding: "14px 0",
    textTransform: "uppercase",
  },
  errorRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "12px",
  },
  errorDot: {
    width: "5px",
    height: "5px",
    borderRadius: "50%",
    backgroundColor: "#c0392b",
    flexShrink: 0,
  },
  errorText: {
    fontFamily: MONO,
    fontSize: "11px",
    color: "#c0392b",
    letterSpacing: "1px",
  },
  footer: {
    marginTop: "32px",
    borderTop: "1px solid #1e1e1e",
    paddingTop: "24px",
  },
  btn: {
    background: "#2e7fd9",
    border: "none",
    color: "#fff",
    fontFamily: MONO,
    fontSize: "12px",
    letterSpacing: "3px",
    padding: "14px 36px",
    cursor: "pointer",
    textTransform: "uppercase",
    width: "100%",
  },
};

export default DeviceNamePopup;