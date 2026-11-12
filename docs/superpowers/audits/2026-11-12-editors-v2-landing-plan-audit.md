# Landing the editors' new look (v2): plan audit

Stage 3 of 7. Audited: the survey [`2026-11-12-editors-v2-landing-survey.md`](2026-11-12-editors-v2-landing-survey.md)
and the plan [`../plans/2026-11-12-editors-v2-landing.md`](../plans/2026-11-12-editors-v2-landing.md) on
`claude/editors-v2-landing-plan` at `fdae6f18` (the brief named `5eaefa5c`; the coordinator moved the branch to
`fdae6f18`, which adds Part C's interface; this audit is of `fdae6f18`). No subagents, no product code changed. The fixes
are made in the plan and the survey on `claude/editors-v2-landing-plan-audit`.

## Verdict

**Task 1 can start now, with the plan as fixed here.** As written it would fail: its B1 path list leaves out the new
file the B1 fix imports (`kit/widgets/field-position.ts`) and the typed-save change, and it takes the saved line into
`main`'s top bar without `4c855dfa4`, the commit that stopped that line pushing the Dock off a phone (the stack's own
layout tests failed on it). Task 1 also never ran a layout suite. All three are fixed in the plan (A3, A4, A5).

**Task 2 can start now, with the plan as fixed here, on one condition:** that the session is told which of
`claude/editor-journeys-green` and `claude/pixi-3d-public` are on `main` when it starts (the conflict count is 51 on
`main` `7b6ce6ac`, 54 after the first, 52 after the second, 56 or more after Task 1). As written it would stop at its
Step 5: `main`'s pre-commit hook (since `4be1afc9`, 2026-11-12) runs Biome and the unit tests of every package a commit
stages, so a merge commit made before the imports are fixed is refused, and `--no-verify` is not allowed (A1). Two of
its rules would also produce a broken tree without a conflict marker to warn: the 3D cutscene stage (A2) and the site's
`color-scheme` (A7). The plan now has a per-file table for all 51 files (and the 3 to 6 more) and the order the session
works in.

The numbers stand. On full history and today's `main` the three trial merges give exactly the survey's figures.

## What was measured

| What | Result |
|---|---|
| `git rev-parse --is-shallow-repository` | `true`; `git fetch --unshallow`, then `false` |
| `main` | `7b6ce6ac` (#667), two merges past the survey's `d401ec4d`: the commit hook (#667) and CI green (#666). 16 files, none in the editors |
| Restored tips | `claude/project-thread-9gzvdb` `47391563` (= `refs/pull/567/head`), `-dbrboz` `3c2c37f5`, `-77gue8` `cc10fdfd`: as the plan says |
| Trial merges on `7b6ce6ac` (`merge.renameLimit 20000`, aborted) | v2 tip **51 files, 63 hunks**; web tip **76, 113**; sync tip **85, 130**: the survey's figures |
| The v2 tip on top of `claude/editor-journeys-green` (`dc1b2e96`) | 54: adds `harness/new-game.ts`, `harness/run-editor.ts`, `turbo.json` |
| The v2 tip on top of `claude/pixi-3d-public` (`dc719877`, behind `main`) | 52: adds `create-game/template-3d.ts` |
| The v2 tip on top of Task 1's three picks (conflicts taken as the pick's) | 56: adds `SuiteTopBar.svelte` (UD), `suite-session.ts`, `suite-ports.ts`, `FieldEditor.svelte`, `FieldRow.svelte`, `editor-list/write-path.ts` |
| `git cherry-pick --no-commit` of `bd43773f`, `a6574d64`, `bb233f40` on `main` | 8, 0, 4 conflicting files: the survey's 12; 52 files, +2,667 −526 |
| Files changed on both sides since the v2 merge-base (`30667aa3`) | 110 (51 conflict, 59 merge by themselves) |
| `main`-only commits that touch the 51 conflicted files | 23 (listed under A6); the plan's K-list named 9 |
| Relative imports in the merged tree that point at nothing (a script over every `.ts` and `.svelte`, conflicts excluded) | 3 real v2 files, 5 imports: `levels-2d-header.ts`, `levels-2d-home-names.ts`, `level-picker-model.ts` (`main` moved `edit-history` to `shared/level-2d/editor/` and `profiles` to `shared/level-2d/profiles/`); the rest were template strings and test fixtures |
| `pnpm install --frozen-lockfile` on the v2 tip (scratch worktree) | exit 0 |
| `pnpm check` on the v2 tip | lint, typecheck (51 of 51), boundaries, style, source-names, knip pass; the unit tests and `check:changesets`: see "Not finished" |
| `suite-header.test.ts` on the v2 tip, Chromium, layout project | 34 of 36 pass; the two failures are iPad Pro 11 portrait with a mouse and with touch, `Error: no Not checked yet`, as the survey says |

Not run: WebKit, Firefox, the GPU runner, any journey (Playwright) on the v2 tip, `pnpm build` and the reports, a real
phone. The container has Chromium only; the journeys were left out for time (see "Not finished").

## Findings

Severity: **blocking** (a session following the plan would stop, fail, or do the wrong thing without knowing),
**should fix** (it would have to guess, or a stated fact is wrong), **tidy**. Each says whether it is fixed in the plan
or needs the coordinator.

### A1, blocking: the commit hook refuses Task 2's merge commit before Step 6. Fixed in plan.

Checked: `lefthook.yml` on `main` (`4be1afc9`, #667, merged today): `1_biome` runs `biome check` on the staged files and
`2_affected-unit-tests` runs the unit tests of every package that owns a staged file. A merge commit stages every file
the merge brought in (about 530), so the hook runs the unit suites of the editor, editors, editor-3d, tools, content,
cutscenes, narrative, automata and the site. The plan's Step 5 commits the merge and Step 6 fixes "what the merge broke"
after; at Step 5 the moved-import breakages (A6's table, the 5 imports above) fail those suites at import, so the commit
is refused, and `--no-verify` is forbidden.
**Changed:** Task 2 is reordered: resolve, `pnpm install`, fix imports until `pnpm typecheck` and the three editor unit
suites pass, **then** commit the merge (one commit, with the fixes inside it; the log names each fix). Checkpoints are
by folder inside the uncommitted merge (`git rerere` on so a restart replays the resolutions), with a stated order and a
count after each. If the session must stop before the commit, it writes `git diff --cached` and the open list to the log
and the next session starts over with `rerere`'s help, not from a half-merge.

### A2, blocking: the two 3D cutscene stages are different APIs with the same name. Fixed in plan.

Checked: both sides added `extensions/cutscenes/src/features/stage-3d/cutscene-stage-3d.ts` and the
`@automata/cutscenes/stage-3d` entry. `main`'s (`dcef7e11`, 2026-11-11) is `cutsceneStage3d({ camera, pieces, actor,
fade, sound?, restore? }): CutsceneStage3d` with `start/draw/end`. v2's (`4e396803`, #534's C1 `2ca3eae9`) is
`cutsceneStage3d({ scripts, show, tickHz? }): PixiStageHooks` and `showScene3d({ camera, pieces, lamps })`. v2's users:
`packages/tools/src/shared/create-game/template-3d-game.ts:70,168` (inside a template string: no typecheck sees it),
`examples/3d/cutscenes/cutscenes-door-and-lamp.ts`, v2's unit test. `main`'s users: its two tests. The plan's rule
("`main`'s file, plus #534's C1 if `main`'s lacks it: its unit test from `pr/567` decides") keeps `main`'s file, so a new
3D game's generated `src/app/game.ts` imports `showScene3d` from a module that does not export it. Nothing fails until
`new-game-checks` or `complete-game-3d` runs (Task 4).
**Changed:** the rule keeps `main`'s `cutsceneStage3d` under its name; v2's two functions move to
`features/stage-3d/stage-hooks-3d.ts` as `cutsceneHooks3d` (options `CutsceneHooks3dOptions`) and `showScene3d`
(`SceneTarget`), both exported from the entry; the template, the example and v2's test are renamed to match, and v2's
test moves to `tests/unit/stage-3d/stage-hooks-3d.test.ts`. Check: `pnpm --filter @automata/tools exec vitest run
tests/unit/shared/create-game` and `git grep -n "cutsceneStage3d(" -- packages/tools/src` prints nothing.

### A3, blocking: Task 1's B1 paths leave out what B1 imports. Fixed in plan.

Checked: `git show --stat 322c578d` (#564's fix commit; B1 is one part of it). The drafts keyed by place need
`packages/editor/src/shared/kit/widgets/field-position.ts` (new) with its test, the `draftKey` function form in
`typed-save.ts` and its test, `draftView` in `kit/ports/suite-editor.ts`, the `typing-drafts.ts` change and its test,
and the wiring in `Suite.svelte`. The plan's list names `typing-drafts.ts`, `suite-editor.ts`, `kit-typing.ts`, the two
fields and the five `*-suite-editor.ts`, and not the rest; the `git apply --3way` of that list leaves imports of a file
that is not there. The same commit holds sync (`kit/sync/*`, `web-games/*`, `holdWhile`, `retry` in `main.ts`), which
must stay out.
**Changed:** Step 4 lists B1's files exactly (the 15 above and the journey pair), and names what of `Suite.svelte`
and `main.ts` is B1 (the `draftView` lines) and what is sync (`holdWhile`, `retry`: not taken).

### A4, blocking: Task 1 takes the saved line onto `main`'s top bar without its phone fix. Fixed in plan.

Checked: `4c855dfa4` ("the saved line gives way to the top bar's tools on a short bar"), between the picks and #544's
audit, body: "The line kept its full width at every size, and in the 3D studio on a phone it pushed the Dock off the
screen (editor-3d's studio layout test, and the editor's suite-edit and suite-levels, failed from the first push)." It
is not in the plan's three picks. #564's B5 (the saved line under the top bar on a phone, Redo on screen:
`SuiteTopBar.svelte`, `shell-regions.css`, `EditorShell.svelte`, `suite-layout.ts`, the layout test
`suite-save-line.test.ts`) is in `322c578d` and not in the B1 list either.
**Changed:** Step 3 picks `4c855dfa4` fourth; Step 4 takes B5's files with B1; a new step runs the three layout suites
in Chromium (the editor's `layout` and `storage`, the editors', the 3D editor's) with a mouse and with touch.

### A5, should fix: Task 1 and Task 2 meet in different files than the plan names. Fixed in plan.

Checked: the v2 tip merged onto `main` plus the three picks: the new conflicts are `SuiteTopBar.svelte` (v2 deletes it),
`suite-session.ts`, `suite-ports.ts`, `FieldEditor.svelte`, `FieldRow.svelte` and `editor-list/write-path.ts`;
`shell-regions.css` does not conflict (B5 adds to it later); `Suite.svelte` and `open-suite-ports.ts` already conflict.
**Changed:** the list in Task 2's header, with a rule each: the saved line's markup and words move into
`SaveState.svelte`; the typed-save wiring is kept inside v2's fields; `SuiteTopBar.svelte` stays deleted.

### A6, should fix: "Kept from `main`" missed 14 of the 23 `main` commits that meet v2 in the conflicted files, and K6's check is a deleted test. Fixed in plan.

Checked: `git log --no-merges <v2 tip>..origin/main -- <each conflicted file>`, each commit tested with
`git merge-base --is-ancestor`. Not on the list: `dcef7e11` (a camera key at an anchor; `main`'s 3D stage),
`2f42eb75` (the HUD's inventory, examine box and keypad, in `DialogueBox.svelte`), `3aef5854` and `11ce6dd9` (a new game
has button sounds, six languages, a font, and its check cuts its fonts first: four `create-game` files), `f68d822e`
(every control sounds by default: the settings screen), `156126ae` and `551a11f2` (a built game ships the font licence;
the content entries load under plain Node, which is why `main` writes `.ts` on every relative import in
`automata-content.ts`), `f863ad00` (the doc comments the API index needs: settings copy, `controls.schema.ts`,
`picture-of.ts`), `1c17124c` (the survey has it; the plan dropped it), `9d3df71d`, `0aad7f3c` and `372fdc3f` (the
layout moves and the trunk's gates), `0d359357`, `dd5e651a`. K6's check runs
`tests/unit/suite/shell/Suite-ship.test.ts`, which `main` deleted with the change-set desk (`a15c7b36`): "No test files
found".
**Changed:** K6 checks the code (`createToasts({ clock })` in `Suite.svelte`, `clock: env.clock` in `boot.ts`); K11 to
K16 added with real checks; the "survives by itself" rule for the 59 cleanly merged files is written down (git keeps
`main`'s side; `pnpm check` and K10 are the proof; none is decided by hand).

### A7, should fix: three of the plan's group rules are wrong for what actually conflicts. Fixed in plan.

Checked: each hunk (`awk` over the markers in the scratch merge).
- **`site/src/app.css`**: "`main`'s, plus v2's two added lines" would add `color-scheme: light` to a site that is dark.
  v2's two lines (`color-scheme: light` and its comment) answered its own kit tokens turning Dark; `main`'s site is
  dark since Home v2 (`site/src/shared/styles/tokens.css:11`, `color-scheme: dark`) and `app.css` is now only imports.
  Rule: `main`'s whole, v2's lines not taken.
- **Writer**: the four Writer conflicts are one import line each: `humanize` from `shared/humanize.ts` (`main`) or
  `shared/id-words.ts` (v2's own copy of the same refactor). The markup merged by itself. Rule: `main`'s import, v2's
  added `gameHasPlayer` import kept, `shared/id-words.ts` deleted once nothing imports it (knip would find it). The same
  for the two Sequence files and `audio-play.ts` (both sides moved `AudioPlay` to `shared/`).
- **`DialogueBox.svelte`** is the game's box, not an editor: "v2's rows and fields" does not apply. `main` drew it with
  `LineBox` and a typed-out reveal (K1) and added the HUD (`2f42eb75`); v2 added one guard (a number pressed while a
  menu on top has the keyboard is the menu's). Rule: `main`'s markup and reveal; v2's guard added inside `main`'s key
  handler (`reveal.done` kept). `dialogue-box.ts`: `main`'s speaker line. The two differ on purpose: v2 shows no name when the game gives none;
  `main` (later) reads the id aloud (`spoken`: `nurse-jo` as "Nurse jo") and keeps `lineId` and `delivery`, which K1's
  tests need.
- **Sequence** is two builds of one feature: `main`'s `b302f205` (2026-11-11, portals, doors in two pieces, the Last
  Light's prologue uses it) and v2's `186abf44` (2026-11-08). Rule: `main`'s `plan-view.ts` and `sequence-names.ts`;
  v2's `plan-view.test.ts` and `sequence-editor.test.ts` cases that assert the older walls are changed to `main`'s, and
  each change is a log line; `SequencePreview.svelte` takes v2's layout with `main`'s "Show over" select inside it.

### A8, should fix: Task 4's harness merge is not spelled out. Fixed in plan.

Checked: `git diff origin/main...origin/claude/editor-journeys-green` (`dc1b2e96`, 18 files) against v2's own diff.
Shared files: `harness/new-game.ts`, `harness/run-editor.ts` and `turbo.json` conflict; `game-runner.ts` and its test
and four journeys (`animation-plays-in-game`, `paint-shows-in-game`, `story-in-play`, `whole-game-loop`) merge by
themselves. `turbo.json`: the branch adds `@automata/editor-3d#build` to `@automata/editor#test:e2e`'s `dependsOn`; v2
adds `@automata/editors#build`; the answer is both. `run-editor.ts`: the branch's whole opening (`Press Ctrl+C to stop.`,
`playOff`, the Play-off failure) wins; v2's helpers are added beside it. The plan said "re-apply v2's `openRoom` and
`chooseView`": those are in `new-game.ts` and the journeys, and the rule now says where.
**Changed:** Task 4 Step 1 names the three files and the rule for each, and the case where the branch lands **before**
Task 2 starts (then Task 2 resolves the same three by the same rules).

### A9, should fix: the 3D lane's Part C, on its own branch, still says what this plan says it will not. Needs the coordinator.

Checked: `claude/ship-3d-plan` `c9c2b990`, Part C. It starts "after B10 and after `claude/editor-journeys-green`", not
after this plan's Task 6 (the coordinator's ruling 1). C1 copies `<editor3dDist>/suite` (built by
`packages/editor-3d`) to `pages/suite-full`, with the message "Build it first: pnpm --filter @automata/editor-3d build";
after Task 2 the page with every editor is `extensions/editors/dist/suite` (the v2 tip's `editor-command.ts:59` already
maps `'suite-full'` there, and the merge keeps it). C3 Step 3 changes the site's words to the 2D suite that is served,
where this plan's Task 7 serves every editor. This plan's "What Part C can rely on" is right; Part C's text is not yet.
**For the coordinator:** Part C's dependency line, C1's source folder and message, and C3 Step 3 (drop it) change on
`claude/ship-3d-plan`; this plan cannot edit that branch.

### A10, should fix: the paid-app re-audit's B1 and "do not revive #544". Correction noted; needs its owner.

Checked: `claude/paid-app-plan-reaudit` `b2926835`, `docs/superpowers/audits/2026-11-12-paid-app-plan-reaudit.md`
lines 68 to 80 and 165 to 182. B1 says the base branches "are deleted"; they are restored (the coordinator, 2026-11-12)
and v2 reaches `main` through this plan's Tasks 2 to 4. F6's "882 conflicting files" is a shallow clone's count: the
sync tip conflicts in 85 on full history (130 hunks), and in 12 against the v2 tip. Its recommendation 3 (phase 1 as its
own small pull request) is this plan's Task 1.
**Changed here:** the plan's "For the coordinator" carries the correction in these words. Not edited on that branch.

### A11, should fix: two facts in the survey are out of date. Fixed in survey.

"`claude/ship-3d-plan`, `claude/editor-journeys-green` and `claude/scope-rename` are not on `origin`": the first two are
now (`c9c2b990`, `dc1b2e96`); `claude/scope-rename` still is not. The K-list's source table (section 4) gains the
commits of A6. A dated addendum says so; the measured text above it is left as it was.

### A12, should fix: Task 3's header fix is the right one, and needs a second case. Fixed in plan.

Checked: `ProblemCount.svelte`'s own comment on the v2 tip ("With no number to keep (no problems, checking, not checked
yet) there is nothing to show then"), #567's F5 and the failure. The code does what #567 meant; the test, written
before F5, still looks for the count at 834 px. The plan's change is right. It leaves untested the case F5 must not
break: a count **with** a number under 900 px. **Changed:** Step 1 adds it (a fixture with one problem: "1" whole at
834 px, its accessible name the words).

### A13, should fix: the ordering with the scope rename is said twice, differently. Fixed in plan.

The Global Constraints say "if the rename is ready first, it waits for Task 4 or Task 2 has not started"; the
coordinator's ruling 2 is: Tasks 2 to 4 merge before the rename; a branch that must cross it merges the rename's
parent, runs the same codemod, then merges the rename. The plan now says only the ruling's words.
`claude/scope-rename` is not on `origin`, so nothing was measured against it.

### A14, tidy: sizes and the critical path. Fixed in plan.

Task 2 is the edge of one session even with the table (51 files, 23 by a one-line rule, 6 by a careful one: Suite,
Home, the stage, Sequence, `create-game`'s `template-game.ts` and `template-level.ts`). The tracking table now allows
two sessions for it and names the critical path: Task 2, 3, 4 (draft PR), the Owner's merge, 6, 7. Task 5 runs beside
Task 4. Task 1 runs beside Task 2 and merges first if it can (its meeting is then Task 2's, by the rules in A5).

### A15, tidy: commands whose path or count was not checked. Fixed in plan.

Every path the plan names was checked with `git cat-file -e` on `main` and on the v2 tip. All exist where the plan
says except: K6's test (A6); `site/src/shared/editor-link.ts` and `site/scripts/write-headers.ts` exist on `main` only
(right: Task 7 is on `main`'s site); `packages/editor/tests/slow/` exists on neither (Task 5 creates it: the plan now
says "create"). The Step 1 count of `suite-header.test.ts` (36) is measured. K1's `narrative` and `cutscenes` commands
lack `--project unit`; harmless (the files are unit files), now added for the same output every time.

## The responsive rules and the Owner's sheet (brief item 6)

- **Tasks 3 and 4 as tests:** phone first (Task 4's journeys run at 390 x 844 before iPad); 44 and 48 px from
  `editorTargets()` (Task 3 Step 2, never written as numbers); focus through rotation and compact height (Task 3
  Step 2 at 844 x 390, Task 4's `rotation-keeps-the-field`); the on-screen keyboard: **missing**, now added to Task 4
  Step 2 (a `visualViewport` of 390 x 500 with the field focused: the field stays in view and Play and Publish stay
  reachable, which is what the stack's own keyboard tests used); scroll regions (K4, and Task 3's `noPageScroll()`
  already in `suite-header.test.ts`); DOM, real-browser and journey proof (unit, layout, journeys in that order).
- **The drunk-grandma test on v2's copy:** not in any task. Added to Task 5 Step 3: each screen's words are read once
  with that question, and anything that fails it goes under "For the Owner", not fixed there.
- **The sheet:** the screens, sizes and states the plan lists are complete for the editors; before and after come from
  real captures (`main` at the commit the branch merged, not a fixed `d401ec4d`: fixed in plan); nothing but the two
  site pictures waits on it. Task 5's `tests/slow/` is outside every gate, as it should be.

## Not finished

- `pnpm check` on the v2 tip reached the unit tests; its final exit is in the log line of this audit's commit if it
  came in time, otherwise it is pending. The survey's own runs of the three editor unit suites (all pass) stand.
- The editors' journeys on the v2 tip in Chromium were not run (time). #562 and #567 report them green; Task 4 runs
  them on the merged tree, which is what counts.
- `claude/scope-rename` is not on `origin`; nothing was measured against it.
