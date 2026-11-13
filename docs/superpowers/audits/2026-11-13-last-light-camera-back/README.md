# The Last Light: the gameplay camera pulled back to the original's (2026-11-13)

LOOK session, no plan, no spec, no subagents. The Owner, on the joined gameplay frame (Ada 62% of the screen's height, the room out of
view): "the camera isn't massively zoomed in during gameplay like it is now right?", then "Yeah no, pull camera back until it matches
original game somewhat closely". Branch `claude/last-light-camera-back`, from `claude/last-light-prologue` at `3954f4924`.

| Step | State |
|---|---|
| 1. Measure the original | done (this section) |
| 2. Match it | done (section 2) |
| 3. Ada frozen, checked | done (section 3) |
| 4. Everything the camera touches | done but the journeys (section 4; journeys in section 6) |
| 5. Shoot and look | done (section 5) |
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

## 2. Matched: the step chosen

**The rule that decides it.** A painted texel covers a whole number of field pixels and never less than one (`place.ts`:
`max(1, round(zoom / density))`). Ada's play cell is density 2, 124 rows. So the farthest the camera can stand with her crisp at density 2
is **one field pixel a texel**: she is 124 field pixels, a third of a 384-line field, whatever the camera does beyond that (stand back
further and she is drawn larger than the room around her). Today's frame is the step before it, two field pixels a texel. The original's
framing (Ada 20 to 25%) lies between one pixel a texel at density 2 (32%) and one pixel a texel at density 1 (16%); the step kept is
**one field pixel a density-2 texel**, because the Owner's own rule for her face is density 2 in play (`cast.ts`, `PLAY_FIGURE`) and
density 1 is not needed for crispness at 1024 by 768.

**The camera** (`content/levels/prologue.af-sector.json`, the three views; the level's data, no framework number):

| | before | after | original |
|---|---|---|---|
| lens | 79 mm | **50 mm** | 50 mm |
| tilt | 25 degrees | **30 degrees** | 30 degrees |
| distance (eye to look) | 8 m (hall), 8.25 m | **9.26 m**, every room | 16.6 m (hall), 16 m, 15 m |
| look height | 1.0 m | **0.6 m** (derived, `bestLookHeight`) | 1.1 m (hall), 0.6 m |
| zoom at her feet, 384-line field | 4.06 | **2.27** | about 1.3 |
| field pixels a density-2 texel | 2 | **1** | (density 1, under a pixel) |
| room in frame at her feet, tall | 2.6 m | **4.6 m** | 7.2 to 8 m |
| across, 4:3 / 844 by 390 | 3.4 m / 5.5 m | **6.1 m / 9.9 m** | 10.6 m / 17.2 m |
| Ada, share of the screen's height | 62.4% / 60.5% | **about 32% / 32%** (measured in section 5) | 20 to 25% |

So the frame now shows about 1.8 times the room's height it did, and stands about 1.6 times closer than the original (by height in frame:
4.6 m against 7.2 to 8 m). That is the whole step nearest the original's; the next step out does not exist at density 2.

The distance is chosen so the step holds on every field the game draws on a desktop (`camera-rules.test.ts`): a zoom of 2.27 at a 384-line
field, 2.13 at a 1920 by 1080 window's 360 lines (density 2 kept with 5% to spare), 2.83 at a 480-line field (still one pixel a texel).

**The phone first: 844 by 390.** The field there is 422 by 195 (`fieldFor`, the old game's whole-scale rule), so the same camera gives a
density-2 texel half a field pixel; today she is already at one pixel a density-2 texel there (60.5%). Standing back on a phone at density
2 would draw her twice her size in the room. So the density the painter's own rule gives that field is used: `densityNeeded` (the
character kit's rule, now exported) on the play camera's zoom at the field's lines, at most the cast's 2 (`app/figure-density.ts`,
`playDensity`): **density 2 on the 384- and 360-line fields, density 1 on the phone's 195 lines**, one field pixel a texel at both sizes,
about a third of the height at both. It is held for the run (the field is fixed at start), not chosen each frame by the zoom: stood back,
her depth in the frame swings about 15% as the look leads and the room's box holds it, and a per-frame choice (`'auto'`) flipped her
paint as she walked near the far walls. **This is the density rule doing its work, not a change to her**: density 1 is her own painted
cell at that density (section 3).

**The cutscenes keep density 2.** Their lenses were set for density 2 (`cutscene-scale.test.ts`, every shot a whole 2, 3 or 4 field
pixels a texel on the 384-line field). While a cutscene draws its own shot the figures are painted at the cast's density on every field
(`figureDensity`; the character kit's `density` may now be a function asked each frame), so no shot's framing or figure changes. Play only
is density 1 on a phone.

**Framework changes, both small, both test first.** (a) `@automata/3d` `fitFocus`: the peek's reach was the whole budget; the rig adds a
peek to the look the focus box clamped, so with a box inset (none at the near scale, more than a metre now) a peek in a room's corner took
her out of the frame (the game's own peek sweep failed). It now leaves the peek what the inset spares; and a box edge rounding from just
under nought was `-0`, which the level's JSON stores as 0. (b) `@automata/character-kit`: `density` may be a function; `densityNeeded`
exported. No other framework number changed.

## 3. Ada frozen, checked

Nothing under `games/the-last-light/src/features/figures` changed but `figure-view.ts` (it takes the density from the app); `cast.ts`, her
swatches, `look.toml` and her lights are untouched (`git diff 3954f4924 -- games/the-last-light/src/features/figures/cast.ts
games/the-last-light/src/features/figures/old-swatches.ts games/the-last-light/content/look.toml` is empty). A throwaway test (not
committed) painted her with the kit's `Painter` (`holdSkinHue`, standing, 8 directions, densities 1 and 2) and hashed `ADA` and each
cell's RGBA, run in a worktree at `3954f4924` and on this branch: **all 17 hashes identical** (`ada-cells-hash.json` here). Her definition's
hash, `0fe4cf1a7c8836f3`, is the join's (`2026-11-13-last-light-join/ada-cells-hash-join.json`); the cells' hashes are a different
recipe from the join's, so they are compared tree to tree, not with that file.

## 4. What the camera touches

- **Rooms fitting, lead, lag, peek**: re-derived by `fitFocus` and `bestLookHeight` for her sprite at one pixel a texel (128 by 48 field
  pixels on 384 and 360 lines); the reach is 2.39 m (was 0.52 m). Lead 0.27 m (hall), 0.29 m (corridor), lag 0.09 s and peek 0.27 / 0.29 m
  are kept as they were (what the views ask; the budget no longer cuts them), and the box stands well inside each room: the hall's is x
  -3.74..3.39, z -2.31..5.39; the corridor's is its middle (x 0..0.25, z -5.4..-2.35); the closet's is one point (3.1, -4.89..-4.11 in z),
  so the small closet is framed whole, as in the original. `room-fit.test.ts` sweeps the real follow rule at every 15 degrees, at the
  corners, middle and doorways, walking 8 ways and peeking 8 ways, in the 384- and 360-line fields and now also the phone's 195-line one
  with her density-1 sprite: she is whole in every case.
- **The turn** (stick, swipe, mouse; vertical locked): untouched; the views' tilt is data. The journey `camera.test.ts`: section 6.
- **The occluder fade**: untouched (props above 1 m, her sprite's width in metres); `room-sight.test.ts` passes on the new views.

## 5. Shot and looked at

Same spots in the game and the original: the hall's south wall (0.6, 6.5), the corridor (0, -4) and the closet (3.1, -4.6), the
smallest room (the hall is the largest), Ada facing the camera, the camera at its starting heading. The game's frames are the play-shots
harness (`tools/shoot-af.sh`: walk steps by coordinates, the closet opened through the key cabinet's code), Chromium, software GL, before
in a worktree at `3954f4924`, after on this branch. Sheets (before | after | original): **`sheet-1024x768.png`**, **`sheet-844x390.png`**;
the frames are in `before/`, `after/` and `original/`. Every one was opened and looked at.

| Ada's height on screen (hall, south wall) | before | after | original |
|---|---|---|---|
| 1024 by 768 | 479 px, 62.4% | **about 246 px, 32%** (rows 350 to about 595) | 188 px, 24.5% |
| 844 by 390 | 236 px, 60.5% | **about 122 px, 31%** (rows 180 to about 302) | 97 px, 24.9% |

(The corridor and the closet have the same camera and she stands on its look, so she is the same size there; by eye, she is.)

**What matches the original.** The lens and the tilt are its own, so the room has its look: the floor's tiles recede the same way, the
walls lean in the same way, and you look down into a room rather than at a person. Each room reads as a room: in the corridor both walls,
the trolley, the bucket, the far doorway and the floor between are in frame; the closet is seen whole, its shelf, the cabinet, the clock
and its door frame, with the hall's tiles through the doorway; the hall shows the benches, the papers on the floor and the desk's corner.
She is small in it and easy to find: the brightest thing in each frame (her cream shirt), in the middle.

**What does not, and why.**
- She is about 1.3 times the original's share of the height (32% against 24.5% in the hall, 20% in the corridor), and the frame shows
  about 60% of the original's room (4.6 m tall at her feet against 7.2 to 8 m). That is the crisp rule at density 2: one field pixel a
  texel is the farthest whole step. The next one out is density 1 everywhere (16%), which the Owner's density-2 face rule rules out.
- The original's hall camera was fixed (it slid 12%), so at the south wall she stood at the bottom of a frame filled by the hall. The game
  locks on: the room's box holds the look 1.1 m inside the wall, so she stands a little below the middle and **a black band shows below
  the hall's cut south wall** (the bottom 140 px at 1024 by 768, 90 px at 844 by 390): the far side of a wall the occluder rule cut.
  The before frame did not show it because it showed only 2.6 m. Not changed here: it is the follow rule's, not the scale's (see the tracker
  rows).
- The original's corridor and closet floated in black (its 16 m camera saw past every wall); the game's nearer camera fills the frame
  with the room and the next one through the walls the occluder cut, so there is less black. Nearer to the Owner's ask, not the original.

**Her face at each size** (accepted smaller). At 1024 by 768 (density 2, a texel 2 by 2 screen pixels) her head is about 28 texels across:
the brows, both eyes with their whites and the mouth read, smaller; the face is a face. At 844 by 390 (density 1 in play, a texel 2 by 2
screen pixels) her head is about 14 texels: brows and eyes are a dark line and two dots, the mouth a dot; it reads as a face with eyes,
not an expression. In cutscenes she stays density 2 on the phone (section 2).

**The HUD.** The pause button (top right), the objective line and the context button ("Fuse box", "Supply shelf") are where they were and
the same size in every after frame; nothing of the HUD changed. Their sizes are the HUD journeys' to prove (section 6).

**The LCD screen mesh.** `look.toml`'s screen mesh is a line every 4 screen pixels; a texel of hers was one 4-pixel cell (two field pixels)
and is now half a cell, so a mesh line crosses every other texel of hers. Looked at 1:1 in the after frames: the faint grid is there over her
as over the room, as in the original (whose figures were under a pixel a texel). Not changed: the look is the Owner's.
