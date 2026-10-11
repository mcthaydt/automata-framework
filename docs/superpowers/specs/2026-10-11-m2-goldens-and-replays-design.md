# M2.3 Goldens and replays (lane **testing**): design

- **Status:** drafted 2026-10-11 by the M2 specs thread; awaiting Owner review with the [M2 milestone spec](./2026-10-11-m2-deterministic-core-design.md).
- **Task:** M2.3 in [02 Master delivery plan](../../02-master-delivery-plan.md). Plan: [m2-goldens-and-replays](../plans/2026-10-11-m2-goldens-and-replays.md).
- **Owns:** `packages/sim/src/replay/` (new) and the `./replay` export; in `packages/sim`, `Sim.describeSnapshot` (`world/sim.ts`, `world/snapshot.ts`), the `createRng` export and `src/version.ts`; `packages/testing/src/sim/` (new) and the `./sim` export; one test file in `packages/physics` (§7, with the sim lane's agreement); `examples/testing/record-replay/`; this lane's rows in `examples/README.md` and `docs/versions.md`.
- **Must not touch:** `packages/content`, `SimContent` and `Sim.contentHash` (M2.2), `examples/base-2d/` (integration; the demo imports it), root config (ship).
- **Builds from:**
  - A0+A1 spec §6 (`simGolden`, `.replay`, `replayGolden` with first-divergent-tick bisection and structural diff, cross-engine runner) and §8 exits 3, 4 and 7.
  - **FloorFifty's replay format** (`packages/shared/src/replay/{replay,codec,compression,stepper,state-hash}.ts` and `tests/shared/replay/*.test.ts`, 122a220): a JSON header with a length prefix; change-only tracks as varint deltas; a check hash every 60 ticks plus the final hash; deflate behind an injected interface (Node `zlib`, browser `CompressionStream`) with an inflate cap against bombs (`REPLAY_INFLATE_MAX_BYTES`); `ReplayFormatError` for anything malformed; a stepper that re-simulates "through the one simulation there is" and reports each check; the replay starts from the state at GO, so setup outside `step` is captured. FloorFifty's `stateHash` (FNV-1a over chosen fields, `+ 0` to fold −0) is replaced by `sim.hash()`, which covers the whole snapshot and keeps −0 (#9 §10.1).
  - **The Last Light's record and replay** (`src/game/simulation.ts` `ReplayLog`, `record()`, `replay()`, `worldHash`; `tests/replay.test.ts`, 8280918): a run recorded in the browser replays headless tick for tick; a run may start from a checkpoint (`from`); the replay reports a hash per step and every event.
  - The sim: `world/snapshot.ts` (`decodeSnapshot`, internal), `world/sim.ts` (`hash`, `restore`, `StepResult.rejected`), #9's section 6 and `SimFaultedError`.

## 1. Goal and boundaries

- Any run of a sim can be recorded and played back bit-identically in Node, Chromium, WebKit and Firefox.
- A golden test pins a run; when it breaks, the report says why in one screen: the schema changed, the content changed, or the run diverged at tick *t*, with each field that differs.
- A property test proves snapshot → restore → continue equals an uninterrupted run, over at least 200 seeds and tick counts.

**Deliverables:** `@mcthaydt/automata-sim/replay` (format, codec, recorder, stepper, packing); `Sim.describeSnapshot`; `@mcthaydt/automata-testing/sim` (`simGolden`, `replayGolden`, `diffSnapshotViews`, `formatGoldenReport`, `snapshotRoundTripProperty`, `goldenCommands`, `nodeCompression`, `streamCompression`); fixtures including the divergent one; goldens and the property test run in four engines; the demo.

**Not in this task:** recording replays during real play and storing them (runtime, M1.5, and saves, M5); two-client network replays (M7); screenshot goldens (M4); describing plugin bytes field by field (physics bytes are compared by hash; their effects show up in `Transform*` and `RigidBody*` components anyway).

## 2. Ownership

| State | Owner | Writers |
|---|---|---|
| `.replay` format v1 | `sim/replay` | `encodeReplay` only |
| A recording in progress | the `Recorder` | only `recorder.step`; nothing else may step the sim while recording |
| Golden files (`__goldens__/*.golden.json`, `*.replay`) | the test's package | the Node harness, only with `AUTOMATA_UPDATE_GOLDENS=1`; no browser write path exists |
| Divergence reports | `testing/sim` | computed, never stored |

## 3. Contracts

### 3.1 `Sim.describeSnapshot` (sim, additive)

```ts
export interface SnapshotView {
  readonly header: { readonly formatVersion: number; readonly schemaHash: string; readonly contentHash: string
                     readonly tick: number; readonly tickHz: number }
  /** Per system, its RNG state words. */
  readonly rng: Readonly<Record<string, readonly number[]>>
  /** Per resource id, its value parsed from canonical JSON. */
  readonly resources: Readonly<Record<string, unknown>>
  readonly nextId: number
  /** Ascending sid; per component id, its field values. Components the entity lacks are absent. */
  readonly entities: readonly { readonly sid: number; readonly components: Readonly<Record<string, FieldRecord>> }[]
  /** Section 6, per stateful plugin: byte length and XXH64 of its bytes (opaque engine state). */
  readonly plugins: Readonly<Record<string, { readonly byteLength: number; readonly hash: string }>>
}
interface Sim { describeSnapshot(bytes?: Uint8Array): SnapshotView }   // no bytes: the current state
```

It decodes with the sim's own component definitions, so it validates exactly as `restore` does and throws the same `SnapshotFormatError` / `SnapshotMismatchError`. It changes nothing.

`createRng` and `deriveSeed` are exported from `@mcthaydt/automata-sim` (additive) so test scripts draw from the same xoshiro128** the sim uses.

### 3.2 The `Replay` value

```ts
export const REPLAY_FORMAT = 1
export const DEFAULT_CHECK_EVERY = 60

export interface Replay {
  readonly header: ReplayHeader
  /** sim.snapshot() when recording started: covers setup spawns and checkpoint starts. */
  readonly start: Uint8Array
  /** Only ticks with accepted commands, ascending. `tick` is the sim's tick before that step. */
  readonly ticks: readonly { readonly tick: number; readonly commands: readonly ReplayCommand[] }[]
  /** sim.hash() after stepping to `tick`; ascending, in (startTick, finalTick]. */
  readonly checks: readonly { readonly tick: number; readonly hash: string }[]
  readonly finalTick: number
  readonly finalHash: string
  /** Goldens only: a hash after every step, and full snapshots every `snapshotEvery` ticks. */
  readonly reference?: {
    readonly hashes: readonly string[]              // index i is the hash at startTick + 1 + i
    readonly snapshots: readonly { readonly tick: number; readonly bytes: Uint8Array }[]
  }
}
export interface ReplayHeader {
  readonly tickHz: number
  readonly seed: number
  readonly schemaHash: string        // 16 hex, copied from the start snapshot's header
  readonly contentHash: string       // 16 hex, likewise (the sim content hash, M2.2)
  readonly startTick: number
  readonly checkEvery: number
  readonly framework: string         // SIM_VERSION, informational
  readonly meta: Readonly<Record<string, string>>  // free-form: game, build id, recorded-in
}
export interface ReplayCommand { readonly source: number; readonly seq: number; readonly type: string; readonly payload: unknown }
```

Only commands the sim accepted are recorded (`StepResult.rejected` names the others). A rejected command never changes state, so dropping it keeps the replay exact, and the format never has to hold a malformed header. The stepper rebuilds each `Command` with `tick` set to the step's tick.

### 3.3 Bytes (before deflate)

All multi-byte integers little-endian through `DataView`; `varint` is unsigned LEB128 of at most 5 bytes (values ≤ 2³² − 1).

```
"AFRP" | format u16 = 1 | headerLength u32 | header: canonicalJson(ReplayHeader & { commandTypes: string[] }) UTF-8
start       length u32 | snapshot bytes
ticks       count varint | per tick: delta varint (first from startTick, then from the previous tick; ≥ 1 after the first)
            | commands varint (≥ 1) | per command: source u8 | seq varint | type index varint (into commandTypes)
            | payload length varint | payload: canonicalJson(payload) UTF-8
checks      count varint | per check: delta varint (from startTick, then the previous check; ≥ 1) | hash u64
final       delta varint (finalTick − startTick) | hash u64
reference   0 | 1, then: hash u64 × (finalTick − startTick) | snapshots varint | per: delta varint | length u32 | bytes
            (end of input: no trailing bytes)
```

- `commandTypes` is the sorted set of types used; an index out of range is a format error.
- Payloads are canonical JSON, so the bytes for a run are identical in every engine (the replay of a golden is itself byte-compared in the parity test).
- Varint deltas and a change-only layout follow FloorFifty's codec; deflate on top (§3.5) does the rest.

### 3.4 Recorder and stepper

```ts
export function createRecorder(sim: Sim, options?: {
  readonly checkEvery?: number                        // default 60; ≥ 1
  readonly reference?: { readonly snapshotEvery: number }   // goldens; ≥ 1
  readonly meta?: Readonly<Record<string, string>>
}): Recorder
export interface Recorder {
  step(commands: readonly Command[]): StepResult      // sim.step plus recording
  finish(): Replay                                    // adds the final tick and hash; the recorder is then closed
}

export function createReplayStepper(replay: Replay, setup: {
  readonly plugins: readonly PluginDef[]; readonly content?: SimContent
}): Promise<ReplayStepper>
export interface ReplayStepper {
  readonly sim: Sim
  readonly tick: number
  readonly done: boolean
  step(): { readonly tick: number; readonly result: StepResult
            readonly check?: { readonly expected: string; readonly actual: string } }
  /** Steps to the end; stops at the first failed check. */
  run(): { readonly ok: boolean; readonly checks: number; readonly failed?: { tick: number; expected: string; actual: string } }
  dispose(): void
}
```

- The recorder takes the start snapshot at creation, refuses a `checkEvery` or `snapshotEvery` below 1, and throws `ReplayRecordError` when the sim's tick moved since the last `recorder.step` (someone stepped it directly) or a payload is not canonical JSON (an `undefined` field). Spawning outside `step` cannot be detected; the golden harness catches it by playing every new golden back before writing it (§3.6).
- The stepper creates a sim (`seed`, `tickHz` from the header), restores `start` (a schema or content change surfaces here as `SnapshotMismatchError`), then steps exactly `finalTick − startTick` times, feeding each recorded tick's commands. A recorded command the current code rejects is a check failure at that tick, not a silent skip: `step()` reports it as `check: { expected: 'accepted', actual: '<reason>' }`.

### 3.5 Packing

```ts
export interface ReplayCompression {
  deflate(bytes: Uint8Array): Promise<Uint8Array>
  /** Rejects once the output would pass maxBytes, without inflating the rest. */
  inflate(bytes: Uint8Array, maxBytes: number): Promise<Uint8Array>
}
export const REPLAY_INFLATE_MAX_BYTES = 8 * 1024 * 1024
export function packReplay(replay: Replay, compression: ReplayCompression): Promise<Uint8Array>
export function unpackReplay(bytes: Uint8Array, compression: ReplayCompression,
                             options?: { readonly maxInflatedBytes?: number }): Promise<Replay>
```

Raw deflate, as FloorFifty, so Node's `deflateRaw` and the browser's `CompressionStream('deflate-raw')` read each other's bytes. The cap is 8 MiB rather than FloorFifty's 1 MiB because goldens carry reference snapshots; player replays (M5) may pass a lower cap. `sim/replay` imports neither `zlib` nor `CompressionStream`; the adapters are in `testing/sim` and, later, the runtime.

### 3.6 Golden harness (`@mcthaydt/automata-testing/sim`)

```ts
simGolden(options: {
  name: string; dir: string                           // golden: <dir>/__goldens__/<name>.golden.json
  plugins: readonly PluginDef[]; content?: SimContent; seed: number; tickHz?: number
  setup?: (sim: Sim) => void
  script: (tick: number, rng: Rng) => readonly Command[]
  ticks: number; every?: number                       // default 1
}): Promise<GoldenReport>

replayGolden(options: {
  file: string                                        // a .replay (deflated), e.g. <dir>/__goldens__/route.replay
  plugins: readonly PluginDef[]; content?: SimContent
  /** Records the golden when updating (Node, AUTOMATA_UPDATE_GOLDENS=1); absent for replays recorded elsewhere. */
  record?: { seed: number; tickHz?: number; setup?: (sim: Sim) => void
             drive: (recorder: Recorder, sim: Sim) => void | Promise<void>; snapshotEvery?: number }
}): Promise<GoldenReport>

expectGolden(report: GoldenReport): void              // throws with formatGoldenReport(report)

type GoldenReport =
  | { kind: 'pass'; checks: number }
  | { kind: 'written'; file: string; bytes: number }
  | { kind: 'missing'; file: string }
  | { kind: 'schema-changed' | 'content-changed'; expected: string; actual: string }
  | { kind: 'diverged'; firstTick: number; lastGoodTick: number; exact: boolean
      diffTick?: number; differences: readonly Difference[] }
```

- **`simGolden`** is A0+A1's light pin: it records `{ tick, hash }` every `every` ticks into canonical JSON (`{ name, seed, tickHz, schemaHash, contentHash, every, hashes }`), reviewable in a PR diff. A mismatch reports the first differing recorded tick, or `schema-changed` / `content-changed` from the header fields. It never reports fields: use `replayGolden` for that.
- **`replayGolden`** with `record` and the update flag records through `drive`, plays the new replay back in a fresh sim (refusing to write one that does not reproduce, which catches setup outside `step`), packs it, refuses a file over **512 KiB** (the message names `snapshotEvery`), and writes it. Then, always, it checks the file. Default `snapshotEvery` is 1, so a divergence is diffed at its exact tick.
- **Finding the first divergent tick.** Fast path: step the replay, comparing only at checks. On the first failed check at tick *c*, with the last good check at *b* (or the start):
  1. with reference data, restore the latest reference snapshot at or before *b* (or `start`), then step one tick at a time to *c*, hashing each tick against `reference.hashes`; the first mismatch is *t*, and `exact: true`;
  2. diff `describeSnapshot()` of the current state at *t* against the reference snapshot at *t* when one is stored; otherwise step on to the next stored snapshot and diff there (`diffTick` says which tick was diffed);
  3. without reference data (a replay recorded elsewhere), report the window (*b*, *c*] with `exact: false` and no differences.

  Restoring the golden's own snapshot is sound because the hashes at *b* matched and the schema hash was checked first. Hashing every tick only while bisecting keeps the passing path at one hash per 60 ticks (`sim.hash()` costs ~5 ms at 500 bodies, #9 §10.5).
- **`diffSnapshotViews(expected, actual): Difference[]`**: header fields, then RNG (system, word), resources (JSON path), entities (a missing or extra sid, a missing or extra component, then each field), then plugin byte hashes; sorted in that order, then by sid and id. Numbers compare with `Object.is` (so −0 ≠ 0 and NaN never appears, since fields are finite) and print with `String()`, which is exact for f32 values.
- **`formatGoldenReport`** prints, for example:

  ```
  route.replay diverged at tick 137 (last matching check: tick 120)
    entity 4 bounce.ball.vx: 3 ≠ 4
    entity 4 bounce.ball.x: 1027 ≠ 1028
    resource bounce.stats.bounces: 12 ≠ 13
  ```
  At most 20 lines of differences, then `… and N more`.

### 3.7 Property test

```ts
snapshotRoundTripProperty(options: {
  plugins: readonly PluginDef[]; content?: SimContent; tickHz?: number
  setup?: (sim: Sim, rng: Rng) => void
  script: (tick: number, rng: Rng) => readonly Command[]
  cases?: number            // default 200
  maxTicks?: number         // default 300
  seed?: number             // default 1: which 200 cases
}): Promise<{ readonly failures: readonly { case: number; simSeed: number; ticks: number; at: number; variant: string; report: string }[] }>
```

Each case draws `simSeed`, `ticks` in [1, `maxTicks`] and a restore point `at` in [0, `ticks`] from `createRng(deriveSeed(seed, 'property'))`. Run A steps `ticks` uninterrupted. Run B steps to `at`, snapshots, and continues by one of two variants, alternating by case: **fresh** (restore into a new sim) or **dirty** (step the same sim 7 more ticks, then restore into it). A case passes when B's final hash equals A's and B's events after `at` equal A's (as canonical JSON). A failure names the case, the seeds and the variant, so it reproduces with one call.

### 3.8 Cross-engine runner

- Every golden test runs in the package's `node` project and its `browsers` project (Chromium, WebKit, Firefox, Playwright 1.63), like the existing parity suites.
- In Node the harness reads and writes files with `node:fs`. In a browser it reads through a Vitest browser command, `readGolden(path) → base64`, that the package's `vitest.config.ts` registers with `goldenCommands()`; a browser run without it fails with a message saying to add it. There is no browser write command, so a browser can never rebaseline (AGENTS.md: never rebaseline per engine).
- `nodeCompression` (`node:zlib` `deflateRawSync`, `inflateRawSync` with `maxOutputLength`) and `streamCompression` (`CompressionStream`/`DecompressionStream('deflate-raw')`, counting output and cancelling past the cap) are tested to read each other's bytes.
- The testing package's browser project lists `@mcthaydt/automata-sim` and its subpaths in `optimizeDeps.include` (A0 §11).

### 3.9 Package layout

`@mcthaydt/automata-testing` keeps its root export (ui fixtures, with the `svelte` peer). The sim harness is the new `./sim` subpath with no Svelte import, so a sim-only package or game can use it without Svelte. `testing` gains `@mcthaydt/automata-sim` as a dependency.

## 4. Lifecycle

1. `createRecorder(sim)` snapshots `start`.
2. Each `recorder.step` steps the sim, records accepted commands, and at every `checkEvery`-th tick from the start records `sim.hash()`; with `reference`, also every tick's hash and every `snapshotEvery`-th snapshot.
3. `finish()` records the final tick and hash; any later call throws `ReplayRecordError('finished')`.
4. `encodeReplay` → `packReplay` → bytes; `unpackReplay` → `decodeReplay` → `Replay`.
5. `createReplayStepper` → `run()` or `step()`s → `dispose()` (disposes its sim, once).

## 5. Failure policy

| Case | Behaviour |
|---|---|
| Bad magic, unknown format, truncated, trailing bytes, varint over 5 bytes, delta 0 where ≥ 1 is required, a type index out of range, a payload that is not JSON, a check outside (startTick, finalTick], a reference hash count that does not match | `ReplayFormatError` naming what and where (byte offset); nothing stepped |
| Not deflate, or inflates past the cap | `ReplayFormatError('not a deflated replay')` / `('inflates past N bytes')`, without inflating the rest |
| Start snapshot from another schema or content | `SnapshotMismatchError` from `createReplayStepper`; the golden report is `schema-changed` or `content-changed` |
| The sim stepped outside the recorder, a non-canonical payload, a finished recorder, `checkEvery < 1` | `ReplayRecordError` |
| A new golden that does not replay | Not written; `ReplayRecordError('the recording does not reproduce: diverged at tick t')` |
| Golden over 512 KiB packed | Not written; the message names the size and `snapshotEvery` |
| Golden missing, not updating | `{ kind: 'missing' }`, a failure that says how to record it (Node, `AUTOMATA_UPDATE_GOLDENS=1`) |
| A system throws while replaying | The `SimFaultedError` (#9 §10.2) propagates with the tick |
| Recorded command rejected now | A failed check at that tick (§3.4) |

## 6. Determinism rules

- `src/replay/` is inside `packages/sim/src`, so `check-boundaries` applies: no `Math.*` outside the allowlist, no `**`, no key enumeration (`sortedKeys` instead), no DOM or host globals. `TextEncoder`/`TextDecoder` are host globals, so the codec uses the sim's own `utf8` encoder and adds a matching strict decoder (invalid UTF-8 is a `ReplayFormatError`).
- Hashes are `sim.hash()` (XXH64 of the canonical snapshot) everywhere; there is no second state hash.
- The harness runs only in tests; it may use host APIs.

## 7. Test allocation

| Layer | File | What |
|---|---|---|
| Unit (Node) | `packages/sim/src/world/describe.test.ts` | A view of a fixture sim; equals after restore; a bad snapshot throws the restore errors; nothing changes |
| Unit | `packages/sim/src/replay/codec.test.ts` | Round trips (empty run, one tick, commands on non-consecutive ticks, many sources, reference data); every row of §5's format cases, one test each; byte-exact encoding of a small fixed replay (committed hex) |
| Unit | `packages/sim/src/replay/recorder.test.ts` | Start snapshot; accepted-only; checks every 60 and the final; reference hashes and snapshots; each `ReplayRecordError` |
| Unit | `packages/sim/src/replay/stepper.test.ts` | Plays a recording to the same final hash; a checkpoint start (The Last Light's `from`); a schema change and a content change refuse; a rejected command fails its tick |
| Unit | `packages/sim/src/replay/pack.test.ts` | With an in-memory fake compression: the cap; non-deflate input |
| Unit | `packages/testing/src/sim/compression.test.ts` | `nodeCompression` and `streamCompression` (Node has `CompressionStream`) read each other's bytes; both honour the cap |
| Unit | `packages/testing/src/sim/diff.test.ts` | Each difference kind, order, −0 vs 0, the 20-line cap |
| Unit | `packages/testing/src/sim/golden.test.ts` | `simGolden` pass, missing, written, mismatch; `replayGolden` pass, written, the non-reproducing refusal, the size cap, schema-changed, content-changed |
| Fixture | `packages/testing/src/sim/fixtures/bounce.plugin.ts`, `bounce-diverged.plugin.ts` | Integer-math balls in a box with RNG spawns and a resource; the diverged twin adds 1 to one ball's `vx` at tick 137, with identical definitions (same schema hash) |
| Exit 7 | `packages/testing/src/sim/divergence.test.ts` | The bounce golden checked with the diverged plugin reports `firstTick: 137`, `exact: true`, and `bounce.ball.vx` on the right sid first; with `snapshotEvery: 10`, `diffTick: 140` |
| Exit 4 | `packages/testing/src/sim/property.test.ts`; `packages/physics/src/snapshot-property.test.ts` | 200 cases on the bounce fixture; 200 cases each on #9's 2D and 3D scenes (`src/testing/scene-*.ts`), Node; the measured run time recorded |
| Exit 3 | `*.golden.test.ts` in both projects | The bounce goldens and the demo's base-2d golden, identical in Node, Chromium, WebKit, Firefox; the packed bytes of a re-recorded golden equal the committed file in every engine |
| Boundaries | `pnpm boundaries` | `src/replay` passes; re-confirm each rule's rejecting fixture still exists (exit 5) |
| Demo | `examples/testing/record-replay/` | §8 |

## 8. Demo: `examples/testing/record-replay`

**Shows one thing:** a run is recorded, then re-simulated from its `.replay` with every check passing.

- **Base:** `@af-examples/base-2d` (`createBaseSim`, `moveCommand`, renderer, input, screens). Waits on #10.
- **Play:** walk and jump to the ember as in base-2d. Recording runs from the first input; the corner shows `REC` and the tick. Reaching the goal, or pressing `R`, ends the recording.
- **Replay:** the room resets and Wick retraces the run from the replay at normal speed, drawn by base-2d's renderer from a second sim fed only by the stepper. A small panel shows the replay's packed size in bytes, the checks passed (`checks 5 / 5`) and the final hash; a failed check would turn the line red and stop. `R` again plays it back again; `N` starts a new run.
- **Golden:** `__goldens__/route.replay`, base-2d's `GOLDEN_ROUTE` recorded through `replayGolden({ record: { drive } })` with reference snapshots every tick. Its test runs in Node and the three browsers (exit 3).
- **Browser agreement:** a browser journey (nightly and on request) plays `GOLDEN_ROUTE` with real key presses in the demo and reads the final hash from the panel; it must equal the golden's `finalHash`, so a run recorded in a browser agrees with Node (The Last Light's "the headless replay ends in exactly the state the browser recorded").
- **Header** of `main.ts`: what it shows, the controls (`←`/`→`, `Z`/`Space`, `R`, `N`; touch buttons for `R` and `N`), the base, the packages (`automata-sim`, `automata-sim/replay`, `@af-examples/base-2d`).
- **Checks:** smoke test under the fake Ruken host; the golden test; the journey.
- **Art:** base-2d's sprites; the playback is drawn with a faint palette-dimmed trail behind Wick (Endesga 64 only), an original touch rather than a copy of any reference game. Screenshots to `evidence/` for the Owner.
- **Responsive:** panel below the room in portrait, in the corner controls area at 780×270; `R` and `N` are 48 px touch buttons.

## 9. Feedback workflow

Focused `pnpm vitest run` per file; `pnpm --filter @mcthaydt/automata-testing test:parity` for golden changes; goldens are recorded only in Node with `AUTOMATA_UPDATE_GOLDENS=1`, committed alone with the reason in the message. The property test's run time is measured and recorded; if it passes 60 s in Node on the runner, the default `cases` stays 200 and the test moves to its own vitest project like #9's bench, with the reason recorded (it is still a required gate, unlike a bench).

## 10. Ruken alignment

None: replays are AF's. Storing or sharing them in Ruken goes through `Hosting` saves (M5), under Ruken's limits as the SDK enforces them.

## 11. Exit criteria

1. `pnpm check` and `pnpm test:parity` green locally (af-linux stalled), every test in §7 seen failing first.
2. Exit 3: the base-2d replay golden and the bounce goldens identical in four engines.
3. Exit 4: the property test passes 200 cases on the bounce fixture and on each physics dimension.
4. Exit 7: the divergent fixture reports tick 137 and `bounce.ball.vx`.
5. Exit 5 re-confirmed for `src/replay`.
6. The demo merged with its smoke test, golden and journey, or listed as waiting on #10 with the package work merged.

## 12. Open questions

- **Q1:** golden cap 512 KiB packed and default `snapshotEvery: 1`. Recommended; revisit with the first real measurement.
- **Q2:** `SIM_VERSION` in `src/version.ts`, kept equal to `package.json` by a test that M2.4's version step satisfies (recommended), or a build-time define as Ruken's SDK does (`__RUKEN_SDK_VERSION__`)? A define is undefined when the workspace runs `src/` directly, which every AF test does.
