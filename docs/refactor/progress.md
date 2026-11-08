# Refactor progress

**Overall: 67% (12 of 18 stages done).**

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

## 2D editors and website: 83% (5 of 6: stages 1, 2, 3, 5 and 6; the build stays open until 68 of 68)

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
| 4. Build | In progress: 65 of 68 tasks (12.3b added 2026-11-06) (see below) | [plan](2026-11-06-2d-editors-and-site-plan.md) |
| 5. Build audit | Done, 2026-11-07 (PR stacked on #438): 3 broken (B1 Add tiles cannot write into a game folder, B2 `pnpm check` red at the head, B3 task 14.2 is agent work), 7 spec gaps (C1 to C7), 2 visual (V1, V2), 9 copy (G1 to G9), 2 tests (T1, T2), 3 tracking (D1 to D3), 4 tidy (L1 to L4); the stranger's journey, the editor's Chromium journeys and the site visual audit pass | [build audit](2026-11-07-2d-editors-and-site-build-audit.md) |
| 6. Fixes | Done, 2026-11-07 (branches `claude/project-thread-e4cj35` and `claude/project-thread-tkgq9c`, stacked on #439): every finding of the build audit is fixed, or has its reason in the plan's log (C4's Music field stays a text box). Rerun: editor Chromium journeys (iPad 10 of 10, phone 8 of 8, 2 skipped by design), the editor's Chromium browser projects 1002 passed, the site's Chromium suite 345 of 345, the stranger's journey 1 of 1, the site visual audit (no overflow, no console errors, every 404 is a page the list names that no longer exists) and the changed editor screens at phone, iPad and desktop. WebKit and Firefox: not installed here, so the Owner's Mac | [build audit](2026-11-07-2d-editors-and-site-build-audit.md) |

### Build: 96% (65 of 68 tasks)

Stage 4 started 2026-11-06 on branch `claude/project-thread-s8zs6m`, stacked on #408. The Owner named the npm
organisation the same day ("automata", so the scope is `@automata`); it is for task 14.1. Counted from the rows below.

**Where to resume (stage 6 done, 2026-11-07):** the slice's build audit is fixed. The second fix thread (`claude/project-thread-tkgq9c`, stacked on #440) did C4 (zoom, brush size, Share primary, size in tiles, number keys, "Characters and items", faint grid), C5, T2 (journeys for Share and the Tuner), D2 (65 step boxes ticked), L1 (the check now flags "Spec 11.5" style citations in the editor and the site), L2 (`EditorShell.svelte` 332 lines) and L4; the plan's log has each item and its evidence. **What is left is the Owner's:** task 14.2 (the `@automata` organisation on npmjs.org, `NPM_TOKEN` in the `release` environment, approving the `release` run), 21.0's DNS, 21.2, the Gmail in the footer, a run of the journeys in WebKit and Firefox on the Mac, and the 3D slice's 8 broken editor tests. Node 24 is at `/opt/node24/bin`; a commit's hook runs the affected unit tests for 2 to 5 minutes, so commit in the background and do not edit while it runs.

**Where to resume (2026-11-07, stage 5 done):** the build audit is [2026-11-07-2d-editors-and-site-build-audit.md](2026-11-07-2d-editors-and-site-build-audit.md), on its own PR stacked on #438. Next is stage 6 (fixes, Sonnet high), in the audit's section 5 order: `pnpm check` is red at the head (B2) and Add tiles fails on every game folder (B1) come first; task 14.2 is agent work, not the Owner's (B3). This file's duplicate section is finding D1.

**Where to resume (2026-11-07, session 25):** branch `claude/refactor-scope`, its own PR stacked on #437. Session 25:
**14.1 is done** (the plan's log): every package is in the `@automata` scope. The main package is
`@automata/framework` (the Owner was offered the choice on a decision card; until the first publish it is one more
codemod run to change), the rest `@automata/<name>`, the private tooling too. `@mcthaydt` stays only as the registry
scope (14.2 moves the registry), the GitHub owner and in the history. The build is 65 of 68; what is left (14.2, 21.0's
DNS, 21.2) is the Owner's, so **the next pipeline stage is the build audit (stage 5)**. Until 14.2 lands, the release
job cannot publish (GitHub Packages takes only the `@mcthaydt` scope).

**Where to resume (2026-11-07, session 24):** branch `claude/project-thread-sor69o`, PR #437 stacked on #436.
Session 24: **19.2, 20.1 and 21.1 are done** (the plan's log); the build is 64 of 68, and every task an agent can do
on the stack is done. Left: **14.1** (the `@automata` scope) on its own branch and PR (`claude/refactor-scope`), based
on the stack's head, in its own thread, because it renames every file that names `@mcthaydt/automata` and would
conflict with every PR still in the stack; 14.2, 21.0's DNS and 21.2 are the Owner's. The Gmail stays in the footer
until the Owner decides; `check:launch` keeps the deploy from going out with it (`docs/runbook.md`, Launch the
website). After 14.1, the next pipeline stage is the build audit (stage 5).

**Where to resume (2026-11-07, session 23):** branch `claude/project-thread-3mf5b2`, PR #436 stacked on #435.
Session 23: **15.1, 16.1 to 16.4 and 19.1 are done** (the plan's log); the build is 61 of 68. 19.1's visitor journey
found two site bugs, both fixed: the try-it editor's canvas was unavailable under the site's CSP (no-eval import), and
on an upright phone the playing demo's wide frame made Emberwick ask for fullscreen (it now stands 3 by 4). Also fixed,
at the coordinator's ask: the platformer journey's two-finger undo runs on the test clock (it flaked once on #416).
Next, in plan order: **19.2** (links, privacy, the closed-beta scan), 20.1 (the copy table), 21.1 (site workflow,
legal, launch steps). Then the build is 64 of 68: 14.1 needs its own thread and branch (`claude/refactor-scope`,
scope `@automata`); 14.2, 21.0's DNS and 21.2 are the Owner's. The Gmail in the footer still waits for the Owner. For
19.2: Emberwick's on-screen pad is `aria-hidden` with glyph-only buttons (the keys do the same); fine for a screen
reader, but a candidate for phase 20's copy pass.

**Where to resume (2026-11-07, session 22, end):** branch `claude/project-thread-68k16x`, PR #435 stacked on #434.
After the note below, **13.1, 13.2 and 13.3 are done** (the plan's log, "Phase 13 (session 22)"); the build is 55 of
68. The editor's journeys (`pnpm test:e2e --filter @mcthaydt/automata-editor`, 11 pass and 1 skip in Chromium) found
two bugs, both fixed with tests: the content plugin did not watch a content folder outside Vite's root, and a guarded
save wrote the game's level file before the project's own write was refused. Next, in plan order: **15.1**, 16.1 to
16.4, 19.1, 19.2, 20.1, 21.1. 14.1 has its name (`@automata`) but is its own PR on its own branch
(`claude/refactor-scope`), so it needs its own thread; 14.2, 21.0's DNS and 21.2 are the Owner's. WebKit for the editor's journeys (`editor-ipad-webkit`) is the Owner's: WebKit is not installed in sessions.
For 15.1, found while reading: ship `template-ci/` the way `template-content/` ships (`tsdown.config.ts` copies the
folder into `dist/`; `template-content.ts` reads it by a relative URL); the itch.io job belongs only in a game made
with the `itch` target (`targetsOf(options)`), and its pinned, checksum-checked butler install and its
`BUTLER_API_KEY` check can come from `.github/workflows/game-release.yml`.

**Where to resume (2026-11-07, session 22):** branch `claude/project-thread-68k16x`, stacked on #434
(`claude/project-thread-51wjcc`). Session 22: **18.0, 18.4 and 18.5 are done** (the plan's log, "Phase 18, part
(session 22)"); the build is 52 of 68. The site audit was rerun (`2026-11-06-site-visual-audit.md`, section 6): tap
targets under 44 px 4,938 → 0 for links and buttons, and `site.e2e.ts` now enforces it. Next, in plan order: **13.1**
(the editor's journey harness), 13.2, 13.3, then 15.1, 16.1 to 16.4, 17.x is done, 19.1, 19.2, 20.1, 21.1 (14.1 waits
on the Owner's npm organisation; 14.2, 21.0's DNS and 21.2 are the Owner's). For phase 20: `PageMeta`'s default
description still says "AI-first", and the guides are the docs now, so their copy is the site's. The Markdown reader
(`site/src/shared/utils/markdown.ts`) reads what the guides use; a guide using more (nested lists, images) needs it
taught first.

**Where to resume (2026-11-07, session 21):** branch `claude/project-thread-51wjcc`, PR #434 stacked on #433
(`claude/project-thread-zrzfq2`). Session 21: **18.1, 18.2 and 18.3 are done** (the plan's log, "Phase 18, part
(session 21)"). Next, in order: **18.4** (docs from `docs/guides/` plus a new `docs/guides/how-it-works.md` and
`index.md` for the order; `/ai` and `/inside` already redirect to `/docs/how-it-works`, so it must exist; the old
authored docs in `site/src/features/docs/site-docs.ts`, `deep-docs.ts`, `migrations.ts`, `audience.ts` go, and their
slugs need redirects in `features/redirects/redirects.ts`, whose test pins the map; the docs sidebar's tap targets, M1;
one API page per package, short, H4), then **18.5** (dead CSS such as `.ownership` and `.rules-list` in `app.css`;
the old flat `site/tests/*.test.ts` regroup into `tests/unit/<feature>/`), then rerun the site audit and re-measure tap
targets (not re-measured this session). For the build audit: the editor's views cross features in 11 places
(`--features packages/editor --components` lists them). Build the site with `node scripts/build-demos.ts` first;
the full Chromium site suite takes about 10 minutes.

**Where to resume (2026-11-07, session 20):** branch `claude/project-thread-zrzfq2`, PR [#433](https://github.com/mcthaydt/automata-framework/pull/433) stacked on #432.
Session 20: **12.5 and 17.3 are done**, and phase 18 is under way: the header, footer, buttons and corners follow the
approved mockup, Home and Start are rebuilt in `site/src/features/home` and `start`, and the source explorer is cut.
The site audit was rerun (`2026-11-06-site-visual-audit.md`, section 5). Next, in order: 18.1 (cut AI, Showcase and
Cheatsheet; `llms.ts`, `site-docs.ts` and the CommandMenu still read their data; add the redirects; move the rest to
`features/`), 18.2's Step V (H5, the first example, and M3, the phone-landscape fold), 18.3, 18.4 (the docs sidebar's
tap targets and the API page's length), 18.5, then rerun the audit. Seen but not fixed, for the build audit: in the
editor's compact phone Level view a white band sits above the canvas with the stage pill.

**Where to resume (2026-11-06, session 19):** branch `claude/project-thread-maubs8`, PR [#432](https://github.com/mcthaydt/automata-framework/pull/432) stacked on #430
(`claude/project-thread-yzmefp`), itself on #429, #428, #427, #426, #424, #423 and #421. Session 19: **12.7 is done**:
the suite page has the mockup's look (Home a house icon, the game's name, `Saved in your game folder` with a tick, Undo
and Redo icon buttons, Publish the lime primary only when there is something to publish; the rail's tabs are an icon
over the name, four Lucide icons added; Home's Export and Import sit in the question's row) and its dialogs have one
primary each (Export gains Copy; Import says See changes, then Import, and names files in words). Session 18 (kept
for its detail): **12.3 is done** with the three layouts by size
(`shellModeAt`: wide from 1180 px, compact at 760 px and narrower or 520 px high and less, medium between; medium keeps
the panel beside the canvas and floats the inspector as a card; compact docks the tools across the stage's foot and
sheets rise above the dock), and **12.3b Add tiles is done** (one dialog: choose a picture, the tile size, the grid
and the count in words; Add tiles writes the picture under `assets/` and adds the tileset as one undo step; views
get `services.files`). The same look began on the other views: Tiles, Characters and the Tuner's settings were dark
text on the near-black cabinet since session 17 (the Tuner's colours named tokens that do not exist); their pages now
take the light field, panels have small-capital section labels, the Map's level rows are quiet. The 3D editor's
document frame reads `shellModeAt` too (it shares the kit shell); its unit and DOM tests pass, its browser tests were
not run (3D CI is off by the Owner's choice). Session 19 also drew the kit's `Tabs` as quiet tabs (Tiles' and Characters' inspectors, and the 3D editor's sheets)
and made the Characters inspector label-left; the 2D editor's empty Home has one lime New level (the top bar's). Session 19 then finished **12.6**: the Tuner shows each value in a unit a player can feel (px/s, px/s², s) from
`unit` and `scale` in `tuning.toml`. 12.5 began (the screen-word scan and the guide). **Next, in order:** the rest of 12.5: split the nine `.svelte` files over 300 lines (`Suite.svelte` first; the
plan's log lists them) and grep the editor's strings against `copy.md` (its scan should
also catch `Add field` and `int` in the Characters Settings tab), then 17.3; phase 18 takes
`site-home.html`. Every editor keeps only essential features (name each cut in the plan's log). Task 14.1 waits for
the Owner to confirm the `automata` npm organisation. Node 24 may
already be at `/opt/node24`; enable corepack and put it first on `PATH` in every command (the hooks otherwise run on
Node 22). A commit's lefthook runs the affected unit tests across packages (it caught the editor's API report and the
3D editor this session); `LEFTHOOK=0` only after running them yourself. Changing the editor kit's exports: `pnpm
api-report --update && pnpm agent-skills --write`. In a fresh clone, run `node site/scripts/build-demos.ts` before
`pnpm check`. Browser tests in a cloud session: `--project 'layout (chromium)' --project 'layout (chromium, touch)'`,
`--project 'canvas (chromium)'` and `--project 'journeys (chromium)'` (WebKit and Firefox are not installed). The
design board: `pnpm --filter @mcthaydt/automata-editor design:board`.

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
| 12.3 The Level view | 12 | Done, 2026-11-06 (session 18): the three layouts by size and the tool dock; editor unit 3,335, Chromium layout with a mouse and with touch 868 of 868, journeys 26; WebKit, Firefox and hosted CI not run. Earlier (sessions 11, 12, 15 to 17): the mockup was approved 2026-11-06; session 15 put its neutral tool palette on every editor page (`tool-chrome.css`); session 16 its density (32 px with a mouse, the touch rule with a finger, both proven in Chromium layout runs), the top bar as a quiet path with view tabs, and lock-before-eye layer rows. Earlier: the tools are icons in one pill floating over the canvas, the brush size a 44 px number button; layer rows with colour, plain kind words, eye and lock; the inspector opens on selection, Details opens it below wide; the level picker with New level in the top bar replaces the strip of cards (the suite too). Left: the charcoal cabinet and the canvas colours, from the design thread's mockup once the Owner approves it | #421, this session's PR |
| 12.3b Add tiles (added 2026-11-06) | 12 | Done, 2026-11-06 (session 18): one dialog, picture, tile size, grid and count in words; one undo step; the picture under `assets/`; editor unit 3,356, Chromium layout "Add tiles" at eight sizes with a mouse and with touch 16; WebKit, Firefox and hosted CI not run | [#430](https://github.com/mcthaydt/automata-framework/pull/430) |
| 12.4 Map, Tiles, Characters and the dialogs | 12 | Done, 2026-11-06 (sessions 12 and 13): Step G words; the Level view's floating pill on all three views (the kit's `StagePill`); tabs Selected, Level, Problems and Character, Settings; the conflict and restore dialogs in plain words with one primary each; editor unit 3,307, editor-3d 2,932, Chromium layout and journeys pass; WebKit, Firefox and hosted CI not run | this session's PR |
| 12.5 The copy table and the guide (runs after 12.6 and 12.7) | 12 | Done, 2026-11-07 (session 20): the screen-word scan, the guide, `Suite`, `ReorderList` and `WorldView` split under 300; six files over only by their scoped CSS (deviation in the plan's log); the copy grep's rows in `copy.md` | #432, this session's PR |
| 12.6 The Tuner, audited and redesigned as a split view beside the live game (added 2026-11-06) | 12 | Done, 2026-11-06 (sessions 13 to 15, 18 and 19): session 19 shows every value in a unit a player can feel (`unit` and `scale` in `tuning.toml`, display only; Emberwick in px/s, px/s² and s; typed values go back as the sim's whole numbers; refusals in the unit). Earlier: the split view with the live game, the restart on the screen the person was on, labels and feels, Keep, the light look; WebKit, Firefox and hosted CI not run | #424, #426, #427, #432 |
| 12.7 The 2D suite page, audited and redesigned (added 2026-11-06) | 12 | Done, 2026-11-06 (sessions 14, 15 and 19): session 19 gave it the mockup's look (Home a house icon, the saved status with a tick, Undo and Redo icon buttons, Publish the primary only when there is something to publish; the rail's tabs an icon over the name; Home's Export and Import in the question's row) and the dialogs one primary each (Export's Copy; Import's See changes, then Import; files named in words); editor unit 3,367, Chromium layout (suite) 242; screenshots in `refactor/2026-11-06-12-7-suite-screens/`; WebKit, Firefox and hosted CI not run. Earlier: the split of `Suite.svelte`, Ship is Publish, Home's words, the top bar's words | #426, #427, #432 |
| 13.1 The harness | 13 | Done (session 22) | `packages/editor/tests/e2e/harness/`, smoke journey; `LevelCanvas` publishes `data-camera` |
| 13.2 Save, drift and conflict journeys | 13 | Done (session 22) | three journeys pass in Chromium (iPad, phone); fixed the content watcher and a conflicted save that wrote the level file |
| 13.3 A new game, and the suite | 13 | Done (session 22) | new game passes on iPad and phone; suite on iPad (Chromium) |
| 14.1 The scope | 14 | Done locally, 2026-11-07 (session 25): every package is `@automata` (`@mcthaydt/automata` → `@automata/framework`, the others `@automata/<name>`), by the scope codemod (964 files) and eight hand fixes; `scope.test.ts` guards it; `pnpm check`, the stranger's journey, the consumer smoke, Emberwick's Chromium journeys 29 and the site suite in Chromium pass; the registry stays for 14.2 | own PR, stacked on #437 |
| 14.2 The registry and the first public version | 14 | Done locally, 2026-11-07 (stage 6): the four packages' `publishConfig` is `https://registry.npmjs.org` with `access: public`, Changesets' `access` is `public`, the release job publishes with `NPM_TOKEN` and no longer needs `packages: write`, `verify-published` and the consumer smoke read public packages with no token (the smoke's `.npmrc` and `AF_READ_TOKEN` are gone), `check:launch` fails while `@automata/tools` is not on npmjs.org, the runbook and AGENTS.md say npmjs.org. Dry run against a local Verdaccio: the four packed tarballs published, `verify-published` 4/4 at 0.0.5, `consumer-smoke --from registry` passed (it found and fixed a bug: the size step crashed without a `packs` folder). Not done, with the reason: the one-time `minor` and the folded 0.1.0 changeset (a `patch` release, 0.0.6, publishes fine and keeps `check-changesets` strict; the Owner can ask for 0.1.0). The Owner's: the `@automata` organisation on npmjs.org, `NPM_TOKEN` in the `release` environment, approving the `release` run | |
| 15.1 The game's own workflow | 15 | Done, 2026-11-07 (unit; the stranger's journey in Chromium; actionlint is the Owner's, no Docker daemon here) | |
| 16.1 The skills, for today's framework | 16 | Done, 2026-11-07 (unit; `plugin:validate`) | |
| 16.2 One generated reference | 16 | Done, 2026-11-07 (unit; `pnpm api-index` after `pnpm build`) | |
| 16.3 The docs agree with the direction | 16 | Done, 2026-11-07 (unit; `pnpm check`) | |
| 16.4 The skills' public home | 16 | Done, 2026-11-07 (the workflow invariants; both steps run locally; a real run needs `SKILLS_TOKEN`, the Owner's) | |
| 17.1 The workflow invariants replace the YAML-pinning tests | 17 | Done, 2026-11-06 (session 11): five rules over every workflow, each failing on a fixture; they found the Ruken publish job open to pull requests (fixed); 108 pinning tests deleted | this session's PR |
| 17.2 The packages that lost their reason | 17 | Done, 2026-11-06 (session 11): core-packs, bundle-report and the API seams list deleted, the stack page's Plus and Effect cards gone; evidence's Proof half goes with the page in 18.1 | this session's PR |
| 17.3 The code refactor of the tooling that stays | 17 | Done, 2026-11-07 (session 20): the read's findings in the plan's log; one header and two stale knip hints fixed, no dead code found | this session's PR |
| 18.0 The shared layout, fixed first (added 2026-11-06) | 18 | Done locally, 2026-11-07 (session 22): the audit rerun counts 30 targets under 44 px (was 4,938), all on Start, then fixed; `site.e2e.ts` holds every page to 44 px at the six audit sizes, with the touch hint and the opaque menu (Chromium); M2 checked by eye | #433, this PR |
| 18.1 Features, the page cut and redirects | 18 | Done locally, 2026-11-07 (session 21): AI, Showcase, Cheatsheet cut; nine static redirects; `src/lib` and `src/data` moved into `features/` and `shared/`, routes thin; `--features site --components` 0 findings; site unit, check:site and the Chromium site suite pass | #434 |
| 18.2 Home and Start on the current code | 18 | Done locally, 2026-11-07 (session 21): Step V's first example paints a field and a line (H5), phone landscape puts the demo and the preview above the fold (M3); Home's editor picture waits until the reader is near (NearView) | #433, #434 |
| 18.3 The editor page and "Try the editor" | 18 | Done locally, 2026-11-07 (session 21): `/editor` with three screenshots and Try the editor at `/editor/app/` (the editor's own build, browser storage, no console error); Privacy says so | #434 |
| 18.4 Docs and API | 18 | Done locally, 2026-11-07 (session 22): the docs are `docs/guides/` in the order of its `index.md`, with the new How it works; the site's own docs and their Effect wording gone, 20 old addresses redirect; API pages fold (longest 1.5 phone screens); Chromium site suite passes | this PR |
| 18.5 The code refactor of the site | 18 | Done locally, 2026-11-07 (session 22): the read in the plan's log; dead CSS and `isEditing` out, tests in `tests/unit/<feature>/`, the guides' lists render whole, `site-checks.ts` split, headers and `site/README.md`; unit 334, `check:site`, Chromium site suite pass | this PR |
| 19.1 The visitor's journey | 19 | Done locally, 2026-11-07 (session 23): desktop and upright phone in Chromium (WebKit not run here); found and fixed the try-it canvas under the CSP and the demo's sideways frame on a phone; audit rerun, section 7 | this PR |
| 19.2 Links, privacy and the closed beta | 19 | Done locally, 2026-11-07 (session 24): no link into the private repository (`check:site`, beside its link and anchor rules); the closed-beta scan ends the site's build; three history-pinning tests deleted (WT1); site unit 333 | this PR |
| 20.1 The copy table | 20 | Done locally, 2026-11-07 (session 24): 17 rows changed in `copy.md` (demo controls, search, examples' titles, playground, Start's agent setup, two guides, `automata editor`'s first line), kept rows with reasons; visitor journey asserts the headline and Start's steps; site suite in Chromium 345 | this PR |
| 21.0 The site's own domain (added 2026-11-06) | 21 | Partly: every site URL is on `automataframework.com` (session 9); the DNS is the Owner's | |
| 21.1 The deploy, ready | 21 | Done locally, 2026-11-07 (session 24): `site.yml` deploys from `main` after the 2D journeys, "No host configured yet." without the token; `check:launch` refuses a personal mailbox (the Gmail stays until the Owner decides, so the deploy waits); the runbook's launch steps; `actionlint` is the Owner's (no Docker) | this PR |
| 21.2 The Owner's inputs and go | 21 | Not started | |

Done means: someone new finds the site, makes a 2D game with `create-game`, edits its level with `automata editor`, sees
the change in the game and publishes it, with nothing from 3D in the way; and journeys prove each step on every pull
request.

## 3D (core, editors, website): 50% (3 of 6)

Scope: the 3D core (`render-pixi3d`, `figures`, `sector-format`, `vendor/pixi-3d`), the 3D editors (`editor-3d`:
Levels 3D, the Studio, the full suite page, the suite's phone layout), `games/base-3d`, `examples/3d`, the 3D gates and
the site's 3D parts.

| Stage | Status | Record |
|---|---|---|
| 1. Audit | Done, 2026-11-07 (PR stacked on #441): 10 structure (S1 to S10), 3 contracts (K1 to K3), 6 editor shipping (E1 to E6), 5 layout and look (V1 to V5), 6 tests (T1 to T6), 7 game (G1 to G7), 2 CI (Q1, Q2), 2 site (W1, W2), 10 copy (C1 to C10); and, the same day on the Owner's word, FigureBuilder and EnvironmentBuilder measured against AF (B1 to B10, section 9); 10 decisions for the Owner (D1 to D10); the Owner took D10 the same day: C on the card ("Their pixel-art look too"), then "Take everything basically", then "We use pixi3D, and 2D should also use the duel palette". 3,836 unit and DOM tests pass; the 3D editor's Chromium layout and canvas run 187 pass and 8 fail (the known 8); base-3d's journeys 8 of 8 and the 3D examples' 9 of 9 in Chromium. Headline: the 3D editor cannot open base-3d, and the Studio is unreachable | [2026-11-07-3d-slice-audit.md](2026-11-07-3d-slice-audit.md) |
| 2. Plan and spec | Done, 2026-11-07, rewritten the same day with the superpowers plugin (`brainstorming`, `writing-plans`) in place of the hand-written first version (#443), with the paused plan audit's 21 findings folded in: D1 to D9 on the audit's recommendations, D10 as the Owner took it; four parts in the Owner's order, 20 phases, 53 tasks, each with files, interfaces and its failing tests; one `@automata/3d` package in `--features` layout (shared timeline, level and time of day), DUEL AF-wide, one timeline, one level format (`af-sector/2`, field by field), the look on Pixi 3D, `automata textures` in `-tools`, the 8 tests fixed in phase 1 | [spec](2026-11-07-3d-slice-spec.md), [plan](2026-11-07-3d-slice-plan.md) |
| 3. Plan audit | Done, 2026-11-07, with the superpowers plugin (`writing-plans`' self-review), native: 26 findings against #444's head, the checkout and both builders, all fixed in place in the spec and the plan (the move map now follows today's imports, so `--features` holds: `shared/render/`, the occluders the camera's; the test mover's real flags; the goldens renamed and re-recorded once for FigureBuilder's newer fat; the 15 classic kinds; `Ease` keeps the cubic-bezier tuple; `LevelProblem`; `findCutByBar` in place of `findClipped`; the 2D slice's real-command harness reused; editor-3d's full move map; the look's target follows a phone in portrait; drunk grandma fixes to the new words). The paused audit's 21: 17 fixed by the rewrite, 4 finished here. DUEL's author and licence stay the Owner's | [record](2026-11-07-3d-slice-plan-audit.md) |
| 4. Build | In progress (Sonnet, high): 27 of 54 tasks, see the build table below | [plan](2026-11-07-3d-slice-plan.md) |
| 5. Build audit | Not started | |
| 6. Fixes | Not started | |

**Where to resume (2026-11-08, session ngqsn7 after 14.1):** the build continues at task 14.2 (dead entries, the shim and the tokens) on branch `claude/project-thread-ngqsn7`, stacked on #467. 14.1 is done (the plan's log has seven rulings). Facts a fresh session needs: `editor-3d`'s tests are in `tests/{unit,browser/{layout,canvas,journeys}}` and import the code as `#src/...`; run them with `pnpm exec vitest run --project unit`, `--project 'layout (chromium)'`, `--project canvas`, `--project 'journeys (chromium)'` in `packages/editor-3d` (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`); a mover does not rewrite `new URL(...)`, `import.meta.glob(...)` or path strings in data. The `src/entries/index.ts` and `./suite` export that 14.2 deletes are now at `src/entries/index.ts` and `src/app/suite/index.ts`.

**Where to resume (2026-11-08, 00:20, session iivhdo after 13.3, part B done):** the build continues at part C, task 14.1 (`editor-3d` by feature; the plan's step 6, merging part B's PRs in stack order, belongs to the merge thread, not this one) on branch `claude/project-thread-x8jce3` (PR #467); 12.2 is done (the plan's log, "Task 12.2", has eight rulings). The Plus port moved to a new thread, `cmsg_01Bdevh9DCcthSQNtQzThLSXABi58zGxx9tEDe8tK4L8zr`: send it anything about `packages/3d`. A fresh checkout needs `pnpm install --frozen-lockfile` (7 s) before anything runs; a full `pnpm check` is about 4 minutes and once failed in `@automata/framework#build` on a missing `src/node_modules/.cache/af-paraglide-fixture` file (a unit test writes it while `svelte-package` reads `src`; run `pnpm check` again). To try a generated 3D game, make it inside the workspace with `node packages/tools/src/app/bin.ts create-game games/<id> --template 3d --link-workspace`, run its tests with `pnpm exec vitest run --configLoader runner`, and set its tsconfig to `module ESNext` and `moduleResolution bundler` (the workspace's packages are sources); delete it and restore `pnpm-lock.yaml` after. The stranger journey for 3D (`AF_BETA_3D=1 pnpm exec playwright test --trace off stranger-3d` in `tooling/consumer-smoke`, after `pnpm build`) takes about two minutes and stops at `@automata/3d` shipping `.ts` sources: the release PR must build it to `dist/`.

**Where to resume (2026-11-07, 23:00, session x8jce3 handed off after 12.1):** the build continues at task 12.2 (`create-game --template 3d`) on branch `claude/project-thread-x8jce3` (PR #467, stacked on #465), then phase 13. Done in that PR: 10.2, 11.1 to 11.3, 12.1. Read the plan's execution log for each task's rulings. Facts a fresh session needs: base-3d's tests run with `pnpm exec vitest run --configLoader runner --project unit` (and `--project layout --browser.name=chromium` here, since only Chromium is installed); the 3D journeys run with `pnpm exec playwright test --project=base-3d --project=base-3d-dev --trace off` in `games/base-3d` and `--project=examples-3d` in `examples/3d`; `PATH` needs `/opt/node24/bin` and `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`; commits take two to four minutes in the hook, so run them in the background and wait on their exit; the progress tables have a 2D slice section above the 3D one with the same task numbers, so edit the 3D rows only (the build table near line 450). 12.2 needs a whole new game template (project files, vite config with the 3D content kinds, a sim with Wick and one room, tuning, editor list, tests) that passes `automata check`, a `--template 2d|3d` flag, the gate `3D games need a package that is not public yet. For now, make a 2D game: leave out --template.`, and a consumer-smoke case behind `AF_BETA_3D=1` that cannot run offline.

**Earlier (2026-11-07, stage 3 done):** the build (stage 4, Sonnet high) starts at task 1.1 of the [plan](2026-11-07-3d-slice-plan.md) with `superpowers:executing-plans`, natively in the session with no subagents, handing off after 90 minutes; the [plan audit](2026-11-07-3d-slice-plan-audit.md) lists what changed. Before it, stage 2's note: the plan audit read the
[spec](2026-11-07-3d-slice-spec.md) and the [plan](2026-11-07-3d-slice-plan.md) against the audit, the checkout and
both builders at FigureBuilder `025ffb4` and EnvironmentBuilder `6d82a52`. The paused audit's 21 findings are folded in
(the plan's "Audit notes folded in" says where each went); its unchecked items remain: the editor-3d move map (14.1),
the site paths (19.1), the copy table and the 2D editor counts. Then the build (Sonnet, high) starts at task 1.1 with
`superpowers:executing-plans`, natively in the session with no subagents, handing off after 90 minutes.

### Build: 50% (27 of 54 tasks)

Scope trim (2026-11-07 19:28, the Owner): 3D core as light as 2D; see [2026-11-07-3d-scope-trim.md](2026-11-07-3d-scope-trim.md). 9.1 and 9.2 moved to the Plus port and leave the count; 7.5, 7.6 and 7.7 joined it, so it is now 54 (the Owner at 19:58 kept the base pair and the base interior and exterior in core).

One row per task of the [plan](2026-11-07-3d-slice-plan.md); a task is done when its checks have passed in the session that did it. The percentage is done tasks / 54.

| Task | Phase | Status |
|---|---|---|
| 1.1 Every unit test in the gate | 1 | Done, 2026-11-07 (pnpm check green with every unit test: 3D 292 + 426 + 2,932 + base-3d 82 + sector-format 104 among them; gate-scripts 3 RED then GREEN; hosted CI not run) |
| 1.2 Three 3D jobs and #425's timeout fix | 1 | Done, 2026-11-07 (gate-scripts and workflow-invariants RED then GREEN (22); 3d.yml parses; actionlint not run here (no Docker daemon): the Owner's; hosted CI not run) |
| 1.3 One scroll region per dialog (the seven `open-flows` failures) | 1 | Done, 2026-11-07 (DOM test RED (2 regions) then GREEN 9/9; open-flows layout 32 pass in Chromium; hosted CI not run) |
| 1.4 The plan clear of the sheet (the Pencil failure) | 1 | Done, 2026-11-07 (unit/DOM RED then GREEN (fitInto, setUsable, usableArea); editor-3d Chromium layout+canvas 203 pass, 0 fail; typecheck and knip clean; hosted CI not run) |
| 1.5 Every action whole and uncovered | 1 | Done, 2026-11-07 (new checks RED (import) then GREEN; automata Chromium browser 2,124 pass, editor layout 446 pass, editor-3d layout+canvas 203 pass; API report, index and changeset written; WebKit and Firefox not run here) |
| 1.6 The 3D editor's journeys in Chromium | 1 | Done, 2026-11-07 (journey-project unit test RED then GREEN; editor-3d journeys 16 pass in Chromium, WebKit not run here) |
| 1.7 Paraglide never empties its folder | 1 | Done, 2026-11-07 (RED then GREEN; content 421 unit pass; base-3d browser (Chromium) 32/32 three runs in a row; hosted CI not run) |
| 2.1 The move map and `packages/3d` | 2 | Done, 2026-11-07 (390 files moved by `docs/refactor/move-map-3d.json`; 3d unit 821 (822 less one duplicate test), Chromium parity 17 + 2 skipped and goldens 24 as before; full unit run 30/30, typecheck, boundaries, style, knip green; WebKit/Firefox not run here, hosted CI not run) |
| 2.2 Tests in `tests/`, the feature rule on | 2 | Done, 2026-11-07 (96 test files moved; 3d unit 821 and Chromium browser 41 + 2 skipped as before; `--features packages/3d` and `--test-imports` find 0; typecheck, lint, knip green; WebKit/Firefox and hosted CI not run) |
| 3.1 The renderer in plain TypeScript | 3 | Done, 2026-11-07 (3d and base-3d import no `effect`, enforced by `--forbid`; 3d unit 822, Chromium parity 41 + 2 skipped, base-3d unit 82; build, api-report and api-index regenerated; WebKit/Firefox and hosted CI not run) |
| 4.1 The source game's level format goes | 4 | Done, 2026-11-07 (editor-3d unit+dom 2,196 pass (151 files) after deleting the Last Light tests and moving the generic ones to the depot, the toy level or synthetic profiles; Chromium layout+canvas 203 and journeys 16 pass; typecheck, knip clean; hosted CI not run) |
| 4.2 Goldens recorded from AF's own code | 4 | Done, 2026-11-07 (3d unit 812; Chromium parity 41 + 2 skipped; the three goldens re-recorded once from AF's code after checking the old against the new within 1e-9: geometry, locomotion, holds and stands identical, actions within 1.4e-4, the hair spring's head is AF's; `goldens-fresh` RED then GREEN; tsc, knip, style, source-names and boundaries clean; WebKit/Firefox and hosted CI not run) |
| 5.1 The palette in `-content` | 5 | Done, 2026-11-07 (DUEL's 32 ramps, `rampOf`, `step`, `nearestDuel` in OKLab, 32 ramp names and `duelIndex`; `docs/art/palettes/duel.txt` checked against the code; `endesga-64.ts` deleted; the remap codemod `tooling/codemods/src/remap-palette.ts`; hosted CI not run) |
| 5.2 Emberwick, the theme, the examples and the editors' game art on DUEL | 5 | Done, 2026-11-07 (Emberwick's sprites, backdrop, scene, particles and page, the theme tokens, the create-game templates, the 2D examples' PNGs and atlases remapped by `nearestDuel` and regenerated; the sim golden hash did not move; the theme contrast test now holds the WCAG minimums and at least 85% of the old ratios; before/after screenshots in `/mnt/project-files/refactor/2026-11-07-duel-screens/`; hosted CI not run) |
| 5.3 The 3D swatches are DUEL steps | 5 | Done, 2026-11-07 (a swatch is `{ ramp, step }`; 95 TOMLs and the five figures examples converted; the 3D views' and examples' hex colours moved to the nearest DUEL colour; `grep -ri endesga` finds only provenance, history and the codemod's test; goldens unchanged and fresh; hosted CI not run) |
| 6.1 The provenance record | 6 | Done, 2026-11-07 (`pnpm sources-md` checks the two builder sections and a row's AF path against `builders-manifest.json`: 300 figure and 214 environment files; `--complete` goes on in 10.2; chained into `pnpm source-names`; 6 unit tests) |
| 6.2 The body, the stand and the face | 6 | Done, 2026-11-07 (3d unit 918: fat on the limbs, neck and jaw, `bust`, `seat`, the eyes' size, spacing and tilt, face and body asymmetry, the natural stand, `standElbow`, `standOut` and the side bend; every slider at either end builds; the figure goldens re-recorded once, the leg rings moved at every fat; the sim hash did not move, the view is not in it) |
| 6.3 One timeline; lighting; actions as clips | 6 | Done, 2026-11-07 (3d unit 963: the shared timeline, the merged time of day, the lamps' maths, and reach, look and flinch as `figure-action` files that compile to clips; base-3d unit 82; Chromium browser suites not rerun, no renderer code moved; WebKit/Firefox the Owner's) | PR below |
| 6.4 Hair, fit, seats and the registries | 6 | Done, 2026-11-07 (`pnpm check` green; 3d unit 1010; 24 Chromium figure goldens pass; `dress.json` re-recorded twice, for the cuffs and for the bun): the garment, outfit-hook, hair-piece, finish and fabric registries; cuffs and collar sized from the body; the low pony, flat bun and loose hair (curl, volume); seats as a content kind |
| 6.5 Streetwear becomes an example extension | 6 | Done, 2026-11-07 (session d60hqd; `examples/3d/wardrobe` is a workspace package: 95 unit tests and 14 Chromium parity tests; its dress goldens (7 outfits) and stand goldens (49) are byte for byte the ones those outfits had in core; core's goldens re-recorded for classic-only outfits; `pnpm lint`, `typecheck`, `boundaries`, `style`, `source-names`, `knip` clean; 3d unit 1002, base-3d, editor-3d and the wardrobe `test:unit:3d` green; 24 Chromium figure goldens pass; WebKit/Firefox and hosted CI not run) |
| 7.1 `af-sector/2` and its migration | 7 | Done, 2026-11-07 (session d60hqd; `readLevel` reads `/1` and `/2`, `convertBuilderMap` converts the five builder maps; 113 level tests, base-3d unit 84 with the sim and render goldens unchanged; the editor still opens `/1` only, moved to 14.1 and 16.2 in the plan log; WebKit/Firefox and hosted CI not run) |
| 7.2 The world builder | 7 | Done, 2026-11-07 (session h7alco; `buildWorld(level, library)` gives floors, ceilings, walls with portal steps, holes, openings, trim, windows, shopfronts and hinged doors, and reports a degenerate room, a missing swatch and a portal to nowhere as `LevelProblem`s; `drawWorld` draws the pieces with `@pixi/3d` and `Occluders.face` puts a wall's face under the occluder rule; base-3d's room is drawn by it (the sim and its goldens unchanged, 85 unit tests); the before and after frames are in project files `refactor/2026-11-07-3d-7-2-room-shots/`; editor-3d's `sector-mesh.ts` stays until 14.1; `pnpm check` green; WebKit/Firefox and hosted CI not run) |
| 7.3 Props a game places, and lamps (trimmed: [scope trim](2026-11-07-3d-scope-trim.md)) | 7 | Done as trimmed by the scope ruling, 2026-11-07 (session 50d3sw; core places the props a level names through a generator registry with `box` and `cylinder`, keeps the lamp kit, lamps and the swatch and prop content kinds; the generators, library, dresser, lettering, decals, generated and converted maps are out for the world-kit extension, from commit 78e0ca7f and project files `af-world-kit-source/`; base-3d's room places five crates and barrels, sim hash and goldens unchanged, 7 Chromium journeys pass; frames in project files `refactor/2026-11-07-3d-7-3-room-shots/`; WebKit/Firefox and hosted CI not run) |
| 7.4 The piece states | 7 | Done, 2026-11-07 (session 50d3sw; `PieceStates` and `updatePieces`: a door turns about its hinge, a prop moves, turns and hides, a lamp's state scales `sceneLamps`; no `compose-scene` or `startClip`, ruled in the plan's log; `pnpm check` green; WebKit/Firefox and hosted CI not run) |
| 7.5 One sector geometry | 7 | Done, 2026-11-07 (session 50d3sw; `shared/level/geometry.ts` holds the seven sector functions once, exported from `@automata/3d/level`; the world builder uses it and its own ear clipping is gone; editor-3d switches in 14.1, the extension in port 5.1; `Math.sqrt` replaces `Math.hypot` for the sim rules; 1172 3D unit tests pass, sim hash unchanged; WebKit/Firefox and hosted CI not run) |
| 7.6 Clothes, hairstyles and seats leave core | 7 | Done, 2026-11-07 (session 50d3sw; core registers 7 garment kinds, no hair piece and 2 finishes, and no seats; `hairParts` reads the registry; the removed code and goldens are in project files `af-character-kit-source/` for port task 3.6; Wick's golden unchanged; 1136 3D unit tests pass; WebKit/Firefox and hosted CI not run) |
| 7.7 The base pair and the base scenes | 7 | Done, 2026-11-07 (session 50d3sw; `@automata/3d/base`: `BASE_PAIR`, `BASE_SCENES`, `baseLibrary`; core registers box, cylinder, table, bin, lamp, streetLamp and tree; `buildWorld` gives the builder's pieces for both scenes, recorded from 78e0ca7f; 1149 3D unit tests pass; WebKit/Firefox and hosted CI not run) |
| 8.1 Measure, then choose | 8 | Done, 2026-11-07 (session csifpz; `spikes/3d-look/` on base-3d's own page: full 50 ms, low-resolution field 33 ms, passes 50 ms, bake 33 ms median in software WebGL2, recorded not judged; the beta takes a custom lighting bit and a post effect and the letterbox's composite target is already the nearest-upscaled low-resolution field; [ADR 0007](../adr/0007-3d-look.md) chooses passes, with figures falling back to a bake only if the GPU runner's phone profile misses) | [#465](https://github.com/mcthaydt/automata-framework/pull/465) |
| 8.2 The passes (no reference painters; sky and rain to the world kit) | 8 | Done in part, 2026-11-07 (session csifpz; `features/look/`: look, `targetSize`, `rampLit`, stepped-light material on the world, DUEL snap and outline `PostEffect`s in GLSL + WGSL, `addLookPass`, `spriteLight`; base-3d draws at a 389 x 180 field; Chromium WebGL2 parity and base-3d journeys green; WGSL, WebKit, Firefox and the GPU frame numbers are the Owner's; `spriteLight` is not applied to the figure view yet) | [#465](https://github.com/mcthaydt/automata-framework/pull/465) |
| 9.1 `automata textures` in `-tools` | 9 | Moved to the Plus port, task 3.8 (scope trim) |
| 9.2 The builders' `reads` checks | 9 | Moved to the Plus port, task 3.8 (scope trim) |
| 10.1 No plan IDs or source names in code | 10 | Done, 2026-11-07 (`source-names --code`, 0 findings in `packages/3d`, `--plan-comments` 0; `sample` is `blendKeyPoses`; `pnpm lint`, `typecheck`, `boundaries`, `knip`, `style`, `source-names` and 3D unit 1,165 pass) |
| 10.2 README, a complete record, part A's close | 10 | Done, 2026-11-07 (session x8jce3; `packages/3d/README.md`; `docs/provenance/sources.md` has a row for every manifest file of both builders (`pnpm sources-md --complete` 0 findings, now part of `source-names`); part A's done check: `pnpm check` green, the 3D browser suite in Chromium 31 pass and 2 skipped; WebKit, Firefox and hosted CI not run) |
| 11.1 The feature layout and `content/` | 11 | Done, 2026-11-07 (session x8jce3; `games/base-3d` in Emberwick's layout: `src/{app,features/{hero,embers,room,scene,screens},shared,testing}`, `main.ts` at the root, `content/` with `editors.toml` and `tuning.toml` (the walk and the roll are tunables in the sim's content), tests in `tests/{unit,browser,e2e-dev}` with `#src/…` imports, `EDITOR-GAPS.md` deleted; the map is `move-map-base-3d.json`; `--features games/base-3d` and `--game` pass; unit 85 (+3 editor-list), Chromium layout and sim 32, journeys 8 pass; the replay's events, ticks and end state are the same, the hash moved once because the tunables entered the content (`c735b5acacbbc716` → `369b408a42e81cac`, ruled in the plan's log); WebKit, Firefox and hosted CI not run) |
| 11.2 One name, the menu and the HUD | 11 | Done, 2026-11-07 (session x8jce3; the game is Ember Hall in the catalog, page, store listing, editor and `DESIGN.md` (`automata editor` reads `package.json` `automata.title`, a `@automata/tools` patch); the menu has a Settings button that returns to the menu (its own `menu-settings` screen and flow transition); the HUD says `Embers 0 of 6`; the pixel field takes the screen's shape (`features/scene/field.ts`) so an iPad's room fills its height (was 66%); base-3d unit 100, Chromium layout 18 pass, journeys 8 pass, `pnpm typecheck`, `boundaries`, `style`, `knip` clean; before/after screens in `/mnt/project-files/3d-slice/11.2/`; WebKit, Firefox and hosted CI not run) |
| 11.3 Journeys that play | 11 | Done, 2026-11-07 (session x8jce3; `e2e/play.e2e.ts`: with a real touch (CDP), the stick walks Wick to an ember and the HUD says `Embers 1 of 6`, Roll lunges him over 2.5 m, the goal ember opens the end screen, at 844 × 390 and 1194 × 834; `src/testing/route.ts` (`?route=ember\|goal` and `data-hero`, only in the `e2e:game` build); Chromium journeys 14 pass (7 before), first attempt after fixing the roll's hold and the 40 s steps; WebKit and hosted CI not run) |
| 12.1 The 3D examples on the new package | 12 | Done, 2026-11-07 (session x8jce3; three new examples (`figures-stand-and-sliders`, `look-pixel-art`, `world-level-room`) with journeys; the eight existing ones import `@automata/3d` and have `// --- <role> ---` sections; `examples/3d/README.md`; the catalog accepts the `look` and `world` modules; the sky-share journeys of `render3d-meshes` and `render3d-angled-camera` named the old sky colour and now name the DUEL one; Chromium 12 journeys pass, catalog and site playground unit pass, typecheck, style, boundaries, knip clean; WebKit not run) |
| 12.2 `create-game --template 3d` | 12 | Done, 2026-11-07 (session iivhdo; `--template 2d|3d`, the gate sentence, the 3D template (Wick walking one room with a box and a cylinder prop, tuning, editor list, feature layout, content test) in `template-3d*.ts` and `template-3d-content/`; the generated game typechecks, passes its 14 tests, boundaries and a build, and plays in Chromium; the stranger journey `stranger-3d.test.ts` is written behind `AF_BETA_3D=1` and stops at `@automata/3d` shipping `.ts` sources, the release PR's job; `pnpm check` 31/31; WebKit not run) |
| 13.1 `automata editor` reads 3D levels | 13 | Done, 2026-11-07 (session iivhdo; a game with no editor list opens its `.af-sector.json` room; the first line names the game by its title; tools editor unit 136 pass; WebKit not run) |
| 13.2 Docs, agents and words outside the 3D package | 13 | Done, 2026-11-07 (session iivhdo; 342 source names and 10 plan IDs rewritten to 0 in `automata`, `content`, `tools`, `base-3d`, `examples/3d`; `docs/guides/3d.md` and `games/base-3d/README.md` written; the 3D guide is not on the site until 3D is public) |
| 13.3 The 3D frame-budget projects | 13 | Done, 2026-11-08 (session iivhdo; `frame-budget-3d-phone` and `-ipad`, a 3D stress page, `firstPoseMs`; unit 51 pass, the probe skips on software; **`pnpm budget:frame` stays red for the 3D rows until the Owner's GPU run**) |
| 14.1 Feature folders and `tests/` | 14 | Done, 2026-11-08 (session ngqsn7; 406 files by a 130-row map, Levels 3D one feature with a folder per screen and the Studio another, `shared/` for what two use; `--features packages/editor-3d --components` finds 0 and runs in `pnpm boundaries`; unit 2181 (was 2196: the retired architecture test is 10, the purity cases 5), layout 189, canvas 14, journeys 16 all as before in Chromium; the duplicated geometry deleted for the level entry's; WebKit and Firefox not run) |
| 14.2 Dead entries, the shim and the tokens | 14 | Not started |
| 15.1 The full suite opens the checkout | 15 | Not started |
| 15.2 One page, chosen by the game | 15 | Not started |
| 15.3 The cuts | 15 | Not started |
| 15.4 The suite on a phone | 15 | Not started |
| 16.1 The frame, phone first | 16 | Not started |
| 16.2 The builders' authoring | 16 | Not started |
| 16.3 Plan, 3D and Walk in the game's look | 16 | Not started |
| 17.1 The frame, phone first | 17 | Not started |
| 17.2 New sliders, actions and words | 17 | Not started |
| 18.1 The copy pass | 18 | Not started |
| 18.2 Journeys against the real command | 18 | Not started |
| 19.1 Behind the switch (W1) | 19 | Not started |
| 20.1 Written and rehearsed now | 20 | Not started |

Owed to it by the 2D slice: the redesign of `editor-3d`, the Studio and Levels 3D in the website's look (the 2D slice redesigns every editor that is not 3D, the Tuner and the suite's 2D page included: tasks 12.6 and 12.7) (the Owner,
2026-11-06: "completely redesign the editors for ux, copy, and ui"; the 2D slice redesigns the kit and the 2D editor),
the suite's top bar copy and wiring (E6, G2), deleting the old token aliases `editor-3d` still uses, and the 3D
examples' and editors' code refactor to the same standard (2D spec section 17).
