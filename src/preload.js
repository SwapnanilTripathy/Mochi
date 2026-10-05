const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mochi", {
  onState(callback) { ipcRenderer.on("mochi-state", (_event, state) => callback(state)); },
  onDirection(callback) { ipcRenderer.on("mochi-direction", (_event, direction) => callback(direction)); },
  onPat(callback) { ipcRenderer.on("mochi-pat", (_event, data) => callback(data)); },
  onTreat(callback) { ipcRenderer.on("mochi-treat", () => callback()); },
  onNeeds(callback) { ipcRenderer.on("mochi-needs", (_event, data) => callback(data)); },
  onSettings(callback) {
    ipcRenderer.on("settings-data", (_event, data) => callback(data));
    ipcRenderer.on("mochi-settings-data", (_event, data) => callback(data));
  },
  pause() { ipcRenderer.send("mochi-pause"); },
  nap() { ipcRenderer.send("mochi-nap"); },
  pat() { ipcRenderer.send("mochi-pat"); },
  treat() { ipcRenderer.send("mochi-treat"); },
  openSettings() { ipcRenderer.send("mochi-settings"); },
  resetPosition() { ipcRenderer.send("mochi-reset-position"); },
  dragStart() { ipcRenderer.send("mochi-drag-start"); },
  dragMove(x, y) { ipcRenderer.send("mochi-drag-move", x, y); },
  dragEnd() { ipcRenderer.send("mochi-drag-end"); },
  quit() { ipcRenderer.send("mochi-quit"); },
  updateSettings(settings) { ipcRenderer.send("settings-update", settings); },
  resetStats() { ipcRenderer.send("settings-reset-stats"); },
  closeSettings() { ipcRenderer.send("settings-close"); },
  requestSettings() { ipcRenderer.send("settings-request"); }
});
