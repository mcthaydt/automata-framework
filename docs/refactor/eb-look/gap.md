# EnvironmentBuilder's look on @automata/3d: the baseline and the gap

Written 2026-11-10, phase 2 of the EnvironmentBuilder-to-Pixi work. Read-mostly: no core or extension code changed.

**Sources:**
- EnvironmentBuilder (EB): `main` `2757c11`. Its frames were rendered by the EB coordinator with EB's CPU renderer
  (`npm run render`) and committed to EB's `claude/eb-base-renders` at `085b50b`, `docs/renders/base/`.
- FigureBuilder: `50235f4`.
- The Last Light (TLL): `mcthaydt/PixiJS3D_Experiment_001` `92e6704`.
- AF: `8dc6baa2`.

**Who owns what.** Figures, their sprite light and exposure belong to character-kit and the FigureBuilder workstream, not
to this phase. That covers `extensions/character-kit/src/features/painted/` and PR #577: painted at density 2, a fixed
18° pitch, whole pixels per texel, and a FigureSprite material that writes depth per texel. PR #577 touches three files in
`packages/3d`, so this phase's work packages stay out of them:
- `app/create-renderer.ts`;
- `shared/render/views/view-3d.ts`;
- `entries/testing-checks.ts`.

A spike (`claude/spike-live-mesh`) is testing a GPU painter on the live mesh. If the Owner picks it, it would touch
`packages/3d`'s render passes.

## Headline

AF already builds EB's places:
- the same geometry;
- the same eight kits (`kits.json` is identical);
- all 167 swatches, as flat DUEL colours;
- the one DUEL snap with a Bayer dither.

It does not look like EB. Side by side, EB's frames have:
- photo-textured, worn surfaces;
- teal haze;
- a glowing pendant;
- a cloud-and-city sky;
- sun shadows on the walls and floors;
- sprite-lit figures with warm highlights and rims.

AF's frames are flat colour. AF's baked room light (`lighting`) is lamps plus ambient, with no sun, key or fill and no
steps, so the day exterior and the lamp-lit floor come out nearly black. Without the bake, the ramp material lights by
the time of day and reads, but flat.

Three more findings:
- **WebGPU:** with Vulkan on SwiftShader the room draws on WebGPU; the figures do not yet, from an `@pixi/3d` bug (see WebGPU below).
- **Gameplay camera:** AF's default (24 mm, 25°, 5 m, free turn, no dead zone) is not The Last Light's (50 mm, 30°,
  zones at about 16 m, eight 45° steps, a dead zone, a push-in dolly only).
- **The dresser:** AF's dressed street has a bench that EB's has not, so the two dressers place differently with the
  same seed.

## The screenshots

`baseline/`, in two kinds of sheet. Every panel is drawn at 2× nearest.

**`<scene>-<view>.png`: EB's views.** One sheet per base scene and view, four panels:
1. **EB CPU**: EB's own frame.
2. **AF WebGL, baked room light**: `createPixi3dRenderer` with the level's lamps as `lighting`, `look: DEFAULT_LOOK`
   and the level's `time`. This is how a game lights a level today.
3. **AF WebGL, material light only**: the same without `lighting`, so every piece keeps the ramp material, lit by the
   time of day's hemisphere and sun.
4. **AF WebGPU, baked room light**: the room draws; the figures are missing (see WebGPU below). `wp0/` has the same set drawn after WP0.

**`<scene>-gameplay.png`: the gameplay cameras.** On WebGL, AF's default view (two panels: baked room light, then
material light only) beside TLL's play camera (the same two). Both frame the man from the south, at a 320 × 180 field.

| Scene | Diorama | First person | Gameplay cameras |
|---|---|---|---|
| base-interior (`lampLit`) | `baseline/base-interior-diorama.png` | `baseline/base-interior-fp.png` | `baseline/base-interior-gameplay.png` |
| base-interior-dressed (`waitingRoom`) | `baseline/base-interior-dressed-diorama.png` | `baseline/base-interior-dressed-fp.png` | `baseline/base-interior-dressed-gameplay.png` |
| base-exterior (`day`) | `baseline/base-exterior-diorama.png` | `baseline/base-exterior-fp.png` | `baseline/base-exterior-gameplay.png` |
| base-exterior-dressed (`street`) | `baseline/base-exterior-dressed-diorama.png` | `baseline/base-exterior-dressed-fp.png` | `baseline/base-exterior-dressed-gameplay.png` |

`baseline/shots.json` holds what each AF panel drew: the renderer that ran, pieces, lamps, the time, a lost device's
reason and the console's errors. The script is `spikes/eb-look/` (README there).

**Matching EB's views.** The cameras use EB's `views`:
- **Diorama:** orthographic, pitched 18° down with no yaw, at 96/2.6 × 2 texels a metre (EB's `PPM × density 2`),
  centred on `at`. The field is 512 × 320 (interior) or 640 × 360 (exterior).
- **First person:** 320 × 200 at a 90° horizontal field of view (64° vertical), eye 1.6 m.

The time is the level's (`lampLit`, `day`). What still differs:
- AF's letterbox insets the field inside the canvas, so an AF panel shows a little less than EB's.
- AF's figures are the base pair as `@automata/3d` draws them today, standing with a plain gait and no stand pose.
- The diorama draws the walls through AF's occluder rule, not EB's dollhouse cut.

**WebGPU.** *Corrected by WP0 (2026-11-10, [wp0/README.md](wp0/README.md)); the first reading, that AF loses the device, was wrong.*
Chromium here has WebGPU headless (SwiftShader adapter, `--enable-unsafe-webgpu`, on a localhost page). The device loss is
the browser's: a bare page with no Pixi and no AF that only configures and clears a WebGPU canvas loses its device on
frame 1, because the software adapter has no shared-image backing for a swap chain unless Chromium also runs Vulkan on
SwiftShader (`--enable-features=Vulkan --use-vulkan=swiftshader` fixes it; `shoot.mjs` has them). With that, AF draws on
WebGPU, and two things were found:
- **Fixed in AF.** Lit meshes drew black on WebGPU under no-eval: pixi's eval-free WGSL polyfill wrote `i32` uniforms
  (`@pixi/3d`'s light tile tables) through the float view. AF's shim now writes integers itself.
- **Open, in `@pixi/3d`.** A mesh added after a post effect has run makes every later WebGPU frame invalid (a `sceneDepth`
  usage conflict; the frame's commands are dropped). The figures are added after the first frame, so they are missing in
  the WebGPU panels (the room draws). Smallest reproduction, cause and the options: the README. Any mesh that spawns later
  on WebGPU with the look on is affected.

AF's only other WebGPU browser test ("draws the same sky as WebGL2") draws a background and no mesh; the new
`tests/browser/webgpu/mesh.test.ts` draws a crate, a model, a figure and the base interior.

## Part by part

What EB does, what AF does today, and the screenshot that shows it. Parts marked **(character-kit)** are the FigureBuilder
workstream's and are recorded here only for the comparison.

### Stepped per-vertex light

- **EB** (`docs/lighting.md`, `paint/vertex-light.ts`). Light is a number on each vertex. It sums:
  - ambient;
  - a small key on the normal;
  - a fill that fades with height;
  - contact AO from the map;
  - the sun, with a shadow map;
  - each lamp, with a cube shadow map, × `light.strength` 2.6.

  It is capped at `light.max` 1.6, stepped by `stepLight` (0.1, keeping the hue), and interpolated (Gouraud). Meshes are
  cut until no edge is longer than 0.35 m, so a lamp's pool has vertices. A sector's `shade` takes whole 0.85 steps.
- **AF**. With `lighting`, every static piece is baked into vertex colours on a `FlatMaterial` (`shared/render/light/
  scene-light.ts`, `vertex-light.ts`, `occlusion.ts`; `app/world-view.ts`):
  - It has ambient plus each lamp's `(1 − d/range)² × strength`, with occluder boxes and planes and contact darkening.
  - It has no sun, key or fill, no stepping and no sector shade.
  - `subdivide` is ported (`features/world/subdivide.ts`), but `buildWorld` never calls it, so a 6 m floor is two
    triangles.
  - Nothing derives occluder planes from a level, so lamps cast no shadows unless a game writes them by hand.
- **Shows it**:
  - `base-interior-diorama.png`: EB's pendant lights a pool on the tiled floor. AF's floor is black, because the pool
    falls between the floor's few vertices.
  - `base-exterior-diorama.png`: the day exterior is nearly black in panel 2 and grey in panel 3, against EB's sunlit
    pavement with figure shadows.

### Ramp lighting

- **EB**. Scenery is not ramp-lit: a texel is `albedo × light × gain`, snapped once. A swatch is a ladder of 8 DUEL steps
  that its texture moves along.
- **AF**. Without a bake, every piece takes `RampMaterial` (`features/look/ramp-light-material.ts`, `ramp-light.ts`).
  That is Pixi 3D's Blinn-Phong loop with its summed light cut into `look.steps` (5) grey steps, lit by the time of day's
  hemisphere and sun. It reads (panel 3), but it is lit per pixel, stepped in grey rather than along a swatch's ladder,
  and is not EB's model.
- **Shows it**: panel 3 of every sheet.

### DUEL snap with Bayer dither

- **EB** (`paint/colour.ts`). One snap per texel to the nearest DUEL colour, after a 4 × 4 Bayer offset of strength 0.04.
  A glowing texel is hazed and snapped but never lit.
- **AF** (`features/look/duel-snap-filter.ts`). The same as a post effect over the whole frame (GLSL and WGSL): a 4 × 4
  Bayer at `dither.strength` 0.04, then the nearest DUEL colour.
- **Different**:
  - AF snaps the final pixel after Pixi's lighting; EB snaps `albedo × light` once.
  - EB's GPU harness (cycle 8, `docs/gpu.md`) showed that the painter's rules port to Pixi only with albedo as palette
    indices and integer snapping.
- **Shows it**: the dither on every AF wall. EB's dither sits on textured surfaces; AF's sits on flat colour.

### Haze

- **EB**. A veil toward `haze.colour + haze.glow × light`, from `near` to `far` m (up to `amount` 0.85). It focuses on
  the diorama's centre, and 3 m from the eye in first person. A time may set its own haze.
- **AF**. `time-of-day.schema.ts` carries a `haze` for each time (day: `#8690b2`, 0.35), and nothing draws it. The
  renderer has Pixi's linear `fog`, which a level does not set.
- **Shows it**:
  - `base-interior-dressed-fp.png`: EB's room fades into teal toward the far door; AF's stays hard to the back wall.
  - `base-exterior-fp.png`: EB's street hazes into the city.

### Outline and selout

- **EB** (`paint/paint.ts`). Switch `outline`, off in `look.json`. Where a nearer shape stands before a farther one or
  the sky, the far texel takes the near shape's own deep step, a step lighter on the key's side (selout).
- **AF** (`features/look/outline-filter.ts`). Switch `outline`, off. A depth-edge post effect in one colour (DUEL ramp
  6, step 0), with no selout.
- **Shows it**: it is off in both, so no frame shows it. The gap is the colour rule.

### Glow and interior windows

- **EB**:
  - A glowing texel (a bulb, a neon, a lit window) is drawn at its own step whatever the light.
  - Bloom draws stepped rings round it.
  - The `windows` switch shows the room behind the glass in first person, and lit windows at night.
  - Glass by day carries painted reflections.
- **AF**:
  - `buildWorld(…, { night })` marks a window grid's panes as lit, drawn as a flat swatch.
  - world-kit's `glow` pass steps a glow out from the brightest pixels in screen space, not from a glow mask.
  - There is no emissive term and no interior behind the glass.
- **Shows it**:
  - `base-interior-fp.png`: EB's pendant bulb glows; AF's shade is lit as a surface.
  - `base-exterior-dressed-diorama.png`: EB's panes have reflection streaks; AF's are flat blue.

### Photo tiles and placement

- **EB** (`docs/photos.md`, `photo/pipeline.ts`, `photo/textures.ts`, `world/surface.ts`). A photo becomes a
  DUEL-indexed tile through flatten, facet, resample, index, wear and clean. A swatch's `texture` places it in world
  metres (`TexPlace`: scale, offset, wall frame). The albedo is the swatch's base step plus the tile's offset, plus grime.
- **AF**:
  - world-kit ports the pipeline as a Node command (`extensions/world-kit/src/features/textures/`), with 62 tiles
    (`library/tiles/*.tile.json`).
  - `buildWorld` carries each piece's `tex`.
  - `drawWorld` draws one flat colour a piece (`colourOf(tileName(piece.surface))`) and ignores `tex`.
- **Shows it**: every sheet. EB's walls, floors, road and ceiling are bricks, tiles, worn plaster and cracked tarmac;
  AF's are flat.

### The dresser and kits

- **EB** (`docs/dressing.md`, `world/dress.ts`). A sector's `dress: { as, seed }` furnishes it from a purpose kit:
  fixtures, then furniture on a floor plan, then clutter, with clearance rules.
- **AF** (`extensions/world-kit/src/features/furnish/`). Ported, and `kits.json` is identical. `dressedBaseScenes`
  dresses with seed 1.
- **Different**: with the same kit and seed, AF's street has a bench between the bin and the planter, and EB's has none.
  The two dressers diverge, whether from EB moving on since `6d82a52`, the seeded random, or the clearance rules.
- **Shows it**: `base-exterior-dressed-diorama.png`. The waiting room (`base-interior-dressed-*.png`) has the same sign,
  chairs and tables in both.

### Sky

- **EB** (`paint/sky.ts`):
  - a panorama: the time's sky gradient with clouds, and parallax horizon layers (`horizon: city`, lit windows at night),
    on the haze;
  - stars at night;
  - in first person, the sky follows the view ray.
- **AF**:
  - a flat `backgroundColor` (the spike gives it the time's middle sky stop);
  - the level's `sky.horizon` is parsed and not drawn;
  - world-kit's `stars` pass draws stars where the background shows.
- **Shows it**: `base-exterior-fp.png`. EB has clouds over a city skyline; AF has one flat cyan.

### Rain

- **EB** (`view/render.ts`, `paint/rain.ts`). A time's `rain`: streaks with splashes, wet reflections on the floors
  (`reflect`) and drips (`particles`).
- **AF**. world-kit's `rain` pass: screen-space streaks at a density, with no splash or wet floor.
- **Shows it**: the base scenes' times have no rain, so no sheet shows it.

### Post passes

- **EB** (`paint/post.ts`, the `switches` in `look.json`): foliage, windows, sky, stars, rain, reflect, bloom (stepped
  rings), shafts (lamp cones with motes), grade (OKLab moods snapped back to DUEL), particles (steam, drips, moths) and
  bounce (off).
- **AF**:
  - core has the snap and the outline;
  - `look.grade: 'time'` tints colours by the time (`lightByTime`), with no mood pass;
  - world-kit adds stars, glow and rain;
  - reflect, shafts, mood grade and particles are missing.
- **Shows it**: `base-interior-diorama.png`. EB's room has a green mood and the pendant's bloom; AF's has neither.

### Figures lit as sprites (character-kit)

- **EB** (`docs/lighting.md`, "Figures"). FigureBuilder paints the figure, then it is lit as a sprite:
  - a flat light (ambient × 2.6 + each light at max(the mean N·L, 0.8), capped);
  - a form step either way;
  - a rim on the lights' side;
  - clean edges;
  - snapped with no dither;
  - a cast shadow (0.6) on the floor.
- **AF**:
  - `features/look/sprite-light.ts` ports the rules as a pure function, tested, that nothing calls;
  - figures take `characterTint`, one flat tint, or the ramp material without a bake;
  - no cast shadow.

  The painted figure, its sprite material and its light are character-kit's (PR #577 and after).
- **Shows it**:
  - `base-interior-dressed-fp.png`: EB's figures have hair, faces, warm highlights and rims. AF's are flat orange and
    red (panel 2) or Phong grey (panel 3).
  - `base-exterior-dressed-diorama.png`: EB's figures cast sun shadows.

### Exposure (character-kit)

- **EB** (`view/expose.ts`, cycle 7, on). Each figure's flat light is scaled by n/top whole steps, so the figure is not
  hot against its ring (≤ 1.1×). It is measured on a trial composite, with a clamp that keeps the edge ≥ 1.1.
- **AF**. None. `extensions/world-kit/src/features/reads/` measures how a figure reads, and does not feed the light.
- **Shows it**: `base-interior-fp.png`. AF's figures read hot against a near-black room.

### The gameplay camera (the Owner, 2026-11-10: AF's default should match The Last Light's)

TLL's rules are in `docs/design/camera-rules.md` and `AGENTS.md` "Locked decisions", and in its code:
`src/render/stage.ts`, `room-camera.ts`, `play-framing.ts` and `camera-rig.ts`.

AF's default camera is `features/camera/angled-camera.ts`, `camera-pose.ts`, `fov.ts`,
`sim/camera-view.schema.ts`, `sim/view-latch.ts` and `sim/heading.ts`.

| Rule | TLL | AF today |
|---|---|---|
| Lens | 50 mm (27° vertical), locked | 24 mm (53° vertical), `LENS_MM`, "the Owner's lens (2026-10-23)", in every view |
| Home tilt | 30°; a zone may author 25°–40° | 25° default; a view may author 15°–60° |
| Distance | a zone's authored distance (prologue zones 15–16.6 m) | 5 m default; a view may author 3–12 m, so 16 m is refused |
| Follow | `follow: 1` locks on with a 0.3 m dead zone (0.2 m portrait); `follow < 1` is a bounded room follow (dead zone, partial follow, pan limits of a quarter of the room, at most 2 m); eased with `−expm1(−7 dt)` | a klipp `OrbitFollowBody` with `lag` 0.18 s, the focus clamped into the view's `bounds`; no dead zone |
| Fixed shots | a zone may hold a fixed authored angle | a view's `rotate: false` and `yawDeg` hold the angle; the focus still follows |
| Turning | eight 45° steps (Q/R, LB/RB), octant input | `camera-turn` by drag, stick or held keys, up to 45° a tick, any angle; the heading is continuous |
| Automatic framing | dolly only, along its own offset: 0.75–1× the zone's distance, at most 0.25× a second, lens unchanged, held under reduced motion | none as a dolly; the lock-on leans the focus up to 35% toward a target (`LOCK_SHARE`), a translation |
| Automatic yaw, pitch, roll | none, except entering a zone with its own angle | none, except entering a view with `yawDeg` (eased 0.25 s) |
| Peek | an offset of at most 1.2 m along the floor, no rotation | none |
| Portrait | pulls back up to 1.75×, with earlier and stronger follow | none of its own; `aspect` only frames the lock |

- **Shows it**: `<scene>-gameplay.png`. AF's 24 mm at 5 m is a wide, close room with converging walls. TLL's 50 mm at
  16 m is a flatter, smaller dollhouse with whole walls in frame. TLL's distances suit its larger rooms, and in the 6 × 5 m
  base room they leave a small picture in AF's 180-pixel field.

## Proposed work packages, smallest first

None touches PR #577's files (`app/create-renderer.ts`, `shared/render/views/view-3d.ts`, `entries/testing-checks.ts`),
or character-kit. The figure items (sprite light, exposure, cast shadow) are left to the FigureBuilder workstream.

| # | Work package | Size | Where | Why |
|---|---|---|---|---|
| WP0 | **The gameplay camera, TLL's.** Lens 50 mm; tilt 30° (zone range 25°–40°); distances to TLL's range; a follow with TLL's dead zone and bounded room follow; Q/R turning in eight 45° steps (octant input in the sim); a push-in dolly (0.75–1×, 0.25×/s, held under reduced motion); a peek of at most 1.2 m; no automatic yaw or pitch. Then the base views and the 3D editor's Walk move with it. | M | `features/camera/` (`fov.ts`, `camera-view.schema.ts`, `angled-camera.ts`, `camera-pose.ts`, `sim/heading.ts`, `sim/view-latch.ts`) | The Owner's decision; the lens and the steps change what the sim stores (headings in octants), so it goes before more look work is judged in play. |
| WP1 | **WebGPU on a real GPU.** Run `spikes/eb-look/shoot.mjs` on the Owner's machine or the GPU runner. If the device is still lost on the first frame in play, find why (traces above) and add a WebGPU mesh test beside the sky one. | S | tests, then wherever the cause is | The Owner needs both renderers, and today there is no WebGPU picture at all. |
| WP2 | **Sun, key and fill in the bake, and stepping.** EB's base term (ambient, key, fill faded by height, the sun with its shadow), `stepLight`, `light.max` and sector shade. | S–M | `shared/render/light/` | The day exterior is black today, and every other part sits on the light. |
| WP3 | **Subdivide and derive occluders.** Call `subdivide` (0.35 m) in `buildWorld`; derive occluder planes and boxes from the level's walls and props. | S | `features/world/build.ts`, a new derivation beside it | Lamp pools and sun shadows need the vertices and the casters. |
| WP4 | **Haze.** A veil pass from the time's `haze` and EB's profile, focused as EB's, reading depth. | S | `features/look/` (a pass beside the snap) | One pass with a large effect on depth. |
| WP5 | **Sky panorama and horizon.** The time's gradient and clouds, the `sky.horizon` layers (parallax), drawn on the haze behind the scene. | M | `features/look/` or world-kit's sky | The exterior's biggest visible gap after light and tiles. |
| WP6 | **Albedo as palette indices.** Draw each piece's swatch ladder step (and later its tile's offset) as an index, light it, and snap once, as EB's cycle-8 harness proved (`docs/gpu.md`). | M–L | `app/world-view.ts`, `features/look/` | Makes the snap EB's, and is what tiles need. Coordinate with `claude/spike-live-mesh` first: if the Owner picks the live-mesh painter, this is its work. |
| WP7 | **Photo tiles.** Draw `tex` with the 62 tiles in world metres (`TexPlace`), on top of WP6. | M | `app/world-view.ts`, world-kit's tiles | Every surface is flat today. |
| WP8 | **The dresser's placements.** Find why AF's street gets a bench EB's does not, and match EB at its current `main`. | S | `extensions/world-kit/src/features/furnish/` | A dressed scene should be EB's scene. |
| WP9 | **Glow and windows.** An emissive mask for bulbs, neon and lit panes; bloom as stepped rings from the mask; glass reflections by day; interiors behind the glass in first person. | M | `features/look/`, world-kit's sky passes | — |
| WP10 | **Selout, shafts, reflect, mood grade, particles.** EB's remaining passes, each behind its switch. | L | `features/look/`, world-kit | Polish; each is independent. |

Left to character-kit (the FigureBuilder workstream): figures lit as sprites (wiring `sprite-light.ts` or its own), the
cast shadow, and exposure.

WP2 and WP3 make panel 2 light like EB's. WP4 to WP7 make the surfaces and the air EB's.
