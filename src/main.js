const { app, BrowserWindow, screen } = require("electron");
const path = require("path");

let petWindow;

function createPet() {
  const display = screen.getPrimaryDisplay();
  const { workArea } = display;

  petWindow = new BrowserWindow({
    width: 96,
    height: 96,
    x: workArea.x + workArea.width - 120,
    y: workArea.y + workArea.height - 130,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    hasShadow: false,
    skipTaskbar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  petWindow.loadFile(path.join(__dirname, "index.html"));
}

app.whenReady().then(createPet);

app.on("window-all-closed", (event) => {
  event.preventDefault();
});

app.on("activate", () => {
  if (!petWindow || petWindow.isDestroyed()) createPet();
});
