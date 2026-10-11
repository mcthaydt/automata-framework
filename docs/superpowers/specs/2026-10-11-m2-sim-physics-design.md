# M2.1 Physics plugins (lane **sim**): design

- **Status:** drafted 2026-10-11, awaiting review. Stands in for the physics part of M2.0 (master plan).
- **Task:** M2.1 in `docs/02-master-delivery-plan.md`; lane **sim** in `docs/04-how-we-build.md` (Lanes, 2026-10-11).
- **Owns:** `packages/sim/` (except the `./hash` subpath the content lane adds). The Rapier entries in `tooling/check-boundaries`' import allowlist already exist (`@dimforge/rapier2d-deterministic-compat`, `@dimforge/rapier3d-deterministic-compat`), so this lane changes nothing outside `packages/sim/`.
- **Builds from:**
  - A0+A1 spec `docs/superpowers/specs/2026-10-01-a0-a1-spikes-foundation-design.md` §4.3 (phases), §4.5 (physics plugins), §4.6 (snapshot section 6), §11 (spike outcomes) and §12 (A1a notes).
  - Spike S2, `docs/spikes/s2-rapier.md`: the deterministic-compat 0.21 builds are bit-identical in Node, Chromium, WebKit and Firefox, `takeSnapshot()` bytes are canonical and round-trip, and they load under Ruken's CSP.
  - The Last Light (`mcthaydt/PixiJS3D_Experiment_001` at `832296e`), `src/game/simulation.ts` lines 100–190: one `RAPIER.init()` per process; a world with `timestep = STEP`; fixed cuboid colliders with no body (floor, walls, doors); a door's collider removed and re-created as the nav state changes; a kinematic-position capsule for the player moved with `setNextKinematicTranslation`, then `physics.step()`, then the body translation written back into the ECS pose. That is the exact shape of syncIn → step → syncOut here. The character controller it uses (`createCharacterController`) is not in this task (§9).
  - The A1a sim core as merged: `packages/sim/src/world/sim.ts`, `world/snapshot.ts`, `define/definitions.ts`.

## 1. Goal and boundaries

A game adds `physics2d()` or `physics3d()` to `createSim({ plugins })` and gets:

- Rapier bodies and colliders that follow ECS components, created, changed and removed by the plugin's systems with no Rapier calls in game code;
- transforms and velocities written back to the ECS every tick, so the render delta carries moved bodies;
- `collision-started` / `collision-ended` events in a deterministic order;
- the Rapier world inside `sim.snapshot()` / `restore()` / `hash()` (section 6), so a mid-run restore continues bit-identically;
- identical hashes in Node, Chromium, WebKit and Firefox.

**Deliverables:** the two subpath exports `@mcthaydt/automata-sim/physics-2d` and `/physics-3d`; an additive plugin "world state" hook in the sim core (§3.1); snapshot section 6; unit tests in Node; parity tests in the three browsers; a measurement note with wasm size and ms/tick (§8).

**Not in this task:** see §9.

## 2. Ownership

| State | Owner | Writers |
|---|---|---|
| ECS components `RigidBody*`, `Collider*`, `Transform*` | `automata-sim` (component data) | Game systems and `sim.spawn` write intent; `physics.syncOut` writes results |
| Rapier `World` (bodies, colliders, contacts, solver state) | The physics plugin instance, inside one sim | Only `physics.syncIn` and `physics.step` |
| sid ↔ Rapier handle table | The physics plugin instance | Only `physics.syncIn` (and `restore`) |
| Section 6 bytes | The physics plugin (encode/decode) and `snapshot.ts` (framing) | `sim.snapshot()` / `sim.restore()` |

Presentation never reads Rapier. It reads `Transform2D` / `Transform3D` rows from the render delta, as for any component. Host and runtime have no part in this task.

## 3. Contracts

### 3.1 Sim core: plugin world state (additive)

`definePlugin` gains one optional field. Existing plugins and the existing parity golden (`2dfe1971eaf6af8f`) are unchanged.

```ts
/** Engine state a plugin keeps outside the ECS (Rapier's world). Created per sim, inside createSim. */
export interface PluginState {
  /** Raw bytes for snapshot section 6. Must be canonical: same state, same bytes, in every engine. */
  snapshot(): Uint8Array
  /** Validates and parses first; throws (leaving the old state) or returns a commit function. */
  prepareRestore(bytes: Uint8Array): () => void
  dispose(): void
}

definePlugin({
  name: 'physics-3d',
  // Called once per createSim, awaited, in canonical plugin order. Receives what the plugin may know.
  state: async (setup: { dt: number }) => PluginState,
  systems: [...],   // systems close over the state through a per-sim handle (below)
})
```

- **Per-sim instances.** A `PluginDef` is a value that many sims share, so a plugin's systems cannot close over one Rapier world. `createSim` calls `state(setup)` once and passes the result to the plugin's systems as `ctx.pluginState` (typed `unknown`; each physics system casts it to its own world type in one place). Only the plugin's own systems see its state.
- **Async.** `createSim` is already async. It awaits each `state()` in canonical plugin order, so the wasm is loaded once (the module caches `init()`) and only when a physics plugin is used.
- **Restore is two-phase** so a bad snapshot leaves the sim untouched (A1a rule): `restore` decodes everything, calls every `prepareRestore`, and only if all succeed swaps the entity store and calls each commit.
- **dispose** frees the Rapier world (`world.free()`); `sim.dispose()` calls it.

The schema hash gains each plugin's state presence (`stateful: true`), so a snapshot from a sim without physics never restores into one with physics. This changes no existing hash: plugins without `state` add nothing to the hashed description.

### 3.2 Snapshot section 6 (physics)

Written only when at least one plugin has `state`; absent otherwise (keeps every existing snapshot byte-identical).

```
Section 6   count u16 | per stateful plugin, in canonical plugin order: name (u16 length + UTF-8) | byteLength u32 | bytes
Physics plugin bytes   version u8 = 1 | rows u32 | per row (ascending sid): sid u32 | body f64 | collider f64 | worldLength u32 | world.takeSnapshot()
```

- Rapier handles are f64 bit patterns of `(index, generation)` (they print as denormals, e.g. `5e-324`); `DataView.setFloat64` keeps the bits, so they round-trip exactly. A collider with no body writes `body = NaN`. **Open check:** `setFloat64(NaN)` must write one canonical bit pattern in every engine; if the parity test shows otherwise, write a flag byte instead.
- `world.takeSnapshot()` bytes go in verbatim (S2: canonical, round-trip exact, include gravity and timestep).
- Restore checks: version, the plugin list matches, rows ascending and unique, every sid alive in the restored entity store with the plugin's components, every handle present in the restored world. Any failure is a `SnapshotFormatError`.

### 3.3 Components

Ids are namespaced per dimension so 2D and 3D can coexist in one schema hash. All fields default as listed. `f32` everywhere because Rapier computes in f32, so every value read back is exactly representable.

**2D** (`physics-2d`):

| Component | Id | Fields | Render |
|---|---|---|---|
| `Transform2D` | `transform-2d` | `x, y, rotation` (f32; radians) | yes |
| `RigidBody2D` | `physics2d.rigid-body` | `kind` (u32: 0 dynamic, 1 fixed, 2 kinematic-position, 3 kinematic-velocity), `linearDamping`, `angularDamping`, `vx, vy`, `angvel` (f32), `gravityScale` (f32, default 1) | no |
| `Collider2D` | `physics2d.collider` | `shape` (u32: 0 ball, 1 cuboid, 2 capsule), `hx, hy` (f32: ball radius = `hx`; cuboid half extents; capsule half-height `hy`, radius `hx`), `sensor` (bool), `groups` (u32, Rapier packed membership<<16 \| filter, default `0xffffffff`), `friction` (f32, default 0.5), `restitution` (f32, default 0) | no |

**3D** (`physics-3d`):

| Component | Id | Fields | Render |
|---|---|---|---|
| `Transform3D` | `transform-3d` | `x, y, z`, `qx, qy, qz, qw` (f32; unit quaternion, default identity) | yes |
| `RigidBody3D` | `physics3d.rigid-body` | as 2D with `vx, vy, vz` and `wx, wy, wz` | no |
| `Collider3D` | `physics3d.collider` | `shape` (0 ball, 1 cuboid, 2 capsule), `hx, hy, hz` (ball radius `hx`; cuboid half extents; capsule half-height `hy`, radius `hx`), `sensor`, `groups`, `friction`, `restitution` | no |

`Transform2D` / `Transform3D` live in the physics subpaths for now. If a later task (render-pixi, M1.7) needs a transform without physics, the component moves to the core export unchanged (same id, same fields, so no schema hash change).

**What makes a Rapier object:**

- `Transform + RigidBody + Collider` → a body with one attached collider.
- `Transform + Collider` (no `RigidBody`) → a fixed collider with no body (floors, walls, doors in The Last Light).
- `Transform + RigidBody` (no `Collider`) → a body with no collider.
- Anything else → nothing.

Units: metres, seconds, radians. Gravity is a plugin option: `physics2d({ gravity: { x: 0, y: -9.81 } })`, `physics3d({ gravity: { x: 0, y: -9.81, z: 0 } })`. The timestep is the sim's `dt`, set once at `state()`.

### 3.4 Systems (phases from A0+A1 §4.3)

| System | Phase | Order | Does |
|---|---|---|---|
| `physics2d.sync-in` / `physics3d.sync-in` | `prePhysics` | — | Diffs ECS against Rapier and applies the difference (below) |
| `physics2d.step` / `physics3d.step` | `physics` | — | `world.step(eventQueue)` once |
| `physics2d.sync-out` / `physics3d.sync-out` | `postPhysics` | — | Writes every body's translation, rotation, linear and angular velocity into `Transform*` and `RigidBody*` |
| `physics2d.events` / `physics3d.events` | `postPhysics` | after `sync-out` | Drains collision events, sorts, emits |

(System ids use `.` and `-` because the A1a id rule rejects `syncIn`; the spec's `physics.syncIn` names map to these.)

**syncIn has no hidden state: Rapier is the record of what was applied.** For each entity in ascending sid order:

1. No handle yet → create the body (from `RigidBody*` and `Transform*`) and the collider (from `Collider*`, `ActiveEvents.COLLISION_EVENTS` always on), record the handles.
2. Has handles but the entity is gone or lost its components → remove the collider and body, drop the row. Removal happens before creation (all removals in ascending sid order, then all creations), so a removed entity's freed Rapier index is reused in a fixed order.
3. Has handles and still qualifies → compare each ECS field with Rapier's current value and apply only what differs:
   - `Transform*` ≠ body position → kinematic-position bodies get `setNextKinematicTranslation/Rotation`; every other kind is teleported with `setTranslation/Rotation(…, true)`. Because syncOut wrote Rapier's own f32 values into the ECS, equality holds unless game code wrote the transform.
   - Velocity fields ≠ body velocity → `setLinvel` / `setAngvel`.
   - `kind`, damping or `gravityScale` changed → the matching Rapier setter.
   - Any `Collider*` field changed → remove and re-create that collider (Rapier cannot reshape in place for every shape).
4. Fixed colliders with no body compare position against `collider.translation()` the same way.

**Events.** After the step, `events` drains `EventQueue.drainCollisionEvents`, maps both collider handles to sids, and emits, sorted by `(started before ended, lower sid, higher sid)`:

```ts
physics3d.collision-started { a: sid, b: sid, sensor: boolean }   // a < b
physics3d.collision-ended   { a: sid, b: sid, sensor: boolean }
```

Rapier's own drain order is deterministic in these builds, but the sort makes the order a contract (and independent of Rapier's internal handle layout, which a restore could in principle change). An event whose collider was removed in the same tick (handle no longer mapped) is dropped.

### 3.5 Public entry points

```ts
// @mcthaydt/automata-sim/physics-2d
export { physics2d, Transform2D, RigidBody2D, Collider2D, BodyKind, ShapeKind, CollisionStarted2D, CollisionEnded2D }
// @mcthaydt/automata-sim/physics-3d
export { physics3d, Transform3D, RigidBody3D, Collider3D, BodyKind, ShapeKind, CollisionStarted3D, CollisionEnded3D }
```

`physics2d(options?)` / `physics3d(options?)` return a `PluginDef` named `physics-2d` / `physics-3d`. Each call returns a new plugin value with the same name, so a sim holds at most one of each (duplicate names already throw in `orderPlugins`). Game code never imports `@dimforge/*`; the Rapier module is loaded with a dynamic `import()` inside `state()`, so the `./physics-*` module itself stays small and the wasm loads only at `createSim`.

## 4. Lifecycle

1. **Import.** Importing `./physics-3d` loads no wasm.
2. **createSim.** Plugins ordered; `state({ dt })` awaited: `await import('@dimforge/rapier3d-deterministic-compat')`, `await RAPIER.init()` (cached per module), `new World(gravity)`, `world.timestep = dt`, `new EventQueue(true)`.
3. **spawn** (setup, outside `step`) only writes ECS. Rapier objects appear at the next `sync-in`, so they are created in one deterministic place whatever the spawn path.
4. **step.** `sync-in` → `step` → `sync-out` → `events`, inside the existing phase order.
5. **snapshot.** Section 6 as §3.2. Calling `snapshot()` between steps is the only supported point (the event queue is empty then).
6. **restore.** Decode → `prepareRestore` (`World.restoreSnapshot` into a new world, validate the table) → swap store → commit (free old world, adopt new one and table, new empty event queue).
7. **dispose.** Frees the world and event queue. A disposed sim's physics state must not be used again; `step` after `dispose` is not supported (as today).

## 5. Failure policy

| Case | Behaviour |
|---|---|
| Wasm fails to load or `init()` rejects | `createSim` rejects with that error; nothing is half-built (no world exists yet) |
| Two physics plugins of the same dimension | `createSim` throws (existing duplicate-plugin rule) |
| Invalid shape code, negative or zero size, non-unit quaternion, `kind` out of range | `sync-in` throws `Error` naming the sid and field. A throw inside `step` is a programming error today (A1a); this keeps that policy rather than inventing recovery |
| Snapshot section 6 missing, extra, wrong plugin list, bad version, bad row | `SnapshotFormatError`; sim unchanged |
| Snapshot from a sim with a different plugin set | `SnapshotMismatchError('schemaHash')` (existing check) |
| A sid in the table no longer alive after restore | `SnapshotFormatError` |
| Collision event for a collider removed this tick | Dropped (documented, tested) |

## 6. Determinism rules (added to A0+A1 §4.4)

- All Rapier mutation happens in `sync-in`, in ascending sid order, removals before creations.
- Only the deterministic-compat builds are imported (the boundary allowlist already restricts this).
- No Rapier value enters the ECS except through `f32` fields, and Rapier values are already f32.
- Physics plugin code lives under `packages/sim/src`, so the boundary checker applies to it: no `Math.*` outside the allowlist (quaternion maths uses multiplication and `Math.sqrt`), no `**`, no `Object.keys`.

## 7. Test allocation

| Layer | Where | What |
|---|---|---|
| Unit (Node) | `packages/sim/src/physics/*.test.ts` | Each syncIn case (create, remove, teleport, kinematic, velocity, collider rebuild, fixed collider), syncOut writes, event order and payloads, snapshot section 6 encode/decode and every failure row of §5, restore continues identically, no section 6 without physics, lazy loading (importing the subpath does not import Rapier) |
| Sim core (Node) | `world/sim.test.ts`, `world/snapshot.test.ts` | The `state` hook: per-sim instances, async ordering, two-phase restore leaves the sim unchanged on a failing `prepareRestore`, dispose, schema hash unchanged for plugins without state |
| Parity | `packages/sim/src/physics/physics-2d.parity.test.ts`, `physics-3d.parity.test.ts` | A scene in the style of S2 (balls, cuboids, a capsule, a kinematic body, a sensor, a fixed collider, despawns mid-run) for 300 ticks, with and without a restore at tick 150, hashing to one committed golden in Node, Chromium, WebKit and Firefox; also hashes the collected event stream |
| Existing goldens | `world/snapshot.parity.test.ts` | Still `2dfe1971eaf6af8f` |
| Measurement | `packages/sim/src/physics/physics.bench.test.ts` (Node, not a gate) | ms/tick at 100 and 500 bodies; printed and recorded in the PR, never asserted against a wall clock |

The browser project needs `@dimforge/rapier2d-deterministic-compat` and `@dimforge/rapier3d-deterministic-compat` in `optimizeDeps.include` (A0 §11).

## 8. Measurements to record (from the real build, not estimated)

- Wasm payload per dimension: the size of each package's compat JS (base64 wasm) raw and gzip -9, measured from `node_modules`.
- ms/tick: median of the bench above in Node 24 on the machine that runs it, with the machine named.
- Init time of `RAPIER.init()` in Node.

These go in the PR body and the plan's execution log; the integration owner moves them into the numbered docs.

## 9. Out of scope

- Joints, character controller (`createCharacterController`, used by The Last Light), ray and shape casts, contact-force events, multiple colliders per entity, heightfields, meshes and convex hulls. Each is additive later (new component or new system) without changing the section 6 format version, except multiple colliders per entity, which would bump the physics bytes version.
- The non-compat build with a separate `.wasm` (S2 follow-up, belongs with render/runtime packaging).
- Interpolation between ticks (runtime, M1.5/M1.7).
- `examples/blank-game` physics usage (integration lane).

## 10. Exit criteria

1. `pnpm check` passes on Node 24 (lint, typecheck, boundaries, style, unit).
2. The physics parity tests pass in Node, Chromium, WebKit and Firefox with one committed hash per dimension, with and without a mid-run restore; the existing sim golden is unchanged.
3. Every §5 failure row has a test that sees the named error.
4. Importing `./physics-2d` or `./physics-3d` does not load Rapier until `createSim` (tested).
5. Wasm size and ms/tick are recorded from measurement (§8).
6. Review of this spec in the M2.1 PR; the integration owner reconciles §3.1 (plugin state hook) and §3.2 (section 6 framing) into the M2.0 spec.

## 11. Open questions for review

- **Q1 (§3.1):** the plugin `state` hook is a small additive change to the sim core's `PluginDef`, not just a new subpath. Recommended: accept; there is no other way for a plugin to own per-sim engine state and join the snapshot.
- **Q2 (§3.3):** `Transform2D` / `Transform3D` start in the physics subpaths. Recommended: accept; move to core when render-pixi needs them, without a schema change.
- **Q3 (§3.3):** velocity fields sit on `RigidBody*` (render: false) rather than in a separate component. Recommended: accept; one component per body keeps sync-in to one query.
