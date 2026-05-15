# 4 × 4 Cube (WebGL)

Interactive **4×4 Rubik’s-style cube** in the browser, rendered with **raw WebGL** (no Three.js). You can scramble, play manually, watch guided solutions, try a **custom sticker layout**, or run a **demo** shuffle-and-solve loop.

---

## Requirements

- A **modern desktop or mobile browser** with **WebGL** enabled.
- Open `index.html` from a local folder, or serve the folder over **http(s)** (recommended for consistent behavior).

### Run locally (quick)

1. Open the project folder.
2. Double-click **`index.html`**, **or**
3. From this directory, start any static file server (for example):  
   `npx --yes serve .`  
   then visit the URL shown in the terminal.

---

## First launch

1. Open the game in the browser.
2. On the **mode screen**, pick:
   - **Active Mode** — full play flow (shuffle or custom start, manual solving, optional assisted solve).
   - **Demo Mode** — automated shuffle length, then inverse “solve” playback with a move log beside the cube.

---

## What the game includes

### Rendering and interaction

- **3D WebGL cube** with lighting-style shading (vertex colors and normals).
- **64 cubies** on a 4×4 grid, each with visible stickers on exterior faces.
- **Orbit camera**: drag on the cube area to rotate the view.
- **Zoom**: mouse wheel or trackpad scroll on the cube area (within min/max distance).
- **Smooth animated** face (and wide-layer) turns.
- **Optional sound**: short click on each rotation (Web Audio); use **Sound: On / Off** in the workspace. First interaction may be needed for the browser to unlock audio.

### Move notation (reference)

The **Move Notation Guide** next to the cube explains:

| Symbol | Meaning |
|--------|--------|
| **U D L R F B** | Face turns (Up, Down, Left, Right, Front, Back) |
| **'** | Quarter turn counterclockwise (prime) |
| **2** | Double (180°) turn |
| **Uw, Rw, …** | **Wide** turns (outer face **plus** the adjacent inner slice move together) |

**Note:** For **your** moves, the UI and keyboard use the **six faces** with optional prime and double. **Wide** layer motion is used internally during **automatic solution playback** (for example after **Give Up and Solve**), so you may see wide-style steps in the solution log. **Middle-slice notation like `M` / `M2`** in the legend is descriptive only; there is **no separate `M` key** in this build—only **U D L R F B** family moves for manual play.

### Active Mode — features

- **Shuffle 20** — applies **20 random** quarter / double moves (no immediate repeat on the same face letter), then switches to **playing** phase.
- **Move sidebar** — one button per move for **U/U'/U2, D, L, R, F, B** (standard face turns only).
- **Move counter** — counts **your** quarter-step–style moves during play (scramble moves are tracked separately in session state).
- **Give Up and Solve** — builds a solution as the **reverse** of all recorded moves since the last reset (inverse sequence), then plays it back. Use **Next Step**, **Auto Play**, and **Pause** to control playback.
- **Rotation speed** — **Rotation Speed** slider affects both live turns and playback pacing.
- **Custom Start State** — clears outer stickers; you **pick a color** from the palette, then **click** a visible sticker on the cube to paint it (tiny drag counts as orbit, not paint). You must fill **exactly 96 outer stickers**: **16 per color** (white, yellow, orange, red, green, blue), **no empty** cells. **Solve Custom State** is allowed only if the **sticker multiset** matches a real 4×4 (same counts of corner/edge/center color patterns as the solved cube). If valid, the game runs a **“fix” playback** that restores the standard solved colors (not a competition-style move-optimal 4×4 solver).
- **Replay** — after you solve manually or finish playback, **Replay** resets to solved and lets you choose a start option again.
- **Status line** — badge and short center message describe phase (scrambling, playing, solving, solved, errors such as unsolvable custom layout).

### Demo Mode — features

- **Shuffle length** dropdown: **20, 40, 60, 80, or 100** moves.
- **Shuffle** — random sequence (same face-avoidance rule as Active scramble).
- **Solve** — after shuffle completes, computes the **inverse** sequence (with basic cancellation), then you can step or auto-play it.
- **Solution Steps** panel lists the demo solution moves next to the cube.
- **Replay** (when demo completes) — resets cube and returns to choosing shuffle length.

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| **Space** | **Active:** while choosing start → same as **Shuffle 20**. **Demo:** while choosing shuffle → runs **Shuffle** with the selected length. |
| **U, D, L, R, F, B** | During **Active Play** only (not while choosing start, editing custom, or during solve playback): apply that **clockwise** quarter turn. |

Keyboard moves are ignored while typing in an input field. They only apply when the game accepts **player** moves (Active **playing** phase).

### Mouse / pointer on the cube

- **Drag** — orbit camera (if movement is more than a couple of pixels, a **click** does not paint).
- **Click** (no drag) — in **Custom Start State** only: paints the clicked outer sticker with the **selected palette** color (respecting the 16-per-color cap).

---

## How to operate — Active Mode (typical flow)

1. Choose **Active Mode** on the title screen.
2. **Choose Start**
   - **Shuffle 20** — or press **Space** — to scramble and start playing, **or**
   - **Custom Start State** — paint all stickers, then **Solve Custom State** (or **Cancel** to abort and reset).
3. During play, use **sidebar buttons**, **keyboard**, or both to solve.
4. Optional: **Give Up and Solve** → **Next Step** / **Auto Play** / **Pause** until solved.
5. When finished, **Replay** appears — use it to return to **Choose Start**.

---

## How to operate — Demo Mode (typical flow)

1. Choose **Demo Mode** on the title screen.
2. Pick **Shuffle** length (20–100).
3. Press **Shuffle** or **Space** to scramble.
4. Press **Solve** when ready.
5. Use **Next Step** / **Auto Play** / **Pause** to watch the inverse sequence.
6. **Replay** when the demo completes to run another cycle.

---

## Project files (overview)

| File | Role |
|------|------|
| `index.html` | Page structure, mode screen, panels, script tags |
| `style.css` | Layout and visual styling |
| `main.js` | Game loop, WebGL draw, UI, modes, scrambling, solving playback |
| `constants.js` | Face axes, colors, move lists, mode/phase enums |
| `math-utils.js` | Matrices, vectors, perspective, look-at |
| `webgl-utils.js` | Shader program and mesh helpers |
| `shader-sources.js` | Vertex and fragment GLSL |
| `game-helpers.js` | Move parsing helpers, picking, scramble token utilities |
| `dom-elements.js` | Central DOM lookups |

---

## Tips

- If the cube feels too fast or slow, adjust **Rotation Speed** before long playback sessions.
- If audio never plays, click anywhere on the page once and toggle **Sound**; browsers often require a user gesture before Web Audio runs.
  
Enjoy the cube.
