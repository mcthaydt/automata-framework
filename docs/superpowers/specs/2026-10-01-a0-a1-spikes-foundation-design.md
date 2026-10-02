# A0 + A1: Spikes and Foundation

- **Date:** 2026-10-01
- **Status:** A0 complete 2026-10-01; A1 pending Plan 2
- **Parent spec:** [`2026-10-01-automata-framework-overview-design.md`](./2026-10-01-automata-framework-overview-design.md), §12 Part A.

This spec covers two phases:
- **A0** proves the risky library choices with throwaway spikes.
- **A1** builds the repo foundation and the deterministic core that every later phase depends on. The core is `automata-sim`, `automata-content`, and the sim half of `automata-testing`.

Nothing in A0 or A1 renders, takes device input, or touches a host. Those start in A2.

---

## 1. Decisions in this spec

| Topic | Decision |
|---|---|
| Repo and registry | The repo is `SNEKPRTY/automata-framework`. Packages publish privately to GitHub Packages as `@snekprty/automata-<name>`. Game repos authenticate in CI with a read token. |
| Naming | Files carry a **role suffix**: `*.component.ts`, `*.system.ts`, `*.command.ts`, `*.event.ts`, `*.resource.ts`, `*.plugin.ts`, `*.manager.ts`, `*.schema.ts`, `*.migration.ts`, `*.test.ts`. Folders group by **feature**, not by role. Utilities use plain names (`rng.ts`, `hash.ts`). A style test enforces this. |
| Determinism | **Cross-engine**: results must be bit-exact across V8 (Node, Chrome), JavaScriptCore (Safari, iOS) and SpiderMonkey (Firefox). See §4.4. |
| ECS | Koota, provided spike S1 passes; otherwise Miniplex behind the same facade (§4.1). |
| Physics | Rapier, cross-platform deterministic builds, 2D and 3D, as separate plugins. |

## 2. A0: Spikes

**Process rules:**
- Spike code lives in `spikes/<id>-<name>/`. It does not have to meet the style or TDD rules.
- Each spike ends with a verdict file, `docs/spikes/<id>-<name>.md`, covering the question, the method, measurements, the verdict, and consequences for A1 and later phases.
- The `spikes/` folder is deleted when A0 closes, and that deletion is a single commit. The verdict files stay.

| ID | Question | Pass criteria | Timebox |
|---|---|---|---|
| **S1** | Is Koota's iteration order deterministic, and can its world be snapshotted and restored? | 10k entities with seeded add/remove churn produce the same iteration order in Node, Chromium, WebKit and Firefox. Serializing to bytes, restoring, and stepping on gives the same hash as an uninterrupted run. Record ms per tick at 2k entities with a 4× CPU throttle (an S20-class device). Document what order Koota guarantees and what the facade has to impose with stable-ID sorting. | 2 days |
| **S2** | Do Rapier's deterministic builds hold up across engines and under Ruken's CSP? | The 2D and 3D cross-platform deterministic builds round-trip `takeSnapshot`/`restoreSnapshot` with identical hashes in Node and the three browsers. Both load under `script-src 'self' 'wasm-unsafe-eval'` with no inline script and no `eval`. Record each wasm size, gzipped. | 1 day |
| **S3** | Can Three.js run WebGPU with a WebGL2 fallback and the same post-processing? | `WebGPURenderer` runs once on the WebGPU backend and once forced to WebGL2. A TSL dither pass looks the same on both (pixel diff under a threshold). Record FPS on Chromium's emulated mid-range phone profile. | 1 day |
| **S4** | Does PixiJS 8 work on both WebGPU and WebGL? | The same dither effect as a Pixi filter runs on both backends. Sprite batch stress test: record FPS at 5k sprites. | 0.5 day |
| **S5** | Can we write deterministic math functions? | `sin`, `cos`, `tan`, `atan2`, `exp`, `log`, `pow` and `hypot`, built only from bit-exact operations (`+ - * /`, `Math.sqrt`, `Math.fround`, `Math.floor/ceil/trunc/abs/min/max/sign`, integer operations). Over 1M seeded samples, results are bit-identical across the four engines. Document maximum error compared to `Math.*` and the performance cost. | 1 day |
| **S6** | Can we stub the Ruken SDK against the P01 spec? | A mock host page plus a game-side stub covering: the `hello` retry, `welcome`, the MessagePort transfer, the origin allowlist, `session.ready`, `lifecycle.changed`, `menu.open`, and `saves.set/flush/status`. Contract tests are taken directly from the P01 catalog. The verdict lists every gap or ambiguity found in P01 to send back to Ruken before their contract freeze (F1, 2026-10-16). | 1 day |

**Fallbacks:**
- **S1 fails:** A1 uses Miniplex behind the identical `automata-sim` facade, and the performance budget is re-checked.
- **S2 fails browser parity:** stop and escalate before starting A1, because laws 5 and 6 depend on it.
- **S3 or S4 fail:** they feed into A2 and A4 and do not block A1.
- **S6:** feeds into A2 and does not block A1.

## 3. A1: Repo foundation

### 3.1 Layout

```
automata-framework/
├─ packages/
│  ├─ sim/            @snekprty/automata-sim
│  ├─ content/        @snekprty/automata-content
│  └─ testing/        @snekprty/automata-testing      (sim goldens + replay only in A1)
├─ tooling/
│  ├─ check-boundaries/   import and global ban checker for `sim`
│  └─ check-style/        role-suffix and folder rules
├─ examples/
│  └─ blank-game/     consumes the packages through the workspace, exactly as a game repo would
├─ content/           framework default content (empty in A1)
├─ infra/             (empty in A1; reusable workflows arrive in A3)
├─ docs/
│  ├─ superpowers/{specs,plans}/
│  ├─ spikes/
│  └─ adr/
├─ .github/workflows/ci.yml
├─ .changeset/
├─ AGENTS.md          the rules (CLAUDE.md contains only `@AGENTS.md`)
├─ biome.json, turbo.json, pnpm-workspace.yaml, tsconfig.base.json, lefthook.yml
```

### 3.2 Tooling

| Concern | Choice |
|---|---|
| Runtime | Node 24 LTS (pinned by `.nvmrc` and `engines`) |
| Package manager | pnpm 10 workspaces, with `packageManager` pinned |
| Task runner | Turborepo, with caching for build, typecheck, test, and the checks |
| Language | TypeScript strict, `"type": "module"`, ESM only, `exports` maps, `isolatedDeclarations` |
| Builds | Vite library mode, ESM plus `.d.ts` |
| Lint and format | Biome |
| Tests | Vitest in Node, plus Vitest browser mode with Playwright on Chromium, WebKit and Firefox (golden suites only) |
| Versioning | Changesets, publishing to GitHub Packages |
| Git hooks | lefthook pre-commit: Biome, then tests affected by the change |
| Commits | Conventional Commits. Strict TDD: no production code without a failing test first. |

### 3.3 Enforced checks

- **check-boundaries** is ported from the retired AutomataEngine's `scripts/check-boundaries.ts`. Inside `packages/sim/src` it fails on:
  - DOM or browser globals (`window`, `document`, `navigator`, `requestAnimationFrame`, `fetch`, `WebSocket`, `localStorage`).
  - Time access: `Date`, `performance`, `setTimeout`, `setInterval`, `queueMicrotask`.
  - `Math.random`.
  - Any `Math.*` member outside the bit-exact allowlist from S5.
  - Imports outside the allowlist: Koota or Miniplex, Rapier, Zod, and the package's own modules.
  - Any `Object.keys`/`Object.entries`/`for…in`. The check fails on these outright. Sim code iterates through `sortedKeys()`/`sortedEntries()` from `automata-sim/util`.
- **check-style**: every file in a production `src/` folder must match a role suffix or the plain-utility allowlist. Each role must export the matching factory; for example, a `*.system.ts` file must export a `defineSystem` result.
- **Fixture tests**: each check has at least one fixture that violates each rule, and the tests assert the check rejects it.

### 3.4 CI (GitHub-hosted runner for A1)

Jobs: `install` → (`lint`, `typecheck`, `boundaries`, `style`, `unit`) in parallel → `goldens-node` and `goldens-browsers` → `build` → `publish-prerelease` (on `main` only, through Changesets snapshot releases).

Target: under 10 minutes. The GPU runner and visual goldens arrive in A3.

## 4. `@snekprty/automata-sim`

### 4.1 Public API

```ts
// Definitions. Every definition has a stable string id used by the snapshot, network, and save formats.
export const Health   = defineComponent('health',   { current: 'f32', max: 'f32' })
export const Velocity = defineComponent('velocity', { x: 'f32', y: 'f32', z: 'f32' }, { render: false })
export const Move     = defineCommand('move',  z.object({ x: z.number(), y: z.number() }))
export const Damaged  = defineEvent('damaged', z.object({ target: z.number(), amount: z.number() }))
export const Quests   = defineResource('quests', QuestStateSchema, () => ({ active: [] }))

export const movementSystem = defineSystem({
  name: 'movement',
  phase: 'gameplay',
  after: ['commands.apply'],
  run(ctx) {
    // ctx.tick, ctx.dt (fixed), ctx.rng, ctx.query(...), ctx.commands.of(Move),
    // ctx.emit(Damaged, {...}), ctx.resource(Quests), ctx.spawn(...), ctx.despawn(id), ctx.content
  },
})

export const gamePlugin = definePlugin({
  name: 'my-game',
  components: [Health, Velocity], commands: [Move], events: [Damaged],
  resources: [Quests], systems: [movementSystem],
})

const sim = await createSim({ seed: 42, content, tickHz: 60, plugins: [physics3d(), gamePlugin] })
const out = sim.step(commands)   // StepResult { tick, events: SimEvent[], render: RenderDelta }
const bytes = sim.snapshot()     // Uint8Array
sim.restore(bytes)               // throws SnapshotMismatchError on schema or content hash mismatch
sim.hash()                       // 16-char hex string (xxhash64 of the canonical snapshot)
sim.dispose()
```

**The facade rule:** game code never imports Koota or Miniplex directly. `ctx.query` returns a facade over the ECS, so S1's fallback and any later ECS change stay internal to `automata-sim`.

### 4.2 Field types

| Type | Storage | Notes |
|---|---|---|
| `f32` | Float32 (`Math.fround` on write) | The default for gameplay values |
| `f64` | Float64 | For when the extra precision really matters |
| `i32` / `u32` | Int32 / Uint32 | Counters and bitflags |
| `bool` | Uint8 | |
| `entity` | u32 stable ID (0 = none) | Never stores Koota's internal entity handle |
| `string` | Interned into a string table | Kept in the snapshot's string section. Prefer content IDs. |

There are no arbitrary object or array fields. Collections either become resources (validated by Zod and serialized as canonical JSON) or Koota relations, and the S1 verdict decides how relations get serialized.

### 4.3 Scheduling

- **Phases** run in a fixed order: `input` → `prePhysics` → `physics` → `postPhysics` → `gameplay` → `cleanup`.
- **Within a phase**, systems are sorted topologically by their `before`/`after` constraints, and ties are broken by `name`. A cycle, or an unknown reference, makes `createSim` throw.
- **Plugins** are registered in a canonical order (sorted by plugin name after dependency resolution), so the order in which they are listed never matters.
- **Built-in systems:**
  - `commands.apply` (input phase) makes the current tick's commands available.
  - `entities.flush` (cleanup phase) applies deferred despawns.
  - `render.collect` (cleanup phase, last) builds the `RenderDelta`.

### 4.4 Determinism rules

1. **Stable entity IDs.** IDs are u32 values from a monotonic counter stored in a resource and are never reused within one run. Wherever order affects the result, queries iterate in stable-ID order. S1 decides whether Koota's native order already guarantees this or whether the facade has to sort.
2. **RNG.** The generator is xoshiro128**, which uses only 32-bit integer math. The root state is derived from the seed. Each system gets its own substream, seeded from `hash(rootSeed, systemName)`, so adding a system never shifts another system's random sequence. The full RNG state is part of the snapshot.
3. **Math.**
   - Sim code uses `automata-sim/math` (built from S5) for trigonometric and transcendental functions.
   - The boundary checker bans every other `Math.*` member.
   - `f32` fields are rounded with `Math.fround` on every write, through the field setters.
4. **Commands.**
   - Each command has the shape `{ tick, source: u8, seq: u32, type, payload }`.
   - Payloads are validated with Zod outside the step loop; an invalid command is rejected and logged.
   - Each tick's commands are sorted by `(source, seq)`.
   - Commands are the only input to the sim.
5. **Events are output only.** `ctx.emit` appends to the `StepResult`. Nothing reads events back inside the sim.
6. **Content.** The sim receives compiled content deep-frozen (`ctx.content`). Content maps are iterated with sorted keys, which the content compiler guarantees.
7. **Fixed timestep.** `dt = 1 / tickHz` is a constant. The sim has no notion of wall-clock time; the A2 runtime decides how many steps to run per frame.

### 4.5 Physics plugins

- The plugins are `physics2d()` and `physics3d()`, from the subpath exports `@snekprty/automata-sim/physics-2d` and `/physics-3d`. Each lazy-loads its Rapier wasm, so `createSim` is async.
- Components: `RigidBody` (kind, plus linear and angular damping), `Collider` (shape, size, sensor flag, collision groups), and `Transform2D` / `Transform3D` (render rows).
- Systems:
  - `physics.syncIn` (prePhysics) applies ECS-side changes to Rapier.
  - `physics.step` (physics) steps the world.
  - `physics.syncOut` (postPhysics) writes Rapier transforms back to the ECS.
  - `physics.events` (postPhysics) emits contact and sensor events.
- The Rapier world snapshot bytes are included in the sim snapshot.

### 4.6 Snapshot format v1

```
Header   magic "AUTO" | formatVersion u16 | schemaHash u64 | contentHash u64 | tick u32 | tickHz u16
Section  strings     interned string table (UTF-8, length-prefixed, sorted)
Section  rng         root and per-system substream states
Section  resources   canonical JSON (sorted keys) per resource, in resource-ID order
Section  entities    nextId, live IDs sorted; per component (sorted by component ID): presence bitmap + typed columns
Section  relations   per S1 verdict
Section  physics     per world: Rapier snapshot bytes
```

- **Endianness.** All multi-byte values are little-endian, written through `DataView`.
- **Schema hash.** xxhash64 over the canonical description of every registered definition: IDs, field names and types, phases, and system names.
- **Hash.** `sim.hash()` is xxhash64 over the whole snapshot, implemented in pure TypeScript with no wasm, so it has no dependency issues.
- **Restore failures.** On a mismatch, `restore` throws `SnapshotMismatchError { field, expected, actual }`. Migrating old save formats is A5's job, not the sim's.

### 4.7 Render delta

`StepResult.render` contains three lists:
- `added`: stable ID plus all render-flagged components.
- `changed`: stable ID plus the render-flagged components that changed.
- `removed`: stable IDs.

These are built from change detection: Koota's `Added`/`Changed`/`Removed`, or dirty flags in the facade if S1 rules that out.

Components are render-flagged by default. A component can opt out with `{ render: false }`, as Velocity does in §4.1.

In A1 the delta is only produced and tested. A2 consumes it.

## 5. `@snekprty/automata-content`

- **Schema registration:**

  ```ts
  defineContentSchema('character', CharacterSchema, { folder: 'characters' })
  // Fields that refer to another content item are typed as a reference:
  weapon: contentRef('weapon')
  ```

- **Compile steps:**
  1. Discover `content/<folder>/**/*.toml`. A file's ID is its path relative to `<folder>` without the extension, for example `weapons/sword`.
  2. Parse with smol-toml, keeping source positions.
  3. Validate with Zod 4.
  4. Resolve references. Every `contentRef` must point to an existing item of the right kind.
  5. Canonicalize: sort keys, and sort collections by ID.
  6. Emit the outputs.
- **Outputs:** `content.json`, `content.hash` (xxhash64 of the canonical JSON), and `content.d.ts` (typed accessors, so game code gets autocomplete and type errors).
- **Error reporting.** All errors are collected, not just the first. Each is reported as `file:line:col  <zod path>  <message>`. A compile with any error exits non-zero.
- **Vite plugin.** `automataContent()` compiles on startup and in watch mode, and exposes a virtual module, `virtual:automata/content`. A2 wires this to restart the sim when content changes.
- **Tuning.** Fields in `tuning.toml` may declare `{ value, min, max, step }`. The compiler checks that each value is in range and emits the metadata for A6's debug sliders.
- **Generators.** `defineContentGenerator(name, (compiled) => files)` is only a hook in A1. The telemetry catalog, `ruken.toml`, and locale-key generators come in later phases.

## 6. `@snekprty/automata-testing` (sim half)

- **`simGolden({ name, plugins, content, seed, script, ticks, every })`**
  - Runs the sim, recording `{ tick, hash }` every `every` ticks.
  - Compares the result with `__goldens__/<name>.golden.json`.
  - With `AUTOMATA_UPDATE_GOLDENS=1` it rewrites that file. Otherwise any difference fails the test.
  - `script` is a pure function `(tick, rng) => Command[]`.
- **`.replay` format** (binary, versioned):
  - Header: seed, tickHz, schemaHash, contentHash, framework version.
  - Body: the per-tick command stream.
  - A checkpoint hash every N ticks, plus the final hash.
  - Written by `recordReplay(sim, …)`.
- **`replayGolden(file, plugins, content)`**
  - Re-simulates the replay and checks every checkpoint.
  - On a mismatch it finds the **first divergent tick**: it re-runs to the last good checkpoint, then steps one tick at a time, comparing against a reference snapshot.
  - It then decodes both snapshots and **diffs them structurally**, reporting results such as `component velocity.x on entity 17: 1.25 ≠ 1.2500001`, or a differing resource path.
- **Cross-engine runner.** The golden suites run in Node and in Vitest browser mode on Chromium, WebKit and Firefox. All four must produce identical hashes, and CI fails if any engine differs.

## 7. `examples/blank-game` (in A1)

- A sim-only example with two scenes:
  - `bounce3d`: `physics3d`, 20 bodies, with a scripted "player" body pushed by `Move` commands.
  - `bounce2d`: the same scene with `physics2d`.
- Content: a `tuning.toml` (gravity, impulse) plus one `bodies/*.toml` schema with references.
- Goldens committed: one `simGolden` and one `.replay` per scene.
- Depends on the packages only through their public `exports`, exactly as a separate game repo would.

## 8. Exit criteria

A1 is done when all of the following hold:

1. The S1–S6 verdicts are committed in `docs/spikes/`, `spikes/` is deleted, and the ECS choice is recorded in an ADR.
2. `automata-sim`, `automata-content`, `automata-testing`, `check-boundaries` and `check-style` all build. CI publishes a `0.0.x` prerelease to GitHub Packages.
3. The `blank-game` sim and replay goldens pass in **Node, Chromium, WebKit and Firefox with identical hashes**.
4. A property test passes over at least 200 random seeds and tick counts: snapshot, restore, and continue equals an uninterrupted run.
5. Every rule in `check-boundaries` and `check-style` has a fixture that the check rejects.
6. Content errors report `file:line:col`, and a dangling reference fails the compile.
7. Deliberately introducing a divergence (in a test fixture) makes `replayGolden` report the first divergent tick and the exact field that differs.
8. Hosted CI passes in under 10 minutes.

## 9. Out of scope (later phases)

- Rendering, interpolation, and the app loop (A2).
- Input devices (A4).
- Hosts and the Ruken adapter (A2; S6 is only a stub).
- Saves and migrations (A5).
- Debug panels (A6).
- Networking (A7).
- The CLI (A3/A8).
- The GPU runner and visual goldens (A3).

## 10. Risks

| Risk | Mitigation |
|---|---|
| Koota's iteration order or relations can't be serialized deterministically | S1, then the facade imposes stable-ID ordering, or we fall back to Miniplex. |
| Deterministic math is too slow for hot loops | S5 measures the cost. Hot paths can use lookup tables or polynomial approximations, which are still bit-exact. |
| WebKit and Firefox in Vitest browser mode are flaky in CI | Pin the Playwright browser versions and retry the browser job once. Never accept a hash mismatch as flaky. |
| The P01 spec changes before F1 | S6 is a stub and its contract tests are generated from P01. Gaps are reported to Ruken before 2026-10-16. |

## 11. Spike outcomes (A0 closed)

See `docs/spikes/README.md` and `docs/adr/0001-ecs-choice.md`. All six spikes passed: S6 is usable, and every determinism check is identical in Node, Chromium, WebKit and Firefox. These change the A1 design:

- **§1 ECS:** Koota is confirmed (ADR 0001).
- **§4.4 rule 1:** the facade iterates in **StableId order everywhere order matters**, through an incrementally maintained index. Native Koota order is deterministic across engines but does not survive a restore. Sorting per tick costs about 4×, so don't do it.
- **§4.4 rule 3:** the `Math.*` allowlist is `sqrt, fround, round, floor, ceil, trunc, abs, min, max, sign, imul`; `round` and `imul` are additions. `automata-sim/math` is the S5 `dmath` module. The boundary checker strips comments before scanning.
- **§3.3 / §4.4 rule 3 (final review):** `check-boundaries` must also ban the **`**` and `**=` operators** in `packages/sim/src`. They compute `Math.pow` and are engine-dependent. Biome's recommended `useExponentiationOperator` auto-fix rewrites `Math.pow(x, y)` into `x ** y` during `pnpm format`, which happened to the S5 negative control. So `biome.json` must disable `style/useExponentiationOperator` for `packages/sim/**`; otherwise a banned `Math.pow` is silently laundered into an operator a `Math.*`-only scan never sees. Sim code uses `dmath.pow` or explicit multiplication.
- **§4.7 (final review):** Koota's `Changed` modifier does **not** fire for a default `updateEach`; S1 verified only Added and Removed. The facade's field setters write with `changeDetection: 'always'` or `entity.set`, and A1's render-delta golden asserts a non-empty `changed` list after a field write.
- **§4.5:** use the Rapier `-deterministic-compat` 0.21 builds. Their `takeSnapshot()` bytes are canonical across engines and round-trip exactly, so they go into the snapshot's physics section and `sim.hash()` verbatim.
- **§4.6:** the entity and relation sections use the S1 encoding:
  - rows sorted by StableId;
  - a presence-flag byte, then little-endian f32 / i32 fields;
  - relations as sorted `(sid, data)` lists.
  Restore spawns entities in StableId order first, then adds relations.
- **§4.7:** the first `RenderDelta` after `restore()` is a **full resync**, because Koota's change tracking reports everything as added on that tick.
- **§3.4 CI:** the Vitest browser projects must pre-declare their browser-side dependencies in `optimizeDeps.include`. Otherwise a cold cache reloads the test pages mid-run and collection fails.
- **A2/A4 (from S3/S4):** one TSL post stack for Three. Pixi filters are GLSL + WGSL pairs that take pixel position from the vertex stage. WebGPU canvases capture black in headless Chromium on macOS, so verify the capture path on the A3 runner.
