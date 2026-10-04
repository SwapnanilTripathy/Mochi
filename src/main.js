const { app, BrowserWindow, screen, Menu, Tray, ipcMain, Notification, globalShortcut } = require("electron");
const path = require("path");
const fs = require("fs");

let petWindow;
let settingsWindow;
let moveTimer;
let behaviorTimer;
let saveTimer;
let target = null;
let direction = 1;
let paused = false;
let sleeping = false;
let dragging = false;
let edgeSitting = false;
let curious = false;
let tray = null;
let settings = null;
let stats = null;

const PET_SIZE = 86;
const MIN_SPEED = 0.45;
const MAX_SPEED = 1.05;
const TICK_MS = 35;
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

function send(state) { petWindow?.webContents.send("mochi-state", state); }
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

function moveMochi() {
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
    if (wasEdge) {
      edgeSitting = true; send("edge"); clearInterval(moveTimer);
      setTimeout(() => {
        if (!paused && !dragging) { edgeSitting = false; chooseTarget(); moveTimer = setInterval(moveMochi, TICK_MS); }
      }, 4500 + Math.random() * 4500);
    } else {
      stats.walks++;
      saveStats();
      send("idle");
      sendSettings();
    }
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
  clearInterval(moveTimer); clearTimeout(behaviorTimer);
  if (!settings.wander) { send("idle"); refreshTray(); sendSettings(); return; }
  chooseTarget(); send("idle"); moveTimer = setInterval(moveMochi, TICK_MS); startBehaviorLoop();
  refreshTray(); sendSettings();
}

function pauseMovement() {
  paused = true; curious = false; target = null; clearInterval(moveTimer); clearTimeout(behaviorTimer); send("idle"); refreshTray(); sendSettings();
}

function nap() {
  paused = false; sleeping = true; target = null; clearInterval(moveTimer); clearTimeout(behaviorTimer);
  stats.naps++; stats.affection = Math.min(100, stats.affection + 1); saveStats();
  send("sleep"); sendSettings();
  behaviorTimer = setTimeout(() => { sleeping = false; send("idle"); startMovement(); }, Math.max(3000, Number(settings.napDuration) || 7000));
  if (settings.notifications && stats.naps % 5 === 0) notify("Mochi is well rested 💤", "Mochi took another tiny nap.");
}

function startBehaviorLoop() {
  clearTimeout(behaviorTimer);
  behaviorTimer = setTimeout(() => {
    if (!paused && !sleeping && settings.wander) {
      const roll = Math.random();
      if (roll < 0.14) {
        send("stretch");
        setTimeout(() => { if (!paused && !sleeping) startMovement(); }, 1800);
      } else if (roll < 0.23) nap();
      else startMovement();
    }
    if (!sleeping) startBehaviorLoop();
  }, 7000 + Math.random() * 7000);
}

function giveTreat() {
  stats.treats++; stats.affection = Math.min(100, stats.affection + 4); saveStats();
  petWindow?.webContents.send("mochi-treat");
  send("curious");
  setTimeout(() => { if (!sleeping && !paused) send("idle"); }, 1300);
  notify("Mochi got a treat! 🐺", "Affection increased.");
  sendSettings();
}

function pat() {
  stats.pats++; stats.affection = Math.min(100, stats.affection + 2); stats.playSessions++; saveStats();
  send("idle"); petWindow?.webContents.send("mochi-pat", { affection: stats.affection });
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
  const startX = Number.isFinite(saved.x) ? saved.x : a.x + a.width - PET_SIZE - 24;
  const startY = Number.isFinite(saved.y) ? saved.y : a.y + a.height - PET_SIZE - 24;

  petWindow = new BrowserWindow({ width: PET_SIZE, height: PET_SIZE, x: startX, y: startY, frame: false, transparent: true, backgroundColor: "#00000000", resizable: false, movable: false, alwaysOnTop: true, hasShadow: false, skipTaskbar: true, show: true, webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, "preload.js") } });
  petWindow.setMenuBarVisibility(false);
  petWindow.setAlwaysOnTop(true, "floating");
  createTray();
  petWindow.loadFile(path.join(__dirname, "index.html"));
  petWindow.webContents.once("did-finish-load", () => { send("idle"); sendSettings(); setTimeout(startMovement, 700); startBehaviorLoop(); });
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
  app.setLoginItemSettings({ openAtLogin: !!settings.startWithWindows });
  globalShortcut.register("CommandOrControl+Shift+M", () => paused ? startMovement() : pauseMovement());
  createPet();
});

app.on("before-quit", () => { savePosition(); saveSettings(); saveStats(); globalShortcut.unregisterAll(); });
app.on("window-all-closed", e => e.preventDefault());
