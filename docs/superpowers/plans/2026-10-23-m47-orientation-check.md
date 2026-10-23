# M4.7 follow-up: the game's orientation against the ship config TDD plan

- **Spec:** [M4 spec](../specs/2026-10-16-m4-input-display-design.md) §4.9 (display policy: orientation) and the [M4.7 plan](2026-10-18-m4-7-display-policy.md) (the follow-up this closes); [M5 spec](../specs/2026-10-16-m5-saves-audio-design.md) §4.8 (the board check this copies: static, over the game's sources); [DX spec](../specs/2026-10-16-dx-small-games-ai-native-design.md) §3.6 (`automata check`).
- **Task:** `Follow-up (found in M4.7) — Game orientation against the ship config` (02). Lanes ship, game.
- **Status:** drafted and implemented 2026-10-23, locally checked, based on `main`. No PR is opened until the shared runner's queue drains.
- **Progress:** 6 of 6 steps.

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

- [x] **1. The reader, red first.** `orientation.test.ts`: a literal `orientation` gives its value and position; an absent one gives `any` at the call; a variable, a non-object argument and a spread give nothing; two calls give two entries; a file that does not parse gives `undefined`; `declaredOrientationIn` reads `runtime: { orientation: 'landscape' }` and gives `undefined` for a variable or no `runtime`. Run `pnpm --filter @mcthaydt/automata-ship test:unit`; the file does not exist.
- [x] **2. The walk, red first.** `findOrientationMismatches` over a temporary game folder: a mismatch is found with its relative path, line and column; a match is not; test files, `node_modules`, `dist` and dot folders are skipped.
- [x] **3. `prepare`, red first.** A game folder whose `defineGame` says `landscape` against a config of `any` fails with `OrientationMismatch` and writes no `ruken.toml`; matching passes; its message names both places. Wire it in after the board check.
- [x] **4. `automata check`, red first.** A step `orientation` after `boards`: a mismatch is one finding at the call site with rule `orientation-mismatch`; a `ship.config.ts` whose `runtime.orientation` is not a literal is a tool error that says so; no `ship.config.ts` or no `defineGame` finds nothing. The step lists in `run-check.test.ts` gain it.
- [x] **5. The real games.** Run the check over every game and example and the `create-game` template; record what it finds and fix any real mismatch.
- [x] **6. Gates and docs.** `pnpm format`, `pnpm check`, `pnpm api-report --update`, `pnpm build && pnpm api-index && pnpm agent-skills`, the changeset check; 02's row; the execution record and 03 with the docs sync PR.

## Gates

- Selected: `pnpm check`; the ship and cli unit tests; `pnpm api-report`; `pnpm build && pnpm api-index && pnpm agent-skills`; the changeset check; the check run by hand over the real games.
- Omitted here, pending on CI: parity and the rest of CI.
- Changesets: patch for `@mcthaydt/automata-ship`. `@mcthaydt/automata-cli` is private and ignored by changesets, and a changeset that names an ignored and a published package together is refused ("mixed changeset"), so the cli step is described in ship's changeset.

## Execution log

| Date | Step | Commits | Notes |
|---|---|---|---|
| 2026-10-23 | Plan | 01df43e | |
| 2026-10-23 | 1–3 reader, walk, `prepare` | (this PR's implementation commit) | Red first: `orientation.test.ts` and the new `prepare-build.test.ts` case failed on the missing module and on a mismatch that passed. The red state cannot be committed alone (pre-commit runs the unit tests), so it is recorded here and committed with the implementation. `source-reader.ts` is new: the helpers `board-names.ts` already had (`sources`, `position`, `keyOf`, `nameOf`, `stringLiteral`, `isGameSource`) moved there so both checks share them; `isBoardSource` keeps its export, with an explicit type for `isolatedDeclarations`. Ship unit tests 276 passed. |
| 2026-10-23 | 4 `automata check` | same | Red first: the step lists in `run-check.test.ts` and the new `orientation` cases failed with no such step (10 failed, 6 passed). A config with no `defineGame` to compare against is not an error even when its orientation is not a literal (a tool error would be noise); with one to compare, it is. The csp, no-eval and secrets steps moved from index 4, 5, 6 to 5, 6, 7 in the tests. Cli unit tests 56 passed. |
| 2026-10-23 | 5 real games | same | `defineGame` calls read: `games/emberwick` 1, `games/placeholder` 0, `examples/` 13; every one plays `any` and so does every config (`games/emberwick`, `games/placeholder`, `tooling/frame-budget`, the four `ship.config.ts` examples and the generated config of the one-file examples). No mismatch to fix. There is no `create-game` template in this checkout (no `packages/create-game`), so none was checked. |
| 2026-10-23 | 6 gates and docs | same | `pnpm format`; `pnpm check` (30 of 30 tasks); `pnpm api-report --update` (ship +5 exports, cli `StepName` +`orientation`; the break report lists `StepName` as changed, private, no changeset needed beyond the patch added); `pnpm build`, `pnpm api-index`, `pnpm cheatsheet` (`docs/cheatsheet.md` regenerated), `pnpm agent-skills --write` (api.md regenerated, and `automata-verify`'s step table and rule table gained `orientation`). Changeset `m4-7-orientation-check.md` (patch, ship only: a changeset naming ignored cli with published ship fails `changeset status` as "mixed"). Not run here: parity and the rest of CI. |
