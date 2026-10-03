const { app, BrowserWindow, screen, Menu } = require("electron");
const path = require("path");

let petWindow;
let moveTimer;
let target = null;
let direction = 1;

const PET_SIZE = 82;
const SPEED = 1.2;
const TICK_MS = 30;

function getBounds() {
  const display = screen.getDisplayNearestPoint(
    petWindow ? petWindow.getPosition() : { x: 0, y: 0 }
  );
  return display.workArea;
}

function chooseTarget() {
  const area = getBounds();
  const margin = 12;

  target = {
    x: area.x + margin + Math.random() * Math.max(1, area.width - PET_SIZE - margin * 2),
    y: area.y + margin + Math.random() * Math.max(1, area.height - PET_SIZE - margin * 2)
  };
}

function moveMochi() {
  if (!petWindow || petWindow.isDestroyed() || petWindow.isMinimized()) return;

  if (!target) chooseTarget();

  const [x, y] = petWindow.getPosition();
  const dx = target.x - x;
  const dy = target.y - y;
  const distance = Math.hypot(dx, dy);

  if (distance < 8) {
    chooseTarget();
    return;
  }

  direction = dx >= 0 ? 1 : -1;

  const step = Math.min(SPEED, distance);
  const nextX = Math.round(x + (dx / distance) * step);
  const nextY = Math.round(y + (dy / distance) * step);

  petWindow.setPosition(nextX, nextY, false);
  petWindow.webContents.send("mochi-direction", direction);
}

function startMovement() {
  clearInterval(moveTimer);
  moveTimer = setInterval(moveMochi, TICK_MS);
}

function createPet() {
  const display = screen.getPrimaryDisplay();
  const { workArea } = display;

  petWindow = new BrowserWindow({
    width: PET_SIZE,
    height: PET_SIZE,
    x: workArea.x + workArea.width - PET_SIZE - 24,
    y: workArea.y + workArea.height - PET_SIZE - 24,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    hasShadow: false,
    skipTaskbar: true,
    backgroundColor: "rgba(0,0,0,0)",
    paintWhenInitiallyHidden: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js")
    }
  });

  petWindow.setMenuBarVisibility(false);
  petWindow.loadFile(path.join(__dirname, "index.html"));

  petWindow.webContents.on("did-finish-load", () => {
    chooseTarget();
    startMovement();
  });

  petWindow.on("closed", () => {
    clearInterval(moveTimer);
    petWindow = null;
  });

  petWindow.webContents.on("context-menu", () => {
    const menu = Menu.buildFromTemplate([
      {
        label: "Pause movement",
        click: () => clearInterval(moveTimer)
      },
      {
        label: "Resume movement",
        click: () => startMovement()
      },
      { type: "separator" },
      {
        label: "Stay here",
        click: () => {
          clearInterval(moveTimer);
          target = null;
        }
      },
      { type: "separator" },
      {
        label: "Exit Mochi",
        click: () => app.quit()
      }
    ]);

    menu.popup();
  });
}

app.whenReady().then(createPet);

app.on("window-all-closed", (event) => {
  event.preventDefault();
});
