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
