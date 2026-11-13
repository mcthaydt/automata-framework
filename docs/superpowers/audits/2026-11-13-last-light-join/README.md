# The Last Light: the join of `claude/last-light-camera` and `claude/last-light-ada` (2026-11-13)

Execution session, no subagents. Joins, proves and measures; changes nothing of Ada's look (frozen at `321d194`, the Owner:
"okay stop tweaking ada, move on"). Progress: items 1 to 5 of the brief; each is ticked below as it lands.

| Item | State |
|---|---|
| 1. Merges | done (this section) |
| 2. Gates on the joined tree | done (this section) |
| 3. The joined game shot, Ada compared | done (section 3) |
| 4. Playthroughs (first night, second night) | not yet |
| 5. Tick rate, measured | not yet |

Overall: 3 of 5 items done (60%).

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
