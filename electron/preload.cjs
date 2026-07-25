const { contextBridge, ipcRenderer } = require("electron");

try {
  contextBridge.exposeInMainWorld("electronAPI", {
    listPrinters: () => ipcRenderer.invoke("printer:list"),
    printHTML: (payload) => ipcRenderer.invoke("printer:print-html", payload),
    platform: process.platform,
    version: process.versions.electron,
  });
} catch (err) {
  console.error("Preload error:", err);
}