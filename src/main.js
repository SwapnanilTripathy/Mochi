const { app, BrowserWindow, screen, Menu, Tray, ipcMain, Notification, globalShortcut } = require("electron");
const path = require("path");
const fs = require("fs");

let petWindow;
let settingsWindow;
let moveTimer;
let behaviorTimer;
let saveTimer;
let dwellTimer;
let target = null;
let direction = 1;
let paused = false;
let sleeping = false;
let dragging = false;
let edgeSitting = false;
let curious = false;
let energy = 100;
let hunger = 22;
let happiness = 82;
let boredom = 8;
let lastNeedsTick = Date.now();
let lastEnergyTick = Date.now();
let lastAttentionAt = Date.now();
let interactionLockUntil = 0;
let tray = null;
let settings = null;
let stats = null;

const PET_SIZE = 125;
const MIN_SPEED = 1.15;
const MAX_SPEED = 2.35;
const TICK_MS = 25;
const USER_DIR = app.getPath("userData");
const SETTINGS_FILE = path.join(USER_DIR, "mochi-settings.json");
const STATS_FILE = path.join(USER_DIR, "mochi-stats.json");
const POSITION_FILE = path.join(USER_DIR, "mochi-position.json");

const DEFAULT_SETTINGS = {
  wander: true,
  cursorAware: true,
  sounds: true,
  notifications: true,
  startWithWindows: false,
  napDuration: 7000,
  personality: "playful"
};

const DEFAULT_STATS = {
  affection: 0,
  pats: 0,
  naps: 0,
  walks: 0,
  treats: 0,
  playSessions: 0,
  firstSeen: null,
  lastSeen: null
};

function readJson(file, fallback) {
  try {
    if (fs.existsSync(file)) return { ...fallback, ...JSON.parse(fs.readFileSync(file, "utf8")) };
  } catch {}
  return { ...fallback };
}

function writeJson(file, value) {
  try {
    fs.mkdirSync(USER_DIR, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(value, null, 2));
  } catch {}
}

function loadData() {
  settings = readJson(SETTINGS_FILE, DEFAULT_SETTINGS);
  stats = readJson(STATS_FILE, DEFAULT_STATS);
  if (!stats.firstSeen) stats.firstSeen = new Date().toISOString();
  stats.lastSeen = new Date().toISOString();
  writeJson(STATS_FILE, stats);
}

function saveSettings() { writeJson(SETTINGS_FILE, settings); }
function saveStats() { writeJson(STATS_FILE, stats); }

function loadSavedPosition() {
  return readJson(POSITION_FILE, { x: null, y: null });
}

function savePosition() {
  if (!petWindow || petWindow.isDestroyed()) return;
  try {
    const [x, y] = petWindow.getPosition();
    writeJson(POSITION_FILE, { x, y });
  } catch {}
}

function createTray() {
  if (tray) return;
  tray = new Tray(path.join(__dirname, "assets", "idle", "idle-1.png"));
  tray.setToolTip("Mochi 🐺");
  tray.setContextMenu(buildTrayMenu());
  tray.on("double-click", () => showMochi());
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    { label: "Show Mochi", click: showMochi },
    { label: paused ? "Resume wandering" : "Pause wandering", click: () => paused ? startMovement() : pauseMovement() },
    { label: "Take a nap", click: nap },
    { label: "Give Mochi a treat", click: giveTreat },
    { label: "Mochi Settings", click: openSettings },
    { type: "separator" },
    { label: "Reset position", click: resetPosition },
    { label: "Reset affection & stats", click: resetStats },
    { type: "separator" },
    { label: "Quit Mochi", click: () => app.quit() }
  ]);
}

function refreshTray() {
  tray?.setContextMenu(buildTrayMenu());
}

function showMochi() {
  petWindow?.show();
  petWindow?.focus();
}

function send(state) {
  if (Date.now() < interactionLockUntil && !["pat","treat","sleep","wake","fall_asleep","drag","drag_release"].includes(state)) return;
  petWindow?.webContents.send("mochi-state", state);
}
function sendNeeds() {
  petWindow?.webContents.send("mochi-needs", {
    energy: Math.round(energy),
    hunger: Math.round(hunger),
    happiness: Math.round(happiness),
    boredom: Math.round(boredom)
  });
}
function lockInteraction(ms = 900) { interactionLockUntil = Date.now() + ms; }
function sendSettings() {
  const data = { settings, stats, paused, sleeping };
  settingsWindow?.webContents.send("settings-data", data);
  petWindow?.webContents.send("mochi-settings-data", data);
}

function resetPosition() {
  const a = screen.getPrimaryDisplay().workArea;
  petWindow?.setPosition(a.x + a.width - PET_SIZE - 24, a.y + a.height - PET_SIZE - 24, false);
  savePosition();
}

function getWorkArea() {
  if (!petWindow || petWindow.isDestroyed()) return screen.getPrimaryDisplay().workArea;
  const [x, y] = petWindow.getPosition();
  return screen.getDisplayNearestPoint({ x, y }).workArea;
}

function chooseTarget() {
  const a = getWorkArea();
  const margin = 12;
  const speedFactor = settings.personality === "calm" ? 0.72 : settings.personality === "curious" ? 1.12 : 1;
  if (Math.random() < 0.18) {
    const side = Math.floor(Math.random() * 4);
    edgeSitting = true;
    target = {
      x: side === 1 ? a.x + a.width - PET_SIZE : side === 3 ? a.x : a.x + margin + Math.random() * Math.max(1, a.width - PET_SIZE - margin * 2),
      y: side === 0 ? a.y : side === 2 ? a.y + a.height - PET_SIZE : a.y + margin + Math.random() * Math.max(1, a.height - PET_SIZE - margin * 2),
      speed: (MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED)) * speedFactor,
      edge: true
    };
    return;
  }
  edgeSitting = false;
  target = {
    x: a.x + margin + Math.random() * Math.max(1, a.width - PET_SIZE - margin * 2),
    y: a.y + margin + Math.random() * Math.max(1, a.height - PET_SIZE - margin * 2),
    speed: (MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED)) * speedFactor
  };
}

function updateNeeds() {
  const now = Date.now();
  const elapsed = Math.max(0, now - lastNeedsTick);
  lastNeedsTick = now;
  const minutes = elapsed / 60000;

  if (sleeping) {
    energy = Math.min(100, energy + minutes * 9);
    hunger = Math.min(100, hunger + minutes * 0.7);
    happiness = Math.min(100, happiness + minutes * 0.15);
    boredom = Math.max(0, boredom - minutes * 2.2);
  } else if (!paused) {
    energy = Math.max(0, energy - minutes * (settings.wander ? 0.9 : 0.18));
    hunger = Math.min(100, hunger + minutes * 0.55);
    boredom = Math.min(100, boredom + minutes * (settings.wander ? 0.22 : 0.12));
    happiness = Math.max(0, happiness - minutes * (settings.wander ? 0.10 : 0.07));
  }

  if (hunger > 72) happiness = Math.max(0, happiness - minutes * 0.12);
  if (boredom > 78) happiness = Math.max(0, happiness - minutes * 0.14);
  sendNeeds();
}
function updateEnergy() {
  updateNeeds();
}

function beginDwell() {
  clearTimeout(dwellTimer);
  clearInterval(moveTimer);
  send("idle");
  const duration = 900 + Math.random() * 2600;
  dwellTimer = setTimeout(() => {
    if (!paused && !sleeping && !dragging && settings.wander) {
      if (Math.random() < 0.28) {
        send("curious");
        setTimeout(() => {
          if (!paused && !sleeping && !dragging) startMovement();
        }, 700 + Math.random() * 900);
      } else {
        startMovement();
      }
    }
  }, duration);
}

function moveMochi() {
  updateNeeds();
  if (!petWindow || petWindow.isDestroyed() || paused || sleeping || dragging || edgeSitting || !settings.wander) return;

  const cursor = screen.getCursorScreenPoint();
  const [px, py] = petWindow.getPosition();
  const cx = px + PET_SIZE / 2, cy = py + PET_SIZE / 2;
  const cursorDistance = Math.hypot(cursor.x - cx, cursor.y - cy);

  if (settings.cursorAware && cursorDistance < 150) {
    if (!curious) { curious = true; target = null; send("curious"); }
    direction = cursor.x < cx ? -1 : 1;
    petWindow.webContents.send("mochi-direction", direction);
    if (cursorDistance > 72) {
      const dx = cursor.x - cx, dy = cursor.y - cy, distance = Math.max(1, cursorDistance);
      const step = Math.min(0.65, distance - 72);
      petWindow.setPosition(Math.round(px + (dx / distance) * step), Math.round(py + (dy / distance) * step), false);
    }
    return;
  }

  if (curious) { curious = false; send("idle"); chooseTarget(); }
  if (!target) chooseTarget();

  const [x, y] = petWindow.getPosition();
  const dx = target.x - x, dy = target.y - y, distance = Math.hypot(dx, dy);
  if (distance < 8) {
    const wasEdge = !!target.edge;
    target = null;
    stats.walks++;
    saveStats();

    if (wasEdge) {
      edgeSitting = true;
      send("edge");
      clearInterval(moveTimer);
      setTimeout(() => {
        if (!paused && !dragging && !sleeping) {
          edgeSitting = false;
          chooseTarget();
          moveMochi();
          moveTimer = setInterval(moveMochi, TICK_MS);
        }
      }, 4500 + Math.random() * 4500);
    } else {
      beginDwell();
    }
    sendSettings();
    return;
  }

  direction = dx < 0 ? -1 : 1;
  const step = Math.min(target.speed, distance);
  petWindow.setPosition(Math.round(x + (dx / distance) * step), Math.round(y + (dy / distance) * step), false);
  petWindow.webContents.send("mochi-direction", direction);
  send("walk");
}

function startMovement() {
  paused = false; sleeping = false; curious = false; edgeSitting = false;
  updateNeeds();
  clearInterval(moveTimer); clearTimeout(behaviorTimer); clearTimeout(dwellTimer);
  if (!settings.wander) { send("idle"); refreshTray(); sendSettings(); return; }
  if (energy < 12 || (hunger > 92 && Math.random() < 0.45)) { nap(); return; }
  chooseTarget();
  send("idle");
  moveMochi();
  clearInterval(moveTimer);
  moveTimer = setInterval(moveMochi, TICK_MS);
  startBehaviorLoop();
  refreshTray(); sendSettings();
}

function pauseMovement() {
  paused = true; curious = false; target = null;
  clearInterval(moveTimer); clearTimeout(behaviorTimer); clearTimeout(dwellTimer);
  send("idle"); refreshTray(); sendSettings();
}

function nap() {
  paused = false; sleeping = true; target = null;
  clearInterval(moveTimer); clearTimeout(behaviorTimer); clearTimeout(dwellTimer);
  stats.naps++;
  stats.affection = Math.min(100, stats.affection + 1);
  energy = Math.min(100, energy + 8);
  lastNeedsTick = Date.now();
  saveStats();
  lockInteraction(900);
  send("fall_asleep");
  sendNeeds();
  sendSettings();

  const sleepStart = Math.max(900, Math.min(2200, 1100));
  behaviorTimer = setTimeout(() => {
    if (!sleeping) return;
    send("sleep");
    const restTime = Math.max(3000, Number(settings.napDuration) || 7000);
    setTimeout(() => {
      if (!sleeping) return;
      sleeping = false;
      updateNeeds();
      send("wake");
      setTimeout(() => {
        if (!paused && !dragging) {
          send("idle");
          startMovement();
        }
      }, 950);
    }, restTime);
  }, sleepStart);

  if (settings.notifications && stats.naps % 5 === 0) {
    notify("Mochi is sleepy 💤", "Your little companion is taking a nap.");
  }
}

function startBehaviorLoop() {
  clearTimeout(behaviorTimer);
  behaviorTimer = setTimeout(() => {
    if (!paused && !sleeping && !dragging && settings.wander) {
      updateNeeds();
      const roll = Math.random();

      if (energy < 22) {
        nap();
        return;
      }

      if (hunger > 86) {
        send("annoyed");
        setTimeout(() => { if (!sleeping && !dragging) send("curious"); }, 900);
      } else if (boredom > 78 && settings.personality !== "calm") {
        lockInteraction(1400);
        send(Math.random() < 0.5 ? "jump" : "happy");
        happiness = Math.min(100, happiness + 4);
        boredom = Math.max(0, boredom - 18);
        setTimeout(() => { if (!paused && !sleeping && !dragging) startMovement(); }, 1200);
      } else if (roll < 0.18) {
        lockInteraction(1500);
        send("stretch");
        setTimeout(() => { if (!paused && !sleeping && !dragging) startMovement(); }, 1500);
      } else if (roll < 0.31) {
        lockInteraction(1200);
        send("curious");
        setTimeout(() => { if (!paused && !sleeping && !dragging) startMovement(); }, 1000);
      } else if (roll < 0.43) {
        beginDwell();
      } else if (roll < 0.53 && settings.personality === "playful") {
        lockInteraction(1200);
        send("happy");
        setTimeout(() => { if (!paused && !sleeping && !dragging) startMovement(); }, 1000);
      } else {
        startMovement();
      }
    }
    if (!sleeping) startBehaviorLoop();
  }, 6500 + Math.random() * 9000);
}

function giveTreat() {
  stats.treats++;
  stats.affection = Math.min(100, stats.affection + 4);
  hunger = Math.max(0, hunger - 28);
  happiness = Math.min(100, happiness + 7);
  boredom = Math.max(0, boredom - 10);
  energy = Math.min(100, energy + 2);
  saveStats();
  lockInteraction(1300);
  petWindow?.webContents.send("mochi-treat");
  send("treat");
  sendNeeds();
  notify("Mochi got a treat! 🐺", "Mochi is happier and less hungry.");
  sendSettings();
}

function pat() {
  stats.pats++;
  stats.affection = Math.min(100, stats.affection + 2);
  stats.playSessions++;
  happiness = Math.min(100, happiness + 5);
  boredom = Math.max(0, boredom - 9);
  lastAttentionAt = Date.now();
  saveStats();
  lockInteraction(950);
  send("pat");
  petWindow?.webContents.send("mochi-pat", { affection: stats.affection });
  sendNeeds();
  if (stats.pats % 10 === 0 && settings.notifications) notify("Mochi likes you 💛", `You have patted Mochi ${stats.pats} times.`);
  sendSettings();
}

function notify(title, body) {
  if (!settings?.notifications || !Notification.isSupported()) return;
  try { new Notification({ title, body, silent: true }).show(); } catch {}
}

function resetStats() {
  stats = { ...DEFAULT_STATS, firstSeen: stats.firstSeen || new Date().toISOString(), lastSeen: new Date().toISOString() };
  saveStats(); sendSettings();
}

function openSettings() {
  if (settingsWindow && !settingsWindow.isDestroyed()) { settingsWindow.show(); settingsWindow.focus(); sendSettings(); return; }
  settingsWindow = new BrowserWindow({ width: 420, height: 560, minWidth: 380, minHeight: 500, title: "Mochi Settings", resizable: true, backgroundColor: "#f8f7fb", webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, "preload.js") } });
  settingsWindow.setMenuBarVisibility(false);
  settingsWindow.loadFile(path.join(__dirname, "settings.html"));
  settingsWindow.webContents.once("did-finish-load", sendSettings);
  settingsWindow.on("closed", () => { settingsWindow = null; });
}

function applySettings(next) {
  settings = { ...settings, ...next };
  settings.napDuration = Math.max(3000, Math.min(30000, Number(settings.napDuration) || 7000));
  saveSettings();
  app.setLoginItemSettings({ openAtLogin: !!settings.startWithWindows });
  if (!settings.wander) pauseMovement(); else if (paused && !sleeping) startMovement();
  refreshTray(); sendSettings();
}

function createPet() {
  const a = screen.getPrimaryDisplay().workArea;
  const saved = loadSavedPosition();
  const savedValid = Number.isFinite(saved.x) && Number.isFinite(saved.y) && saved.x >= a.x - PET_SIZE && saved.x <= a.x + a.width && saved.y >= a.y - PET_SIZE && saved.y <= a.y + a.height;
  const startX = savedValid ? saved.x : a.x + a.width - PET_SIZE - 24;
  const startY = savedValid ? saved.y : a.y + a.height - PET_SIZE - 24;

  petWindow = new BrowserWindow({ width: PET_SIZE, height: PET_SIZE, x: startX, y: startY, frame: false, transparent: true, backgroundColor: "#00000000", resizable: false, movable: false, alwaysOnTop: true, hasShadow: false, skipTaskbar: true, show: true, webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, "preload.js") } });
  petWindow.setMenuBarVisibility(false);
  petWindow.setAlwaysOnTop(true, "floating");
  createTray();
  petWindow.loadFile(path.join(__dirname, "index.html"));
  petWindow.webContents.once("did-finish-load", () => {
    send("idle");
    sendSettings();
    setTimeout(() => {
      energy = 100;
      lastEnergyTick = Date.now();
      startMovement();
    }, 700);
  });
  petWindow.on("moved", () => { clearTimeout(saveTimer); saveTimer = setTimeout(savePosition, 250); });
  petWindow.on("closed", () => { savePosition(); clearInterval(moveTimer); clearTimeout(behaviorTimer); petWindow = null; });

  ipcMain.on("mochi-pause", pauseMovement);
  ipcMain.on("mochi-nap", nap);
  ipcMain.on("mochi-pat", pat);
  ipcMain.on("mochi-treat", giveTreat);
  ipcMain.on("mochi-settings", openSettings);
  ipcMain.on("mochi-reset-position", resetPosition);
  ipcMain.on("mochi-quit", () => app.quit());
  ipcMain.on("mochi-drag-start", () => { dragging = true; paused = true; sleeping = false; target = null; clearInterval(moveTimer); send("drag"); });
  ipcMain.on("mochi-drag-move", (_event, screenX, screenY) => {
    if (!dragging || !petWindow) return;
    const a = getWorkArea();
    const x = Math.max(a.x, Math.min(screenX - PET_SIZE / 2, a.x + a.width - PET_SIZE));
    const y = Math.max(a.y, Math.min(screenY - PET_SIZE / 2, a.y + a.height - PET_SIZE));
    petWindow.setPosition(Math.round(x), Math.round(y), false);
  });
  ipcMain.on("mochi-drag-end", () => { dragging = false; savePosition(); send("idle"); });
  ipcMain.on("settings-update", (_event, next) => applySettings(next || {}));
  ipcMain.on("settings-reset-stats", resetStats);
  ipcMain.on("settings-close", () => settingsWindow?.close());
  ipcMain.on("settings-request", sendSettings);

  petWindow.webContents.on("context-menu", () => {
    Menu.buildFromTemplate([
      { label: paused ? "Resume wandering" : "Pause wandering", click: () => paused ? startMovement() : pauseMovement() },
      { label: "Take a nap", click: nap },
      { label: "Give a treat", click: giveTreat },
      { label: "Mochi Settings", click: openSettings },
      { type: "separator" },
      { label: "Stay here", click: pauseMovement },
      { label: "Reset position", click: resetPosition },
      { type: "separator" },
      { label: "Exit Mochi", click: () => app.quit() }
    ]).popup({ window: petWindow });
  });
}

app.whenReady().then(() => {
  loadData();
  lastNeedsTick = Date.now();
  setInterval(() => {
    if (!petWindow || petWindow.isDestroyed()) return;
    updateNeeds();
  }, 30000);
  app.setLoginItemSettings({ openAtLogin: !!settings.startWithWindows });
  globalShortcut.register("CommandOrControl+Shift+M", () => paused ? startMovement() : pauseMovement());
  createPet();
});

app.on("before-quit", () => { savePosition(); saveSettings(); saveStats(); globalShortcut.unregisterAll(); });
app.on("window-all-closed", e => e.preventDefault());
