# DX.1: sim conveniences TDD plan

- **Spec:** [`docs/superpowers/specs/2026-10-16-dx-small-games-ai-native-design.md`](../specs/2026-10-16-dx-small-games-ai-native-design.md) §3.2, §4, §8, §10 (Owner-approved 2026-10-16).
- **Status:** drafted 2026-10-16.
- **Progress:** 3 of 4 steps.

## Global constraints

- **Strict TDD** in `packages/`: write the failing test, run it, confirm the failure reason, make the minimal change, confirm it passes.
- **Additive only** (spec §3.2): every existing `definePlugin` and `defineSystem` call keeps working, and no existing hash changes (sim goldens, `bounce`, base-2d `31f50888ccb4cf0a`, physics goldens). `pnpm test:parity` proves it.
- **Sim rules:** `pnpm boundaries` holds for `packages/sim/src` (no new imports, no banned globals or members).
- **Gates:** `pnpm format`, `pnpm check`, `pnpm test:parity`. `pnpm test:e2e` is omitted: no runtime, render, host, UI or example change. Changeset: patch for `@mcthaydt/automata-sim`.

## Scope decisions

- **`name` stays required.** The plugin name is part of the schema hash (`plugins: [...]` in `createSim`), of plugin ordering (`orderPlugins`, ties by name) and of `dependsOn`. A default name would be a hidden hash input. EX spec §3's example (`definePlugin({ defs, setup })`) must pass a `name`; recorded as a follow-up for EX.3, not done here.
- **No `setup`, no `u`, no `commands(Def)` call form, no field-schema commands.** They are not in §3.2. EX spec §3's example uses all four; they are findings for DX.2/EX.3.
- **Duplicates:** `defs` entries are appended after the keyed lists of the same kind, in their given order, so a duplicate (keyed and in `defs`, or twice in `defs`) reaches `createSim`'s existing checks and fails with today's message (`duplicate component "…"`, `duplicate system "…"`). A `defs` entry of an unknown kind (a `PluginDef`, a plain object) throws in `definePlugin`.

## Files

- **Modify:** `packages/sim/src/define/definitions.ts` (`definePlugin` `defs`, `defineSystem` overloads, the exported `Def` union).
- **Test:** `packages/sim/src/define/definitions.test.ts`, `packages/sim/src/world/schema-hash.test.ts`.
- **Create:** `packages/testing/src/sim/bounce-defs.golden.test.ts` (the contract test, Node and three browsers).
- **Create:** `.changeset/dx1-sim-conveniences.md`.

## Interfaces

- **Consumed:** `createSim`, `Sim.describeSnapshot().header.schemaHash`, `simGolden` and the committed `bounce.golden.json`.
- **Produced (in `@mcthaydt/automata-sim`):**
  - `type Def = ComponentDef | CommandDef | EventDef | ResourceDef | SystemDef`;
  - `definePlugin({ name, defs?: readonly Def[], ...keyed fields })`;
  - `defineSystem(name, run)`, `defineSystem(name, phase, run)`, plus the existing `defineSystem({ name, phase, before?, after?, run })`.

## Steps

- [x] **1. `defineSystem` overloads.** In `definitions.test.ts`: `defineSystem('move', run)` gives phase `gameplay`, empty `before`/`after`, the same `run`; `defineSystem('kick', 'input', run)` gives phase `input`; `defineSystem('x', 'late', run)` throws `/phase/`; `defineSystem('Bad', run)` throws `/id/`. Run `pnpm --filter @mcthaydt/automata-sim exec vitest run --project node src/define` and confirm it fails because `defineSystem` reads `spec.name` of a string. Implement the overloads delegating to the object form, confirm it passes.
- [x] **2. `definePlugin({ defs })` sorting.** In `definitions.test.ts`: a `defs` list with one of each kind fills `components`, `commands`, `events`, `resources`, `systems`; keyed entries come first, then `defs` entries of that kind in order; an entry of unknown kind throws `/unknown kind/`. Confirm it fails (`defs` ignored, lists empty), implement, confirm it passes.
- [x] **3. Hash equality and duplicates in the sim.** In `schema-hash.test.ts`: a plugin keyed, the same plugin as `defs`, and a mixed one have the same `describeSnapshot().header.schemaHash` and byte-identical snapshots after stepping; a component in both `components` and `defs` makes `createSim` reject with `duplicate component`; a system twice in `defs` rejects with `duplicate system`. Write the test before step 2's change lands to see it fail; it passes after step 2.
- [ ] **4. Golden contract.** Create `bounce-defs.golden.test.ts`: the bounce plugin rebuilt as `definePlugin({ name: 'bounce', defs: [Ball, Kick, BounceStats, BounceKick, BounceMove, BounceSpawn] })` passes `simGolden` against the committed `bounce.golden.json` (same schema hash, same hash every tick) in the `sim` (Node) and `sim-browsers` projects. Before step 2 it fails with `schema-changed`. Verify with `pnpm --filter @mcthaydt/automata-testing exec vitest run --project sim src/sim/bounce-defs`.
- [ ] **Gates.** `pnpm format`, `pnpm check`, `pnpm test:parity` (every existing golden unchanged), changeset added.

## Execution log

| Date | Step | Commits | Notes |
| ---- | ---- | ------- | ----- |
| —    | —    | —       | —     |
