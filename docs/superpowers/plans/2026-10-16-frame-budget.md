# PRODUCT.7: frame-budget probe and core stress example, TDD plan

- **Spec:** [PRODUCT spec](../specs/2026-10-16-product-core-and-plus-design.md) §2 F5 and the §3 row "Frame-budget probe (`playwright.config.ts` `frame-budget` projects)": new, core.
- **Row:** [02](../../02-master-delivery-plan.md) PRODUCT.7. **Status:** drafted 2026-10-16 on the Owner-approved PRODUCT.0 (all recommended defaults).
- **Progress:** 5 of 7 steps.

## What "done" means

- A **core stress example**: N entities, M systems, an entity view per entity and a DOM UI overlay. It is built only on public core APIs (`runGame`, `AppLoop`, `createSim`, `define*`, `createPixiRenderer` entity views, `ui`'s `ActionBar`).
- A **probe** that measures ms/frame on the production build (`vite build` + `vite preview` with Ruken's headers). It runs as the Playwright `frame-budget-*` projects and writes one JSON result per project, including the environment it ran in.
- A **budget check** that compares results with the recorded budget. It fails closed when:
  - the budget is unset;
  - a result is missing or malformed;
  - a result came from a software renderer;
  - a result came from a different GPU than the budget's.
- **No budget is invented.** `budget.json` stays `"status": "unset"` until the first measured run on the GPU runner (Owner acceptance). Numbers from this container (no GPU, SwiftShader) are reported only as a local software-rendering smoke, never as a budget.

## Location (why `tooling/frame-budget`)

`examples/` and `games/` are both being reshaped right now:
- EX.1 turns `examples/` into one package of one-file examples, with a catalog that rejects unknown modules, files over 100 lines and so on.
- EX.2 (PR #35) moves the games to `games/`.

A parametric N×M stress page is a measurement fixture, not a teaching example or a game. It does not fit EX's one-file rules either. `tooling/frame-budget/` is a new folder in the existing `tooling/*` workspace glob that neither EX task touches. It is private (never published).

The stress page lives in `tooling/frame-budget/stress/`. A test pins that it imports only public core entries plus `pixi.js`, `effect`, `svelte` and `zod`, so it stays a "public core API" example. Moving it into the examples catalog later is a follow-up for EX.4. It is not done here.

## Method (from spike S8)

S8 (`examples/placeholder/s8/`) did three things, and this plan reuses all of them:
- it measured the **built** page, served with Ruken's `compileHeaders` CSP, so a CSP violation fails the run;
- it ran in Chromium under Playwright device descriptors;
- it kept the budget comparison as a pure, tested `overBudget` function, where a NaN or missing value is a breach, never a pass.

Here the page is served by `vite preview` with `previewHeaders` (the same `compileHeaders` rule). The probe:
1. wraps `requestAnimationFrame` in an init script, so it can measure any build without changing it;
2. records each frame's **work** (the callback's duration: sim steps, entity views and Pixi's draw) and the **interval** between frames;
3. warms up, then samples for a fixed window;
4. writes p50, p95, p99, max and mean for both, plus the environment.

The environment recorded is:
- the GPU string (`WEBGL_debug_renderer_info`) and `data-renderer`;
- the browser and its version, user agent, viewport, DPR;
- OS, CPUs, Node, commit, runner name;
- N, M and the sample window.

AGENTS.md requires that a performance probe have exclusive use of the GPU. With `AF_FRAME_BUDGET=1`, `playwright.config.ts` selects **only** the frame-budget projects and the stress server. Without it, the default `pnpm test:e2e` selection is unchanged and never runs the probe.

## Files

- **Create (`tooling/frame-budget/`, `@mcthaydt/frame-budget`, private):**
  - `package.json`, `tsconfig.json`, `vitest.config.ts`, `vite.config.ts`, `ship.config.ts`, `index.html`;
  - `budget.json`: `status: "unset"`;
  - `src/stats.ts`, `src/stats.test.ts`: `summarize(samples)`;
  - `src/budget.ts`, `src/budget.test.ts`, `src/fixtures/*.json`: the Zod schemas and `checkFrameBudget`;
  - `src/check-cli.ts`: `node tooling/frame-budget/src/check-cli.ts [results dir]`;
  - `src/playwright-run.ts`, `src/playwright-run.test.ts`: `selectRun(env, journeys)`, the projects and the server;
  - `src/origin.ts`: the stress port, preview + 200;
  - `stress/main.ts`, `stress/stress-game.ts`, `stress/stress.screen.ts`, `stress/views.ts`, `stress/params.ts`, `stress/no-eval.ts`;
  - `stress/sim/stress.component.ts`, `stress/sim/stress.system.ts`, `stress/sim/stress.plugin.ts`, `stress/sim/stress.test.ts`;
  - `stress/stress-game.test.ts`, `stress/public-api.test.ts`;
  - `e2e/frame-budget.e2e.ts`.
- **Modify:**
  - `playwright.config.ts`: `selectRun` picks journeys or frame-budget;
  - root `package.json`: `test:frame-budget`, `budget:frame`, and `boundaries` (add `tooling/frame-budget/stress/sim`);
  - `.gitignore`: `frame-budget-results/`;
  - `.github/workflows/ci.yml` and `packages/ship/src/workflows.test.ts`: a nightly `frame-budget` job on `AF_GPU_RUNNER`.

## Interfaces

- **Consumed:**
  - `runGame`, `AppLoop`, `PresentationBus`, `GameDefinition`, `ScreenDef` (runtime);
  - `createSim`, `defineComponent`, `defineSystem`, `definePlugin`, `canonicalJson`, `xxhash64`, `hex64` (sim);
  - `createPixiRenderer`, `EntityView` (render-pixi), `ActionBar` (ui);
  - `previewHeaders` (demo-host);
  - Playwright 1.63.
- **Produced:**
  - `summarize(samples: readonly number[]): FrameStats`;
  - `FrameBudgetResult` (Zod), with `project`, `environment`, `scene: { entities, systems }`, `sampleSeconds`, `workMs: FrameStats`, `intervalMs: FrameStats`;
  - `BudgetFile` (Zod), either `{ status: 'unset', note }` or `{ status: 'set', evidence, gpu, projects: Record<project, { workMsP95, intervalMsP95 }> }`;
  - `checkFrameBudget(budget, results): { verdict: 'pass' | 'over' | 'unset' | 'not-comparable' | 'invalid', lines: string[] }`;
  - `selectRun(env, journeys)`;
  - the HTML contract: `data-state="ready"`, plus `data-stress-entities` and `data-stress-ticks` on the stress screen.

## Steps

- [x] **1. Plan.** This file. Commit `docs(frame-budget): PRODUCT.7 TDD plan`.
- [x] **2. Stats.**
  - `stats.test.ts`:
    - p50, p95 and p99 use nearest rank on a known 1..100 array;
    - an empty sample gives NaN everywhere, never 0.
  - Run `pnpm --filter @mcthaydt/frame-budget test`. Expect it to fail because `stats.ts` is missing.
  - Implement it and confirm green.
- [x] **3. Budget check.**
  - `budget.test.ts`, over fixtures:
    - (a) the repository's `budget.json` parses and is `unset`, and checking any result gives `unset` (fail closed);
    - (b) a planted over-budget result against a set fixture budget gives `over` and names the project and metric;
    - (c) a result within budget gives `pass`;
    - (d) a SwiftShader or llvmpipe result gives `not-comparable`, and a set budget whose GPU is software is rejected as `invalid`;
    - (e) a result whose GPU differs from the budget's gives `not-comparable`;
    - (f) a NaN or missing metric, or a project with no result, gives `invalid`;
    - (g) no results at all gives `invalid`.
  - Expect it to fail because the module is missing. Implement `budget.ts` and `check-cli.ts` (exit 0 only on `pass`), then confirm green.
- [x] **4. Stress sim.**
  - `stress/sim/stress.test.ts`:
    - `stressPlugin(M)` registers M systems with distinct names;
    - spawning N entities and stepping moves them inside the bounds;
    - two sims with the same seed have the same `hash()` after 60 ticks;
    - M < 1 throws.
  - Expect it to fail because the module is missing. Implement it, add `tooling/frame-budget/stress/sim` to `pnpm boundaries`, and confirm green.
- [x] **5. Stress game on public APIs.**
  - `stress/public-api.test.ts`: every import under `stress/` is relative, a public `exports` entry of an `@mcthaydt/automata-*` package (never `./testing`), or `pixi.js`, `effect`, `svelte`, `zod`.
  - `stress/stress-game.test.ts` (jsdom, `manualFrames`, `nullRenderer`):
    - `stressGame()` boots to `ready`;
    - the stress screen shows N entities;
    - ticks rise as frames advance;
    - the content hash matches.
  - Expect it to fail because the module is missing. Implement it, then confirm green, along with `vite build`.
- [ ] **6. Probe and selection.**
  - `playwright-run.test.ts`:
    - without `AF_FRAME_BUDGET` it returns the journeys unchanged, with no `frame-budget` project;
    - with `AF_FRAME_BUDGET=1` it returns only the `frame-budget-phone` and `frame-budget-desktop` projects and the one stress server.
  - Expect it to fail, then implement it and wire `playwright.config.ts`.
  - Write `e2e/frame-budget.e2e.ts`. Confirm that `pnpm test:e2e --list` lists no frame-budget test and that `pnpm test:frame-budget --list` lists only them.
  - Run `pnpm test:frame-budget` once here. Record the numbers only as a "local software-rendering smoke, not a budget".
  - Run `pnpm budget:frame` and confirm it fails closed with `unset`.
- [ ] **7. CI.**
  - In `workflows.test.ts`, assert that `ci.yml` has a `frame-budget` job with:
    - nightly or `nightly` dispatch only;
    - runs-on `vars.AF_GPU_RUNNER` (falling back like `e2e`);
    - a job-level concurrency group;
    - steps `pnpm test:frame-budget` then `pnpm budget:frame`;
    - an always-uploaded `frame-budget-results` artifact.
  - Expect it to fail, then add the job and confirm green. Run actionlint if Docker is available.

## Gates

- `pnpm format`, then `pnpm check`.
- `pnpm test:parity`: the sim boundary list changed, and nothing else in the sim changed.
- `pnpm test:e2e`, with `CI=1` and free ports checked: it proves the default selection is unchanged.
- `pnpm test:frame-budget` once, as a smoke. Its numbers are not a budget.

## Owner acceptance (left open)

- **The first frame-budget run on the GPU runner.** Its artifact becomes `budget.json`'s evidence, and the Owner chooses the headroom.
- Exclusive GPU on the shared af-linux PC: a job concurrency group keeps AF's own probes apart, but Ruken's jobs on the same machine are outside AF's control.

## Execution log

| Date | Step | Commits | Notes |
|---|---|---|---|
| — | — | — | — |
