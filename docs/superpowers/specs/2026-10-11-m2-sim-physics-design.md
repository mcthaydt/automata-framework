# M2.1 Physics plugins (lane **sim**): design

- **Status:** drafted 2026-10-11, revised the same day for PR #4 at `e34203a` (physics is its own package; the sim gets only a plugin-state hook, plus the audit's sim-core determinism fixes). Awaiting review. Stands in for the physics part of M2.0.
- **Task:** M2.1 in `docs/02-master-delivery-plan.md`; lane **sim** in `docs/04-how-we-build.md` (Lanes, 2026-10-11).
- **Owns:** new `packages/physics/` (`@mcthaydt/automata-physics`); in `packages/sim/`, the plugin-state hook (§3.1) and the determinism fixes (§10); in `tooling/check-boundaries`, only `packages/physics/src` in the source-roots list (the list itself and the checker hardening come from PR #4) and the import entries physics needs.
- **Builds against:** the [M1 shared contracts](2026-10-11-m1-shared-contracts-design.md) §2: an extension's `sim` field holds `definePlugin` results, and any package with sim plugins runs `check-boundaries` on its sim sources. `defineExtension` itself arrives with the runtime lane (M1.5); until then `packages/physics` exports the plugins, and a `physics.extension.ts` wrapping them is added when `defineExtension` exists (§9).
- **Builds from:**
  - A0+A1 spec `docs/superpowers/specs/2026-10-01-a0-a1-spikes-foundation-design.md` §4.3 (phases), §4.5 (physics plugins), §4.6 (snapshot section 6), §11 and §12.
  - Spike S2, `docs/spikes/s2-rapier.md`: the deterministic-compat 0.21 builds are bit-identical in Node, Chromium, WebKit and Firefox, `takeSnapshot()` bytes are canonical and round-trip, and they load under Ruken's CSP.
  - The Last Light (`mcthaydt/PixiJS3D_Experiment_001` at `832296e`), `src/game/simulation.ts` lines 100–190: one `RAPIER.init()` per process; a world with `timestep = STEP`; fixed cuboid colliders with no body (floor, walls, doors); a door's collider removed and re-created as the nav state changes; a kinematic-position capsule for the player moved with `setNextKinematicTranslation`, then `physics.step()`, then the body translation written back into the ECS pose. That is the shape of sync-in → step → sync-out here. The Last Light uses the ordinary `rapier3d-compat` build and FloorFifty uses Planck, so neither game proves the deterministic build; the four-engine parity tests (§7) are this task's own proof, and FloorFifty keeps Planck.
  - The A1a sim core: `packages/sim/src/world/sim.ts`, `world/snapshot.ts`, `define/definitions.ts`.

## 1. Goal and boundaries

A game adds `physics2d()` or `physics3d()` to `createSim({ plugins })` and gets:

- Rapier bodies and colliders that follow ECS components, created, changed and removed by the plugin's systems, with no Rapier calls in game code;
- transforms and velocities written back to the ECS every tick, so the render delta carries moved bodies;
- `collision-started` / `collision-ended` events in a deterministic order;
- the Rapier world inside `sim.snapshot()` / `restore()` / `hash()` (section 6), so a mid-run restore continues bit-identically;
- identical hashes in Node, Chromium, WebKit and Firefox.

**Deliverables:** `@mcthaydt/automata-physics` with `./2d` and `./3d` entry points; the plugin-state hook in the sim core (§3.1); snapshot section 6; Node unit tests; parity tests in the three browsers; measured wasm size and ms/tick (§8); the sim-core fixes in §10; `check-boundaries` over `packages/sim/src` and `packages/physics/src`.

**Not in this task:** §9.

## 2. Ownership

| State | Owner | Writers |
|---|---|---|
| ECS components `RigidBody*`, `Collider*`, `Transform*` | the sim's entity store (component data) | Game systems and `sim.spawn` write intent; `sync-out` writes results |
| Rapier `World` (bodies, colliders, contacts, solver state) | the physics plugin's per-sim state | Only `sync-in` and `step` |
| sid ↔ Rapier handle table | the physics plugin's per-sim state | Only `sync-in` (and restore) |
| Section 6 framing | `packages/sim` `world/snapshot.ts` | `sim.snapshot()` / `sim.restore()` |
| Section 6 physics bytes | `packages/physics` | the plugin state's `snapshot` / `prepareRestore` |

Presentation never reads Rapier. It reads `Transform2D` / `Transform3D` rows from the render delta, as for any component.

## 3. Contracts

### 3.1 Sim core: plugin state (additive)

```ts
/** Engine state a plugin keeps outside the ECS (a Rapier world). One per sim. */
export interface PluginState {
  /** Bytes for snapshot section 6. Must be canonical: the same state gives the same bytes in every engine. */
  snapshot(): Uint8Array
  /** Validates and parses without touching live state; returns the commit. Throwing leaves the sim unchanged. */
  prepareRestore(bytes: Uint8Array): () => void
  dispose(): void
}
export interface PluginStateSetup { readonly dt: number }

definePlugin({ name, state: async (setup: PluginStateSetup) => PluginState, systems })
// SimContext gains: readonly pluginState: unknown   (the owning plugin's state; undefined for other systems)
```

- **Per-sim instances.** A `PluginDef` is shared by many sims, so its systems cannot close over one Rapier world. `createSim` calls `state(setup)` once per sim and gives the result to that plugin's systems as `ctx.pluginState`.
- **Order and failure.** States are awaited in canonical plugin order. If one rejects, the states already created are disposed and `createSim` rejects with that error.
- **Restore is two-phase.** `restore` decodes and validates everything, calls every `prepareRestore`, and only if all succeed swaps the entity store and calls each commit. One bad plugin row leaves every plugin and the ECS unchanged.
- **dispose** disposes the entity store, then every state.
- **Schema hash** gains `stateful: [plugin names]` only when a stateful plugin exists, so a snapshot from a sim with physics never restores into one without it, and every snapshot without stateful plugins keeps its hash.

### 3.2 Snapshot section 6

Written only when at least one plugin has state; absent otherwise.

```
Section 6   count u16 (≥ 1) | per stateful plugin, in canonical plugin order:
            name (u16 length + UTF-8) | byteLength u32 | bytes
Physics     version u8 = 1 | rows u32 | per row, ascending sid:
            sid u32 | flags u8 (bit 0 body, bit 1 collider) | body f64 if bit 0 | collider f64 if bit 1
            | worldLength u32 | world.takeSnapshot()
```

- Rapier handles are f64 bit patterns of `(index, generation)` (they print as denormals, e.g. `5e-324`); `DataView.setFloat64` keeps the bits. The flags byte means no NaN is ever written.
- `world.takeSnapshot()` goes in verbatim (S2: canonical, round-trip exact; it includes gravity and the timestep).
- Restore checks: version; rows ascending and unique; flags in range; every handle present in the restored world; no trailing bytes. Any failure is a `SnapshotFormatError`.
- A row whose sid is no longer alive is valid: a snapshot taken after `entities.flush` still holds the body of an entity despawned that tick, and the next `sync-in` removes it as usual.

### 3.3 Components

Ids are namespaced per dimension so 2D and 3D can coexist. All fields are `f32` (Rapier computes in f32, so every value read back is exact) except where noted. Component fields default to zero (A1a); the spawn helpers below give the useful defaults.

**2D** (`@mcthaydt/automata-physics/2d`):

| Component | Id | Fields | Render |
|---|---|---|---|
| `Transform2D` | `transform-2d` | `x, y, rotation` (radians) | yes |
| `RigidBody2D` | `physics2d.rigid-body` | `kind` (u32: 0 dynamic, 1 fixed, 2 kinematic-position, 3 kinematic-velocity), `linearDamping`, `angularDamping`, `vx, vy`, `angvel` | no |
| `Collider2D` | `physics2d.collider` | `shape` (u32: 0 ball, 1 cuboid, 2 capsule), `hx, hy` (ball radius `hx`; cuboid half extents; capsule radius `hx`, half-height `hy`), `sensor` (bool), `groups` (u32, Rapier's packed membership << 16 \| filter), `friction`, `restitution` | no |

**3D** (`@mcthaydt/automata-physics/3d`):

| Component | Id | Fields | Render |
|---|---|---|---|
| `Transform3D` | `transform-3d` | `x, y, z`, `qx, qy, qz, qw` (unit quaternion) | yes |
| `RigidBody3D` | `physics3d.rigid-body` | as 2D with `vx, vy, vz` and `wx, wy, wz` | no |
| `Collider3D` | `physics3d.collider` | `shape`, `hx, hy, hz` (ball radius `hx`; cuboid half extents; capsule radius `hx`, half-height `hy`), `sensor`, `groups`, `friction`, `restitution` | no |

**Spawn helpers** (plain functions returning `SpawnPart`s):

```ts
transform3d({ x, y, z, qx, qy, qz, qw })      // missing position 0, rotation identity
body3d(kind, { linearDamping, angularDamping, vx, … })
collider3d.ball(r, opts) / .cuboid(hx, hy, hz, opts) / .capsule(halfHeight, r, opts)
  // opts: sensor (false), groups (0xffffffff: every group), friction (0.5), restitution (0): Rapier's defaults
```

**What makes a Rapier object:**

- `Transform + RigidBody + Collider` → a body with one attached collider.
- `Transform + Collider` (no `RigidBody`) → a fixed collider with no body (floors, walls, doors).
- `Transform + RigidBody` (no `Collider`) → a body with no collider.
- Anything else → nothing.

Units are metres, seconds and radians. Gravity is a plugin option: `physics2d({ gravity: { x: 0, y: -9.81 } })`, `physics3d({ gravity: { x: 0, y: -9.81, z: 0 } })` (these are the defaults). The timestep is the sim's `dt`.

`Transform2D` / `Transform3D` live in the physics package for now. If render-pixi (M1.7) needs a transform without physics, the component moves to `automata-sim` unchanged (same id and fields, so no schema hash change).

### 3.4 Systems

| System | Phase | Does |
|---|---|---|
| `physics2d.sync-in` / `physics3d.sync-in` | `prePhysics` | Makes Rapier match the ECS (below) |
| `physics2d.step` / `physics3d.step` | `physics` | `world.step(eventQueue)` once |
| `physics2d.sync-out` / `physics3d.sync-out` | `postPhysics` | Writes each body's translation, rotation and linear and angular velocity into `Transform*` and `RigidBody*` |
| `physics2d.events` / `physics3d.events` | `postPhysics`, after `sync-out` | Drains collision events, sorts and emits them |

(The A1a id rule rejects camelCase, so A0+A1's `physics.syncIn` is `physics3d.sync-in`.)

**sync-in keeps no hidden state: Rapier is the record of what was applied.**

1. **Remove.** For each table row in ascending sid order: if the entity is gone, or the set of Rapier objects it qualifies for (body, collider, both) changed, remove its body (which removes an attached collider) or its lone collider, and drop the row.
2. **Create.** For each qualifying entity with no row, in ascending sid order: create the body from `RigidBody*` and `Transform*`, then the collider from `Collider*` with `ActiveEvents.COLLISION_EVENTS`, attached to the body when there is one. Removals before creations, both in sid order, make Rapier's handle reuse deterministic.
3. **Update.** For each remaining row, compare each ECS field with Rapier's current value and apply only what differs:
   - `Transform*` ≠ the body's pose → kinematic-position bodies get `setNextKinematicTranslation` / `Rotation`; other bodies are teleported with `setTranslation` / `setRotation(…, true)`. sync-out wrote Rapier's own f32 values into the ECS, so equality holds unless game code wrote the transform.
   - Velocity fields ≠ the body's velocity → `setLinvel` / `setAngvel`.
   - `kind` or damping changed → `setBodyType` / `setLinearDamping` / `setAngularDamping`.
   - Any `Collider*` field differs from the Rapier collider (shape type and size, sensor, groups, friction, restitution) → remove and re-create that collider.
   - A lone collider's `Transform*` ≠ its pose → `setTranslation` / `setRotation`.

Because a re-created body takes its velocity from the ECS, a remove-and-create keeps the body's motion.

**Events.** After the step, `events` drains `drainCollisionEvents`, maps both collider handles to sids, and emits, sorted by (started before ended, lower sid, higher sid):

```ts
physics3d.collision-started { a: sid, b: sid, sensor: boolean }   // a < b
physics3d.collision-ended   { a: sid, b: sid, sensor: boolean }
```

`sensor` is true when either collider is a sensor. An event whose collider no longer maps to a live row (removed this tick) is dropped. Rapier's drain order is already deterministic in these builds; the sort makes it a contract.

### 3.5 Entry points

```ts
// @mcthaydt/automata-physics/3d  (2D mirrors it with 2D names)
export { physics3d, Transform3D, RigidBody3D, Collider3D, BodyKind, ShapeKind,
         CollisionStarted3D, CollisionEnded3D, transform3d, body3d, collider3d }
```

`physics3d(options?)` returns a `PluginDef` named `physics-3d`. A sim holds at most one plugin per dimension (duplicate names already throw). Game code never imports `@dimforge/*`. The Rapier module is loaded with a dynamic `import()` inside `state()`, so importing the entry point loads no wasm.

## 4. Lifecycle

1. **Import** loads no wasm.
2. **createSim** awaits `state({ dt })`: `await import(rapier)`, `await RAPIER.init()` (cached per module), `new World(gravity)`, `world.timestep = dt`, `new EventQueue(true)`.
3. **spawn** writes only ECS. Rapier objects appear at the next sync-in, so they are created in one deterministic place.
4. **step** runs sync-in → step → sync-out → events in the existing phase order.
5. **snapshot** is taken between steps (the event queue is empty then).
6. **restore**: `prepareRestore` restores into a new world and validates the table; the commit frees the old world and adopts the new world, table and an empty event queue.
7. **dispose** frees the world and the event queue.

## 5. Failure policy

| Case | Behaviour |
|---|---|
| Wasm fails to load or `init()` rejects | `createSim` rejects with that error; states already created are disposed |
| Two physics plugins of one dimension | `createSim` throws (duplicate plugin name) |
| Unknown shape or body kind, size ≤ 0, quaternion with \|q\|² outside 1 ± 1e-3 | sync-in throws an `Error` naming the sid and field; the sim is then faulted (§10.2) |
| Section 6 missing, extra, renamed, truncated, bad version, bad row, unknown handle | `SnapshotFormatError`; sim unchanged |
| Snapshot from a sim with a different plugin set | `SnapshotMismatchError('schemaHash')` |
| Collision event for a collider removed this tick | Dropped (tested) |

## 6. Determinism rules (added to A0+A1 §4.4)

- All Rapier mutation happens in sync-in, in ascending sid order, removals before creations.
- Only the deterministic-compat builds are imported (`check-boundaries` allowlist).
- Rapier values enter the ECS only through f32 fields, and Rapier values are already f32.
- `packages/physics/src` is checked by `check-boundaries` like `packages/sim/src`: no `Math.*` outside the allowlist, no `**`, no key enumeration, imports only from Rapier, `koota`, `zod`, relative paths and `@mcthaydt/automata-sim` (its `.`, `./math` and `./hash` entry points).

## 7. Test allocation

| Layer | Where | What |
|---|---|---|
| Unit (Node) | `packages/physics/src/*.test.ts` | Each sync-in case (create, remove, teleport, kinematic, velocity, kind and damping, collider rebuild, lone collider), sync-out, event order and payloads, section 6 bytes and every §5 row, restore continuing identically, lazy loading |
| Sim core (Node) | `packages/sim/src/world/plugin-state.test.ts` | The hook: per-sim instances, order, failure cleanup, two-phase restore, framing errors, dispose, schema hash, no section 6 without state |
| Parity | `packages/physics/src/physics-2d.parity.test.ts`, `physics-3d.parity.test.ts` | A mixed scene (balls, cuboids, a capsule, a kinematic body, a sensor, lone colliders, despawns and spawns mid-run) for 300 ticks, with and without a restore at tick 150; the sim hash and an event-stream hash match one committed golden in Node, Chromium, WebKit and Firefox |
| Measurement | `packages/physics/src/physics.bench.test.ts` (skipped unless `AF_BENCH=1`; not a gate) | ms/tick at 100 and 500 bodies, init time |

The browser project lists both Rapier packages in `optimizeDeps.include` (A0 §11).

## 8. Measurements to record

From the real build, never estimated: each Rapier package's JS (base64 wasm) size raw and gzip -9; median ms/tick at 100 and 500 dynamic bodies in Node 24 on the named machine; `RAPIER.init()` time. They go in the PR and the plan's execution log; the integration owner moves them into the numbered docs.

## 9. Out of scope

- Joints, the character controller (The Last Light's `createCharacterController`), ray and shape casts, contact-force events, gravity scale, more than one collider per entity, heightfields, meshes and convex hulls. Each is additive later; more than one collider per entity bumps the physics bytes version.
- `physics.extension.ts` (`defineExtension`), once the runtime lane lands it.
- The non-compat build with a separate `.wasm` (S2 follow-up), interpolation (runtime), and the blank-game example (integration).

## 10. Sim-core determinism fixes (audit, 2026-10-11)

The audit thread reproduced these in the merged A1a core. Each gets a failing test first.

1. **−0 in resources.** `canonicalJson` writes −0 as `0`, so a restored resource holding −0 hashes the same but diverges later. Fix: write `-0` (`JSON.parse('-0')` is −0, so it round-trips).
2. **A throwing system leaves a half-updated sim.** Fix: fail closed. If a system throws during `step`, the sim is faulted: `step`, `snapshot` and `hash` throw `SimFaultedError` (with the system name, tick and cause) until a successful `restore`. Rolling back each tick would need a snapshot per tick, which costs more than the fault it hides.
3. **Koota's 16-world limit.** `restore` built a second Koota world before freeing the first, so with 16 sims alive it threw Koota's plain `Error`. Fix: validate every row before touching the store, then free the old world and rebuild in its slot, so restore never needs a second world. `createSim` beyond the limit throws `SimCapacityError`.
4. **Schema hash misses resource, command and event schemas.** Fix: hash each schema's JSON Schema (`z.toJSONSchema`, canonical JSON) alongside its id, and on restore require each resource's parsed value to re-encode to the exact JSON stored, so a field the current schema drops is a `SnapshotFormatError`, not silent loss. This changes the existing golden once, with the reason recorded.
5. **Hash cost.** `xxhash64` uses BigInt arithmetic per 8-byte lane. Fix: compute with 32-bit halves (`Math.imul`), same output, checked against the existing XXH64 vectors and the goldens. Per-tick hashing stays the caller's choice; the sim never hashes on its own.

## 11. Exit criteria

1. `pnpm check` passes on Node 24, with `check-boundaries` over `packages/sim/src` and `packages/physics/src`.
2. Physics parity passes in Node, Chromium, WebKit and Firefox with one committed hash per dimension, with and without a mid-run restore.
3. Every §5 row and each §10 fix has a test that fails without the change.
4. Importing either entry point loads no Rapier until `createSim` (tested).
5. Wasm size and ms/tick are recorded from measurement.
6. Review in the M2.1 PR; the integration owner reconciles §3.1, §3.2 and §10 into the M2.0 spec.

## 12. Open questions for review

- **Q1:** `Transform2D` / `Transform3D` start in the physics package. Recommended: accept; move them to the sim when render-pixi needs them, without a schema change.
- **Q2:** velocity fields sit on `RigidBody*` (render: false) rather than a separate component. Recommended: accept; one component per body keeps sync-in to one query.
- **Q3 (§10.2):** fail closed rather than roll back a tick. Recommended: accept.
