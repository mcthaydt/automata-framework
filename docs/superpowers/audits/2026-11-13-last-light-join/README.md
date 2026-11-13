# The Last Light: the join of `claude/last-light-camera` and `claude/last-light-ada` (2026-11-13)

Execution session, no subagents. Joins, proves and measures; changes nothing of Ada's look (frozen at `321d194`, the Owner:
"okay stop tweaking ada, move on"). Progress: items 1 to 5 of the brief; each is ticked below as it lands.

| Item | State |
|---|---|
| 1. Merges | done (this section) |
| 2. Gates on the joined tree | done (this section) |
| 3. The joined game shot, Ada compared | done (section 3) |
| 4. Playthroughs (first night, second night) | done (section 4) |
| 5. Tick rate, measured | done (section 5): measured, no defect found, nothing changed |

Overall: 5 of 5 items done (100%). Item 6 (stop under 90 minutes) applies: stopped here.

## 1. The merges

The container's local `claude/last-light-prologue` was a shallow clone at `16c1bbd7`, 537 commits behind its remote; both branches were cut
from the remote's head `8d820269`. The local branch was fast-forwarded to `origin/claude/last-light-prologue` (`8d820269`, the commit this
session started from; the "before the join" commit of item 5) and the three merges were made from there, real merges, no rebase, no squash.

| Order | Merged | Result |
|---|---|---|
| 1 | `origin/main` (`28d72fb5`, 29 commits ahead of the branch's merge base) | clean, no conflict (`986b741c`) |
| 2 | `origin/claude/last-light-camera` (`4eddc7b8`, 14 commits) | clean, no conflict (`9728d692`) |
| 3 | `origin/claude/last-light-ada` (`321d1948`, 30 commits) | **4 files in conflict, 6 hunks** (`cd79c330`) |

Only 10 files were changed by both branches since `8d820269` (not about 60): the three generated or documented API files, the game's
`content.json`, `content.hash`, `game.ts`, the painted view, `cast.test.ts` and `play-shots.test.ts`. The four conflicts and the files that
merged without a conflict but changed under both sides are below.

### Conflicts

**`games/the-last-light/content/generated/content.hash`** (1 hunk). Generated, not authored. Camera: `ff22f745…`; Ada: `6be0b66c…`; the base
`d491499b…`. The two sides changed different parts of the content (camera: the lenses, the sector's shots and the look file's keys; Ada:
the look's panel and the lights), so neither value can be right for the union. Resolved by taking one side to finish the merge and then
letting the game's own content compile write the real value, `34911db2…` (committed after the merge, with the merge's tests having
run on it). `sim-content.hash` merged without a conflict and is the camera's `23b3b015…` (Ada's changes are presentation only, so her
side kept the base's `65b6885d…`).

**`games/the-last-light/tests/unit/features/figures/cast.test.ts`** (1 hunk, a comment). Both sides rewrote the comment that named the
painter's source project ("FigureBuilder's record of its base pair"): camera to "the painter's upstream record of its base pair", Ada to
"the record of its base pair". Kept Ada's wording (it names no source project and says no more than the camera's). No test line differed.

**`games/the-last-light/tests/e2e/play-shots.test.ts`** (2 hunks, the shooting harness). Camera added step kinds (`drag`, `walk`, `face`,
`tap`, `code`, `press`, the `settle` wait and the `-` no-frame name); Ada made a step's key accept `KeyS+KeyD`, held together and released in
one task so no tick sees one key of the pair still held. Both behaviours kept: the camera's step dispatch with Ada's multi-key hold as its
last (key) branch, and the header comment names both. This is the harness item 3 shoots with.

**`tooling/api-report/reports/3d.api.md`** (2 hunks). A generated report: camera added `peekReach` to the camera rig's two interfaces, Ada
added nothing there (her side was the empty half of each hunk). Kept `peekReach`; `pnpm api-report` rewrites the file in item 2.

### Merged without a conflict, checked by reading both sides

- `extensions/character-kit/src/features/painted/painted-view.ts`: camera added the facing hold (`holdFacing`, an import and three lines in
  `frame`), Ada added the `grid` option (a field, a doc comment and the `placing` line). Different lines of the same function; both kept.
- `games/the-last-light/src/app/game.ts`: camera replaced Q and E with `cameraYawPlugin` and `CAMERA_INPUT` and the occluder's width; Ada
  named the look passes (`LOOK_PASSES`) and handed them to the renderer's `postFilters`. No shared line.
- `games/the-last-light/content/generated/content.json`: the union (camera's lenses and shots, Ada's look and lights).
- The generated API docs (`agents/automata/skills/automata-api/reference/api.md`, `docs/cheatsheet.md`, `automata.api.md`): item 2
  regenerates them.

### The trackers

`docs/superpowers/progress.md` and `docs/refactor/progress.md`: **neither branch edited either file** (checked: `git diff 8d820269
origin/claude/last-light-{camera,ada} -- <both files>` is empty). Both branches' rows are in their audit READMEs under "For the
tracker" (camera: line 273 of its README; Ada: sessions 2, 3 and 4), verbatim, so nothing of theirs is lost. The brief said to take main's
file entirely; that was not done for `docs/superpowers/progress.md`, because the check the brief asks for fails for the prologue branch's
own sessions: that file on the branch carries the rows of sessions 3 to 16, the Owner's words and editor-gap rows 12 to 18, which exist
nowhere else (main's file has none of them), so taking main's would delete the branch's own record. It is left as the merge made it
(main's file plus the prologue's own rows) with one row added for this session. `docs/refactor/progress.md` is identical to main's.

## 2. The gates on the joined tree (`54830b64`, nothing cached)

Node 24.22.1 (fetched into `/opt/node24x`; the container has 22), pnpm 10.34.6, `pnpm install --frozen-lockfile` (lockfile unchanged).
No hash, golden or recorded picture differed from what the branches recorded: nothing to stop on, nothing re-recorded.

| Gate | Result |
|---|---|
| `pnpm install --frozen-lockfile` | passes |
| `pnpm format` | exit 0, no file changed (741 warnings and 190 infos, no errors, as on main) |
| `TURBO_FORCE=true pnpm check` | **exit 0**: lint, typecheck, boundaries, style, source-names, knip, `test:unit` over 67 turbo tasks (0 cached; 15 min 22 s), `changeset status` (patch bumps for published packages only) and `check-changesets` (87 changesets, 0 problems) |
| `TURBO_FORCE=true pnpm build` | **exit 0**, 16 of 16 tasks, 0 cached |
| `pnpm api-report` | exit 0 (22 API breaks against the base, 0 undeclared, all in the private `@automata/3d`); `--update` rewrote nothing |
| `pnpm api-index` | 1306 exports from 50 entry points, 0 undocumented; `--write` rewrote nothing |
| The game's unit suite (inside `check`) | 61 files, 472 tests, all pass |
| `@automata/3d` unit | 150 files, 1632 tests, all pass |
| `@automata/character-kit` unit | 49 files, 379 tests, all pass |
| `@af-games/base-3d` unit (its goldens and hashes) | 20 files, 110 tests, all pass |
| `@automata/figures` unit (the `goldens` project is in it) | 54 files, 730 tests, all pass |
| `@automata/3d` browser, Chromium (`browser (chromium)` and `webgpu`, `AF_WEBGPU=software`) | 16 files, 55 passed, 2 skipped |
| `@automata/character-kit` browser, Chromium, the same | 13 files, 66 passed, 3 skipped files / 3 tests |
| `@automata/figures` browser and goldens, Chromium (`browser (chromium)`, `webgpu`, `goldens`, `AF_WEBGPU=software`) | 11 files, 303 tests, all pass |

Notes, so nothing is read as more than it is:

- The 5 skips are the tests' own guards (a browser with no WebGPU adapter, `skipIfAdapterGone`, `context.skip` on a fallback), not skips
  added or kept by the join. No test was skipped or loosened.
- The packages' `browser` project lists Chromium, WebKit and Firefox. Only Chromium is installed in this container, so WebKit and Firefox
  **did not run** (the parity of the browser suites in the other two engines is pending for the GPU runner / CI). A first `turbo run
  test:browser` died at once on `firefox-1543` not being installed; the runs above name the Chromium projects.
- Without `AF_WEBGPU=software` figures' 105 webgpu cases skip and one WebGPU "instance dropped" rejection is reported; with it all pass.
- Not run here: `pnpm test:browser:2d`, base-3d's and the game's browser, e2e and journey suites other than item 4's playthroughs, editor-3d's
  browser suites, the 3D workflow's journeys.

## 3. The joined game shot, and Ada compared (`e7990013`+, Chromium, software GL, 1024 by 768, the play-shots harness)

Pictures (all in this folder):

- `shots-gameplay/hall-south.png`: the gameplay frame (the default step, `hall-south:KeyS:150`, as the Ada branch's `s4-item4`).
- `shots-eight/{s,se,e,ne,n,nw,w,sw}.png` and the strip `join-eight-directions-in-play-1to1.png`: the eight sides, shot with the Ada
  session's own steps (`s:KeyS:60;e:KeyD:50;n:KeyW:50;w:KeyA:60;se:KeyS+KeyD:40;sw:KeyS+KeyA:40;ne:KeyW+KeyD:40;nw:KeyW+KeyA:40`); each
  crop is 260 by 560 at 1:1, picked by hand on her position.
- `ada-321d194-same-harness/`: the same two shoots made on the Ada branch's head `321d194` in a worktree (the same harness, the same steps),
  because the pictures the brief names were recorded **before** Ada's last hair commit (`102567b0`, 00:54; `s4-item4` and `s4-item3` are
  from `0fe55f9b`, 00:47), so they cannot show the frozen head's hair. `ada-321d194-vs-join-hall-south-x2.png`: her cropped from that frame
  and from the join's, side by side and as a (x3) difference, enlarged x2.
- `ada-cells-hash-join.json`, `ada-cells-hash-321d194.json`: a hash of `ADA` and of her painted cell in every direction at densities 1
  and 2 (a throwaway test, not committed), in both trees.

What I saw, opening the pictures:

- **She is the same Ada.** Her painted cells (all 16) and her definition hash are **byte-identical** in the join and at `321d194`; the join
  changes nothing under `games/the-last-light/src/features/figures`, her swatches or `look.toml` against `321d194`. In the frame: the same
  six-head figure, the same ash-brown bob, brows two texels thick, eyes with whites under a dark lid, a nose, a two-tone mouth, the oxblood
  waistcoat with its four buttons, the cream sleeves, the grey-green trousers, the boots. Front, front three-quarter, both profiles and the
  three backs read as in the Ada pictures, including what her session 4 left open: the backs' round dome (no nape) and the lighter brown wedge
  across the waistcoat's back; the dark-red flap at the nape in profile.
- **Against the brief's two named pictures** (not like for like): (a) her hair is ash brown, the older pictures show a reddish brown: that
  is Ada's own later commit `102567b0`, the same in the `321d194` shoot; (b) the frame is not the same crop: the camera branch moved the
  hall's camera, so she stands 36 px higher in the join's gameplay frame (her head top at y 205, Ada's older frame 242) at the same size
  (about 485 px crown to boots); (c) in the older `SE` picture she was cut by the frame's right edge and is a ghost half; in the join she is
  whole, against the wall (the camera session's room fit).
- Against `321d194` in the same harness, the per-texel differences in her sprite (the difference panel, in the hair crown, the shoulders and
  the boots) follow from the camera moving her on the screen (the screen pass's vignette, the dither and the lamp's step thresholds act on
  screen position and on where she stands in the room's light). They are not her data: the painted cells above are identical. I did not
  isolate each texel; I note it as measured-identical cells, differing frame.
- Not hers, seen in the join's frames: black voids to the right of `SE` and `E` and at the lower left of `NE`: the far side of the cut
  walls (the camera branch's occluder rule); the join did not make them (they are in the camera branch's own frames).

Verdict: the join did not change Ada.

### The Owner's asked-for frames (the coordinator's request, shot before item 4)

`shots-gameplay/hall-south.png` (1024 by 768) and `shots-phone-landscape/hall-south.png` (844 by 390, the same room and spot: the hall's
south wall, facing us, the default step; `AF_SHOOT_SIZE=844x390` is a new option of the shooting harness, `play-shots.test.ts`; the
context is not a touch one, as with every shot of that harness). Measured from the pictures (edge spacing of her sprite, her rows):

| | 1024 by 768 | 844 by 390 |
|---|---|---|
| Screen pixels one painted texel of Ada covers | 4 by 4 (edges every 4 px) | 2 by 2 (edges every 2 px) |
| Field pixels per texel (the game's `crisp` rule: two) | 2 (a field pixel is 2 screen px) | 2 (a field pixel is 1 screen px) |
| Her height on screen, crown to boot sole | 479 px (rows 208 to 686), 62.4% of the height | 236 px (rows 110 to 345), 60.5% of the height |

## 4. The playthroughs (Chromium, software GL, `AF_WEBGPU=software`, the joined tree, `playthrough.test.ts`)

| Journey | Result | Time |
|---|---|---|
| The first night: the prologue plays to its end through the page and the credits come up | **passed** | 11.2 min |
| The second night: from a fresh page two nights end in the same state (the file's second test plays two nights) | **passed** | 21.4 min (about 10.7 a night) |

The camera session's first night took 9.6 min; this one 11.2 min, with `pnpm`'s other work idle, so the join may have added a little to a
frame, or the container is slower today; item 5 measures the rate.

A first attempt ran both tests at once (Playwright's default two workers) and **both failed**: each waited 300 s of the clock for the fact
`figureGone` (the nurse leaving, `driver.ts` line 87, the `hideUntil` wait) and two software-rendered browsers on four cores did not reach it.
That was the container, not the join: with `--workers=1` both pass, as above. The 300 s limit of that one wait is the next bound the
camera session's 10-minute cutscene wait did not reach; it is not changed here (a journey run must use one worker in a software renderer).

## 5. The tick rate (Chromium, software GL, the game's dev server; probes in `probes/`, kept as `.txt` so no gate reads them)

Every window is 5 s of the clock in play (or the opening) after the probe's `skip`, with the sim's tick read through the probe and the
animation frames counted by a `requestAnimationFrame` loop in the page. Nothing is committed to the game's source or tests: no fix was found.

### (a) Was it already this slow? Yes. The join did not change it.

| Build | Viewport | Opening, ticks/s | Play, ticks/s | Median frame |
|---|---|---|---|---|
| `claude/last-light-prologue` **before the join**, `8d820269` | 844 by 390 | 12.0 | 12.5 | 479 ms |
| the **join**, `54830b64`+ | 844 by 390 | 12.2 | 12.6 | 479 to 495 ms |
| the join | 422 by 195 | 14.4 | 14.5 | 417 ms |
| the join | 1024 by 768 | 7.5 | 7.7 | 766 to 784 ms |
| `origin/main`'s `base-3d` (`28d72fb5`) | 844 by 390 | | 36.0 | 163 ms |
| `origin/main`'s `base-3d` | 1024 by 768 | | 35.2 | 166 ms |

- The camera session's "about 8 ticks a second (42 in 5 s)" is the 1024 by 768 rate (7.5 to 7.7). The journeys' phone size
  (844 by 390, the config's viewport) runs about 12.5 a second: a 17 s opening (1,020 ticks) takes about 82 s there and 136 s at 1024 by 768.
- Each frame takes **6 ticks, always** (108 ticks in 18 frames; 180 in 32 for `base-3d`): the loop caps a frame's time at `MAX_FRAME_MS`
  100 ms, which is 6 steps at 60 Hz. So ticks a second is 6 over the frame time, and a slow frame loses clock time, not steps.
- `base-3d` has the same loop and renderer and is 3 times faster a frame in the same container (about 165 ms a frame: that is what
  software GL costs one Pixi 3D scene here). The Last Light's extra is the next table.

### (b) Where the frame goes (profiled, not guessed)

- **Not the sim and not JavaScript.** A CPU profile over 6 s (`probes/profile-join.json`): of 7.4 s sampled, 7.1 s are `(program)` (native
  time) and about 0.7 s are JavaScript in all; of that the figure painter's `rasterize`/`raster` are 0.35 s (it repaints a cell when its light
  changes) and the whole sim (`agent-step`, `pending`, `probe-kinds`, `nav`) a few ms. Painting figures at density 2 is not what is slow.
- **The main thread waits on the GPU process.** A Chromium trace over 6 s: the renderer's main thread spends 6.05 s inside
  `GLES2::ReadPixels` and `CommandBufferHelper::Finish` (13 calls, about 465 ms each, the software compositor reading the WebGL canvas back);
  the GPU process's command buffer is busy 7.1 s of the 6 (`CommandBufferStub::OnAsyncFlush`). The renderer is SwiftShader, so a frame's
  cost is the CPU running the frame's shaders.
- **What the frame asks for** (a wrapper on the WebGL2 calls): one frame is 128 draws at the field size (633 by 292, the 844 by 390
  screen at its crisp scale) for the scene, then four more full-field render-texture passes (a clear and a draw each), then 3 draws at the
  1688 by 780 backing canvas (renderer resolution 2) and 2 at 844 by 390. **The scene is drawn once a frame, not once a sim step** (checked:
  the same block repeats once per frame, 6 field-size clears of which 5 are the passes').
- **Time by segment**, a 1-pixel `readPixels` after every draw so each one is timed (this adds a stall per draw: the total, 521 ms a frame,
  is a little over the 480 ms real frame; `probes/seg-join.json`):

| Segment | Calls | ms a frame |
|---|---|---|
| the scene (128 draws, field size) | 128 | 95 |
| a pass, field size (draw 2 of the 4 passes) | 2 | 4 |
| **one field-size pass: a fragment shader named in `DUEL[256]`: the palette snap** | **2** | **282** |
| two more field-size passes | 2 + 4 | 10 + 16 |
| the upscale to the 1688 by 780 canvas, 3 + 3 draws | 6 | 62 + 41 |
| the last 844 by 390 pass | 2 | 9 |

  The 282 ms is **one draw**. The shader (`@automata/3d` `duel-snap-filter.ts`, which `renderer` runs as the DUEL snap) holds the 256-colour
  palette as a constant array and loops it **twice in the same loop per pixel** (nearest to the dithered colour, and nearest to the
  exact colour so a colour that is already a palette colour stays itself): 512 distance sums a pixel on 185 thousand pixels, about 95
  million a frame, dynamically indexed into a constant array, which a CPU rasteriser runs slowly and a GPU runs in a fraction of a
  millisecond. It is more than half of the frame here and none of it on a GPU runner.
- Switching the retro grade and the LCD pass off (`pass.enabled = false`, through a temporary hook in `look-passes.ts`, reverted) did
  not move the rate (12.6, 12.6, 12.2, 12.8 ticks a second for all on, retro off, LCD off, both off; `probes/toggle-join.json`): the snap is not
  one of those two passes, and I did not check whether `enabled = false` skips their draws. The screen mesh (`[lcdScreen]`) and the occluders were not
  switched off: the segment table puts the whole upscale at 112 ms and the scene at 95, so they cannot be more than that.

### (c) Is the sim's step tied to the frame? No, by design and by test

`createFrameLoop` (`packages/automata/src/shared/runtime/loop/frame-loop.ts`) steps the sim in a fixed-step accumulator
(`stepMs`, 1000/60), draws once with `alpha = accumulator / stepMs`, and caps one frame at `MAX_FRAME_MS`. A slow frame can drop clock time
(it takes 6 ticks, not more); it changes no tick's content. Its unit tests (`frame-loop.test.ts`) already prove: "fixed ticks however
frames group" (60 frames of 1000/60 ms and 30 of 1000/30 both give 60 steps), "a long frame is capped" (one 1000 ms frame gives 6 steps),
paused time is dropped, and the time source is `frames.now()`. Both nights end in the same state through a page that gets 6 ticks every
480 ms (item 4). No test was added: there is nothing to pin that is not pinned.

### What I did not do, and what I would propose (reported, not done)

- **No fix.** Nothing found is a plain defect, and the one big cost (the snap's loop) is in the picture's own pass; a change that makes it
  cheaper changes the shader that makes every pixel's colour. It would have to give the same bytes (a nearest-colour table texture built
  once, or a loop that exits early): a frame test comparing every colour before and after would decide that, on the GPU runner. For the
  coordinator.
- A software-GL cost that does not exist on a GPU is a CI and container cost: journeys wait on ticks, not time, so this only lengthens them
  (a night is 10.7 to 11.2 minutes), and the `figureGone` wait of 300 s needs one worker (item 4).
