# M4.1 follow-up: `runtime.inputs` against the game's input map at prepare and in `automata check` TDD plan

- **Spec:** [M4 spec](../specs/2026-10-16-m4-input-display-design.md) §4.13 (I-g: the manifest declares every device the input map binds) and the [M4.1 plan](2026-10-17-m4-1-input-service.md) step 6 (the follow-up this closes); [M5 spec](../specs/2026-10-16-m5-saves-audio-design.md) §4.8 and the [orientation plan](2026-10-23-m47-orientation-check.md) (the static source checks this copies); [DX spec](../specs/2026-10-16-dx-small-games-ai-native-design.md) §3.6 (`automata check`).
- **Task:** `Follow-up (found in M4.1) — runtime.inputs check at prepare and in automata check` (02). Lane ship.
- **Status:** drafted and implemented 2026-10-23, locally checked, stacked on the orientation branch (it shares `source-reader.ts`, `prepare-build.ts` and the `automata check` step list). No PR is opened until the shared runner's queue drains.
- **Progress:** 6 of 6 steps.

## What is missing

`inputsProblems(inputs, bindings)` is the one owner of the rule, and `prepareBuild` runs it when it is given `inputBindings`. The games call it from their own `ship-config.test.ts`, but `automata-ship prepare` and `automata check` cannot load a game's input map under plain Node, so for them `inputBindings` is never given and the rule never runs.

## Decisions

- **Static, like the board and orientation checks.** A game's input map is a `keys(command, bindings, options)` call (`@mcthaydt/automata-game`). The check reads those calls with `oxc-parser` and builds the bindings `inputsProblems` takes from what the call writes; it does not copy the rule. The two facts the rule needs are whether a pad button is bound and whether anything is touchable, and `keys()` decides both from its arguments: each key binding is a touch button unless `options.touch` is `false`, `options.pad` binds pad buttons, `options.gestures` binds touch gestures.
- **What is read.** A call to `keys` imported from a `@mcthaydt/automata*` module (so `Object.keys` and a local `keys` are not it; an alias is followed). Per call: `bindings` as an object literal gives its key count; `options.touch` as `false`; `options.pad` and `options.gestures` as object literals give their entries.
- **Read conservatively: never flag what cannot be proved.** A part that is not written as a literal (a variable, a spread, a call) can only add a device, never remove one: an unreadable `bindings`, `touch` or `gestures` counts as touchable, and an unreadable `pad` binds nothing. So a mismatch the check reports is always real, and one it cannot see is left to the game's own test and types. Test files (`*.test.*`, `*.spec.*`) are skipped.
- **No `keys()` call is not a failure.** A game that builds its input another way has nothing to compare.
- **Compared with.** In `prepare`, the parsed config's `runtime.inputs`, used when the caller gave no `inputBindings` (an explicit one wins: it is the real input map). In `automata check`, the `runtime.inputs` array read from `ship.config.ts` as written; an array that is not all string literals, with a `keys()` call to compare it against, is a tool error that says so, not a pass.
- **A finding names the config.** The problem is the config declaring a device the game does not bind, or missing one it binds, so `automata check` reports an `inputs` step after `orientation` with rule `inputs-mismatch`, at the `inputs` array in `ship.config.ts`, with the message `inputsProblems` gives. `prepare` fails with the existing `ManifestInputsMismatch`.
- **Additive API.** `ship` exports `keysBindingsIn`, `declaredInputsIn`, `findInputsProblems` and the types. `automata check` gains a step, so the run-check step lists in its tests change.
- **The `create-game` template** (the last clause of the 02 row) does not exist yet (DX.5); the row's template half stays with DX.5.

## Files

- **Create:** `packages/ship/src/prepare/input-bindings.ts`, `input-bindings.test.ts`.
- **Modify:** `packages/ship/src/prepare/prepare-build.ts` (+ test), `packages/ship/src/index.ts`; `packages/cli/src/check/check-steps.ts`, `check-report.ts`, `run-check.ts`, `run-check.test.ts`; `tooling/api-report/reports/ship.api.md` and `cli.api.md` (via `pnpm api-report --update`); `agents/automata/skills/automata-verify/SKILL.md`; the generated `docs/cheatsheet.md` and `agents/automata/skills/automata-api/reference/api.md`; a changeset (patch, ship); this plan; `docs/02-master-delivery-plan.md` (the follow-up row).
- **Check the real games:** `games/emberwick`, `games/placeholder`, `tooling/frame-budget`, the four example `ship.config.ts` folders must pass the new check, or the disagreement they reveal is fixed in the game (a real finding), not hidden.

## Interfaces

- **Consumed:** `oxc-parser`, `source-reader.ts`, `inputsProblems` and `ShipInputBindings` (the rule's owner), `ShipConfig.runtime.inputs`, `Files` (cli).
- **Produced:** the functions above; the `inputs` check step.

## Steps

- [x] **1. The reader, red first.** `input-bindings.test.ts`: a call with key bindings gives a touchable keys entry; `touch: false` removes it; `pad` entries give a pad entry; `gestures` entries give a gesture entry; an unreadable `bindings`, `touch` or `gestures` gives a touchable entry and an unreadable `pad` gives none; `Object.keys(…)`, a local `keys` and a `keys` imported from elsewhere are not read; an aliased import is; a file that does not parse gives `undefined`; `declaredInputsIn` reads `runtime: { inputs: [...] }` with its position and gives `undefined` for a variable, a non-literal element or no `runtime`. Run `pnpm --filter @mcthaydt/automata-ship test:unit`; the file does not exist.
- [x] **2. The walk, red first.** `findInputsProblems` over a temporary game folder: a pad binding with no `gamepad`, and `touch` with nothing touchable, are found with `inputsProblems`' own messages; agreement passes; a folder with no `keys()` call finds nothing; test files, `node_modules`, `dist` and dot folders are skipped.
- [x] **3. `prepare`, red first.** A game folder whose `keys()` binds a pad against `inputs: ['touch', 'keyboard']` fails with `ManifestInputsMismatch` and writes no `ruken.toml`; matching passes; an explicit `inputBindings` wins over the sources. Wire it in where the explicit check is.
- [x] **4. `automata check`, red first.** A step `inputs` after `orientation`: a mismatch is one finding at the `inputs` array with rule `inputs-mismatch`; a `ship.config.ts` whose `inputs` is not all literals, with a `keys()` call, is a tool error that says so; no `ship.config.ts` or no `keys()` call finds nothing. The step lists in `run-check.test.ts` gain it.
- [x] **5. The real games.** Run the check over every game and the example folders; record what it finds and fix any real disagreement.
- [x] **6. Gates and docs.** `pnpm format`, `pnpm check`, `pnpm api-report --update`, `pnpm build && pnpm api-index && pnpm cheatsheet && pnpm agent-skills --write`, the changeset check (`pnpm changeset status --since=origin/main` after committing); 02's row; the execution record and 03 with the docs sync PR.

## Gates

- Selected: `pnpm check`; the ship and cli unit tests; `pnpm api-report`; `pnpm build && pnpm api-index && pnpm agent-skills`; the changeset check; the check run by hand over the real games.
- Omitted here, pending on CI: parity and the rest of CI.
- Changesets: patch for `@mcthaydt/automata-ship` only (`@mcthaydt/automata-cli` is private and ignored by changesets, and a changeset naming an ignored and a published package together is refused).

## Execution log

| Date | Step | Commits | Notes |
|---|---|---|---|
| 2026-10-23 | Plan | 48f1397 | |
| 2026-10-23 | 1–2 reader, walk | (this PR's implementation commit) | Red first: `input-bindings.test.ts` failed on the missing module. One assertion in my own test was wrong (it compared the problems with only the pad entry, so `inputsProblems` also reported touch); fixed to pass the keys entry too. `source-reader.ts` gained `isShippedSource` (the non-test source predicate), which `isOrientationSource` now aliases. |
| 2026-10-23 | 3 `prepare` | same | Red first: the pad-binding case passed `prepare` because nothing read the sources (1 failed, 14 passed). Ship unit tests 294 passed. |
| 2026-10-23 | 4 `automata check` | same | Red first: 10 of the run-check tests failed with no `inputs` step. The csp, no-eval and secrets steps moved from index 5, 6, 7 to 6, 7, 8 in the tests. Cli unit tests 61 passed. |
| 2026-10-23 | 5 real games | same | `games/emberwick` reads as one `keys()` call at `src/game.ts:15:22` binding touch only, against `['touch', 'keyboard']`; `games/placeholder`, `tooling/frame-budget` and the four example `ship.config.ts` folders declare the same and read no disagreement. The core examples' `keys()` calls read correctly too (`core-input-keys` and `core-input-gamepad` bind pad 12 to 15 and touch, `core-input-touch` binds three gestures with `touch: false`); their config is generated, not shipped, so the step does not run on them. No `create-game` template exists yet (DX.5), so the template half of the 02 row stays open. |
| 2026-10-23 | 6 gates and docs | same | `pnpm format`; `pnpm check` (30 of 30 tasks); `pnpm api-report --update` (ship +5 exports, cli `StepName` +`inputs`; the break report lists `StepName` as changed, private, no changeset needed); `pnpm build`, `pnpm api-index`, `pnpm cheatsheet`, `pnpm agent-skills --write` (api.md and `automata-verify` gained `inputs`). Changeset `m4-1-inputs-check.md` (patch, ship only). `changeset status` and `check-changesets` run after the commit. Not run here: parity and the rest of CI. |
