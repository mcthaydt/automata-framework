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
| 4 | Room visibility on the clinic's zones, wall tops back | Done (`ba064276`): the scene draws room by room through `@automata/room-visibility`, and the wall tops are back (`cap: true`). One defect left, in the turned frames: wall-mounted pipes stay up when their wall is cut ("Item E", below) |
| 5 | The 12 world-kit pieces | Done: the generators and presets (translucent parts, `veil`), and the dressing table that places 52 of them in the clinic (below) |
| 6 | Procedural props instead of the stand-in boxes | Done: all 57 stand-ins are kit pieces at the source's box (below, and "Item 3") |
| 7 | "On" frames | Not shot. `scene.ts` takes `?fx=1` (retro grade, bloom, LCD panel), but the headless page never settles with them on: Playwright's screenshot times out at 120 s on the canvas and on the page, with or without the LCD, and stopping the ticker did not help. Cause not found ("Item E", below) |
| 8 | D: the wall lighting and the floor | Walls: the unfounded swatch lift is removed (see below). The floor is the kit's tile floor through a textured-swatch path in the spike. Re-shot: the four play frames and the three zone stills. Not re-shot: the four turned frames (stale since B). Left: the desk lamp's pool on the counter top is about 3 times the source's, the floor has no teal. The corridor and supply frames no longer show the hall's furniture (item 4). All eight play frames and the three zone stills are re-shot on both renderers (item E) |
| 9 | The editor ledger: can the level editor author the clinic? | Done: [../editor-gaps.md](../editor-gaps.md). Not yet |

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

## Item 6: the stand-in boxes become kit furniture (2026-11-11, WIP)

The world kit gains `fit` (`extensions/world-kit/src/features/props/fit.ts`): it builds any kit generator, turns it about y if
asked, and scales it axis by axis to a given box, standing on its base and centred on its origin. The converter uses it to put the
kit's own piece in the box the source's model filled (`with.size`, in the prop's own frame), so the room keeps its masses
and the shapes are the kit's: `spikes/clinic/furniture.ts` maps each source model to a kit preset, and a prop of the level is
`{ use: 'fit', with: { of: <kind>, with: <the preset's parameters, less its light>, size, turn } }`. A preset's own light is
dropped: the level's lamps already give the desk lamp's and the monitor's. Four new generators for the rolling equipment
(`gurney`, `wheelchair`, `ivStand`, `monitorCart`, in `medical.ts`) cover what the kit lacked.

| | Props |
|---|---|
| **Kit furniture, fitted (45)** | bed (turned so its head is north), gurney, wheelchair, IV stand, monitor cart, the three-seat bench, 2 filing cabinets, drawers, nightstand, office chair, overbed table, mop bucket, desk lamp, pendant lamp, 2 waste bins, key cabinet, 2 floor plants, desk plant, 2 book stacks, ledger, 2 radiators, water cooler, 24 stock pieces (crates, bottles, barrels) |
| **Still stand-in boxes (12)** | fallen chair (a chair on its side: an upright chair squashed to that box would not read), sink, trolley, clock, wall CRT (a deep box; the kit's screen is a slab), coat hook, wall sconce, junction box, privacy screen (turned 67°), extinguisher cabinet, 2 strip lights |

Tested: `tests/unit/props/fit.test.ts`, `tests/unit/props/medical.test.ts`, and `tests/unit/clinic-furniture.test.ts`, which holds
each fitted prop to its source box (±0.005 m), its spot and its height, and the 12 boxes to a named list.

State: the full gate has **not** run on this item (the world kit's unit tests, its typecheck and the core clinic test pass); the
frames current with it are the hall and the ward. Corridor, supply, the zone stills and the four turned frames are from item 5
or before. What reads wrongly now: the desk lamp's lamp lights the counter in saturated orange (item D), and a few things on
shelves float because their `at` height is the source's.

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

## Item D: the wall lighting and the floor (2026-11-11)

- **The swatch lift was a misreading.** Batch 1 read `mat(color, texture, 4.8)` in the source's `stage.ts` as a texture gain and lifted
  the floor, walls and ceiling four steps of their ramp. The third argument is the texture's repeat in metres. With it gone the walls are
  dim and even; the source's left wall measures 0.3 of its albedo, ours 0.6 (fill lamps and ambient: the next thing to tune).
- **The floor is the kit's `tileFloor` at step 3.** It is a textured swatch (a 30 cm glaze with a grout line), which the spike's `scene.ts`
  now draws through `albedoTiles` (`drawWorld`'s `tiles`). The kit's step 5 gave a frame mean of (42, 48, 44) against the source's
  (26, 32, 31); step 3 gives (34, 40, 35). The closet's dimmer `floorDim` is the same floor now.
- **`shoot.mjs` takes `EXTRA`** (a query string such as `&ambient=0.15`) and `scene.ts` takes `?off=<lamp ids>`, for bisecting a frame.

## Not done here

Figures and their light (the FigureBuilder port) and bounce light (the EB look), as the brief says.

## Item 3: the last 12 boxes (2026-11-11)

Every stand-in box is a kit piece now (`spikes/clinic/furniture.ts`). Six are presets the kit had: the trolley is the `monitor-cart`, the
wall TV the `screen.tv`, the wall sconce the `lamp.wall`, the junction box the `box.utility`, the clock the `plaque` and the fallen chair the
`chair.wood`. Five are new generators in `extensions/world-kit/src/features/props/ward-fittings.ts`, each facing +z on y = 0 at about the
source's box: the `sink` (a splash plate, a bowl, a tap and the waste pipe), the extinguisher cabinet (a red box with a glazed front), the
strip light (a steel housing with a lit tube; two of them), the coat hooks (a board, three brass hooks and a coat) and the privacy screen
(four zigzag panels on a rail; it stands turned 23° in the ward). Tested: `tests/unit/props/ward-fittings.test.ts` (parts, size, centred on
the origin, the strip's tube glows) and `clinic-furniture.test.ts` (0 stand-ins; each fitted prop in the source's box, the turned screen
inside its turned box).

- **The fallen chair stands.** `fit` turns a prop about y only; a chair on its side needs a turn about z. The `chair.wood` is fitted to the
  box the fallen one lay in, so it reads as a squat chair. A `tip` on `fit` would close it.
- **The wall TV is a slab, stretched.** The kit's `screen.tv` is thin; fitted to the source's 0.45 m deep box it is a deep block with the glow
  on its face, not a CRT's tapered back.
- **The clock is a lit plaque**, square.

## Item D, 2026-11-11 (later): the ambient and the view fog

Measured on the hall (region means, source | before | now): floor mid (33,44,44) | (32,30,31) | (41,39,40); floor right (22,28,29) | (4,5,5) |
(17,21,22); left wall (16,24,23) | (41,71,55) | (49,78,64); far wall (35,46,44) | (53,68,64) | (57,69,67).

- **The source's view fog starts before its focus.** Its `LOOK.haze` is linear from 5 m before the camera's focus to 7 m past it, colour
  0x4b5a56, so a floor about at the focus is already 40% veiled and its blacks sit at the veil's dim teal. AF's look starts the haze at the
  focus. A look's `near` cannot be negative (`look.schema.ts`: `near >= 0`), so the spike sets the focus 5 m nearer (`FOG_LEAD`) and the far
  to 12, and the level's `time.scene.haze` carries the source's colour at amount 0.5. At amount 1 the whole frame washed to grey-green
  (walls (61,96,78)); 0.5 keeps the contrast.
- **The ambient is the source's 0.15 again.** Batch 1 raised it to 0.25 beside a swatch lift that is gone (see above).
- **Still different: the desk lamp's pool on the counter top**, (178,161,124) against the source's (72,64,52). Checked and equal to the
  source: the falloff `(1 - d/range)^2 * 2.6 * level`, the lamp's range and level, the contact and wall occlusion (a port), the vertex density
  (the source also cuts the counter on a 0.35 m grid), `colorSpace: 'srgb'`. The left wall's rest is the fill and moon lamps. Not measured to
  a cause; the counter's top reads hot and orange.

## Item E: room visibility, wall tops, re-shoot (2026-11-11)

- **Room visibility** (`ba064276`). `scene.ts` draws through `drawByRoom` with the level's own `visibility` policy: each room's pieces go
  into a layer that room owns, a wall piece (its top too) into its cutaway group, and the zone's frame is `createRoomVisibility(...).update`
  and `hiddenWallGroups`. `?rooms=0` draws every room, for comparing. The corridor and supply frames show only their own room.
- **`drawByRoom` owns masses by the policy.** It drew every piece by the sector it was built in, and a mass is built in the sector its middle
  falls in, so a block the ward and the corridor share vanished when the corridor was seen alone. A mass's pieces (`<sector>:mass<N>:…`) now
  go in a layer owned by `policy.masses[N]`. Test: `extensions/room-visibility/tests/unit/room-visibility/draw-by-room.test.ts` (masses).
- **A prop's room is the room it stands in**, which the builder already gave every prop piece (`piece.sector`, by `roomAt`, the nearest corner
  when the place is in no sector). No new code; `clinic-rooms.test.ts` pins it (every prop's pieces in one room, the room of the sector its
  `at` is in, with the two pipe runs that start inside a wall's return named as off the plan) and that the hall's NE pipes are hidden in the
  corridor and supply zones. It is a guess from position, so the ledger lists it as a gap the format should own.
- **Wall tops are back** (`cap: true` in `convert.ts`; the level differs only in those flags). A top carries its wall's `line` and `cut`, so
  `wallGroupOfPiece` puts it in its wall's group (tested: every top has a group and a face of the same group). The play frames show no black bar.
- **The frames clear to black**, as the source does (`backgroundColor: 0x000000`); the night sky's mid-blue showed past the building. `?sky=0` brings it back.
- **Re-shot**: the eight play frames (four spots, plain and turned) and the three zone stills, WebGL and WebGPU, each stem in its own run.
  The facts are in `shots.json`: 468 pieces, 18 lamps, 0 builder problems, in every frame.
- **Defect left: a wall-mounted prop does not go with its wall.** In the turned hall frame the east wall is cut by the occluder rule (the
  camera is outside it) but its pipe run and riser stay up, a black pipe across the frame, and it stays with `?tops=0`, so it is not a wall
  top. A prop has no cut group and is not registered with the occluders. The fix is a `mount` on a prop (the wall it is on) that `drawWorld`
  registers with `occluders.face` on that wall's line; until then the turned frames have it. Not started: no time.
- **"On" frames: not shot** (item 7). `?fx=1` in `scene.ts` adds the retro pass, the LCD panel (both before the renderer is made) and the bloom
  (`GlowEffect`, between the snap and the panel), as `spikes/eb-look` does. The page never settles with them on: `canvas.screenshot` and
  `page.screenshot` both time out (60 to 120 s), with `?lcd=0` as well, and stopping the ticker before the capture did not change it. Nothing
  is in the page's errors. Next: bisect `?retro=0&lcd=0` (bloom alone) and try a WebGL context with software rendering off.
- **Item 5 (lamp brightness): not started.** The walls still read about twice the source's, and the counter's pool is still hot.

