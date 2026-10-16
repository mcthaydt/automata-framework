# EX: one-file examples TDD plan

- **Spec:** [`docs/superpowers/specs/2026-10-16-examples-one-file-design.md`](../specs/2026-10-16-examples-one-file-design.md)
- **Status:** drafted 2026-10-16. **Pending EX.0 review.** Do not start before the Owner reviews the spec (AGENTS.md: a draft spec does not authorize implementation).
- **Progress:** 0 of 5 tasks.

## Global constraints

- **Strict TDD** in `tooling/` and `examples/`: write a failing test first, confirm why it fails, make the minimal change, then confirm it passes.
- **Never weaken coverage.** A demo folder is deleted only after the behavior tests listed for it pass in their owning package (spec §6).
- **Gates for every PR:** `pnpm check`, `pnpm test:parity` (Chromium, WebKit, Firefox) and `pnpm test:e2e`. Run them locally (D-5) and report which were selected, omitted and pending.
- **Process:**
  - Run `pnpm format` before committing.
  - Use Conventional Commits.
  - Add a changeset only if a published package changes; `check-boundaries` does.
- **Bookkeeping:** tick each step in this file when its checks pass, in the same commit or the next one.

## Task EX.1: runner, single package, catalog, smoke, parity, `--inline`

### Files (refined at `4d29ab0`, stacked on EX.2)
- **Create** in `tooling/examples-runner/` (package `@mcthaydt/examples-runner`, private):
  - `package.json`, `tsconfig.json`, `vitest.config.ts`;
  - `src/header.ts` + `header.test.ts`, `src/catalog.ts` + `catalog.test.ts`, `src/page-template.ts`, `src/vite-plugin.ts` + `vite-plugin.test.ts`, `src/typecheck.ts` (+ test; pending examples are left out of `tsc`), `src/cli.ts` (`pnpm examples [name]`), `src/smoke.ts` (the parametric Playwright smoke), `src/parity.ts` + `src/examples.parity.test.ts`;
  - `src/fixtures/catalog/` (one bad example per catalog rule) and `src/fixtures/examples/` (the stub example `core/core-stub.ts`, its `__goldens__/core-stub.replay`, and `stub-start-game.ts`, a test stand-in for DX.2's `startGame` that is named as a stub and exported only to the fixture runner);
  - `fixtures.vite.config.ts` and `e2e/runner.e2e.ts` (the runner's own smoke over the stub);
  - `host/` (`host.ts`, `index.html`, `ports.ts`, `preview-headers.ts`, `testing.ts`, `vite.config.ts`), moved with `git mv` from `examples/demo-host/` and exported as `@mcthaydt/examples-runner/host/{ports,preview-headers,testing}`.
- **Create** in `examples/` (package `@af-examples/examples`): `package.json`, `tsconfig.json`, `vite.config.ts`, `e2e/examples.e2e.ts`, `__goldens__/.gitkeep`.
- **Modify:**
  - `tooling/check-boundaries/src/{check,check.test,cli,files}.ts`, `fixtures/inline/*.ts` (`--inline`; a directory walk skips `node_modules` and `dist`); changeset (patch);
  - `pnpm-workspace.yaml` (adds `examples`; keeps `examples/*` and `examples/*/*` until EX.4 deletes the old demos and EX.5 the gallery), root `package.json` (`examples`, `build:examples`, `boundaries`, `ci:local`);
  - the old demos' imports of `@af-examples/demo-host/*` (5 demos: `package.json`, `vite.config.ts`, `e2e/*.ts`);
  - `playwright.config.ts` (`examples` at Pixel 7 and `examples-compact` at 780×270; the runner and examples servers; the host server from its new package);
  - `.github/workflows/ci.yml` (`build:examples` beside `build:demos` until EX.4);
  - `tooling/release` workspace walk tests if the new top-level `examples` package changes what they list.

### Interfaces
- **Consumed:** `compileHeaders` (`@ruken/manifest`) through the host's `previewHeaders`, `replayGolden`/`goldenCommands` (`@mcthaydt/automata-testing/sim`), `createSim` and the `define*` verbs (`@mcthaydt/automata-sim`), the host's `openHosted` and `collectErrors`. `startGame` comes from the module the plugin is given (`start`, default `@mcthaydt/automata`, DX.2/PRODUCT.2); until then only the stub fixture runs.
- **Produced:** `parseHeader(source): Header | HeaderError[]`, `readCatalog(root, options): CatalogEntry[]` (each entry carries its `problems`), `examplesRunner({ root, start?, noEval? })` (Vite plugin), `smokeExamples(entries, baseUrl)` and `goldenExamples(root)`.

### Deviations recorded here
- **Workspace globs:** the spec replaces `examples/*` and `examples/*/*` with `examples`; the old demos and the gallery are still packages until EX.4/EX.5, so the globs stay and `examples` is added. pnpm accepts a package whose folder holds other packages.
- **Public imports:** the umbrella `@mcthaydt/automata` does not exist until PRODUCT.2, so the catalog accepts `@mcthaydt/automata` and any entry a `@mcthaydt/automata-*` package declares in `exports` (never `/src`). Narrowing core imports to the umbrella is a PRODUCT.2 follow-up.
- **Stub:** with no `defineGame` yet, the stub example exports a plain object of the shape the runner reads (`id`, `sim.plugins`, `sim.seed`); it never imports or defines anything named like DX.2's API.

### Steps
- [x] **1. Header parser.** Write `header.test.ts`:
  - a fixture with every field parses;
  - a missing `Shows:` gives a `HeaderError` with its line;
  - `Difficulty: ★★★★★` is rejected.

  Run `pnpm --filter @mcthaydt/examples-runner test:unit` and confirm it fails because `parseHeader` does not exist. Implement `header.ts`, then confirm it passes.
- [x] **2. Catalog rules.** Write `catalog.test.ts` over `src/fixtures/`, where each bad fixture fails for its own reason:
  - a file outside `<module>/<module>-<name>.ts`;
  - an unknown module;
  - 101 code lines (spec E-h);
  - a relative import;
  - a deep `@mcthaydt/automata-*/src` import;
  - a screenshot that isn't approved;
  - a `Pending:` naming a task already ticked in `docs/02-master-delivery-plan.md`.

  Confirm it fails, implement `catalog.ts`, confirm it passes.
- [ ] **3. `--inline` boundaries.** In `tooling/check-boundaries/src/check.test.ts`:
  - `Date.now()` in a `defineSystem` callback fails with rule and line (spec E-g);
  - `Math.random()` in `definePlugin` `setup` fails;
  - `document` at file level passes in inline mode;
  - a clean system body passes.

  Confirm they fail on the missing mode. Implement it by reusing the existing visitor scoped to those function bodies, then confirm they pass. Add `--inline examples` to the root `boundaries` script.
- [ ] **4. Vite plugin.** Write `vite-plugin.test.ts`:
  - `/core/core-stub/` returns the generated HTML with the `no-eval` import first and the example's module;
  - preview responses carry `compileHeaders`' CSP.

  Confirm it fails, implement `vite-plugin.ts` and `page-template.ts`, confirm it passes.
- [ ] **5. Single examples package.**
  - Create `examples/package.json` (`@af-examples/examples`), `tsconfig.json` and `vite.config.ts`.
  - Move `examples/demo-host` to `tooling/examples-runner/host` with `git mv`, and update its importers.
  - Update `pnpm-workspace.yaml`.

  Verify that `pnpm install`, `pnpm typecheck` and `pnpm examples` serve the index with a stub example.
- [ ] **6. Smoke project.** Write `examples/e2e/examples.e2e.ts`, which loops over `readCatalog()`. For each non-pending entry it opens the example hosted, waits for ready, and asserts no errors. Pending entries are reported with `test.skip(true, 'pending: <task>')`.
  - Confirm it fails with no server.
  - Add the `examples` project (Pixel 7 and 780×270) and its `webServer` to `playwright.config.ts`.
  - Confirm it passes on the stub.
- [ ] **7. Parity.** Write `examples.parity.test.ts`. For each `Golden:` entry it runs `replayGolden` against `examples/__goldens__/<name>.replay` in Node and the browsers project.
  - Confirm it fails on a stub with no replay.
  - Record the stub's replay once, in Node.
  - Confirm it passes in Node, Chromium, WebKit and Firefox.
- [ ] **8. CI.**
  - In `ci.yml` and `ci:local`, `build:demos` becomes `build:examples`.
  - Run actionlint.
  - Run `pnpm check`, `pnpm test:parity` and `pnpm test:e2e`. The old demos keep running until EX.4.

## Task EX.2: move Emberwick and the placeholder to `games/`

### Files
- **Move:**
  - `examples/base-2d` to `games/emberwick`;
  - `examples/placeholder` to `games/placeholder`.
- **Modify:** every path in spec appendix B, re-grepped at `71c3410`:
  - `pnpm-workspace.yaml` (adds `games/*`) and `pnpm-lock.yaml` (importer keys, through `pnpm install`);
  - root `package.json` (`boundaries`), `playwright.config.ts`, `.github/workflows/ci.yml` (`working-directory`);
  - `packages/ship/turbo.json`, `packages/ship/src/{workflows.test,turbo-inputs.test,cli-args.test}.ts`, `packages/ship/src/{ports/ports-for,remote/test-remote}.ts` (comments);
  - the workspace walkers that list `examples` as a group: `tooling/release/src/publishable-packages.ts` (+ `release-list.test.ts`), `tooling/release/turbo.json`, `tooling/versions/turbo.json`, `tooling/versions/src/versions.test.ts`;
  - `examples/README.md`, `examples/demo-host/{ports,preview-headers}.ts` and `examples/physics/bodies-2d/art/PROVENANCE.md` (path mentions);
  - live instructions in `docs/` (historical execution records stay as written).
  - Unchanged: package names, the demos' `@af-examples/base-2d` imports (resolved by name), `build:demos` (`./examples/*/*`).

### Steps
- [x] **1. Pin the paths.** In `packages/ship/src/workflows.test.ts` and `turbo-inputs.test.ts`, expect `games/emberwick` and `games/placeholder` (and `games/*` in `pnpm-workspace.yaml`); in `tooling/release/src/release-list.test.ts`, expect the workspace walk to find `games/emberwick` and `games/placeholder`. Confirm the tests fail (folders missing, paths still `examples/…`).
- [x] **2. Move and update.**
  - `git mv` both folders.
  - Update `ci.yml` (`working-directory`), `playwright.config.ts`, the root `package.json` scripts, `packages/ship` ports, `test-remote` and `turbo.json`, `tooling/check-boundaries` and `tooling/release` tests, and the demo imports of `@af-examples/base-2d` (the package names are unchanged).
  - Confirm step 1's tests pass.
- [x] **3. Prove nothing changed.**
  - `pnpm check`;
  - `pnpm test:parity` (Emberwick's golden `31f50888ccb4cf0a` unchanged);
  - `pnpm test:e2e` (the base-2d and placeholder journeys);
  - `prepare-ruken` for both.

  Record the results in 02.

## Task EX.3: target examples, written first (EX-D2)

### Files
**Create:**
- `examples/core/core-basic-window.ts`
- `examples/core/core-input-keys.ts`
- `examples/shapes/shapes-rects.ts`
- `examples/textures/textures-sprite.ts`
- `examples/resources/sprites/` (Endesga 64, with `PROVENANCE.md`)

### Steps
- [ ] **1.** Write each file against the API in the DX spec §3.1 and §3.4, with `Pending: DX.2` or `Pending: DX.2b`. The catalog passes; they show as pending in smoke and parity.
- [ ] **2.** Remove `Pending:` from one example, and confirm typecheck fails naming the missing verb (for example `defineGame`). Then restore the line. This is the recorded red state that DX.2 must turn green.
- [ ] **3.** In the DX.2 and DX.2b PRs, not here: remove `Pending:`, record each `Golden:` replay, and get smoke and parity green. This plan's step is ticked when they merge.

## Task EX.4: port the existing demos (after DX.2 and DX.2b)

Do the same three steps for each row of spec §6, one PR per demo, owned by its lane.
- [ ] **runtime/boot-and-flow**
- [ ] **render-pixi/renderer-2d**
- [ ] **host/lifecycle-and-saves**
- [ ] **content/hot-reload**
- [ ] **ui/primitives**
- [ ] **physics/bodies-2d** (into `automata-plus` with PRODUCT.5)

Per demo:
1. **Move the behavior tests.** Write the listed behavior tests in the owning package. They must pass there; where a test passes on its first run, note it as a regression pin.
2. **Add the one-file example.** Write it within the 100-line budget. Smoke must be green; if the old demo had a golden, the hash must be identical (`ad621eea6325a8db` for bodies, from `examples/physics/bodies-2d/golden.ts`).
3. **Delete the old demo.** `git rm` the folder, then run `pnpm check`, `pnpm test:parity` and `pnpm test:e2e`.

## Task EX.5: index page

- [ ] **1.** Write a Playwright test: the index lists every catalog entry under its module, shows the source beside the running frame, and lists pending examples as pending. Confirm it fails.
- [ ] **2.** Implement the index in `tooling/examples-runner`, then confirm the test passes at Pixel 7 and 780×270. Screenshots go to `evidence/` for Owner approval and are never auto-promoted.
- [ ] **3.** Delete `examples/gallery`, whose list and header test are replaced by the catalog.

## Execution log

| Date | Task | Commits | Notes |
|---|---|---|---|
| 2026-10-16 | EX.2 | `d81fa9b` (file list), `6d8e5c7` (move) on `claude/clever-pasteur-ujmu6e-ex2` | Red first: ship's workflow and turbo-input tests and release's workspace walk failed on the missing `games/`. Green after the move. `pnpm check` 26/26 + 22/22 turbo tasks (1,660 unit tests passed, 4 skipped; 35 of 48 tasks replayed from turbo's cache on identical inputs); `pnpm test:parity` 9/9 tasks, none cached (590 tests; Emberwick's golden `31f50888ccb4cf0a` green in Chromium, WebKit and Firefox, and its Node golden test 3/3); `pnpm test:e2e` 46/46 (placeholder 3, base-2d 9, base-2d-compact 9, ui-primitives 5, demos 20; ports 4620/4720); `build` + `prepare-ruken` for both games and the placeholder's `budget:size` (S8 budgets met). `pnpm lint:actions` not run: no Docker daemon in the container. |
