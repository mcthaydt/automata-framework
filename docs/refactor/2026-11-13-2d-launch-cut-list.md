# The 2D launch cut list, in order

**Date:** 2026-11-13. **Asked by the Owner:** "audit the codebase for overengineering; what should be kept and what
should be cut. We're launching fully with 2D before doing 3D", then "write up the ordered cut list".

**Measured at:** `main` `a234a3a2`. Sizes are `.ts` lines without tests. Every "who uses it" below is a `git grep` at that
commit. Nothing was built, run or deleted to write this page: each step still has to pass `pnpm check` when it is done.

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
| Steps 1 to 3 (nothing uses them, online play, review gates) | about 18,000 out | about 212,000 |
| Step 5 (3D) | about 86,000 out | about 126,000 |
| Step 4, if the story tools wait too | about 24,000 out | about 102,000 |

## Three calls for the Owner before the work starts

| # | The call | What I'd pick | It decides |
|---|---|---|---|
| A | Do Writer, Sequence and Schematic launch with 2D? | No: hold them. They are private today, and they reach 3D through `@automata/sectors` | Step 4 |
| B | Where does 3D live while 2D launches? | A tag on `main` before step 5, and a private repository when 3D starts again | Step 5 |
| C | Online play: delete it, or keep the code somewhere? | Out of `main` and out of the published set; the tag from B keeps it | Step 3 |

Tags, branch deletions and a new repository are the Owner's to make.

## Step 0: mark the place

Push a tag on `main` (for example `before-2d-cut`) so everything below can be read or brought back by name.

## Step 1: things nothing uses

No package, script or workflow depends on any of these.

| Remove | Size | Also edit |
|---|---|---|
| `tooling/codemods/` | 1,352 lines, 923 of tests | `knip.jsonc` (the `tooling/codemods` entry and its comment) |
| `docs/refactor/move-map*.json` (seven files) | 90 KB | nothing; the codemods were their only reader |
| `tooling/dev-tools/` (`worktree-gc`, `promote-evidence`, their git and file seams) | 943 lines, 1,038 of tests | nothing outside the folder names it |
| `.github/workflows/windows-trial.yml` | 72 lines | check `tooling/repo-hygiene/tests/unit/workflow-invariants.test.ts` for a pinned count |

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

## Step 3: online play

`@automata/net`, `@automata/net-server` and `@automata/net-ui` are in the published set. No game, example or site page
imports them; `net-server` and `net-ui` import `net`, and that is all.

**Remove** `extensions/net/` (4,622 lines), `extensions/net-server/` (5,701) and `extensions/net-ui/` (427), with about
10,700 lines of tests.

**Also edit:**

- `.changeset/config.json`: three names leave the `fixed` group. Four pending changesets name these packages: drop their
  lines, or the file where nothing else is left.
- Root scripts: `boundaries` and `style`.
- `packages/content/src/shared/locale/game-words.ts` (line 16) and `packages/tools/src/shared/words/package-words.ts`
  (line 12): `@automata/net-ui` leaves the list of packages that carry words.
- `tooling/examples-runner/src/catalog.ts` (lines 32 and 94 to 96) and its tests.
- `tooling/repo-hygiene/src/hard-coded-ports.ts` (line 53, the allowance for `net-server`'s default port).
- `site/tests/unit/playground/compile.test.ts`, `site/tests/unit/playground/runtime/playground-imports.test.ts`,
  `site/tests/unit/api/api-pages.test.ts`.
- `docs/guides/extensions.md` (three rows), `README.md`, `docs/versions.md` (the three `@colyseus/*` rows),
  `docs/provenance/sources.md`.
- Regenerate the API report, `docs/cheatsheet.md` and the agent package's `api.md`.

## Step 4: the story tools (call A)

`narrative`, `nav`, `systems` and `cutscenes`, and the Writer, Sequence and Schematic editors that edit them, still
import 3D: `sectorsPlaces` and `Point` from `@automata/sectors/sim`, and the timeline and `PieceStates` from
`@automata/3d`. `@automata/places` was written to break that link, but `sectorsPlaces` is still the default.

**If they wait (what I'd pick):** they leave with 3D in step 5, and these go with them.

| Remove | Size |
|---|---|
| `extensions/narrative/`, `nav/`, `systems/`, `cutscenes/`, `places/`, `level-2d/` | 11,657 lines |
| `extensions/editors/src/features/writer/`, `sequence/`, `schematic/` | 11,685 lines (with their Svelte files) |
| `examples/2d-story/` | 978 lines |

`extensions/editors` then holds Feel and Audio only, and its `package.json` keeps `@automata/audio-synth`,
`@automata/editor` and `@automata/feel`. Edit `src/app/suite/content-editors.ts`, `main.ts` and the sample game beside
them.

One cost to know: `@automata/puzzle` is published, and Schematic is the only editor for it. Holding Schematic means
puzzles are written by hand in a file at launch.

**If they launch:** untangle them first, then do step 5.

- Move `Point` into `@automata/places` and make `places` a required option, so nothing defaults to `sectorsPlaces`:
  `extensions/narrative/src/shared/sim/narrative.plugin.ts`, `narrative.system.ts`, `src/app/narrative.extension.ts`;
  `extensions/nav/src/shared/sim/nav.system.ts`, `route.ts`, `nav.plugin.ts`, `nav-graph.schema.ts`,
  `src/app/nav.extension.ts`, `src/entries/sim.ts`; and 16 files under `extensions/systems/src`.
- Give the timeline a home that is not 3D (`packages/3d/src/shared/timeline/`, 172 lines), for
  `extensions/cutscenes/src/shared/sim/cutscene.schema.ts` and `shared/director/sequence.ts`.
- `extensions/cutscenes/src/shared/director/scene-state.ts` and `features/stage-3d/` use `PieceStates` from the 3D
  level: the 3D stage leaves, and the scene state needs its own type.
- `extensions/editors/src/features/sequence/plan-view.ts` reads a 3D level (`readLevel`, `AfSector2`): the 3D plan view
  and `tests/unit/sequence/plan-view-3d.test.ts` leave.
- Their tests use `@automata/sectors/testing` and its `clinic.af-sector.json` fixture: they need a 2D level instead.

## Step 5: 3D (call B)

Five pull requests, leaves first. The tag from step 0 is what brings any of it back.

**5a. Games, examples and probes.**

- `examples/3d/` (with `examples/3d/wardrobe/`), `examples/3d-story/`, `games/base-3d/`.
- `tooling/frame-budget/stress/3d/` and the `@automata/3d` dependency in `tooling/frame-budget/package.json`.
- `tooling/consumer-smoke/tests/e2e/stranger-3d.test.ts` and the 3D command in `tooling/consumer-smoke/src/commands.ts`.
- `pnpm-workspace.yaml`: the `examples/3d`, `examples/3d/wardrobe` and `examples/3d-story` lines.
- `knip.jsonc`: the `examples/3d` and `examples/3d-story` entries, and the `games/base-3d/src/paraglide/**` ignore.

**5b. The 3D editors.**

- `packages/editor-3d/` (19,331 lines, 36,957 of tests) and `docs/design/editor-3d/`.
- In `packages/editor`: `tests/e2e/journeys/dark-levels-3d.test.ts`, `levels-3d-edit-reaches-the-game.test.ts`,
  `new-3d-game-plays-its-edits.test.ts`; `src/testing/suite/fixtures/depot.af-sector.json`; the 3D rows of
  `bay.editors.toml`; and the 3D editor names in `src/features/suite/shell/create-suite.ts`, `home-model.ts`,
  `suite-entries.ts`, `src/features/home/home-model.ts`, `src/shared/kit/ports/suite-ports.ts` and
  `src/shared/level-2d/session/view-props.ts`.
- `knip.jsonc` (the `packages/editor-3d` entry) and `biome.json` (line 13).

**5c. The 3D extensions.**

- `extensions/world-kit/`, `character-kit/`, `figures/`, `lcd-panel/`, `retro-crisp/`, `interact/`, `hud/`, `sectors/`.
  `hud` and `interact` have no user at all.
- `turbo.json`: the three `@automata/figures` entries. Today every package's `typecheck` waits on
  `@automata/figures#typecheck`.
- `tooling/repo-hygiene/src/extension-manifests.ts` and `tooling/examples-runner/src/catalog.ts`, with the runner's 3D
  fixtures (`tests/fixtures/catalog/figures/`, `render3d/`, `tests/fixtures/packages/3d/`).

**5d. The 3D package and the closed beta.**

- `packages/3d/` (24,924 lines, 19,257 of tests), `vendor/pixi-3d/` (11 MB), `spikes/` (all five are 3D look spikes).
- `docs/guides/3d.md`. `docs/adr/0007-3d-look.md` stays as a record, marked as waiting.
- `.gitignore` (the four `spikes/` lines), `.gitleaks.toml` (the `packages/3d` entry), `knip.jsonc` (the `packages/3d`
  entry and the `spikes/**` and `docs/design/**` ignores).
- `docs/versions.md`: the `@pixi/3d` row and the rows only 3D needs. `docs/provenance/`: the builders' manifest and
  their rows in `sources.md`.

**5e. What 2D carried for 3D's sake.**

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
- `.github/workflows/3d.yml` goes. `ci.yml`, `game-ci.yml` and `release-checks.yml` lose the comments that point to it.
- Tests that pin the lists above: `tooling/repo-hygiene/tests/unit/gate-scripts.test.ts`,
  `source-names-wired.test.ts`, `workflow-invariants.test.ts`, `tooling/release/tests/unit/release-list.test.ts`.
- `AGENTS.md`, `docs/README.md`, `docs/status.md` and `README.md`: say that 3D waits, and where it is.

Comments in `packages/automata/src/features/input/gamepad/read-pad.ts`,
`features/render/delta/render-delta-consumer.ts` and `packages/content/src/shared/game/game-facts.ts` mention 3D; read
each one and keep what still explains the 2D code.

## Step 6: trims that delete no product code

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
3. **The root scripts.** After step 5, measure `boundaries` (3,383 characters today) and `style` (1,906) again. If
   either is still a list of every package, it reads the workspace instead of a typed list.
4. **`automata words`.** It puts `@anthropic-ai/sdk` in the dependencies of the command every game installs, and its
   live call has not been run. Make the SDK an optional peer loaded only by `words`:
   `packages/tools/package.json`, `src/shared/node/words-model-live.ts`, `src/app/words-live.ts`.
5. **`@automata/physics`.** It is published and in the extensions guide, and after step 5 nothing in the repository
   uses it. Add one 2D example that does, or take it out of the first release.
6. **Branches.** 73 on the remote, against a rule of `main` and open pull requests. `pnpm branches:prune` lists them;
   deleting is the Owner's.

## What stays, untouched by any step

`packages/sim`, `packages/content`, `packages/automata`, `packages/tools` (less the 3D template and the scan),
`packages/editor` (Levels, the Tuner, Characters), the Feel and Audio editors, `extensions/feel`, `audio-synth`, `debug`,
`puzzle`, `ui-screens`, `games/emberwick`, `examples/2d`, `site`, all four targets, and the tooling that guards a release
(`api-report`, `api-index`, `agent-skills`, `consumer-smoke`, `evidence`, `release`, `repo-hygiene`, `check-style`,
`versions`, the two presets, `examples-runner`, `frame-budget`'s 2D stress).

One piece of new work the cuts expose: the published `automata editor` page is built from `packages/editor` alone
(Levels and the Tuner). Feel and Audio live in `extensions/editors`, so they do not reach a launch customer until that
page includes them. `create-game` already plays a feel and a sound, so this is worth doing before the release.

## Not checked

- No step was tried. A file may turn up in a step that `git grep` did not show (a path built from strings, a workflow
  input).
- The line numbers are from `a234a3a2` and move with every merge.
- The open pull requests were not read against this list. #574, #575, #596, #597, #606 and #664 are 3D work and would close
  unmerged under call B; #671 is editor work and stays.
