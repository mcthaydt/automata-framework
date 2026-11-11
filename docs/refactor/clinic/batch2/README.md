# The clinic in level3d: batch 2 (2026-11-11), in progress

Branch `claude/clinic-2`, stacked on `claude/clinic-1` (draft PR 596). The Owner judges on the side-by-side frames
`<frame>-compare.png`: the source's baseline | AF WebGL | AF WebGPU (the source's baselines exist for the four play
spots only and show its HUD). `shots.json` holds the facts of the last run of `spikes/clinic/shoot.mjs`
(`ONLY=<stem>,… node spikes/clinic/shoot.mjs <dir>` shoots part of the set).

## Items

| # | Item | State |
|---|---|---|
| 1 | The framing | Done, and re-checked by eye (below): the camera matches the source on all four spots. The difference was the camera, not the lens: the hall zone's own `look` (0, 1.1, 0.75), `follow` 0.12 and `depthFollow` keep the shot off the player (she stands low in the frame), while batch 1's spike put the look on her. The frames now shoot the zone's own play shot, with the framework's 5% letterbox bars off (they cropped 76 px of every frame). Home heading: see below |
| 2 | The WebGPU play camera | Done. The camera did reach the view; every WebGPU frame after the first was rejected (below), so the canvas kept the first one |
| 3 | The frame artefacts | The black line at 77% and the blue band at the bottom went with the framing (the line was a near wall's top crossing the frame; the band, the sky past a cut wall). Blue still shows past the building where the other rooms are not hidden: item 4 |
| 4 | Room visibility on the clinic's zones, wall tops back | Waits for PR 588 (room-visibility), still an open draft |
| 5 | The 12 world-kit pieces | Done: the generators and presets (translucent parts, `veil`), and the dressing table that places 52 of them in the clinic (below) |
| 6 | Procedural props instead of the stand-in boxes | Not started |
| 7 | "On" frames | Waits for PRs 588 and 590 |

## Calls made

- **Home heading is `HOME_HEADING`, not a flipped geometry.** The Owner asked the rig's eye to stand south (+z) at the home
  heading, as the source's does (`presetOffset` z and `eyeOf`). Flipping those alone would put the stick's up toward the
  camera: `mapStick`'s forward is `(sin h, cos h)`, a sim function with a golden hash and a parity test, and the heading
  convention ("0 looks toward +z") is written in about fifteen places and in `base-3d` and `3d-story`. So `START.heading` is
  half a turn: a player's camera starts south looking north and stick-up is −z, with the sim's maths and the hashes of
  games that set `yawDeg` (`base-3d` does) unchanged. A literal flip is a separate change, for the Owner to ask for.
  A zone's `x` skew is authored for heading 0, so the clinic converter mirrors it about the look.
- **The WebGPU camera was not the camera.** `@pixi/3d` keeps one global bind group per view. A pass that samples a depth
  texture (every `PostEffect` does by default, used or not) leaves it bound in the opaque-depth slot; the next frame's
  opaque pass attaches the scene's depth writable under the same binding, and WebGPU rejects the whole command buffer
  (`Texture "sceneDepth" usage (TextureBinding|RenderAttachment) includes writable usage and another usage in the same
  synchronization scope`). 40 rejected buffers in 40 frames before, none after. It is the WebGL "Feedback loop" warning too.
  The fix is in `features/look/present-pass.ts`: the snap reads colour only, and a `PresentEffect` ends the look's passes
  whenever the haze or a pass after the snap runs, putting the engine's own empty depth back in the slot on WebGPU.
- **Shoots one browser a shot.** A closed WebGPU page took a shared browser's GPU process down in a long run.

## Item 5, part 2: the dressing (2026-11-11)

`spikes/clinic/dressing.ts` is the table: 52 places of the kit's pieces at the spots `dressClinic` puts its boxes and decals, read
as coordinates and sizes only. `convert.ts` appends them to the level's props and copies the 13 presets they name, and the 21
swatches those and their generators name, from `extensions/world-kit/library` into `clinic.library.json` as they are (a kit
swatch never replaces one of the clinic's own, like `chrome`). `scene.ts` imports `@automata/world-kit`, which registers the
generators. The test is `extensions/world-kit/tests/unit/clinic-dressing.test.ts`: the level builds with no problem, every
place draws, each preset is the kit's own, nothing pokes out of the building, and the wall pieces stand off their walls on the room's
side (north, east and west walls, the shaft from the ward's window to the floor).

| Family | Places | Source |
|---|---|---|
| Pipe runs | 14 on the walls, 2 curtain rails | `onWall` pipes and the tall upper wall's services |
| Moon shafts | 2 (ward window to the hall, corridor end across the leak) | `moonShaft` |
| Light pools | 4 (exit, corridor, ward, hall) | `lampSheens`; the opacity is the source's gain times each lamp's opening level, so the hall's and ward's are faint |
| Floor | the leak's puddle, 7 grime patches, 2 cables | `puddles` (the others are runtime state), grime and `cable` |
| Walls | the noticeboard and 4 notices, a drawing, a photo, 5 plaques (2 frames, 3 posters), the lit exit sign, the ward CRT, a loose ceiling tile | `onWall`, `plaque`, `tile` |
| Furnishing | the 2 ward curtains, the supply room's 3 shelving bays | `curtains`, `shelf*` |

Calls made:

- **The shaft's patch is axis-aligned**; the source's is turned 45° along the shaft. The kit's generator draws the foot square to
  the wall. The shaft and its patch still run from the same window to the same floor.
- **Curtains are drawn closed** by giving each panel half the width, where the kit's curtain is two folds drawn back.
- **Not placed** (not in the kit, or runtime state): the floor's tile grid (a texture, below), the worn paths, the floor papers,
  the supply door and the exit door's leaf and halo, the fuse box, the sink's mirror, the coat on the drip stand, the charred
  curtain decals, the wall-mounted lamps' bulbs, the fire and spark sprites, and puddles other than the leak's.
- **The frames current as of this item**: the four play frames and the three zone stills. The four turned frames are from before
  it; they come back with item C.
- **What shows that should not**: the dressing of rooms the camera is not in (the hall's north-east pipes and noticeboard in the
  supply and corridor frames). The source hides those rooms; room visibility does it here, item E.

## The framing, re-checked by eye (2026-11-11)

The Owner's coordinator read `play-hall-compare.png` and `play-ward-compare.png` as the source looking steeply down onto
tiles with thin side walls, and AF as level, seeing down the corridor. The numbers had been measured as matching, so the
pictures were registered instead: `<spot>-overlay.png` is the source's baseline, brightened ×2.5, at half opacity over AF's
WebGL frame (`shoot.mjs` writes it beside each compare). What lines up in all four:

- the reception desk's L-shaped top (hall, ward), far to the right and low in the frame;
- the corridor door's blue, high and central; two features this far apart settle both the offset and the scale;
- the player's stand-in on Ada (hall, corridor, supply; the ward's Ada stands behind the bench in the source, and her box
  sits on her);
- the left and right walls' lower edges and the line where the far wall meets the floor.

Worked check for the hall: the camera is 16.6 m from (0, 1.1, 0.75) back along 30° (eye at y 9.4, z 15.1); Ada's feet at
(0, 0, 3.2) are 8.3° below the look axis, 0.61 of the way to the bottom edge of a 27° frame, 80% down a 768 px frame, where
her feet are in the source (410 of 518 in the compare panel) and under AF's stand-in (405).

So the framing is not the difference, and no camera code changed. Three things read as a steeper, floor-filled picture in
the source, and as a level one in AF:

1. **The floor's tile grid.** The source's floor is a grout-lined tile texture; its perspective is what makes the floor
   read as the steep plane. AF's floor is a flat swatch, so the floor is a dark area with no lines to foreshorten.
2. **The walls' light.** AF's lamps bake saturated green and yellow onto flat walls, so the side walls and the corridor mouth
   are the brightest things in the frame; the source's are dim and even (item D).
3. **What the source puts in front of the far wall**: the notice board, the pipes, the curtains and the bench (items B and C),
   which break the far wall into small parts at the same scale as the floor's tiles.

## Not done here

Figures and their light (the FigureBuilder port) and bounce light (the EB look), as the brief says.
