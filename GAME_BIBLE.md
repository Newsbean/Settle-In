# SETTLE IN — Game Bible & Design Guidelines

The single source of truth for this game. Condensed from the two research
studies (`../RESEARCH_HOUSE_FLIPPER.md`, `../RESEARCH_A_LITTLE_TO_THE_LEFT.md`)
and every design decision made while building the current playable slice.
When in doubt, this document wins. Last updated: 2026-07-02.

---

## 1. The One-Liner

> You've finally come back to a home that's been empty for years. Walk its
> rooms, unbox what you brought, and put each thing where it belongs — until
> the house is warm enough to say *welcome home*.

**Fusion formula:**
- **House Flipper** contributes the *body*: first-person walkaround, task
  hotspots, and diegetic in-place furniture assembly (the loved HF1 version —
  never HF2's detached timed workshop).
- **A Little to the Left** contributes the *hands*: close-up drag-and-snap
  organizing with layered feedback, wordless rule-reading, a scratch-off hint,
  and the soft hand-drawn aesthetic.
- **The theme** is the emotional glue: moving in after a while. Every task is
  an act of re-inhabiting, and completion = warmth, not score.

## 2. The Five Pillars (never violate)

1. **No fail state, no timer, no score.** HF2's timed assembly is the
   community's most-hated feature; ALTTL is loved for being failure-free.
   Stakes are transformation only. Stars/ratings, if ever added, must be
   decorative ("a judgemental little star"), never gating.
2. **Diegetic everything.** Assembly happens where the furniture will live.
   Hints are a scribbled notebook page you erase. The skip (if added) is
   "let it be," not a menu button. No detached minigame screens.
3. **Always respond to an attempt.** The silent near-miss is ALTTL's
   worst documented flaw. A wrong placement must *answer*: tilt →
   slide-home → one-line hint. A correct placement must *celebrate*:
   snap-jump + chime + sparkle. Nothing the player does may be met with
   cold silence.
4. **Transformation is the reward.** Each finished task leaves a visible
   permanent object AND warms the room (mood-light swell). The finale is
   the whole home lit warm — the genre's beloved before/after payoff,
   delivered continuously instead of as an end screen.
5. **Touch-first, pointer-native.** One finger/cursor does everything.
   Never require precision a thumb can't deliver, never require a second
   simultaneous input, never depend on pointer lock (it's an enhancement).

## 3. The Loop

```
ORDER (laptop by the door)      PORCH (outside)              WALK (first person)
┌───────────────────────┐ van  ┌──────────────────┐  carry  ┌─────────────────────────┐
│ settle.home catalog    │ ───▶ │ ding-dong — the   │ ──────▶ │ set the box down at its  │
│ order a flat-pack item │      │ parcel lands on   │  (E)    │ spot → the task unlocks  │
└───────────────────────┘      │ the porch         │         │ glowing ring = a task    │
                               └──────────────────┘         └───────────┬─────────────┘
                                                                E / tap  │
                                        FOCUS (close-up)                 ▼
                               ┌──────────────────────────────────────────┐
                               │ camera eases into a framed diorama       │
                               │ phases: slice → place → bolt             │
                               └──────────────────────────────────────────┘
                                        │ done/esc
        room warms, checklist ticks, the next item appears in the shop ◀──┘
```

**The outer loop (2026-07-03):** boxes no longer wait pre-staged in the rooms.
Every boxed task starts as a catalog item on the laptop-on-a-crate beside the
front door (`src/shop.ts`). Order it → a short delivery wait → doorbell + toast
→ the taped parcel lands on the porch (west yard, `house.porchSpots`) → carry
it in (it rides hugged at chest height; carrying is the only verb while your
arms are full) → set it down at the station's spot, which runs `showPending()`
and unlocks assembly exactly as before. `requires` gates now gate *ordering*
("after 'Set the counter'" in the catalog). Tasks with `noBox: true` (the
crooked picture) skip the loop and are available from the start.

- Tasks are **authored stations**, not a sandbox. Each station: an approach
  point, a focus camera pose, staged props, and 1–3 puzzle **phases**.
- Phases are strictly sequential and the *next* actionable thing is always
  visibly marked (ghost silhouette, glow ring, tape seam). HF2's assembly
  failed partly because "it does not clearly show what you are supposed to do."
- Dependency gating (`requires`) sequences the story: build the shelf
  *before* the books can be shelved.

## 4. Interaction Grammar (the complete verb set)

All puzzle verbs are one-pointer. Current implementations in `src/focus.ts`.

| Verb | Puzzle class | Feel spec |
|---|---|---|
| **Slice** | `BoxCutterPuzzle` | drag along the tape seam; tape visibly recedes, blade rides the cut edge, papery rasp per stroke; at 100% the flaps pop open (easeOutBack) + pop + sparkle |
| **Drag-to-slot** | `DragPuzzle` | grab piece (lift sound) → it follows the pointer on a camera-facing plane → release near its slot (screen-space radius ~60–70px) → snap-jump (easeOutBack + scale pulse) + material sound + chime + sparkle |
| **Wrong slot** | `DragPuzzle` | tilt ~0.35rad → slide home (easeInOut) + soft low blip + corrective hint flash. Right-place/wrong-piece and open-space drops both return home; only near-a-slot mistakes get the hint |
| **Tighten** | `BoltPuzzle` | scrub across a bolt (~46px radius); bolt visibly rotates, gold progress ring grows, ratchet ticks; done = ding + sparkle |
| **Rotate level** | `RotatePuzzle` | grab and drag sideways; object rotates about its pivot; hold still within tolerance ~0.35s → snaps level + chime |
| **Arrange** | `ArrangePuzzle` | the true ALTTL organizing mold: any piece fits any slot (uniform ghost outlines — the row never prescribes an order), placed pieces can be re-grabbed or bumped out by dropping another piece on them, and nothing is judged until the row is full. Rule = monotone in `value`, either direction by default ("no one correct way"). Right → left-to-right rising chime (`audio.chime`) + pulse + sparkle wave, then solved. Wrong → the offending neighbour pairs wiggle + reject blip + hint flash; keep rearranging |
| **Stack** | `StackPuzzle` | one landing spot; only the largest still-waiting piece may land (snap + rising chime + sparkle, pile grows by `height`). A too-small piece tilts, answers with the hint, and slides home. Placing into a slot in Arrange is neutral-positive foley only — the chime is reserved for the arrangement coming out right |

**Rules for new verbs** (peel, fold, stack, wipe, plug…): generate them
verb-noun style (ALTTL's method — pick a tidying verb, find the household
noun, or reverse). A verb qualifies if it (a) reads instantly from the scene
without text, (b) works with one pointer, (c) has an analog progress state
the player can feel, and (d) ends in a snap moment.

## 5. Feedback Law (the juice stack)

Every correct action fires **at least three channels at once**:
1. **Motion** — snap-jump with overshoot (easeOutBack), scale pulse 1.18×.
2. **Sound** — per-material foley (wood clunk, ceramic ring, tape rasp,
   ratchet tick) *plus* the universal soft chime. Sounds are synthesized in
   `src/audio.ts` — keep them "rooted in daily life" (paper, wood, glass,
   metal), short, and quiet. BGM, if ever added, must under-stimulate.
3. **Light** — sparkle burst at the point of action; emissive/brightness lift.

Escalation ladder: per-part (snap) → per-phase (ding) → per-task (solved
arpeggio + warm swell + toast) → per-game (Welcome home 🕯).
Add device vibration on mobile when integrating the rezona device API.

**Audio must never be the only confirmation** (accessibility — ALTTL was
criticized for chime-only cues). Every sound has a visual twin.

## 6. Aesthetic Bible

**Feel words:** warm, soft, hand-made, toy-like, gouache, quiet, patient.

**Palette** (source of truth: `src/palette.ts`):
- Walls rose `#e7a9a0` / deep `#d98b82` · floor cream `#efdcc0` · planks `#e2c69f`
- Wood warm `#cf9a6f` / deep `#a9744c` · trim `#c98964` · cardboard `#d8a86f`
- Books/accents: coral `#e88b7d`, gold `#f0c55f`, sky `#8bb8c7`, lilac `#b98bbf`, amber `#e5a85a`
- Ink/plum (UI text, bolts): `#5c3b48` · glow `#ffd9a0` · sparkle `#fff2cf`
- Clear color: warm cream (0.96, 0.90, 0.82) — sun through curtains.

**Material law:** flat matte, zero specular, ~25–30% self-emissive warmth lift
(`flatMaterial`). No gloss, no PBR realism, no pure white, no saturated
primaries. ALTTL's tactility comes from staying *near* reality in soft tones.

**Surface skins (`src/textures.ts`) — the art direction (2026-07-04):** the
whole game is hand-built primitives *wrapped Minecraft-style* in painted PNG
skins. Generated 3D meshes were tried twice (see `PLAN_ASSETS.md`) and retired:
the vibe lives in painted faces on simple blocks, not in sculpted geometry.
Each skin is a square gouache painting with **drawn per-face detail** — a
plank with a painted outline border + knots, cardboard with a shipping label
doodle + up-arrows, fabric with a stitched seam border, a cabinet door with a
routed panel, a blank book cover with a border frame + title plate, the framed
hills painting, floorboards, a wall wash. Generated via
`rezona-pgc-tools-gen-image` (gpt-5.4-image-2, 768px) into `src/assets/sprite/`
(`skin_*` keys; the older minimal `tex_*` swatches remain for jar corks etc.).
Style law: flat matte gouache picture-book, muted, never photoreal.
- **Feature faces are separate meshes by construction** (box flaps, book
  cover/pages/band, vanity doors, picture art) — each takes its own skin via
  `flatMaterial`'s `texture` opt, no UV-atlas needed. Box meshes map each face
  0..1, so a skin's drawn border frames every face automatically.
- `tint:true` multiplies the skin by the item colour (books tint the cream
  cover skin per palette colour); default replace mode shows the skin's own
  paint. `uv:[u,v]` tiles large surfaces (floor `[6,8]`, kitchen patch `[3,4]`).
- **Emissive law:** Babylon ADDS `emissiveTexture × texture.level` on top of
  `emissiveColor` — it does not multiply them. `flatMaterial` therefore bakes
  the warmth lift into a cloned texture's `level` (emissiveColor stays black on
  textured mats). Assigning the full-strength texture as emissive washes every
  surface toward white and silently erases tints.
- Metals (bolts, faucet knobs), foliage, ceramics stay flat colour — texturing
  small round things misreads.

**Lighting:** warm hemisphere + soft directional sun + per-room warm point
lights that start dim (~0.12) and swell to ~0.95 on task completion. Lighting
IS the progress bar.

**UI:** paper cream panels `#f6ecdd`, rose-deep borders, rounded 14–16px,
plum ink text, gold accent chips. Everything DOM (crisp + cheap), styled in
`src/ui/overlay.css`. The hint card is a pencil sketch under erasable
scribbles — help is a tidying act too.

**Camera:** first person, FOV ~66° (1.15 rad) — modest, comfort-first, no
head-bob. Focus transitions ease in/out ~0.85s, never cut.

## 7. Framing Law (hard-won)

When a station enters focus, **every interactive piece AND every target slot
must project inside the viewport** — verify on a portrait-ish canvas, since
vertical FOV is fixed. House style: stage parts on a low wooden **assembly
mat** in the lower-centre band (~65–85% screen height), targets in the upper
band (~35–50%). The original bug: parts staged on the floor under the camera
projected at ~200% height — invisible. Always run the projection check
(`__settleIn.project`) when adding or moving a station.

## 8. Input & UI Laws (hard-won)

- **Pointer lock is an enhancement, never a requirement.** It throws
  `WrongDocumentError` in embedded contexts. Drag-look is the baseline;
  lock upgrades it when granted.
- **Overlay elements are pointer-transparent by default.** Only visible,
  genuinely interactive elements (`.pill-btn`, `.curtain`, `.hintcard`,
  `.prompt.show`) get `pointer-events: auto`. A blanket
  `#ui-root > * { pointer-events: auto }` once made the *invisible* centered
  prompt swallow every click — the game felt completely dead. Any new overlay
  element must justify capturing the pointer.
- Touch: left half = move joystick, right half = look; prompts are tappable
  buttons; E is the desktop synonym for tapping the prompt.
- Esc / "Step back" always exits focus without penalty and preserves progress
  already snapped in.

## 9. Structure & Content Blueprint

Current stations (in `src/stations.ts`):
1. `shelf` — slice box → place 8 flat-pack parts (2 back boards, 2 side cheeks, base plank, shelf plank, 2 support brackets; identical parts fit either matching slot) → tighten 4 bolts
2. `books` — slice box → **arrange** 5 books on the shelf (ArrangePuzzle: uniform outlines, staged shuffled, judged stepping-evenly either direction) *(requires shelf)*
3. `picture` — rotate the crooked frame level
4. `kitchen` — slice box → mug/plant/kettle onto counter silhouettes
5. `spices` — slice box → **arrange** 5 jars on a small wall shelf above the counter, stepping evenly in height, either direction *(requires kitchen)*
6. `plates` — slice box → **stack** 4 plates biggest-first onto one spot on the counter's left end (StackPuzzle) *(requires kitchen)*
7. `sofa` — slice box → place base/2 arms/backrest → bolt the arms → place 4 cushions (back cushions stage lying flat and spin upright on snap)
8. `table` — slice box → 4 legs + lower shelf + top → 4 bolts (planks stage on the rug beside the mat, clear of slot sight lines)
9. `bed` — slice box → headboard/footboard/2 rails/3 slats → 4 bolts (long rails stage rotated 90° via `homeRot` and spin into place)
10. `bedding` — slice box → mattress phase → duvet + 2 pillows *(requires bed)*
11. `vanity` — slice box → cabinet/top/basin/wall faucet/mirror/towel rail/plant/cup → 2 bolts

Rooms: living room + kitchen nook up front (z<4); bedroom (west) and bathroom
(east, pre-set tub + toilet) behind the mid wall (z 4..9). The front door is a
gap in the west wall (z 2.15..3.15) onto a porch + hedge-rimmed yard strip
(x -8.6..-5) where parcels are delivered; the laptop order point sits just
inside the door at (-4.3, 3.35). Finished bulky
furniture pushes a collider into `house.colliders`; the staging mat hides via
`hideMat(group)` in `finish()`. Bulky flat-pack slabs stage on the floor BESIDE
the mat so they never occlude a slot outline from the focus camera.

**Adding a station** = one factory in `stations.ts`: approach point, focus
pose (obey §7), `showPending()` staging, `createPhases()` returning puzzle
thunks (lazy — later phases build their meshes only when reached), optional
`requires` gate, `moodLight` index. The TaskManager handles everything else.

**Expansion direction** (in priority order, honoring the research):
- ~~More organizing rules on existing furniture~~ ✅ delivered as `ArrangePuzzle`
  + `StackPuzzle` (books, spices, plates). Next rules ride the same engines:
  colour-gradient mugs (`value` = hue position), towels by width, frames by
  size — one new *value*, zero new code.
- New verbs: peel packing tape off furniture, unwrap paper (wipe verb),
  plug in the lamp (drag plug → socket → light warms), fold the empty box
  flat (satisfying disposal beat — cardboard should not just vanish).
- A second room behind a door that unlocks when room one is warm.
- Before/after: snapshot each room's start state; show the pair at the
  finale. The genre's single most-loved feature — cheap, high payoff.
- A gentle chaos agent (cat) only if it stays comedic and optional-feeling.
- Multiple valid arrangements (books by height OR colour) with segmented
  star pips — ALTTL's "no one correct way" philosophy.

**Escalate mundane → a little magical** across the game (ALTTL's chapter
arc): the last task in a room may bend realism slightly (the powered nook
glowing impossibly warm) for the emotional payoff.

## 10. Technical Contract

- Stack: vanilla **Babylon.js + TypeScript + Vite**, no React, no
  `@rezona/core`. Deps resolve upward into the parent repo's `node_modules`.
- Dev: `cd settle-in && bunx vite` → port **5188**. Build: `bun run build`.
- Module map: `main.ts` (loop/curtain/debug) · `palette/materials` (look) ·
  `house` (shell/lights/colliders/yard) · `player` (FPS controller) · `input`
  (unified walk/focus) · `focus.ts` (camera director + puzzle engines) ·
  `props.ts` (prop factories) · `stations.ts` (content) · `shop.ts` (online
  catalog, deliveries, carry) · `taskmanager.ts` (orchestration; walk-mode E
  resolves to the nearest point of interest: station / porch parcel / laptop) ·
  `ui/overlay.*` (DOM layer incl. the shop panel).
- All sounds synthesized (WebAudio) — zero audio assets. All props are
  primitive-built via factories — GLB swap-in can happen per-factory later.
- **Debug hooks** (`window.__settleIn`): `tick(n)` step frames, `project(v)`
  world→CSS px, `pause()/resume()` for still captures,
  `manager.debugState()/debugForceSolve()`,
  `shop.debugState()/debugDeliverNow()` (skip the delivery wait). Every new mechanic must be
  verifiable through these (real `PointerEvent` dispatch + `tick`) — this
  caught every real bug so far; direct-flag tests alone did not.

## 11. Tone of Writing (UI copy)

Second person, present tense, gentle, a little wry. Short. Never commands
("Place the books correctly" ❌) — invitations ("Make it feel like home
again" ✅). Task titles are plain domestic phrases: "Build the bookshelf,"
"Set the counter." The game never praises with points; it says things like
*done* and, once, *Welcome home*.
