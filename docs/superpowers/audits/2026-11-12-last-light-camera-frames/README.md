# The Last Light, camera session: a free horizontal camera at the near scale

Chromium on software GL (`AF_WEBGPU=software`), 1024 by 768 game frames (field 512 by 384 at 2x), by `tests/e2e/play-shots.test.ts`.
WebKit, Firefox and a real GPU did not run.

## Item 1: the Owner's camera control

The Owner, 2026-11-12: "Also cut the Q and E, let it be rotate horizontally with right stick, screen swipe, and mouse like normal 3D, but lock vertical rotation".

- **The yaw is sim state.** Ada walks relative to the camera (`moveDirection` maps the stick through the heading), so the heading must be in the
  sim for the same inputs to give the same hash. It enters as a new command, `camera-yaw { units }`, in its own opt-in plugin
  (`cameraYawPlugin`, `@automata/3d/sim`): the heading turns by the units themselves (65,536 a turn), at most 45 degrees a tick, wrapped;
  `rotate: false` views ignore it. It is a separate plugin because the sim's schema hash names every registered command: a first try that put
  it in `camera-heading` moved base-3d's recorded golden hash, so it was moved out, and no other game's hash moves. `camera-turn` (the eight
  45-degree steps) is unchanged. Determinism tests: `packages/3d/tests/unit/camera/sim/camera-yaw.system.test.ts` and the game's
  `tests/unit/features/ada/camera-yaw.test.ts` (same turns and pushes, same hash; the stick walks her away from the turned camera).
- **Smooth, not stepped.** The right stick at full push turns 150 degrees a second (455 units a tick at 60 Hz), in proportion below it; a drag
  turns per pixel by the player's existing "Camera turn speed" (default 0.25 degrees a pixel) and "Invert" rows, which now also tune the stick.
  No quantising: the figure is drawn whole-pixel at any yaw (the painter rasterises its own cell; only her bearing is snapped to 8 directions).
- **Directions do not flicker.** The painter snaps her bearing from the camera to the nearest 8th with no memory. A hold in the kit's painted
  view (`facing-hold.ts`) keeps the direction drawn until the bearing is 7.5 degrees past the boundary.
- **Vertical locked.** Only the right stick's x is read; nothing reaches the tilt, which stays the view's.
- **Mouse: drag, not pointer lock.** Pointer lock asks permission or is refused inside some hosts' iframes; a drag works on web, itch and
  Ruken alike. The game asks the framework for either button (`mouseDrag: 'either'`, opt-in; the default stays the secondary button) since its
  scene takes no click: everything Ada can use is a HUD button above the drag surface, so a turn never steals a tap.
- **Touch:** a swipe anywhere off the controls (the move stick's zone and every button are above the drag surface, unchanged).
- **Directions:** a drag grabs the room (dragged right, the room turns right with the finger or the mouse, as a 3D view in a browser does); the
  right stick looks the way it is pushed (right looks right), as a pad's camera stick does.
- Q and E removed; no prompt, help line, translation or settings row named them (checked: only code comments did).

Frames: `item1-yaw-0-spawn.png` (the spawn, as before); `item1-yaw-after-400px-right-drag.png` (a left-button drag of 400 px, about 100
degrees: the room turned and she is drawn side-on); `item1-yaw-after-600px-left-drag.png` (then 600 px back: she is drawn from behind, three-quarter).
Journey: `tests/e2e/camera.test.ts` turns it by a mouse drag (both buttons), a finger's swipe (CDP touch events) and a pad's right stick
(a stand-in `navigator.getGamepads`), and proves Q and E turn nothing and the stick's y turns nothing.

## Item 2: the rooms under a turning camera at the near scale (partly done)

**The derivation** (`@automata/3d/camera-view`: `spriteBoxAt`, `reachOf`, `fitFocus`, `bestLookHeight`, generic, pure). Her sprite is the
cell's 124 rows plus 4 of head room at 2 field pixels a texel: 256 field pixels of a 384-line field (4:3) or a 360-line field (16:9), half
width 48. With 8 pixels kept clear, the look may stand at most **0.52 m** (hall) / **0.52 m** (corridor, closet) from her feet, in any
direction at any heading (the `reach`; 72 headings by 72 directions, bisected to a centimetre). That is the near scale's price: a camera the
player turns cannot be held back at a room's edge at all. The follow's dead zone (0.3 m) and the larger of its lag (at 3 m/s) and the lead
share what is left, so the derived views are:

| view | look height | focus box (the walkable floor) | lead | lag |
| --- | --- | --- | --- | --- |
| hall | 1.10 to **1.05** m | x -5.02..4.67, z -3.60..6.67 (was -3..3, -0.4..6.4) | 1.5 to **0.22** m | 1/7 to **0.07** s |
| corridor | 0.60 to **1.10** m | x -1.27..1.52, z -6.67..-1.08 (was the line x 0, z -4.6..-2.4) | 1.5 to **0.21** m | 1/7 to **0.07** s |
| closet | 0.60 to **1.10** m | x 1.93..4.27, z -6.17..-2.83 (was one point) | none | 1/7 to **0.07** s |

At the old look height of 0.6 m (corridor, closet) her head cannot fit at all with 8 pixels clear (reach 0): that, not the box, is why her head
left the top. `tests/unit/app/room-fit.test.ts` pins the level's numbers to the derivation and sweeps the real follow rule (`zoneShot`) at every
15 degrees of heading, at the walkable floor's corners, middle and doorways, walking 8 ways with the lead ahead and the lag behind, with the dead
zone holding the look from 8 sides, in both fields: her whole sprite stays inside. It failed against the old level in all three rooms.

**In play (looked at every frame):** turned 75 degrees, the hall's north end (`item2-hall-north-yaw-75.png`) and the corridor's north end
(`item2-corridor-north-yaw-minus75.png`) show her whole with head room. **Open defect, not fixed:** looking straight north through the mouth
(`item2-hall-north-yaw0-OCCLUDED-by-bulkhead.png`, `item2-corridor-north-yaw0-OCCLUDED.png`) a flat wall fills the frame and she is not
seen at all. The corridor's ceiling is 3.2 m and the hall's 4.9 m, so there is a 1.7 m bulkhead face over the mouth (z -1.4, `cut: "bulkhead"`);
the eye stands about 5.2 m up, and every line from it to her through the mouth passes through that face, which the occluder pass does not cut.
It is the same black slab that covered her in session 16's defect frame (the "head off the top"). Next: make the occluder pass cut a portal's
upper face (the bulkhead) when it crosses the eye-to-head line, test first, from all sides. `item2-hall-key-cabinet-NOT-the-closet.png` is named
for what it is: the walk to the closet went wrong after the camera turns (the keys walk relative to the camera), so **the closet was not shot**,
nor the hall's south, east and west walls at several yaws.

## Session 2, item (a): she vanished behind the bulkhead (fixed)

Shots are placed in room coordinates now: `play-shots.test.ts` takes `name:walk:x,z` (the probe's nav walk, as a tap's) and `name:face:deg`
(the probe sends `camera-yaw` until the sim's heading is there; 0 looks toward +z, so 0 frames her from the north, 180 from the south). The
old "yaw 0" frames were taken after drags; the defect is at heading 180 (looking north), reproduced here by coordinates.

**Cause, measured in Node on the real pieces** (a line from the eye to her head, triangle by triangle): the bulkhead `mouth:upper:0.0.0` was
built with no `line`, so `drawWorld` never gave it to the occluder rule. Not only it: the builder gave no line to any face built off a wall
but the wall itself (bulkheads `upper`, steps `lower`, a doorway's frame, dados, skirtings, rails, cornices), hung nothing in a window (panes,
bars) or a wall's decor on its wall, and `drawWorld` registered no prop that was not hung on a wall (121 prop parts here, the corridor's
ceiling-hung strip lights among them: one stood across her waist from the north).

**Fix, generic (`@automata/3d`):** every face built off a wall or a portal gets that line and the wall's `occlude`; panes, bars and decor
hang `onWall`; a wall span has a `base` (a bulkhead 3.2 to 4.9 m is cut when the line crosses it, kept when the line passes under it through
the opening); `drawWorld` registers every free prop (and a free model, by its blockout's bounds); the pass draws its lines to five heights up
the figure (feet, knee, waist, chest, head) and, given the sprite's half width (`camera.width`, opt-in; The Last Light gives 24 of 124 rows of
her height, 0.31 m), to both sides of it; a prop whose top reaches above 1 m fades by default (it was "taller than 1.5 m": the ward's filing
cabinet, 1.32 m, covered her chest from above, and a strip light 0.1 m tall hanging at 3.1 m never faded). Tests first:
`packages/3d/tests/unit/world/build.test.ts` (the occluder rule's lines), `.../occluders/occluder-rule.test.ts` (a face that does not stand on
the floor; a prop that hangs), `.../occluder-pass.test.ts` (the figure as the frame shows it), `.../app/world-view.test.ts` (every face and prop
between the eye and the figure); and the game's sweep `tests/unit/app/room-sight.test.ts`: every room, places 0.75 m apart over its walkable
floor, 24 headings, the real `drawWorld` and rule settled, then a line from the eye to her head and to her chest crosses no triangle still drawn
whole. It failed on the bulkhead and the strip lights, then on the cabinet, the IV bag, the extinguisher cabinet and the closet's bottles;
it passes now. Her **waist** is still behind low furniture she stands just behind (a bed's head, a gurney's rails, the counter top), as in
any cut-away; the sweep pins head and chest, not the waist.

Frames (Chromium, software GL, 1024 by 768):
- `s2-a-before-corridor-end-from-south-bulkhead.png`: the defect reproduced, the bulkhead filling the frame.
- `s2-a-after-corridor-end-from-south.png`: the same place and heading: the bulkhead cut, she stands whole in front of the exit door.
- `s2-a-before-hall-north-from-north-strip-light.png` and `s2-a-after-hall-north-from-north-strip-light-faded.png`: the strip light across
  her waist, then at 25%: she reads through it (a fade, by the rule, not a cut).
- `s2-a-after-corridor-end-from-north.png`: clear.
- `s2-a-after-hall-north-from-south-FEET-OFF-FRAME.png`: **a new defect for item (b)**: at the hall's north end looking north, after walking
  north, her feet run off the bottom of the frame: the look is held ahead of her by the walk, at the edge of the derived reach.

## Session 2, item (b): every room in play, looked at

Seven places by coordinates (the hall's south, east, west and north sides, the corridor's two ends, the closet), each from headings 0, 120 and
240 (the closet also from 300 in its north-west corner). The closet is locked until the key cabinet's code: the shots helper now takes
`name:tap:hotspot`, `name:code:digits` and `name:press:label` (a message's Close), so the walk reaches it (`-:tap:cabinet;-:code:2000;
-:tap:closetDoor;-:press:Close;-:walk:3.1,-4.6`). Every frame was looked at; in every one she is whole, in the frame and unoccluded.

**Fixed on the way (tests first):**
- **The peek took her out of the frame** (`s2-a-after-hall-north-from-south-FEET-OFF-FRAME.png`): standing 0.6 s near a doorway the camera
  leaned 1.2 m (`peek.toml`) toward the next room, more than twice the 0.52 m this scale's frame allows. A view may now cap its lean
  (`peekReach`, `@automata/3d`; the rig's `clampPeek` takes it), and `fitFocus` derives it: the reach less the follow's dead zone (a peek
  starts once she stands, so no lead or lag, but the dead zone may hold the look that far off). The level's views: hall 0.22 m, corridor and
  closet 0.21 m, pinned to the derivation by `room-fit.test.ts`, which now also sweeps a standing peek 8 ways with the dead zone held 8 ways
  from every 15 degrees (it fails with the old 1.2 m). `content.hash` moves: the views are sim content.
  After: `s2-b-after-hall-north-from-south-peek-capped.png`.
- **A tall prop she stands beside faded** (`s2-b-before-hall-east-h240-key-cabinet-wrongly-faded.png`): the side of her sprite reached into
  the key cabinet's box, so item (a)'s side lines called it "on the line". A point inside a prop's box is beside it, not behind it.
  After: `s2-b-after-hall-east-h240-key-cabinet-whole.png`.

Sheets: `s2-b-sheet-hall-4-sides-3-headings.png`, `s2-b-sheet-corridor-2-ends-3-headings.png`, `s2-b-sheet-closet-and-the-two-fixes.png`
(the closet's and the fixes' frames). Notes: the strip lights fade to 25% (the rule's `fade`), so at the corridor's south end from the north
a faint band crosses her head; a bin in front of her legs at the key cabinet fades the same way. **Facing pops at the 8-way boundaries were not
judged from these frames** (stills cannot show a pop); the hold (7.5 degrees) is covered by the kit's unit tests and `camera.test.ts`, not
by a slow turn shot.

## Session 2, item (c): see the room: tilt 25 adopted

Measured in Node for the hall's lens and distance (`reachOf`, `bestLookHeight`; the floor the frame's middle column covers, along the view):

| lens, distance | tilt | look height | reach | floor shown along the view |
| --- | --- | --- | --- | --- |
| 79 mm, 8 m | 30 | 1.05 m | 0.52 m | -0.61 to 5.98 m (6.6 m) |
| 79 mm, 8 m | **25** | **1.00 m** | **0.57 m** | -0.67 to 7.67 m (8.3 m) |
| 79 mm, 8 m | 20 | 0.95 m | 0.66 m | -0.77 to 10.83 m (11.6 m) |
| 79 mm, 8 m | 15 | 0.90 m | 0.81 m | -0.94 to 18.91 m (19.9 m) |
| 100 mm, 10.13 m (same zoom) | 25 | 0.95 m | 0.57 m | 7.5 m |
| 120 mm, 12.15 m (same zoom) | 25 | 0.95 m | 0.59 m | 7.1 m |

A longer lens at the same zoom changes the reach by a centimetre or two and shows less floor: kept at 79 mm. Frames
(`s2-c-sheet-tilt-30-25-20-15.png`; the hall's south and east walls, tilts below 25 tried by widening the schema's range for the trial only,
not committed): lower tilts show more of the wall she stands at and sink her in the frame; at 20, and plainly at 15, the room is seen near
level while her sprite is still painted from the renders' pitch, so she reads tipped toward the camera (the top of her head, the floor
compressed under her). 25 gives 10% more reach and 26% more floor than 30 with no visible tipping, and stays inside the camera rule's 25
to 40 degrees. **Adopted for all three rooms**, the pins re-derived by `room-fit.test.ts`'s derivation (from the old asks, a 1.5 m lead and
a 1/7 s lag): look 1.0 m; lead 0.27 m (hall) and 0.29 m (corridor); lag 0.09 s; peek 0.27 / 0.29 m; the closet's box 1.94..4.26 by
-6.16..-2.84. On the way, a rounding bug in `fitFocus` (0.29 x 100 is 28.999..., so a view given its own lead of 0.29 derived 0.28) is fixed
with a test (`play-fit.test.ts`, the fixed point). `content.hash` moves.

In play at the adopted numbers (`s2-c-sheet-tilt-25-adopted-in-play.png`, looked at): mid-hall from two headings, the hall's north end from the
south (the peek held to 0.27 m: her feet in the frame), mid-corridor side-on, the closet: she is whole, her feet planted on the floor with
her contact shade under them, and mid-hall shows more floor and furniture than at 30.

## Session 2, handoff at 90 minutes

Done: (a) `0403874`, (b) `189c028`, (c) `a83c54c`. Not done: (d) the cutscene lenses' texel scale (nothing changed in the cutscenes);
(e) the gates beyond the unit suites: the game's whole journeys were started at the end (9 of 18 passed at the stop, none failed, the rest
unreported), the whole uncached `pnpm check` (knip, changeset status, check-changesets), `pnpm build`, `pnpm api-report --update` and
`pnpm api-index --write` did not run. Run this session, all passing: `@automata/3d`'s unit suite (1619 at item a; its camera, occluder and
world-view tests again at items b and c), base-3d's unit suite, The Last Light's unit suite (461), typecheck of both, and every pre-commit
hook (the affected unit tests). No changeset: `@automata/3d` and the game are private. Chromium on software GL only.

## For the tracker

This session's row (camera session 2) for `docs/superpowers/progress.md` (workstream 2), verbatim (done, not done, where to resume); the tracker itself is back at
`claude/last-light-prologue`'s version, as the coordinator ruled.

| 4. Look, game branch, camera session 2 | LOOK session (camera, no subagents) | `claude/last-light-camera` | 2026-11-12, from `adb26c00`. Frames and numbers: [camera folder](audits/2026-11-12-last-light-camera-frames/README.md) (the `s2-` frames). **Done, pushed:** (a) she vanished behind the corridor mouth's bulkhead: measured in Node, the builder gave no face off a wall a line (bulkheads, steps, doorway frames, dados, skirtings), hung no window or decor on its wall, and `drawWorld` registered no free prop; all now follow the occluder rule (`base` on a wall span, five heights and the sprite's sides in the pass, a prop fades when its top is above 1 m; the old §4.2 1.5 m test pins the new rule); a sweep `room-sight.test.ts` (every room, 24 headings, nothing drawn whole on the line to her head or chest); `0403874`. (b) every room in play shot by coordinates at three headings (the closet through the key cabinet's code; the shots helper takes `walk`, `face`, `tap`, `code`, `press`), all looked at: she is whole and in sight; fixed on the way: the doorway peek leaned 1.2 m and pushed her out (`peekReach`, derived by `fitFocus`), and a tall prop beside her faded; `189c028`. (c) tilt: 30/25/20/15 measured (reach 0.52/0.57/0.66/0.81 m) and shot; **25 adopted** (inside the 25 to 40 rule; 20 and 15 show her tipped against a near-level room), pins re-derived: look 1.0 m, lead 0.27/0.29 m, lag 0.09 s, peek 0.27/0.29 m; a rounding bug in `fitFocus` fixed (0.29 derived 0.28). Commits: (a) `0403874`, (b) `189c028`, (c) `a83c54c`. The game's whole journeys were started at the end (Chromium, software GL): at the stop, 9 of 18 had passed (camera 4/4, hud, look 3/3, opening) and none had failed; the rest (frames, playthrough, shots, title, walk-shots) were still running and are unreported. **Not done / where to resume:** (d) the prologue's cutscene lenses (`content/cutscenes/*.toml`, lenses 20 to 41 mm; `stage.ts` sets the fov from the shot; `opening.toml`'s comment reasons about the close-up's density 8): find the painter's density rule per shot, list each shot's texel scale in field pixels before and after, make each whole (2, 3 or 4), shoot one frame of each, the opening's close-up first and their texel scale (a pure `Director.cameraAt(t)` exists, uncalled); (e) the gates: the game's whole journeys (`pnpm --filter @af-games/the-last-light test:e2e`), the whole uncached `pnpm check` (knip, changeset status, check-changesets not run on this tree), `pnpm build`, `api-report --update`, `api-index --write`; facing pops at the 8-way boundaries not judged by a slow-turn shot. `content.hash` moves (views are sim content). Browser goldens that draw a world with props or bands on the camera's line may move (not run). Chromium on software GL only; WebKit, Firefox and a real GPU unrun. |

The first camera session's row, which was on this branch's tracker only, verbatim:

| 4. Look, game branch, camera session | LOOK session (camera, no subagents) | `claude/last-light-camera` | 2026-11-12, from `8d820269` (session 16's head; node_modules installed with `pnpm install --frozen-lockfile`). Frames and numbers: [camera folder](audits/2026-11-12-last-light-camera-frames/README.md). **Done, pushed:** (1) the Owner's camera control ("Also cut the Q and E, let it be rotate horizontally with right stick, screen swipe, and mouse like normal 3D, but lock vertical rotation"): `camera-yaw` in an opt-in `cameraYawPlugin` (@automata/3d/sim; its own plugin because the schema hash names every command: inside `camera-heading` it moved base-3d's golden), the framework's either-button mouse drag (`mouseDrag: 'either'`) and `turnUnitsFromStick`, the kit's 8-way facing hold (7.5 degrees), Q and E gone, a journey that turns the camera by mouse (both buttons), swipe and right stick (`tests/e2e/camera.test.ts`, 4/4 in Chromium); `f184d89c`. (2, partly) the room fit derived, not by hand (`fitFocus`, `bestLookHeight`, `reachOf` in `@automata/3d/camera-view`): her reach is about 0.52 m at any heading, so the boxes are the walkable floor, the lead about 0.2 m, the lag 0.07 s and the look 1.05 / 1.1 m; `tests/unit/app/room-fit.test.ts` sweeps headings, corners, doorways and walking directions. **Not done / where to resume:** the open occlusion defect: looking north through the hall's mouth a bulkhead face (the corridor's 3.2 m ceiling under the hall's 4.9 m) fills the frame and hides her; make the occluder pass cut a portal's upper face, test first, then reshoot; the closet and the hall's south, east and west walls not shot at several yaws; items 3 (lower tilt / longer lens to show the room), 4 (prologue cutscenes' texel scale) and 5 (the game's full journeys, `pnpm check` result: see the handoff) not done. `@automata/3d` is private here, so no changeset for it; `@automata/framework` has one. `content.hash` moves with the level's view numbers (expected; the Ada branch moves it too). Chromium on software GL only; WebKit, Firefox and a real GPU unrun. |
