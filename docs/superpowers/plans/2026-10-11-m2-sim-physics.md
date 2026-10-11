# M2.1 Physics plugins: TDD plan

- **Spec:** `docs/superpowers/specs/2026-10-11-m2-sim-physics-design.md` ("spec").
- **Lane:** sim. Touches `packages/sim/`, new `packages/physics/`, the physics row of `tooling/check-boundaries`' source roots and import allowlist, rows for its own pins in `docs/versions.md` (once the ship lane creates it), and this plan.
- **Progress:** 6 / 13 tasks.
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
| `packages/physics/src/physics-2d.plugin.ts`, `physics-3d.plugin.ts` | `physics2d()` / `physics3d()` |
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

### 7. Faster XXH64 (spec §10.5)
- [ ] Failing test: hashing 1 MB takes under a generous bound relative to the BigInt version (measured ratio, not wall clock): the 32-bit version must agree with the BigInt reference on random inputs of every length 0..300 and on the existing vectors. Benchmark before and after recorded.
- [ ] Implement; `pnpm check`; browser parity.

### 8. Physics package and 3D shell (spec §3.3, §3.5, §4)
- [ ] Create `packages/physics` (deps: workspace `@mcthaydt/automata-sim`, Rapier pins, zod; the sim's dev deps) and the check-boundaries root and import entries.
- [ ] Failing tests: importing `./3d` loads no Rapier until `createSim`; `physics3d()` has the four systems in the right phases; spawn helpers give spec §3.3 defaults.
- [ ] Implement; `pnpm check`.

### 9. 3D create, step, write back, update, remove (spec §3.4)
- [ ] Failing tests, one per behaviour: a ball falls onto a lone cuboid collider and rests; body without collider; despawn removes; losing `Collider3D` recreates as body-only; teleport; kinematic-position follows its transform; velocity write; kind and damping; collider change rebuilds; lone collider moves; validation errors name sid and field.
- [ ] Implement; `pnpm check`.

### 10. 3D events (spec §3.4)
- [ ] Failing tests: started events sorted with `a < b`; sensor flag; ended on separation; an event for a collider removed this tick is dropped.
- [ ] Implement; `pnpm check`.

### 11. 3D physics bytes and restore (spec §3.2)
- [ ] Failing tests: snapshot → restore into a fresh sim → 100 more ticks equal the uninterrupted run (hash and events); bad version, unsorted rows, bad flags, unknown handle, trailing bytes → `SnapshotFormatError` with the sim unchanged; a dead-sid row is accepted and removed at the next tick.
- [ ] Implement; `pnpm check`.

### 12. 2D
- [ ] Mirror tasks 8–11 for 2D (failing first) on the shared `physics-world.ts`.
- [ ] Implement; `pnpm check`.

### 13. Four-engine parity and measurements (spec §7, §8)
- [ ] Failing parity tests with placeholder goldens (2D and 3D); commit the Node hashes; run Chromium, WebKit and Firefox; all four must match without edits.
- [ ] Bench (`AF_BENCH=1`): ms/tick at 100 and 500 bodies, init time; package sizes raw and gzip -9. Record below and in the PR.

## Execution log

| Date | Task | Commits | Notes |
|---|---|---|---|
| 2026-10-11 | 1–2 | `358892d` | Framing tests live in `plugin-state.test.ts`, not `snapshot.test.ts` (deviation noted in task 2). |
| 2026-10-11 | 3–6 | this and the three commits before it | Sim golden `2dfe1971eaf6af8f` → `98cc273719c10ef2` (task 6: the schema hash now covers resource, command and event schemas); identical in Node, Chromium, WebKit and Firefox. Fault handling is fail-closed (spec §10.2). |
