# EX: one-file examples TDD plan

- **Spec:** [`docs/superpowers/specs/2026-10-16-examples-one-file-design.md`](../specs/2026-10-16-examples-one-file-design.md)
- **Status:** drafted 2026-10-16. **Pending EX.0 review.** Do not start before the Owner reviews the spec (AGENTS.md: a draft spec does not authorize implementation).
- **Progress:** EX.2 and EX.1 implemented and locally verified (draft PRs, Owner review pending); EX.3–EX.5 open.

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
- **Catalog scope:** the catalog skips folders that hold a `package.json` (the old demos and the gallery, until EX.4/EX.5), `node_modules`, `dist`, `e2e`, `resources` and `__goldens__`, and the root `vite.config.ts`. Screenshot approval is recorded in `examples/screenshots-approved.json` (`"<module>/<module>-<name>.png": "<approval record>"`), written only from an Owner decision.
- **Smoke projects:** `examples` and `examples-compact` also run the runner's own fixture smoke (`tooling/examples-runner/e2e/runner.e2e.ts`), so the path is proven while `examples/` has no runnable example; each suite also checks the index lists every catalog entry. Ports: examples build at `demoPort(6)`, runner fixtures at `demoPort(7)` (`host/ports.ts`).
- **Parity in a browser:** the parity test reads headers and loads examples through `import.meta.glob` (no file system in a browser), and its Vitest config turns dependency discovery off, since the scan would follow the glob into a pending example's unresolved imports and reload the page mid-run.
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
- [x] **3. `--inline` boundaries.** In `tooling/check-boundaries/src/check.test.ts`:
  - `Date.now()` in a `defineSystem` callback fails with rule and line (spec E-g);
  - `Math.random()` in `definePlugin` `setup` fails;
  - `document` at file level passes in inline mode;
  - a clean system body passes.

  Confirm they fail on the missing mode. Implement it by reusing the existing visitor scoped to those function bodies, then confirm they pass. Add `--inline examples` to the root `boundaries` script.
- [x] **4. Vite plugin.** Write `vite-plugin.test.ts`:
  - `/core/core-stub/` returns the generated HTML with the `no-eval` import first and the example's module;
  - preview responses carry `compileHeaders`' CSP.

  Confirm it fails, implement `vite-plugin.ts` and `page-template.ts`, confirm it passes.
- [x] **5. Single examples package.**
  - Create `examples/package.json` (`@af-examples/examples`), `tsconfig.json` and `vite.config.ts`.
  - Move `examples/demo-host` to `tooling/examples-runner/host` with `git mv`, and update its importers.
  - Update `pnpm-workspace.yaml`.

  Verify that `pnpm install`, `pnpm typecheck` and `pnpm examples` serve the index with a stub example.
- [x] **6. Smoke project.** Write `examples/e2e/examples.e2e.ts`, which loops over `readCatalog()`. For each non-pending entry it opens the example hosted, waits for ready, and asserts no errors. Pending entries are reported with `test.skip(true, 'pending: <task>')`.
  - Confirm it fails with no server.
  - Add the `examples` project (Pixel 7 and 780×270) and its `webServer` to `playwright.config.ts`.
  - Confirm it passes on the stub.
- [x] **7. Parity.** Write `examples.parity.test.ts`. For each `Golden:` entry it runs `replayGolden` against `examples/__goldens__/<name>.replay` in Node and the browsers project.
  - Confirm it fails on a stub with no replay.
  - Record the stub's replay once, in Node.
  - Confirm it passes in Node, Chromium, WebKit and Firefox.
- [x] **8. CI.**
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

### Files (refined at `1206310`, stacked on EX.1)
- **Create:**
  - `examples/core/core-basic-window.ts` (40 lines or fewer, DX.2's row in 02)
  - `examples/core/core-input-keys.ts`
  - `examples/shapes/shapes-rects.ts`
  - `examples/textures/textures-sprite.ts`
  - `examples/resources/sprites/wick-run.png` and `PROVENANCE.md` (Emberwick's two run frames of Wick, Endesga 64 only, as a 32 × 16 sheet)
- **Modify** in `tooling/examples-runner/`:
  - `src/catalog.ts` + `catalog.test.ts`, fixtures `src/fixtures/catalog/core/core-{both,both-done,schema,future,future-ready}.ts` and `delivery-plan.md` (`OPEN.2`);
  - `src/parity.ts`, `src/examples.parity.test.ts` and the pending fixture `src/fixtures/examples/core/core-later.ts` (`Golden:`).

### Interfaces
- **Consumed (target API, not in this tree yet):** `defineGame` and `keys` from `@mcthaydt/automata-game` (DX.2, DX spec §3.1, §3.3); `rect({ w, h, color, anchor? })` and `sprite(url, { frames: { width, height } })` from `@mcthaydt/automata-render-pixi` (DX.2b, PR #39, exact names); `defineSystem(name, run)` and `definePlugin({ name, defs })` from `@mcthaydt/automata-sim` (DX.1, which DX.2 depends on); `z` from `zod` for command schemas.
- **Produced:** the four examples; a `Pending:` line that may name several open tasks (`Pending: DX.2, DX.2b`); `GoldenEntry.pending`, so parity reports a pending golden example as skipped.

### Deviations recorded here
- **`Pending:` takes a list.** An example that needs `defineGame` (DX.2) and `rect` or `sprite` (DX.2b) names both. DX.2b can land first (it is parallel to DX.1, which DX.2 waits for); with one ID it would either be unblocked too early or not name DX.2b at all. Each ID must be an open task; when one is ticked the catalog asks to remove that ID. The smoke and parity skip reasons print the list.
- **`zod` is a public import.** Commands take a Zod schema (`defineCommand(id, z.object(…))`; Zod is AF's only schema language), and no core package re-exports `z`. Once the umbrella exists (PRODUCT.2), EX.6 decides whether it re-exports `z`.
- **A pending example may import a package that does not exist yet.** `@mcthaydt/automata-game` is DX.2's new package. The catalog accepts an `@mcthaydt/automata-*` import of a package missing from `packages/` only while the example is pending; a non-pending one still fails, and a package that exists must still declare the entry.
- **Imports are the per-package entries** (EX.1's deviation), not the umbrella the spec's sketch uses: `@mcthaydt/automata-game`, `-render-pixi` and `-sim`. EX.6 narrows them to `@mcthaydt/automata` with PRODUCT.2.
- **Spec sketch verbs not adopted:** the EX spec §3 sketch writes `u.f32`, `commands(Move)` and a plugin `setup`, which no task defines. The examples use the sim's field types (`'f32'`), `ctx.commands.of(Move)` and `GameSpec.sim.setup` (DX spec §3.1).

### Steps
- [x] **1. Catalog: a list of pending tasks.** In `catalog.test.ts`, `core/core-both.ts` (`Pending: OPEN.1, OPEN.2`) is accepted; `core/core-both-done.ts` (`Pending: OPEN.1, DONE.1`) fails with `Pending: DONE.1 is ticked in the delivery plan; remove it from the Pending line`. Confirm they fail (`OPEN.1, OPEN.2 is not a task`), implement, confirm green.
- [x] **2. Catalog: imports a pending example may use.** `core/core-schema.ts` imports `zod` and is accepted; `core/core-future.ts` (pending) imports `@mcthaydt/automata-future` and is accepted; `core/core-future-ready.ts` (not pending) importing it fails with `is not a public entry`. Confirm the first two fail (`not a public entry`), implement, confirm green.
- [ ] **3. Parity lists pending examples.** In `examples.parity.test.ts`, the fixtures' golden entries are `core-stub` and `core-later` (pending `OPEN.1`, given `Golden: 60`), and a pending entry's test is skipped with `pending: <tasks>`. Confirm it fails (`core-later` missing), implement, confirm green in Node.
- [ ] **4. The four examples.** Write each against the API above, with `Pending: DX.2` (`core-basic-window`) or `Pending: DX.2, DX.2b` (the three that draw). `catalog.test.ts`'s real-examples test passes; `pnpm --filter @af-examples/examples typecheck` lists them as pending; smoke and parity skip them as pending; `pnpm boundaries` passes on their systems.
- [ ] **5. The recorded red.** Remove `Pending:` from `core-basic-window` and from `shapes-rects`, run the catalog test and the examples typecheck, and record the failures (the missing `@mcthaydt/automata-game` package and the missing `rect` export). Restore the lines. This is the red state DX.2 and DX.2b must turn green.
- [ ] **6.** In the DX.2 and DX.2b PRs, not here: remove each landed task from `Pending:`, add the examples' dependencies (`@mcthaydt/automata-game`, `@mcthaydt/automata-sim`, `zod`) to `examples/package.json`, record each `Golden:` replay, and get smoke and parity green. This step is ticked when they merge.

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
| 2026-10-16 | EX.1 | `cd54e67` (file list), `c32b1cc` (header, catalog), `d4254cf` (`--inline`), `363f787` (plugin, pages, host move), `7c7906e` (examples package), `d37ce3a` (smoke), `533b481` (parity), `d8c8d5a` (CI) on `claude/clever-pasteur-ujmu6e-ex1`, stacked on EX.2 | Red first at each step: `parseHeader`/`readCatalog`/`typecheckConfig`/plugin modules missing; inline tests reported the file-level import and walked `node_modules`; smoke `ERR_CONNECTION_REFUSED` before its servers; parity `core-stub.replay is missing`; ship's workflow test missing `pnpm build:examples` in `ci.yml`. Stub replay recorded once in Node (`AUTOMATA_UPDATE_GOLDENS=1`). Gates in 02's execution record. `pnpm lint:actions` not run: no Docker daemon. |
