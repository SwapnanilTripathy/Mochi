const { app, BrowserWindow, screen, Menu, Tray } = require("electron");
const path = require("path");
const fs = require("fs");

let petWindow;
let moveTimer;
let behaviorTimer;
let target = null;
let direction = 1;
let paused = false;
let sleeping = false;
let dragging = false;
let edgeSitting = false;
let curious = false;
let savedPosition = null;
let tray = null;

const PET_SIZE = 86;
const MIN_SPEED = 0.45;
const MAX_SPEED = 1.05;
const TICK_MS = 35;
const POSITION_FILE = path.join(app.getPath("userData"), "mochi-position.json");

function loadSavedPosition() {
  try {
    if (fs.existsSync(POSITION_FILE)) {
      const value = JSON.parse(fs.readFileSync(POSITION_FILE, "utf8"));
      if (Number.isFinite(value.x) && Number.isFinite(value.y)) savedPosition = value;
    }
  } catch {}
}

function savePosition() {
  if (!petWindow || petWindow.isDestroyed()) return;
  try {
    const [x, y] = petWindow.getPosition();
    fs.mkdirSync(path.dirname(POSITION_FILE), { recursive: true });
    fs.writeFileSync(POSITION_FILE, JSON.stringify({ x, y }));
  } catch {}
}

function createTray() {
  if (tray) return;
  tray = new Tray(path.join(__dirname, "assets", "idle", "idle-1.png"));
  tray.setToolTip("Mochi 🐺");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Show Mochi", click: () => {
      petWindow?.show();
      petWindow?.focus();
    }},
    { label: "Pause wandering", click: () => pauseMovement() },
    { label: "Resume wandering", click: () => startMovement() },
    { label: "Take a nap", click: () => nap() },
    { type: "separator" },
    { label: "Reset position", click: () => resetPosition() },
    { type: "separator" },
    { label: "Quit Mochi", click: () => app.quit() }
  ]));
  tray.on("double-click", () => {
    petWindow?.show();
    petWindow?.focus();
  });
}

function resetPosition() {
  const a = screen.getPrimaryDisplay().workArea;
  petWindow?.setPosition(
    a.x + a.width - PET_SIZE - 24,
    a.y + a.height - PET_SIZE - 24,
    false
  );
  savePosition();
}

function getWorkArea() {
  if (!petWindow || petWindow.isDestroyed()) return screen.getPrimaryDisplay().workArea;
  const [x, y] = petWindow.getPosition();
  return screen.getDisplayNearestPoint({ x, y }).workArea;
}

function send(state) {
  petWindow?.webContents.send("mochi-state", state);
}

function chooseTarget() {
  const a = getWorkArea();
  const margin = 12;
  const edgeRoll = Math.random();
  if (edgeRoll < 0.18) {
    const side = Math.floor(Math.random() * 4);
    edgeSitting = true;
    target = {
      x: side === 1 ? a.x + a.width - PET_SIZE : side === 3 ? a.x : a.x + margin + Math.random() * Math.max(1, a.width - PET_SIZE - margin * 2),
      y: side === 0 ? a.y : side === 2 ? a.y + a.height - PET_SIZE : a.y + margin + Math.random() * Math.max(1, a.height - PET_SIZE - margin * 2),
      speed: MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED),
      edge: true
    };
    return;
  }
  edgeSitting = false;
  target = {
    x: a.x + margin + Math.random() * Math.max(1, a.width - PET_SIZE - margin * 2),
    y: a.y + margin + Math.random() * Math.max(1, a.height - PET_SIZE - margin * 2),
    speed: MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED)
  };
}

function moveMochi() {
  if (!petWindow || petWindow.isDestroyed() || paused || sleeping || edgeSitting) return;

  const cursor = screen.getCursorScreenPoint();
  const mx = cursor.x;
  const my = cursor.y;
  const [px, py] = petWindow.getPosition();
  const cx = px + PET_SIZE / 2;
  const cy = py + PET_SIZE / 2;
  const cursorDistance = Math.hypot(mx - cx, my - cy);

  if (cursorDistance < 150) {
    if (!curious) {
      curious = true;
      target = null;
      send("curious");
    }

    direction = mx < cx ? -1 : 1;
    petWindow.webContents.send("mochi-direction", direction);

    // Slowly approach the cursor, but stop at a comfortable distance.
    if (cursorDistance > 72) {
      const dx = mx - cx;
      const dy = my - cy;
      const distance = Math.max(1, cursorDistance);
      const step = Math.min(0.65, distance - 72);
      petWindow.setPosition(
        Math.round(px + (dx / distance) * step),
        Math.round(py + (dy / distance) * step),
        false
      );
    }
    return;
  }

  if (curious) {
    curious = false;
    send("idle");
    chooseTarget();
    clearInterval(moveTimer);
    moveTimer = setInterval(moveMochi, TICK_MS);
  }
  if (!target) chooseTarget();

  const [x, y] = petWindow.getPosition();
  const dx = target.x - x;
  const dy = target.y - y;
  const distance = Math.hypot(dx, dy);

  if (distance < 8) {
    const wasEdge = !!target.edge;
    target = null;
    if (wasEdge) {
      edgeSitting = true;
      send("edge");
      clearInterval(moveTimer);
      setTimeout(() => {
        if (!paused && !dragging) {
          edgeSitting = false;
          chooseTarget();
          moveTimer = setInterval(moveMochi, TICK_MS);
        }
      }, 4500 + Math.random() * 4500);
    } else {
      send("idle");
    }
    return;
  }

  direction = dx < 0 ? -1 : 1;
  const step = Math.min(target.speed, distance);
  petWindow.setPosition(
    Math.round(x + (dx / distance) * step),
    Math.round(y + (dy / distance) * step),
    false
  );
  petWindow.webContents.send("mochi-direction", direction);
  send("walk");
}

function startMovement() {
  paused = false;
  sleeping = false;
  curious = false;
  clearInterval(moveTimer);
  chooseTarget();
  send("idle");
  moveTimer = setInterval(moveMochi, TICK_MS);
}

function pauseMovement() {
  paused = true;
  dragging = false;
  curious = false;
  target = null;
  clearInterval(moveTimer);
  send("idle");
}

function nap() {
  paused = false;
  sleeping = true;
  target = null;
  send("sleep");
  clearTimeout(behaviorTimer);
  behaviorTimer = setTimeout(() => {
    sleeping = false;
    send("idle");
    startBehaviorLoop();
  }, 7000);
}

function startBehaviorLoop() {
  clearTimeout(behaviorTimer);
  behaviorTimer = setTimeout(() => {
    if (!paused && !sleeping) {
      const roll = Math.random();
      if (roll < 0.16) {
        send("stretch");
        setTimeout(() => {
          if (!paused && !sleeping) startMovement();
        }, 1800);
      } else if (roll < 0.25) {
        nap();
      } else {
        startMovement();
      }
    }
    if (!sleeping) startBehaviorLoop();
  }, 7000 + Math.random() * 7000);
}

function createPet() {
  const a = screen.getPrimaryDisplay().workArea;
  loadSavedPosition();
  const startX = savedPosition?.x ?? (a.x + a.width - PET_SIZE - 24);
  const startY = savedPosition?.y ?? (a.y + a.height - PET_SIZE - 24);

  petWindow = new BrowserWindow({
    width: PET_SIZE,
    height: PET_SIZE,
    x: startX,
    y: startY,
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
  createTray();
  petWindow.loadFile(path.join(__dirname, "index.html"));

  petWindow.webContents.once("did-finish-load", () => {
    send("idle");
    setTimeout(startMovement, 700);
    startBehaviorLoop();
  });

  petWindow.on("moved", savePosition);

  petWindow.on("closed", () => {
    savePosition();
    clearInterval(moveTimer);
    clearTimeout(behaviorTimer);
    petWindow = null;
  });

  petWindow.webContents.on("ipc-message", (_event, channel, ...args) => {
    if (channel === "mochi-pause") pauseMovement();
    if (channel === "mochi-nap") nap();

    if (channel === "mochi-drag-start") {
      dragging = true;
      paused = true;
      sleeping = false;
      target = null;
      clearInterval(moveTimer);
      send("drag");
    }

    if (channel === "mochi-reset-position") {
      resetPosition();
      send("idle");
    }

    if (channel === "mochi-drag-move" && dragging) {
      const [screenX, screenY] = args;
      const a = getWorkArea();
      const x = Math.max(a.x, Math.min(screenX - PET_SIZE / 2, a.x + a.width - PET_SIZE));
      const y = Math.max(a.y, Math.min(screenY - PET_SIZE / 2, a.y + a.height - PET_SIZE));
      petWindow.setPosition(Math.round(x), Math.round(y), false);
    }

    if (channel === "mochi-drag-end") {
      dragging = false;
      savePosition();
      send("idle");
    }
  });

  petWindow.webContents.on("context-menu", () => {
    Menu.buildFromTemplate([
      { label: paused ? "Resume wandering" : "Pause wandering", click: () => paused ? startMovement() : pauseMovement() },
      { label: "Take a nap", click: nap },
      { label: "Stay here", click: pauseMovement },
      { label: "Reset position", click: resetPosition },
      { type: "separator" },
      { label: "Exit Mochi", click: () => app.quit() }
    ]).popup();
  });
}

app.whenReady().then(createPet);
app.on("window-all-closed", e => e.preventDefault());
