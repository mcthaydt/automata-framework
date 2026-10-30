# PRODUCT.5f: physics arrives in Plus

- **Plan:** the framework's `docs/superpowers/plans/2026-10-23-product5-plus-repo-and-physics-move.md`, section 5f.
- **Branch:** `claude/plus-PRODUCT.5f-physics`, stacked on PRODUCT.5e (`claude/plus-5e-workspace`, PR #1) until that
  merges.
- **Source:** the framework at `6aee63b` (`main`); `packages/physics/EXTRACTED.md` records the commit, what changed
  and the golden hashes.
- **Status:** implemented and checked locally, three-engine parity included. The Plus CI run on the Mac is pending.

## Steps (the plan's 5f list)

- [x] 1. Copy; red on the install; fix the manifest and config.
- [x] 2. Node unit tests and typecheck local; boundaries run.
- [x] 3. Three-engine parity: run in this container (Chromium headless shell, WebKit and Firefox from Playwright
  1.63.0). Plus CI runs `pnpm check`, which has no browser project; a parity job in Plus CI is a workflow change and
  waits for the Owner's words.
- [x] 4. `EXTRACTED.md`; PR.

## Red first

- With the framework's manifest copied as it was, `tooling/core/manifest-rules.test.ts` ("the Plus workspace has no
  manifest problem") failed on two problems: `"license" must be "SEE LICENSE IN LICENSE" (P5-D5); found
  "UNLICENSED"` and `@mcthaydt/automata-sim is core; list it under peerDependencies`.
- `tooling/ci/workspace-scripts.test.ts` (new) failed 3 of 4 before the root scripts changed: no `boundaries` script,
  and `check`, `typecheck` and `test` did not reach the packages.
- A planted `Date.now()` in `packages/physics/src/kinds.ts` made `pnpm boundaries` report 1 finding and exit 1;
  removing it gave 0 findings.

## What was built

| Path | What |
|---|---|
| `packages/physics/**` | The package, as `EXTRACTED.md` says |
| `package.json` | `boundaries` (`automata-check-boundaries packages/physics/src`), `test:parity`; `typecheck` and `test` also run each package's `typecheck` and `test:unit`; `check` adds `pnpm boundaries`; `@mcthaydt/automata-check-boundaries` 0.0.3 as a devDependency (from the core pack) |
| `tooling/ci/workspace-scripts.test.ts` | Every package with `automata.simEntries` has its `src` on the boundaries run; the shape of `check`, `typecheck`, `test` and `test:parity` |
| `pnpm-workspace.yaml` | `pnpm core:sync` dropped the physics override: Plus has the package itself |

## Evidence (2026-10-30, this container: Linux, 4 CPUs, Node 24.21.0, pnpm 10.34.6)

| Gate | Result |
|---|---|
| `pnpm core:sync` at `b7ef19d` | 10 packs written, 26.0 s; the overrides block no longer names physics |
| `packages/physics` `test:unit` (Node) | 13 files, 71 tests passed: the framework's counts |
| `packages/physics` `test:parity` | 6 files (2 × Chromium, WebKit, Firefox), 6 tests passed; the four golden constants unchanged |
| `pnpm typecheck` | root and `packages/physics` exit 0 |
| `pnpm boundaries` | 19 files, 0 findings |
| `pnpm lint` | 0 errors |
| Root `vitest run` | 7 files, 139 tests passed |
| Byte comparison | every file under `src/` and `tsconfig.json` equals the framework's at `6aee63b` |

Pending: the Plus CI run on the Mac (`pnpm check`).
