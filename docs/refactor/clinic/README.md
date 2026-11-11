# The clinic in level3d: batch 1 (2026-11-11)

The Owner's direction: recreate the source game's clinic in AF's 3D level from data ("it just needs to look nearly
identical"). The design is in the spec (`docs/superpowers/specs/2026-11-10-clinic-in-level3d-design.md`) and the
gap analysis (`docs/superpowers/2026-11-10-clinic-in-level3d-gap-analysis.md`), both on draft PR 575's branch
`claude/clinic-level3d`. This is batch 1, done in one session with no separate plan or audit stages. Batch 2 adds the
world-kit pieces the clinic's dressing needs.

## What batch 1 is

| Part | Where | Test |
|---|---|---|
| Lamp kinds `screen`, `fire`, `spark`, `moon` and `fill`; a lamp's `radius`; a level's `bounce` points. Lamp levels come from `PieceStates.lamps` | `packages/3d/src/features/world/library/lamp-kit.json`, `lamp-kit.ts`, `af-sector-2.schema.ts` | `tests/unit/world/lamp-kit.test.ts` |
| The builder draws trim in bands (skirting, wainscot, rail, capital, each with its own `trimDepth` and `trimTexture`, on walls and on a portal's step), a wall's top (`cap`), masses, handrails, pilasters and a moon window's glass. A wall's `cut` group rides on every piece of it | `features/world/structure.ts`, `build.ts` | `tests/unit/world/structure.test.ts` |
| A `model` (GLB) prop: a stand-in box that names the file, fitted by the world view to the loaded model | `features/world/props/model-prop.ts`, `shared/render/model/fit-model.ts`, `app/world-view.ts` (`scene.models`) | `tests/unit/world/model-prop.test.ts`, `tests/unit/shared/render/model/fit-model.test.ts`, `tests/unit/app/world-view.test.ts` |
| The clinic as an `af-sector/2` level, by a converter that reads the source's data files in place and writes only AF data | `spikes/clinic/convert.ts`, `spikes/clinic/content/` | `tests/unit/world/clinic-level.test.ts` |
| The 11 frames, on WebGL and WebGPU | `spikes/clinic/shoot.mjs`, `batch1/` | |

## Calls made

- **No model file, texture or image is copied** from the source (the Owner, 2026-11-11). The level's 57 props name
  `models/<name>.glb`; with no model loaded each draws as its fitted box in a flat swatch. Whether and how the models come
  in is for batch 2 and the Owner.
- **A trim that names a wainscot or a capital is drawn in bands**, where `rail` is the band's thickness (the source's
  meaning); a trim with neither keeps AF's old skirting and a rail at a height. No existing level changed.
- **A wall's top is drawn only when its trim says `cap: true`**, with no stub. The clinic's walls say `cap: false`: the
  builder's tops don't cut away with their walls yet, and the near walls' tops crossed the play camera's frame as two black
  lines. The tops come back with room visibility.
- **`pendant`'s range band is 3.5 to 6 m in AF's kit and 5.5 to 9 m in the source**, so the hall lamp (7.5 m) is held to
  6. Left as it is; widening the band would move the default range of every unranged pendant.
- **The effects are not on**: the LCD panel, the crisp and retro filters and the bloom are EnvironmentBuilder's and had not
  merged (PRs 588 and 589) when this ran, so every frame is "off" (`DEFAULT_LOOK`). "On" frames wait for them.
- **The camera is set in the scene hook**, not by the sim-driven rig (`?rig=1` brings the rig back). On WebGPU the rig never
  reached the play view in this scene: the camera stayed at its start pose, inside the room at floor height. WebGL follows
  the player as expected. The spike sets the same camera on both (50 mm, 30° down, the zone's distance, the look point at
  the zone's `look` or 1.1 m for a play frame, turned 45° for the turned frames), the way `eb-look` sets its gameplay
  camera. The cause is in `createPixi3dRenderer`'s camera path, which this work does not touch; it needs its owner.
- **The room light is the source's**: a cool teal-grey ambient (0.25 here, the source's 0.15) and a low cool fill. Batch 1 lifted
  the floor, walls and ceiling four steps of their ramp, reading `mat(color, texture, 4.8)` as a texture gain; it is the
  texture's repeat in metres, so the lift was removed in batch 2 (it made the walls neon under the lamps).
- **Ada is a 1.62 m box** at the baseline spots; her figure is batch 2.
- **The supply door and the pieces of `dressClinic`** (curtains, pipes, the exit door and its sign, the CRT, puddles, moon
  shafts, light pools, grime) are batch 2's world-kit pieces. The frames are rough until then.
- **The zone stills** put the play camera at the zone's look point and distance; a zone's own `x` (the closet's 2.2) and
  follow are stored in the level's `views` and not read by anything yet.
- **The room-visibility policy** is stored in the level as `visibility`, as the source wrote it, for the extension that
  will read it.

## The frames

What the 22 AF frames show (looked at, 2026-11-11): the same place as the source's baselines: the hall with the reception
desk on the right and the ward on the left, the corridor mouth and the exit lamp at the far end, the desk lamp's and the
hall lamp's pools on the floor, the cool teal wash on the walls. WebGL and WebGPU agree (same camera, same pieces, 226 pieces,
15 lamps, 0 builder problems in every frame). What is not there yet, and is batch 2's: every prop is a grey box (no models,
the Owner's rule), none of `dressClinic`'s pieces (curtains, pipes, CRT, moon shafts, floor tiles' grout and grime, notices),
no Ada (a box), the light is flatter and the walls darker than the source's, and the blue is the sky colour where a near wall is cut away
(room visibility's job). The source's baselines show its HUD and a minimap, so they are for the eye, not a diff.

`batch1/<frame>-compare.png` is the source's baseline | AF WebGL | AF WebGPU, side by side. The source's baselines
exist for the four play spots only (and show its HUD); the zone stills and the turned frames have no baseline until
the reference is re-shot (the spec's section 4.3), so those are AF alone. `shots.json` holds each frame's measured
facts: the renderer, piece and lamp counts, and any problems the builder reported.

Reproduce: `ln -sfn ../../examples/3d/node_modules spikes/clinic/node_modules`, then
`REFERENCE=<source checkout>/docs/verification/baselines/clinic node spikes/clinic/shoot.mjs`.
To regenerate the level: `node spikes/clinic/convert.ts <source checkout at 92e6704>`.
