const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: "#f8fafc",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
      allowRunningInsecureContent: true,
    },
    autoHideMenuBar: true,
    title: "Phone Shop",
  });

  win.once("ready-to-show", () => {
    win.show();
    win.maximize();
  });

  if (isDev) {
    const tryLoad = () => {
      win.loadURL("http://127.0.0.1:5173").catch(() => {
        setTimeout(tryLoad, 1000);
      });
    };
    tryLoad();
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  win.on("unresponsive", () => {
    console.log("Window unresponsive - reloading...");
    win.webContents.reload();
  });

  return win;
}

app.commandLine.appendSwitch("disable-features", "OutOfBlinkCors");
app.commandLine.appendSwitch("disable-site-isolation-trials");

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ✅ جلب الطابعات
ipcMain.handle("printer:list", async () => {
  try {
    const wins = BrowserWindow.getAllWindows();
    if (!wins.length) return [];
    const printers = await wins[0].webContents.getPrintersAsync();
    return printers.map((p) => ({
      name: p.name,
      displayName: p.displayName || p.name,
      isDefault: p.isDefault,
      status: p.status,
    }));
  } catch (err) {
    console.error("Error listing printers:", err);
    return [];
  }
});

// ✅ طباعة HTML
ipcMain.handle("printer:print-html", async (_, payload) => {
  try {
    const { html, printerName, widthMM, heightMM, columns, landscape, copies } = payload;

    const printWin = new BrowserWindow({
      show: false,
      width: 800,
      height: 600,
      webPreferences: {
        sandbox: false,
        javascript: true,
        webSecurity: false,
      },
    });

    await printWin.loadURL(
      "data:text/html;charset=UTF-8," + encodeURIComponent(html)
    );

    await new Promise((r) => setTimeout(r, 800));

    const printers = await printWin.webContents.getPrintersAsync();

    let target = null;
    if (printerName && printerName.trim()) {
      target =
        printers.find((p) => p.name === printerName) ||
        printers.find((p) => p.name.toLowerCase().includes(printerName.toLowerCase())) ||
        printers.find((p) => (p.displayName || "").toLowerCase().includes(printerName.toLowerCase()));
    }

    const opts = {
      silent: !!target,
      printBackground: true,
      color: true,
      landscape: !!landscape,
      copies: Math.max(1, copies || 1),
      margins: { marginType: "none" },
      ...(target ? { deviceName: target.name } : {}),
    };

    if ((columns || 1) <= 1) {
      opts.pageSize = {
        width: Math.round((widthMM || 40) * 1000),
        height: Math.round((heightMM || 30) * 1000),
      };
    }

    const result = await new Promise((resolve) => {
      printWin.webContents.print(opts, (success, reason) => {
        resolve({ success, failureReason: reason || "" });
      });
    });

    printWin.close();
    return result;
  } catch (err) {
    console.error("Print error:", err);
    return { success: false, failureReason: err?.message || "Unknown error" };
  }
});