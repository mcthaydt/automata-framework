# Refactor progress

**Overall: 44% (8 of 18 stages done).**

The Owner's order: finish one slice completely before starting the next. On 2026-11-05 it was core and 2D, then 3D, then
the editors, then the website. On 2026-11-06 the Owner changed the later slices to vertical ones: "we do the editor
refactors that 2D touch and website refactor as if it's ready to ship with 2D alone, then we do the same for 3D". So the
slices are core and 2D, then the 2D editors and the website, then 3D (its core, editors and site). Each stage runs in its
own session.

Every area goes through the same six stages:

1. **Audit** (Opus, extra-high effort): what is there, measured.
2. **Plan and spec** (Opus, medium, with the superpowers plugin).
3. **Plan audit** (Opus, medium).
4. **Build** (Sonnet, high), updating this page as each step lands.
5. **Build audit** (Opus, medium): complete, consistent, matches the spec and the codebase.
6. **Fixes** (Sonnet, high): every finding from stage 5 closed.

Copy and UX pass the drunk grandma test: could a drunk grandma tell what is happening and how to use it?

## Core and 2D: 83% (5 of 6: stages 1, 2, 3, 5 and 6; the build stays open until 30 of 30)

| Stage | Status | Record |
|---|---|---|
| 1. Audit | Done, 2026-11-05; the Owner took all four decisions (D1 to D4) the same day | [2026-11-05-core-and-2d-audit.md](2026-11-05-core-and-2d-audit.md) |
| 2. Plan and spec | Done, 2026-11-05 | [spec](2026-11-05-core-and-2d-spec.md), [plan](2026-11-05-core-and-2d-plan.md) |
| 3. Plan audit | Done, 2026-11-05: 31 findings, all fixed in the spec and plan; three calls left for the Owner | [plan audit](2026-11-05-core-and-2d-plan-audit.md) |
| 4. Build | In progress: 27 of 30 tasks done locally. Open: 2.1 (the tag push is the Owner's), 8.2 (the Ruken boot-failure journey needs a refusal switch in Ruken's fake host), 9.2 (the Owner's go). PRs #388 to #401 (stacked) | [plan](2026-11-05-core-and-2d-plan.md) |
| 5. Build audit | Done, 2026-11-06: 4 broken (B1 to B4), 8 spec gaps (C1 to C8), 4 tracking (D1 to D4), 2 unverified (E1, E2), 5 copy (G1 to G5), 6 tidy (L1 to L6); `pnpm check`, `pnpm build` and Emberwick's 28 Chromium journeys pass | [build audit](2026-11-06-core-and-2d-build-audit.md) |
| 6. Fixes | Done, 2026-11-06 (PR [#403](https://github.com/mcthaydt/automata-framework/pull/403)): every finding closed in the tree except what only the Owner or a runner can do (E1: WebKit, Firefox, `pnpm lint:actions`, hosted CI, merging the stack). Running E1 here found three more packaging bugs, fixed | [stage 6 record](#stage-6-record-2026-11-06) |

### Where to resume (2026-11-06, stage 6 done)

The PRs are stacked, in this order: #388 (phase 1, not a draft) ← #389 ← #390 ← #391 ← #392 ← #393 ← #394 ← #395 ← #396 ←
#397 ← #398 ← #399 ← #400 ← #401 ← #402 (the build audit) ← #403 (the fixes).

**Everything that can be done from a cloud session is done.** What is left is the Owner's:

1. **Run the cross-engine checks:** `pnpm ci:local` on a Mac or a runner (WebKit and Firefox are not installable in cloud
   sessions), and `pnpm lint:actions` (needs Docker). Criterion 1 ("journeys pass in Chromium and WebKit") is unproven until then.
2. **Mark the PRs ready and merge them bottom up** (draft pull requests skip `e2e-2d` and `parity`). Squashing the stack into
   fewer pull requests is an option; it is the Owner's call.
3. **2.1:** push the tag `pre-refactor-2d` (refused with HTTP 403 from a cloud session), then deprecate the old package names in the registry.
4. **8.2:** ask Ruken for a refusal switch in its fake host, then add the boot-failure journey.
5. **9.2:** say go, and the branch clean-up runs.
6. Play Emberwick on the iPad from the last build.

Next area: 3D. It starts when the Owner has taken 1 to 3 and the stack is merged.

### Build: 90% (27 of 30 tasks)

Counted from the rows below: 27 are done, 2.1 and 8.2 are partly done and 9.2 has not started. "Done locally" means `pnpm check` and the Chromium suites passed on the branch; the plan's "green, merge" steps stay open until the Owner's runs ([plan](2026-11-05-core-and-2d-plan.md)).

| Task | Phase | Status | PR |
|---|---|---|---|
| 1.1 Per-area Playwright configs | 1 | Done, 2026-11-05 (hosted CI not run) | [#388](https://github.com/mcthaydt/automata-framework/pull/388) |
| 1.2 The pull request gate | 1 | Done, 2026-11-05 (hosted CI not run) | [#388](https://github.com/mcthaydt/automata-framework/pull/388) |
| 1.3 Frame budget skips on a software renderer | 1 | Done, 2026-11-05 (hosted CI not run) | [#388](https://github.com/mcthaydt/automata-framework/pull/388) |
| 1.4 `.vscode` | 1 | Done, 2026-11-05 (hosted CI not run) | [#388](https://github.com/mcthaydt/automata-framework/pull/388) |
| 2.1 Tag the starting point | 2 | Partly: the tag push is refused (HTTP 403) from here, so the Owner pushes it; #379 and #383 are carried in task 4.3 | |
| 2.2 Emberwick's stand-ins | 2 | Done, 2026-11-05 (hosted CI not run) | [#389](https://github.com/mcthaydt/automata-framework/pull/389) |
| 2.3 The placeholder game | 2 | Done, 2026-11-05 (hosted CI not run) | [#389](https://github.com/mcthaydt/automata-framework/pull/389) |
| 2.4 Features no game uses | 2 | Done, 2026-11-05 (hosted CI not run); leaderboards kept | [#390](https://github.com/mcthaydt/automata-framework/pull/390) |
| 3.1 The Vitest preset | 3 | Done, 2026-11-05 (hosted CI not run) | [#391](https://github.com/mcthaydt/automata-framework/pull/391) |
| 3.2 The test move codemod | 3 | Done, 2026-11-05 (hosted CI not run) | [#391](https://github.com/mcthaydt/automata-framework/pull/391) |
| 3.3 Move tests, package by package | 3 | Done locally, 2026-11-05 (hosted CI not run): every core and 2D package, Emberwick, all 14 tooling packages and the three example packages moved; unit counts equal before and after; `pnpm check` passes. 3D and editor packages move in their own areas | [#391](https://github.com/mcthaydt/automata-framework/pull/391), [#392](https://github.com/mcthaydt/automata-framework/pull/392) |
| 4.1 The boundaries rules | 4 | Done locally, 2026-11-05 (hosted CI not run); the file-list comparison fails on Emberwick (12 vs 10), so the `boundaries` line switches in task 6.3 | [#392](https://github.com/mcthaydt/automata-framework/pull/392) |
| 4.2 The move map and import codemod | 4 | Done locally, 2026-11-05 (hosted CI not run): map and codemod tested; the dry run moves 764 files, none unmapped, none clashing; not applied until 4.3 | [#392](https://github.com/mcthaydt/automata-framework/pull/392) |
| 4.3 Build `packages/automata` | 4 | Step 1 done locally, 2026-11-05: the 764 files moved, it typechecks, builds and its unit tests pass (1,891). Step 2 done locally (2026-11-05): `--features packages/automata` finds 0 (was 120; flow, screens, settings and loading services now under `app/` and `shared/runtime/`), 1,897 unit tests and the full `pnpm test:unit` (31 tasks) pass. Chromium browser suites (21 files, 2,116 tests) and Emberwick's 28 journeys pass (stage 6 run); the 3D and editor unit suites pass; WebKit and Firefox are the Owner's. Changeset and API report written | [#393](https://github.com/mcthaydt/automata-framework/pull/393) |
| 4.4 `tools`, and `sim` and `content` inside | 4 | Steps 1 and 2 done locally with 4.3 (same PR): one `automata` bin, `automata-ship` alias, `sim/testing`, tools unit tests pass (670). Step 3 part done: sim (hash, rng, define, schedule, world shared; replay the feature), tools (ship, check, create-game shared) and content (assets, compile, flow, game, generate, locale, palette, parse, tuning shared, because they call each other in a cycle; preload and vite are the features) find 0 under `--features`; all 31 unit tasks pass. Step 3 done locally (deviation 54): `assets` is Node-only so it leaves the `--browser` list; `game-config` and `locale` are browser-safe and `pnpm boundaries` checks them. Browser (Chromium) and journey suites pass here: 25 of 25 Emberwick journeys, 3 browser test files | [#393](https://github.com/mcthaydt/automata-framework/pull/393) |
| 5.1 Bundle report, before | 5 | Done locally, 2026-11-05 (hosted CI not run): `tooling/bundle-report`, run on Emberwick (below) | [#392](https://github.com/mcthaydt/automata-framework/pull/392) |
| 5.2 Plain-TypeScript helpers | 5 | Done locally, 2026-11-05 (hosted CI not run): `Clock`/`fakeClock`, `Disposables`, `Result`, `Subscribable`/`emitter`; 22 unit tests | [#394](https://github.com/mcthaydt/automata-framework/pull/394) |
| 5.3 Host contract and targets | 5 | Done locally, 2026-11-05 (hosted CI not run): plain host contract, web, Ruken and Tauri adapters, contract suite and fake host take a `Clock` and `AbortSignal`; ADR 0003 amended. A temporary bridge keeps the Effect runtime working; deleting it moved to 5.4 (deviation 55) | [#394](https://github.com/mcthaydt/automata-framework/pull/394) |
| 5.4 Runtime features and the app | 5 | Done locally, 2026-11-05 (hosted CI not run): every feature, the app, boot, run-game, the renderer and `testing/` plain; the bridge and tags deleted; `pnpm check`, Chromium browser suites and journeys pass (Emberwick 28 of 28, examples 44, create-game 1); bundle has no Effect | [#399](https://github.com/mcthaydt/automata-framework/pull/399) and [#400](https://github.com/mcthaydt/automata-framework/pull/400) |
| 6.1 Emberwick is Emberwick | 6 | Done locally, 2026-11-05 (hosted CI not run): renamed everywhere; `GOLDEN_HASH` re-recorded once (`94285fae634fdba9` → `421c5a1bf522299e`), Chromium agrees; WebKit and Firefox left to CI | [#395](https://github.com/mcthaydt/automata-framework/pull/395) |
| 6.2 Emberwick imports one package | 6 | Done locally, 2026-11-05: only `@mcthaydt/automata`, `-sim`, `-tools` and `-content` remain | [#395](https://github.com/mcthaydt/automata-framework/pull/395) |
| 6.3 Emberwick by feature | 6 | Done locally, 2026-11-05 (hosted CI not run): `app/`, `features/{player,goal,room,scene,screens}`, `shared/`, `entries/`, `testing/`; `--features games/emberwick` and the sim rule pass (deviations 56 to 58) | [#395](https://github.com/mcthaydt/automata-framework/pull/395) |
| 6.4 The surface | 6 | Done locally, 2026-11-05 (hosted CI not run): `@mcthaydt/automata` root 600 → 274 names; the ten API reports 2,109 → 1,783 exports (audit's 1,042 was counted differently); changeset `trim-the-root-entry` | [#395](https://github.com/mcthaydt/automata-framework/pull/395) |
| 7.1 Docs and AGENTS.md | 7 | Done locally, 2026-11-05: `docs/archive/`, `docs/README.md`, `docs/status.md` (47 lines), `AGENTS.md` (88 lines), `examples/README.md` | [#396](https://github.com/mcthaydt/automata-framework/pull/396) |
| 7.2 Comments that cite plans | 7 | Done locally, 2026-11-05: 762 hits rewritten (automata 399, sim 39, content 69, tools 113, tooling 142); `pnpm style` checks every core, 2D and tooling root. Stage 6 widened the check to `.svelte` and `.css` comments, config files, apps and the published `testing/` helpers, and rewrote the 228 more it found | #398 |
| 8.1 The copy table | 8 | Done locally, 2026-11-06 (hosted CI not run): screens, Settings, saves, boot failure, Emberwick, the CLI and the READMEs' first screens (`copy.md`); the paused dialog's ✕ is `Close`, no longer a second "Resume" | #397, [#401](https://github.com/mcthaydt/automata-framework/pull/401) |
| 8.2 New Emberwick journeys | 8 | Done locally except boot failure: pause on hide and the end screen added; touch-only and the examples' reload journeys already existed; slow load dropped (deviation 67); boot failure blocked on a refusal switch in Ruken's fake host (deviation 64) | #397, #398 |
| 8.3 The `create-game` journey | 8 | Done locally, 2026-11-05 (Chromium, 1 of 1): it found that the template never booted a game; the template now runs on the default screens (deviation 68) | #398 |
| 9.1 Prepare the branch clean-up | 9 | Done: `branches.md` and `pnpm branches:prune` (dry run only; nothing deleted) | |
| 9.2 Run it (the Owner's go) | 9 | Not started | |

#### Stage 6 record (2026-11-06)

Every finding of the [build audit](2026-11-06-core-and-2d-build-audit.md) is closed in the tree, in PR
[#403](https://github.com/mcthaydt/automata-framework/pull/403). The three that no cloud session can close are named at the end.

| Finding | What was done |
|---|---|
| B1 (#383) | `@mcthaydt/automata-content` has `schema` and `palette` entries; the figures and 3D render packages and Emberwick import those, with import guards; a base-3d dev-server journey (Chromium) boots the page with no page error. Changeset `content-browser-entries` |
| B2 (#379) | `touch-action: manipulation` on `html, body` in the theme, the Emberwick page and the `create-game` template; no text selection on games and editors except where a player copies text (`data-selectable`). Tests in `theme`, `create-game`, editor-kit and a double-tap journey. Changeset `touch-no-double-tap-zoom` |
| B3, B4 | `automata --help` works, and `automata` starts in the repository (the editor command loads only when asked). Tests spawn the real bin |
| C1 | One rule reads TypeScript, Svelte (`<script>`, `<style>`, `<!-- -->`) and CSS comments, and the citation forms the old rule missed (`M4`, `M4.7`, `task 6.4`, `§N`, `DIST spec §7`). It covers config files, apps and the published `testing/` helpers. 228 comments rewritten; `pnpm style` finds 0 |
| C2, C8 | 71 test files import `#src/…`; `pnpm style` fails on a relative chain into `src`. The playground journeys moved to `tests/e2e/` |
| C3, C6, D4 | The spec's section 3.3 and AGENTS.md now describe the code that was built: `app/`, `shared/` and `features/` as they are, Effect gone from the browser package, the gates as they run, the test folders that exist |
| C4, C5 | The seven `from-*` entries have names that say what they hold; the two dead no-eval files are gone; old package names are gone from live text |
| C7 | `pnpm check` runs `changeset status` and `check-changesets` |
| D1 to D3 | This page, the plan's checkboxes and `docs/status.md` rewritten from the tree. Boxes that need a runner stay open and say so |
| E1 | See below |
| E2 | The no-WebGL journey now reads the failure panel by role (one alert, no button). The Ruken boot-failure journey stays blocked on a refusal switch in Ruken's fake host (deviation 64) |
| G1 to G5 | "Back to menu / Leave this game? Unsaved progress is lost. / Leave / Keep playing"; "Couldn't save your game. Try again."; a start failure that a retry cannot fix says "Close it and open it again." and gives a hosted player a way out (`start-final`); a README per package |
| L1 to L6 | A disposed owner stays silent; `close()` returns one promise; the `_tag` on results is explained; the SDD ledgers moved to `docs/archive/`; `ci.yml` comments tell the truth; `index.ts` says extensions are separate imports |

**E1, run here (Chromium, Node 24):** Emberwick 28 of 28 journeys (phone, compact, iPad); the base-3d dev-server journey;
`@mcthaydt/automata` browser tests, 21 files and 2,116 tests; 3D and editor unit suites; `pnpm check`; `test:dist` (21 tests);
the consumer smoke (14 of 14 steps). Running `test:dist` and the consumer smoke for the first time since the package merge found
bugs that no earlier gate could see, all fixed: `test:dist` named test files that phase 3 had moved, so it ran nothing; the
published `automata` build carried a loose copy of the Ruken adapter with `@ruken/*` imports and a Paraglide fixture compile, and
its `/testing` entry reached `@ruken/sdk-host`, which no game has (the fake Ruken host is now one bundle and `HostingSeams` is a
plain type); the consumer smoke's fixtures still imported the six packages the merge removed, and its setup read their folders;
the `repo-hygiene` cache input and a comment named folders that no longer exist. Two tests that the copy change made stale were
updated (base-3d's quit question, the `start-final` code in `run-game`).

**Left for the Owner:** `pnpm ci:local` where WebKit and Firefox install; `pnpm lint:actions` (needs Docker); marking the PRs ready and
merging bottom up. One more thing the audit did not list: about 200 comments in `packages/*/src` name FloorFifty, which AGENTS.md says
published text never does (`docs/provenance/sources.md` is where it belongs). That is a rewrite of its own.

**Bundle before D2 (Emberwick, `vite build --sourcemap`, measured 2026-11-05 on `claude/project-thread-f01qmj` with
`node tooling/bundle-report/src/cli.ts <build folder>`).** Effect is 16% of the gzip. Gzip per package is the chunk's gzip
size shared out by each package's generated bytes, so it is an estimate for comparing one build with another.

| Package | Raw (kB) | Gzip (kB) | Share of gzip |
|---|---|---|---|
| pixi.js | 514.95 | 154.35 | 42.9% |
| effect | 186.72 | 57.58 | 16.0% |
| zod | 92.88 | 28.64 | 8.0% |
| @mcthaydt/automata-ui | 64.67 | 19.94 | 5.5% |
| @mcthaydt/automata-runtime | 60.09 | 18.53 | 5.2% |
| svelte | 40.53 | 12.50 | 3.5% |
| koota | 36.13 | 11.14 | 3.1% |
| @mcthaydt/automata-game | 36.04 | 11.11 | 3.1% |
| (unmapped) | 34.14 | 10.04 | 2.8% |
| @ruken/sdk | 26.89 | 8.29 | 2.3% |
| @mcthaydt/automata-sim | 26.63 | 8.21 | 2.3% |
| (the game) | 24.10 | 7.43 | 2.1% |
| @mcthaydt/automata-render-pixi | 9.38 | 2.89 | 0.8% |
| @pixi/colord | 9.18 | 2.78 | 0.8% |
| earcut | 7.40 | 2.28 | 0.6% |
| @mcthaydt/automata-host | 4.67 | 1.44 | 0.4% |
| eventemitter3 | 2.76 | 0.84 | 0.2% |
| tiny-lru | 2.38 | 0.73 | 0.2% |
| ismobilejs | 1.65 | 0.43 | 0.1% |
| @mcthaydt/automata-content | 1.14 | 0.35 | 0.1% |
| parse-svg-path | 0.50 | 0.15 | 0.0% |
| clsx | 0.36 | 0.11 | 0.0% |
| **Total** | 1183.19 | 359.79 | 100.0% |

**Bundle after D2 (Emberwick, same command, measured 2026-11-05 on `claude/project-thread-eo8dhs`).** No Effect
module is left. Total gzip 359.79 → 303.41 kB (−56.38 kB, −15.7%); the AF code is one package now (`@mcthaydt/automata`,
54.79 kB gzip, against 53.91 kB for the five packages it replaced). Boot to `data-state="ready"` at 4× CPU slowdown
(median of 7, Chromium): 953 ms before, 850 ms after.

| Package | Raw (kB) | Gzip (kB) | Share of gzip |
|---|---|---|---|
| pixi.js | 514.68 | 154.61 | 51.0% |
| @mcthaydt/automata | 176.99 | 54.79 | 18.1% |
| zod | 92.69 | 28.70 | 9.5% |
| svelte | 40.47 | 12.53 | 4.1% |
| koota | 35.96 | 11.13 | 3.7% |
| (unmapped) | 34.12 | 10.05 | 3.3% |
| @ruken/sdk | 26.77 | 8.29 | 2.7% |
| @mcthaydt/automata-sim | 26.57 | 8.23 | 2.7% |
| (the game) | 23.91 | 7.40 | 2.4% |
| @pixi/colord | 9.18 | 2.78 | 0.9% |
| earcut | 7.39 | 2.29 | 0.8% |
| eventemitter3 | 2.76 | 0.84 | 0.3% |
| tiny-lru | 2.38 | 0.74 | 0.2% |
| ismobilejs | 1.65 | 0.43 | 0.1% |
| @mcthaydt/automata-content | 1.13 | 0.35 | 0.1% |
| parse-svg-path | 0.49 | 0.15 | 0.1% |
| clsx | 0.36 | 0.11 | 0.0% |
| **Total** | 997.51 | 303.41 | 100.0% |

**Last bundle numbers (S8, from the placeholder game, measured 2026-11-05 just before it was deleted):** the page
with Effect is 143.85 kB raw and 46.87 kB gzip; the same page without Effect is 54.55 kB raw and 18.60 kB gzip, so
Effect's share was 28.3 kB gzip against a 35 kB budget. The boot-time budgets were 300 ms (100 ms for Effect's
share) at 4x CPU. No bundle budget runs until the bundle report (task 5.1) takes these numbers over.

Done means: Emberwick's journeys pass on every pull request in two browsers, the Owner plays it on the iPad, the
repository has only `main` and branches with active CI (fewer than 5), the code follows the feature-folder layout
with tests in their own folder, and `.vscode` hides what the Owner does not need to see.

## 2D editors and website: 50% (3 of 6; the build stays open until 67 of 67)

Scope: `editor-kit`, `editor-2d`, the parts of `editor-suite` that 2D touches, `automata editor`, and the website
repository (`mcthaydt/automata-website`), judged as if AF ships with 2D alone. Widened on 2026-11-06 (the Owner: "we need
to audit the other automata things too then; basically everything but 3D and editors") to the rest of the path a new
author takes: `create-game` and the published command, releases, game CI, the agent package, docs, tooling, and the other
Automata repositories (`automata-plus`, `automata-skills` and nine older ones).

| Stage | Status | Record |
|---|---|---|
| 1. Audit | Done, 2026-11-06: 7 editor shipping gaps (E1 to E7), 7 sprawl (S1 to S7), 2 contracts (K1, K2), 5 tests (T1 to T5), 5 copy (G1 to G5); 9 website shipping gaps (W1 to W9), 6 sprawl (WS1 to WS6), 2 tests (WT1, WT2), 4 copy (WG1 to WG4); 8 decisions (D1 to D8); the Owner took all eight recommendations the same day. The widened scope's audit, the same day: 7 new-game gaps (N1 to N7), 7 published-tools (U1 to U7), 7 release (R1 to R7), 7 Plus and other repositories (P1 to P7), 7 agent package and docs (A1 to A7), 5 CI and tooling (Q1 to Q5), 4 copy (Y1 to Y4); 9 decisions (D9 to D17); the Owner took all nine recommendations the same day | [2026-11-06-2d-editors-and-site-audit.md](2026-11-06-2d-editors-and-site-audit.md), [2026-11-06-2d-ship-rest-audit.md](2026-11-06-2d-ship-rest-audit.md) |
| 2. Plan and spec | Done, 2026-11-06 (draft PR [#406](https://github.com/mcthaydt/automata-framework/pull/406)): 21 phases, 63 tasks. Built on D1 to D17 as the Owner took them; adds the editor redesign in the website's look and the code refactor to the core slice's standard (minimal, elegant, documented), both asked for by the Owner the same day. Stage 3 reviews it | [spec](2026-11-06-2d-editors-and-site-spec.md), [plan](2026-11-06-2d-editors-and-site-plan.md) |
| 3. Plan audit | Done, 2026-11-06 (draft PR, stacked on #406 and #407): 30 findings (12 that would have stopped the build, 18 that would have caused harm or rework), all fixed in the spec and plan; three veto defaults added (14 to 16); the Owner's calls are the npm organisation's name and D8/D17's inputs. Stage 4 starts at task 1.1 | [plan audit](2026-11-06-2d-editors-and-site-plan-audit.md) |
| 4. Build | In progress: 37 of 67 tasks (see below) | [plan](2026-11-06-2d-editors-and-site-plan.md) |
| 5. Build audit | Not started | |
| 6. Fixes | Not started | |

### Build: 55% (37 of 67 tasks)

Stage 4 started 2026-11-06 on branch `claude/project-thread-s8zs6m`, stacked on #408. The Owner named the npm
organisation the same day ("automata", so the scope is `@automata`); it is for task 14.1. Counted from the rows below.

**Where to resume (2026-11-06, session 11):** branch `claude/project-thread-r7jtb7`, a draft PR stacked on #420
(task 12.2 done: the view switcher with Level, Map, Tiles and Characters in the top bar, "2 problems" opening the
Problems sheet, the Share menu in browser storage only, rename on tap; the plan's log has the cuts). Next is task 12.3
(the Level view), on a new branch stacked on this one. Two Owner rules from 2026-11-06 hold for everything left: every
editor keeps only essential features (cut the rest and name each cut in the plan's log), and no new rounded buttons:
a design thread ("Sharpen editor and site visual design") sends its token and component changes to adopt. **Phase 18
waits** until the Owner picks a site direction from that thread's mockups; then 18.0 and the rest apply it together
with the site visual audit's fixes, and the visual audit is rerun. Phase 12 also holds 12.6 (the Tuner, a split view
with the live game) and 12.7 (the suite's 2D page); 12.5 runs last. Task 14.1 waits for the Owner to confirm the
`automata` npm organisation. The plan's execution log has the counts, deviations (up to 107) and gates of every task
so far. The design board: `pnpm --filter @mcthaydt/automata-editor design:board`. In a fresh clone, run
`node site/scripts/build-demos.ts` before `pnpm check` (the site's unit tests read the playground build).

| Task | Phase | Status | PR |
|---|---|---|---|
| 1.1 The editors in the 2D gate | 1 | Done, 2026-11-06 (Chromium; unit: editor-kit 1,373, editor-2d 1,552; browser: editor-2d 259 pass and 6 skipped, editor-kit layout 129; the journeys need WebKit: the Owner's `ci:local`; hosted CI not run) | |
| 1.2 One workflow per dimension | 1 | Done, 2026-11-06 (workflow YAML parses; `actionlint` needs Docker: the Owner's; hosted CI not run) | |
| 2.1 The stranger's journey | 2 | Done, 2026-11-06 (Chromium only; `pnpm check` green; the stranger's journey passes in about 26 s; WebKit and Firefox not run; hosted CI not run) | |
| 2.2 A new game installs | 2 | Done, 2026-11-06 (Chromium only; `pnpm check` green; the stranger's journey passes in about 26 s; WebKit and Firefox not run; hosted CI not run) | |
| 2.3 A new game passes its own check, in the feature layout | 2 | Done, 2026-11-06 (Chromium only; `pnpm check` green; the stranger's journey passes in about 26 s; WebKit and Firefox not run; hosted CI not run) | |
| 2.4 The rest of the path | 2 | Done, 2026-11-06 (Chromium only; `pnpm check` green; the stranger's journey passes in about 26 s; WebKit and Firefox not run; hosted CI not run) | |
| 3.1 What leaves | 3 | Done, 2026-11-06 (Chromium only; `pnpm check` green; consumer smoke from packs and the stranger's journey pass; WebKit, Firefox and hosted CI not run) | |
| 3.2 The target is always named | 3 | Done, 2026-11-06 (Chromium only; `pnpm check` green; consumer smoke from packs and the stranger's journey pass; WebKit, Firefox and hosted CI not run) | |
| 3.3 A small root entry, and check-boundaries folded in | 3 | Done, 2026-11-06 (Chromium only; `pnpm check` green; consumer smoke from packs and the stranger's journey pass; WebKit, Firefox and hosted CI not run); API reports, cheatsheet and agent reference regenerated | |
| 3.4 Help text | 3 | Done, 2026-11-06 (Chromium only; `pnpm check` green; consumer smoke from packs and the stranger's journey pass; WebKit, Firefox and hosted CI not run) | |
| 3.5 The code refactor of -tools | 3 | Done, 2026-11-06 (Chromium only; `pnpm check`, build, API report, consumer smoke from packs and the stranger's journey pass; `-tools` unit tests 803 → 809, the six new ones for `checkout.ts`; no file in `packages/tools/src` is over 300 lines; WebKit, Firefox and hosted CI not run) | |
| 4.1 The move map and the package skeleton | 4 | Done, 2026-11-06 (764 files move by rename, none unmapped, none clashing; the skeleton typechecks and builds once they land in 4.2) | |
| 4.2 Merge the three packages | 4 | Done, 2026-11-06 (Chromium only; typecheck, build, `pnpm lint`, boundaries, style and knip pass; the editor's unit and DOM tests 3,348 → 3,268 and editor-3d's 2,857 → 2,932, every difference named in the log; editor browser tests in Chromium: 452 pass in layout, kit layout and parity, canvas 49 pass and 6 skipped; WebKit, Firefox, the journeys and hosted CI not run) | |
| 4.3 Tests into tests/ | 4 | Done, 2026-11-06 (Chromium only; unit 3,270 (3,268 + two tests of `journeyInstance`); browser projects parity, layout, storage, canvas and journeys 527 pass, 6 skipped, 0 fail; preset, codemod, lint, typecheck, boundaries, style and knip pass; WebKit, Firefox and hosted CI not run) | |
| 4.4 Feature folders and the boundaries rules | 4 | Done, 2026-11-06 (Chromium only; `--forbid` and `--shared-island kit` added to `-tools` with tests, 39 findings fixed to 0; unit 3,270 before and after; Chromium browser projects 527 pass, 6 skipped; WebKit, Firefox, the journeys' WebKit half and hosted CI not run) | |
| 4.5 Comments, fixtures, unused code and the mock-ups | 4 | Done, 2026-11-06 (Chromium only; `style` 0 findings with the editor in it; unit 3,268 (two source-commit tests deleted); knip clean; WebKit, Firefox and hosted CI not run) | |
| 4.6 The code refactor of the editor package | 4 | Done, 2026-11-06 (Chromium only; `pnpm check` green; editor unit 3,275 (3,270 + five `unique-name` tests), typecheck clean; every file under 300 lines; the longest closures left whole on purpose, the two JSON scanners kept with a header saying why; 35 source-project phrases reworded; editor Chromium browser projects and WebKit, Firefox, hosted CI not run) | |
| 5.1 The level-2d entry | 5 | Done, 2026-11-06 (Chromium only; `pnpm check` green; content unit tests 52 moved, 12 new; `pnpm boundaries` scans `read-level.ts` with the sim rule; API report, agent reference, cheatsheet regenerated; hosted CI not run) | [#415](https://github.com/mcthaydt/automata-framework/pull/415) |
| 5.2 The editor and Emberwick import it | 5 | Done, 2026-11-06 (`pnpm check` green; the golden did not move: `sim-content.json` byte-identical, hash `5fd77abd159d6a5e`; Emberwick unit 109; Chromium journeys: see the log; WebKit, Firefox and hosted CI not run) | [#415](https://github.com/mcthaydt/automata-framework/pull/415) |
| 6.1 exports in the editor list and the policy | 6 | Done, 2026-11-06 (`pnpm check` green; Chromium parity, layout and storage 452 pass, canvas and journeys 75 pass and 6 skipped; WebKit, Firefox and hosted CI not run) | [#415](https://github.com/mcthaydt/automata-framework/pull/415) |
| 6.2 Save writes the game files, then the project | 6 | Done, 2026-11-06 (`pnpm check` green; Chromium parity, layout and storage 452 pass, canvas and journeys 75 pass and 6 skipped; WebKit, Firefox and hosted CI not run) | [#415](https://github.com/mcthaydt/automata-framework/pull/415) |
| 6.3 The drift check | 6 | Done, 2026-11-06 (`pnpm check` green; Chromium parity, layout and storage 452 pass, canvas and journeys 75 pass and 6 skipped; WebKit, Firefox and hosted CI not run) | [#415](https://github.com/mcthaydt/automata-framework/pull/415) |
| 6.4 The narrow fallback | 6 | Done, 2026-11-06 (`pnpm check` green; Chromium parity, layout and storage 452 pass, canvas and journeys 75 pass and 6 skipped; WebKit, Firefox and hosted CI not run) | [#415](https://github.com/mcthaydt/automata-framework/pull/415) |
| 7.1 --app 2d by default, and it runs from source | 7 | Done, 2026-11-06 (`pnpm check` green; editor, content and tools build; the source bin serves `/api/ping` in a spawned-process test; WebKit, Firefox and hosted CI not run) | [#415](https://github.com/mcthaydt/automata-framework/pull/415) |
| 7.2 The build inside -tools, and the closed-beta scan | 7 | Done, 2026-11-06 (`pnpm check` green; the packed `-tools` is 773 kB with the editor in it; the consumer smoke passes from packs with the new editor and size steps; WebKit, Firefox and hosted CI not run) | [#415](https://github.com/mcthaydt/automata-framework/pull/415) |
| 7.3 create-game makes a level | 7 | Done, 2026-11-06 (`pnpm check` green; `-tools` unit 851; the stranger's journey passes in Chromium with the floor check and the `levels` step; WebKit, Firefox and hosted CI not run) | [#416](https://github.com/mcthaydt/automata-framework/pull/416) |
| 8.1 The 2D-only suite page | 8 | Done, 2026-11-06 (copy-editor 6 tests; both shipped builds scan clean, `editor-3d`'s suite holds the beta and is not shipped; WebKit, Firefox and hosted CI not run) | [#416](https://github.com/mcthaydt/automata-framework/pull/416) |
| 8.2 The suite opens the checkout; the rail lists what is there | 8 | Done, 2026-11-06 (`pnpm check` green; editor unit 3,245; editor Chromium browser projects 527 pass, 6 skipped; served on Emberwick it shows its two editors and no sample; WebKit, Firefox and hosted CI not run). Step G from the drunk grandma audit done 2026-11-06 (session 9): `--app suite` serves the 2D suite | [#416](https://github.com/mcthaydt/automata-framework/pull/416) |
| 9.1 Split the examples package | 9 | Done, 2026-11-06 (`pnpm check` green; the 2D build scans clean of the 3D beta, the 3D build holds it; 2D journeys 88 pass and 2 skipped in Chromium, the 3D ones 9 of 9 in Chromium; the goldens replay in Chromium; WebKit, Firefox and hosted CI not run) | [#417](https://github.com/mcthaydt/automata-framework/pull/417) |
| 10.1 site/ with its history | 10 | Done, 2026-11-06 (`git subtree add` of the website's `main` at `4a514eb3`, 229 commits, unsquashed; `pnpm check` green with `site` left out of Biome and knip until 10.2 and 10.3; site tests: 10 of 78 files fail, all reading the old sibling checkout or the synced copies) | [#417](https://github.com/mcthaydt/automata-framework/pull/417) |
| 10.2 Imports, not copies | 10 | Done, 2026-11-06 (sync scripts, pins, synced copies, the workshop and four pages that read only synced data deleted; one Vite plugin serves the guides, examples, demos, sources and API index from the workspace; the playground moved to `site/playground/`; `build-demos.ts` builds the demos, the API index and the playground; site unit 353 pass, build exits 0, knip covers the site; Chromium e2e 483 and playground journeys 37 pass; `pnpm check` green; WebKit, Firefox and hosted CI not run) | [#418](https://github.com/mcthaydt/automata-framework/pull/418) |
| 10.3 The site's tooling matches the repository's | 10 | Done, 2026-11-06 (Vite 8.3.3, SvelteKit 2.70.4, plugin 7.3.1, Zod 4.6.6; Biome over `site/`; no `tsx`; the site's 353 unit tests in `pnpm check`, its e2e in `e2e-2d`; `pnpm check` green; Chromium e2e pass; WebKit, Firefox and hosted CI not run) | [#418](https://github.com/mcthaydt/automata-framework/pull/418) |
| 11.1 One token source | 11 | Done, 2026-11-06 (tokens tests; the site's 40 `:root` values kept exactly; editor unit and editor-3d unit pass; site build 0; site e2e in Chromium 483 pass, one playground journey needed a rerun, see the log; WebKit, Firefox and hosted CI not run) | [#419](https://github.com/mcthaydt/automata-framework/pull/419) |
| 11.2 Geist and the icons | 11 | Done, 2026-11-06 (24 Lucide icons, ISC recorded; Geist from the site's packages; icon and font tests; typecheck clean) | [#419](https://github.com/mcthaydt/automata-framework/pull/419) |
| 11.3 The kit's components and the design board | 11 | Done, 2026-11-06 (no literal colour or old alias in the kit; IconButton; Dialog a phone sheet; board screenshotted at five sizes and every image opened; editor unit 3,284; editor Chromium browser projects 533 pass, 6 skipped; editor-3d unit, dom, layout and canvas in Chromium pass; `pnpm check` green; WebKit, Firefox and hosted CI not run) | [#419](https://github.com/mcthaydt/automata-framework/pull/419) |
| 12.1 Home | 12 | Done, 2026-11-06 (session 10): one column of cards with a More menu, the New level sheet, Open from, one storage line; Step G (new levels in `content/rooms/`, "Your game: Emberwick", "Changed 7 minutes ago"); editor unit 3,286, Home layout 41 of 41 in Chromium at eight sizes; WebKit, Firefox and hosted CI not run; templates only in browser storage (the try-it), per the Owner | [#420](https://github.com/mcthaydt/automata-framework/pull/420) |
| 12.2 The document frame | 12 | Done, 2026-11-06 (sessions 10 and 11): Back asks; essentials-only top bar with Save's three states; no status bar; the view switcher (Level, Map, Tiles, Characters; a menu on a phone, two-row bar); "2 problems" opens the Problems sheet; the Share menu in browser storage only; rename on tap; editor unit 3,284, Chromium layout 130 and 2D journeys 8 pass; WebKit, Firefox and hosted CI not run | [#420](https://github.com/mcthaydt/automata-framework/pull/420), this session's PR |
| 12.3 The Level view | 12 | Not started | |
| 12.4 Map, Tiles, Characters and the dialogs | 12 | Not started | |
| 12.5 The copy table and the guide (runs after 12.6 and 12.7) | 12 | Not started | |
| 12.6 The Tuner, audited and redesigned as a split view beside the live game (added 2026-11-06) | 12 | Not started | |
| 12.7 The 2D suite page, audited and redesigned (added 2026-11-06) | 12 | Not started | |
| 13.1 The harness | 13 | Not started | |
| 13.2 Save, drift and conflict journeys | 13 | Not started | |
| 13.3 A new game, and the suite | 13 | Not started | |
| 14.1 The scope | 14 | Not started | |
| 14.2 The registry and the first public version | 14 | Not started | |
| 15.1 The game's own workflow | 15 | Not started | |
| 16.1 The skills, for today's framework | 16 | Not started | |
| 16.2 One generated reference | 16 | Not started | |
| 16.3 The docs agree with the direction | 16 | Not started | |
| 16.4 The skills' public home | 16 | Not started | |
| 17.1 The workflow invariants replace the YAML-pinning tests | 17 | Not started | |
| 17.2 The packages that lost their reason | 17 | Not started | |
| 17.3 The code refactor of the tooling that stays | 17 | Not started | |
| 18.0 The shared layout, fixed first (added 2026-11-06) | 18 | Not started; waits for the Owner to pick a site direction from the design thread's mockups (the Owner, 2026-11-06), then runs with the visual audit's fixes in one pass | |
| 18.1 Features, the page cut and redirects | 18 | Not started | |
| 18.2 Home and Start on the current code | 18 | Not started | |
| 18.3 The editor page and "Try the editor" | 18 | Not started | |
| 18.4 Docs and API | 18 | Not started | |
| 18.5 The code refactor of the site | 18 | Not started | |
| 19.1 The visitor's journey | 19 | Not started | |
| 19.2 Links, privacy and the closed beta | 19 | Not started | |
| 20.1 The copy table | 20 | Not started | |
| 21.0 The site's own domain (added 2026-11-06) | 21 | Partly: every site URL is on `automataframework.com` (session 9); the DNS is the Owner's | |
| 21.1 The deploy, ready | 21 | Not started | |
| 21.2 The Owner's inputs and go | 21 | Not started | |

Done means: someone new finds the site, makes a 2D game with `create-game`, edits its level with `automata editor`, sees
the change in the game and publishes it, with nothing from 3D in the way; and journeys prove each step on every pull
request.

## 3D (core, editors, website): 0% (0 of 6)

Not started. Starts when the 2D editors and the website are done. It may split in two (3D core, then the 3D editors
and site) at its audit.

Owed to it by the 2D slice: the redesign of `editor-3d`, the Studio and Levels 3D in the website's look (the 2D slice redesigns every editor that is not 3D, the Tuner and the suite's 2D page included: tasks 12.6 and 12.7) (the Owner,
2026-11-06: "completely redesign the editors for ux, copy, and ui"; the 2D slice redesigns the kit and the 2D editor),
the suite's top bar copy and wiring (E6, G2), deleting the old token aliases `editor-3d` still uses, and the 3D
examples' and editors' code refactor to the same standard (2D spec section 17).
