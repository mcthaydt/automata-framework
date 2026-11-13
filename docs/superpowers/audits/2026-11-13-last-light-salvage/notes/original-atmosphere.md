> Carried from `claude/last-light-atmosphere`, unchanged but for this line: notes only, stopped when the game was scrapped. Useful for the new game's look. The frames it measures are not carried.

# The Last Light: the original's atmosphere, measured (2026-11-13, stopped)

LOOK session, no subagents. The Owner asked, looking at the camera-back sheets: "why is the atmosphere off compared to the original?"
Branch `claude/last-light-atmosphere`, from `claude/last-light-camera-back` at `7c207cd6e`.

**Stopped early.** Partway through the diagnosis the coordinator passed on the Owner's decision: "scrap the last light; we'll do a brand new
microgame with same features; a systemic horror game". These notes were kept because they help with the new game's look. **The game is
unchanged. No code changed and no gates ran.** The diagnosis below is **incomplete**: no fixes were made and no new frames were shot.

The original is `mcthaydt/PixiJS3D_Experiment_001` at `92e6704`. It was cloned read-only beside this repository, and nothing was pushed to it.
The frames measured are the camera-back session's, in `../2026-11-13-last-light-camera-back/{after,original}/`.

## 1. The original's atmosphere, from its code

### The light model (`src/render/look.ts`, `LIGHT`)

| | Value |
|---|---|
| lamp strength at level 1 | 2.6 (vertex lighting and the sprite samples) |
| falloff, the same for every lamp | `(1 − d / range)²`, stepped to 0.1 |
| ambient key | 0.15, tint `[0.84, 0.97, 0.98]` (unlit surfaces fall to a cool teal grey) |
| wall fill | 0.08 on upright surfaces, tint `[0.78, 0.95, 1.0]` |
| sprite key | 0.85 (sprites and decals sit a little under the walls) |
| floor light pools | an additive speckle under each lamp, alpha 0.1 to 0.5 per unit of lamp level |

### The lamp kit (`ARCHETYPES`: colour, range band, peak)

pendant `#ffd59b` 5.5–9 m, peak 1.0 · bulb `#ffce7f` 3.5–6, 1.5 · desk `#ffbc4e` 3.5–5.5, 1.25 · fluorescent `#eadbc9` 4–8, 1.25 ·
sodium `#ffbc4e` 6–10, 1.25 · fire `#f99b4e` 4–6.5, 1.5 · gas `#9c9bef` 3–5, 1.25 · screen `#91daa1` 2–3.5, 1.5 · moon `#96b2d9` 3–5, 1.0 ·
fill `#96b2d9` 3.5–6, 1.25 · spark `#6dccff` 3–5, 2.5. Named levels: off 0, ember 0.25, dim 0.5, low 0.75, on 1, high 1.25.

### The prologue's lamps and their levels

Positions, colours and ranges are in `src/scenes/prologue/level.ts:56–70`. The levels are the clinic's (`src/scenes/clinic/dress.ts`,
`update`), scaled by the prologue's dress (`src/scenes/prologue/dress.ts:28`).

| Lamp | Kind | At (x, y, z) | Range / radius | Level in the prologue |
|---|---|---|---|---|
| deskLamp | desk | 3.05, 1.55, 1.15 | 5 / 1.7 | 1.05 (with a slow flicker) |
| monitorGlow | screen | −2.4, 1.5, −3.05 | 2.6 | 0.55 |
| hallLamp | pendant | 0, 3.4, 2.6 | 7.5 / 3.4 | 0.6 |
| wardLamp | pendant | −3.2, 3.4, 3.4 | 6 / 2.6 | 0.5 |
| corridorLamp | bulb | 0, 3, −3.2 | 5.5 / 2.6 | 1 × 0.12 = 0.12 |
| exitLamp | bulb | 0, 2.75, −5.8 | 5.5 / 1.8 | 1.25 |
| closetLamp | fluorescent | 3.1, 3.4, −4.5 | 4.5 / 2.2 | 0 |
| moon | moon | 0.3, 2.2, 0.2 | 4.2 | 0.85 × 0.4 = 0.34 |
| moonCorridor | moon | −0.9, 2.3, −4.9 | 3.2 | 0.8 × 0.6 = 0.48 |
| wardFill | fill | −3.5, 2.5, 3.7 | 4.8 | 1.15 |
| bayFill | fill | −3.4, 2.7, −0.8 | 4.4 | 0.95 |
| sconce | bulb | 2.4, 2.7, −0.3 | 3.6 | 0.75 × 0.5 = 0.375 |
| curtains, spark | fire, spark | | | 0 in play |

**Today's game has the same lamps.** `content/levels/prologue.af-sector.json` `lamps` matches this table in position, colour, range,
radius and level. So the gap is **not** in the lamp data. It is in how the lamps are drawn and in what is laid over the picture.

Other per-lamp effects in the clinic's dress: `lampSheens` (a glow node per lamp, alpha = its level × gain), `exitHalo` (alpha up to 0.55,
0.45 × the exit lamp's level), bulbs drawn bright (`0xffe8b8`) above a level of 0.3, and puddle reflections lit by `lightAt`.

### Haze (`HAZE`)

Colour `0x4b5a56` (dim grey-green), linear from −5 m to +7 m around the camera's focus. On top of that, **mist puffs**: 72 puffs, each 8–11 m
across, alpha 0.1, kept in a box of ±7 m by ±6 m round the focus between 0.25 m and 2.1 m high, drifting 0.16 / 0.05 m/s with a sway of 0.25.
Unlit mist keeps 0.95 of the haze colour, and **light adds to it with a glow of 1.6**. That glow is how the original's lamps make a
visible pool in the air. Today's game has the haze colour (`lookOf`, `hazeColourOf(0x4b5a56)`, 0 to 7 m, `glow: 0`) but no lit mist.

### Post (`POST`; the chain is in `src/render/stage.ts`: dread blur, retro pass, bloom, LCD panel)

- **Bloom** (`bloom-filter.ts`): white threshold 0.88; **warm threshold 0.45** (a pixel whose red-over-blue passes 0.45 emits as warm light);
  intensity 0.8, radius 5 framebuffer pixels. This is where the warm orange halo over the desk and the exit comes from. Today's chain
  (`look-passes.ts`: retro grade, then the LCD panel) has no bloom.
- **Fade**: black lifts to 0.13 × the haze colour, white settles at 0.96, grain 0.04 at 12 fps, dust specks, scratch 0.25.
- **Dither**: Bayer 8×8, strength 1/64, 8 levels, luma weight 0.5 (today's `lookOf` uses the same).
- **Grade**: exposure 0, warmth −0.12, tint 0.08, contrast 1.05, highlights −0.05, saturation 0.85, vibrance 0.1, sharpness 0.35,
  **blackCrush 0.025**, moodBlend 0.85.

The vignette and the LCD panel are in `src/render/lcd-panel.ts` and `retro-filter.ts`; their numbers were not read before the stop.
Today's game draws the mesh at a fifth of the old strength (`look.toml` `[lcdScreen]` grid and scanlines 0.06, set for Ada's face when the
camera was near).

### Today's light (for comparison; where it is set)

`games/the-last-light/src/features/room/room.ts`: `worldLighting(WORLD, timeOfDay('lampLit'))`. `lampLit` (`packages/3d/src/shared/time-of-day/library/times.json`)
has ambient 0.15 `#e0faeb`, fill 0.08 `#c6ecff`, and a grade tint `#7964ba` at 0.2. The light multiplies in sRGB (`colorSpace: 'srgb'`),
so `look.toml` `[light] lamps = 0.7` scales every lamp down. The framework's lamps already take an `aim` and a `cone`
(`packages/3d/src/app/world-lighting.ts`, `aimOf`), so a spot light exists. Not checked before the stop: whether a bloom, lit mist or a
warm-threshold glow pass exists in the framework.

## 2. Measured: the frames' luminance

Method (`tools/measure.py.txt`): Rec. 709 luma of the sRGB values (0–255), over each frame **below its top 15%**, which drops the HUD,
the original's debug line and its minimap. "dark" is the share under 16. "hue95" is the hue of the mean colour of the brightest 5%, and
"warm95" is the share of the brightest 5% with red over blue by more than 20. "edge/mid" is the outer 10% ring's mean against the middle's,
so a lower number means a stronger vignette. These are the camera-back session's frames: "today" is `after/`, and the spots are those
listed there.

| Frame | | mean | p5 | p50 | p95 | dark | hue95 | warm95 | edge/mid |
|---|---|---|---|---|---|---|---|---|---|
| 1024×768 hall-south | today | 24.4 | 0.0 | 26.3 | 53.7 | 39.2% | 147 | 14% | 0.46 |
| | original | 30.0 | 5.1 | 29.2 | 60.6 | 22.4% | 128 | 13% | 0.51 |
| 1024×768 corridor | today | 29.6 | 0.0 | 27.3 | 68.3 | 32.3% | 54 | 42% | 0.65 |
| | original | 24.0 | 0.8 | 23.1 | 61.7 | 39.6% | 140 | 11% | 0.39 |
| 1024×768 closet | today | 24.4 | 0.0 | 25.8 | 53.5 | 42.8% | 47 | 47% | 0.52 |
| | original | 19.5 | 0.0 | 21.9 | 43.4 | 43.1% | 167 | 2% | 0.30 |
| 844×390 hall-south | today | 25.1 | 0.0 | 27.1 | 56.5 | 39.4% | 134 | 15% | 0.51 |
| | original | 27.9 | 0.0 | 28.2 | 65.2 | 31.8% | 140 | 11% | 0.29 |
| 844×390 corridor | today | 34.9 | 2.7 | 32.0 | 77.2 | 28.4% | 51 | 60% | 0.58 |
| | original | 19.3 | 0.0 | 15.1 | 51.0 | 50.5% | 142 | 13% | 0.21 |
| 844×390 closet | today | 27.0 | 0.0 | 20.4 | 72.5 | 44.7% | 47 | 78% | 0.52 |
| | original | 15.8 | 0.0 | 9.7 | 41.9 | 55.4% | 167 | 1% | 0.30 |

### What the numbers say (first read; the stop came before the rest)

- **The brief's "today is lit evenly and brighter" is not true everywhere.** In the hall, the original is a little *brighter* (mean 30
  against 24) and has *fewer* near-black pixels (22% against 39%). Part of today's dark share in the hall is the black band below the cut
  south wall. The original's hall is not darker overall: its light is gathered into a few places (the window shaft, the desk, the floor
  pool), and the rest is a dim, even teal haze rather than black.
- **In the corridor and the closet, today is brighter and less dark than the original**, most of all on the phone: corridor p50 32
  against 15, dark 28% against 51%; closet mean 27 against 16. The original's 16 m camera saw past the walls into black, and today's
  nearer camera fills the frame with lit room. That is the camera, not the light.
- **The brightest pixels are a different colour.** In the original, the brightest 5% are teal-green (hue 128 to 168) in every spot, with
  at most 13% of them warm. Today's corridor and closet have orange brightest pixels (hue 47 to 54, 42% to 78% warm). By eye, that is her
  shirt and skin and the yellow context button, which today are the brightest things on screen. In the original, she is dim and the room's
  highlights are cool. The warm accent the eye sees in the original is a small, haloed area (bloom with a warm threshold over the desk lamp
  and the exit), too small to move the 95th percentile.
- **The vignette is stronger in the original**, most of all on the phone: edge/mid 0.21 to 0.30 against 0.52 to 0.58. At 1024×768 it is
  close in the hall (0.51 against 0.46) and stronger in the corridor and the closet.

### Likely causes, ranked (a hypothesis; not confirmed by a change)

1. **No lit mist and no bloom.** The original's lamps light the air (mist glow 1.6) and halo warm pixels (bloom, warm threshold 0.45).
   Today's lamps light surfaces only, so its pools have no glow and nothing draws the eye. Both are framework **capabilities**. A bloom
   pass with a warm threshold, and haze that light adds to, were not found in the game's passes.
2. **Today's camera frames more lit room and less black** (corridor, closet), and the vignette is weaker (edge/mid about 0.55 against 0.3).
   This is **data and a deliberate choice**: the camera distance, and the screen mesh set to a fifth for Ada's face at the near camera.
3. **The figure and the HUD are the brightest, warmest things in the frame.** In the original, the room's lights are. This is presentation
   **data**: her light share (the original had `characters.light 1.05`, `ambient 1.5`, `carried 0.4`) and the context button's colour.

## 3. What was not done

The tasks below were not done. The stop came during step 1.

- The vignette and LCD numbers, and per-room light data.
- Props per room.
- The fixes.
- The black band and block.
- Re-shoots and sheets.
- All gates.

## For the tracker

| Session | Kind | Branch | Row |
|---|---|---|---|
| Atmosphere | LOOK session (no subagents), **stopped by the Owner's decision to scrap The Last Light** | `claude/last-light-atmosphere` | 2026-11-13, from `7c207cd6e`. Docs only, and the game is unchanged. Recorded: the original's light model, lamp kit, prologue lamp levels (identical to the game's level file), haze and mist, and post chain numbers (bloom with a 0.45 warm threshold, fade lift 0.13, grade with blackCrush 0.025 and saturation 0.85); luminance, darkness, hue and vignette measurements of the camera-back frames (today against the original, 3 spots, 2 sizes). The fixes, shots and gates were not done. Useful for the new systemic horror microgame's look: lit mist and a warm-threshold bloom are what the original had and the framework's chain lacks. |
