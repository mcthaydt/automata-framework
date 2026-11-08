# 2D editors and website refactor: plan audit

- **Stage:** 3 of 6 of the "2D editors and website" slice (plan audit), 2026-11-06.
- **What it checked:** the [spec](2026-11-06-2d-editors-and-site-spec.md) and the [plan](2026-11-06-2d-editors-and-site-plan.md)
  (PR #406, head `37ec9910`: 21 phases, 63 tasks) against the [2D editors and website audit](2026-11-06-2d-editors-and-site-audit.md)
  (PR #405), the [rest-of-AF audit](2026-11-06-2d-ship-rest-audit.md) (PR #407), decisions D1 to D17, each other, and the
  code: this repository at the stack's head (#403's code, unchanged by #405 to #407) and `mcthaydt/automata-website` at
  `4a514eb3`. Every finding below was checked in the code; the evidence column says where.
- **Outcome:** 30 findings. All are fixed in the spec and plan in this pull request, except the calls in the last
  section, which are the Owner's. The spec's veto defaults 1 to 13 are kept; this audit adds 14 to 16. The plan still
  has 21 phases and 63 tasks.
- **Accepted** under the Owner's standing rule: "Auto accept all spec and plans" (2026-10-30) and "Reminder that
  everything is auto approved and accepted, do not wait on me to do any approvals" (2026-10-31).

## The Owner's two asks, checked

**"Completely redesign the editors for ux, copy, and ui ... it should have the design aesthetic of the website".**
Covered for what ships in this slice: one token source shared by the site and the editor (spec 11.2, task 11.1), the
kit's components rebuilt to the site's controls with a design board (11.3, task 11.3), every 2D editor screen
re-laid out phone first (11.4, phase 12), and every string through the drunk grandma test (11.5, tasks 12.5 and 20.1).
The 3D editor, the Studio and the suite are not redesigned here, because they do not ship until 3D. The spec said so
only in its "Out" list; the Owner asked for "the editors", so the 3D slice's row in `progress.md` now records that it
owes their redesign in this look (PA27). Two gaps in how the look is carried over are fixed: the token test checked 17
of the site's 36 custom properties (PA20), and the editor would have used viewport-scaled type (PA29).

**"Minimal, well-documented, non-overengineeered code", "elegant".** Covered by spec section 17 and four measured
refactor passes (tasks 3.5, 4.6, 17.3, 18.5), each starting with a written read before any change. Two gaps: the
`.svelte` views were left to the redesign "to meet the standard there" with no step that checks them (PA24), and the
plan itself added machinery the standard rules out: a new bin and a new scan function where one exists (PA2, PA3), a
second copy of the playground protocol by re-export (PA17), two descriptions of the release (PA22) and an "if cheap"
choice left open (PA28). Each is cut back to the one existing way.

## Findings that would have stopped the build

| # | Finding | Evidence | Fix |
|---|---|---|---|
| PA1 | Task 4.4 adds `--forbid` and the shared-island rule in `tooling/check-boundaries/src/`, but task 3.3 (phase 3, earlier) moves that package into `packages/tools/src/features/boundaries/` and deletes the folder. | plan 3.3 "Delete: `tooling/check-boundaries`"; plan 4.4 file list | 4.4's files are under `packages/tools/src/features/boundaries/` and `packages/tools/tests/unit/boundaries/`; spec 3.5 says the same. |
| PA2 | Task 8.1 made the editor's build run a new `automata-scan-closed-beta` bin from `-tools`. `-tools` already depends on the editor (today `-editor-suite` for the editor list; from 6.3 the editor for the level export and from 7.2 for its build), so the editor depending on `-tools` is a cycle pnpm and turbo refuse. The step also still held drafting text ("from `-tools`' source? no: from a tiny copy is forbidden"). | `packages/tools/package.json` devDependencies; plan 6.3, 7.2, 8.1 | No new bin. `-tools`' `copy-editor.ts` scans both editor builds (`dist/2d`, `dist/suite`) before copying; the site's build scans through a script importing `-tools/internal` (the site depends on `-tools`, never the reverse). 8.1 is reduced to the suite build's scan test. |
| PA3 | Spec 7.3 and task 7.2 create `findClosedBeta` in a new `closed-beta.ts`, "moved, not duplicated", but `findPixi3d` already does this in `shared/ship/prepare/pixi3d-markers.ts`, called by `prepare-build.ts`, `prepare-itch.ts` and `prepare-tauri.ts`. Task 3.2 (phase 3) also calls `findClosedBeta` four phases before 7.2 creates it. | `grep -rn findPixi3d packages/tools/src` | Every caller uses `findPixi3d`; 7.2 creates no scan file; veto default 16. |
| PA4 | The move map sent `editor-suite/src/main.ts` to `editor/src/app/suite/main.ts`. That file imports `@mcthaydt/automata-editor-3d/suite` and the Studio, so after the merge `editor` would import `editor-3d` (a cycle, since `editor-3d` imports `editor`, and the `--forbid` rule fails). Phase 8 was where it became 2D only, four phases too late. The moved Studio also imports `../../../core`, `shell/boot` and `shell/create-suite`, which `./suite` did not export (`startSuite` is not a name in the code). | `packages/editor-suite/src/main.ts` lines 4 to 11; `editors/studio` imports | Task 4.2 step 4 writes the 2D-only page at the merge; `./suite` exports what the codemod's `--surface` report finds the Studio and `editor-3d` import; spec 3.2 and 3.4 say so. |
| PA5 | The map row `editor-suite/src/core/` → `shared/editor-list/` would put the suite's Ask session, change-set journal, interchange, pills, Review, reopened gates, ship draft and text diff into the shared editor list that `-tools` bundles. | `ls packages/editor-suite/src/core` (13 modules, 5 of them the editor list) | The editor-list half (`editors.schema`, `editor-list`, `glob`, `write-path`, `workspace-policy`) goes to `shared/editor-list/`; the rest to `features/suite/core/`. Spec 3.2 updated. |
| PA6 | `save-to-game.ts` was placed in `features/document/` and reuses `writeToFolder`, which lives in today's `app/export/write-folder.ts`, that is `features/share/` after the move: a feature importing another feature, which 4.4's rule refuses. | `packages/editor-2d/src/app/export/write-folder.ts`; spec 3.3 rule 1 | `write-folder.ts` moves to `shared/kit/storage/` in the map; `save-to-game.ts` lives in `shared/level-2d/profiles/level-project/`; `app/editor-2d` passes it to the document feature. |
| PA7 | The 2D editor's golden project (`browsers`: the `*.parity.test.ts` auto-tile hashes in Chromium, WebKit and Firefox) was missing from the spec's browser projects, and task 4.3 sent `.parity` tests to `tests/unit/` "and also in the browser through `alsoInNode`", which is backwards: `alsoInNode` makes a browser test also run in Node. The cross-engine golden rule would have lost three engines. | `packages/editor-2d/vitest.config.ts` project `browsers`; `tooling/vitest-preset/src/index.ts` `alsoInNode` | A `parity` browser project in all three engines, files in `tests/browser/parity/`, listed in `alsoInNode`. Spec 3.3, 4 and plan 4.3 updated. |
| PA8 | The 2D gate would still miss two kinds of editor test. The editors' journeys run only through the root `test:journeys`, which only `3d-and-editors.yml` calls; ci.yml never does. `editor-2d`'s canvas project runs in no workflow (its `test:browser` is `browsers` and `layout`). Folding them into each package's `test:browser` (task 1.1) also makes the 3D workflow's unfiltered `pnpm test:journeys` run the 2D journeys a second time. | `ci.yml`, `3d-and-editors.yml` line 67; editor `package.json` scripts | Task 1.1 names both moves and why; task 1.2 gives the 3D workflow a filtered `test:journeys:3d`. |
| PA9 | Emberwick's drift check was to run "in `pnpm check` through its `check:example` script". `check:example` is a script of `-tools`, not Emberwick, and no gate or workflow runs it; `pnpm check` is lint, typecheck, boundaries, style, knip, unit tests and changesets. | root and `packages/tools/package.json`; `grep -rn check:example .github` (none) | A `-tools` unit test runs the levels step over the real `games/emberwick`, which is in `pnpm check`. Spec 6.3 and plan 6.3 updated. |
| PA10 | The codemod commands do not exist as written: `node tooling/codemods/src/cli.ts move --map …` and `… cli.ts move-tests packages/editor`. The module mover is `move-modules-cli.ts --map … [--dry-run] [--surface]`; `cli.ts` is the test mover and takes `<package> --environment node\|jsdom`. | `tooling/codemods/src/{cli.ts,move-modules-cli.ts}` | Commands corrected in 4.1, 4.2 and 4.3, and listed once in the plan's header. |
| PA11 | Phase 3's paths were wrong: `shared/ship/deploy-dev*` is `shared/ship/targets/ruken/deploy-dev.ts`; `ship-args.ts` is `cli-args.ts`; `prepare.ts` is `prepare/prepare-build.ts`; the alias is two files (`ship-alias.ts`, `ship-alias-bin.ts`); `deployDev` and `testRemote` also branch in `cli-args.ts`, `errors.ts`, `prepare-mode.ts`, `ship-config.ts` and `ship-cli.ts`. The published `./e2e` entry (17 names, used only by `examples/`) was in no task. | `ls packages/tools/src/...`; `grep -rln "deployDev\|testRemote"`; `package.json` `publishConfig.exports` | Paths corrected in 3.1 and 3.2; `./e2e` leaves `publishConfig.exports` (spec 16.2, plan 3.3). |
| PA12 | Shrinking `-tools`' root to `defineShipConfig` breaks named importers the task did not list: `rukenHeaders` in both games' `vite.config.ts`, `checkManifest`, `inputsProblems` and `rukenToml` in both games' ship-config tests, `examples-runner`'s playground and preview headers, and the consumer smoke's fixtures, which import the **packed** package (`prepareBuild`, `ProcessRunner`), where `./internal` does not exist. | `grep -rn "from '@mcthaydt/automata-tools'"` outside the package | Task 3.3 names them; the smoke's fixtures check only the published surface. |

## Findings that would have caused harm or rework

| # | Finding | Evidence | Fix |
|---|---|---|---|
| PA13 | The golden: "the sim receives the same values" was assumed. The content hash is part of Emberwick's state hash, today's kinds are `z.looseObject`, and the moved schemas are strict; a strict schema that strips, defaults or reorders a field changes what the sim gets and so `GOLDEN_HASH`. `content.schema.ts` also imports the `LevelNeighbours` type from the editor's model, which the move did not take, and the plan's file list renamed `field.schema.ts` to `fields.schema.ts`. | `games/emberwick/src/testing/golden.ts` comment ("the content hash is part of the state hash"); `src/shared/kinds.ts`; `content.schema.ts` line 9 | Spec 5: the first check is `sim-content.json` byte for byte; if it differs, the sim's `levels` kind keeps today's shape. `LevelNeighbours` moves with the schema. |
| PA14 | `editor-2d`'s own architecture test (pure core, profile isolation, no profile ids in generic areas, cycles) was in no spec section. It matches paths relative to `src/` (`model/`, `tiles/`, `canvas/draw/`, `app`), so after the move every rule matches nothing and the test passes on an empty tree. Checked here: it does run under the preset's Svelte plugin and `browser` condition (23 of 23 pass in Node), so the preset needs no exception. | `packages/editor-2d/src/testing/architecture.ts`; a throwaway Vitest config with `resolve.conditions: ['browser']`, deleted after | Plan 4.2 step 6 remaps the prefixes and asserts each matches files; spec 3.3 says the test stays. |
| PA15 | The move map's table missed files the dry run would stop on: `app/level-editor.ts`, both `journeys/` folders, the kit's root `tokens.css`, `fonts.css` and `index.ts`, the `vitest-setup.ts` files, `editor-kit/scripts/remove-profiles.ts`, the suite's `shims/` and `main.css`. The second `memory-workspace.ts` is the kit's `ports/testing/`, not a `testing/` folder. | `ls` of each package's `src/` | Rows added in 4.1. |
| PA16 | Numbers left over from before phases 2 and 3 were inserted: 4.2 "2.3 moves them" (4.3), 4.5 "`tokens.json` already moved in 2.1" (4.2), spec 14 "Phase 2 is moves only" (phase 4), spec 7.1 "B4" (the core build audit's finding). | the texts | Corrected. |
| PA17 | The playground: spec 10.1 and task 10.2 re-exported the protocol and headers "from `tooling/examples-runner`'s package entries", but no entry exports them; spec 16.6 instead moves the playground half into the site, and no task did that move (17.2's list omits `examples-runner`). The site is the playground's only user. | `tooling/examples-runner/package.json` `exports`; site's `src/lib/playground/protocol.ts` header ("Copied from …") | Task 10.2 moves the playground half (source, build scripts, its four e2e tests) into the site; 17.2 checks what is left; spec 10.1 and 16.6 agree. |
| PA18 | Where the site gets the editor build: spec 10.1 said from `-tools`, task 18.3 copies `packages/editor/dist/2d`. | spec 10.1; plan 18.3 | From `editor`, which the site already depends on for the tokens. |
| PA19 | "SvelteKit's latest 2.x that runs on Vite 8" exists (2.70.4 peers on Vite `^8` and the plugin `^7`), but both SvelteKit 2 and 3 (3.1.1, released 2026-10-29) peer on TypeScript 6, so the root's TypeScript 7 pin cannot apply to the site. The subtree also brings a second lockfile, a licence, `.nvmrc`, two agent scratch folders and the site's own `docs/`, which no task removed. | `npm view @sveltejs/kit@2 peerDependencies`; `ls -a` of the website | Exact pins named in spec 10.1 and task 10.3, TypeScript 6.0.3 kept (veto default 14); task 10.1 deletes the extras (the site's plans to `docs/archive/site/`). |
| PA20 | The token test hand-listed 17 names; the site's `:root` defines about 36 (`--surface`, `--glow`, `--flutes`, `--curtain`, `--stage*`, `--teal`, `--gutter`, `--ease-out`, …). The site would lose the rest when its block is replaced by the import. The old editor names were aliases "for one release", which means nothing for a private package, and no task removed them. | `automata-website/src/app.css` lines 5 to 47 | The test reads the names and values from the site's current block. The kit moves to the new names in phase 11; the aliases stay only for `editor-3d`, and the 3D slice deletes them (recorded in `progress.md`). |
| PA21 | The source-names rule was to run over `docs/` outside `archive/` and `provenance/`, which includes `docs/refactor/`, where every audit names the source projects as evidence: `pnpm check` would fail on this slice's own records. | `grep -rlci floorfifty docs/refactor` | `docs/refactor/` is exempt, as it is for the plan-comment rule. |
| PA22 | The release was described twice (spec 8 "superseded where they differ", and 16.3), and the two disagreed on deprecating the GitHub Packages names (8: deprecate; 16.3: one `npm deprecate` line; the rest-of-AF audit U7: none needed). Task 21.2 kept a deprecation step. | spec 8, 16.3; audit U7 | Section 8 points at 16.3; no deprecation (veto default 15); 21.2 says the Owner may delete the old versions if wanted. |
| PA23 | Tasks that cannot fit a 90-minute session had no named breaks: 4.5 rewrites about 943 plan-ID comments (the core slice named breaks for 1,385), and the four refactor passes and 16.3 each cover a whole area. | plan header "Sessions" | The header lists 3.5, 4.5, 4.6, 16.3, 17.3 and 18.5 too; 4.5 and 16.3 name their breaks. |
| PA24 | Spec 17.4 says the `.svelte` views "meet the standard" in phase 12, but no phase 12 step ran the read, and 12.4 restyles Map, Tiles and Characters without necessarily touching their logic. The 2D editor alone has 6,775 lines of `.svelte` views. | spec 17.4; plan phase 12; `find packages/editor-2d/src -name '*.svelte' \| xargs cat \| wc -l` | Phase 12's preamble: each task starts with 17.3's read over its components and closes it; 12.5's new step 0 checks every `.svelte` file (size, header). |
| PA25 | Spec 3.3's tree put browser tests in `tests/browser/<feature>/`; the preset and plan use one folder per project (`tests/browser/layout/`, …). | spec 3.3; plan 4.3 | The tree shows `browser/<project>/<feature>/`. |
| PA26 | Task 14.1 waits on the Owner's npm organisation name but sat in the middle of a stack of PRs each based on the one before, so phases 14.2 to 21 would queue behind an Owner input. | plan "Pull requests"; 14.1 | 14.1 is its own PR off the stack's head whenever the name arrives; nothing later waits (plan header and 14.1). |
| PA27 | The Owner asked to redesign "the editors"; the 3D editor, the Studio and the suite are deferred to the 3D slice, but only this spec's "Out" list said so, and the 3D slice starts from its own audit. | spec 2, 11.6; `progress.md` 3D row ("Not started") | `progress.md`'s 3D row lists what the 2D slice leaves it: the redesign of `editor-3d`, the Studio and the suite, the suite's copy and wiring, the token aliases, the 3D code refactor. Spec 2 says it. |
| PA28 | Task 11.3 left the no-literal-colours guard open ("a Biome or style rule if cheap; otherwise a test"). | plan 11.3 step 2 | One unit test over the kit's styles. |
| PA29 | The site's type steps `--step-lead` to `--step-display` are `clamp(…vw)`, sized by the viewport. AGENTS.md: layout depends on container size, and keyboard or browser-bar changes must not reflow the screen. | `app.css` lines 42 to 45 | The editor uses the fixed steps (micro, small, body) only (spec 11.2). |
| PA30 | The spec and plan link `2026-11-06-2d-ship-rest-audit.md` (three times, and cite its findings throughout), but #406's branch was stacked on #405, not #407, so on that branch the file does not exist (and 16.5's new links rule would fail on it). | `git show origin/claude/project-thread-y6u4wj:docs/refactor/` (no such file) | This pull request merges #407's two commits into the stack, so the links resolve here; #406, #407 and this one merge in that order. |

## Checked and found right

- The 63 tasks are what the header says, every phase in spec 12's table has its tasks, and each of D1 to D17 lands in a
  task (D8 and D17 as the Owner's steps in 21.2).
- Every finding of both audits that the plan names has a task: E1 to E7, S1 to S7, K1, T2 to T5, G1 to G5, W1 to W9, WS1 to
  WS6, WT1, WT2, WG1 to WG3, N1 to N7, U1 to U7, R1 to R7, A1 to A7, Q1, Q2, Q4, Q5, Y1 to Y3, P5 to P7. K2 (no "play this
  level"), Q3 (self-hosted runners with no fork guard) and P1 to P4 are rightly left out: K2 is a new feature, Q3
  matters when the repository opens with 3D, and Plus is frozen (D12).
- The editor's real facts match the plan: the five game-file paths of Emberwick's room, `GOLDEN_HASH` `421c5a1bf522299e`,
  `exportContent`, `openProject`, `fileAccess`, `loadEditorList`, `createSuite`, `createLevels2d`, `createTuner`, the
  `--app` default `3d` and `builtApp`, `-tools`' devDependency on the suite for the editor list, and the `fixed`
  changesets group.
- Effect stays only in Node tooling (`-tools`, the content compiler), as the core slice decided; the plan adds none to
  the browser.

## Calls for the Owner

1. **The npm organisation's name** (D9, D17). It is the one input a task (14.1) waits on, and nothing else waits on it.
   The audit's example was `@automata-framework`.
2. **The veto defaults stand**, 1 to 13 as the spec had them, plus three this audit adds: the site stays on SvelteKit 2
   and TypeScript 6 (14), the GitHub Packages names are not deprecated (15), and the closed-beta scan is the existing
   `findPixi3d` with new callers (16). Under the standing rule these are accepted unless the Owner says otherwise.
3. **D8's and D17's inputs and actions** are unchanged: the domain, the host and its secret, the contact address,
   `NPM_TOKEN`, the skills token, archiving, branch prunes in Plus and the website, repository descriptions, and whether
   outside authors can publish to Ruken. Real-device play on the iPad stays the Owner's.

## Appendix: how it was checked

The stack's head (#406 at `37ec9910`, #407 at `6146efcc`), Node 24.22.1 (`/opt/node24/bin`), pnpm 10.34.6, `pnpm install
--frozen-lockfile`.

- **Files and names:** `ls`, `find` and `grep -rn` over `packages/`, `tooling/`, `games/`, `examples/` and
  `.github/workflows/`, for every path, function and script the plan names.
- **Scripts and gates:** the root and package `package.json` scripts, `ci.yml` and `3d-and-editors.yml` read in full.
- **The architecture test under the preset's conditions:** a throwaway Vitest config in `packages/editor-2d`
  (`svelte()` plugin, `resolve.conditions: ['browser']`, Node) over `src/architecture.test.ts`: 23 passed. The config
  was deleted after.
- **SvelteKit's peers:** `npm view @sveltejs/kit@2 peerDependencies` and `npm view @sveltejs/kit@latest peerDependencies`.
- **The website:** its `package.json`, `src/app.css`, `src/lib/playground/` and `ls -a` at `4a514eb3`.
- **Not run:** any build, browser suite or journey (this stage changes documents only); WebKit and Firefox.
