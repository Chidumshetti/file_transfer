const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");

app.disableHardwareAcceleration();
app.commandLine.appendSwitch("disable-gpu");
app.commandLine.appendSwitch("disable-gpu-compositing");
app.commandLine.appendSwitch("enable-software-rasterizer");
app.commandLine.appendSwitch("no-sandbox");

let mainWindow = null;

// ── Intercept C++ stdout and stream "Progress: N%" to renderer ───────────────
// Your addon calls std::cout << "Progress: 16%" — this catches every write and
// forwards the number to the renderer via IPC so React can update the bar live.
function patchStdoutForProgress(win) {
  const originalWrite = process.stdout.write.bind(process.stdout);

  process.stdout.write = (chunk, encoding, callback) => {
    // Always let it print normally in the terminal
    originalWrite(chunk, encoding, callback);

    const text = typeof chunk === "string" ? chunk : chunk.toString();

    // "Progress: 16%" or "Progress: 16"
    const match = text.match(/Progress[:\s]+(\d+)\s*%?/i);
    if (match && win && !win.isDestroyed()) {
      const pct = Math.min(parseInt(match[1], 10), 100);
      win.webContents.send("transfer-progress", { progress: pct });
    }

    // Completion signals
    if (/all files sent/i.test(text) || /all files received/i.test(text)) {
      if (win && !win.isDestroyed()) {
        win.webContents.send("transfer-progress", { progress: 100, done: true });
      }
    }

    // Error signals
    if (/connection failed/i.test(text) || /transfer failed/i.test(text)) {
      if (win && !win.isDestroyed()) {
        win.webContents.send("transfer-progress", { progress: 0, error: true });
      }
    }
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "build", "index.html"));

  // Start forwarding C++ progress output to the renderer
  patchStdoutForProgress(mainWindow);
}

// ── Pick a directory ──────────────────────────────────────────────────────────
ipcMain.handle("select-directory", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

// ── Pick one or more files ────────────────────────────────────────────────────
ipcMain.handle("select-files", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openFile", "multiSelections"],
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths; // string[]
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});