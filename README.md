# Settle In

A cozy first-person **moving-in** game that fuses the two reference games studied
in `../RESEARCH_HOUSE_FLIPPER.md` and `../RESEARCH_A_LITTLE_TO_THE_LEFT.md`:

- **House Flipper** — walk the house in first person, approach task hotspots, and
  **assemble furniture diegetically** (drag flat-pack panels into place, then
  tighten each bolt by dragging across it — no timer, no fail state).
- **Box-cutter unboxing** — each unpacking chore opens with a sealed cardboard
  box: drag the cutter along the tape seam to slice it, and the flaps pop open to
  reveal the parts inside.
- **A Little to the Left** — every chore is a close-up **snap-satisfaction
  organizing puzzle**: sort books by height, straighten a crooked picture by
  grabbing and rotating it, set the kitchen counter onto silhouettes. Snap +
  chime + sparkle on every correct placement; a wrong piece gently tilts and
  slides back with a hint. A scratch-to-reveal hint card and a warm hand-drawn
  pastel palette complete the mood.

You return to an empty home. Follow the glowing rings, finish each task, and the
room **warms up** — lights swell, the space fills in — until the last task lights
the whole home and it says *Welcome home*.

## Run it

From this folder (dependencies resolve up into the parent repo's `node_modules`,
so no separate install is needed):

```bash
cd settle-in
bunx vite          # dev server (http://localhost:5188)
```

or `bun run dev`. Production build: `bun run build` (outputs `dist/`).

## Controls

| | Desktop | Touch |
|---|---|---|
| Walk | WASD (Shift = run) | left-half joystick |
| Look | move mouse (click to lock) | right-half drag |
| Work a task | **E** or tap the prompt | tap the prompt |
| Organize | click-drag pieces | drag pieces |
| Step back | Esc / "Step back" | "Step back" |
| Hint | "Need a hint?" (rub to reveal) | same |

## Architecture

Self-contained Babylon.js + TypeScript + Vite. No `@rezona/core`, no React — just
`@babylonjs/core` (reused from the parent repo) and a WebAudio foley kit.

| file | role |
|---|---|
| `src/main.ts` | engine, scene, render loop, start curtain, debug hooks |
| `src/palette.ts` · `materials.ts` | warm hand-drawn color language + flat matte materials |
| `src/house.ts` | the walkable two-room shell, lighting, wall colliders |
| `src/player.ts` | first-person walk controller with circle-vs-AABB collision |
| `src/input.ts` | unified keyboard / pointer-lock / touch input, walk + focus modes |
| `src/focus.ts` | **the fusion core** — camera director + `DragPuzzle`, `BoltPuzzle`, `RotatePuzzle` with snap/chime/sparkle/hint feedback |
| `src/props.ts` | toy-like prop builders (books, panels, bolts, mug, plant, picture) |
| `src/stations.ts` | the four chores: build shelf → shelve books → straighten picture → set counter |
| `src/taskmanager.ts` | walk-mode detection, focus transitions, phase sequencing, room warm-up, finale |
| `src/ui/overlay.*` | DOM overlay: task list, prompts, focus ribbon, toast, scratch-to-reveal hint card |

### Adding a chore

Add a `Station` in `stations.ts`: give it an `approach` point, a `focus` camera
pose, `showPending()` to place its world props, and `createPhases(ctx)` returning
one or more puzzle thunks (`DragPuzzle` / `BoltPuzzle` / `RotatePuzzle`). The
manager handles framing, sequencing, completion, and warm-up automatically. Use
`requires` to gate a task behind another (as "shelve books" waits on "build
shelf").
