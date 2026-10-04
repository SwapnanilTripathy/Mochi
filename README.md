# Mochi 🐺🎧

A tiny animated desktop companion for Windows.

## Current build

- Transparent always-on-top desktop pet
- Approved 4-frame idle artwork
- Approved 4-frame walk artwork
- Smooth wandering with variable speed
- Direction-aware sprite flipping
- Natural idle/walk transitions
- Random stretch and nap behavior
- Hover reaction
- Click/pat reaction
- Double-click to nap
- Right-click menu: pause, resume, nap, stay, exit
- Drag Mochi anywhere with the left mouse button
- Dragging pauses wandering until released
- Occasionally chooses a screen edge and sits there for a few seconds

## Controls

- **Move:** Mochi wanders automatically
- **Hover:** Mochi reacts
- **Click:** pat reaction
- **Double-click:** nap
- **Right-click:** behavior menu

## Assets

```
src/assets/
├── idle/
│   ├── idle-1.png
│   ├── idle-2.png
│   ├── idle-3.png
│   └── idle-4.png
└── walk/
    ├── walk-1.png
    ├── walk-2.png
    ├── walk-3.png
    └── walk-4.png
```

## Run

```bash
npm install
npm start
```

## Next

More approved artwork can be dropped into the same state system without changing Mochi's core behavior.
