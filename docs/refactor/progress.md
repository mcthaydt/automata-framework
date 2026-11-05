# Refactor progress

**Overall: 13% (3 of 24 stages done).**

The Owner's order (2026-11-05): finish one area completely before starting the next, in this order:
core and 2D, then 3D, then the editors, then the website. Each stage runs in its own session.

Every area goes through the same six stages:

1. **Audit** (Opus, extra-high effort): what is there, measured.
2. **Plan and spec** (Opus, medium, with the superpowers plugin).
3. **Plan audit** (Opus, medium).
4. **Build** (Sonnet, high), updating this page as each step lands.
5. **Build audit** (Opus, medium): complete, consistent, matches the spec and the codebase.
6. **Fixes** (Sonnet, high): every finding from stage 5 closed.

Copy and UX pass the drunk grandma test: could a drunk grandma tell what is happening and how to use it?

## Core and 2D: 50% (3 of 6)

| Stage | Status | Record |
|---|---|---|
| 1. Audit | Done, 2026-11-05; the Owner took all four decisions (D1 to D4) the same day | [2026-11-05-core-and-2d-audit.md](2026-11-05-core-and-2d-audit.md) |
| 2. Plan and spec | Done, 2026-11-05 | [spec](2026-11-05-core-and-2d-spec.md), [plan](2026-11-05-core-and-2d-plan.md) |
| 3. Plan audit | Done, 2026-11-05: 31 findings, all fixed in the spec and plan; three calls left for the Owner | [plan audit](2026-11-05-core-and-2d-plan-audit.md) |
| 4. Build | In progress: phases 1 to 4 and 6 to 8 done locally (8.2's boot-failure journey blocked on Ruken), 5 half done (5.4 at 11 of 14 steps); PRs #393 to #399 (stacked) | [plan](2026-11-05-core-and-2d-plan.md) |
| 5. Build audit | Not started | |
| 6. Fixes | Not started | |

### Where to resume (2026-11-05, eighth session)

The PRs are stacked and draft: #393 (4.3, 4.4) ← #394 (5.2, 5.3) ← #395 (6.1 to 6.4) ← #396 (7.1, 7.2 steps 1 and 2) ← #397
(8.1, 8.2 part) ← #398 (7.2 step 3, 8.2 rest, 8.3) ← #399 (5.4 so far). Next, in order:

1. **5.4:** display, locale, settings, audio, saves, loading, input, extension, leaderboards, time, the frame loop, the
   veil, the flow and every screen (the default screens, Emberwick's, base-3d's, the stress tool's) are plain (#399). A
   screen's `enter(context)` gets `context.screen` and `context.runtime` (`Disposables`) and `context.services` (one
   plain object, `clock` included). Next: **boot and `run-game`** (they still run as Effect programs that build the plain
   services; their tests are the large part), with **`render`** (`RendererFactory` is still an Effect) and
   **`RuntimeTest`** (still an Effect layer that provides the tags via `runtimeContext` in `app/boot/effect-tags.ts`);
   then delete `shared/host/effect-bridge.ts`, `hosting.ts`, `errors.ts` and `app/boot/effect-tags.ts`, give
   `AudioBuses` back its interface, take `effect` out of `packages/automata` and `games/emberwick`, and run the bundle
   report "after D2".
2. **8.1 rest:** the Settings sections' long strings, the CLI messages and the READMEs' first screens are still unchecked in
   `copy.md`. Found by the create-game journey: the pause menu's close button and its Resume button share the name "Resume".
3. **8.2 boot failure:** a request to Ruken for a refusal switch in the fake host (deviation 64).
4. **9.2** waits for the Owner's go.

### Build: 70% (21 of 30 tasks)

Stage 4 ticks these off as it goes; the [plan](2026-11-05-core-and-2d-plan.md) has the steps.

| Task | Phase | Status | PR |
|---|---|---|---|
| 1.1 Per-area Playwright configs | 1 | Done, 2026-11-05 (CI run pending) | [#388](https://github.com/mcthaydt/automata-framework/pull/388) |
| 1.2 The pull request gate | 1 | Done, 2026-11-05 (CI run pending) | [#388](https://github.com/mcthaydt/automata-framework/pull/388) |
| 1.3 Frame budget skips on a software renderer | 1 | Done, 2026-11-05 (CI run pending) | [#388](https://github.com/mcthaydt/automata-framework/pull/388) |
| 1.4 `.vscode` | 1 | Done, 2026-11-05 (CI run pending) | [#388](https://github.com/mcthaydt/automata-framework/pull/388) |
| 2.1 Tag the starting point | 2 | Partly: the tag push is refused (HTTP 403) from here, so the Owner pushes it; #379 and #383 are carried in task 4.3 | |
| 2.2 Emberwick's stand-ins | 2 | Done, 2026-11-05 (CI run pending) | PR to open |
| 2.3 The placeholder game | 2 | Done, 2026-11-05 (CI run pending) | PR to open |
| 2.4 Features no game uses | 2 | Done, 2026-11-05 (CI run pending); leaderboards kept | [#390](https://github.com/mcthaydt/automata-framework/pull/390) |
| 3.1 The Vitest preset | 3 | Done, 2026-11-05 (CI run pending) | PR to open |
| 3.2 The test move codemod | 3 | Done, 2026-11-05 (CI run pending) | PR to open |
| 3.3 Move tests, package by package | 3 | Done locally, 2026-11-05 (CI run pending): every core and 2D package, Emberwick, all 14 tooling packages and the three example packages moved; unit counts equal before and after; `pnpm check` passes. 3D and editor packages move in their own areas | PR to open |
| 4.1 The boundaries rules | 4 | Done locally, 2026-11-05 (CI run pending); the file-list comparison fails on Emberwick (12 vs 10), so the `boundaries` line switches in task 6.3 | PR to open |
| 4.2 The move map and import codemod | 4 | Done locally, 2026-11-05 (CI run pending): map and codemod tested; the dry run moves 764 files, none unmapped, none clashing; not applied until 4.3 | PR to open |
| 4.3 Build `packages/automata` | 4 | Step 1 done locally, 2026-11-05: the 764 files moved, it typechecks, builds and its unit tests pass (1,891). Step 2 done locally (2026-11-05): `--features packages/automata` finds 0 (was 120; flow, screens, settings and loading services now under `app/` and `shared/runtime/`), 1,897 unit tests and the full `pnpm test:unit` (31 tasks) pass. **Open:** the browser, journey, WebKit/Firefox, 3D and editor runs. Changeset and API report written | [#393](https://github.com/mcthaydt/automata-framework/pull/393) |
| 4.4 `tools`, and `sim` and `content` inside | 4 | Steps 1 and 2 done locally with 4.3 (same PR): one `automata` bin, `automata-ship` alias, `sim/testing`, tools unit tests pass (670). Step 3 part done: sim (hash, rng, define, schedule, world shared; replay the feature), tools (ship, check, create-game shared) and content (assets, compile, flow, game, generate, locale, palette, parse, tuning shared, because they call each other in a cycle; preload and vite are the features) find 0 under `--features`; all 31 unit tasks pass. Step 3 done locally (deviation 54): `assets` is Node-only so it leaves the `--browser` list; `game-config` and `locale` are browser-safe and `pnpm boundaries` checks them. Browser (Chromium) and journey suites pass here: 25 of 25 Emberwick journeys, 3 browser test files | [#393](https://github.com/mcthaydt/automata-framework/pull/393) |
| 5.1 Bundle report, before | 5 | Done locally, 2026-11-05 (CI run pending): `tooling/bundle-report`, run on Emberwick (below) | PR to open |
| 5.2 Plain-TypeScript helpers | 5 | Done locally, 2026-11-05 (CI run pending): `Clock`/`fakeClock`, `Disposables`, `Result`, `Subscribable`/`emitter`; 22 unit tests | PR to open |
| 5.3 Host contract and targets | 5 | Done locally, 2026-11-05 (CI run pending): plain host contract, web, Ruken and Tauri adapters, contract suite and fake host take a `Clock` and `AbortSignal`; ADR 0003 amended. A temporary bridge keeps the Effect runtime working; deleting it moved to 5.4 (deviation 55) | PR to open |
| 5.4 Runtime features and the app | 5 | In progress: display, locale, settings, audio, saves, loading, input, extension, leaderboards, flow and screens plain, and in `app/` time, the frame loop and the bus (11 of 14 steps; boot, run-game, render and `testing/` left); Emberwick journeys pass (28 of 28, Chromium) | [#399](https://github.com/mcthaydt/automata-framework/pull/399) |
| 6.1 Emberwick is Emberwick | 6 | Done locally, 2026-11-05 (CI run pending): renamed everywhere; `GOLDEN_HASH` re-recorded once (`94285fae634fdba9` → `421c5a1bf522299e`), Chromium agrees; WebKit and Firefox left to CI | PR to open |
| 6.2 Emberwick imports one package | 6 | Done locally, 2026-11-05: only `@mcthaydt/automata`, `-sim`, `-tools` and `-content` remain | PR to open |
| 6.3 Emberwick by feature | 6 | Done locally, 2026-11-05 (CI run pending): `app/`, `features/{player,goal,room,scene,screens}`, `shared/`, `entries/`, `testing/`; `--features games/emberwick` and the sim rule pass (deviations 56 to 58) | PR to open |
| 6.4 The surface | 6 | Done locally, 2026-11-05 (CI run pending): `@mcthaydt/automata` root 600 → 274 names; the ten API reports 2,109 → 1,783 exports (audit's 1,042 was counted differently); changeset `trim-the-root-entry` | PR to open |
| 7.1 Docs and AGENTS.md | 7 | Done locally, 2026-11-05: `docs/archive/`, `docs/README.md`, `docs/status.md` (47 lines), `AGENTS.md` (88 lines), `examples/README.md` | PR to open |
| 7.2 Comments that cite plans | 7 | Done locally, 2026-11-05: 762 hits rewritten (automata 399, sim 39, content 69, tools 113, tooling 142); `pnpm style` checks every core, 2D and tooling root | #398 |
| 8.1 The copy table | 8 | Step 1 and 2 done locally for core screens, boot failure and Emberwick (`copy.md`); CLI messages, READMEs and Settings sections still to check | PR to open |
| 8.2 New Emberwick journeys | 8 | Done locally except boot failure: pause on hide and the end screen added; touch-only and the examples' reload journeys already existed; slow load dropped (deviation 67); boot failure blocked on a refusal switch in Ruken's fake host (deviation 64) | #397, #398 |
| 8.3 The `create-game` journey | 8 | Done locally, 2026-11-05 (Chromium, 1 of 1): it found that the template never booted a game; the template now runs on the default screens (deviation 68) | #398 |
| 9.1 Prepare the branch clean-up | 9 | Done: `branches.md` and `pnpm branches:prune` (dry run only; nothing deleted) | |
| 9.2 Run it (the Owner's go) | 9 | Not started | |

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

**Last bundle numbers (S8, from the placeholder game, measured 2026-11-05 just before it was deleted):** the page
with Effect is 143.85 kB raw and 46.87 kB gzip; the same page without Effect is 54.55 kB raw and 18.60 kB gzip, so
Effect's share was 28.3 kB gzip against a 35 kB budget. The boot-time budgets were 300 ms (100 ms for Effect's
share) at 4x CPU. No bundle budget runs until the bundle report (task 5.1) takes these numbers over.

Done means: Emberwick's journeys pass on every pull request in two browsers, the Owner plays it on the iPad, the
repository has only `main` and branches with active CI (fewer than 5), the code follows the feature-folder layout
with tests in their own folder, and `.vscode` hides what the Owner does not need to see.

## 3D: 0% (0 of 6)

Not started. Starts when core and 2D are done.

## Editors: 0% (0 of 6)

Not started. Starts when 3D is done.

## Website: 0% (0 of 6)

Not started. Starts when the editors are done.
