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
