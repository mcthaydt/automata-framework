# base-3d art direction: match Emberwick's look

Status: drafted 2026-11-01 by the 3D art lane (session_01QYLU1hrGL6WtJhKZasRs8Z); reviewed: pending (the coordinator);
accepted: pending (auto-accepted once reviewed, Owner 2026-10-31: "Reminder that everything is auto approved and
accepted, do not wait on me to do any approvals"). Spike: [`docs/spikes/base-3d-art.md`](../../spikes/base-3d-art.md).
Mockups: [`docs/evidence/owner-visual/2026-11-01-base-3d-art-direction/`](../../evidence/owner-visual/2026-11-01-base-3d-art-direction/).

## 1. Goal and boundaries

**Why.** Owner, 2026-10-31: "The 3D scene looks like shit compared to the 2D, will we address that?", then "Use opus
when we do" and "Okay go for it". The bar: the free 3D game (`games/base-3d`) looks as good as the 2D Emberwick
(`games/emberwick`), with everything the 2D scene does also done in 3D. "Better than before" is not the bar.

**Observable result.** The room reads as a moonlit, overgrown ruin at night in Emberwick's palette: dark blue stone
that is mossy and textured, glowing cyan mushrooms that throw coloured light, lava in the channels that glows and lights
the channel walls, embers that glow, pulse and throw sparks, a goal ember with a column of light and sparks, Wick
carrying a warm lantern glow, fireflies drifting, moonlight shafts, fog into a night-teal distance, and pines, ruined
towers and the moon beyond the walls and through the far arch.

**Deliverables** (one wide PR, branch `claude/3d-art-pass`):

1. This spec, the spike and the mockups.
2. The art in `games/base-3d/src/views/` (§4), plus one reusable piece in `render-pixi3d` (§3.2).
3. Acceptance images at `docs/evidence/owner-visual/2026-11-01-base-3d-art-pass/` (§8) with an honest README.
4. Carried follow-up: the roll clip from the Studio replaces `roll.toml`'s placeholder, its markers checked against
   the roll's 24 ticks (§4.11).

**Exclusions.** The sim (no change to `systems/`, `state/`, `components.ts`, `commands.ts`, `events.ts`,
`constants/`); the room's layout and level file (EG-1); rigged glTF (procedural only, Owner 2026-10-23); a bloom post
filter (§5, follow-up); the Tuner step; real-device testing; the GPU frame-budget probe (the coordinator's runner);
Emberwick's own code (it keeps its palette stand-in; switching it to the shared palette is a follow-up).

**Prerequisites.** #371 and #373 (the free game and its quality pass), on which the branch stacks; #367 (Studio,
EDS.9) on main for the roll clip.

## 2. The 2D scene, element by element, and its 3D counterpart

**Revision (2026-11-01, lane 2: baked vertex light only):** the Owner: "No we still used textures, we only used vertex
lighting though, no real time". Nothing is lit in real time any more: no moonlight, environment or point lights. The
stone keeps its painted textures (calmer: no lone specks, solid moss clumps, the floor 64 px over 4 m) on unlit
materials, its faces cut into half-metre cells, and the night's light (`views/lighting.ts`: a moonlit ambient, the moon
as a far lamp, a lamp per mushroom cluster and one at the goal) is baked into the vertices once; the occluder walls are
baked by render-pixi3d. Embers, the lantern, rims and mushrooms glow unlit; Wick takes the bake's light at his chest.
§4.4's Phong materials and §4.10's light budget no longer apply. The moon is painted at 128 px; the view draws at most
360 px tall (`maxInternalHeight`). Why: `docs/spikes/base-3d-art.md`, "What we took from the 3D reference game".

**Revision (2026-11-01, the coordinator's second review):** the ruin floats in the open night, so the sky (deep blue 40
below the horizon, 52 above) fills the frame beside and below the room; walls are low fragments (bays 0.5–1.3 m, pillar
stubs, a 0.9 m near parapet); silhouettes stand on far islands below; the moon is 16 m, high on the right; the channels
are gaps onto the sky with teal rims, with no lava, no red and no lava lights; grass and moss use Emberwick's 34–37; the
view fills the page (no letterbox). Rows below that say otherwise are superseded by this paragraph.

Colours are Endesga 64 entries by index (`ENDESGA_64[i]`), the indices Emberwick's `render/scene.ts` and
`render/backdrop.ts` use, so both games name the same entries.

| 2D element (Emberwick) | 2D source | 3D counterpart (base-3d) | Numbers |
|---|---|---|---|
| Night background | `endesga(15)` #0e071b | Clear colour and the darkest silhouettes | night = 15 |
| Sky bands | 52 #03193f, 39 #0c2e44, 38 #134c4c | `view.background` Hemisphere: sky 52 above, 38 below the horizon | — |
| Ground fog band | 38 at 0.55 alpha | Linear fog, colour 39 | near 9 m, far 30 m (spec'd; was 5/14 in #2e222f) |
| Moonlight ambient (light map clear) | 11 #657392 | `view.environment` Hemisphere 11 / 39 at intensity 0.6, plus a `DirectionalLight` in 45 at 0.55 from the far end, high (tuned up from the spike's 0.2 / 0.3 against the acceptance images and the coordinator's exposure note) | — |
| Moon | disc 9, highlight 8, craters 10, glow 45 | Moon card (painted disc, unfogged) low beyond the far arch, with an additive glow card in 45 | disc 8 m at (0.6, −4.2, 60) |
| Stars | 9 | Additive motes in 9/10 on the sky behind the far arch | 70 |
| Far towers | 52 | Crossed-quad tower cards beyond the far wall, below the plateau, unfogged | 9 towers, 14–22 m |
| Near tree line | 15 | Crossed-quad pine cards outside both side walls and in the valley beyond the arch | ~40 pines, 6–8 m |
| Light shafts | 45 at 0.1 alpha, slanted | Additive slanted-band cards in 45 | 4 shafts, 5–6 m, alpha 0.3 |
| Mossy stone platforms | tiles + grass | Flagstone floors (canvas-painted, 32 px per 2 m, moss clumps of 36/37/38) on 13/12 stone, mortar 14 | moss 0.35 |
| Grass tufts | 34–37 | Masked cylindrical cards along every platform edge and wall foot, tinted moonlit | ~200 tufts, 0.3 m |
| Hanging vines | vine sprites | Masked vine cards down the channels' walls | 28, 0.9 m |
| Walls | dark brick columns | Ruined side walls: 2 m bays of varying height (1.6–2.6 m), pillars every 4 m (3.2 m), brick texture 12/13 on mortar 15; far wall an arch (opening 3.2 m × 3 m) | — |
| Glowing mushrooms | light 43 r14, halo 45 | Clusters of three emissive caps (43) on pale stems (45), each cluster a `PointLight` 43 and a halo card | 10 clusters, light range 3.2 m, intensity 1.6 |
| The ember | light 30 r60, halo 28, sparks 32/31/30/28 | Each ember: emissive core (30, strength 0.7, so its facets stay orange), `PointLight` 30 (range 2.6, intensity 1.4), pulsing halo card and six sparks; the goal: larger core (32), `PointLight` 31 (range 5, intensity 2.2), halo 2.4 m, rising sparks, a column of light | 5 embers + goal |
| Wick's lantern | light 31 r52 at (+6, −4), halo 30 | A small emissive lantern (31) at Wick's side, a `PointLight` 31 (range 4.5, intensity 3) and a halo card, plus a cool `PointLight` 45 1.9 m over his hood (range 2.6, intensity 1.4) for the sprite's cyan rim that follow him | offset 0.35 m right, 0.55 m up |
| Fireflies | light 33 r7, glow 33 | Additive motes in 33 drifting over the room | 22 |
| Vignette | 15 at 0.7 | Fog and the dark falloff do it; a screen vignette is a follow-up | — |
| (none: 3D only) Lava channels | — | Unlit bright lava texture (28 base, 26/27 crust, 29–31 cracks, 32 sparkles) 0.7 m below the platforms (a slow scroll is a follow-up: not built); two `PointLight` 28 per channel (range 4.5, intensity 2.2); a row of additive heat cards above it | — |

## 3. Ownership and contracts

### 3.1 Presentation only

Everything here is presentation (law 1): the sim never reads it, `pnpm boundaries` does not scan `views/`, and the
route golden must not move. A moved golden stops the work until its cause is found (§7).

### 3.2 render-pixi3d: textured walls (the one reusable piece)

`Occluders.wall(options)` today builds every wall from one shared unit cube with a flat `PhongMaterial`. Textured walls
need UVs in world metres per wall. `WallOptions` gains an optional `surface?: { texture: Texture; tile: number }`
(`tile`: metres per texture repeat); with it the wall's slab (not its trim) gets its own geometry, a unit cube whose UVs
are scaled by the slab's size over `tile`, and a `PhongMaterial({ baseColorTexture })`. Without it nothing changes. The
occluder pass keeps working because it reads `mesh.material` at each frame. render-pixi3d stays unpublished (D-1), so
no changeset; the API report is not generated for private packages.

### 3.3 The palette's one source

The colours come from `@mcthaydt/automata-content`'s `DEFAULT_PALETTE` (Endesga 64, checked against
`docs/art/palettes/endesga-64.txt` by its test), through a new browser-safe subpath export
`@mcthaydt/automata-content/palette` so a game page does not bundle the compiler. base-3d's `views/palette.ts` names
the tokens (§2) as indices into it. This is a new public entry of a published package: a patch changeset and the
API report; listed under "Decisions for the Owner's veto".

### 3.4 base-3d views (new files under `games/base-3d/src/views/`)

| File | Owns | Interface |
|---|---|---|
| `palette.ts` | The tokens | `TOKENS` (index per role), `colour(token): number` |
| `textures.ts` | Procedural pixel textures, painted into pixel buffers (testable without a canvas), then uploaded | `paint*(): Pixels` (`{ width, height, data: Uint8ClampedArray }`), `toTexture(pixels, repeat)` |
| `dressing.ts` | Where things go: mushrooms, lights, grass, vines, shafts, silhouettes, wall bays, from the area | `dressingOf(area): Dressing` (pure, deterministic) |
| `night.ts` | Builds the sky, fog, ambient, moon light, walls, floors, lava, mushrooms, cards and motes under the view; animates motes, halos and lava | `buildNight(view, occluders, area, clock): NightScene` (`update(seconds)`, `dispose()`) |
| `ember.ts` (changed) | Emissive core, its point light and halo; goal sparks and column | `emberView(clock)` as now |
| `lantern.ts` | Wick's lantern: wraps the hero's figure view with the lantern mesh, light and halo | `withLantern(factory): View3dFactory` |

`views/index.ts`'s `buildScene` and `FOG` are replaced by `night.ts`; `main.ts` passes the new pieces.

## 4. Look, with numbers

4.1 **Palette:** §2's indices; no colour literal in the views except through `colour(token)`.

4.2 **Light rig:** hemisphere ambient 0.6 (11 over 39); one directional moonlight (45, 0.55) from (−6, 14, 40) toward
(0, 0, 10); point lights: one per mushroom cluster, 4 lava, 5 embers, 1 goal, 2 on Wick (lantern and rim), cap 24 (`dressing.test.ts`) (tiled lighting holds 32).
A taken ember's light goes with its entity.

4.3 **Fog:** linear 9 → 30 m, colour 39; the backdrop (moon, silhouettes) unfogged.

4.4 **Materials:** floors and walls `PhongMaterial` with textures, shininess 4; lava `FlatMaterial` unlit, unfogged;
glowing things `PhongMaterial` with `emissive`.

4.5 **Props:** mushroom clusters at the wall feet (positions from `dressingOf`, never within 1 m of the spawn, an ember
or the goal, never in a channel); the goal's plinth (0.9 × 0.35 m).

4.6 **Particles:** halos and heat (one additive container), motes and sparks (one), grass (one, masked), vines (one,
masked), shafts (one, additive), sky glow and stars (one, additive). Six containers.

4.7 **Backdrop:** pines outside both side walls on the plateau, none past the far wall; a valley of pines and ruined
towers below and beyond the far arch, clear of the centre line; the moon low in the arch.

4.8 **Camera:** unchanged: Crow Country's angle on a 24 mm lens (53.13° vertical), 25° down and 5 m back, turned freely;
the goal view 35° and 7 m. At 25° the frame's top edge is about 1.5° above the horizon, so the sky is a thin band; the
night is carried by light, fog and shafts.

4.9 **Wick:** the procedural figure (wick.toml: gold trim, glowing eyes) with the cloak in the sprite's lit blue (42,
not 41, which read as a dark blob), lit by the scene's lights, with the lantern and the rim light (§3.4).

4.10 **Budget (estimates until the GPU probe):** ≤ 24 point lights, ≤ 140 meshes, six particle containers, textures
32 px. SwiftShader: about four times the flat room (spike table). If the probe fails the phone budget, the low quality
tier drops the mushroom lights first (keeping their emissive caps and halos), then the shafts.

4.11 **Roll clip:** the Studio-made clip replaces `roll.toml`'s crouch placeholder; its markers must fall inside the
roll's 24 ticks (the view retimes the clip to `ROLL.ticks / TICK_HZ`).

## 5. Lifecycle and failure

- Boot: textures are painted once in `scene` (a few ms; measured into `base-3d:night` performance marks), then
  uploaded by Pixi. Nothing is fetched, so nothing new can fail to load.
- Per frame: `NightScene.update(seconds)` rewrites the motes and halos; no allocation per frame.
- Context loss and Try again: the renderer rebuilds the view and calls `scene` again; `buildNight` builds afresh and the
  old `NightScene` is disposed through the hook's `reset`.
- No bloom: additive cards stand in (spike limits table). A failure to create a light past the cap is impossible by
  construction (`dressingOf` is tested to stay ≤ 24).

## 6. UI inventory and responsive behaviour

No screen changes. The HUD, menus and touch controls are untouched; the phone sizes (844×390, 780×270) are checked in
the acceptance images for readability of the play area under the controls.

## 7. Test allocation and feedback

- Unit (node, TDD): `palette.test.ts` (tokens are the Endesga entries §2 names), `textures.test.ts` (each painter is
  deterministic: same bytes twice, size, only palette colours or transparent), `dressing.test.ts` (light count ≤ 24;
  every prop inside the room and out of the channels; clear of spawn, embers and goal; lava lights per pit; bays cover
  each side wall), `ember.test.ts` (an ember view holds a point light and an emissive core; the goal's sparks),
  `lantern.test.ts` (the wrapper adds a light and keeps the figure's update and destroy). render-pixi3d:
  `occluders.test.ts` gains the surface case (UVs scale with the slab; no surface, no change).
- Browser (the game's `browsers` project): the renderer builds the night scene without errors in Chromium, WebKit and
  Firefox (`views.test.ts` or a new `night.browser.test.ts`).
- Goldens: `src/game.test.ts` unchanged and passing; the route golden must equal #373's `c735b5acacbbc716`.
- Gates: `pnpm check`, base-3d's `test:parity` (three browsers), `pnpm build:examples`/`build:demos` as the lane
  rules ask, render-pixi3d `test:parity`, content's API report for the new subpath.
- Visual: the acceptance images (§8), opened and compared by a reviewer.

## 8. Exit criteria

Success:

- The acceptance images (start, a channel, an ember pickup, the goal, pause, phone 844×390 and 780×270), 2D and 3D
  side by side at the same size and moment, show every §2 row present in 3D.
- The route golden is unchanged; all gates above green; parity green on the Mac.
- The README states honestly where 3D still falls short.

Failure: a §2 row missing without a recorded reason; a golden move; a frame that reads as the old flat box; an
unexplained screenshot change.

Owner gates (never ticked by an agent): real-device look and feel; the GPU frame-budget probe (coordinator).

## 9. Alignment

Target-neutral: no host or Ruken contract is touched. render-pixi3d's no-eval rule holds (no `@pixi/3d/extras`).
PixiJS only (ADR 0002). Determinism: presentation only.
