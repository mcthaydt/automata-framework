# The builders' look and figures in the framework: plan audit

**Date:** 2026-11-11. **Stage:** 3 (plan audit) of workstream 4. **Tracker:** [`../progress.md`](../progress.md).
**Audited:** [the plan](../plans/2026-11-11-builders-look.md) and [the survey](2026-11-11-builders-look-survey.md) as
merged at `main` `b80bfc84` (#636), against [the spec](../specs/2026-11-11-builders-look-and-figures-design.md),
`AGENTS.md`, the tracker's decisions list and editor gaps ledger, workstream 2's
[spec](../specs/2026-11-11-last-light-on-the-framework-design.md) ("Where a new piece goes") and
[plan](../plans/2026-11-11-last-light-prologue.md) (tasks 9b and 13), workstream 1's build branch
`claude/shared-polish-build` at `29ccea7f`, [`../../refactor/eb-look/gap.md`](../../refactor/eb-look/gap.md) and
[`../../refactor/2026-11-07-3d-scope-trim.md`](../../refactor/2026-11-07-3d-scope-trim.md), the code on `main`, and the
drafts at the heads the plan names: #589 `claude/eb-look-glow` `0024f81a`, #590 `claude/eb-look-effects` `22b63b54`,
#607 `claude/c8-lit` `7167af1f`, #588 `claude/tll-extensions-1` `8e348d9a`, #603 `claude/c8-lit-spec` `70cc66c4` (none
has moved). FigureBuilder (read only) at the framework's pin `d6e3c9f`, its `main` `23f889c` and #29's head `856498a`;
EnvironmentBuilder (read only) at `main` `f7c5356`, the commit the survey shot.

## What was run

Everything here was run in this session on a 4-core container, headless Chromium on software WebGL. Nothing was pushed
from a scratch branch, and nothing was committed inside FigureBuilder or EnvironmentBuilder.

| What | Where | Result |
|---|---|---|
| `pnpm install --frozen-lockfile`, the submodule at its pin | `main` `b80bfc84` | Clean |
| The survey's `shoot.mjs`, all 12 scene sheets and the figure sheets | `main` | Every number within 0.1 of `shots.json` (the survey's table holds) |
| The same | the trial: `main` + #589 merged + `680bbc31a` cherry-picked (no conflict) | See "The measures, again" below |
| The plan's `lit-room.test.ts`, as written, Chromium | `main`; `main` + #589; the trial | Fails on `main` (`saw 13, 13, 13`; brightness 6.2) and on `main` + #589 (13; 6.9); passes on the trial (64, 64, 64; 42.1). **It does not typecheck** (finding 1) |
| The same test with finding 1's fix | the trial | Passes; `tsc -p packages/3d` and `biome lint` clean |
| The merge order: `main`, then #589 with the fix, then #607, then #590 | scratch branches, never pushed | #589 and the fix: no conflict. #607: no conflict. #590: one conflict, `spikes/eb-look/probe.mjs` (add/add), taken as the branch's, as task 10 said; none at all when `dd8d72bb` is picked with the fix (finding 5) |
| `pnpm check`, each step alone, on each state of the order | the three states | See "The merge order, step by step" below |
| `pnpm knip` | `main` `b80bfc84` | **Exit 1**: `docs/superpowers/audits/builders-look-survey/shoot.mjs` is an unused file (finding 2) |
| `git merge-tree` of the whole order with `claude/shared-polish-build` | | Exit 0: no conflict; the shared files are `pnpm-lock.yaml` and `agents/automata/skills/automata-api/reference/api.md` |
| Reverting the letterbox's two commits on the whole order | a scratch worktree | Conflicts in `examples/3d/retrocrisp/retrocrisp-grade.ts` and `spikes/tll-extensions/shoot.mjs` (finding 13) |
| `readLevel` and `buildWorld` on `world-level-room`'s room, as it is and with `floor: 0, light: 1` | the trial, a throwaway unit test | As it is: 2 problems, 0 pieces, `buildWorld` says nothing; repaired: 0 problems, 6 pieces |

Not run: WebGPU, WebKit, Firefox, a real GPU; the 3D browser suites and the examples' journeys whole (only the plan's
new browser test was run); `pnpm build`, `api-report`, `api-index`; the builders' own renders (their committed frames
were used, as the plan intends).

## The measures, again

The survey's `shoot.mjs` on `main` and on the trial (`main` + #589 + `680bbc31a`), mesh figures, the builders' frames
committed in `builders-look-survey/builders/`. The baked panel's mean brightness over the builder's frame, the plan's
measure for light (band 0.80 to 1.20):

| Sheet | Builder | `main`, baked | ratio | trial, baked | ratio | In the band |
|---|---|---|---|---|---|---|
| base-interior, diorama | 50.8 | 15.7 | 0.31 | 44.4 | 0.87 | yes |
| base-interior, first person | 47.8 | 22.1 | 0.46 | 48.6 | 1.02 | yes |
| base-interior-dressed, diorama | 50.7 | 22.2 | 0.44 | 43.1 | 0.85 | yes |
| base-interior-dressed, first person | 48.2 | 24.1 | 0.50 | 47.2 | 0.98 | yes |
| base-exterior, diorama | 123.2 | 35.4 | 0.29 | 90.0 | 0.73 | **no** |
| base-exterior, first person | 129.3 | 92.1 | 0.71 | 114.8 | 0.89 | yes |
| base-exterior-dressed, diorama | 121.5 | 36.4 | 0.30 | 89.2 | 0.73 | **no** |
| base-exterior-dressed, first person | 128.6 | 91.9 | 0.71 | 114.3 | 0.89 | yes |

`main`'s numbers equal the survey's within 0.1 (its own run-to-run spread, finding 20); the trial's equal the plan's
expectations within 0.1 (44.3, 48.5, 43.1, 47.3 and 90.0). So the plan's claims hold: the fix brings every interior sheet
into the band, and the two street dioramas stay at 0.73, a real gap with a diagnosis (finding 4). The plan did not say
that the two first-person street sheets pass (0.89); it does now. Looked at: the trial's interior diorama shows the
pendant at its own glowing step and its pool on the tiled floor; the street diorama shows the pair as black
silhouettes, the letterbox's bars top and bottom, and the pavement and road a step darker than the builder's. The
gameplay sheets have no builder panel; on the trial they read 44.8 (interior), 43.4 (dressed), 88.4 (street).

## The merge order, step by step

Built on scratch branches from `main` `b80bfc84` in the order the plan claims: (1) `git merge --no-ff` #589, then
`git cherry-pick -x 680bbc31a` (no conflict, 8 files, the ones task 2 lists); (2) `git merge --no-ff` #607 (no
conflict; the submodule moves to `23f889c`); (3) `git merge --no-ff` #590 (one conflict, `spikes/eb-look/probe.mjs`,
add/add, resolved as the branch's). Each step of `pnpm check` was run alone on each state (`turbo run test:unit
--continue` for the unit tests), so a later step could not hide behind an earlier failure. A cell is the exit code.

| Step | (1) `main` + #589 + the fix | (2) + #607 | (3) + #590 |
|---|---|---|---|
| `lint` | 0 | 0 | 0 |
| `typecheck` | 0 | 0 | 0 |
| `boundaries` | 0 | 0 | 0 |
| `style` | 0 | 0 | 0 |
| `source-names` | 0 | 0 | 0 |
| `knip` | **1**: `main`'s shoot script | **1**: the same | **1**: the same |
| unit tests, every package | **1**: 60 of 61; `@automata/repo-hygiene`'s hard-coded-ports test, on `spikes/eb-look/probe.mjs` (finding 5) | **1**: 60 of 61, the same | 0: 64 of 64 (#590 brings `dd8d72bb` and three extension packages), 12 min 40 s |
| `check:changesets` | 0 | 0 | 0 |

`knip`'s one failure is `main`'s own (finding 2), the same in every state and gone on this branch. The unit tests fail
in states (1) and (2) on the probe the fix's cherry-pick brings, and pass in (3), where #590 brings the probe's own
repair: with `dd8d72bb` picked beside `680bbc31a` (finding 5), `@automata/repo-hygiene` passes in state (2) (162 of 162,
measured) and #590 merges with no conflict. So the claimed order holds once task 2 picks both commits: each draft lands
on the one before it with `pnpm check` green but for `main`'s own fault. Not run on these states: the browser suites and journeys, `pnpm build`, `api-report`, `api-index` (task 10's
step 4 runs the last three; #590 brings its reports).

## Findings

Ranked: **blocking** (the plan as written fails its own gates or would make a builder change product code on a false
premise), **should fix** (a gap or a wrong fact a builder would hit), **tidy**. Each is fixed in the plan or the survey in
this branch unless it says **open**, with the reason and where it went. **28 findings: 5 blocking, 15 should fix, 8
tidy.** All 28 are fixed in the plan or the survey; five parts of them are open with the coordinator (listed at the end).
`main` was fetched again at the end of the audit and was still `b80bfc84`; the spec and the tracker's decisions had not
changed.

### Blocking

**1. Task 2's browser test does not typecheck.** It calls `renderer.draw(still, frame)` twice; `Pixi3dRenderer.draw`
takes the frame alone, so `tsc -p packages/3d` fails with TS2554 at the test's lines 66 and 94, and `still` is unused.
Vitest does not typecheck, which is why the planning session saw it pass; task 2's step 5 (`pnpm check`) would fail.
Measured with the call as written and as fixed: the same pixels either way (13, 13, 13 and 6.2 on `main`; 64, 64, 64
and 42.1 on the trial). **Fix:** the test calls `renderer.draw(frame)` and drops `still`; the plan records both
measurements. **Fixed.**

**2. `main` fails `pnpm check` at `knip`, on the survey's own script.** `pnpm knip` on `main` `b80bfc84`: "Unused
files (1): docs/superpowers/audits/builders-look-survey/shoot.mjs", exit 1; the same on every state of the merge
order. #636 committed the script; the plan session re-ran `style` and `source-names` with the documents in, not
`knip`. The plan's task 7 said "the script under `docs/` is linted", and every task's baseline would have started red.
**Fix:** the script moves to `spikes/builders-look/shoot.mjs` (knip and biome ignore `spikes/**`, as `knip.jsonc` and
`biome.json` say), with its repository path and its defaults (the survey's folder and its `builders/`) adjusted;
the plan's commands and the survey's link follow it. Re-run: `knip` exit 0, `style` 0 findings. A `knip.jsonc` ignore
was the other way, but it is configuration and this stage changes documents. **Fixed** on this branch; `main` stays
red until it merges (told to the coordinator at once).

**3. Task 12's switch test rests on a false premise and tells the builder to change code to fit it.** It said that
with `DEFAULT_LOOK` "the pass list holds no outline and no grade pass" and "if a pass joins while its switch is off,
the test fails: fix the registration, not the test". But `grade` is a switch that is on by default
(`packages/3d/src/features/look/library/look.json`, `"grade": true` on `main` and on #590), and #590's
`createLookPasses` adds a `GradeEffect` whenever it is on (`look-pass.ts`, the grade changes nothing until a mood is
named). In the world kit, `stars` and `glow` are on unless told `false` (`sky-passes.ts`, `skyLookPasses`). The test as
written fails on correct code. And the branch already has `look-pass-list.test.ts`, which proves the order with every
pass. **Fix:** the step lists the switches as they are, adds to the existing test only what it lacks (the default list
exactly, each switch adding or removing exactly its pass, and a frame with the grade on and no mood equal to one with
it off), and the world kit's cases name its two default passes. **Fixed.**

**4. The street's remaining gap (0.73 of the builder's) had a diagnosis with no reachable reference and too few
stops.** Task 5 asked to compare `bakeVertices` with "the per-vertex light EnvironmentBuilder's `docs/lighting.md`
states for the same surfaces by day". That file states the formula (its lines 15 to 22), not numbers: the numbers
live in its `look.json`, `times.json` and `paint/vertex-light.ts`, and the plan's constraints said no task needs the
builders' repositories. Read side by side here, AF's bake and EnvironmentBuilder's are the same formula term for term
(the key `[0.3, 0.8, 0.5]` at 0.09, the fill's fade `[1.5, 4, 0.25]`, the lamp strength 2.6, the cap 1.6, the step
0.1, the sun from the time's key turned out of the camera's pitch), so the plan's first branch ("the profile is
wrong") is the least likely and its second ended in "stop" with no steps. There was no time box, nothing about a fix
that moves the interiors or an existing test's expectation, and nothing about what group 1's pull request does if
the street stays out of the band. **Fix:** task 5's bullet is now four stages in `dark-interior.md`'s method
(figures and the letterbox's bars out, both of which are in the AF panel only: the trial's street sheet shows the
pair as black silhouettes and the bars top and bottom; the bake against EnvironmentBuilder's `vertexLight` per vertex; the screen against the bake; the
composition), each with what to do on each outcome, and stops (two hours; an interior leaving the band; any existing
expectation moving unnamed; no constant changed to reach a ratio); at a stop the draft pull request opens with the
street's row open and merges on the coordinator's word. EnvironmentBuilder is named in the constraints (finding 18).
**Fixed.**

**5. Task 2's cherry-pick would turn the unit tests red until group 3.** `680bbc31a` adds `spikes/eb-look/probe.mjs`,
which picks its port as `5000 + Math.floor(Math.random() * 3000)`. #589 brings #604's rule that nothing in the
repository starts a server on a port of its own (`tooling/repo-hygiene/tests/unit/hard-coded-ports.test.ts`), and it
fails on that line: measured on state (2) of the merge order, `@automata/repo-hygiene` 1 failed of 162, so `pnpm check`
fails from task 2 through task 9 (state (1): the same failure, 60 of 61). #590 fixes the probe later, in
`dd8d72bb` ("the probe takes a free port, as the shoot does"), which the plan did not bring forward. **Fix:** task 2
cherry-picks `680bbc31a` and then `dd8d72bb`. Measured: it applies with no conflict; `@automata/repo-hygiene` then
passes (162 of 162); and #590 then merges with no conflict at all, since the probe is already the branch's (task 10's
expected conflict goes; finding 7). **Fixed.**

### Should fix

**6. Task 3's repair cannot fit the example's line budget as described.** `examples/3d/world/world-level-room.ts` has
100 code lines (counted with the catalog's own rule), and the budget is 100 (`CODE_LINE_BUDGET`,
`tooling/examples-runner/src/catalog.ts:40`), held in `pnpm check` by `catalog.test.ts` ("the real 3d examples pass the
catalog"). The repair adds at least four (two sector fields, the read, the throw). The plan said "keep the file under
its line budget" without the number. **Fix:** the step states the count, the budget, the test, and that the repair
gives back what it adds. **Fixed.** (Its premise holds: with `floor: 0, light: 1` the room reads with 0 problems and
builds 6 pieces; as it is, 2 problems and 0 pieces, measured.)

**7. Task 10 expects one conflict; task 7 adds a second.** Merging #590 on `main` + #589 + the fix + #607 conflicts in
`spikes/eb-look/probe.mjs` alone (measured), and in nothing once task 2 also picks `dd8d72bb` (finding 5, measured). But task 7, which lands first, adds `?figures=painted` to
`spikes/eb-look/scene.ts`, and #590 changes that file by 38 lines beyond #589 (`git diff --stat`), and the plan said
any other conflict is a stop. **Fix:** the step expects it and says how to resolve it (keep every switch of both) and
to load the page with `?figures=painted&fx=0` before going on. **Fixed.**

**8. Task 15's interface does not match the plan it defers to.** It gave `PaintedState.mood?: string` "one of the
builder's drawn moods" and called them "afraid, worried, firm". FigureBuilder #29's plan, task A4, which this plan
names as the step text, produces `PaintedState.expression?: Expression` (the drawn face, from `EXPRESSIONS`) and
`PaintedState.mood?: readonly string[]` (the tags such as `lookL`); its F8 names are `fear`, `sad`, `worried`, `firm`.
A builder following both would write two different fields. **Fix:** task 15 takes A4's interface and names; task 13
names F8's. **Fixed.**

**9. The other plan's changeset is not allowed here.** #29's plan, A3 step 6, adds a `patch` changeset for
`@automata/character-kit`; that package is private (`"private": true`), and `AGENTS.md` gives changesets to published
packages only. **Fix:** task 15 says no changeset, and why. **Fixed.**

**10. Task 13 would stop on an expected re-record, and left two parts of #29's plan unplaced.** #29's F8 replaces the
`face/fear` and `face/sad` pins that its own F0 made on the same branch (they pinned faces that drew as neutral); the
plan said "no existing golden moves; if one does, stop". #29's Checkpoint B (the coordinator's word before F9's pull
request) and its Part 3 (Ada and the Nurse in FigureBuilder's showcase) were not mentioned. **Fix:** the two pins are
named as expected (nothing on FigureBuilder's `main` moves); Checkpoint B is in, cut to the faces sheet; Part 3 is out,
since Ada and the night figure are the game's, dressed by workstream 2's task 13. **Fixed.**

**11. Task 11's file list reaches into the archive, names a note that does not exist, and drops behaviour without
handing it over.** `git grep -l room-visibility` on #590 lists `docs/archive/` plans and specs (history, and about the
old game's policy), `docs/refactor/progress.md` (the record) and `docs/provenance/sources.md` (a row whose target is
the extension, read by `sources-md --complete`). There is no "room-visibility note": `docs/refactor/tll-extensions/
README.md` covers all three extensions. And the extension (a port of the old game's `src/render/room-visibility.ts`)
does more than 9b's "rooms a view draws": the player's own room always drawn, the zone just left held 0.35 s under the
camera's blend, a peek's far side, every room in a cutscene, and wall cutaway groups by zone (`hideFrom`). Workstream
2's survey drops `hideFrom` on purpose (its row 1); the other four are in none of its tasks. **Fix:** task 11 names the
files to change and to leave, adds the line to the README, and gains a step 1b that sends the coordinator the four
behaviours for workstream 2's task 9b, landing none here. **Fixed** in the plan; the four behaviours are **open** for
workstream 2 (sent to the coordinator).

**12. The homes table's reason for `lcd-panel` and `retro-crisp` was wrong, and the prologue's use of them is
unplanned.** It said "no game needs them". `docs/refactor/tll-extensions/README.md` on #590 says all three of #588's
extensions are "the render features the adventure source's clinic needs", ported from The Last Light's own
`src/render/lcd-panel.ts`, `retro-filter.ts` and `crisp.ts` at `92e6704`; `retro-crisp`'s default profile is
`CRISP_CLINIC`. Their home is still an extension (ready-made looks any pixel-art game could use; nothing under
`packages/` imports either on the branch), so the ruling stands; the reason changes. Workstream 2's plan and survey
never mention an LCD, a retro grade or crisp scaling, so whether the remade prologue wears its old look's last passes
is planned nowhere. **Fix:** the reason in the homes table. **Fixed;** the question is **open** for workstream 2 (sent
to the coordinator).

**13. Call 11's other answer, "revert its two commits", is not two commits and does not apply cleanly.** Reverting
`bdf4b6d0e` and `3565abc8f` on the whole merge order (scratch worktree) conflicts in
`examples/3d/retrocrisp/retrocrisp-grade.ts` and `spikes/tll-extensions/shoot.mjs`, and the docs commit `1e01ca1e`
("the whole-pixel hook, the crisp screenshots") would be left describing a removed option. The ruling itself is below
("The two calls left to this audit"): keep. **Fix:** the homes table and call 11 record the ruling and what a revert
would take. **Fixed;** the ruling goes to the coordinator for the Owner.

**14. Task 11 framed room-visibility as "the coordinator's call, open to the Owner"; the Owner has ruled it, and the
same ruling names all of #588.** The tracker's decisions list: "The clinic work already begun in the framework (#575,
#596, #606, #588) is superseded by workstream 2." That settles room-visibility. Read literally it also covers
`lcd-panel`, `retro-crisp` and the two core seams, which are #588's too, while the spec's call 1 gives #588 to this
workstream "to finish or close" and workstream 2's plan says "what of it reaches `main` is the framework's to use".
**Fix:** task 11, the homes table and call 3 cite the decision. **Fixed;** whether the decision was meant to cover
#588's other two extensions is **open** for the coordinator (the plan keeps them, as the spec's call 1 allows).

**15. Four more pull requests are settled by task 1's merge, and the plan did not say so.** The heads of #587
(`cfb61baa`), #601 (`27001792`), #602 (`eee6141e`) and #604 (`8895c7f5`) are each ancestors of #589's, #607's and
#590's heads (`git merge-base --is-ancestor`, all twelve true), so all four show as merged when task 1's merge reaches
`main`. The plan's task 17 listed five pull requests; the survey said #602 and #587 "can then be closed as carried"
and counted "seven" shared commits (there are nine; finding 27). **Fix:** task 5 checks the four and writes one line on
each; task 17 lists nine. **Fixed.**

**16. Nothing in the plan gives workstream 2 the word its dressing waits for, and workstream 2's dressing task
contradicts this one.** Workstream 2's task 13 "starts when workstream 4 says the prologue's dressing can start"; no
step here says it. **Fix:** a step after group 2's pull request sends that word (lit room and lit figures on `main`,
the street's row, the ward's outfits to follow), and task 16 says when the ward's entries land. **Fixed.** Still
**open**, for the coordinator: workstream 2's task 13 writes `content/figures/{ada,figure}.toml` (core's mesh figure
files) and picks the figures "in the Studio", which opens core's mesh figures only (the tracker's editor gaps ledger,
row 2), while this workstream's spec (goal 4) and this plan (calls 8 and 10) make Ada and the night figure painted
figures dressed from the kit's entries, written as a data file in the game.

**17. The plan named the wrong file as the overlap with workstream 2's task 9b.** It said the two branches meet in
"this plan's `app/world-view.ts`"; 9b's files do not include it. They meet in `src/features/world/build.ts` (#589 and
task 3; 9b only if rooms are not yet separate meshes) and `src/entries/index.ts` (#589, #590, 9b's `drawnRooms`), and
9b's `rooms` on a camera view is the field #589's per-room base-scene views would carry. Neither of workstream 2's
branches exists yet (`git ls-remote`). **Fix:** the branch notes name them, and add workstream 1's build branch
(finding 28's check: no conflict). **Fixed.**

**18. Two steps need EnvironmentBuilder, and the plan said none did.** Task 5's diagnosis (finding 4) and task 9's port
of `exposureSteps` (`src/features/view/expose.ts`, 68 lines, checked) both read EnvironmentBuilder's code, which is not
in the framework's session. **Fix:** the global constraints say to attach it read only at `f7c5356` for those two
steps, as this audit did. **Fixed.**

**19. The ward's new golden had no arch rule.** Task 15 records `ward-cells.json`, a first golden of painted cells.
The runway golden needed an arch override until #607 found the hair poles; #29's plan (A6, P1) nudge-tests every new
frame. **Fix:** task 15 draws the ward's cells again under `ulp.test.ts`'s nudge and fixes a moving cell in
FigureBuilder, never with a per-arch entry. **Fixed.**

**20. The albedo measure did not allow for a shoot's own spread.** The plan's measure for albedo and tiles is that the
material panels' colour counts "do not fall". Two shoots of the same `main` differ: the survey's `shots.json` and this
audit's re-shoot read 22.2 and 22.1 (interior first person, baked), 59 and 58 colours (street first person, material),
60 and 61 (dressed street first person, material). On the trial a material panel falls from 61 to 60 with no change to
the material path. A rule that cannot tell that from a regression would stop a task for nothing. **Fix:** the measure
says what one shoot varies by and that a fall of one colour is shot again before it is called a regression. This is
the measurement's own noise, not a tolerance on a mismatch. **Fixed.**

### Tidy

**21. #607 is not a draft.** GitHub shows it ready (`draft: false`); the plan and survey called all five "draft pull
requests". **Fixed** in both.

**22. Task 8's `reads` is the edge alone; `figureReads` reads the stronger of luma and edge.** Both are fair, but the
file said its numbers are `figureReads`' definitions. **Fix:** `reads.json` keeps `read` (the kit's rule) and `reads`
(the builder's exposure window, edge at least 1.1), and says which is which. **Fixed.**

**23. Task 3's problem had `where: ''`.** `LevelProblem.where` is "the JSON path of the member when it is in none"
(`shared/level/problem.ts`). **Fix:** `where: 'sectors'`. **Fixed.**

**24. Task 6's pointer to the golden's ruling, and the pin in the commit's title.** The ruling's words ("hair or an ear
moved by the pole rule is accepted") are in `docs/refactor/c8/runway-hair-poles/README.md` on #607, with the moved
cells' pictures; the progress rows the plan named only report it. The golden's commit `ea71e0a3` is titled
"FigureBuilder at d5ca055"; the pin then moved to `7797d4a` (`a646ccf5`) and `23f889c` (`0697beac`), and the
FigureBuilder commits between change `lightSprite`'s speed only. Checked on `7167af1f`: one commit changes
`runway-cells.json`, 42 of 112 cells, 281 texels, all hair; the golden grep prints the three files the plan says;
`ARCH_OVERRIDES` survives only in a comment in `ulp.test.ts`; no other golden, hash, snapshot or approved picture
changes in #589, #607 or #590. **Fix:** task 6 says all of it. **Fixed.** Nothing about the golden needs re-ruling.

**25. The Chromium flags.** The plan said every run is "on software WebGL (`--use-angle=swiftshader
--enable-unsafe-swiftshader`)"; only the shoot script passes those flags, and the vitest browser projects pass none
(`packages/3d/vitest.config.ts` gives flags to the `webgpu` project only). Chromium's headless default is the same
software path here; task 2's test ran so. **Fixed** (the constraint says which run passes what).

**26. FigureBuilder's size.** Task 17 said "about 35 MB with its goldens"; its working tree is 20 MB at `d6e3c9f` and
its history 46 MB (`du`). **Fixed.**

**27. The survey's shared commits.** Nine, not seven, listed by pull request in the survey now. **Fixed.**

**28. Workstream 1's build branch.** Checked as the coordinator asked: `claude/shared-polish-build` at `29ccea7f`
merges with the whole order (`git merge-tree`, exit 0). Both change `pnpm-lock.yaml` and the generated
`agents/automata/skills/automata-api/reference/api.md`. The lockfile merges as text but not as a lockfile: on the merged
tree `pnpm install --frozen-lockfile` fails (`ERR_PNPM_LOCKFILE_MISSING_DEPENDENCY`, a `vitest@5.0.3` entry), and
`pnpm install` repairs it in three lines, after which the frozen install passes (measured; the merge alone, without
workstream 1, installs frozen). `api-index` was not run on the merge. **Fix:** the plan's branch notes say whichever
lands second runs `pnpm install` and `pnpm api-index --write` after merging `main`. **Fixed.**

## The two calls left to this audit

### The letterbox's whole-pixel scale: kept

The change (`3565abc8f`, carried by #588 into #590): `@automata/framework`'s letterbox takes `scale: 'fit' | 'whole'`,
default `fit`; `whole` draws the field at a whole number of device pixels a field pixel, centred and clipped; a `patch`
changeset; `retro-crisp`'s `crispRendererOptions` asks for it (`bdf4b6d0e`).

- **Any game could use it** (the Owner's rule: core only if generic for any game): yes. Any pixel-art game of any
  genre, 2D or 3D, wants pixels of one width; nothing in it is a genre's or a game's.
- **Core imports no extension:** yes. `retro-crisp` imports core; the letterbox imports nothing new.
- **Every target needs it, or both reference games do** (the framework's own test for the browser package): not
  plainly. No target needs it. The Last Light does: its renderer scales in whole pixels (`src/render/crisp.ts` at
  `92e6704`, ported as `retro-crisp`'s default `CRISP_CLINIC`, "whole-pixel scaling"). Emberwick does not ask for it.
  But core already promises it to every pixel-art game: `createPixi3dRenderer`'s `look` says the letterbox "upscales
  whole pixels", and `composite-target.ts` says "upscaling by whole pixels is correct whatever the cost", while the
  default `fit` scale is fractional. The option is how a game gets what core says it does, without changing a frame of
  a game that does not ask.
- **It cannot go one step down.** The letterbox is core's; an extension cannot change how the field is scaled without
  a seam there, and this is that seam, as small as it can be.

**Ruling: keep.** The coordinator of #588's cycle had already allowed it ("at the coordinator's word: opt-in",
`docs/refactor/tll-extensions/README.md` on #590). It goes to the Owner through the coordinator, because the framework's
test is met by one reference game, not both. If the Owner says revert: `git revert` of `bdf4b6d0e` and `3565abc8f` on the
effects branch, resolving `examples/3d/retrocrisp/retrocrisp-grade.ts` and `spikes/tll-extensions/shoot.mjs` (measured
conflicts), and the docs of `1e01ca1e`; the changeset goes with `3565abc8f`. Separately, core's comments promise whole
pixels by default and do not deliver them; that is a question for core, not for this workstream.

### `room-visibility` dropped for workstream 2's task 9b: rightly

- The Owner's decisions list #588's clinic work as superseded by workstream 2, so this needed no new call (finding 14).
- Workstream 2's spec names the core form ("a view that names the rooms it draws" passes the core test), and its task
  9b builds it in `@automata/3d`, which owns the level format and the camera views. An extension that answers the same
  question with its own policy file is the second answer the Owner's rule exists to stop.
- What is lost unless workstream 2 takes it: the player's own room, the 0.35 s hold under the camera's blend, a peek's
  far side, every room in a cutscene (and `hideFrom`, which workstream 2 drops on purpose). Task 11 now hands that list
  over (finding 11).

**Ruling: drop it, as the plan says,** with the hand-over.

### The homes of `lcd-panel` and `retro-crisp`

Their own extensions, as the plan says: ready-made looks any pixel-art game could use, ported from The Last Light's
renderer; core imports neither; private, so no changeset. The reason in the plan was wrong (finding 12) and is fixed.

## A figure's cast shadow (not in scope until the Owner says; no task added)

What the builders do: EnvironmentBuilder's `src/features/stage/cast.ts` gives each figure a contact shadow under its
feet and throws its silhouette along the key onto the ground, a mask that multiplies the floor's light there by
`look.figureShadow` (0.6, its `look.json`). FigureBuilder draws none of it; the framework has none.

What building it would add, if the Owner says yes:
- **Home:** the character kit, beside `room-light.ts`: it is a rule about painted figures, as their light is. Core would
  gain nothing unless a mesh figure wants it too.
- **Code:** for each lit figure by day, its cell's silhouette projected along `worldLighting`'s sun direction onto its
  floor's plane, drawn as a darkening on the floor (a quad under the figure with the mask, multiplied into what is
  behind it, before the snap so the frame stays on the palette), and a small contact patch under the feet; nothing at
  night, where the sun is weak or absent. It must keep to the depth rules (a wall in front hides it) on WebGL and
  WebGPU.
- **Tests:** a browser case that a figure by day darkens the floor texels on the side away from the sun to 0.6 of their
  light within a step, and none at night; the `painted-lit` parity case unmoved (the shadow is on the floor, not the
  figure); the day sheets re-shot with the shadow on and off.
- **Cost:** one task between the plan's tasks 7 and 8 (the figures must be in the base scenes first), and it changes the
  street's numbers a little (more dark texels under the pair), so task 5's measure would be taken before it.


## For the coordinator

Sent as found; collected here.

1. **`main` is red at `knip`** (finding 2) until this branch merges.
2. **The letterbox ruling** (keep) is for the Owner to confirm (above).
3. **Workstream 2, task 9b:** the four behaviours of the old room visibility it does not cover (finding 11).
4. **Workstream 2, the old look's last passes:** whether the prologue uses the LCD panel, the retro grade and crisp
   scaling, which are The Last Light's own and now the framework's extensions; its plan does not say (finding 12).
5. **Workstream 2, task 13:** it writes core mesh figure files and picks them in the Studio, while this workstream makes
   Ada and the night figure painted figures from the kit's entries (finding 16).
6. **The Owner's decision on #588:** read literally it supersedes all of #588, the two kept extensions included; the
   spec's call 1 keeps them open to this workstream. Which was meant (finding 14)?
7. **A figure's cast shadow:** what building it would add is above; no task until the Owner says.
