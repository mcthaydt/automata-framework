# M2.3 Goldens and replays: TDD plan

> Steps use checkboxes. Tick each one when its check passes and commit the tick with that step's work.

- **Spec:** [m2-goldens-and-replays](../specs/2026-10-11-m2-goldens-and-replays-design.md) ("spec"); milestone: [M2](../specs/2026-10-11-m2-deterministic-core-design.md).
- **Lane:** testing (new in [04](../../04-how-we-build.md)), on its own branch and worktree from `main` (#9 is merged, `d556d23`). Draft PR titled `M2.3 Goldens and replays`. It does not need M2.2: content is `unknown` in every signature here. It merges after M2.2 (milestone spec §5): merge `main` then, re-run every golden and the property test, and re-record any golden whose content hash moved (with the reason in the commit).
- **Progress:** 0 / 13 tasks.
- **Local CI (every task ends green):** Node 24.21.0; `pnpm vitest run <file>` first, then `pnpm --filter <pkg> test`, then `pnpm check`. Parity tasks also run `pnpm --filter <pkg> test:parity` (Chromium, WebKit, Firefox; Playwright 1.63). Before calling the PR green: `pnpm ci:local`.

## Interfaces

- **Consumed:** `createSim`, `Sim`, `Command`, `StepResult`, `PluginDef`, `SnapshotFormatError`, `SnapshotMismatchError`, `SimFaultedError` (`@mcthaydt/automata-sim`, with #9); `decodeSnapshot`, `SnapshotData` (internal, `world/snapshot.ts`); `canonicalJson`, `utf8`, `xxhash64`, `hex64` (`./hash`); `createRng`, `deriveSeed` (`rng/rng.ts`); #9's `src/testing/scene-2d.ts` and `scene-3d.ts` (Task 11); `createBaseSim`, `moveCommand`, `routeInputs`, `GOLDEN_GOAL_TICK`, `GoalReached`, and the `startGame` options and `./render` entry (`@af-examples/base-2d` after #10 and integration's export request, Task 13).
- **Produced:** spec §3.1–§3.9.

## Files

| File | Change |
|---|---|
| `packages/sim/src/world/sim.ts`, `world/snapshot.ts` | `describeSnapshot` |
| `packages/sim/src/version.ts`, `version.test.ts` | `SIM_VERSION` equal to `package.json` |
| `packages/sim/src/hash/canonical.ts` | strict UTF-8 decoder beside `utf8` (the loose `decodeUtf8` in `world/snapshot.ts:170-195` stays) |
| `packages/sim/src/replay/{replay,varint,codec,recorder,stepper,pack,errors,index}.ts` | the format |
| `packages/sim/src/index.ts` | `describeSnapshot` types, `SnapshotView`, `createRng`, `deriveSeed`, `SIM_VERSION` |
| `packages/sim/package.json` | `./replay` export |
| `packages/testing/src/sim/{golden-files,compression,diff,report,sim-golden,replay-golden,property,commands,index}.ts` | the harness |
| `packages/testing/src/sim/fixtures/{bounce.plugin,bounce.component,bounce.system,bounce.resource,bounce.command,bounce-diverged.plugin,bounce-script}.ts`, `fixtures/__goldens__/{bounce.golden.json,bounce.replay}` | fixtures (role suffixes: `check-style` applies here) |
| `packages/testing/package.json`, `vitest.config.ts` | `./sim` export; `@mcthaydt/automata-sim` dependency; new `sim` (Node) and `sim-browsers` projects beside the existing `unit` and `layout`; `test:unit` and `test:parity` scripts extended (spec §3.8) |
| `packages/physics/src/snapshot-property.test.ts`, `packages/physics/package.json` (devDependency) | Task 11, agreed with the sim lane |
| `examples/testing/record-replay/**` | Task 13 |
| root `playwright.config.ts` | the demo journey's project: asked of ship through the coordinator, not edited here |
| `examples/README.md` | the demo's row |

## Tasks

Each task: write the failing test, run it and see it fail for the stated reason, write the least code, run the package tests, `pnpm check`, commit.

### Task 1: `describeSnapshot`
- [ ] `world/describe.test.ts`: a fixture sim with two components, a resource and two systems; the view's header, rng, resources, entities (ascending sid, absent components omitted) and, with #9's stateful fixture, `plugins` (byte length, hash); equal before and after `restore`; a truncated snapshot throws `SnapshotFormatError`; a snapshot from another schema throws `SnapshotMismatchError`; without bytes, a faulted sim throws `SimFaultedError` and a disposed one `SimDisposedError`; `sim.hash()` unchanged by the call. Expected failure: `describeSnapshot is not a function`.
- [ ] Implement over `decodeSnapshot`; export `SnapshotView`.

### Task 2: exports and version
- [ ] `index.test.ts`: `createRng`, `deriveSeed`, `SIM_VERSION` exported; `version.test.ts`: `SIM_VERSION` equals `package.json`'s `version`. Expected failure: undefined exports.
- [ ] Implement.

### Task 3: varint and strict UTF-8
- [ ] `replay/varint.test.ts`: 0, 127, 128, 2³² − 1 round-trip; a sixth continuation byte, a value over 2³² − 1 and a truncated varint throw `ReplayFormatError` with the offset. `hash/canonical.test.ts`: the decoder inverts `utf8` for ASCII, BMP and astral text and throws on an overlong form, a lone surrogate and a truncated sequence. Expected failure: modules missing (`Cannot find module './varint.ts'`; `decodeUtf8Strict` not exported).
- [ ] Implement; `pnpm boundaries` passes on `src/replay`.

### Task 4: codec
- [ ] `replay/codec.test.ts`: round trips per spec §7; the committed hex of a three-tick replay (written by hand from spec §3.3 first, so the test pins the layout, not the implementation); one test per format error in spec §5. Expected failure: module missing.
- [ ] Implement `encodeReplay` and `decodeReplay` in `codec.ts`.

### Task 5: recorder
- [ ] `replay/recorder.test.ts`: `start` equals `sim.snapshot()` at creation; only accepted commands recorded (a wrong-tick command is dropped); two commands in one tick recorded in (source, seq) order whatever order they were passed; an explicit `undefined` optional field records (the key dropped) and plays back; checks at 60, 120 and the final tick; reference hashes for every tick and snapshots every `snapshotEvery`; `ReplayRecordError` for stepping outside, a `NaN` payload, `finish` twice, `checkEvery: 0`. Expected failure: `createRecorder` not exported.
- [ ] Implement.

### Task 6: stepper
- [ ] `replay/stepper.test.ts`: a recorded 300-tick run on the bounce fixture plays back to the same final hash and every check; a run recorded from a mid-run snapshot (checkpoint start); a plugin with an extra component (schema change) and other content each make `createReplayStepper` throw `SnapshotMismatchError` with the right field; a twin plugin whose command schema adds `.refine(p => p.ball !== 3)` (the test first asserts both plugins give the same `schemaHash`) makes the tick with `ball: 3` fail its check with the reject reason; `dispose` twice is safe. Expected failure: `createReplayStepper` not exported.
- [ ] Implement.

### Task 7: packing and compression
- [ ] `replay/pack.test.ts` with a fake compression; `packages/testing/src/sim/compression.test.ts` (first test in the new `sim` project, added here): `nodeCompression` ↔ `streamCompression` interoperate both ways; each stops at the cap; garbage input is `ReplayFormatError`. Expected failure: `packReplay` not exported; the `sim` project does not exist yet, so the file first runs, wrongly, in `unit` (jsdom) — the project split is this task's first change.
- [ ] Implement `packReplay`, `unpackReplay`, both adapters.

### Task 8: fixtures and structural diff
- [ ] `fixtures/bounce.plugin.ts` (exports `bouncePlugin`; definitions in role-suffixed files) and `bounce-diverged.plugin.ts` (identical definitions; its system adds 1 to one ball's `vx` when `ctx.tick === 136`). A test asserts equal `schemaHash`, equal hashes through tick 136 and different hashes from tick 137 (spec §3.2 numbering). Expected failure: modules missing. `pnpm style` passes on `fixtures/`.
- [ ] `sim/diff.test.ts`: header, rng, resource path, missing and extra sid, missing component, field values, plugin bytes; order; `Object.is` (−0 vs 0); the 20-line cap in `formatGoldenReport`. Expected failure: `diffSnapshotViews` not exported.
- [ ] Implement `diffSnapshotViews` and `formatGoldenReport`.

### Task 9: golden files and `simGolden`
- [ ] `sim/golden.test.ts` (Node, temp folders): `simGolden` missing → `missing`; with `AUTOMATA_UPDATE_GOLDENS=1` → `written` (canonical JSON); unchanged → `pass`; a changed script → first differing tick; a changed component → `schema-changed`; other content → `content-changed`; another `tickHz` → `setup-changed` naming `tickHz`; a write that throws after the temp file (fs stubbed) leaves the old golden. Expected failure: `simGolden` not exported.
- [ ] Implement `golden-files.ts` (Node fs; browser `readGolden` command, with the missing-command message), `commands.ts` (`goldenCommands()`), `sim-golden.ts`.

### Task 10: `replayGolden` and exit 7
- [ ] `sim/golden.test.ts` continued: written then pass; a `drive` that spawns outside `step` is refused as non-reproducing; a recording over 512 KiB packed, and one under it but over `REPLAY_INFLATE_MAX_BYTES` encoded (a highly compressible run), are each refused naming `snapshotEvery`; schema-changed; content-changed. Expected failure: `replayGolden` not exported.
- [ ] `sim/divergence.test.ts`: the bounce golden checked with `bounce-diverged` reports `diverged`, `firstTick: 137` (the first differing hash), `exact: true`, first difference `bounce.ball.vx` on the expected sid; recorded with `snapshotEvery: 10`, `diffTick: 140`; a replay without reference data reports `exact: false` and the window (120, 180].
- [ ] Implement `replay-golden.ts` with the bisection in spec §3.6. Record the bounce goldens (`AUTOMATA_UPDATE_GOLDENS=1`, Node) in their own commit.

### Task 11: property test (exit 4)
- [ ] `sim/property.test.ts`: 200 cases on bounce pass; a fixture with a resource that `restore` drops (a deliberately broken plugin state in the test file) fails and names the case and variant. Expected failure first: module missing.
- [ ] Implement `snapshotRoundTripProperty`.
- [ ] Add `packages/physics/src/snapshot-property.test.ts` (200 cases each on #9's 2D and 3D scenes; agreed in 04's sim row) and `@mcthaydt/automata-testing` as a physics devDependency. Expected failure: none to see (the property already holds), so first run it against a copy of the 2D scene whose plugin state drops one body on restore and see it fail, never committed. Both property tests are in `test:unit` projects, so `pnpm check` and CI run them. Record each run time in the log; if one passes 60 s, move it to its own project that `test:unit` also runs, never out of CI.

### Task 12: cross-engine runner (exit 3)
- [ ] Add the `sim-browsers` project **without** `goldenCommands()` and extend `test:parity`; write `sim/bounce.golden.test.ts`. Expected failure: in a browser the golden test fails with the "add goldenCommands()" message. Then register `goldenCommands()` and `optimizeDeps.include` for the sim entries; the browser run reads the golden.
- [ ] `sim/bounce.golden.test.ts` runs the bounce `simGolden` and `replayGolden` in `sim` and `sim-browsers`; it also re-records the run in the engine and compares its encoded bytes (before deflate) with the committed file's, both re-encoded with `framework: ''` and `meta: {}` (spec §3.3); a test bumps `SIM_VERSION` in the header and the comparison still passes. The deflated bytes are not compared across engines. Run `pnpm --filter @mcthaydt/automata-testing test:parity`: identical in Chromium, WebKit, Firefox. A temporary engine-specific perturbation (a test-only plugin branching on `navigator.userAgent`, never committed) makes the browser run fail, recorded in the log.

### Task 13: demo `examples/testing/record-replay` (waits on #10)
Starts only when base-2d (#10) and its `startGame` options are on `main`. Until then the demo's row in `examples/README.md` says it needs the `startGame` options, nothing here is ticked, and Tasks 1–12 merge alone; the demo lands as its own PR with this task ID.
- [ ] `route.golden.test.ts`: `replayGolden({ file: '__goldens__/route.replay', plugins: [base2dPlugin], content: { room: parseRoom(ROOM) }, record: { create: () => createBaseSim(), drive } })`, where `drive` feeds `routeInputs()` from the round's tick 0 and stops after the step that reports `GoalReached`; the test asserts `finalTick === GOLDEN_GOAL_TICK` (342). It passes in Node and, via `test:parity`, in three browsers. It does **not** compare with `GOLDEN_HASH`, which is taken after all 355 route ticks. Expected failure: golden missing; then record it.
- [ ] `record-replay.test.ts` (Node): the demo's record-then-replay controller (no renderer) records a scripted run from tick 0 and its playback reports every check passing; pressing `R` mid-playback disposes the stepper's sim before the next is created (a sim count probe never passes two). Expected failure: the controller module is missing.
- [ ] Build the demo per spec §8; `main.ts` header; smoke test under the fake host. Expected failure: no `index.html`.
- [ ] Journey `e2e/record-replay.e2e.ts`: drives the route as base-2d's journey does; when recording stops at the goal, the panel shows tick 342 and the golden's `finalHash`. Its project goes in the root `playwright.config.ts` through the coordinator. Expected failure: no such project. Runs on the GPU runner nightly and on request.
- [ ] Screenshots at phone portrait, 780×270 and desktop into `evidence/`; show the Owner before promoting. Update the demo's row in `examples/README.md`.

## Finish

- [ ] `pnpm ci:local` green; record commands, Node version, per-engine results and the property test times in the PR.
- [ ] Update **Progress**, add the execution log line, and send the integration owner the rows for 02 and 03.

## Execution log

- (empty)
