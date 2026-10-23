# M4.7 follow-up: the game's orientation against the ship config TDD plan

- **Spec:** [M4 spec](../specs/2026-10-16-m4-input-display-design.md) §4.9 (display policy: orientation) and the [M4.7 plan](2026-10-18-m4-7-display-policy.md) (the follow-up this closes); [M5 spec](../specs/2026-10-16-m5-saves-audio-design.md) §4.8 (the board check this copies: static, over the game's sources); [DX spec](../specs/2026-10-16-dx-small-games-ai-native-design.md) §3.6 (`automata check`).
- **Task:** `Follow-up (found in M4.7) — Game orientation against the ship config` (02). Lanes ship, game.
- **Status:** drafted 2026-10-23, based on `main`. No PR is opened until the shared runner's queue drains.
- **Progress:** 0 of 6 steps.

## What is missing

`GameSpec.orientation` drives the rotate hint (default `any`) and the ship config's `runtime.orientation` goes to Ruken, which rotates the host's frame by it. A game that says `landscape` in code and `any` in its config shows a rotate hint on a host that never rotates, or the reverse. Today the game names its orientation in both places and nothing checks that they agree.

## Decisions

- **Static, like the board check.** `automata check` and `prepare` cannot load a game under plain Node (the M4.1 follow-up's finding), so this reads sources as the board check does (M5.7): `oxc-parser` over the game's `.ts`, `.tsx`, `.mts`, `.js` and `.mjs` files. Only a string literal is checked; `orientation: someVariable` or `defineGame(spec)` is left to the game's types.
- **What is read.** Each `defineGame({ … })` call whose argument is an object literal gives one orientation: the literal of its `orientation` property, or `any` when the property is absent (`GameSpec`'s default, `spec.orientation ?? 'any'`). A call whose `orientation` is not a literal, or whose argument is not an object literal, gives nothing. Test files (`*.test.*`, `*.spec.*`) are skipped: a fixture game in a test is not the shipped game.
- **What it is compared with.** In `prepare`, the parsed config's `runtime.orientation`. In `automata check`, the `runtime.orientation` literal read from `ship.config.ts` as written (the board check reads `leaderboards` the same way); a config the check cannot read as a literal is a tool error that says so, not a pass.
- **A mismatch names both places.** `src/game.ts:12:3: defineGame plays "landscape" but ship.config.ts runtime.orientation is "any"`. `prepare` fails with a new tagged error `OrientationMismatch` (nothing is written, as with the other prepare checks); `automata check` reports an `orientation` step with rule `orientation-mismatch`.
- **No `defineGame` is not a failure.** A game that does not use `defineGame` (a custom page) has nothing to compare.
- **Additive API.** `ship` exports `gameOrientationsIn`, `declaredOrientationIn`, `findOrientationMismatches`, `isOrientationSource` and the types, as it exports the board helpers. `automata check` gains a step, so the run-check step lists in its tests change.

## Files

- **Create:** `packages/ship/src/prepare/orientation.ts`, `orientation.test.ts`.
- **Modify:** `packages/ship/src/errors.ts` (+ `errors.test.ts`), `packages/ship/src/prepare/prepare-build.ts` (+ test), `packages/ship/src/index.ts`; `packages/cli/src/check/check-steps.ts`, `run-check.ts`, `run-check.test.ts`; `tooling/api-report/reports/ship.api.md` (via `pnpm api-report --update`); the cli and ship docs that list the check steps if any; changesets (patch, ship and cli); this plan; `docs/02-master-delivery-plan.md` (the follow-up row).
- **Check the real games:** `games/emberwick`, `games/placeholder`, every `examples/` entry and `create-game`'s template must pass the new check, or the mismatch they reveal is fixed in the game (a real finding), not hidden.

## Interfaces

- **Consumed:** `oxc-parser` (already a ship dependency), `ShipConfig.runtime.orientation`, `Files` (cli).
- **Produced:** the functions above, `OrientationMismatch` (tag `OrientationMismatch`, `found`), the `orientation` check step.

## Steps

- [ ] **1. The reader, red first.** `orientation.test.ts`: a literal `orientation` gives its value and position; an absent one gives `any` at the call; a variable, a non-object argument and a spread give nothing; two calls give two entries; a file that does not parse gives `undefined`; `declaredOrientationIn` reads `runtime: { orientation: 'landscape' }` and gives `undefined` for a variable or no `runtime`. Run `pnpm --filter @mcthaydt/automata-ship test:unit`; the file does not exist.
- [ ] **2. The walk, red first.** `findOrientationMismatches` over a temporary game folder: a mismatch is found with its relative path, line and column; a match is not; test files, `node_modules`, `dist` and dot folders are skipped.
- [ ] **3. `prepare`, red first.** A game folder whose `defineGame` says `landscape` against a config of `any` fails with `OrientationMismatch` and writes no `ruken.toml`; matching passes; its message names both places. Wire it in after the board check.
- [ ] **4. `automata check`, red first.** A step `orientation` after `boards`: a mismatch is one finding at the call site with rule `orientation-mismatch`; a `ship.config.ts` whose `runtime.orientation` is not a literal is a tool error that says so; no `ship.config.ts` or no `defineGame` finds nothing. The step lists in `run-check.test.ts` gain it.
- [ ] **5. The real games.** Run the check over every game and example and the `create-game` template; record what it finds and fix any real mismatch.
- [ ] **6. Gates and docs.** `pnpm format`, `pnpm check`, `pnpm api-report --update`, `pnpm build && pnpm api-index && pnpm agent-skills`, the changeset check; 02's row; the execution record and 03 with the docs sync PR.

## Gates

- Selected: `pnpm check`; the ship and cli unit tests; `pnpm api-report`; `pnpm build && pnpm api-index && pnpm agent-skills`; the changeset check; the check run by hand over the real games.
- Omitted here, pending on CI: parity and the rest of CI.
- Changesets: patch for `@mcthaydt/automata-ship` and `@mcthaydt/automata-cli` (the fixed group moves together).

## Execution log

| Date | Step | Commits | Notes |
|---|---|---|---|
| 2026-10-23 | Plan | | |
