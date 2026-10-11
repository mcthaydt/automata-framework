# M2.2 Content in the sim (lane **content**): design

- **Status:** drafted 2026-10-11 by the M2 specs thread; revised after the PR #12 audit (H4, H5, M3, M4 and lows); awaiting Owner review with the [M2 milestone spec](./2026-10-11-m2-deterministic-core-design.md).
- **Task:** M2.2 in [02 Master delivery plan](../../02-master-delivery-plan.md). Plan: [m2-content-in-sim](../plans/2026-10-11-m2-content-in-sim.md).
- **Owns:** in `packages/content/`, the sim partition, its hash, its outputs and types; in `packages/sim/`, only `Sim.contentHash` (`src/world/sim.ts`); `examples/sim/content-restore/`; this lane's row in `examples/README.md` (`docs/versions.md` is ship's; this task adds no pin).
- **Must not touch:** `packages/testing`, the replay files M2.3 adds to `packages/sim/src/replay/`, `examples/base-2d/` (integration), root config (ship).
- **Builds from:**
  - M1.3 content spec, [§3.2 "Decision for M2.2"](./2026-10-11-m1-content-design.md): store and display metadata in `game.toml` must not gate save restore.
  - FloorFifty `packages/content/src/revisions.ts` (122a220, lines 9-20 and 49-66): `rulesetRevision` moves only with what the simulation reads, `contentRevision` with everything; "a song that decided a race would be the thing this partition exists to make impossible". FloorFifty partitions **by field**; this spec partitions **by kind** (§3.1, deviation).
  - Coordinator decision (2026-10-11, project memory): store metadata is excluded from the save-gating content hash. This spec implements it.
  - The A1a sim on `main` (`d556d23`): `packages/sim/src/world/sim.ts:160-162` (content canonicalized, deep-frozen, hashed), `451-452` (`SnapshotMismatchError('contentHash')`), tests `world/snapshot.test.ts:90` and `world/sim.test.ts:160`.
  - M1.3 compiler: `compile/compile-content.ts` (the code's step 6, "Hash and generators", line 286, which the M1.3 spec calls step 8; this spec uses the code's numbering), `compile/built-in-generators.ts` (outputs), `generate/render-types.ts` (`content.d.ts`), `vite/automata-content.ts` (the virtual module).

## 1. Goal and boundaries

A game passes the compiler's sim content to `createSim` and gets:

- a `SimContentData` type generated from its own schemas, with an ID union per collection, that its sim code applies to `ctx.content` (still deep-frozen) with one type-only import;
- a gating hash over gameplay content only, so a snapshot or replay is refused when a room, a tuning value or a gameplay item changes, and accepted when the store listing, the palette, the flow graph or the preload list changes;
- the same hash in the compiler's output, the virtual module, `sim.contentHash` and the snapshot header, in Node, Chromium, WebKit and Firefox.

**What is already built and is only pinned here:** freezing, hashing, the header field and the mismatch error (§2 of the milestone spec). Those tests stay; this task adds the partition, the types, `Sim.contentHash` and the cross-package proof.

**Deliverables:** the `sim` option on `defineContentSchema`; the `simReference` diagnostic; `CompiledContent.sim` and `GeneratorInput.sim`; outputs `sim-content.json` and `sim-content.hash`; `simContent`, `simContentHash` and the `SimContentData` type in `virtual:automata/content`; `Sim.contentHash`; the parity test; the demo.

**Not in this task:** the runtime boot check that compares hashes and restarts the sim on hot reload (M1.5); per-level hashes and per-field partitioning (backlog, milestone spec §4); moving base-2d's room into TOML (integration, M1.8; the demo waits on it, §8).

## 2. Ownership

| State | Owner | Writers |
|---|---|---|
| Which kinds are sim content | the game, per schema (`sim` option) | the game's `automata.content.ts` |
| The sim partition and its hash | `content` | the compiler only (step 6) |
| `SimContentData` type | `content`'s type generator, in the game's `content.d.ts` | the compiler only |
| The content inside a sim and `sim.contentHash` | `sim` | `createSim` only |

## 3. Contracts

### 3.1 The sim option (additive to M1 shared contracts §2)

```ts
export interface ContentSchemaDef<K, S> {
  readonly kind: K
  readonly schema: S
  readonly place: ContentSchemaPlace
  /** Whether the sim receives this kind. Default true. */
  readonly sim: boolean
}
defineContentSchema(kind, schema, place, options?: { readonly sim?: boolean })
```

- Game kinds default to `sim: true`: content is gameplay unless the game says otherwise, so forgetting the flag can only refuse a snapshot, never let a gameplay change through.
- Built-in documents: `tuning` is sim content. `flow`, `palette`, `game` and `assets` are not: the sim never reads screens, colours, store metadata or the preload list. This settles the M1.3 decision by exclusion, not by a second hash inside `game`.
- **Deviation from FloorFifty: by kind, not by field.** FloorFifty picks the fields the simulation reads (`revisions.ts:9-20, 49-66`). Here a kind is in or out as a whole, which is simpler and needs no field list, at a known cost: everything inside a sim kind gates saves, including its localized text (`resolveMarkers` puts the source string into `data`, `compile-content.ts:155`) and any display-only field, and every key in `tuning` gates saves, including presentation tunables. The rule for games: keep display data in its own non-sim kind that refers to the sim item (a `enemy-look` kind with `enemy = { ref = "enemy:bat" }`, allowed by the rule below), and keep presentation tunables out of `tuning`. Per-field marking is backlog; a game that needs it before then raises it with the content owner.
- **`simReference` (new diagnostic, error).** A `contentRef` inside a sim kind that points at a non-sim kind fails the compile at that key: `content/enemies/bat.toml:4:1  sound  simReference: enemy is sim content but sound is not; mark sound { sim: true } or keep the reference out of the sim`. Without it the sim would hold an ID whose target it cannot read, and a change to that target would not move the hash. Refs from non-sim kinds into sim kinds are fine.

### 3.2 Compiler outputs (additive to M1.3)

```ts
export interface CompiledContent {
  readonly data: ContentData                 // unchanged: everything
  readonly hash: string                      // unchanged: over everything (M1.5 boot check, evidence identity)
  readonly sim: { readonly data: SimContentData; readonly hash: string }  // new: gates snapshots and replays
  readonly files: ReadonlyMap<string, string>
  readonly warnings: readonly Diagnostic[]
}
```

- `sim.data` is `{ tuning, <each sim kind> }` picked from `data` (same objects, so no second parse); `tuning` is present even when empty (`{}`), so the shape never depends on whether `tuning.toml` exists.
- `sim.hash = contentHash(sim.data)`: the same function as the full hash (`hash/content-hash.ts`: XXH64 over the sim's `canonicalJson`), so it equals what `createSim` computes from the same data. The preimage never contains a hash.
- **Two hashes, two jobs, stated once.** `hash` (all of `data`) stays what M1.3 made it: the boot check (M1.3 spec l.61, M1.5) and evidence identity. `sim.hash` gates snapshots and replays, and nothing else. They are never compared with each other.
- `GeneratorInput` gains `sim: { data, hash }` (additive), so the built-in generator writes the partition the compiler made instead of re-deriving it from `schemas`. A game generator that writes `sim-content.json` or `sim-content.hash` clashes with the built-in one and fails as `InvalidContentConfig`, like any clashing generator today.
- New output files beside `content.json`: `sim-content.json` (canonical file form) and `sim-content.hash` (16 hex digits and a newline), listed in `outputs.txt` and checked by `verifyContent` like every other output.
- `virtual:automata/content` gains `simContent` and `simContentHash`. `simContent` is built in the module code from `content`'s own properties (`export const simContent = { tuning: content.tuning, rooms: content.rooms }`), so the bundle holds the data once.

### 3.3 Types

The sim's types do not change: `SimContext.content` and `SimOptions.content` stay `unknown` (`packages/sim/src/define/context.ts:33` and `packages/sim/src/world/sim.ts:67`). The compiler's `content.d.ts` gains

```ts
export interface SimContentData {
  readonly tuning: Readonly<Record<TuningName, number | boolean | string>>   // as content.d.ts types tuning today (render-types.ts:143)
  readonly rooms: { readonly [id in RoomId]: Room }      // one property per sim kind
}
export const simContent: SimContentData
export const simContentHash: string
```

and a game's sim code types its content with one line:

```ts
import type { SimContentData } from 'virtual:automata/content'   // type-only: check-boundaries skips it (check.ts:207)
const content = ctx.content as SimContentData
content.rooms['room-1'].rows   // typed
content.palette                // TS2339: Property 'palette' does not exist
```

**Why not a global augmentation.** The first draft augmented an `interface SimContent` in the sim through `declare module`. The audit reproduced two failures: interface merging keeps the base index signature, so `palette` read as `unknown` instead of failing; and an augmentation applies to the whole TypeScript program, so once a demo augmented it, base-2d's own `createSim({ content: { room } })` in the same program failed with TS2739. A cast from `unknown` is local to the file that writes it, cannot break another package, and needs no change in the sim. A game that never runs the compiler (tests, base-2d today) is untouched.

### 3.4 `Sim.contentHash`

```ts
export interface Sim {
  // …
  /** XXH64 of the canonical content this sim was created with, 16 hex digits; the snapshot header's value. */
  readonly contentHash: string
}
```

It never changes for the life of the sim (restore refuses other content).

## 4. Data and lifecycle flow

1. The compiler parses and checks every file (the code's steps 1–5), then the new `simReference` check, which needs only the references already resolved by then.
2. Step 6 computes `hash` as before, then `sim.data` and `sim.hash`, and hands both to the generators.
3. Built-in generators write `content.json`, `content.hash`, `sim-content.json`, `sim-content.hash` and `content.d.ts`.
4. The game calls `createSim({ seed, content: simContent, plugins })`. The sim canonicalizes and freezes its own copy and sets `contentHash`. Separately from the boot check (which uses `hash`, §3.2), the runtime (M1.5) may assert `sim.contentHash === simContentHash` once; a difference means the build is broken (two hash implementations disagree) and is reported as the bug it is, not as a player-facing `ContentHashMismatch`.
5. `snapshot()` writes `contentHash` in the header; `restore()` refuses another one.

## 5. Failure policy

| Case | Behaviour |
|---|---|
| Sim kind refers to a non-sim kind | `simReference` diagnostic at the key; nothing written |
| `sim` option not a boolean | `InvalidContentConfig` naming the kind |
| Snapshot from a sim with other sim content | `SnapshotMismatchError('contentHash', expected, actual)`; sim unchanged (existing behaviour, pinned) |
| Snapshot after a change to `game.toml`, `palette.toml`, `flow.toml`, `assets.toml` or a non-sim kind | Restores (new test) |
| Snapshot after a change to a sim kind's localized source text | Refused: the source string is in `data` (by-kind partition, §3.1); pinned by a test so the cost is visible |
| `sim.hash` and `sim.contentHash` differ for the same data | A bug; the parity test (§7) fails |
| A non-plain value reaches the sim (a `Date`) | `CanonicalJsonError` from `createSim` (#9 §10.7); the compiler already turns TOML dates into ISO strings |

## 6. Determinism

The sim hash depends only on canonical JSON (keys in UTF-16 code-unit order, never `localeCompare`; numbers as JSON; `-0` kept, #9 §10.1) and XXH64. No new code computes a hash: `content` calls the one `contentHash` and `sim` the one `xxhash64`, both from `@mcthaydt/automata-sim/hash`.

## 7. Test allocation

| Layer | File | What |
|---|---|---|
| Unit (Node) | `packages/content/src/schema/content-schema.test.ts` | `sim` defaults to true; `{ sim: false }` kept; a non-boolean is `InvalidContentConfig` |
| Unit | `packages/content/src/compile/sim-partition.test.ts` (new) | Partition picks tuning and sim kinds; excludes flow, palette, game, assets and non-sim kinds; `tuning` is `{}` when absent; `sim.hash` changes with a room edit and with a sim kind's source text edit, and not with a `game.toml` `descriptors` edit, a palette edit or a non-sim kind edit; `simReference` placed at the key; a non-sim kind may refer into sim content |
| Unit | `packages/content/src/compile/write-outputs.test.ts` | The two new files are written, listed and verified; a hand-edited `sim-content.hash` is `staleArtifact` |
| Unit | `packages/content/src/generate/render-types.test.ts` | `SimContentData` lists exactly the sim kinds, with no index signature; `simContent` and `simContentHash` declared |
| Type test | `packages/content/src/generate/sim-content-types.test.ts` (new) | A fixture project compiled, then `tsc` (TypeScript 7.0.2) over a sim file that casts `ctx.content as SimContentData`: `.rooms['room-1'].rows` passes, `.palette` fails with TS2339, and a second file in the same program calling `createSim({ content: { room } })` still compiles |
| Unit | `packages/content/src/vite/automata-content.test.ts` | The virtual module exports `simContent` (sharing `content`'s objects) and `simContentHash` |
| Unit (Node) | `packages/sim/src/world/sim.test.ts` | `sim.contentHash` equals the header's value and `hex64(xxhash64(utf8(canonicalJson(content))))`; it is the same before and after a restore |
| Unit | `packages/sim/src/world/snapshot.test.ts` | Existing mismatch test kept; one more: two sims with the same content in different key order share the hash and restore each other |
| Parity | `packages/content/src/hash/sim-hash.parity.test.ts` (new, `browsers` project) | A committed fixture's `sim.hash` equals `createSim`'s `contentHash` and one committed value, in all four engines |
| Demo | `examples/sim/content-restore/` | §8 |

## 8. Demo: `examples/sim/content-restore`

**Shows one thing:** a snapshot is gated by gameplay content, not by store metadata.

- **Base:** `@af-examples/base-2d`. **Waits on** #10 and on integration's M1.8 swap: today `createBaseSim` builds `content: { room }` itself and takes only `room?` (`src/base-sim.ts:8-21` at #10 head), so the compiler's partition never reaches the sim and the demo could not show anything. The request (through the coordinator): base-2d keeps its room in `content/rooms/*.toml`, compiled by `automata-content`, and `createBaseSim({ content })` takes the compiled `simContent` (its systems then read `rooms`). Until that lands, the demo row stays "waiting" and the package work merges alone (milestone spec §5).
- **Content:** the demo's own `content/` with base-2d's `rooms` kind (`rooms/room-1.toml`) and a `game.toml`. Two variants under `variants/`, compiled at build time with the CLI and checked with `automata-content check --verify-artifact` (`run-cli.ts:36-37`) in the smoke test: `store-edited/` (`game.toml` `descriptors` and `estimated_hours` changed: real `gameSchema` fields, `game-facts.ts:22-28`) and `room-edited/` (one platform moved).
- **Play:** walk and jump as in base-2d. `S` saves a snapshot in memory; the side panel shows the snapshot's tick and content hash. Three buttons restart the sim with the original content, the store-edited content or the room-edited content, then restore the saved snapshot: the first two resume Wick exactly where he was; the third shows `SnapshotMismatchError` with both hashes and keeps the fresh room running.
- **No storage:** the snapshot stays in memory, so the demo never stands in for saves (M5) or reaches for device storage.
- **Header** of `main.ts`: what it shows, the controls (`←`/`→`, `Z` or `Space` to jump, `S` save, buttons), the base, and the packages (`automata-sim`, `automata-content`, `automata-ui`, `@af-examples/base-2d`). The demo depends on `@mcthaydt/automata-ui` itself; base-2d does not.
- **Checks:** smoke test (boots under the fake Ruken host, ready, no console errors); a Node test that drives the three restarts headless and asserts resume, resume, refuse; the room-edited variant's hash differs and the store-edited one's does not.
- **Art:** base-2d's sprites and palette only; the panel uses `ui` theme tokens (Endesga 64). Screenshots go to `evidence/` for the Owner.

## 9. Responsive and input

The demo's panel follows base-2d's screen layout: on a phone in portrait the panel sits below the room and the three buttons are 48 px primary actions in one column; at 780×270 they move into the corner controls area. Touch uses base-2d's touch controls; `S` has a touch button. No new primitives: `ScreenFrame`, `ActionBar` and `Dialog` from `ui`.

## 10. Feedback workflow

`pnpm vitest run packages/content/src/compile/sim-partition.test.ts` while building the partition; `pnpm --filter @mcthaydt/automata-content test` and `pnpm --filter @mcthaydt/automata-sim test` per package; `pnpm --filter @mcthaydt/automata-content test:parity` for the hash parity; `pnpm check` before each commit; `pnpm ci:local` before calling the PR green.

## 11. Ruken alignment

None directly: content and snapshots are AF's. The content hash is not a Ruken field (Ruken's manifest `content` table holds languages, rating and descriptors, which are exactly the excluded `game` data).

## 12. Exit criteria

1. `pnpm check` and `pnpm test:parity` green locally (af-linux stalled) with the tests in §7, each seen failing first for the stated reason.
2. Changing a room refuses a snapshot; changing `game.toml` does not (tests).
3. The compiler's `sim.hash`, the virtual module's `simContentHash` and `sim.contentHash` are equal in four engines.
4. `SimContentData` types a game's sim content under TypeScript 7.0.2, without breaking other code in the same program (type test).
5. The demo merged with its smoke test, or listed as waiting on #10 with the package work merged.

## 13. Open questions

- **Q1:** default `sim: true` for game kinds (recommended: a forgotten flag fails safe) or `false`?
- **Q2:** should `palette` be sim content for games whose rules read colours (a colour-matching puzzle)? Recommended: no built-in exception; such a game registers its own sim kind for the colours it plays with.
