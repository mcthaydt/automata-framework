# Spike: base-3d art (what the vendored `@pixi/3d` core can draw for the 3D Emberwick)

Date: 2026-11-01. Lane: 3D art (session_01QYLU1hrGL6WtJhKZasRs8Z). Code: `spikes/base-3d-art/` (TDD-exempt, not in
the workspace; it borrows `games/base-3d`'s dependencies through Vite aliases). Spec it feeds:
[`2026-11-01-base-3d-art-direction.md`](../superpowers/specs/2026-11-01-base-3d-art-direction.md).

## Method

`spikes/base-3d-art/src/main.ts` builds the free game's real room (its level file through the game's own converter,
`games/base-3d/src/content/room.ts`) on a bare `View3D`, with the game's camera (24 mm, 25° down, 5 m back; the goal
view 35° and 7 m), and dresses it the way the spec proposes. The page carries a `script-src 'self'` CSP, so anything
needing eval fails there. `capture.mjs` loads each query in headless Chromium on SwiftShader (844×390), screenshots it
and times 30 frames, each finished with a 1-pixel `readPixels`. `run.sh <out> <query...>` builds and captures.

Query flags switch each feature on its own (`?lights=N`, `?halos=0`, `?motes=0`, `?dress=0`, `?tex=0`, `?flat=1` for the
current look, `?moment=start|channel|ember|goal`).

## What works (all in `@pixi/3d` core, under the no-eval CSP, no console errors)

| Need | Core feature | Result |
|---|---|---|
| Real point lights | `PointLight` (`range`, `intensity`), tiled forward lighting, `MAX_LIGHTS = 32` | 21 lights lit Phong surfaces correctly: cyan pools at the mushrooms, orange on the channel walls, warm round the embers and the lantern |
| Emissive glow | `PhongMaterial({ emissive: { color, strength } })` | Mushroom caps, embers, the goal and the lantern read as light sources |
| Unlit bright surface | `FlatMaterial({ baseColorTexture, fog: false })` | Lava reads bright at any depth |
| Fog / depth tint | `view.fog = { type: 'linear', near, far, color }` | Far end of the room sinks into the night teal |
| Sky gradient | `view.background = { skyColor, groundColor }` (Hemisphere) | Navy above, teal below the horizon, behind everything |
| Dim moonlit fill | `view.environment` Hemisphere with `intensity` + one `DirectionalLight` | Replaces the flat even light |
| Additive glow cards (2D's halo layer) | `ParticleContainer3D({ blendMode: 'add', billboard: 'spherical' })` | One mesh for every halo; pulsing by rewriting particles each frame |
| Fireflies, sparks | Same container type, animated on the page clock | 38 motes, one mesh |
| Light shafts | `ParticleContainer3D` with a slanted soft band texture, `billboard: 'cylindrical'`, additive | Reads like Emberwick's shafts |
| Grass, vines | `ParticleContainer3D`, `alphaMode: 'mask'`, cylindrical billboards | ~200 tufts and 28 vines, two meshes |
| Backdrop silhouettes, moon | Crossed-quad `Geometry3D` with `FlatMaterial({ alphaMode: 'mask', fog: false })` | Pines and ruined towers stay crisp past the fog |
| Mossy stone | Canvas-painted 32 px Endesga textures (`Texture.from(canvas)`, nearest, `addressMode: 'repeat'`) on geometry with UVs in world metres | Flagstones and bricks at a fixed size on every face |

## Limits and fallbacks

| Limit | Evidence | Fallback taken |
|---|---|---|
| No bloom post filter: `BloomEffect` is in `@pixi/3d/extras`, which render-pixi3d's no-eval rule bans (its particle code probes `new Function` at load), and the package's export map refuses a deep import | `packages/render-pixi3d/src/no-eval.ts` header; `@pixi/3d` `package.json` `exports` | Additive glow cards round every light source, exactly how Emberwick fakes bloom (its `glowLayer`). An AF-owned bloom (GLSL + WGSL pair on core `PostEffect`/`FullscreenPass`) is a follow-up, not needed for parity with the 2D look |
| Materials have no blend mode; only particles blend additively | `BaseMaterial3D` options have no `blendMode`; `ParticleBlendMode` has `add` | Everything additive is a particle |
| Particle fog is fixed at construction by blend mode (`normal` fogs, `add` does not); `material.fog = false` afterwards has no effect | `ParticleMaterial.mjs`: `fog: options.fog ?? blendMode === 'normal'`; `ParticleContainer3D` does not pass `fog` | Backdrop silhouettes and the moon are meshes with `FlatMaterial({ fog: false })`, not particles |
| Particle quads are square | `setParticleAt(…, size, …)` | Shafts and vines draw inside a square texture |
| `@pixi/3d` extras' `ParticleSystem3D`, `ToonMaterial`, `SsaoEffect` unusable for the same reason as bloom | as above | Hand-driven `ParticleContainer3D` |
| `CylinderGeometry` takes `radiusTop`/`radiusBottom`; an unknown `radius` is ignored silently (defaults draw a 1 m disc) | first capture | Use the real option names |
| WebGPU not measured: headless Chromium here has no WebGPU and fell back to WebGL2 | `renderer=webgpu` row below | WGSL parity is the GPU runner's (the coordinator's); nothing in the plan adds a custom shader, so both backends use `@pixi/3d`'s own pairs |
| The camera looks 25–35° down, so very little sky is in frame (top edge about 1.5° above the horizon at the start view, 8.5° below it at the goal view) | camera maths in the spec §4.8 | The moon and silhouettes sit low, framed by the far arch; the night is carried by the light, fog and shafts rather than by sky area |

## Frame cost on SwiftShader (rough relative guide only; never a phone number)

844×390, WebGL2, start view unless named, mean of 30 frames. Runs vary by about ±15 ms; read the ratios, not the values.
"Meshes" counts `Mesh3D`s added, not GPU draw calls.

| Query | Lights | Meshes | ms/frame |
|---|---|---|---|
| `flat=1` (the current look) | 0 | 43 | 29.9 |
| everything on, start / channel / ember / goal | 21 | 130 | 127.0 / 137.0 / 122.8 / 119.6 |
| `lights=0` | 0 | 130 | 92.1 |
| `lights=8` | 8 | 130 | 101.3 |
| `halos=0` | 21 | 129 | 111.9 |
| `motes=0` | 21 | 129 | 119.7 |
| `dress=0` (no grass, vines, backdrop, mushrooms) | 11 | 65 | 88.1 |
| `tex=0` (flat colours) | 21 | 130 | 111.6 |
| `lights=0&halos=0&motes=0&dress=0` (textured ruin only) | 0 | 63 | 61.2 |
| `renderer=webgpu` (fell back to WebGL2) | 21 | 130 | 116.2 |

Reading: SwiftShader is fill-bound on the CPU. The dressed scene costs about four times the flat one here; the ruin's
extra wall bays and textures about +30 ms, 21 point lights about +30 ms, dressing (grass, vines, backdrop cards,
mushrooms) about +35 ms, halos and motes about +15 ms together. The spec's build budget (§4.10) keeps point lights at
or under 24 and the meshes the spike used, and the GPU runner's frame-budget probe decides whether the low quality tier
must drop the mushroom lights.

## Mockups

`docs/evidence/owner-visual/2026-11-01-base-3d-art-direction/mockup-{start,channel,ember,goal}.png`: Emberwick's
gameplay screenshot, #373's current 3D frame at the same camera (not for `ember`), and the spike's frame. Wick in the
spike is a stand-in (cone and hood); the game keeps its procedural figure.

## What we took from the 3D reference game (art pass lane 2, 2026-11-01)

The Owner: "The pixi 3D game looks amazing, so we can pull insights from that" and "We used the vertex coloring only
that helped dramatically". The reference game is the Owner's own `@pixi/3d` adventure (recorded in
`docs/provenance/sources.md`). We read its look profile, its mesh builder, its light and its framebuffer handling; no
code was copied. What we took, and why:

| Area | What the reference does | What base-3d does now, and why |
| --- | --- | --- |
| Surface colour | Surfaces are cut on a half-metre grid so light and colour can sit on vertices; textures are small, matte and posterised to one palette | Vertex colour only: every stone surface is cut into cells (0.25 m on tops and walls, 0.5 m down the sides) and each cell is one Endesga 64 entry (`views/stone.ts`, render-pixi3d `cellCube`). Smooth Gouraud blends read as blur against Emberwick's pixel art, so cells are flat (one colour each), which is the reference's posterised palette carried to geometry. The noisy 32 px tiled textures are gone |
| Light in steps | Light snaps to steps of 0.1 (an old engine's shade table), so pools read as bands | Colour steps along fixed palette ladders (stone 14 → 11, moss 38 → 35): a platform's edge one rung darker, the sides in bands. The lamps stay real-time point lights (the lantern and the embers move, and the bake takes static lamps only) |
| Ambient | A cool ambient and a low cool fill on upright surfaces keep walls legible between pools | The ambient sky is a saturated blue (41): under Emberwick's grey-blue (11) the 3D stone read grey; now it keeps the 2D frame's blue |
| The player's light | The player's carried flame lights her (a share of 0.4), and she must read against the ring around her by 1.1× in brightness or outline | Wick carries his lantern, a stronger cool rim over the hood (2.2) and a cool fill on his back, so his cloak reads in the sprite's blue from behind |
| Resolution | The framebuffer is capped at 640 × 480 and reaches the screen at whole device pixels | `maxInternalHeight: 360`: the view draws at most 360 px tall at resolution 1 and is nearest-upscaled, which also brings G3-x under its budget |
| Haze | Linear haze anchored past the camera's focus, so the far end sinks into a tinted colour, never black | Kept: the night's fog already runs from 9 to 30 m into the deep blue the ruin floats in |
| Glow | Bloom only over set thresholds (white 0.88, warm 0.45) | Not taken yet: AF has no bloom pass (GLSL and WGSL pair needed); additive halo cards stand in (follow-up) |
| Props and figures | Matte props, a saturation cap, figures with a dark outline | Matte stone (shininess 4); the figures' outline is not taken (procedural figures, a follow-up if Wick still blends in) |
| Overlays under no-eval | Post filters as hand-written GLSL programs | Not taken: AF's filters must be GLSL + WGSL pairs (ADR 0002) |

