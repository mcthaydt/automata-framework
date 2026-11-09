# Automata Plus against the refactored framework: audit

- **Stage:** 1 of 6 (the audit). The plan and spec come next, then the plan audit, the build, the build audit and the
  fixes, each in its own session. Tracking: [plus-progress.md](plus-progress.md) (moved from automata-plus with the audit).
- **Date:** 2026-11-07.
- **The Owner's words:** "Have we been updating automata-skills, I know we worked on automata-plus", then "do
  automata-plus too" (2026-11-07 11:18 and 11:19). This audit reads that as: bring this repository up to date with the
  framework's refactor, the way `automata-skills` is being brought up to date.
- **What was read:**
  - Plus `main` at `1766c622` (2026-11-01), the commit this branch starts from.
  - The framework core Plus is pinned to, `f1b38528` (`core.ref`, 2026-10-31).
  - The framework's `main` at `97270d4b` (#385 to #391 merged).
  - The head of the open refactor stack, `ac899051` (#443, which sits on #392 to #442). "The head" below means
    `ac899051`.
  - #440's latest head, `775ab1a4`, for the release version only (C6): its last commits came after #441 was stacked
    on it.
  - The rewritten 3D slice spec and plan at `ff683ef0` (#444, audited and fixed in place by #445). The 3D plan was
    rewritten while this audit was written, so section 4.6 was checked again against `ff683ef0`, and its paths are
    the rewrite's.
- **Method:** every finding was checked against files or by running a command; section 8 lists the commands. Nothing
  here was taken from an earlier audit without checking it again. Where an earlier audit said something that is no
  longer true, this one says so.

## Short version

1. **Plus works today, on the old core.** On its pinned core `f1b38528`, `pnpm core:sync` built in 41 s and
   `pnpm check` passed: Biome over 779 files, TypeScript in every package, the sim boundaries (121 files, 0 findings)
   and 2,042 unit tests in 252 files. Chromium's browser suites passed too (section 8). WebKit and Firefox were not run.
2. **It cannot move to the new core as it is.** The sync tool builds core with the framework's `pnpm packs`, which the
   refactor deleted, so `core:sync` cannot build the head at all (C1). 283 source files import core under names that
   no longer exist: the framework is now `@automata/framework`, `@automata/tools`, `@automata/sim` and
   `@automata/content` (C2).
3. **Most of what Plus uses survived the refactor unchanged.** Of the 105 core names Plus imports, 83 exist at the head
   with the same declaration, the sim's 46 names among them, and the UI parts Plus builds on changed only in comments.
   20 are gone from the public entries: the Node services in `-node` (8), the blockout format's 7 names, which the 3D
   plan deletes, and 5 UI names the root trim dropped (C3). Two rules changed under Plus's feet: browser code may no
   longer import the content root (C4), and the browser runtime no longer uses Effect, which `feel` and `net` still do
   in the page (E1, E2).
4. **The 3D slice builds three things Plus already has.** The level's sim side (Plus `sectors`), a keyed timeline
   with camera, lamp and scene tracks (Plus `cutscenes`), and it deletes the blockout format Plus's blockout pipeline
   reads. The 3D spec lists Plus as out of scope and its audit did not count Plus as a consumer (X1 to X4). Each needs
   one owner before either side builds further.
5. **The layout and the house rules have moved on.** Tests sit beside the source in 264 files (AF keeps them in
   `tests/`), no package uses AF's `app/`, `features/`, `shared/`, `entries/` layout, 484 files cite plan IDs in
   comments, and 148 name a source project (section 4.3).
6. **The decision behind it all is the Owner's.** On 2026-11-06 the Owner took D12 A: "Plus does not ship with 2D.
   Archive the repository", and an extension "comes back, ported, as `extensions/<name>`" in the framework when a game
   there uses it. The framework then removed its Plus plumbing (`automata add`, the packs tool, the seams list). The
   Owner's new words ask for Plus to be brought up to date. Section 6 offered the three ways that can go. **The Owner
   chose B on 2026-11-07:** "make them extensions because they're free anyway, and move the stuff 3D is doing here,
   and cut the starter". Plus's packages are ported into the framework as `extensions/<name>`, the level's sim side
   and the scripted scenes the 3D slice was about to write come from Plus's `sectors` and `cutscenes` instead, and
   `starters/party-racer` is not ported (section 6, P-D1).

## 1. Where Plus stands

### 1.1 The packages

Source lines exclude tests, `testing/` and `test-support/`. "Core files" counts files that import a framework package
that the refactor merged away (`-node`, `-runtime`, `-ui`, `-testing`). "Effect" counts source files that import it.
"Plan IDs" and "source names" count files of any kind in the package.

| Package | Source lines | Test lines | Test files | Core files | Effect | Plan IDs | Source names | Uses sectors |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| `audio-synth` | 1,271 | 940 | 8 | 1 | 0 | 15 | 0 | |
| `cutscenes` | 1,021 | 730 | 9 | 1 | 0 | 28 | 0 | yes |
| `debug` | 800 | 761 | 16 | 6 | 0 | 9 | 0 | |
| `dev-tools` | 709 | 1,034 | 8 | 10 | 7 (Node) | 4 | 2 | |
| `feel` | 829 | 795 | 11 | 1 | 1 (page) | 24 | 0 | |
| `narrative` | 3,459 | 2,298 | 18 | 1 | 0 | 51 | 0 | yes |
| `nav` | 482 | 348 | 6 | 1 | 0 | 16 | 0 | yes |
| `net` | 3,534 | 4,135 | 29 | 0 | 4 (page) | 53 | 40 | |
| `net-ui` | 486 | 321 | 4 | 2 | 0 | 11 | 0 | |
| `physics` | 1,352 | 1,306 | 14 | 1 | 0 | 29 | 0 | |
| `puzzle` | 2,128 | 906 | 10 | 1 | 0 | 32 | 0 | |
| `sectors` | 840 | 820 | 8 | 1 | 0 | 18 | 0 | is it |
| `server` | 4,339 | 5,730 | 45 | 0 | 4 (Node) | 70 | 69 | |
| `systems` | 2,993 | 1,359 | 12 | 1 | 0 | 39 | 0 | yes |
| `kits/ui-screens` | 508 | 846 | 16 | 14 | 0 | 17 | 0 | |
| `starters/party-racer` | 1,027 | 550 | 5 | 0 | 0 | 4 | 15 | |
| `tooling/pipelines` | 5,076 | 4,050 | 33 | 31 | 19 (Node) | 48 | 22 | yes |
| `tooling/core` | 405 | 814 | 5 | 0 | 0 | 8 | 0 | |
| `tooling/boundary` | 285 | 433 | 3 | 1 | 0 | 6 | 0 | |
| `tooling/ci` | 0 | 200 | 2 | 0 | 0 | 2 | 0 | |
| **Total** | **31,544** | **28,376** | **264** | **73** | **35** | **484** | **148** | |

### 1.2 Who uses what

- **Nothing in the framework uses Plus.** No game, example, package or site page at the head imports a Plus package;
  the only hits are test fixtures in `packages/tools/tests/unit/boundaries/check.test.ts`, which use
  `@automata/physics` as a made-up extension name.
- **Inside Plus,** `sectors` is the base of `nav`, `systems`, `narrative` and `cutscenes` (each imports
  `@mcthaydt/automata-sectors/sim`), and `tooling/pipelines` drives `audio-synth`, `narrative`, `nav`, `puzzle`,
  `sectors` and `systems`. `starters/party-racer` uses `net` and `physics`. `server` uses `net`. `debug` uses `feel` and
  `audio-synth`.
- **`dev-tools` has no caller.** Its two commands (`promote-evidence`, `worktree-gc`) are named only in its own plan here
  and in the framework's archived 2026-10 documents. They served the multi-lane process the Owner retired on
  2026-10-30 ("there is no orchestrator or bus any more").

### 1.3 The repository

- Private, not archived, description "AutomataFramework Plus paid extensions" (Plus has been free and MIT since
  #39). Last push 2026-11-01.
- 41 branches: `main` and 40 others. 39 are merged into `main`; `backup/m7-5b-9a43885` is an ancestor of `main`; one is
  not merged: `claude/plus-M7.7a-server-deploy`, six commits ahead of `main`, last one "connect check, box bundle and
  deploy runbook (M7.7a step 7, parked)", with no pull request.
- CI: one workflow, `.github/workflows/ci.yml`, on the label `af-mac` with the fork guard. Its last run, on `main` at
  `1766c622` on 2026-11-01, passed.
- 118 vitest failure screenshots are committed under `packages/net/.vitest/`, although `.gitignore` lists `.vitest/`.

## 2. What the framework changed, and where Plus meets it

| Change in the framework | Where | Where Plus meets it |
|---|---|---|
| Packages merged: `@automata/framework` holds host, runtime, render-pixi, ui, game and testing; `@automata/tools` holds ship, cli, node and the boundaries checker | #393 | 283 source files and 17 manifests (C2) |
| Scope renamed: `@mcthaydt/automata*` became `@automata/*` | #438 | every import and manifest, and Plus's own package names (C2, P-D2) |
| Root entry trimmed from 600 names to 274 | #395 | 5 UI names Plus imports are no longer exported (C3) |
| No Effect in the browser runtime | #399, #400 | `feel` and `net` (E1, E2) |
| Content root is the compiler; the page imports `@automata/content/schema` | #383, ported in #403 | 8 `*.content.ts` files (C4) |
| The network port removed from core | #390 | `net` mirrors it (E3) |
| `automata add`, the core-packs tool and the seams list removed | the 2D slice, task 17.x | `core:sync` (C1), the kit's install path (G2), `tooling/boundary` (C8) |
| Tests in `tests/`, `src/` by feature, comments without plan IDs or source names | #391, #392, #414 onward | the whole repository (section 4.3) |
| The DUEL palette replaces Endesga 64, including the game UI theme | 3D slice spec section 5 (planned) | the theme tokens the kit and `net-ui` use (D1) |
| The first public release on npmjs.org, as 0.1.0 | 2D slice task 14.2, done in #440 (`12bda870`) | Plus's peers and its version line (C5, C6) |
| One 3D package, one level format (`af-sector/2`), one timeline, the blockout format deleted | 3D slice (planned) | `sectors`, `cutscenes`, the blockout pipeline (X1 to X4) |
| One editor suite; gates and the change-set desk | 2D slice; 3D slice D6 | the pipelines' gate records (G1), Plus's content kinds (G3) |

## 3. Plus today: the run

On its pinned core, with Node 24.21.0 and pnpm 10.34.6:

- `pnpm core:sync`: fetched `f1b38528`, installed, built 16 framework packages with turbo and packed 14 into
  `.core/packs` in 41 s. `pnpm-workspace.yaml` came out unchanged.
- `pnpm install --frozen-lockfile`: passed.
- `pnpm check`: exit 0. Biome checked 779 files with no findings; `tsc` passed at the root and in every package; the
  boundaries checker read 121 sim files with 0 findings; vitest ran 2,042 tests in 252 files, all passing (the root's
  tooling 181, `server` 437, `net` 376, `pipelines` 235, `narrative` 135, `audio-synth` 81, `feel` 72, `physics` 71,
  `debug` 64, `dev-tools` 62, `systems` 60, `cutscenes` 56, `party-racer` 45, `puzzle` 43, `ui-screens` 41, `sectors` 34,
  `net-ui` 28, `nav` 21).
- The browser suites in Chromium only: section 8 has the counts. WebKit and Firefox are not installed in this session.

So the starting point is green. Every finding below is about moving, not about Plus being broken where it stands.

## 4. Findings

### 4.1 Getting core (C)

**C1. `core:sync` cannot build the head.** `tooling/core/sync-core.ts` runs `pnpm install`, `pnpm build` and then
`pnpm packs --out .core/packs --unpack --extra @mcthaydt/automata-sector-format --extra @mcthaydt/evidence` inside the
framework checkout. At the head the framework's root `package.json` has no `packs` script and `tooling/core-packs` is
gone (the 2D slice deleted "core-packs' Plus half", D12). Setting `core.ref` to the head fails at that step. The
framework's consumer smoke now packs each package with `pnpm pack` (`tooling/consumer-smoke/src/pack.ts`), which also
works for private packages.

**C2. The names.** 283 Plus source files and 17 manifests name a core package. The map, from the changesets
`one-browser-package-one-tools-package.md`, `scope-automata.md` and `boundaries-inside-tools.md`:

| Old name | New name |
|---|---|
| `@mcthaydt/automata-sim` (`/hash`, `/math`, `/replay`) | `@automata/sim` (same entries) |
| `@mcthaydt/automata-testing/sim/*` | `@automata/sim/testing/*` |
| `@mcthaydt/automata-content` (`/locale`) | `@automata/content` (same entries; see C4) |
| `@mcthaydt/automata-runtime/extension` | `@automata/framework/extension` |
| `@mcthaydt/automata-ui`, `-runtime`, `-game` | `@automata/framework` |
| `@mcthaydt/automata-ui/testing`, `@mcthaydt/automata-testing` | `@automata/framework/testing` |
| `@mcthaydt/automata-ui/theme.css` | `@automata/framework/theme.css` |
| `@mcthaydt/automata-node` | no public entry (C3) |
| `@mcthaydt/automata-check-boundaries` | the `automata-check-boundaries` bin of `@automata/tools` |
| `@mcthaydt/automata-sector-format` (`/blockout`) | `@automata/sector-format` at the head; `@automata/3d`'s level entry after the 3D slice (X4) |
| `@mcthaydt/evidence` (`/golden`) | `@automata/evidence` (private framework tooling, same entries) |

Run against Plus as it is, the head's boundaries checker finds 80 problems in the 121 sim files, every one the old sim
name (`@mcthaydt/automata-sim` 73, `/math` 6, `/hash` 1). No other rule fired.

**C3. Twenty names Plus imports are not public at the head.** A script read every import Plus makes of core (105
distinct names) and looked each one up in the head's API reports (`tooling/api-report/reports/*.api.md`), then compared
the declaration with the old core's report.

- 83 are public at the head with the same declaration once package names are normalised: all 46 sim names (`createSim`,
  `definePlugin`, the replay and hash helpers among them), the content schema API, the locale helpers, the test
  fixtures, and the five UI parts (`ActionBar`, `LoaderOverlay`, `Modal`, `ScreenFrame`, `ScrollList`), whose Svelte
  files differ from the old ones only in comments. `publishConditions` gained an optional fourth parameter, and
  `ExtensionDef` lost `layers` (Effect layers), which no Plus extension sets.
- 8 come from `-node` and have no public entry: `Files`, `FilesLive`, `FileError`, `ProcessRunner`,
  `ProcessRunnerLive`, `ProcessError`, `RunResult`, `TaggedErrorClass`. They still exist inside `@automata/tools`
  (`src/shared/node/`), but its `./internal` entry exports only ship helpers. Users: `dev-tools` and
  `tooling/pipelines`.
- 7 come from `@mcthaydt/automata-sector-format/blockout` (`Blockout`, `BlockoutError`, `Expanded`, `Room`, `ZoneSpec`,
  `blockoutSchema`, `expand`). They exist at the head (the API report's `./blockout` section is empty, but
  `packages/sector-format/blockout/index.ts` exports them), and the 3D plan deletes them (X3). User: `tooling/pipelines`.
- 5 UI names were dropped by the root trim: `ErrorPanel`, `ErrorAction`, `SettingsScreen` and `SettingsTab` (used by
  `kits/ui-screens`), and `UiComponent` (used by `debug`). All four components still exist inside the framework.
  `UiComponent` is worse than missing: the public `ExtensionDef.ui.slots` is typed
  `Record<UiSlotName, UiComponent>`, and neither `UiComponent` nor `UiSlotName` is exported from any entry, so an
  extension cannot name the type of the field it fills.

**C4. Plus's content kinds import the compiler into the page.** All eight `*.content.ts` files (`audio-synth`,
`cutscenes`, `feel`, `narrative`, `nav`, `puzzle`, `sectors`, `systems`) import `defineContentSchema` from the content
root, and each extension's `*.extension.ts`, which a game loads in the page, imports them. At the head the content root
is the Node compiler; the changeset `content-browser-entries.md` says code in the page must import
`@automata/content/schema`, because the root "reaches Node built-ins: under Vite's dev server those threw at boot and
left the page blank". The framework's own gate checks this (`automata-check-boundaries --browser
packages/content:game-config,locale,schema,palette,level-2d`). A rename to `@automata/content` alone would reproduce the
blank page.

**C5. The peers pin versions that no core has.** Plus's peers are exact: `-sim`, `-content`, `-runtime` and `-node` at
`0.0.3`, `-ui`, `-testing` and `-game` at `0.0.4`, `@mcthaydt/automata-check-boundaries` at `0.0.3`. The pinned core is
`0.0.4` and the head is `0.0.5`. The overrides block hides the mismatch today; against a registry these peers would not
resolve.

**C6. The first public version is 0.1.0, made in a commit the rest of the stack does not have yet.** The 3D spec
records "The first release is 0.1.0" (the Owner, 2026-11-07). #440's commit `12bda870` ("the first public release is
0.1.0, one changeset"; #440's head is `775ab1a4`) replaces every changeset with one, `first-public-release.md`, which
bumps the four public packages `minor`, and lets `check-changesets` accept that one `minor`. #441 to #445 were stacked
on #440 before that commit, so `ac899051` and `ff683ef0` still hold the old changesets and the "every release is a
`0.0.x` patch" rule. Nothing else this audit relies on differs: `git diff ac899051 775ab1a4` changes no file under
the four public packages' sources or the API reports. The packages' own versions stay `0.0.5` until the release runs.
Whatever Plus peers on should take 0.1.0. Nothing is on npmjs.org yet: that waits on the Owner's organisation,
`NPM_TOKEN` and the release approval.

**C7. Two packages Plus needs will never be on a registry as they are.** `sectors` builds on the private
`sector-format` (to become the private `@automata/3d`, public only on the day Pixi 3D is), and the tests of eight
packages use the private `@automata/evidence`. So even after 0.1.0 is published, Plus needs a way to get private
framework packages, and `@automata/3d` brings the vendored `@pixi/3d` tarball with it (`render-pixi3d` and
`editor-3d` depend on `file:../../vendor/pixi-3d/pixi-3d-0.1.0-beta.2.tgz`).

**C8. Plus's own rules assume the old scope.** `tooling/core/manifest-rules.ts` treats every `@mcthaydt/` name that is
not a Plus package as core (`CORE_SCOPE = '@mcthaydt/'`), so after the rename the "core is a peer, never a dependency"
rule would not see `@automata/*` at all. `tooling/boundary` (the F1 test) reads `.core/packs/packs.json`, which only the
deleted packs tool writes.

**C9. The copied configuration has drifted.** `tsconfig.base.json` says "Re-copy it when core.ref moves": the head adds
`allowImportingTsExtensions`. `biome.jsonc` keeps the head's formatter settings. Pins differ in small ways: Plus uses
`svelte` 5.57.3 and `vite` 8.3.5 where the framework pins 5.57.1 and 8.3.3, and `typescript` 6.0.3 in three Svelte
packages against 7.0.2 at both roots.

### 4.2 Effect and the runtime (E)

**E1. `feel` returns an Effect every frame.** `packages/feel/src/feel.ts` declares
`frameNow(drawnTick, alpha): Effect.Effect<FeelFrame>` and builds it from `Clock.currentTimeMillis`. Feel is
presentation, so it runs in the page, every frame. The head's law 5 says "the browser package `@automata/framework` is
plain TypeScript", the D2 decision moved the runtime off Effect, and the old rule already said "no Effect allocation per
frame".

**E2. `net`'s client uses Effect in the page.** `client/net-room.ts`, `client/room-store.ts`, `client/net-error.ts` and
`session/make-net-session.ts` import Effect. `server`, `dev-tools` and `pipelines` use Effect too, but they run in Node,
which the head allows.

**E3. `net` mirrors a port core deleted.** `packages/net/src/client/net-port.ts` says it is "the client end of core's
`NetworkPort`" with "core's exact signatures", to be "typed against core's once runtime publishes". #390 removed
`NetworkPort` and `AuthoritativeSnapshot` from core; its changeset says the net extension "will bring its own port".
So `net` now owns its port, and the comments promising to follow core are wrong.

**E4. What did not change.** `defineExtension`, `resolveExtensions` and the rest of the extension entry have the same
names; the sim API Plus uses is identical; the content schema API is identical; the UI parts' props are identical. For
the sim plugins (most of Plus by line count) the move is the rename and nothing else.

### 4.3 Layout, names and comments (L)

**L1. Tests sit beside the source.** 264 test files are next to the code they test; none is in a `tests/` folder. The
head's rule: "Tests live in `tests/` beside `src/`: `unit/<feature>/`, `browser/`, `e2e/`, `fixtures/` ... A test imports
the code it tests as `#src/…`, never by a relative chain into `src/`" (`AGENTS.md`), and the Owner's decision on
2026-11-05 was per-package `tests/` folders.

**L2. No package has the feature layout.** At the head, "Inside a package, `src/` is `app/`, `features/<x>/`, `shared/`,
`entries/` and `testing/`". Plus packages have a flat `src/` with role-suffixed files and folders such as `sim/`,
`play/`, `tools/`, `client/`, `session/`. The head's `--features` check, run over every Plus package, reports one finding
(`packages/net/src/test-support/net-room-harness.ts` imports `testing/`), only because it judges imports between the
known folders and Plus has almost none of them; it does not prove the layout.

**L3. The naming rule finds 32 files.** The head's `check-style` over Plus's `src/` folders: 19 "role-missing" (for
example `cutscene.plugin.ts` exports `createCutscenes`, a factory whose result holds the `definePlugin` value, and the
rule wants the `define*` result exported), 10 unknown roles in `tooling/pipelines` (`*.pipeline.ts`, `*.checks.ts`,
`*.generate.ts`, `*.import.ts`, `*.shots.ts`, `blockout.import-cli.ts`) and 3 files whose `define*` result needs a
role suffix (`net/src/test-support/counter-game.ts`, `server/src/test-support/fixture-game.ts`,
`systems/src/sim/watch.ts`). The factory pattern is a real design choice (an extension takes options); the plan has to
decide whether Plus changes or the rule learns factories.

**L4. Comments cite plans and name source projects.** 484 files cite a plan ID (`M6.8b`, `PRODUCT.6`, `SB-D6` and so on;
650 lines), and the head's `check-style --plan-comments` reports 401 comments in Plus's `src/` folders. 126 files name
the 2D source game and 22 the 3D one. The head's rules: "Comments say why. They do not say which plan asked for the
code", and AF is standalone, so code, tests and published text never name the source projects; where code came from is
recorded only in `docs/provenance/sources.md`. Plus has no such file: `starters/party-racer/SOURCE.md` and the comments
are its only record.

**L5. The starter is a sim, not a game.** `starters/party-racer` has `src/content`, `src/sim` and `src/testing`: no
`main.ts`, no view, no screens, so it does not run in a browser. The head's game layout (D13 A) is feature folders for
every game.

**L6. Housekeeping.** The 118 committed `.vitest` screenshots (section 1.3); `pnpm-workspace.yaml` lists `examples`, a
folder Plus does not have; `README.md` and `AGENTS.md` point at framework paths that moved to `docs/archive/`
(`docs/superpowers/plans/2026-10-23-product5-plus-repo-and-physics-move.md` and
`docs/superpowers/specs/2026-10-16-product-core-and-plus-design.md`); `docs/superpowers/plans/` holds 32 finished plans.

### 4.4 The palette and the UI (D)

**D1. DUEL reaches Plus only through the theme.** The 3D spec makes DUEL "AF's palette ... the game UI theme
(`@automata/framework/theme.css`)", choosing each theme colour as "the nearest DUEL colour that keeps the theme's
contrast pairs at their current ratios". Plus has no palette of its own: no Endesga reference, no `DEFAULT_PALETTE`, and
one literal colour (`#e8e8e8`, the dev-only overlay in `debug/src/DebugOverlay.svelte`). The kit and `net-ui` style
themselves with the theme's tokens (`--af-surface`, `--af-accent`, `--af-radius` and six more), all of which still exist
at the head. So DUEL changes their colours without a code change. What goes stale: the 19 review images in
`docs/evidence/owner-visual/product6-ui-screens-kit/`, which show the old theme. The layout tests check geometry, not
colour, so none fails.

### 4.5 Editors and tools (G)

**G1. The editor and the pipelines disagree on the gate file.** The head's editor reads a game's gate records as
`{ gates: [{ id, decision: 'approved' | 'rejected' | 'open', decidedAt?, url? }] }`
(`packages/editor/src/features/suite/node/gate-records.schema.ts`) and says "The pipelines platform owns the real shape
(the Plus pipelines) and replaces this when it lands". Plus's pipelines write `gates.json` as a record keyed by id, each
`{ id, stage, decision: 'pending' | 'approved' | 'rejected', files, ... }` (`tooling/pipelines/src/state.schema.ts`).
A real pipelines file is unreadable to the editor: wrong top-level shape, and `pending` where the editor expects `open`.
The mismatch was already in the old core (`editor-suite/src/node/gate-records.schema.ts` at `f1b38528`). Two shapes,
no owner.

**G2. The kit has no way in.** `kits/ui-screens/README.md` says the screens "are copied into your game
(`automata add ui-screens`)". The head's `automata` command has `create-game`, `ship`, `build`, `check` and `editor`;
`add` is gone (2D slice, D12 and D14).

**G3. Plus's content has no editor.** Plus defines eight content kinds (`feel`, `audio`, `cutscene`, `narrative`,
`nav-graph`, `puzzle`, `sector-map`, `systems`). The head's suite edits levels (2D and 3D), figures and `tuning.toml`;
an editor list row for any other kind shows "not installed". The editors the old suite expected from Plus (Feel,
Writer, Schematic, Sequence, from an `editor-plus` package) were never built, and the 2D slice took their cards off
Home. This is a gap to record, not one to fill: the Owner's rule is "editors have only essential features".

**G4. The framework still carries Plus remnants.** `tooling/examples-runner/src/catalog.ts` lists
`PLUS_MODULES = ['physics', 'net', 'feel', 'post']` and treats `@automata/physics` as the one extension package;
`tooling/versions/src/stack.ts` documents an `elsewhere` card for "physics, in automata-plus"; the editor's gate reader
names "the Plus pipelines" (G1). Under D12 A these are dead; if Plus is ported, they are the framework's side of the
contract and should name the real packages.

### 4.6 The 3D slice (X)

The 3D spec says "**Out:** Plus", at `ac899051` and again in the rewrite at `ff683ef0` (section 3). The 3D audit's D3
counted 1,558 source lines of the blockout format in the editor and did not mention Plus; neither does the rewrite's
plan audit (#445). All four overlaps below hold at `ff683ef0`.

**X1. Two owners for the level's sim side.** The 3D spec puts what the sim reads ("floors, walls, pits, things and
their fields, spawn") in `@automata/3d`'s `shared/level/sim/`, under the sim's boundaries (spec section 9). Plus's
`sectors` is that today: the `sector-map` content kind (TOML in `content/maps`, the sector format's own `SectorDef` and
`MassDef`), the checks a map passes before it resolves, `resolveMap`, the resolved-map resource and queries, the
sectors plugin, and colliders on `physics`. `nav`, `systems`, `narrative` and `cutscenes` read it (`InSector`,
`resolvedMap`). The 3D plan's task 7.1 writes `shared/level/sim/` new, with `simLevel(level: AfSector2): SimLevel`
exported from `@automata/3d/sim`, built from the `af-sector` schema rather than from Plus's resolution code; the
camera's sim part goes to `features/camera/sim`. And the game and the editor read `*.af-sector.json` files, while
`sectors` reads `content/maps/*.toml`: two files for one level.

**X2. Two keyed-time models for scripted scenes.** The 3D spec counts three time models (the framework's clips and the
two builders' actors and tracks; its risks table, section 14) and makes them one (section 8.3): `shared/timeline/` for
keys, eases and sampling, and a stage (`features/stage/`) whose `stage-script` content kind holds tracks (camera,
doors, lamps, time of day, grade, props) and cues that start clips. Plus's `cutscenes` is a fourth: a content kind of
scripts with camera keys (lens, ease, `cut`), light tracks naming lamps, captions and actors, a tick-time playback
plugin in the sim, its own `play/evaluate.ts` and its own eases.

**X3. The 3D plan deletes a format Plus reads.** The plan's task 4.1 deletes `packages/3d/src/shared/level/blockout/`,
the `./blockout` export and `toy-blockout.ts` (D3 A). The head's `blockout/index.ts` calls itself "the build-time half
the editor and the `pipe blockout` pipeline share": the pipeline is Plus's (`tooling/pipelines/src/blockout.*.ts`, 5
source files, and the `automata-blockout-import` bin), which imports all seven blockout names.

**X4. The sector format moves into a private package.** `sector-format` becomes `@automata/3d`'s `shared/level/`
(exported as `@automata/3d/level`), private until Pixi 3D is public, and gains `af-sector/2` (pits as a flag, non-box
rooms, entity definitions with fields, named views). Plus's `sectors` imports 12 names from the sector format's root
(`SectorDef`, `WallDef`, `Corner`, `Trim`, `STEP`, `WALL_THICK` and others); they will move entry and some may change
shape. (The 3D build's task 4.1 found them all still exported from `@automata/3d/level`.)

### 4.7 Process and repository (P)

**P1. The Owner's 2026-11-06 decision and the new ask point different ways.** D12 A (archive Plus; port an extension
into the framework when a game there uses it) was taken through "Go with all recommendations" on 2026-11-06; the
framework then removed its side. Archiving, the branch prune and the description were left to the Owner (D17) and have
not happened. The Owner's ask on 2026-11-07 is to bring Plus up to date. Section 6, P-D1.

**P2. CI uses a label the framework no longer uses for most jobs.** The head's workflows run on
`${{ vars.AF_LINUX_RUNNER || 'af-linux' }}` for the main jobs and on `af-mac` only for parity and release. Plus runs
everything on `af-mac` and pins that in `tooling/ci/workflows.test.ts`. Plus's `AGENTS.md` says a workflow change needs
the Owner's words in the pull request; the Owner's standing rule of 2026-10-31 ("everything is auto approved and
accepted") covers workflow changes now.

**P3. `net` and `server` are written for one target.** `packages/net/src/config/net.schema.ts` says the server URL "must
also be in `ruken.toml`'s `[network].connect`", and `server` builds its allowed origins from "the game's Ruken
`gameOrigin`". Since ADR 0006, `web`, `itch`, `ruken` and `tauri` are peer targets and no target is the reference.

**P4. The rules file describes the old setup.** `AGENTS.md` describes `core.ref` and `pnpm core:sync` as the only way to
get core, "until core is on a registry", the PRODUCT spec as the source of tasks and the F1 test as "not built yet"
(it was built in #3).

## 5. What carries over

- The sim plugins: identical API, the boundaries pass after the rename, cross-engine goldens recorded with the
  framework's evidence tool (same entries at the head).
- `physics`: the head's boundaries checker still allows Rapier's deterministic-compat builds in the sim, and the
  framework's examples catalog still names `@automata/physics` as an extension.
- The UI parts and the theme tokens the kit and `net-ui` use.
- Node tooling (`server`, `pipelines`, `dev-tools`) may keep Effect.
- MIT licence, fork-guarded CI, no secrets in the repository.

## 6. Decisions for the plan stage

Each has a recommendation. Under the Owner's standing rule ("everything is auto approved and accepted, do not wait on
me", 2026-10-31) the plan stage proceeds on the recommendations, except P-D1, which changes what the Owner decided on
2026-11-06 and went to the Owner as a question. The Owner's answer to P-D1 settles P-D3, P-D4, P-D5 and part of P-D10
too; those are marked below.

- **P-D1. Where Plus catches up. Decided: B.** The Owner first picked A on the decision card (2026-11-07 15:02 UTC,
  "Port it in its own repo"), then changed it three minutes later: "Actually no make them extensions because they're
  free anyway, and move the stuff 3D is doing here, and cut the starter" (15:05 UTC). So Plus's packages are ported
  into `mcthaydt/automata-framework` as `extensions/<name>`, on the current core, by feature, tests in `tests/` (D12's
  own "extensions/<name>" home, brought forward). This repository is archived once the port lands; archiving is the
  Owner's step.
  - A (recommended before the Owner's answer): in this repository, onto the new core. Plus keeps its own repository,
    CI and versions; every package moves to the new names, layout and rules; the parts that touch the 3D slice wait
    for its core part and then build on it (P-D4 to P-D6). Why: it is the repository the Owner named, it leaves the
    framework's 3D stack alone, and Plus stays the optional half.
  - **B (chosen):** into the framework as `extensions/<name>` (D12's eventual home), ported there; this repository is
    archived after. No core sync and one CI, but 31,500 source lines join the framework while its 3D stack is in
    flight.
  - C: keep D12 A: archive this repository now and port nothing until a framework game needs an extension.
- **P-D2. Package names.** **A (recommended):** `@automata/<name>` (`@automata/physics`, `@automata/net` and so on, the
  kit as `@automata/kit-ui-screens`), the project scope the framework moved to, and the name its examples catalog
  already uses for physics. None collides with a framework package at the head (the framework has `@automata/evidence`;
  Plus has no package of that name). B: `@automata/plus-<name>`.
- **P-D3. How Plus gets core. Settled by P-D1 B:** the extensions are workspace packages beside core, so there is no
  `core:sync`, no packs and no core pin; C1, C5, C7 and C8 go with this repository, and the private `@automata/3d` and
  `@automata/evidence` are reachable in the workspace. **Recommended:** each extension publishes as `@automata/<name>`
  once it is ported and checked (they are free, MIT), except one that depends on the private `@automata/3d` (`sectors`
  and what reads it), which waits for 3D to go public. The options considered before the answer: A, rewrite `core:sync`
  to pack the framework's packages with `pnpm pack` (as the consumer smoke does), the private ones included, until the
  four public packages are on npmjs.org; then the public ones resolve from the registry by range and only the private
  ones (`@automata/3d`, `@automata/evidence`) still come from packs. Peers become ranges that take the first public
  version (`^0.1.0`), not exact pins. B: a git dependency on the framework repository.
- **P-D4. One owner for the level's sim side (X1). Settled by the Owner's "move the stuff 3D is doing here":** the
  `sectors` extension owns it. Ported from Plus's `sectors` sim (resolution, checks, queries, the resolved-map resource;
  tested and deterministic today), it reads `af-sector/2` through `@automata/3d/level` instead of its own TOML maps,
  and it is what the 3D plan's task 7.1 called `shared/level/sim/` and `simLevel()`: the 3D slice keeps the
  `af-sector/2` schema, its migration and the world builder (presentation), and the base 3D game's sim reads the level
  through `sectors`. `nav`, `systems`, `narrative` and `cutscenes` read the same. The options considered before the
  answer: A, core owns it in `@automata/3d`, built from Plus's code; B, two owners.
- **P-D5. One owner for scripted scenes (X2). Settled the same way:** the `cutscenes` extension owns scripted scenes
  (its content kind, the tick-time sim plugin, the lints), in place of the 3D plan's `stage-script` content kind: the
  camera, lamp, door, time-of-day, grade and prop tracks and the cues that start figure clips become `cutscenes`
  tracks. One key and ease model stays: `cutscenes` samples with the 3D slice's `shared/timeline/` (or the plan stage
  moves the timeline's keys and eases somewhere both can reach) instead of its own `evaluate` and eases. Figure clips
  and `evaluate()` stay in `@automata/3d`. Which tasks of the 3D plan this removes or changes is the plan stage's first
  job, with the 3D build.
- **P-D6. The blockout pipeline (X3).** **A (recommended):** it goes with the format (the 3D plan's D3 A, done in the
  3D build's task 4.1); what it did (validate, generate, shots, import) is rewritten later against `af-sector/2` if a
  game needs it. B: the 3D plan keeps the format as an extension (its D3 B), owned by Plus.
- **P-D7. The missing names (C3).** **A (recommended):** ask the framework to export `UiComponent` and `UiSlotName`
  (its own `ExtensionDef` needs them) and `ErrorPanel`, `ErrorAction`, `SettingsScreen` and `SettingsTab` from
  `@automata/framework`, since the kit builds screens from them; Plus's Node tools keep their own small file and process
  seams over Node instead of asking for `-node`'s Effect services back, since those are test seams, not shared
  contracts.
- **P-D8. Effect in the page (E1, E2).** **A (recommended):** `feel` and `net`'s client become plain TypeScript like the
  framework's runtime (`feel` takes an injected clock, as the framework's `createTime` does); `server` and the Node tools
  keep Effect.
- **P-D9. The house rules.** **A (recommended):** the framework's, as written in its `AGENTS.md`: `src/` by feature,
  tests in `tests/` with `#src/…` imports, kebab-case role-suffixed files under 600 lines, comments without plan IDs or
  source names, and a `docs/provenance/sources.md` that records where code came from. Plus runs the framework's own
  checks (`automata-check-boundaries --features`, `--browser`, `check-style` with `--plan-comments` and
  `--test-imports`) instead of keeping copies.
- **P-D10. What has no consumer.** `dev-tools` (no caller), the kit (no `automata add`), the starter (not a runnable
  game), the parked server-deploy branch. **The starter is cut** (the Owner, 2026-11-07: "cut the starter"):
  `starters/party-racer` is not ported, and its parity golden goes with it. **A (recommended) for the rest:** port
  `dev-tools` and the kit with everything else, give the kit a documented copy step instead of `automata add`, and
  leave the parked branch for the Owner to keep or delete when the repository is archived. B: retire `dev-tools`.
- **P-D11. The gate file (G1).** **A (recommended):** one shape, owned by the pipelines, published as a schema the
  editor imports; until then the editor reads the pipelines' shape. B: the pipelines write the editor's shape.

## 7. For the plan stage

1. **P-D1 is B** (the Owner, 2026-11-07 15:05): everything below lands in `mcthaydt/automata-framework` under
   `extensions/`, and the plan and its tracking live there.
2. **The workspace first:** an `extensions/*` glob in `pnpm-workspace.yaml`; each extension on the framework's
   `boundaries` (sim roots and `--features`), `style`, `source-names` and `knip` lines and in CI's unit, browser and
   parity jobs; the names `@automata/<name>` (C2, P-D2); the content entry fix (C4). Plus's own `tooling/core`,
   `tooling/boundary` and `tooling/ci` are not ported: the framework's checks replace them (P-D9). Measure: `pnpm check`
   green with the first extension in.
3. **The parts the 3D slice does not touch:** `physics`, `net`, `server`, `net-ui`, `feel`, `audio-synth`, `debug`,
   `puzzle`, `dev-tools`, `kits/ui-screens` and `tooling/pipelines` (without its blockout part), each moved to the house
   rules (P-D9), with E1 to E3 and P3 fixed on the way and P-D7's names exported. Not `starters/party-racer` (cut).
4. **The parts it does touch, with the 3D build:** `sectors` becomes the level's sim side on `af-sector/2` (P-D4),
   `cutscenes` the scripted scenes on the shared keys and eases (P-D5), then `nav`, `systems` and `narrative` on them,
   and the gate file settled (P-D11). The order against the 3D build's tasks (7.1 and the stage) is agreed with it
   first, so neither side writes the same code twice.
5. **The framework's side:** the 3D build was told about X1 to X4 on 2026-11-07, and its plan's notes say to read
   this pull request before task 7.1; P-D4 and P-D5 above are the answer. The G4 remnants become real: the
   examples catalog's `PLUS_MODULES` and the gate reader name the ported extensions, and `stack.ts`'s `elsewhere` card
   ("physics, in automata-plus") points at `extensions/physics`.
6. **Housekeeping:** the review images after DUEL; the `.vitest` screenshots and the old `README.md` and `AGENTS.md`
   are not ported. This repository's archive, its description, its branches and the parked server-deploy branch are
   the Owner's.
7. **Gates for every phase:** `pnpm check`, the browser suites in Chromium here and in WebKit and Firefox on the
   Owner's Mac, cross-engine goldens unchanged (a hash change is investigated, never re-recorded to pass), and the drunk
   grandma test for every word a player sees in the kit, `net-ui` and `debug`.

## 8. How it was checked

Plus at `1766c622`, the pinned core `f1b38528`, the framework head `ac899051`, Node 24.21.0 (pnpm's `useNodeVersion`),
pnpm 10.34.6.

- **Plus's own gate:** `pnpm core:sync` (41 s), `pnpm install --frozen-lockfile`, `pnpm check` (exit 0, counts in
  section 3).
- **Plus's browser suites, Chromium only:** in each package with one,
  `pnpm exec vitest run --project 'browsers (chromium)'` (or `'layout (chromium)'` for the kit and `net-ui`). Results
  are in the "Browser run" list below.
- **Imports:** a script parsed every `import` and `export … from` in Plus's `packages`, `kits`, `starters` and
  `tooling` (the F1 test's own fixtures excluded), mapped each core specifier to its new package and entry (C2's table),
  and looked up each name in the head's `tooling/api-report/reports/*.api.md`; a second script compared each found
  name's declaration with the old core's report. Svelte components were compared file by file.
- **The head's rules on Plus:** the head's `packages/tools/src/features/boundaries/cli.ts` over Plus's nine sim roots
  (80 findings, all the old sim name) and with `--features` over every package (1 finding); the head's
  `tooling/check-style/src/cli.ts` over every `src/` (32 naming findings), with `--plan-comments` (433 findings, 401 of
  them plan comments) and `--test-imports` (no files: Plus has no `tests/` folders).
- **Counts:** `git ls-files` with `grep` for test placement, plan IDs
  (`\b(M[0-9]+\.[0-9]+[a-z]?|PRODUCT\.[0-9]+[a-z0-9]*|M[0-9]+-D[0-9]+|P5-D[0-9]+|SB-D[0-9]+)\b|spec §`), the framework's
  source-name patterns (`tooling/repo-hygiene/src/source-names.ts`), Effect imports, colours and theme tokens.
- **GitHub:** the branches and pull requests of both repositories, Plus's workflow runs, and the repository search for
  visibility and description. Merged state with `git merge-base --is-ancestor` on a full clone.
- **The rewritten 3D plan:** its spec, plan and plan audit read at `ff683ef0` (`git show`), searched for Plus, the
  blockout format, the level's sim part, the timeline and the sector format; the passages section 4.6 cites were read
  in full.
- **Not run:** WebKit and Firefox (not installed here); Plus's CI on the Owner's Mac; anything against npmjs.org (core is
  not published); Plus against the head (it cannot sync, C1), so breakage beyond names and declarations, such as
  behaviour, is not measured here.

### Browser run (Chromium, pinned core)

Every suite passed:

| Package | Project | Files | Tests |
|---|---|---:|---:|
| `cutscenes` | browsers (chromium) | 1 | 1 |
| `narrative` | browsers (chromium) | 1 | 1 |
| `nav` | browsers (chromium) | 1 | 2 |
| `physics` | browsers (chromium) | 2 | 2 |
| `puzzle` | browsers (chromium) | 1 | 1 |
| `sectors` | browsers (chromium) | 1 | 2 |
| `systems` | browsers (chromium) | 1 | 1 |
| `starters/party-racer` | browsers (chromium) | 1 | 2 |
| `debug` | browsers (chromium) | 1 | 6 |
| `net-ui` | layout (chromium) | 1 | 50 |
| `kits/ui-screens` | layout (chromium) | 6 passed, 1 skipped | 550 passed, 1 skipped |

The nine `*.parity.test.ts` files (the sim packages, `physics` and the starter) check the cross-engine goldens; here
they ran in Chromium only. WebKit and Firefox, which the parity rule also needs, wait for the Owner's Mac.
