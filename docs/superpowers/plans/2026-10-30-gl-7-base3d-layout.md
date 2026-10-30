# GL.7 (code, first part): base-3d's page entry becomes `src/main.ts`, and its sim stops importing content values (TDD plan)

- **Spec:** [GL spec](../specs/2026-10-30-game-layout-by-role-design.md) §4.5 (the sim set: a sim file imports a value only from another sim file; types from `content/` are free), §4.6 (`main.ts`: define and start; `startGame` only outside Vitest's `test` mode), §6.4 (base-3d), §12 I1.
- **Task:** `GL.7 — base-3d starts in the role layout` (02). Lane **3D**; GL.1 and GL.1b merged. The row places GL.7's code in GAME-3D.1a; this part lands it before M3.7b, so M3.7b writes its page code (`views.ts`, the scene) straight into the role layout instead of moving it later. GAME-3D.1a keeps the rest (the `systems/` folder when the first large system lands, `state/`, `screens/`).
- **Status:** drafted 2026-10-30 on `main` at `37d8b413`. Accepted under the Owner's "Auto accept all spec and plans" (2026-10-30) once reviewed.
- **Progress:** 1 of 5 steps.

## Decisions (open to the Owner's veto)

1. **The sim spec is made from the area.** `state.ts` keeps its plugin and `spawnArea` and replaces the constant `BASE3D_SIM` (built from a value import of `content/first-slice.ts`, which §4.5 forbids) with `base3dSim(area)`, which returns the same `{ plugins, seed, content, setup }` for a compiled area. `src/main.ts` passes `compileArea(FIRST_SLICE)`; the tests do the same. The sim, its plugin order, seed, setup order and content are unchanged, so the golden replay hash is unchanged (§7).
2. **`src/main.ts` is `game.ts` and `main.ts` merged** (§4.6): `no-eval` first, the input map, `export const base3d = defineGame(...)`, then `if (import.meta.env.MODE !== 'test') startGame(base3d)`. Names (`base3d`, `input`) are kept, so the tests change only their import path.
3. **`pnpm boundaries` checks base-3d with `--game`** (root `package.json` and base-3d's own `check` script), so only the sim set is held to the sim rules and `main.ts` may import the game package.

## Files

- **Create** `games/base-3d/src/main.ts` (decision 2).
- **Delete** `games/base-3d/main.ts`, `games/base-3d/game.ts`.
- **Modify** `games/base-3d/src/state.ts` (decision 1); `src/game.test.ts`, `src/game-spec.test.ts`, `src/ship-config.test.ts` (imports); `index.html` (`./src/main.ts`); `tsconfig.json` (`include: ["src/**/*.ts"]`); `package.json` (`check`: `--game src`); root `package.json` (`boundaries`: `--game games/base-3d/src`).

## Steps

- [x] **1. Plan.** This file, committed first.
- [ ] **2. Red.** Root `boundaries` with `--game games/base-3d/src`: `pnpm boundaries` fails with one finding, `src/state.ts` importing the value `./content/first-slice.ts` (seen before this plan: `check-boundaries: 5 files, 1 findings`).
- [ ] **3. Green.** Decision 1; `pnpm boundaries` passes; base-3d's node tests pass with the golden unchanged.
- [ ] **4. The page entry.** Decision 2: `src/main.ts`, the old files deleted, imports, `index.html`, `tsconfig.json`; a `game-spec.test.ts` case that importing `src/main.ts` under Vitest defines the game without starting it (a spy on `startGame` stays uncalled). Run first against a `main.ts` that calls `startGame` unconditionally: fails.
- [ ] **5. Gates.** `pnpm format`; `TURBO_FORCE=true pnpm check` (style's game mode included); `pnpm --filter base-3d test:parity` (the golden in Chromium, WebKit, Firefox); `pnpm --filter base-3d build`; push; draft PR.

## Execution log

| Date | Step | Commit | Evidence |
|---|---|---|---|
| 2026-10-30 | 1 | (this commit) | `automata-check-boundaries --game src` in games/base-3d on `37d8b413`: `src/state.ts:8:1 import of "./content/first-slice.ts" is not allowed in the sim … outside the sim`; `5 files, 1 findings`. |
