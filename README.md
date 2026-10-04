# Mochi 🐺🎧

A tiny animated desktop companion for Windows.

## Features
- Transparent always-on-top desktop pet
- Exact layered Mochi artwork with animated rig
- Idle, walk, curious, sleep, stretch, drag and edge-sit behaviors
- Direction-aware movement and cursor awareness
- Click/pat affection system with persistent stats
- Treat interaction
- Headphone music-note effects and optional soft sounds
- Desktop milestone notifications
- System tray controls
- Settings window with personality, behavior, sound, notification and startup controls
- Persistent position, settings, affection and stats
- Ctrl+Shift+M pause/resume shortcut
- Automatic fallback to the original idle sprite when rig assets are missing

## Controls
- **Left click:** pat Mochi
- **Double click:** nap
- **Left-drag:** carry Mochi
- **Right click:** quick menu
- **Tray:** settings, pause/resume, nap, treat, reset position and quit
- **Ctrl+Shift+M:** pause/resume wandering

## Assets

The approved 4-frame idle/walk artwork remains available under `src/assets/idle/` and `src/assets/walk/`.

The layered rig expects the 16 exact PNG pieces under `src/assets/rig/`. The artwork is not redrawn or regenerated. If the layered files are absent, Mochi automatically falls back to the original idle sprite.

## Run
```powershell
npm install
npm start
```