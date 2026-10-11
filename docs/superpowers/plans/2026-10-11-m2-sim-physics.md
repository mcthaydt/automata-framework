# M2.1 Physics plugins: TDD plan

- **Spec:** `docs/superpowers/specs/2026-10-11-m2-sim-physics-design.md` (cited below as "spec").
- **Lane:** sim. Touches only `packages/sim/` and this plan.
- **Progress:** 3 / 11 tasks.
- **Local CI (every task ends with these green):** Node 24, `pnpm check`; for tasks that touch parity, `pnpm --filter @mcthaydt/automata-sim exec vitest run --project browsers` (Chromium, WebKit, Firefox, Playwright 1.63 browsers).

## Interfaces

- **Consumed:** `definePlugin`, `defineSystem`, `defineComponent`, `defineEvent`, `createSim`, `EntityStore`, `encodeSnapshot` / `decodeSnapshot` (A1a); `@dimforge/rapier2d-deterministic-compat@0.21.0`, `@dimforge/rapier3d-deterministic-compat@0.21.0`.
- **Produced:** `PluginDef.state`, `PluginState`, `SimContext.pluginState` (spec §3.1); snapshot section 6 (spec §3.2); `./physics-2d` and `./physics-3d` exports (spec §3.5).

## Files

| File | Change |
|---|---|
| `packages/sim/package.json` | Rapier deps; `./physics-2d`, `./physics-3d` exports |
| `packages/sim/vitest.config.ts` | Rapier in `optimizeDeps.include` |
| `packages/sim/src/define/definitions.ts` | `state` on `definePlugin` / `PluginDef`; `PluginState` type |
| `packages/sim/src/define/context.ts` | `pluginState` on `SimContext` |
| `packages/sim/src/world/sim.ts` | await states, per-plugin context, schema hash, section 6 in snapshot / two-phase restore, dispose |
| `packages/sim/src/world/snapshot.ts` | section 6 framing (`plugins` on `SnapshotData`) |
| `packages/sim/src/physics/physics-world.ts` | dimension-neutral sync-in / sync-out / events / table encode over a small adapter |
| `packages/sim/src/physics/rapier-2d.ts`, `rapier-3d.ts` | the adapters (the only files that call Rapier) |
| `packages/sim/src/physics/physics-2d.component.ts`, `physics-3d.component.ts` | components |
| `packages/sim/src/physics/physics-2d.event.ts`, `physics-3d.event.ts` | events |
| `packages/sim/src/physics/physics-2d.plugin.ts`, `physics-3d.plugin.ts` | `physics2d()` / `physics3d()` |
| `packages/sim/src/physics-2d.ts`, `physics-3d.ts` | subpath entry points |
| Tests | `world/plugin-state.test.ts`, `world/snapshot.test.ts` (extended), `physics/physics-3d.test.ts`, `physics/physics-2d.test.ts`, `physics/physics-snapshot.test.ts`, `physics/physics-2d.parity.test.ts`, `physics/physics-3d.parity.test.ts`, `physics/physics.bench.test.ts` |

## Tasks

### 1. Dependencies and wiring
- [x] Add both Rapier packages (exact `0.21.0`) to `packages/sim/package.json` dependencies; add them to `optimizeDeps.include`. Verify: `pnpm install`, `pnpm check` green, browser project green.

### 2. Plugin state hook (spec §3.1)
- [x] Failing test `world/plugin-state.test.ts`: a plugin with `state` gets one fresh state per `createSim` (two sims → two states), its systems see it as `ctx.pluginState`, another plugin's systems see `undefined`. Expected failure: `state` ignored, `pluginState` undefined.
- [x] Failing test: `state` setups are awaited in canonical plugin order and receive `{ dt }`.
- [x] Failing test: `sim.dispose()` calls `dispose` on every state.
- [x] Failing test: a sim without stateful plugins keeps the same schema hash and snapshot bytes as before (the existing golden `2dfe1971eaf6af8f` stays); a stateful and a stateless plugin with the same name give different schema hashes.
- [x] Implement minimal; `pnpm check`.

### 3. Snapshot section 6 framing and two-phase restore (spec §3.2, §4.6)
- [x] Failing tests for the framing: round-trip with plugin rows; no section 6 when there are none; truncated, renamed row, trailing byte, empty section, a section on a stateless sim → `SnapshotFormatError`. (Done in `world/plugin-state.test.ts` through `createSim`, not `world/snapshot.test.ts`: the framing is only reachable with matching plugins.)
- [x] Failing tests in `plugin-state.test.ts`: `restore` passes each plugin its bytes; a throwing `prepareRestore` leaves entities, resources, rng and tick unchanged and commits no other plugin; success commits all.
- [x] Implement; `pnpm check`.

### 4. Physics 3D: components, plugin shell, lazy load (spec §3.3, §3.5, §4.1–2)
- [ ] Failing test: importing `./physics-3d` does not import Rapier (vitest module mock records the dynamic import only at `createSim`).
- [ ] Failing test: `physics3d()` returns plugin `physics-3d` with the four systems in the right phases; `createSim` with it resolves.
- [ ] Implement components, events, plugin, adapter skeleton; `pnpm check`.

### 5. Create, step, write back (spec §3.4 rules 1, syncOut)
- [ ] Failing test: a dynamic ball above a fixed cuboid collider falls (y decreases each tick, `vy` < 0) and comes to rest above it; render delta `changed` carries `transform-3d`.
- [ ] Failing test: a body with no collider and a collider with no body are both created.
- [ ] Implement; `pnpm check`.

### 6. Removal and diffs (spec §3.4 rules 2–4)
- [ ] Failing tests, one each: despawn removes the body (no further contacts, table row gone); removing `Collider3D` removes only the collider; writing `Transform3D` teleports a dynamic body; a kinematic-position body follows its transform with the velocity Rapier derives; writing `vx` sets the velocity; changing `kind`, damping or gravity scale applies; changing collider size rebuilds the collider; moving a fixed collider moves it.
- [ ] Failing tests for spec §5 validation: bad shape, zero size, non-unit quaternion, kind out of range → `Error` naming sid and field.
- [ ] Implement; `pnpm check`.

### 7. Events (spec §3.4 events)
- [ ] Failing test: three balls dropped onto the floor emit `physics3d.collision-started` with `a < b`, sorted by kind then sids; a sensor reports `sensor: true`; separation emits `collision-ended`; an event for a collider removed this tick is dropped.
- [ ] Implement; `pnpm check`.

### 8. Physics bytes and restore (spec §3.2, §4.5–6)
- [ ] Failing tests `physics/physics-snapshot.test.ts`: snapshot → restore into a fresh sim → continue 100 ticks equals the uninterrupted run (hash and event stream); restoring twice gives the same bytes; bad version, unsorted rows, dead sid, missing handle → `SnapshotFormatError` with the sim unchanged.
- [ ] Check the NaN open point (spec §3.2): if `body = NaN` is not one bit pattern across engines, switch to a flag byte.
- [ ] Implement; `pnpm check`.

### 9. Physics 2D
- [ ] Mirror tasks 4–8 for 2D in `physics/physics-2d.test.ts` (failing first), using the shared `physics-world.ts` with the 2D adapter.
- [ ] Implement; `pnpm check`.

### 10. Four-engine parity (spec §7)
- [ ] Failing parity tests (`physics-2d.parity.test.ts`, `physics-3d.parity.test.ts`) with placeholder goldens: 300 ticks of the mixed scene, with and without restore at 150, hash of the sim and of the event stream. Expected failure: placeholder mismatch.
- [ ] Commit the Node hash, then run Chromium, WebKit and Firefox; all four must match without edits. A mismatch is investigated, never rebaselined per engine.

### 11. Measurements (spec §8)
- [ ] Bench test prints median ms/tick at 100 and 500 bodies (2D and 3D) and init time; record results plus measured package sizes (raw and gzip -9) in the execution log and the PR.

## Execution log

(empty)
