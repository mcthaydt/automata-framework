# M2.3 Goldens and replays: TDD plan

> Steps use checkboxes. Tick each one when its check passes and commit the tick with that step's work.

- **Spec:** [m2-goldens-and-replays](../specs/2026-10-11-m2-goldens-and-replays-design.md) ("spec"); milestone: [M2](../specs/2026-10-11-m2-deterministic-core-design.md).
- **Lane:** testing, on its own branch and worktree from `main` after #9 merges. Draft PR titled `M2.3 Goldens and replays`. Merges after M2.2 (milestone spec §5): merge `main` then, re-run every golden and the property test.
- **Progress:** 0 / 13 tasks.
- **Local CI (every task ends green):** Node 24.21.0; `pnpm vitest run <file>` first, then `pnpm --filter <pkg> test`, then `pnpm check`. Parity tasks also run `pnpm --filter <pkg> test:parity` (Chromium, WebKit, Firefox; Playwright 1.63). Before calling the PR green: `pnpm ci:local`.

## Interfaces

- **Consumed:** `createSim`, `Sim`, `Command`, `StepResult`, `PluginDef`, `SnapshotFormatError`, `SnapshotMismatchError`, `SimFaultedError` (`@mcthaydt/automata-sim`, with #9); `decodeSnapshot`, `SnapshotData` (internal, `world/snapshot.ts`); `canonicalJson`, `utf8`, `xxhash64`, `hex64` (`./hash`); `createRng`, `deriveSeed` (`rng/rng.ts`); #9's `src/testing/scene-2d.ts` and `scene-3d.ts` (Task 11); `createBaseSim`, `moveCommand`, `GOLDEN_ROUTE`, `routeInputs`, renderer, input, screens (`@af-examples/base-2d`, Task 13).
- **Produced:** spec §3.1–§3.9.

## Files

| File | Change |
|---|---|
| `packages/sim/src/world/sim.ts`, `world/snapshot.ts` | `describeSnapshot` |
| `packages/sim/src/version.ts`, `version.test.ts` | `SIM_VERSION` equal to `package.json` |
| `packages/sim/src/hash/canonical.ts` | strict UTF-8 decoder beside `utf8` |
| `packages/sim/src/replay/{replay,varint,codec,recorder,stepper,pack,errors,index}.ts` | the format |
| `packages/sim/src/index.ts` | `describeSnapshot` types, `SnapshotView`, `createRng`, `deriveSeed`, `SIM_VERSION` |
| `packages/sim/package.json` | `./replay` export |
| `packages/testing/src/sim/{golden-files,compression,diff,report,sim-golden,replay-golden,property,commands,index}.ts` | the harness |
| `packages/testing/src/sim/fixtures/{bounce.plugin,bounce-diverged.plugin,bounce-script}.ts` | fixtures |
| `packages/testing/package.json`, `vitest.config.ts` | `./sim` export; `@mcthaydt/automata-sim` dependency; `node` and `browsers` projects with `goldenCommands()` |
| `packages/physics/src/snapshot-property.test.ts`, `packages/physics/package.json` (devDependency) | Task 11, agreed with the sim lane |
| `examples/testing/record-replay/**` | Task 13 |
| `examples/README.md` | the demo's row |

## Tasks

Each task: write the failing test, run it and see it fail for the stated reason, write the least code, run the package tests, `pnpm check`, commit.

### Task 1: `describeSnapshot`
- [ ] `world/describe.test.ts`: a fixture sim with two components, a resource and two systems; the view's header, rng, resources, entities (ascending sid, absent components omitted) and, with #9's stateful fixture, `plugins` (byte length, hash); equal before and after `restore`; a truncated snapshot throws `SnapshotFormatError`; a snapshot from another schema throws `SnapshotMismatchError`; `sim.hash()` unchanged by the call. Expected failure: `describeSnapshot is not a function`.
- [ ] Implement over `decodeSnapshot`; export `SnapshotView`.

### Task 2: exports and version
- [ ] `index.test.ts`: `createRng`, `deriveSeed`, `SIM_VERSION` exported; `version.test.ts`: `SIM_VERSION` equals `package.json`'s `version`. Expected failure: undefined exports.
- [ ] Implement.

### Task 3: varint and strict UTF-8
- [ ] `replay/varint.test.ts`: 0, 127, 128, 2³² − 1 round-trip; a sixth continuation byte, a value over 2³² − 1 and a truncated varint throw `ReplayFormatError` with the offset. `hash/canonical.test.ts`: the decoder inverts `utf8` for ASCII, BMP and astral text and throws on an overlong form, a lone surrogate and a truncated sequence.
- [ ] Implement; `pnpm boundaries` passes on `src/replay`.

### Task 4: codec
- [ ] `replay/codec.test.ts`: round trips per spec §7; the committed hex of a three-tick replay (written by hand from spec §3.3 first, so the test pins the layout, not the implementation); one test per format error in spec §5. Expected failure: module missing.
- [ ] Implement `encodeReplay` and `decodeReplay` in `codec.ts`.

### Task 5: recorder
- [ ] `replay/recorder.test.ts`: `start` equals `sim.snapshot()` at creation; only accepted commands recorded (a wrong-tick command is dropped); checks at 60, 120 and the final tick; reference hashes for every tick and snapshots every `snapshotEvery`; `ReplayRecordError` for stepping outside, an `undefined` payload field, `finish` twice, `checkEvery: 0`.
- [ ] Implement.

### Task 6: stepper
- [ ] `replay/stepper.test.ts`: a recorded 300-tick run on the bounce fixture plays back to the same final hash and every check; a run recorded from a mid-run snapshot (checkpoint start); a plugin with an extra component (schema change) and other content each make `createReplayStepper` throw `SnapshotMismatchError` with the right field; a plugin that tightens a command schema makes that tick's check fail with the reject reason; `dispose` twice is safe.
- [ ] Implement.

### Task 7: packing and compression
- [ ] `replay/pack.test.ts` with a fake compression; `packages/testing/src/sim/compression.test.ts`: `nodeCompression` ↔ `streamCompression` interoperate both ways; each stops at the cap; garbage input is `ReplayFormatError`.
- [ ] Implement `packReplay`, `unpackReplay`, both adapters.

### Task 8: fixtures and structural diff
- [ ] `fixtures/bounce.plugin.ts` and `bounce-diverged.plugin.ts` (identical definitions; a test asserts equal `schemaHash` and different hashes after tick 137).
- [ ] `sim/diff.test.ts`: header, rng, resource path, missing and extra sid, missing component, field values, plugin bytes; order; `Object.is` (−0 vs 0); the 20-line cap in `formatGoldenReport`.
- [ ] Implement `diffSnapshotViews` and `formatGoldenReport`.

### Task 9: golden files and `simGolden`
- [ ] `sim/golden.test.ts` (Node, temp folders): `simGolden` missing → `missing`; with `AUTOMATA_UPDATE_GOLDENS=1` → `written` (canonical JSON); unchanged → `pass`; a changed script → first differing tick; a changed component → `schema-changed`; other content → `content-changed`.
- [ ] Implement `golden-files.ts` (Node fs; browser `readGolden` command, with the missing-command message), `commands.ts` (`goldenCommands()`), `sim-golden.ts`.

### Task 10: `replayGolden` and exit 7
- [ ] `sim/golden.test.ts` continued: written then pass; a `drive` that spawns outside `step` is refused as non-reproducing; a recording over the cap is refused naming `snapshotEvery`; schema-changed; content-changed.
- [ ] `sim/divergence.test.ts`: the bounce golden checked with `bounce-diverged` reports `diverged`, `firstTick: 137`, `exact: true`, first difference `bounce.ball.vx` on the expected sid; recorded with `snapshotEvery: 10`, `diffTick: 140`; a replay without reference data reports `exact: false` and the window (120, 180].
- [ ] Implement `replay-golden.ts` with the bisection in spec §3.6. Record the bounce goldens (`AUTOMATA_UPDATE_GOLDENS=1`, Node) in their own commit.

### Task 11: property test (exit 4)
- [ ] `sim/property.test.ts`: 200 cases on bounce pass; a fixture with a resource that `restore` drops (a deliberately broken plugin state in the test file) fails and names the case and variant. Expected failure first: module missing.
- [ ] Implement `snapshotRoundTripProperty`.
- [ ] With the sim lane's agreement, add `packages/physics/src/snapshot-property.test.ts` (200 cases each on #9's 2D and 3D scenes) and `@mcthaydt/automata-testing` as a physics devDependency. Record each run time in the log.

### Task 12: cross-engine runner (exit 3)
- [ ] `packages/testing/vitest.config.ts`: a `browsers` project with `goldenCommands()` and `optimizeDeps.include` for the sim entries; `test:parity` script.
- [ ] `sim/bounce.golden.test.ts` runs the bounce `simGolden` and `replayGolden` in both projects; also re-encodes the decoded golden and compares bytes. Run `pnpm --filter @mcthaydt/automata-testing test:parity`: identical in Chromium, WebKit, Firefox. A temporary engine-specific perturbation (a test-only plugin branching on `navigator.userAgent`, never committed) makes the browser run fail, recorded in the log.

### Task 13: demo `examples/testing/record-replay` (waits on #10)
- [ ] If `base-2d` is not on `main`: add the row to `examples/README.md` as "waits on base-2d", note it here, and leave the rest for a follow-up PR with the same task ID.
- [ ] `route.golden.test.ts`: `replayGolden({ file: '__goldens__/route.replay', record: { drive: GOLDEN_ROUTE inputs } })` passes in Node and, via `test:parity`, in three browsers; its `finalHash` equals base-2d's `GOLDEN_HASH`. Expected failure: golden missing; then record it.
- [ ] `record-replay.test.ts` (Node): the demo's record-then-replay controller (no renderer) records a scripted run and its playback reports every check passing.
- [ ] Build the demo per spec §8; `main.ts` header; smoke test under the fake host.
- [ ] Journey `e2e/record-replay.e2e.ts`: the route with real key presses; the panel's final hash equals the golden's. Run locally with the repo's e2e command for this project; on the GPU runner nightly.
- [ ] Screenshots at phone portrait, 780×270 and desktop into `evidence/`; show the Owner before promoting. Update the demo's row in `examples/README.md`.

## Finish

- [ ] `pnpm ci:local` green; record commands, Node version, per-engine results and the property test times in the PR.
- [ ] Update **Progress**, add the execution log line, and send the integration owner the rows for 02 and 03.

## Execution log

- (empty)
