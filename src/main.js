const { app, BrowserWindow, screen, Menu } = require("electron");
const path = require("path");

let petWindow;
let moveTimer;
let target = null;
let direction = 1;

const PET_SIZE = 86;
const SPEED = 0.85;
const TICK_MS = 35;

function getWorkArea() {
  if (!petWindow || petWindow.isDestroyed()) {
    return screen.getPrimaryDisplay().workArea;
  }

  const [x, y] = petWindow.getPosition();
  return screen.getDisplayNearestPoint({ x, y }).workArea;
}

function chooseTarget() {
  const a = getWorkArea();
  const margin = 8;
  target = {
    x: a.x + margin + Math.random() * Math.max(1, a.width - PET_SIZE - margin * 2),
    y: a.y + margin + Math.random() * Math.max(1, a.height - PET_SIZE - margin * 2)
  };
}

function moveMochi() {
  if (!petWindow || petWindow.isDestroyed()) return;
  if (!target) chooseTarget();

  const [x, y] = petWindow.getPosition();
  const dx = target.x - x;
  const dy = target.y - y;
  const distance = Math.hypot(dx, dy);

  if (distance < 8) {
    target = null;
    petWindow.webContents.send("mochi-state", "idle");
    return;
  }

  direction = dx < 0 ? -1 : 1;
  const step = Math.min(SPEED, distance);
  petWindow.setPosition(
    Math.round(x + (dx / distance) * step),
    Math.round(y + (dy / distance) * step),
    false
  );
  petWindow.webContents.send("mochi-direction", direction);
  petWindow.webContents.send("mochi-state", "walk");
}

function startMovement() {
  clearInterval(moveTimer);
  chooseTarget();
  moveTimer = setInterval(moveMochi, TICK_MS);
}

function pauseMovement() {
  clearInterval(moveTimer);
  moveTimer = null;
  target = null;
  petWindow?.webContents.send("mochi-state", "idle");
}

function createPet() {
  const a = screen.getPrimaryDisplay().workArea;

  petWindow = new BrowserWindow({
    width: PET_SIZE,
    height: PET_SIZE,
    x: a.x + a.width - PET_SIZE - 24,
    y: a.y + a.height - PET_SIZE - 24,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    hasShadow: false,
    skipTaskbar: true,
    show: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js")
    }
  });

  petWindow.setMenuBarVisibility(false);
  petWindow.loadFile(path.join(__dirname, "index.html"));

  petWindow.webContents.once("did-finish-load", () => {
    petWindow.webContents.send("mochi-state", "idle");
    setTimeout(startMovement, 700);
  });

  petWindow.on("closed", () => {
    clearInterval(moveTimer);
    petWindow = null;
  });

  petWindow.webContents.on("context-menu", () => {
    Menu.buildFromTemplate([
      { label: "Pause", click: pauseMovement },
      { label: "Resume", click: startMovement },
      { type: "separator" },
      {
        label: "Stay here",
        click: () => {
          pauseMovement();
          petWindow.webContents.send("mochi-state", "idle");
        }
      },
      { type: "separator" },
      { label: "Exit Mochi", click: () => app.quit() }
    ]).popup();
  });
}

app.whenReady().then(createPet);
app.on("window-all-closed", e => e.preventDefault());
