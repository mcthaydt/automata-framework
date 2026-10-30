# DX.6c: the cli's `check:example` names a folder EX.2 moved, TDD plan

- **Spec:** [DX spec](../specs/2026-10-16-dx-small-games-ai-native-design.md) §3.6 (`automata check`); the [DX.6 plan](2026-10-16-automata-check.md) ("Example path in one place: the integration run is the cli's `check:example` script"); EX-D1 in the [EX spec](../specs/2026-10-16-examples-one-file-design.md) (Emberwick moves to `games/emberwick`, package name `@af-examples/base-2d` kept). No spec change.
- **Task:** 02 row DX.6c, lane ship, size S (the "EX.2 path" DX.6 follow-up).
- **Status:** drafted 2026-10-30, based on `main` (`855a0ee`).
- **Progress:** 1 of 5 steps.

## What is wrong

`packages/cli/package.json` has `"check:example": "node src/bin.ts check ../../examples/base-2d --csp"`. EX.2 (`6d8e5c7`) moved that folder to `games/emberwick`, and no script, workflow or test calls `check:example`, so nothing noticed. Run on `main` it exits 2 with 7 of 9 steps unable to run (`no src/sim folder in …/examples/base-2d`).

## References found (`rg 'check:example|examples/base-2d'`, every file but `node_modules`)

| Where | What | Action |
|---|---|---|
| `packages/cli/package.json:38` | the script | point it at `../../games/emberwick` |
| `.github/workflows/**`, root `package.json`, every other `package.json`, every test | no caller of `check:example` | none |
| `README.md:11-12` | "in `examples/base-2d`. EX.2 moves it to `games/emberwick`; when it moves, change this paragraph and the `--filter` line below together" | the paragraph now says `games/emberwick`; the `--filter @af-examples/base-2d` line is right as it is (EX-D1 kept the package name) |
| `docs/art/README.md:16` | "`examples/base-2d` (Emberwick) is the reference" | `games/emberwick` |
| `packages/cli/src/check/no-eval-allowlist.ts:15` | "Measured on the `examples/base-2d` production build at 71c3410" | none: a measurement at a named commit; the next line already says `automata check games/emberwick --csp` passes |
| `tooling/evidence/src/collect.test.ts`, `tooling/evidence/src/fixtures/goldens.report.json` | test names inside a recorded Vitest report | none: fixture data, not paths that must exist |
| `examples/README.md:17` | "moved from `examples/base-2d` by EX.2" | none: true |
| `docs/02-master-delivery-plan.md:67,100`, `docs/01-decomposition.md:93` | the row and its follow-up bullet | none here: the integration owner's files |
| `docs/history/**`, dated specs and plans | records | none |

Every other hit names the package `@af-examples/base-2d`, which is still its name.

## Decisions

- **Point it, do not delete it.** `check:example` is the one command that runs `automata check --csp` end to end on a real game in this repository (the DX.6 plan's integration run, a QB.2 gate), and the no-eval allowlist is re-measured with it whenever Pixi, Zod or koota moves (M3's Pixi 8.22 bump is next). Pointing it costs one path; deleting it would leave the next re-measurement to rebuild the command by hand.
- **One general test, in `tooling/repo-hygiene`.** The bug is a class: a package script that reaches out of its own folder (`../`) breaks without a sound when the folder it names moves. `src/script-paths.test.ts` reads every workspace package's scripts through `workspacePackages` (`tooling/release/src/publishable-packages.ts`, the one reader of the workspace) and fails on each `../` path that resolves to nothing or leaves the repository. Globs are skipped (no script has one; a glob is not a path to check for existence). Today the cli's `check:example` is the only script in the workspace with a `../` path.
- **Turbo inputs.** The test reads every workspace `package.json` and a file in `tooling/release`, both outside the package, so `tooling/repo-hygiene/turbo.json` lists them, as `tooling/consumer-smoke/turbo.json` does for the README check.
- **No changeset.** `cli` and `repo-hygiene` are private.

## Files

- **Create:** `tooling/repo-hygiene/src/script-paths.test.ts`.
- **Modify:** `packages/cli/package.json` (`check:example`), `tooling/repo-hygiene/turbo.json` (inputs), `README.md` (one paragraph), `docs/art/README.md` (one path); this plan.

## Interfaces

None produced. Consumed: `workspacePackages(root)` and `WorkspacePackage` from `tooling/release/src/publishable-packages.ts` (unchanged); `automata check [dir] [--json] [--sim-only] [--csp] [--fail-fast]` (unchanged).

## Steps

- [x] **1. Plan.** This file.
- [ ] **2. Red.** `script-paths.test.ts`: (a) on planted packages, a missing `../` path is named with what it resolves to, one outside the repository is named as such, an existing path (also after `--flag=`) and a glob are not; (b) the workspace has no such path. `pnpm --filter @mcthaydt/repo-hygiene exec vitest run src/script-paths.test.ts`: (a) passes, (b) fails naming `packages/cli check:example: ../../examples/base-2d (examples/base-2d) does not exist`.
- [ ] **3. Green.** `check:example` runs `check ../../games/emberwick --csp`; turbo inputs. The same command passes.
- [ ] **4. Prove it runs.** `pnpm build`, then `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-local pnpm --filter @mcthaydt/automata-cli check:example`: exit 0, every step passes (record each step's time). Fix the two README paths.
- [ ] **5. Gates and hand-off.** `pnpm format`, `TURBO_FORCE=true pnpm check`; draft PR.

## Gates

- Selected: the focused test (red, then green); `pnpm build`; `check:example` on Emberwick (exit 0, `--csp` in Chromium); `pnpm format`, `TURBO_FORCE=true pnpm check`; `pnpm changeset status --since=origin/main` and `node tooling/release/src/check-changesets.ts` (no changeset: both packages are private).
- Omitted: parity (no sim, renderer, `ui` or golden changes); `api-report`, `api-index`, `agent-skills` (no published package's exports or doc comments change); `build:examples`, `build:demos` and e2e (no example or game changes; `check:example` builds Emberwick itself); consumer smoke (no build config change; the README's commands are unchanged and its check runs in `pnpm check` through `tooling/consumer-smoke`'s unit tests).
- Pending: the Mac's CI on the PR.

## Execution log

| Date | Step | Commits | Notes |
|---|---|---|---|
| 2026-10-30 | 1 | | Plan. `pnpm --filter @mcthaydt/automata-cli check:example` on `main` (`855a0ee`): exit 2, "0 findings, 7 steps could not run" (boundaries: `no src/sim folder in …/examples/base-2d`; typecheck, test, boards, no-eval, secrets and csp could not find the folder or its tools). `orientation` and `inputs` report pass on the missing folder (they read only files that exist; follow-up). |
