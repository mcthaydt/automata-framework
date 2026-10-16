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

### Files
- **Create:**
  - `tooling/examples-runner/` with `package.json`, `src/catalog.ts`, `src/catalog.test.ts`, `src/header.ts`, `src/header.test.ts`, `src/vite-plugin.ts`, `src/vite-plugin.test.ts`, `src/page-template.ts`, `src/parity.ts`, `src/examples.parity.test.ts` and `src/fixtures/`;
  - `host/`, moved from `examples/demo-host/`;
  - `examples/package.json`, `examples/tsconfig.json`, `examples/vite.config.ts`, `examples/e2e/examples.e2e.ts`.
- **Modify:**
  - `tooling/check-boundaries/src/check.ts`, `check.test.ts`, `cli.ts` (`--inline`);
  - `pnpm-workspace.yaml`, the root `package.json` (`examples`, `build:examples`, `boundaries`);
  - `playwright.config.ts` (the `examples` project);
  - `.github/workflows/ci.yml`.

### Interfaces
- **Consumed:** `startGame`/`defineGame` (DX.2, until then a stub fixture), `compileHeaders` (`@ruken/manifest`), `replayGolden` (`@mcthaydt/automata-testing/sim`), the demo-host's `openHosted` and `collectErrors`.
- **Produced:** `readCatalog(root): CatalogEntry[]`, `parseHeader(source): Header | HeaderError[]`, and the `examplesRunner()` Vite plugin.

### Steps
- [ ] **1. Header parser.** Write `header.test.ts`:
  - a fixture with every field parses;
  - a missing `Shows:` gives a `HeaderError` with its line;
  - `Difficulty: ★★★★★` is rejected.

  Run `pnpm --filter @mcthaydt/examples-runner test` and confirm it fails because `parseHeader` does not exist. Implement `header.ts`, then confirm it passes.
- [ ] **2. Catalog rules.** Write `catalog.test.ts` over `src/fixtures/`, where each bad fixture fails for its own reason:
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
- [ ] **1. Pin the paths.** In `packages/ship/src/workflows.test.ts` and `turbo-inputs.test.ts`, expect `games/emberwick` and `games/placeholder` (and `games/*` in `pnpm-workspace.yaml`); in `tooling/release/src/release-list.test.ts`, expect the workspace walk to find `games/emberwick` and `games/placeholder`. Confirm the tests fail (folders missing, paths still `examples/…`).
- [ ] **2. Move and update.**
  - `git mv` both folders.
  - Update `ci.yml` (`working-directory`), `playwright.config.ts`, the root `package.json` scripts, `packages/ship` ports, `test-remote` and `turbo.json`, `tooling/check-boundaries` and `tooling/release` tests, and the demo imports of `@af-examples/base-2d` (the package names are unchanged).
  - Confirm step 1's tests pass.
- [ ] **3. Prove nothing changed.**
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
| — | — | — | — |
