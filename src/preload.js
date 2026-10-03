const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mochi", {
  onDirection(callback) {
    ipcRenderer.on("mochi-direction", (_event, direction) => callback(direction));
  }
});
