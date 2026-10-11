# M2.2 Content in the sim: TDD plan

> Steps use checkboxes. Tick each one when its check passes and commit the tick with that step's work.

- **Spec:** [m2-content-in-sim](../specs/2026-10-11-m2-content-in-sim-design.md) ("spec"); milestone: [M2](../specs/2026-10-11-m2-deterministic-core-design.md).
- **Lane:** content, on its own branch and worktree from `main` (#9 is merged, `d556d23`). Draft PR titled `M2.2 Content in the sim`.
- **Progress:** 0 / 7 tasks, plus the demo (Task 8), which waits on base-2d's content swap.
- **Local CI (every task ends green):** Node 24.21.0; `pnpm vitest run <file>` first, then `pnpm --filter @mcthaydt/automata-content test` (or `-sim`), then `pnpm check`. Parity tasks also run `pnpm --filter <pkg> test:parity`. Before calling the PR green: `pnpm ci:local`.

## Interfaces

- **Consumed:** `canonicalJson`, `xxhash64`, `hex64`, `utf8` (`@mcthaydt/automata-sim/hash`); `createSim`, `SimOptions`, `SimContext`, `SnapshotMismatchError` (`@mcthaydt/automata-sim`); `compileContent`, `ContentSchemaDef`, `defineContentSchema`, `contentRef`, `GeneratorInput`, the built-in generators and `renderTypes` (`packages/content` internals); `createBaseSim({ content })` and `moveCommand` (`@af-examples/base-2d` after integration's content swap, Task 8 only).
- **Produced:** spec §3.1–§3.4.

## Files

| File | Change |
|---|---|
| `packages/content/src/schema/content-schema.ts` | `sim` option and field; config check |
| `packages/content/src/compile/sim-partition.ts` (new) | `simPartition(data, schemas)`, `simReferenceProblems(...)` |
| `packages/content/src/compile/compile-content.ts` | call both; `CompiledContent.sim`; pass `sim` to generators |
| `packages/content/src/generate/content-generator.ts` | `GeneratorInput.sim` (additive) |
| `packages/content/src/compile/built-in-generators.ts` | `sim-content.json`, `sim-content.hash` |
| `packages/content/src/diagnostics/diagnostic.ts` | `simReference` code |
| `packages/content/src/generate/render-types.ts` | `SimContentData`, `simContent`, `simContentHash` |
| `packages/content/src/vite/automata-content.ts` | module code exports `simContent`, `simContentHash` |
| `packages/sim/src/world/sim.ts` | `Sim.contentHash` (the sim's content types stay `unknown`, spec §3.3) |
| tests as listed in spec §7 | |
| `examples/sim/content-restore/**` | Task 8 |
| `examples/README.md` | the demo's row |

## Tasks

Each task: write the failing test, run it and see it fail for the stated reason, write the least code, run the package tests, `pnpm check`, commit.

### Task 1: `sim` option on schemas
- [ ] `content-schema.test.ts`: `defineContentSchema('room', S, { folder: 'rooms' })` has `sim: true`; with `{ sim: false }` it is `false`; `configProblems` reports `kind "x": sim must be true or false` for `{ sim: 'yes' as never }`. Expected failure: `sim` is `undefined`.
- [ ] Implement (fourth parameter, frozen field, one config check).

### Task 2: the partition and its hash
- [ ] `sim-partition.test.ts` with an in-memory fixture (rooms sim, sounds non-sim, tuning, flow, palette, game, assets): `compileContent` returns `sim.data` with exactly `tuning` and `rooms`; `tuning` is `{}` without `tuning.toml`; `sim.hash === contentHash(sim.data)`; editing a room, or a room's localized source text, changes `sim.hash` and `hash`; editing `game.toml` `descriptors`, `palette.toml`, `flow.toml` or a sound changes `hash` only. Expected failure: `sim` is `undefined`.
- [ ] Implement `simPartition` and wire it into step 6 (`compile-content.ts:286`).

### Task 3: `simReference`
- [ ] Failing tests in `sim-partition.test.ts`: a room with `ambience = contentRef('sound')` fails with one `simReference` diagnostic at that key's `file:line:col` and the message in spec §3.1; a sound referring to a room passes. Expected failure: the compile succeeds.
- [ ] Add the code to `DiagnosticCode`; implement `simReferenceProblems` over the references resolved before step 6.

### Task 4: outputs and verify
- [ ] `write-outputs.test.ts`: a build writes `sim-content.json` (canonical file form) and `sim-content.hash`, both listed in `outputs.txt`; `verifyContent` reports `staleArtifact` for a hand-edited `sim-content.hash`. Expected failure: the files are missing.
- [ ] Add `GeneratorInput.sim`; the built-in content generator writes both files from it. A test that a game generator writing `sim-content.json` fails with `InvalidContentConfig` (expected failure: it overwrites silently, or passes).

### Task 5: types
- [ ] `render-types.test.ts`: `content.d.ts` declares `SimContentData` with `tuning` and `rooms` only and no index signature, plus `simContent` and `simContentHash`. Expected failure: no `SimContentData` in the text.
- [ ] `sim-content-types.test.ts`: compile a fixture project into a temp folder; write `uses.ts`, a `defineSystem` whose `run` does `const content = ctx.content as SimContentData` (type-only import from `virtual:automata/content`) and reads `content.rooms['room-1'].rows`; `bad.ts`, which reads `content.palette`; and `other.ts`, which calls `createSim({ content: { room: 1 } })`. Run the workspace `tsc` (7.0.2): `uses.ts` and `other.ts` pass, `bad.ts` fails with TS2339. Expected failure first: `SimContentData` is not exported (TS2305).
- [ ] Implement in `render-types.ts`. `packages/sim`'s types are not touched; `pnpm typecheck` across the repo passes unchanged.

### Task 6: virtual module
- [ ] `automata-content.test.ts`: the module exports `simContent` whose `rooms` is the same object as `content.rooms` (`toBe`), and `simContentHash` equal to `sim-content.hash`. Expected failure: no such exports.
- [ ] Implement in `moduleCode`.

### Task 7: `Sim.contentHash` and the cross-package proof
- [ ] `sim.test.ts`: `sim.contentHash` is 16 hex digits, equals `hex64(xxhash64(utf8(canonicalJson(content))))`, equals the hash after `restore`; `snapshot.test.ts`: two sims given the same content with keys in different orders have equal `contentHash` and restore each other's snapshots. Expected failure: `contentHash` is `undefined`.
- [ ] Implement (one getter over the existing value).
- [ ] `sim-hash.parity.test.ts` in `packages/content` (`browsers` project and Node): the committed fixture's compiled `sim.hash` equals `(await createSim({ seed: 1, content: sim.data, plugins: [] })).contentHash` and the committed value. Run `pnpm --filter @mcthaydt/automata-content test:parity`: Chromium, WebKit, Firefox identical. Record the value in the execution log.

### Task 8: demo `examples/sim/content-restore` (waits on #10 and base-2d's content swap)
Starts only when `createBaseSim({ content })` takes compiled sim content on `main` (spec §8; integration's work, asked through the coordinator). Until then the demo's row in `examples/README.md` says "waits on base-2d content swap", nothing here is ticked, and the package work (Tasks 1–7) merges alone. The demo then lands as its own PR with this task ID.
- [ ] `content-restore.test.ts` (Node): with the original content, walk 60 ticks, snapshot; restart with `store-edited` → restore succeeds and the next 30 ticks hash like an uninterrupted run; restart with `room-edited` → `SnapshotMismatchError('contentHash')`. Expected failure: the module does not exist.
- [ ] Build the demo per spec §8: `content/` and `variants/` compiled by the CLI and committed; `main.ts` with the header block; the panel and buttons with `ui` primitives (the demo depends on `@mcthaydt/automata-ui`); base-2d's game.
- [ ] Smoke test under the fake host (ready, no console errors), and `automata-content check --verify-artifact` for each variant in the test. Expected failure: no `index.html`.
- [ ] Screenshots at phone portrait, 780×270 and desktop into `evidence/`; show the Owner before promoting.
- [ ] Update the demo's row in `examples/README.md`.

## Finish

- [ ] `pnpm ci:local` green; record the commands, Node version and results in the PR.
- [ ] Update **Progress**, add the execution log line, and send the integration owner the rows for 02 and 03 (this lane does not edit numbered docs).

## Execution log

- (empty)
