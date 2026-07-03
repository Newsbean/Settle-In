# Asset Plan

> **Final direction (2026-07-04): no 3D meshes at all.** After both GLB passes
> below, the user pivoted the art direction: the game is hand-built primitives
> wrapped Minecraft-style in painted PNG skins (`skin_*` textures in
> `settle-in/src/assets/sprite/`, wired in `src/textures.ts` + `props.ts` +
> `house.ts`). `FILES` in `src/models.ts` is empty; all GLBs are retired
> but kept on disk. See GAME_BIBLE §6 for the skin style law and the Babylon
> emissive-texture gotcha that was washing tints out.

> **Curation note (2026-07-03, two GLB passes):** the first generation batch was
> reviewed in-game and 16 of 20 GLBs rejected as muddy driftwood blobs; a second
> Tripo pass with rewritten "cute minimalist toy X, flat solid matte pastel"
> prompts recovered 8 shaped props before the whole mesh direction was retired
> in favour of painted skins. The full 22-entry retired GLB catalog lives in this
> file's git history (commit prior to 2026-07-03T10:20Z).

---

- Project: settle-in
- Planned at:    2026-07-03T10:20:19Z
- Last verified: 2026-07-03T10:20:19Z (11/14 on disk + wired; skin_tile / skin_path / skin_hedge pending — image-gen credit exhausted, see status note)
- Skill version: rezona-pgc-game-plan-assets
- Mode: 3d (hand-built primitives wrapped in painted 2D skins; surface textures route through gen-image as the texture-overlay exception — no GLB meshes, per GAME_BIBLE §6)
- Art-direction anchor: flat matte gouache picture-book, muted warm palette, soft even fills with a few gentle drawn strokes, no photoreal detail, seamless-tiling
- Audio-direction anchor: warm, soft, patient, under-stimulating, rooted in daily domestic life, low-frequency-forward, quiet, no bright hooks
- Totals: BGM 1, SFX 5, Image 8 (cutouts: 0), Model 0

**Scope note (2026-07-03):** this pass adds the game's first audio-asset bytes
(BGM + a few SFX files) alongside painted skins for every remaining flat surface.
The synthesized WebAudio foley in `src/audio.ts` (wood/ceramic/tape/bolt) stays —
only `doorbell()` and `thud()` are swapped for files, and ambient beds + a van
cue are new.

**Generation + wiring status (2026-07-03):**
- ✅ BGM (1) + SFX (5): generated, registered, and **wired** — `audio.ts` gained
  a sample layer (BGM + room-tone loops start on unlock; garden ambience
  crossfades via `setOutdoor()` from `main.ts` when the player exits west;
  `doorbell()/van()/thud()` play samples with synth fallback). `main.ts` calls
  `audio.registerAssets(ASSETS)`. Verified: mp3s fetch 200, decode clean, no
  console errors.
- ✅ Skins 5/8: `skin_wall_deep`, `skin_ceiling`, `skin_trim`, `skin_rug`,
  `skin_grass` — generated, in `textures.ts` URLS, and applied to their
  materials in `house.ts` (deep walls, ceiling, baseboard/frames, both rugs,
  yard lawn). Verified in-preview (deep wall renders the plaster wash).
- ⏳ Skins 3/8 blocked: `skin_tile`, `skin_path`, `skin_hedge` — the OpenRouter
  gpt-5.4-image-2 key hit its weekly credit ceiling (HTTP 402) partway through;
  the yunwu Grok fallback returns 503 (no channel). Re-run the ready sequential
  command once credit is topped up; those three surfaces (bathroom tile, stone
  path, hedges) stay flat-colour until then. Add them to `textures.ts` URLS +
  the matching `house.ts` materials (`tile`, `yard-path`, `hedgeMat`) after.

## BGM (1)

### `bgm_home_loop`
**Prompt:** soft warm ambient loop for a cozy home, felt piano and faint warm pad, very slow tempo, no strong melody or percussion, distant and low in the mix, seamless loop with no fade-out, under-stimulating and patient
**Rationale:** a single music bed for the whole house; GAME_BIBLE §5 requires any music to under-stimulate and sit far back. Quiet looped playback + volume control wired in the build step.

## SFX (5)

### `sfx_room_tone` (×1)
**Prompt:** quiet indoor room tone, soft still air, faint warmth, seamless loop
**Rationale:** ambient bed layered under all indoor play; adds atmosphere without touching the synth foley. Looping clip (`--loop`).

### `sfx_garden_ambience` (×1)
**Prompt:** gentle outdoor garden ambience, soft distant birdsong and faint breeze through leaves, seamless loop
**Rationale:** ambient bed that fades in on the porch/yard; complements the new outdoor space. Looping clip (`--loop`).

### `sfx_doorbell` (×1)
**Prompt:** warm friendly two-tone door chime, ding-dong, short, soft
**Rationale:** replaces the synth `doorbell()` cue fired when a parcel is delivered.

### `sfx_delivery_van` (×1)
**Prompt:** small delivery van pulling up and stopping, gentle distant engine and soft brake, brief
**Rationale:** new cue played just before a parcel lands on the porch; the synth kit had nothing for it.

### `sfx_box_thud` (×1)
**Prompt:** cardboard box set down on a wooden floor, soft weighty thud, short
**Rationale:** replaces the synth `thud()` cue at box set-down.

## Image (8)

### `skin_ceiling` — sprite
**Prompt:** flat matte gouache picture-book texture, pale cream plaster ceiling, faint soft mottling, muted warm, soft even fill, no photoreal detail, seamless tiling
**Cutout:** no
**Rationale:** wraps `ceilMat`; surface skin must stay full-bleed, so cutout is overridden off (sprite default is on).

### `skin_grass` — sprite
**Prompt:** flat matte gouache picture-book texture, soft painted lawn, muted sage green, gentle short blades, no photoreal detail, seamless tiling
**Cutout:** no
**Rationale:** wraps the yard lawn (`yard-grass`); full-bleed ground skin.

### `skin_hedge` — sprite
**Prompt:** flat matte gouache picture-book texture, clipped leafy hedge, muted green foliage, soft rounded leaves, no photoreal detail, seamless tiling
**Cutout:** no
**Rationale:** wraps the yard hedges (`hedge`); full-bleed foliage skin.

### `skin_path` — sprite
**Prompt:** flat matte gouache picture-book texture, worn warm flagstones, sandy tone, soft grout seams, no photoreal detail, seamless tiling
**Cutout:** no
**Rationale:** wraps the stone path (`yard-path`); full-bleed ground skin.

### `skin_rug` — sprite
**Prompt:** flat matte gouache picture-book texture, soft woven area rug, gentle geometric weave, muted cream, no photoreal detail, seamless tiling
**Cutout:** no
**Rationale:** wraps both rugs (living room + bedroom) with `tint:true` so each takes its palette colour; full-bleed woven skin.

### `skin_tile` — sprite
**Prompt:** flat matte gouache picture-book texture, pale blue-grey square wall tiles, soft grout grid, muted, no photoreal detail, seamless tiling
**Cutout:** no
**Rationale:** wraps the bathroom tile patch (`tile`); full-bleed tiled skin.

### `skin_trim` — sprite
**Prompt:** flat matte gouache picture-book texture, warm painted wood trim, subtle grain, muted, no photoreal detail, seamless tiling
**Cutout:** no
**Rationale:** wraps the baseboard and door frame (`trimMat`); full-bleed wood skin.

### `skin_wall_deep` — sprite
**Prompt:** flat matte gouache picture-book texture, deep dusty-rose plaster wall wash, soft even fill with faint gentle strokes, muted, no photoreal detail, seamless tiling
**Cutout:** no
**Rationale:** wraps `wallDeepMat` (the back organizing wall + all dividers); the deeper companion to the existing `skin_wall`.

## Already in `src/assets.ts` (10 skins)

`skin_book_cover`, `skin_cardboard_label`, `skin_fabric_cream`, `skin_fabric_rose`, `skin_floor_plank`, `skin_picture_art`, `skin_vanity_door`, `skin_wall_wash`, `skin_wood_deep`, `skin_wood_plank` (plus the older `tex_*` swatches).
