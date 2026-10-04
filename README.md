# Mochi 🐺🎧

A tiny animated desktop companion for Windows.

## v0.2 — Alive

Mochi now has an animation-ready desktop engine:

- transparent always-on-top window
- 8-frame idle animation
- 8-frame walk animation
- directional flipping
- smooth movement
- hover/look reaction
- pause/resume/stay/exit context menu

### Asset layout

```
src/assets/
├── idle/
│   ├── idle-1.png ... idle-8.png
│   └── approved Mochi idle artwork
└── walk/
    ├── walk-1.png ... walk-8.png
    └── approved Mochi walk artwork
```

The renderer automatically falls back to the legacy SVG if sprite assets are absent.

## Run

```bash
npm install
npm start
```

## Roadmap

- [x] Transparent desktop pet
- [x] Idle animation engine
- [x] Walk animation engine
- [x] Direction-aware movement
- [ ] Sleep
- [ ] Stretch
- [ ] Jump / climb
- [ ] Cursor interaction
- [ ] Drag / carry
- [ ] Taskbar / edge sit
- [ ] System tray
- [ ] Settings
- [ ] Windows installer
