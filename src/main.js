const { app, BrowserWindow, screen, Menu } = require("electron");
const path = require("path");

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

const PET_SIZE = 86;
const MIN_SPEED = 0.45;
const MAX_SPEED = 1.05;
const TICK_MS = 35;

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
    send("idle");
    setTimeout(startMovement, 700);
    startBehaviorLoop();
  });

  petWindow.on("closed", () => {
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

    if (channel === "mochi-drag-move" && dragging) {
      const [screenX, screenY] = args;
      const a = getWorkArea();
      const x = Math.max(a.x, Math.min(screenX - PET_SIZE / 2, a.x + a.width - PET_SIZE));
      const y = Math.max(a.y, Math.min(screenY - PET_SIZE / 2, a.y + a.height - PET_SIZE));
      petWindow.setPosition(Math.round(x), Math.round(y), false);
    }

    if (channel === "mochi-drag-end") {
      dragging = false;
      send("idle");
    }
  });

  petWindow.webContents.on("context-menu", () => {
    Menu.buildFromTemplate([
      { label: paused ? "Resume wandering" : "Pause wandering", click: () => paused ? startMovement() : pauseMovement() },
      { label: "Take a nap", click: nap },
      { label: "Stay here", click: pauseMovement },
      { type: "separator" },
      { label: "Exit Mochi", click: () => app.quit() }
    ]).popup();
  });
}

app.whenReady().then(createPet);
app.on("window-all-closed", e => e.preventDefault());
