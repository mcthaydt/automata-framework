# The reference look on @automata/3d: the baseline and the gap

Written 2026-11-10, phase 2 of the reference-look-to-Pixi work. Read-mostly: no core or extension code changed.
The reference scene builder (EB) was read at `main` `2757c11` (2026-11-10), its figure painter at `50235f4`; AF at `8dc6baa2`.

## Headline

AF draws EB's places: the same geometry, the same eight kits (`kits.json` is identical), the same 167 swatches as flat
DUEL colours, and the one DUEL snap with a Bayer dither. It does not light them as EB does. The baked room light
(`lighting`) is lamps plus ambient with no sun, no key, no fill and no steps, so the day exterior comes out nearly black,
and a figure under the pendant goes flat orange or red. Without the bake, the ramp material lights by the time of day and
reads, but that is Pixi's lit material, not EB's stepped light per vertex. Photo tiles, haze, the sky panorama and
horizon, interior windows, the coloured outline (selout), sprite-lit figures, exposure and most post passes are missing.
On WebGPU (headless SwiftShader), AF loses the device on the first frame in play, so there is no WebGPU picture yet.

## The screenshots

`baseline/<scene>-<view>.png`, one per scene and view, each in four panels at 2× nearest:

1. **EB CPU**: EB's own CPU renderer. **Not rendered in this session**: the session's permission classifier refused to
   run EB's code (`vite-node` on EB's `viewFrame`, "Code from External"), and EB commits no renders of its base scenes,
   only hashes. The panel is grey. With EB's 1× frames in a folder, `EB_DIR=<dir> node spikes/eb-look/shoot.mjs` fills
   it with no other change.
2. **AF WebGL, baked room light**: `createPixi3dRenderer` with the level's lamps as `lighting`, `look: DEFAULT_LOOK`, the
   level's `time`. This is how a game lights a level today.
3. **AF WebGL, material light only**: the same without `lighting`, so every piece keeps the ramp material and is lit by
   the time of day's hemisphere and sun.
4. **AF WebGPU, baked room light**: shows AF's "The picture stopped" panel (see WebGPU below).

| Scene | Diorama | First person |
|---|---|---|
| base-interior (`lampLit`) | `baseline/base-interior-diorama.png` | `baseline/base-interior-fp.png` |
| base-interior-dressed (`waitingRoom`) | `baseline/base-interior-dressed-diorama.png` | `baseline/base-interior-dressed-fp.png` |
| base-exterior (`day`) | `baseline/base-exterior-diorama.png` | `baseline/base-exterior-fp.png` |
| base-exterior-dressed (`street`) | `baseline/base-exterior-dressed-diorama.png` | `baseline/base-exterior-dressed-fp.png` |

`baseline/shots.json` holds what each panel drew (the renderer that ran, pieces, lamps, time, a lost device's reason and
the console's errors). The script is `spikes/eb-look/` (README there).

**Matching.** The cameras use EB's `views`. The diorama is orthographic, pitched 18° down with no yaw, at 96/2.6 × 2
texels a metre (EB's `PPM × density 2`), centred on `at`, at 512 × 320 (interior) or 640 × 360 (exterior). First person
is 320 × 200 at a 90° horizontal field of view (64° vertical), `eye` 1.6 m. The time is the level's (`lampLit`, `day`).
What differs:
- AF's letterbox insets the field inside the canvas, so a frame shows a little less than EB's.
- The figures stand with a plain gait and no stand pose: AF's base pair names the `loose` and `bounce` gaits and the
  `arms-crossed` and `hand-on-hip` stands, which only compiled content holds.
- The diorama draws the walls through AF's occluder rule, not EB's dollhouse cut.

**WebGPU.** Chromium here has WebGPU headless (SwiftShader adapter, `--enable-unsafe-webgpu`, on a localhost page).
AF's renderer takes it (`drew: webgpu`), and its device is lost on the first frame in play: `unknown: A valid external
Instance reference no longer exists.`, then AF's context-loss panel. Traced:
- The page asks for two devices at boot. Device #2 is lost as play starts, with no `GPUDevice.destroy()` call.
- AF's recovery asks for device #3 and never draws.
- It happens with the look, the figures and the baked light each left out (`?look=0`, `?cast=0`, `?light=0`). With the
  figures left out, the reason is `destroyed` instead.
- A bare WebGPU device on the same browser, beside a lost WebGL context, survives.

AF's only WebGPU browser test (`packages/3d/tests/browser/parity/shared/parity/renderer.test.ts`, "draws the same sky as
WebGL2") draws a background and no mesh, so a Pixi 3D scene on WebGPU has never been drawn in AF's tests. Not yet known
whether a real GPU does the same (WP0).

## Part by part

Each line: what EB does, what AF does today, and the screenshot that shows it.

### Stepped per-vertex light

- **EB** (`docs/lighting.md`, `paint/vertex-light.ts`). Light is a number on each vertex, made of four terms:
  - ambient, a small key on the normal, and a fill that fades with height;
  - contact AO from the map;
  - the sun, with a shadow map;
  - each lamp, with a cube shadow map, × `light.strength` 2.6.

  It is capped at `light.max` 1.6 and stepped by `stepLight` (0.1, keeping the hue), then interpolated (Gouraud).
  Meshes are cut until no edge is over 0.35 m, so a lamp's pool has vertices to land on. A sector's `shade` takes whole
  0.85 steps.
- **AF** (`shared/render/light/scene-light.ts`, `vertex-light.ts`, `occlusion.ts`, `app/world-view.ts`). With
  `lighting`, every static piece is baked into vertex colours on a `FlatMaterial`:
  - ambient plus each lamp's `(1 − d/range)² × strength`, with occluder boxes and planes and contact darkening;
  - no sun, key or fill, no stepping, no sector shade;
  - `subdivide` is ported (`features/world/subdivide.ts`) but `buildWorld` never calls it, so a 6 m floor is two
    triangles;
  - nothing derives occluder planes from a level, so lamps cast no shadows unless a game writes them by hand.
- **Shows it**: `base-exterior-diorama.png` panel 2 (day, no lamps, everything near black) beside panel 3.
  `base-interior-diorama.png` panel 2: the floor is black under the pendant, because the pool falls between the floor's
  few vertices.

### Ramp lighting

- **EB**. Scenery is not ramp-lit: a texel is `albedo × light × gain`, snapped once. The ramp is the figures' (sprite
  light, below), and a swatch is a ladder of 8 DUEL steps that its texture moves along.
- **AF** (`features/look/ramp-light-material.ts`, `ramp-light.ts`). Without a bake, every piece takes `RampMaterial`:
  - Pixi 3D's Blinn-Phong loop, with its summed light cut into `look.steps` (5) grey steps before it multiplies the
    albedo;
  - lit by the time of day's hemisphere and sun (`lightHemisphere`, `lightByTime`).

  It reads (panel 3), but it is per pixel, stepped in grey and not along a swatch's ladder, and it is not EB's model.
- **Shows it**: panel 3 of every frame, for example `base-exterior-dressed-diorama.png`.

### DUEL snap with Bayer dither

- **EB** (`paint/colour.ts`). One snap per texel to the nearest DUEL colour after a 4 × 4 Bayer offset of strength
  0.04. A glowing texel is hazed and snapped but never lit. Figures are snapped with no dither.
- **AF** (`features/look/duel-snap-filter.ts`). The same idea as a post effect over the whole frame (GLSL and WGSL): a
  4 × 4 Bayer at `dither.strength` 0.04, then the nearest DUEL colour. The figures are dithered too, because the pass
  runs after them.
- **Different**:
  - AF snaps the final pixel in sRGB after Pixi's lighting. EB snaps `albedo × light` once.
  - EB's GPU harness (cycle 8, `docs/gpu.md`) showed the painter's rules port to Pixi only with albedo as palette
    indices and integer snapping. AF draws albedo as a colour.
- **Shows it**: the dither pattern on every AF wall. The figures' dithered skin in `base-interior-fp.png`.

### Haze

- **EB**. A veil toward `haze.colour + haze.glow × light`, from `near` to `far` m (to `amount` 0.85). It is focused on
  the diorama's centre, and 3 m from the eye in first person. A time may set its own colour and amount. Below the
  horizon the panorama is the haze colour.
- **AF**. `time-of-day.schema.ts` carries a `haze` per time (day: `#8690b2`, 0.35), and nothing draws it. The renderer
  has Pixi's linear `fog`, which a level does not set.
- **Shows it**: every AF frame has hard, unveiled depth. `base-exterior-fp.png` panel 3: the far end of the street has
  no air.

### Outline and selout

- **EB** (`paint/paint.ts`). Switch `outline`, off in `look.json`. Where a nearer shape stands before a farther one or
  the sky, the far texel takes the near shape's own deep step, a step lighter on the key's side (selout).
- **AF** (`features/look/outline-filter.ts`). Switch `outline`, off. A depth-edge post effect that draws one colour
  (DUEL ramp 6, step 0). No selout.
- **Shows it**: off in both, so no frame shows it. The gap is the colour rule.

### Glow and interior windows

- **EB**:
  - A glowing texel (a bulb, a neon, a lit window) is drawn at its own step whatever the light.
  - Bloom puts stepped rings round glowing texels (`post.ts bloom`).
  - Switch `windows`: a window's glass shows the room behind it from the eye (first person), and lit windows at night.
- **AF**:
  - `buildWorld(…, { night })` marks a window grid's panes lit at night (`build.ts windowsOf`), drawn as a flat swatch.
  - world-kit's `glow` pass (`extensions/world-kit/src/features/sky/glow-effect.ts`) steps a glow out from the
    brightest pixels, in screen space, not from a glow mask.
  - No emissive term in the materials, and no interior behind glass.
- **Shows it**: `base-exterior-diorama.png` panel 3, flat blue panes. `base-interior-diorama.png`: the pendant's shade
  is lit as a surface; it does not glow.

### Photo tiles and placement

- **EB** (`docs/photos.md`, `photo/pipeline.ts`, `photo/textures.ts`, `world/surface.ts`):
  - A photo becomes a DUEL-indexed tile through flatten, facet, resample, index, wear and clean.
  - A swatch's `texture` places it on a surface in world metres. `TexPlace` sets the scale, offset and wall frame.
  - The albedo is the swatch's base step plus the tile's offset, plus grime.
- **AF**:
  - world-kit ports the pipeline as a Node command (`extensions/world-kit/src/features/textures/`), and 62 tiles
    (`library/tiles/*.tile.json`).
  - `buildWorld` carries each piece's `tex`.
  - `drawWorld` draws one flat colour per piece (`colourOf(tileName(piece.surface))`) and ignores `tex`.
- **Shows it**: every AF floor, wall and road is one flat colour, in all eight frames.

### The dresser and kits

- **EB** (`docs/dressing.md`, `world/dress.ts`). A sector's `dress: { as, seed }` furnishes it from a purpose kit:
  fixtures, then furniture on a floor plan, then clutter, with clearance rules.
- **AF** (`extensions/world-kit/src/features/furnish/`). Ported. `kits.json` is identical to EB's, and
  `dressedBaseScenes` dresses the two base scenes with seed 1. Whether the placements equal EB's for the same seed is
  unchecked here: it needs the EB column.
- **Shows it**: the `-dressed` frames, panels 2 and 3 (chairs, a sign and a noticeboard in the waiting room; a bench,
  a bin and a planter on the street).

### Sky

- **EB** (`paint/sky.ts`):
  - a panorama: the time's sky gradient, parallax horizon layers (`horizon: city`, lit windows at night) on the haze;
  - stars at night;
  - first person's sky follows the view ray.
- **AF**:
  - a flat `backgroundColor`; the spike gives it the time's middle sky stop;
  - the level's `sky.horizon` is parsed and not drawn;
  - world-kit's `stars` pass draws stars where the background shows.
- **Shows it**: `base-exterior-fp.png` panel 3: one flat cyan, no gradient, no city.

### Rain

- **EB** (`view/render.ts`, `paint/rain.ts`). A time's `rain`: streaks with splashes, `reflect` puts wet reflections
  on floors, `particles` adds drips.
- **AF**. world-kit's `rain` pass: screen-space streaks at a density, no splash or wet floor.
- **Shows it**: the base scenes' times have no rain, so no frame shows it.

### Post passes

- **EB** (`paint/post.ts`, `look.json switches`). Each has a switch: foliage, windows, sky, stars, rain, reflect, bloom
  (stepped rings), shafts (lamp cones with motes), grade (OKLab moods, snapped back to DUEL), particles (steam, drips,
  moths at night), bounce (off).
- **AF**:
  - core has the snap and the outline;
  - `look.grade: 'time'` tints colours by the time (`lightByTime`), with no mood pass;
  - world-kit adds stars, glow and rain;
  - missing: reflect, shafts, mood grade, particles and foliage sway in the look. Foliage sway is in the world's
    `sway`, not a pass.
- **Shows it**: nothing to see in the base frames. EB's interior at `lampLit` would show the pendant's bloom.

### Figures lit as sprites

- **EB** (`docs/lighting.md` "Figures"). The figure is painted by the figure painter, then lit as a sprite:
  - a flat light: ambient × 2.6 + each light at max(the mean N·L, floor 0.8), capped at `floorCap`;
  - the form: one ramp step either way where a texel faces the lights harder or softer than the mean;
  - a rim on the lights' side, and clean edges;
  - snapped with no dither;
  - the figure's cast shadow (0.6) on the floor.
- **AF**:
  - `features/look/sprite-light.ts` ports the rules as a pure function. It is exported and tested, and nothing calls it.
  - Figures are lit by `characterTint`: one flat tint from the ambient plus the lamps in range. Without a bake, they
    take the ramp material.
  - Figures cast no shadow.
- **Shows it**: `base-interior-fp.png` and `base-interior-dressed-fp.png` panel 2. The man is flat orange and the woman
  flat red, with no form or rim. In panel 3 they are Phong-lit, with no stepped form.

### Exposure

- **EB** (`view/expose.ts`, cycle 7, on). Each figure's flat light is scaled by n/top whole steps, so it is not hot
  against its ring (≤ 1.1×). This is measured on a trial composite, with a clamp that keeps the edge ≥ 1.1.
- **AF**. None. `extensions/world-kit/src/features/reads/` measures how a figure reads against its room, and does not
  feed the light.
- **Shows it**: `base-interior-fp.png` panel 2. The man reads hot and saturated against a near-black room.

## Proposed work packages, smallest first

| # | Work package | Size | Why first |
|---|---|---|---|
| WP0 | **WebGPU on a real GPU.** Run `spikes/eb-look/shoot.mjs` on the Owner's machine or the GPU runner. If the device is still lost on the first frame in play, find why (the traces above) and add a WebGPU mesh test beside the sky one. | S | The Owner needs both renderers; today AF has no WebGPU picture at all. |
| WP1 | **The EB column.** Run EB's renderer for the four base scenes (EB's `npm run render`, or an EB session sends the 8 PNGs), rerun `shoot.mjs` with `EB_DIR`, show the Owner. | XS | Without it the Owner judges AF alone. Blocked here by the permission classifier. |
| WP2 | **Sun, key and fill in the bake, and stepping.** Add EB's base term (ambient, key, height-faded fill, sun with its shadow) and `stepLight`, `light.max` and sector shade to `scene-light`/`vertex-light`. | S–M | The day exterior is black today, and every other part sits on the light. |
| WP3 | **Subdivide and derive occluders.** Call `subdivide(seg 0.35)` in `buildWorld`, and derive the occluder planes and boxes from the level's walls and props. | S | Lamp pools and shadows need vertices and casters. |
| WP4 | **Haze.** A veil pass from the time's `haze` and EB's profile, focused as EB's, reading depth. | S | One pass, large effect on depth. |
| WP5 | **Sprite-lit figures.** Wire `sprite-light.ts` into the figure view (lights at the chest from `SceneLight`), snapped without dither, and a cast shadow. | M | The rules are already ported and tested; only the wiring is missing. |
| WP6 | **Sky panorama and horizon.** The time's gradient and `sky.horizon` layers (parallax), drawn on the haze, behind the scene. | M | The exterior's biggest visible gap after light. |
| WP7 | **Albedo as palette indices.** Draw each piece's swatch ladder step (and later its tile's offset) as an index, light it, and snap once, as EB's cycle-8 harness proved (`docs/gpu.md`: integer snapping). | M–L | Makes the snap EB's (one snap of albedo × light) and is what tiles need. |
| WP8 | **Photo tiles.** Draw `tex` with the 62 tiles in world metres (`TexPlace`), on top of WP7. | M | Every surface is flat today. |
| WP9 | **Glow and windows.** An emissive mask for bulbs, neon and lit panes. Bloom as stepped rings from the mask. Interiors behind glass in first person. | M | — |
| WP10 | **Exposure.** EB's per-figure n/top trial, fed by world-kit's reads. | M | Only after WP5. |
| WP11 | **Selout, shafts, reflect, mood grade, particles.** EB's remaining passes, each behind its switch. | L | Polish; each is independent. |

WP2, WP3 and WP5 together would make panel 2 comparable to EB's frames. WP7 and WP8 make the surfaces EB's.
