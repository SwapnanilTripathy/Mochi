const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mochi", {
  onState(callback) {
    ipcRenderer.on("mochi-state", (_event, state) => callback(state));
  },
  onDirection(callback) {
    ipcRenderer.on("mochi-direction", (_event, direction) => callback(direction));
  },
  pause() {
    ipcRenderer.send("mochi-pause");
  },
  nap() {
    ipcRenderer.send("mochi-nap");
  },
  dragStart() {
    ipcRenderer.send("mochi-drag-start");
  },
  dragMove(x, y) {
    ipcRenderer.send("mochi-drag-move", x, y);
  },
  dragEnd() {
    ipcRenderer.send("mochi-drag-end");
  }
});
