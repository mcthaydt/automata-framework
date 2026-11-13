# The Last Light: the gameplay camera pulled back to the original's (2026-11-13)

LOOK session, no plan, no spec, no subagents. The Owner, on the joined gameplay frame (Ada 62% of the screen's height, the room out of
view): "the camera isn't massively zoomed in during gameplay like it is now right?", then "Yeah no, pull camera back until it matches
original game somewhat closely". Branch `claude/last-light-camera-back`, from `claude/last-light-prologue` at `3954f4924`.

| Step | State |
|---|---|
| 1. Measure the original | done (this section) |
| 2. Match it | not yet |
| 3. Ada frozen, checked | not yet |
| 4. Everything the camera touches | not yet |
| 5. Shoot and look | not yet |
| 6. Gates | not yet |

## 1. The original, measured

The original is `mcthaydt/PixiJS3D_Experiment_001` at `92e6704` (read only, cloned beside this repository). It runs headless here:
`npm ci`, Vite on port 5197, Chromium with SwiftShader WebGL. `tools/shoot-original.mjs` opens
`?debug&renderer=webgl&scene=prologue&framing=on&scale=letterbox&crew=off` (`framing=on` keeps the play camera's own framing under
`?debug`; `scale=letterbox` gives play's framebuffer, not the 640 by 480 capture one), skips the opening, puts Ada at a point with
`game.place(x, z, 0)` (facing +z, toward the camera), steps 240 ticks, and records the camera `lookAt` gave the engine and Ada's
projected feet and chest. Frames: `original/{1024x768,844x390}-{hall-south,corridor,closet}.png`; numbers: `original/camera-and-ada.json`.

### Its camera, from its code

- **Projection**: perspective, a **50 mm** lens on a 24 mm gate (`LENS_FOV`, 26.99 degrees vertical), the same lens in every room.
- **Tilt**: **30 degrees** down (`src/direction/gameplay.ts`, "50 mm, 30 degree tilt, fixed per zone; owner 2026-10-10").
- **Distance** (eye to look point, along the tilt): the hall **16.6 m**, the corridor **16 m**, the closet **15 m** (`src/scenes/prologue/level.ts`).
  Eye height about 8.1 to 9.4 m.
- **How it follows**: per zone. The hall is a fixed shot that slides 12% of her sideways offset (`follow: 0.12`) and 10% of her depth
  (`depthFollow`); the corridor and the closet are locked on (`follow: 1`, a 0.3 m dead zone). It never turns or zooms; Q and R orbit.
  Small and large rooms are framed the same way: one lens, about 16 m back, so a small room is a small box in a large black frame
  (the closet) and the large hall nearly fills it.
- **Picture**: the framebuffer is at most 640 by 480 and a whole number of device pixels a framebuffer pixel (`letterboxScale`):
  1024 by 768 is 2x of 512 by 384; 844 by 390 is 2x of 422 by 195. Ada is painted at density 1 (36.9 texels a metre) and is drawn under
  one framebuffer pixel a texel at this distance (point sampled).

### Its frame, measured from its pictures

Her height is crown to boot sole, read off 3x crops at whole pixels; the room in frame is the view's height at the look point,
`2 D tan(13.5 deg)`, and its width at the screen's aspect.

| Room (where she stands) | 1024 by 768: her height | 844 by 390: her height | Room in frame at the look (tall by across, 4:3 / phone) |
|---|---|---|---|
| hall, south wall (0.6, 6.5) | 188 px, **24.5%** (nearer the fixed camera than its look) | 97 px, **24.9%** | 8.0 m by 10.6 m / 17.2 m |
| corridor (0, -4) | 152 px, **19.8%** | about 70 px, **18%** | 7.7 m by 10.3 m / 16.6 m |
| closet (3.1, -4.6) | 162 px, **21%** | (same lens and distance as 4:3) | 7.2 m by 9.7 m / 15.6 m |

What the eye sees in them: the whole hall with its walls, the desk, the benches, the drip stand, the noticeboard and the door frames
(`original/1024x768-hall-south.png`); the corridor as a lit strip in black with both its walls and its far end; the closet as a small
room seen whole from above, its shelves and door. Her face is a few texels: a head about 13 texels across, eyes as two dark texels.

**Today's game, for comparison** (the join's frames): one density-2 texel is 2 field pixels at 1024 by 768 and Ada is 479 px, 62.4% of
the height; at 844 by 390 she is 236 px, 60.5%. The hall's view is a 79 mm lens 8 m back at 25 degrees: 2.4 m of room tall at her feet.
So today's camera is about 2.6 to 3 times closer than the original's.
