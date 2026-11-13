# The Last Light: the join of `claude/last-light-camera` and `claude/last-light-ada` (2026-11-13)

Execution session, no subagents. Joins, proves and measures; changes nothing of Ada's look (frozen at `321d194`, the Owner:
"okay stop tweaking ada, move on"). Progress: items 1 to 5 of the brief; each is ticked below as it lands.

| Item | State |
|---|---|
| 1. Merges | done (this section) |
| 2. Gates on the joined tree | not yet |
| 3. The joined game shot, Ada compared | not yet |
| 4. Playthroughs (first night, second night) | not yet |
| 5. Tick rate, measured | not yet |

Overall: 1 of 5 items done (20%).

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
