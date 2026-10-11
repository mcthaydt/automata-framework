# M2.2 Content in the sim (lane **content**): design

- **Status:** drafted 2026-10-11 by the M2 specs thread; awaiting Owner review with the [M2 milestone spec](./2026-10-11-m2-deterministic-core-design.md).
- **Task:** M2.2 in [02 Master delivery plan](../../02-master-delivery-plan.md). Plan: [m2-content-in-sim](../plans/2026-10-11-m2-content-in-sim.md).
- **Owns:** in `packages/content/`, the sim partition, its hash, its outputs and types; in `packages/sim/`, only `SimContent` (`src/define/context.ts`) and `Sim.contentHash` (`src/world/sim.ts`, `src/index.ts`); `examples/sim/content-restore/`; this lane's rows in `examples/README.md` and `docs/versions.md`.
- **Must not touch:** `packages/testing`, the replay files M2.3 adds to `packages/sim/src/replay/`, `examples/base-2d/` (integration), root config (ship).
- **Builds from:**
  - M1.3 content spec, [§3.2 "Decision for M2.2"](./2026-10-11-m1-content-design.md): store and display metadata in `game.toml` must not gate save restore.
  - FloorFifty `packages/content/src/revisions.ts` (122a220): `rulesetRevision` moves only with what the simulation reads, `contentRevision` with everything; "a song that decided a race would be the thing this partition exists to make impossible".
  - The A1a sim: `packages/sim/src/world/sim.ts:124-126` (content canonicalized, deep-frozen, hashed), `353-354` (`SnapshotMismatchError('contentHash')`), tests `world/snapshot.test.ts:90` and `world/sim.test.ts:160`.
  - M1.3 compiler: `compile/compile-content.ts` (step 8 assembles `data` and its hash), `compile/built-in-generators.ts` (outputs), `generate/render-types.ts` (`content.d.ts`), `vite/automata-content.ts` (the virtual module).

## 1. Goal and boundaries

A game passes the compiler's sim content to `createSim` and gets:

- `ctx.content` typed from its own schemas, with an ID union per collection, and still deep-frozen;
- a gating hash over gameplay content only, so a snapshot or replay is refused when a room, a tuning value or a gameplay item changes, and accepted when the store listing, the palette, the flow graph or the preload list changes;
- the same hash in the compiler's output, the virtual module, `sim.contentHash` and the snapshot header, in Node, Chromium, WebKit and Firefox.

**What is already built and is only pinned here:** freezing, hashing, the header field and the mismatch error (§2 of the milestone spec). Those tests stay; this task adds the partition, the types, `Sim.contentHash` and the cross-package proof.

**Deliverables:** the `sim` option on `defineContentSchema`; the `simReference` diagnostic; `CompiledContent.sim`; outputs `sim-content.json` and `sim-content.hash`; `simContent` and `simContentHash` in `virtual:automata/content`; a generated `sim-content.d.ts` that augments `SimContent`; `SimContent` and `Sim.contentHash` in the sim; the parity test; the demo.

**Not in this task:** the runtime boot check that compares hashes and restarts the sim on hot reload (M1.5); per-level hashes (backlog, milestone spec §4); moving base-2d's room into TOML (integration, M1.8).

## 2. Ownership

| State | Owner | Writers |
|---|---|---|
| Which kinds are sim content | the game, per schema (`sim` option) | the game's `automata.content.ts` |
| The sim partition and its hash | `content` | the compiler only (step 8) |
| `SimContent` type | `sim` declares; the game's `sim-content.d.ts` augments | the compiler's type generator |
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
- **`simReference` (new diagnostic, error).** A `contentRef` inside a sim kind that points at a non-sim kind fails the compile at that key: `content/enemies/bat.toml:4:1  sound  simReference: enemy is sim content but sound is not; mark sound { sim: true } or keep the reference out of the sim`. Without it the sim would hold an ID whose target it cannot read, and a change to that target would not move the hash. Refs from non-sim kinds into sim kinds are fine.

### 3.2 Compiler outputs (additive to M1.3)

```ts
export interface CompiledContent {
  readonly data: ContentData                 // unchanged: everything
  readonly hash: string                      // unchanged: over everything (boot check, evidence identity)
  readonly sim: { readonly data: SimData; readonly hash: string }  // new
  readonly files: ReadonlyMap<string, string>
  readonly warnings: readonly Diagnostic[]
}
```

- `sim.data` is `{ tuning, <each sim kind> }` picked from `data` (same objects, so no second parse); `tuning` is present even when empty (`{}`), so the shape never depends on whether `tuning.toml` exists.
- `sim.hash = contentHash(sim.data)`: the same function as the full hash (`hash/content-hash.ts`: XXH64 over the sim's `canonicalJson`), so it equals what `createSim` computes from the same data. The preimage never contains a hash.
- New output files beside `content.json`: `sim-content.json` (canonical file form) and `sim-content.hash` (16 hex digits and a newline), listed in `outputs.txt` and checked by `verifyContent` like every other output.
- `virtual:automata/content` gains `simContent` and `simContentHash`. `simContent` is built in the module code from `content`'s own properties (`export const simContent = { tuning: content.tuning, rooms: content.rooms }`), so the bundle holds the data once.

### 3.3 Types

In `packages/sim/src/define/context.ts`:

```ts
/** The content the sim receives. Empty here; a game's generated `sim-content.d.ts` fills it in. */
export interface SimContent { readonly [kind: string]: unknown }

export interface SimContext {
  // …
  /** Compiled sim content, deep-frozen. */
  readonly content: SimContent      // was: unknown
}
```

`SimOptions.content` becomes `SimContent | undefined`.

The compiler writes a second declaration file, `sim-content.d.ts`, because a file that imports types is a module and cannot also declare `virtual:automata/content` ambiently:

```ts
// Generated by @mcthaydt/automata-content from content/. Do not edit.
import type { SimContentData } from 'virtual:automata/content'
declare module '@mcthaydt/automata-sim' {
  interface SimContent extends SimContentData {}
}
```

and `content.d.ts` gains `export interface SimContentData { readonly tuning: …; readonly <sim kind>: … }` and `export const simContent: SimContentData`, `export const simContentHash: string`.

A game that never runs the compiler (tests, base-2d today) keeps the index signature and casts as it does now; existing code compiles unchanged because `unknown` reads become `unknown` property reads.

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

1. The compiler parses and checks every file (M1.3 steps 1–5), then the new `simReference` check, which needs only the resolved references from step 5.
2. Step 8 assembles `data` and `hash` as before, then `sim.data` and `sim.hash`.
3. Built-in generators write `content.json`, `content.hash`, `sim-content.json`, `sim-content.hash`, `content.d.ts`, `sim-content.d.ts`.
4. The game calls `createSim({ seed, content: simContent, plugins })`. The sim canonicalizes and freezes its own copy and sets `contentHash`. The runtime (M1.5) compares `sim.contentHash` with `simContentHash` and treats a difference as `ContentHashMismatch` (master spec §6), which means the build is broken (two compilers disagree).
5. `snapshot()` writes `contentHash` in the header; `restore()` refuses another one.

## 5. Failure policy

| Case | Behaviour |
|---|---|
| Sim kind refers to a non-sim kind | `simReference` diagnostic at the key; nothing written |
| `sim` option not a boolean | `InvalidContentConfig` naming the kind |
| Snapshot from a sim with other sim content | `SnapshotMismatchError('contentHash', expected, actual)`; sim unchanged (existing behaviour, pinned) |
| Snapshot after a change to `game.toml`, `palette.toml`, `flow.toml`, `assets.toml`, translations or a non-sim kind | Restores (new test) |
| `sim.hash` and `sim.contentHash` differ for the same data | A bug; the parity test (§7) fails |
| A non-plain value reaches the sim (a `Date`) | `CanonicalJsonError` from `createSim` (#9 §10.7); the compiler already turns TOML dates into ISO strings |

## 6. Determinism

The sim hash depends only on canonical JSON (keys in UTF-16 code-unit order, never `localeCompare`; numbers as JSON; `-0` kept, #9 §10.1) and XXH64. No new code computes a hash: `content` calls the one `contentHash` and `sim` the one `xxhash64`, both from `@mcthaydt/automata-sim/hash`.

## 7. Test allocation

| Layer | File | What |
|---|---|---|
| Unit (Node) | `packages/content/src/schema/content-schema.test.ts` | `sim` defaults to true; `{ sim: false }` kept; a non-boolean is `InvalidContentConfig` |
| Unit | `packages/content/src/compile/sim-partition.test.ts` (new) | Partition picks tuning and sim kinds; excludes flow, palette, game, assets and non-sim kinds; `tuning` is `{}` when absent; `sim.hash` changes with a room edit and not with a `game.toml` edit, a palette edit or a non-sim kind edit; `simReference` placed at the key; a non-sim kind may refer into sim content |
| Unit | `packages/content/src/compile/write-outputs.test.ts` | The two new files are written, listed and verified; a hand-edited `sim-content.hash` is `staleArtifact` |
| Unit | `packages/content/src/generate/render-types.test.ts` | `SimContentData` lists exactly the sim kinds; `sim-content.d.ts` text |
| Type test | `packages/content/src/generate/sim-content-types.test.ts` (new) | A fixture project compiled, then `tsc` over a file that reads `ctx.content.rooms['room-1'].rows` (passes) and `ctx.content.palette` (fails with a type error): the augmentation works with TypeScript 7.0.2 |
| Unit | `packages/content/src/vite/automata-content.test.ts` | The virtual module exports `simContent` (sharing `content`'s objects) and `simContentHash` |
| Unit (Node) | `packages/sim/src/world/sim.test.ts` | `sim.contentHash` equals the header's value and `hex64(xxhash64(utf8(canonicalJson(content))))`; it is the same before and after a restore |
| Unit | `packages/sim/src/world/snapshot.test.ts` | Existing mismatch test kept; one more: two sims with the same content in different key order share the hash and restore each other |
| Parity | `packages/content/src/hash/sim-hash.parity.test.ts` (new, `browsers` project) | A committed fixture's `sim.hash` equals `createSim`'s `contentHash` and one committed value, in all four engines |
| Demo | `examples/sim/content-restore/` | §8 |

## 8. Demo: `examples/sim/content-restore`

**Shows one thing:** a snapshot is gated by gameplay content, not by store metadata.

- **Base:** `@af-examples/base-2d` (`createBaseSim({ room, plugins })`, its renderer, input and screens). Waits on #10.
- **Content:** the demo's own `content/` with a `rooms` collection (`rooms/room-1.toml`, base-2d's room as TOML: `id`, `tileSize`, `rows`, sim content) and a `game.toml`. Two variants under `variants/` compiled at build time with the CLI and committed (`--verify` in the smoke test): `store-edited/` (a new store description) and `room-edited/` (one platform moved).
- **Play:** walk and jump as in base-2d. `S` saves a snapshot in memory; the side panel shows the snapshot's tick and content hash. Three buttons restart the sim with the original content, the store-edited content or the room-edited content, then restore the saved snapshot: the first two resume Wick exactly where he was; the third shows `SnapshotMismatchError` with both hashes and keeps the fresh room running.
- **No storage:** the snapshot stays in memory, so the demo never stands in for saves (M5) or reaches for device storage.
- **Header** of `main.ts`: what it shows, the controls (`←`/`→`, `Z` or `Space` to jump, `S` save, buttons), the base, and the packages (`automata-sim`, `automata-content`, `@af-examples/base-2d`).
- **Checks:** smoke test (boots under the fake Ruken host, ready, no console errors); a Node test that drives the three restarts headless and asserts resume, resume, refuse; the room-edited variant's hash differs and the store-edited one's does not.
- **Art:** base-2d's sprites and palette only; the panel uses `ui` theme tokens (Endesga 64). Screenshots go to `evidence/` for the Owner.

## 9. Responsive and input

The demo's panel follows base-2d's screen layout: on a phone in portrait the panel sits below the room and the three buttons are 48 px primary actions in one column; at 780×270 they move into the corner controls area. Touch uses base-2d's touch controls; `S` has a touch button. No new primitives: `ScreenFrame`, `ActionBar` and `Dialog` from `ui`.

## 10. Ruken alignment

None directly: content and snapshots are AF's. The content hash is not a Ruken field (Ruken's manifest `content` table holds languages, rating and descriptors, which are exactly the excluded `game` data).

## 11. Exit criteria

1. `pnpm check` and `pnpm test:parity` green locally (af-linux stalled) with the tests in §7, each seen failing first for the stated reason.
2. Changing a room refuses a snapshot; changing `game.toml` does not (tests).
3. The compiler's `sim.hash`, the virtual module's `simContentHash` and `sim.contentHash` are equal in four engines.
4. `ctx.content` is typed from the game's schemas under TypeScript 7.0.2 (type test).
5. The demo merged with its smoke test, or listed as waiting on #10 with the package work merged.

## 12. Open questions

- **Q1:** default `sim: true` for game kinds (recommended: a forgotten flag fails safe) or `false`?
- **Q2:** should `palette` be sim content for games whose rules read colours (a colour-matching puzzle)? Recommended: no built-in exception; such a game registers its own sim kind for the colours it plays with.
