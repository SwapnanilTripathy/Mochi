const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mochi", {
  onState(callback) {
    ipcRenderer.on("mochi-state", (_event, state) => callback(state));
  },
  onDirection(callback) {
    ipcRenderer.on("mochi-direction", (_event, direction) => callback(direction));
  }
});
