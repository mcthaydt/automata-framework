# The 2D launch cut list, in order

**Date:** 2026-11-13. **Asked by the Owner:** "audit the codebase for overengineering; what should be kept and what
should be cut. We're launching fully with 2D before doing 3D", then "write up the ordered cut list". Revised the same
day for the Owner's three decisions (below).

**Measured at:** `main` `a234a3a2`. Sizes are `.ts` lines without tests. Every "who uses it" below is a `git grep` at that
commit. Nothing was built, run or deleted to write this page: each step still has to pass `pnpm check` when it is done.

## Handoff: for the session that does the work

This page is the instruction. On 2026-11-13 the Owner said: "we're working in another claude session, so just push it
to main as our handoff instructions".

- **Nothing here has been started.** No file has been deleted or moved, and the tag in step 0 has not been pushed.
- **The three decisions are made** (below). Do not reopen them.
- **Start at step 1** and go in order, one pull request per step, with the failing test first where a step changes
  behaviour (steps 2b and 3 do). Step 3 must be merged before step 4 starts.
- **Step 0 is the Owner's.** Ask for the tag before step 4; steps 1 to 3 do not need it.
- **The file lists are where to look first, not the whole truth.** They came from `git grep` at `a234a3a2`. Search
  again at the start of each step, and trust `pnpm check`, `pnpm knip` and `pnpm boundaries` over this page.
- **Record each step** in [`progress.md`](progress.md) as it lands, with what ran and what did not.

## The rules of the list

- One step is one pull request, and `pnpm check` passes after each.
- Things nothing depends on go first. A package goes after everything that imports it.
- A step that removes a published package's exports ends with `pnpm build`, `pnpm api-report --update` and
  `pnpm api-index --write`, which rewrite `docs/cheatsheet.md` and `agents/automata/skills/automata-api/reference/api.md`.
- Lines in the root `package.json` scripts (`boundaries`, `style`, the filter lists) name most packages, so nearly every
  step edits them. They are listed once per step as "root scripts".

## What it comes to

| | Source lines | After |
|---|---|---|
| Today | about 230,000 | |
| Steps 1 and 2 (things nothing uses, the review gates) | about 7,000 out | about 223,000 |
| Step 3 (the story tools let go of 3D) | a few hundred moved, none out | about 223,000 |
| Step 4 (3D) | about 86,000 out | about 137,000 |

## The Owner's decisions (2026-11-13)

"Keep story tools, keep online play with colyssus, move 3D out as our failed attempt."

| The call | Decided | What it changes here |
|---|---|---|
| Do Writer, Sequence and Schematic launch with 2D? | They stay | They are untangled from 3D first (step 3), then 3D leaves (step 4). `@automata/puzzle` keeps its editor |
| Online play: `net`, `net-server`, `net-ui` | It stays, on Colyseus | The step that removed it is gone from this list. Nothing in the repository plays online yet (step 5, item 5) |
| Where does 3D live while 2D launches? | Out of `main`, recorded as the first attempt, which failed | Step 4 removes all of it. Nothing in `main` points at it afterwards, and what a second attempt reuses is decided when it starts |

Tags, branch deletions and a new repository are the Owner's to make.

## Step 0: mark the place

Push a tag on `main` (for example `3d-first-attempt`) before step 4. It is the record of the 3D attempt and the only
way to read it by name once it has left. If the attempt should also sit in a repository of its own, that is made from
the same commit.

## Step 1: things nothing uses

No package, script or workflow depends on any of these.

| Remove | Size | Also edit |
|---|---|---|
| `tooling/codemods/` | 1,352 lines, 923 of tests | `knip.jsonc` (the `tooling/codemods` entry and its comment) |
| `docs/refactor/move-map*.json` (seven files) | 90 KB | nothing; the codemods were their only reader |
| `tooling/dev-tools/` (`worktree-gc`, `promote-evidence`, their git and file seams) | 943 lines, 1,038 of tests | nothing outside the folder names it |
| `.github/workflows/windows-trial.yml` | 72 lines; it runs `pnpm test:unit:core` and `pnpm test:browser:core`, which the root `package.json` no longer has | check `tooling/repo-hygiene/tests/unit/workflow-invariants.test.ts` for a pinned count |

**Taken back from the audit:** I said to drop 81 of the 82 pending changesets. Leave them. The first `changeset version`
consumes all of them and writes the changelog from their text, so deleting them saves nothing and loses the notes.

## Step 2: the review gates

Review gates are approvals a person records before content counts as done. The package that records them has no user,
and no real game lists a gate: every `editors.toml` outside one test fixture has `gates = []`.

**2a. Remove `extensions/pipelines/`** (4,912 lines, 3,445 of tests; the `automata-pipe` command and its MCP server).

- Root scripts: `boundaries` (the `--features` and `--forbid` lists), `style`, and the 3D filter lists it sits in.
- `docs/versions.md`: the `@modelcontextprotocol/sdk` row. `docs/provenance/sources.md`: its rows.
- `.github/workflows/3d.yml`: one comment names it.

**2b. Take gates out of the editor.** This is a change to the `af-editors/1` format, and the cheapest moment for it is
before the first public release.

- Delete: `packages/editor/src/entries/gate-records.ts`, `src/features/suite/node/gate-records.schema.ts`,
  `src/features/suite/node/gates-reader.ts`, `src/shared/kit/ports/memory/memory-gates.ts`,
  `src/testing/ports/gates-contract.ts`, and the `./gate-records` export in `packages/editor/package.json`.
- Edit: `src/shared/editor-list/editors.schema.ts` (`GateRow`, `[[gate]]`, a row's `gates`), `editor-list.ts` (the
  cross-row gate rules), `workspace-policy.ts`, `src/shared/kit/ports/suite-ports.ts` (`Gates`, `GateState`),
  `ports/index.ts`, `ports/memory/memory-ports.ts`, `src/features/suite/shell/home-model.ts`,
  `src/features/suite/core/index.ts`, `src/entries/editor-list.ts`,
  `src/shared/level-2d/profiles/level-project/level-project.ts`, `src/testing/ports/index.ts`,
  `src/testing/ports/workspace-contract.ts`, `src/testing/suite/tuner-fixtures.ts`.
- Edit: `packages/tools/src/features/editor/editor-policy.ts`, `src/shared/create-game/create-game.ts`, `src/app/cli.ts`.
- Every editor list loses its `gates` line: `games/emberwick/content/editors.toml`,
  `packages/editor/src/features/suite/shell/platformer.editors.toml`,
  `packages/editor/src/testing/suite/fixtures/bay.editors.toml`,
  `packages/tools/src/shared/create-game/template-content/editors.toml`,
  `extensions/editors/src/app/suite/sample/editors.toml`, `examples/2d-story/content/editors.toml`. The four 3D ones
  leave in step 5.
- Tests: 46 test files under `packages/editor/tests`, `packages/tools/tests` and `extensions/editors/tests` name gates.
- In the same change, a row's `modes` can go: it is a list that only ever holds `"edit"`.

## Step 3: the story tools let go of 3D

`narrative`, `nav`, `systems` and `cutscenes`, and the Writer, Sequence and Schematic editors that edit them, stay. Today
they reach 3D in three ways: `sectorsPlaces` and `Point` from `@automata/sectors/sim`, the timeline and `PieceStates`
from `@automata/3d`, and tests that run on a 3D level. `@automata/places` was written to break that link, but
`sectorsPlaces` is still the default. This step is new work, not a cut, and step 4 cannot start until it is done:
after it, nothing that stays imports `@automata/sectors` or `@automata/3d`.

| Package | Source files that import sectors or 3D | Test files | In its `package.json` |
|---|---|---|---|
| `extensions/narrative` | 5 | 3 | `@automata/sectors` (peer and dev) |
| `extensions/nav` | 9 | 4 | `@automata/sectors` (peer and dev) |
| `extensions/systems` | 19 | 14 | `@automata/sectors` (peer and dev) |
| `extensions/cutscenes` | 4 | 5 | `@automata/3d` (peer and dev), `@automata/sectors` (dev) |
| `extensions/editors` | 1 | 1 | `@automata/3d` (peer and dev) |

`places`, `level-2d` and `hud` import neither.

In order:

1. **`Point` moves to `@automata/places`.** It is a type from the 3D level that `@automata/sectors/sim` passes on.
   `nav` (`route.ts`, `nav-graph.schema.ts`, `nav.system.ts`) and `systems` (`effect.ts`, `systems.schema.ts`,
   `agent-step.ts`, `probe.ts` and the four files under `features/bots/`) import it from there instead.
2. **`places` has no default.** Each extension takes the level's places as an option, and a game passes
   `level2dPlaces(...)`: `narrative.plugin.ts`, `narrative.system.ts`, `narrative.extension.ts`; `nav.plugin.ts`,
   `nav.system.ts`, `nav.extension.ts`; in `systems`, `world.ts`, `load-systems.ts`, `systems.plugin.ts`,
   `systems.extension.ts`, `peek.plugin.ts`, `peek.system.ts`, `carried-light.plugin.ts` and `carried-light.system.ts`.
   Each extension's `requires` then names the provider it was given. A game that passes none is told so at boot.
3. **`blockedBy`.** `extensions/nav/src/entries/sim.ts` passes it on from `@automata/sectors/sim`. It goes, or `places`
   answers it: read who calls it first.
4. **The timeline gets a home that is not 3D.** `packages/3d/src/shared/timeline/` is 172 lines of plain maths
   (`track`, `sample`, `bracket`, `mixNumber`, the eases). `extensions/cutscenes/src/shared/sim/cutscene.schema.ts` and
   `shared/director/sequence.ts` use it. It moves into `cutscenes`, its only user that stays.
5. **`PieceStates`.** `extensions/cutscenes/src/shared/director/scene-state.ts` takes the type from the 3D level: it
   needs its own. `src/features/stage-3d/` leaves; `stage-2d` and `caption` stay.
6. **Sequence's plan view.** `extensions/editors/src/features/sequence/plan-view.ts` reads a 3D level (`readLevel`,
   `AfSector2`). The 3D half and `tests/unit/sequence/plan-view-3d.test.ts` leave; the 2D half stays.
7. **The tests get a 2D level.** 27 test files in the five packages name sectors, 3D or a 3D level; most reach
   `@automata/sectors/testing` (`stepWith`, the walkers, the clinic level `clinic.af-sector.json`). The helper moves to `@automata/level-2d`'s testing entry, on a 2D level that asks the
   same questions (two rooms, a door, a wall that blocks sight). A golden hash recorded on the clinic level is
   recorded again on the 2D one, and the commit says why it moved.
8. **The manifests and the READMEs.** Each README's "Turn it on" says the extension needs `@automata/sectors`; it
   names `level-2d` instead. `@automata/sectors` and `@automata/3d` leave the five `package.json` files above, and the root
   `boundaries` script's `--forbid` list gains the story tools, so a 3D import cannot come back unnoticed.

`extensions/pipelines` also imports these packages; step 2 has removed it by now.

## Step 4: 3D leaves `main`

Five pull requests, leaves first. The tag from step 0 is the record of the attempt.

**4a. Games, examples and probes.**

- `examples/3d/` (with `examples/3d/wardrobe/`), `examples/3d-story/`, `games/base-3d/`.
- `tooling/frame-budget/stress/3d/` and the `@automata/3d` dependency in `tooling/frame-budget/package.json`.
- `tooling/consumer-smoke/tests/e2e/stranger-3d.test.ts` and the 3D command in `tooling/consumer-smoke/src/commands.ts`.
- `pnpm-workspace.yaml`: the `examples/3d`, `examples/3d/wardrobe` and `examples/3d-story` lines.
- `knip.jsonc`: the `examples/3d` and `examples/3d-story` entries, and the `games/base-3d/src/paraglide/**` ignore.

**4b. The 3D editors.**

- `packages/editor-3d/` (19,331 lines, 36,957 of tests) and `docs/design/editor-3d/`.
- In `packages/editor`: `tests/e2e/journeys/dark-levels-3d.test.ts`, `levels-3d-edit-reaches-the-game.test.ts`,
  `new-3d-game-plays-its-edits.test.ts`; `src/testing/suite/fixtures/depot.af-sector.json`; the 3D rows of
  `bay.editors.toml`; and the 3D editor names in `src/features/suite/shell/create-suite.ts`, `home-model.ts`,
  `suite-entries.ts`, `src/features/home/home-model.ts`, `src/shared/kit/ports/suite-ports.ts` and
  `src/shared/level-2d/session/view-props.ts`.
- `knip.jsonc` (the `packages/editor-3d` entry) and `biome.json` (line 13).

**4c. The 3D extensions.**

- `extensions/world-kit/`, `character-kit/`, `figures/`, `lcd-panel/`, `retro-crisp/`, `interact/`, `sectors/`.
  `interact` needs `sectors` and the 3D level, and has no user.
- `extensions/hud/` stays: it reads `narrative` and `puzzle` and imports nothing from 3D. It has no user yet (step 5,
  item 5).
- `extensions/cutscenes/src/features/stage-3d/` and the 3D half of Sequence's plan view, if step 3 left them.
- `turbo.json`: the three `@automata/figures` entries. Today every package's `typecheck` waits on
  `@automata/figures#typecheck`.
- `tooling/repo-hygiene/src/extension-manifests.ts` and `tooling/examples-runner/src/catalog.ts`, with the runner's 3D
  fixtures (`tests/fixtures/catalog/figures/`, `render3d/`, `tests/fixtures/packages/3d/`).

**4d. The 3D package and the closed beta.**

- `packages/3d/` (24,924 lines, 19,257 of tests), `vendor/pixi-3d/` (11 MB), `spikes/` (all five are 3D look spikes).
- `docs/guides/3d.md`.
- `.gitignore` (the four `spikes/` lines), `.gitleaks.toml` (the `packages/3d` entry), `knip.jsonc` (the `packages/3d`
  entry and the `spikes/**` and `docs/design/**` ignores).
- `docs/versions.md`: the `@pixi/3d` row and the rows only 3D needs. `docs/provenance/`: the builders' manifest and
  their rows in `sources.md`.

**4e. What 2D carried for 3D's sake.**

- `packages/tools`: `src/shared/create-game/template-3d.ts`, `template-3d-game.ts`, `template-3d-room.ts`,
  `template-3d-wick.ts`, `template-3d-content.ts`, `template-3d-content/`, `three-d-gate.ts`; the `--template` flag in
  `create-game.ts`, `template.ts`, `template-project.ts`, `src/app/cli.ts` and `src/app/help.ts`; the `suite-full` page
  in `src/features/editor/page-for.ts`, `editor-policy.ts` and `editor-command.ts`.
- The closed-beta scan has nothing left to find: `packages/tools/src/shared/ship/prepare/pixi3d-markers.ts`, its use in
  `build-scans.ts`, `prepare-build.ts`, `publish-build.ts`, the three `prepare-<target>.ts` files, `errors.ts`,
  `cli-args.ts`, `config/ship-config.ts` and `scripts/copy-editor.ts`; `site/scripts/scan-closed-beta.ts` and its part of
  `site/scripts/check-launch.ts`; `tooling/release/tests/unit/closed-beta-guard.test.ts` and `private-build.test.ts`.
- `packages/tools/src/features/boundaries/forbid.ts` and `cli.ts`, and `packages/tools/src/shared/check/check-steps.ts`:
  the 3D cases.
- `site/playground/build.ts`, `site/playground/src/playground-resources.ts`, `site/src/features/playground/editor.ts`.
- `tooling/api-report/src/core-packages.ts`, `tooling/check-style/src/cli.ts`.
- Root `package.json`: delete `test:unit:2d`, `test:unit:3d`, `test:browser:2d`, `test:browser:3d` and
  `test:journeys:3d` (the plain `test:unit` and `test:browser` are then the 2D ones); drop the 16-package filter from
  `test:browser:affected`; shorten `boundaries`, `style`, `source-names` and `ci:local`.
- `.github/workflows/3d.yml` goes. `ci.yml` calls `pnpm test:browser` where it called `pnpm test:browser:2d` (line 194),
  so the story tools' browser suites, which ran in `3d.yml`, run in the gate. `ci.yml`, `game-ci.yml` and
  `release-checks.yml` lose the comments that point to `3d.yml`.
- Tests that pin the lists above: `tooling/repo-hygiene/tests/unit/gate-scripts.test.ts`,
  `source-names-wired.test.ts`, `workflow-invariants.test.ts`, `tooling/release/tests/unit/release-list.test.ts`.
- `AGENTS.md`, `docs/README.md`, `docs/status.md`, `README.md` and `docs/guides/extensions.md`: AF is 2D. One line
  says a first 3D attempt was made and set aside, and names the tag. `docs/archive/direction-log.md` gains the Owner's
  words of 2026-11-13, which replace "AF 1.0 covers 2D and 3D" and "we launch when pixi 3D goes public".
  `docs/adr/0002-pixi-for-2d-and-3d.md` and `0007-3d-look.md` are marked as not in force.
- The open 3D pull requests close unmerged: #574, #575, #596, #597, #606 and #664.

Comments in `packages/automata/src/features/input/gamepad/read-pad.ts`,
`features/render/delta/render-delta-consumer.ts` and `packages/content/src/shared/game/game-facts.ts` mention 3D; read
each one and keep what still explains the 2D code.

## Step 5: trims that delete no product code

In order of what they give back.

1. **The records leave `main`.** `docs/archive/`, `docs/refactor/` and `docs/superpowers/` are 896 files and 71 MB. The
   tag keeps them. About 35 source and test files link into them (six in `extensions/character-kit`, five in
   `tooling/repo-hygiene`, three in `packages/automata`, the rest in ones and twos), and
   `tooling/check-style/src/docs.ts` names the folders. `AGENTS.md`'s read order points at two of them, so
   `docs/status.md` is rewritten first: it is dated 2026-11-06 and describes a stack of pull requests that has merged.
2. **The working process.** Each piece of work goes through six or seven stages in separate sessions, each with its
   own committed document: one plan audit raised 41 findings before any code was written. For the launch: spec, build,
   review. `AGENTS.md` ("How to work") and the stage lists in the progress pages. The Owner's call. The commit hook
   needs no change: since 2026-11-12 it runs only the unit tests of the packages a commit touches.
3. **The root scripts.** After step 4, measure `boundaries` (3,383 characters today) and `style` (1,906) again. If
   either is still a list of every package, it reads the workspace instead of a typed list.
4. **`automata words`.** It puts `@anthropic-ai/sdk` in the dependencies of the command every game installs, and its
   live call has not been run. Make the SDK an optional peer loaded only by `words`:
   `packages/tools/package.json`, `src/shared/node/words-model-live.ts`, `src/app/words-live.ts`.
5. **Three published or kept packages that nothing in the repository uses.** `@automata/physics` (after step 4),
   online play (`net`, `net-server`, `net-ui`) and `hud`. Each gets one 2D example with a journey, so a release proves
   it works: a falling-boxes example, a two-player room on a local `net-server`, and the HUD in `examples/2d-story`.
6. **Branches.** 73 on the remote, against a rule of `main` and open pull requests. `pnpm branches:prune` lists them;
   deleting is the Owner's.

## What stays

`packages/sim`, `packages/content`, `packages/automata`, `packages/tools` (less the 3D template and the scan),
`packages/editor` (Levels, the Tuner, Characters), `extensions/editors` (Feel, Audio, Writer, Sequence, Schematic),
`extensions/feel`, `audio-synth`, `debug`, `puzzle`, `ui-screens`, `physics`, `net`, `net-server`, `net-ui`, `narrative`,
`nav`, `systems`, `cutscenes`, `places`, `level-2d`, `hud`, `games/emberwick`, `examples/2d`, `examples/2d-story`, `site`,
all four targets, and the tooling that guards a release (`api-report`, `api-index`, `agent-skills`, `consumer-smoke`,
`evidence`, `release`, `repo-hygiene`, `check-style`, `versions`, the two presets, `examples-runner`, `frame-budget`'s 2D
stress).

## New work the decisions create

1. **The story tools are private.** `narrative`, `nav`, `systems`, `cutscenes`, `places`, `level-2d` and `hud` have
   `"private": true`, so a launch customer cannot install them. To launch with 2D they join the published set: the
   manifests, the `fixed` group in `.changeset/config.json`, the release tooling's lists of published packages, a
   changeset each, and rows in `docs/guides/extensions.md`. Whether all seven publish at the first release is the Owner's call.
2. **The published editor page has two editors.** `automata editor` serves the page built from `packages/editor` alone
   (Levels and the Tuner). Feel, Audio, Writer, Sequence and Schematic live in `extensions/editors`, whose page is not
   copied into `@automata/tools`. Until it is, a launch customer cannot open the editors this list keeps.
   `packages/tools/scripts/copy-editor.ts` and `packages/tools/src/features/editor/page-for.ts`.

## Not checked

- No step was tried. A file may turn up in a step that `git grep` did not show (a path built from strings, a workflow
  input).
- The line numbers are from `a234a3a2` and move with every merge.
- The open pull requests were not read against this list beyond their titles. #671 is editor work and stays.
