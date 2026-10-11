# M2.1 Physics plugins: TDD plan

- **Spec:** `docs/superpowers/specs/2026-10-11-m2-sim-physics-design.md` ("spec").
- **Lane:** sim. Touches `packages/sim/`, new `packages/physics/`, the physics row of `tooling/check-boundaries`' source roots and import allowlist, rows for its own pins in `docs/versions.md` (once the ship lane creates it), and this plan.
- **Progress:** 14 / 14 tasks.
- **Local CI (every task ends green):** Node 24, `pnpm check`; for parity tasks, `vitest run --project browsers` in the touched package (Chromium, WebKit, Firefox, Playwright 1.63).

## Interfaces

- **Consumed:** `definePlugin`, `defineSystem`, `defineComponent`, `defineEvent`, `createSim`, `SpawnPart`, `SnapshotFormatError` from `@mcthaydt/automata-sim`; `@dimforge/rapier2d-deterministic-compat@0.21.0`, `@dimforge/rapier3d-deterministic-compat@0.21.0`.
- **Produced:** `PluginState`, `PluginStateSetup`, `PluginDef.state`, `SimContext.pluginState`, snapshot section 6, `SimFaultedError`, `SimCapacityError` (sim); `@mcthaydt/automata-physics/2d` and `/3d` (spec §3.5).

## Files

| File | Change |
|---|---|
| `packages/sim/src/define/definitions.ts`, `define/context.ts` | `PluginState`, `state`, `pluginState` |
| `packages/sim/src/world/sim.ts`, `world/snapshot.ts` | states, section 6, two-phase restore; fault state; capacity error; schema hash |
| `packages/sim/src/world/entity-store.ts` | row validation without Koota; capacity error |
| `packages/sim/src/hash/canonical.ts`, `hash/xxhash64.ts` | −0; 32-bit XXH64 |
| `packages/sim/src/index.ts` | export the new types and errors |
| `packages/physics/package.json`, `tsconfig.json`, `vitest.config.ts` | new package |
| `packages/physics/src/physics-world.ts` | dimension-neutral sync-in / sync-out / events / bytes over an adapter |
| `packages/physics/src/rapier-2d.ts`, `rapier-3d.ts` | adapters: the only files that call Rapier |
| `packages/physics/src/physics-2d.component.ts`, `physics-3d.component.ts` | components |
| `packages/physics/src/physics-2d.event.ts`, `physics-3d.event.ts` | events |
| `packages/physics/src/physics-2d.ts`, `physics-3d.ts` | `physics2d()` / `physics3d()` |
| `packages/physics/src/spawn-2d.ts`, `spawn-3d.ts` | spawn helpers |
| `packages/physics/src/2d.ts`, `3d.ts` | entry points |
| `tooling/check-boundaries` | `packages/physics/src` root; `@mcthaydt/automata-sim` imports |

## Tasks

### 1. Plugin state hook (spec §3.1)
- [x] Failing tests `world/plugin-state.test.ts`: per-sim state visible only to its plugin's systems; canonical setup order with `dt`; dispose; no section 6 without state; stateful plugin changes the schema hash; a rejected setup disposes earlier states.
- [x] Implement; `pnpm check`. (`a216775`, rebased as `358892d`)

### 2. Section 6 framing and two-phase restore (spec §3.2)
- [x] Failing tests through `createSim` in `plugin-state.test.ts` (framing is only reachable with matching plugins): round-trip and continue; a failing `prepareRestore` leaves the sim unchanged and commits no plugin; truncated, renamed row, trailing byte, empty section, section on a stateless sim → `SnapshotFormatError`.
- [x] Implement; `pnpm check`. (same commit)

### 3. Fix −0 in canonical JSON (spec §10.1)
- [x] Failing tests: `canonicalJson(-0) === '-0'`; a sim whose resource holds −0 restores to −0 (`Object.is`) and matches the uninterrupted run for 5 more ticks.
- [x] Implement; `pnpm check`.

### 4. Fail closed on a throwing system (spec §10.2)
- [x] Failing tests: a system that throws at tick 3 → `step` throws `SimFaultedError` naming the system and tick; later `step`, `snapshot`, `hash` throw `SimFaultedError`; `restore` of a good snapshot clears the fault and the run continues identically.
- [x] Implement; `pnpm check`.

### 5. Koota world limit (spec §10.3)
- [x] Failing tests: with 16 sims alive, `restore` succeeds; a 17th `createSim` rejects with `SimCapacityError`; a restore with a bad row still leaves the sim unchanged.
- [x] Implement (validate rows without Koota, free the old world before building the new one); `pnpm check`.

### 6. Schema hash covers schemas; restore re-encodes exactly (spec §10.4)
- [x] Failing tests: two plugins differing only in a resource's, command's or event's schema give different schema hashes; a stored resource with a field the current schema strips → `SnapshotFormatError`.
- [x] Implement; re-run the existing golden and record the new hash with the reason.

### 7. Faster hashing (spec §10.5)
- [x] Failing test `hash/xxhash64-equivalence.test.ts`: agrees with the BigInt reference (moved to `testing/xxhash64-reference.ts`) for every length 0..300 and assorted seeds, on an offset view, and is at least 2x faster on 256 KB. (Done as a ratio against the reference, not a wall-clock bound.)
- [x] Implement 32-bit-halves XXH64; snapshot reads rows straight from the store instead of through frozen `EntityRef` copies. `pnpm check`; browser parity 165/165. Measured in Node 24 (this container): XXH64 17.1 → 6.0 ms/MB; `sim.hash()` with 1,005 entities 2.15 → 1.68 ms. The audit's 33 ms was not reproduced at this size; per-tick hashing stays the caller's choice.

### 8. Physics package and 3D shell (spec §3.3, §3.5, §4)
- [x] Create `packages/physics` (deps: workspace `@mcthaydt/automata-sim`, Rapier pins, zod; the sim's dev deps) and the check-boundaries root and import entries.
- [x] Failing tests: importing `./3d` loads no Rapier until `createSim`; `physics3d()` has the four systems in the right phases; spawn helpers give spec §3.3 defaults.
- [x] Implement; `pnpm check`. The root `boundaries` script now lists `packages/physics/src` (the one root-config line this lane changes, as the coordinator asked); `check-boundaries` allows `@mcthaydt/automata-sim` and its `./hash`, `./math` entry points, with a test. Deviation: `physics-world.ts` and `rapier-3d.ts` were written whole here, so tasks 9–11 add their behaviour tests against existing code; each of those tests is shown failing by breaking the line it covers before committing.

### 9. 3D create, step, write back, update, remove (spec §3.4)
- [x] Failing tests, one per behaviour: a ball falls onto a lone cuboid collider and rests; body without collider; despawn removes; losing `Collider3D` recreates as body-only; teleport; kinematic-position follows its transform; velocity write; kind and damping; collider change rebuilds; lone collider moves; validation errors name sid and field.
- [x] Implement; `pnpm check`. (`physics/src/physics-3d.test.ts`, 17 tests.) Failing-first shown by mutation: removing each of removal, teleport, kinematic target, velocity write, kind change, damping, collider rebuild, lone-collider move, the write-back equality check and create-time validation fails at least one test (script output in the PR).

### 10. 3D events (spec §3.4)
- [x] Failing tests: started events sorted with `a < b`; sensor flag; ended on separation; an event for a collider removed this tick is dropped.
- [x] Implement; `pnpm check`. (`physics-3d-events.test.ts` against Rapier; `physics-world.test.ts` with a fake adapter that reports pairs out of order, because real Rapier happened to report them in sid order and a mutation dropping `a < b` survived the Rapier-only tests.) Mutations removing the sort, `a < b`, the drop and the sensor flag each fail a test.

### 11. 3D physics bytes and restore (spec §3.2)
- [x] Failing tests: snapshot → restore into a fresh sim → 100 more ticks equal the uninterrupted run (hash and events); bad version, unsorted rows, bad flags, unknown handle, trailing bytes → `SnapshotFormatError` with the sim unchanged; a dead-sid row is accepted and removed at the next tick.
- [x] Implement; `pnpm check`. (`physics-3d-snapshot.test.ts` on the mixed scene in `testing/scene-3d.ts`, which despawns on tick 149 so the tick-150 snapshot carries a dead-sid row.) The unknown-handle test failed first for a real reason: Rapier resolved the corrupted handle to a live body, so the table check now compares exact handle bits with the world's own handle lists (spec §3.2 updated).

### 12. 2D
- [x] Mirror tasks 8–11 for 2D (failing first) on the shared `physics-world.ts`.
- [x] Implement; `pnpm check`. (`physics-2d.test.ts`, `physics-2d-snapshot.test.ts`, the 2D lazy-load case; tests written and seen failing on the missing `./2d` before `rapier-2d.ts` existed. Mutations of teleport, kinematic target, linear and angular velocity, collider rebuild, lone-collider move, write-back equality and validation each fail a test.)

### 13. Four-engine parity and measurements (spec §7, §8)
- [x] Failing parity tests with placeholder goldens (2D and 3D); commit the Node hashes; run Chromium, WebKit and Firefox; all four must match without edits. (`physics-2d.parity.test.ts`, `physics-3d.parity.test.ts`: 300 ticks of the mixed scene, uninterrupted and with a restore at tick 150. 2D `785b4ebfe6874caa`, 3D `580a47f5c068b59f`; 6/6 browser tests, unchanged after the overhead work below.)
- [x] Bench (`AF_BENCH=1`): ms/tick at 100 and 500 bodies, init time; package sizes raw and gzip -9. Record below and in the PR. (`physics.bench.test.ts`, skipped unless `AF_BENCH=1`. The first run showed 2.47 ms/tick at 500 3D bodies against 0.11 ms for Rapier alone, so before recording: `EntityStore.read` returns Koota's fresh object without a second copy, validation runs only when a body or collider is created or rebuilt, and write-back skips a body that was already asleep at its last write-back. Goldens unchanged.)

### 14. Audit fixes on PR #9 (spec §3.1, §3.2, §3.4, §10.5–§10.7)
- [x] Failing tests first: a failed `createSim` (reserved system name, bad resource init) 20 times, then a new sim; idempotent `dispose`; `SimDisposedError` from every call after it; a rejected restore discards what other plugins prepared (`sim/src/world/lifecycle.test.ts`). Implement: checks before allocation, `PreparedRestore { commit, discard }`, `SimDisposedError`.
- [x] Failing tests first: despawn, `Collider3D` removal, a rebuild and a sensor toggle each end their contacts; ended before started; a contact begun before a snapshot still ends after a restore; balanced pairs over both mixed scenes. Implement the touching set, physics bytes v2 with contacts, ended-first order.
- [x] Failing tests first: swapped colliders between two bodies, and between a body and a lone collider, are refused; bad contacts are refused; `dispose` frees the world and closes the queue once; `discard` frees the prepared world. Implement `checkTable` with the raw parent handle and the adapter's `close`.
- [x] Component edits in both parity scenes; goldens re-recorded once and confirmed in Node, Chromium, WebKit and Firefox.
- [x] `canonicalJson` throws `CanonicalJsonError` on non-plain objects (failing test first).
- [x] Awake-bodies bench and Rapier-alone baseline; the hashing policy in spec §10.5.
- [x] Mutation check of the new code: 17 mutations, each fails at least one test.
- [x] The audit's three small items, each with a failing test first: a rotated 2D lone collider is no longer re-rotated every tick (180 `setRotation` calls in 10 ticks before; Rapier's read-back angle is written into the ECS, 3D too); plugin `config` joins the schema hash and the physics plugins put gravity there (`schema-hash.test.ts`, `physics-3d-snapshot.test.ts`); a rejected `RAPIER.init()` is not cached (`init-retry.test.ts`). Both scenes gained a tilted lone ramp; goldens re-recorded and confirmed in all four engines.
- [x] The audit's re-check at `4d9e6f4`, failing tests first: the physics factories copy and freeze gravity, so mutating the caller's object later changes neither the sim nor its hash, and −0 gravity hashes as 0 (`gravity-config.test.ts`); Rapier returning a null world is a `SnapshotFormatError` (`physics-world.test.ts`); `dispose` disposes every state even when one throws, then rethrows (`lifecycle.test.ts`); the partial-set test now pins Koota keeping the other fields. Spec: 2D angles wrap (§3.4); restored contacts are checked for shape, not against the narrow phase (§3.2, accepted). Goldens unchanged.

## Execution log

| Date | Task | Commits | Notes |
|---|---|---|---|
| 2026-10-11 | 1–2 | `37b0f3c` | Framing tests live in `plugin-state.test.ts`, not `snapshot.test.ts` (deviation noted in task 2). |
| 2026-10-11 | 3–6 | `ec92420`..`91ff025` | Sim golden `2dfe1971eaf6af8f` → `98cc273719c10ef2` (task 6: the schema hash now covers resource, command and event schemas); identical in Node, Chromium, WebKit and Firefox. Fault handling is fail-closed (spec §10.2). |
| 2026-10-11 | 7 | `7288569` | XXH64 on 32-bit halves; the BigInt version kept as `testing/xxhash64-reference.ts` for the equivalence test. |
| 2026-10-11 | 8–12 | `529201d`..`c04ad59` | Deviation: the plugin factories live in `physics-2d.ts` / `physics-3d.ts`, not `*.plugin.ts`, because `pnpm style` requires a `*.plugin.ts` file to export a `definePlugin` result directly and the factories build one per call. |
| 2026-10-11 | 13 | `caec66a` | Node 24, Intel Xeon 2.10 GHz, 4 cores. First `createSim` with `RAPIER.init()`: 3D 105.8 ms, 2D 66.3 ms. Median ms/tick over 300 ticks, 100 / 500 dynamic bodies: 3D 0.252 / 0.998, 2D 0.227 / 0.815 (before the overhead work: 3D 0.606 / 2.470, 2D 0.451 / 1.994; Rapier alone at 500 3D bodies 0.111). `dist/rapier.mjs`, raw / gzip -9: rapier2d-deterministic-compat 3,452,335 / 1,301,241 bytes; rapier3d-deterministic-compat 4,372,012 / 1,659,546 bytes. |
| 2026-10-11 | 14 | `94acfeb`, `d56112f` | Audit fixes. Physics goldens re-recorded (bytes v2 with contacts, paired ended-first events, component edits in both scenes): 3D `87a29a3b4e8e0a36`, 2D `3aae6703654193a0`, identical in Node, Chromium, WebKit and Firefox; the sim golden `98cc273719c10ef2` is unchanged. Bench (Node 24, Intel Xeon 2.10 GHz, 4 cores), median ms/tick over 300 ticks: resting 3D 0.218 / 0.911 and 2D 0.325 / 0.880 at 100 / 500 bodies; awake (zero gravity, bouncing in a closed box, every body still moving at the end) 3D 0.617 / 3.189 and 2D 0.412 / 2.146; Rapier alone on the awake 3D scene at 500 bodies 0.942. `sim.hash()` at 500 awake bodies: 3D 5.30 ms, 2D 3.79 ms, so hashing is on demand or sampled (spec §10.5). Deviation: a JS-side cache to skip Rapier reads in sync-in measured no gain (2.68–3.07 vs 2.82–3.02 ms) and was dropped; `EntityRef.set` writing only the given fields stayed. |
| 2026-10-11 | 14 | `5700245`, `708a84c` | The audit's three small items. Physics goldens re-recorded once more (gravity in the schema hash, a tilted lone ramp in each scene): 3D `5ab771a640ac4b78`, 2D `46042079c99bfdf1`, identical in Node, Chromium, WebKit and Firefox; the sim golden is unchanged. `sim.hash()` on the audit's 10,000-entity scene (two components, 203 KB snapshot), warmed median of 25: 5.18 ms (`snapshot()` 6.37 ms); the audit's 20 ms was a cold first call. |
| 2026-10-11 | 14 | `1a38425` | The audit's re-check at `4d9e6f4`: gravity copied and frozen in both factories (−0 becomes 0), a null Rapier world refused as a format error, `dispose` survives a throwing state, the partial-set behaviour pinned. Ruling: restored contacts stay checked for shape only, and gravities equal only in f32 stay distinct schemas (spec §3.2, §10.8). Goldens unchanged; `pnpm check` green (sim 184, physics 68 + 1 skipped); parity sim 165/165, physics 6/6 in Chromium, WebKit and Firefox. |
