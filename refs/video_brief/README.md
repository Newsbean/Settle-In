# SETTLE IN — Video Brief Package

Everything needed to generate a ~15s **intro** and ~15s **outro** trailer for the
game in an external text/image-to-video tool (Kling, Runway, Sora, Veo, Pika…).

## Contents
| File | What it is |
|---|---|
| `INTRO_generation_script.md` | ~15s opening: arriving at an empty home that begins to warm. Shot list + one-paragraph prompt + negative prompt. |
| `OUTRO_generation_script.md` | ~15s closing: the "welcome home" before/after payoff, every room warm. |
| `reference_style_warm-room.jpg` | **Primary style anchor.** Real in-engine frame: warm coral gouache room, wood floor, crooked hills picture, ceiling mood-glow. |
| `reference_arrival_doorway.jpg` | Real in-engine frame: POV at the front door, taped parcel + order-laptop just inside. |

## How to use
1. **Image-to-video tools:** upload `reference_style_warm-room.jpg` as the image
   prompt (use `reference_arrival_doorway.jpg` for the door/arrival shots), then
   paste the matching **one-paragraph version** as the text prompt. Many tools
   generate 10–15s in one go now — try the one-paragraph prompt first; if your
   tool caps at 5s, generate the 3 shots separately and cut them to ~15s.
2. **Text-only tools:** paste the one-paragraph prompt + the GLOBAL STYLE BLOCK,
   and always include the NEGATIVE PROMPT — it's what keeps the render off
   photoreal/glossy and on the hand-painted look.
3. Keep the palette hex codes in the prompt — they're the strongest lever for
   matching the game's exact muted, warm gouache color world.

## The look in one line
Warm, soft, hand-made, toy-like **gouache** picture-book. Flat matte, zero gloss,
no photoreal. First-person, comfortable 66° FOV, slow eased camera, no head-bob.

## Palette (source of truth: `src/palette.ts`)
- Walls rose `#e7a9a0` / deep `#d98b82` · ceiling/cream `#efdcc0` · floor planks `#e2c69f`
- Wood warm `#cf9a6f` / deep `#a9744c` · trim `#c98964` · cardboard `#d8a86f`
- Accents: coral `#e88b7d`, gold `#f0c55f`, sky `#8bb8c7`, lilac `#b98bbf`, amber `#e5a85a`
- Ink/plum (text) `#5c3b48` · warm glow `#ffd9a0` · sparkle `#fff2cf`
- "Clear color" (sky/void): warm cream ≈ `rgb(245, 230, 209)` — sun through curtains.

## Continuity note
Intro and outro deliberately **rhyme**: both begin/end at the same front door,
the same crooked-then-level hills picture appears in both, and the light swell in
the intro is paid off by the fully-warm rooms in the outro. Keep that mirror if
you re-cut or regenerate shots.

> Reference frames were captured live from the running game (port 5188) via the
> canvas-capture recipe, so they reflect the actual current art direction — not a
> mockup. Rooms are shown empty because furniture only exists after play; the
> outro script describes the furnished state in words for the video model.
