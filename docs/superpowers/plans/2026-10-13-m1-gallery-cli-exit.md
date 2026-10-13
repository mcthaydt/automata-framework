# M1.8 Gallery Completion, Minimal `create-game` CLI & M1 Exit TDD Plan

- **Spec:** [`docs/superpowers/specs/2026-10-13-m1-gallery-cli-exit-design.md`](../specs/2026-10-13-m1-gallery-cli-exit-design.md)
- **Status:** Drafted 2026-10-13
- **Branch:** `claude/project-thread-pwjmcz`

---

## Global Constraints

- **Strict TDD:** Every feature and fix is written RED first, then made GREEN with minimal code.
- **Ruken CSP Compliance:** Zero `eval` or `new Function` at runtime.
- **Exact Version Pins:** No carets (`^`) in `package.json` dependencies or devDependencies.
- **Code Standards:** Biome formatting, strict TypeScript, kebab-case files with role suffixes.
- **Gates:** `pnpm check`, `pnpm test:parity` in 3 browsers, Playwright E2E journeys.

---

## Tasks

### Task 1: Gallery Completion & Demo Header Normalization

**Files:**
- Modify: `examples/runtime/boot-and-flow/main.ts`
- Create / Move: `examples/render-pixi/renderer-2d/main.ts`
- Modify: `examples/render-pixi/renderer-2d/index.html`
- Modify: `examples/gallery/src/demos.ts`
- Modify: `examples/README.md`
- Test: `examples/gallery/src/gallery.test.ts`

**Interfaces:**
- Consumes: `examples/gallery/src/demos.ts`, `examples/README.md`
- Produces: 100% passing `examples/gallery/src/gallery.test.ts` covering all feature demos.

- [ ] **Step 1: Write failing test / verify failure**
  Run: `pnpm --filter @af-examples/gallery test:unit`
  Expected: FAIL on missing entries in `DEMOS` (`runtime/boot-and-flow` and `render-pixi/renderer-2d`).

- [ ] **Step 2: Add raylib-style header to `runtime/boot-and-flow/main.ts`**
  Add comments with `Shows:`, `Controls:`, `Base:`, `Packages:`.

- [ ] **Step 3: Setup `render-pixi/renderer-2d/main.ts` with header**
  Create root `main.ts` in `examples/render-pixi/renderer-2d/` containing the canonical header and booting the demo, and update `index.html` to reference `./main.ts`.

- [ ] **Step 4: Update `examples/gallery/src/demos.ts` and `examples/README.md`**
  Add `runtime/boot-and-flow` and `render-pixi/renderer-2d` rows.

- [ ] **Step 5: Run gallery test to verify it passes**
  Run: `pnpm --filter @af-examples/gallery test:unit`
  Expected: PASS (all 3 tests green).

- [ ] **Step 6: Commit**
  ```bash
  git add examples/
  git commit -m "feat(gallery): index runtime and render-pixi demos with canonical headers"
  ```

---

### Task 2: `@mcthaydt/automata-cli` Package Scaffolding

**Files:**
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/tsdown.config.ts`
- Create: `packages/cli/src/index.ts`
- Create: `packages/cli/src/index.test.ts`
- Modify: `pnpm-lock.yaml`, root `package.json`

**Interfaces:**
- Consumes: `@mcthaydt/automata-node`, `@mcthaydt/automata-ship`, `effect`, `zod`
- Produces: Package `@mcthaydt/automata-cli` with ESM build.

- [ ] **Step 1: Write failing test verifying package exports**
  Create `packages/cli/src/index.test.ts` expecting `createGame` export.
  Run: `pnpm --filter @mcthaydt/automata-cli test`
  Expected: FAIL on missing package/module.

- [ ] **Step 2: Implement package skeleton and build configuration**
  Create `package.json`, `tsconfig.json`, `tsdown.config.ts`, and stub `src/index.ts`.
  Run: `pnpm install`

- [ ] **Step 3: Verify tests and build pass**
  Run: `pnpm --filter @mcthaydt/automata-cli test && pnpm --filter @mcthaydt/automata-cli build`
  Expected: PASS.

- [ ] **Step 4: Commit**
  ```bash
  git add packages/cli/ pnpm-lock.yaml package.json
  git commit -m "feat(cli): scaffold automata-cli package and build"
  ```

---

### Task 3: `createGame` Core Scaffolding Logic & Unit Tests

**Files:**
- Create: `packages/cli/src/create-game.ts`
- Create: `packages/cli/src/create-game.test.ts`
- Modify: `packages/cli/src/index.ts`

**Interfaces:**
- Consumes: `CreateGameOptions`, Effect runtime
- Produces: `createGame(options): Effect.Effect<CreateGameResult, CreateGameError>`

- [ ] **Step 1: Write failing unit test for `createGame`**
  Test ID validation (rejects invalid chars like spaces or uppercase), collision detection (fails if target dir has files), and file creation.
  Run: `pnpm --filter @mcthaydt/automata-cli test src/create-game.test.ts`
  Expected: FAIL (module/function not implemented).

- [ ] **Step 2: Implement `createGame`**
  Implement template substitution and atomic directory creation for:
  - `package.json`
  - `ship.config.ts`
  - `vite.config.ts`
  - `tsconfig.json`
  - `index.html`
  - `style.css`
  - `src/main.ts`, `src/game.ts`, `src/boot.ts`, `src/sim/...`

- [ ] **Step 3: Run unit tests to verify they pass**
  Run: `pnpm --filter @mcthaydt/automata-cli test src/create-game.test.ts`
  Expected: PASS.

- [ ] **Step 4: Commit**
  ```bash
  git add packages/cli/src/
  git commit -m "feat(cli): implement createGame scaffolding generator"
  ```

---

### Task 4: CLI Binary Entry Point

**Files:**
- Create: `packages/cli/src/bin.ts`
- Create: `packages/cli/bin/create-game.js`
- Test: `packages/cli/src/bin.test.ts`
- Modify: `packages/cli/package.json`

**Interfaces:**
- Consumes: `process.argv`
- Produces: Executable binary `automata create-game` and `create-game`

- [ ] **Step 1: Write failing CLI command test**
  Test CLI argument parsing and error exit codes.
  Run: `pnpm --filter @mcthaydt/automata-cli test src/bin.test.ts`
  Expected: FAIL.

- [ ] **Step 2: Implement binary entry point**
  Implement argument parsing (`target-dir`, `--id`, `--title`), execute `createGame`, and handle errors. Add `"bin"` to `package.json`.

- [ ] **Step 3: Run tests to verify they pass**
  Run: `pnpm --filter @mcthaydt/automata-cli test src/bin.test.ts`
  Expected: PASS.

- [ ] **Step 4: Commit**
  ```bash
  git add packages/cli/
  git commit -m "feat(cli): add create-game binary executable"
  ```

---

### Task 5: Integration Test of Scaffolded Project

**Files:**
- Create: `packages/cli/src/create-game.integration.test.ts`

**Interfaces:**
- Consumes: Scaffolder, `automata-ship prepare`, `tsc`
- Produces: End-to-end proof that a scaffolded game passes typecheck and produces valid `ruken.toml`.

- [ ] **Step 1: Write integration test**
  Generate a game in a temp directory, assert `ruken.toml` can be prepared, and assert files typecheck cleanly.
  Run: `pnpm --filter @mcthaydt/automata-cli test src/create-game.integration.test.ts`
  Expected: FAIL then PASS.

- [ ] **Step 2: Commit**
  ```bash
  git add packages/cli/src/create-game.integration.test.ts
  git commit -m "test(cli): add integration test verifying scaffolded game produces valid ruken.toml"
  ```

---

### Task 6: Full Verification Gate & M1 Exit Records

**Files:**
- Modify: `docs/02-master-delivery-plan.md`
- Modify: `docs/03-continuation-prompt.md`

**Interfaces:**
- Consumes: Workspace test runners
- Produces: Checked-off M1.8 and M1 milestone exit evidence.

- [ ] **Step 1: Run full workspace verification gate**
  Run: `pnpm check`
  Expected: PASS across all packages, tooling, and examples.

- [ ] **Step 2: Run browser parity suites**
  Run: `pnpm test:parity`
  Expected: PASS across Chromium, WebKit, and Firefox.

- [ ] **Step 3: Update delivery plan and continuation prompt**
  Mark M1.8 complete in `docs/02-master-delivery-plan.md` and record full M1 exit evidence in `docs/03-continuation-prompt.md`.

- [ ] **Step 4: Commit**
  ```bash
  git add docs/02-master-delivery-plan.md docs/03-continuation-prompt.md
  git commit -m "docs: record M1.8 completion and M1 milestone exit evidence"
  ```
