# ED3D.1c Sector geometry and nav queries: TDD plan

- **Task:** ED3D.1c, added by this plan between ED3D.1 and ED3D.2 (the row lands with the ED3D follow-up to the master plan). [ED3D spec](../specs/2026-10-23-editor-3d-design.md) §4.3 (the geometry owner), §7 (the checks read it), D15 (geometry reaches the views only as a list of layers). Acceptance: the geometry halves of ED3-c, ED3-d, ED3-e and ED3-l (§13), proved here by queries and goldens; the rest need the model and the shell.
- **Lane:** editor-3d. **Depends on:** ED3D.1 (`expand` and its output types; branch `claude/project-thread-ljshus-ed3d-1`, PR #107). No editor-kit code, no Svelte, no DOM.
- **Status:** Drafted 2026-10-23. Not reviewed. Written and built on the Orchestrator's go-ahead of 02:20 UTC (bus), like ED3D.1; spec review (ED3D.0) is still open.
- **Progress:** 3 of 5 steps.

## Why this task exists

The spec says one owner turns a level into the geometry every view and every check reads (§4.3). For the Last Light profile that owner is `expand` (rooms and openings into sectors and a nav graph) **plus** the game's own `src/game/sectors.ts` (sectors into edges with normals, portals, wall pieces, point-in-sector) and `src/game/nav.ts` (clearance). `blockout-lib.ts`'s `validate` and every Last Light scene test call those, so the ED3D.2 checks cannot be a port without them, and the plan, dollhouse and walk views need the same queries (hit testing, wall normals, shared-wall overlap). ED3D.1 ported `expand` only. This task ports the rest as pure functions over data, with the game's module state (`useMap`, `useLevel`, `MAP_VERSION`) replaced by values passed in.

## Sources, read at these commits

- **The Last Light, `mcthaydt/PixiJS3D_Experiment_001` at `92e6704`:**
  - `src/game/sectors.ts` (184 lines): `resolveSectors` (loop winding, pilaster notches and masses, edges with `a`, `b`, `length`, `dir`, `normal`, `u0`, `prev`, `succ`, `thick`, `cut`, `trim`), `edges`, `pieces`, `opening`, `walkBlocker`, `crossing`, `segmentDistance`, `insideSector`, `sectorAt`, `floorAt`, `polygonArea`, and `useMap`'s derived lists (pieces, colliders, sight walls). `wallBetween` (light and sight rays) is not ported: nothing in the checks or the first views needs it; it comes with the Walk view if that view does.
  - `src/game/nav.ts` (84): `segmentHitsBox`, `clear`, `nearestNode`, `nearAWall`, `throughWall` and the three caches they use. `route`, `reserveNodes` and `reachable` are game behaviour (pathing for pursuers) and stay behind.
  - `src/game/sector-format.ts` (64): `STEP`, `WALL_THICK`, `DEFAULT_TRIM`, already vendored as types in ED3D.1.
  - Source tests: the geometry cases of `tests/scenes.test.ts` (lines 124 to 200: loops closed, simple and wound with the room on the left; sectors do not overlap; portals match on both sides; colliders cover the solid walls and the steps too tall to climb; nav nodes stand inside a sector; nav edges are clear with the doors open; every hotspot is reachable from the spawn). They run there on two scenes; they run here on all four shipped blockouts. The "stops Ada at every solid wall" case needs the game's simulation and stays behind.
- **AF:** ED3D.1's fixtures and `expand`. The package stays private; the public entry gains the new exports.

## Scope

**In:** `src/geometry/sectors.ts` and `src/geometry/nav.ts`; a golden recorded once from Last Light's own code; the source tests above; the public exports.

**Out:**

| What | Where |
|---|---|
| The `Geometry` interface (a list of layers) and `LevelProfile.geometry(doc)` | ED3D.1b, which owns the profile registry; this task's `ResolvedMap` is the `sectors` layer's payload |
| Checks (`ids`, `shared-walls`, `openings`, `nav`, locators) | ED3D.2, on these queries |
| `wallBetween`, `route`, `reserveNodes`, `reachable`, rendering, colliders as physics bodies | Last Light, or the Walk view (ED3D.4 and after) |
| Floors as triangles (the render mesh) | ED3D.4 |

## Contract

```
src/geometry/sectors.ts   STEP, WALL_THICK, DEFAULT_TRIM, Edge, Sector, Piece, ResolvedMap,
                          resolveMap, resolveSectors, pieces, opening, walkBlocker, crossing, segmentDistance,
                          insideSector, sectorAt, floorAt, polygonArea
src/geometry/nav.ts       NavWorld, NavState, navWorld, segmentHitsBox, clear, nearestNode, nearAWall, throughWall
src/testing/fixtures/geometry.golden.json   recorded from Last Light's own code (SOURCE.json says how)
src/testing/fixtures/record-geometry.mjs    the recorder
```

```ts
export interface Edge {                         // as Last Light's, every member readonly
  readonly sector: Sector; readonly loop: number; readonly index: number
  readonly a: Point; readonly b: Point; readonly length: number
  readonly dir: Point; readonly normal: Point   // unit a→b and the inward normal
  readonly wall: WallDef; readonly next: Sector | undefined
  readonly u0: number; readonly prev: Edge; readonly succ: Edge
  readonly thick: number; readonly cut: string; readonly trim: Trim
}
export interface ResolvedMap {
  readonly sectors: readonly Sector[]; readonly masses: readonly MassDef[]
  readonly edges: readonly Edge[]; readonly pieces: readonly Piece[]
  readonly colliders: readonly { edge: Edge; y0: number; y1: number }[]
  readonly sightWalls: readonly Edge[]
}
export function resolveMap(defs: readonly SectorDef[], masses?: readonly MassDef[]): ResolvedMap   // `useMap`, returned instead of bound
export const sectorAt = (map: ResolvedMap, p: Point): Sector | undefined
export function navWorld(map: ResolvedMap, level: { boxes; nodes; edges }): NavWorld             // caches built once
export function clear(world: NavWorld, a: Point, b: Point, nav: NavState, margin?: number, wallsOnly?: boolean): boolean
export function nearestNode(world: NavWorld, p: Point, nav: NavState, margin?: number): string | null
```

Port rules: the arithmetic is Last Light's, expression for expression, so floats are bit-equal; the only changes are explicit types (the package builds with `isolatedDeclarations` and `exactOptionalPropertyTypes`), the module state becoming arguments, and the circular `prev`, `succ`, `sector` and `next` links being built with a private mutable type and exposed as readonly. The recorder runs Last Light's code on a scratch copy of its `src/game` files with relative imports given `.ts` extensions (Node's type stripping needs them) and the two clinic scene files stubbed, and reads the *expanded* data from `expand.golden.json`, so a mismatch is the geometry's and never `expand`'s.

## Steps

Each step starts with its test, run red, with the failure reason recorded; the red test is committed with its fix. Strict TDD applies to everything under `packages/`.

- [x] **1. The recorder and its golden** (`fixtures.test.ts` gains the entry; `record-geometry.mjs`, `geometry.golden.json`, `SOURCE.json`).
  - *Red:* `SOURCE.json` lists `geometry.golden.json` with its byte length, sha256 and recorder command, and the file exists with those; the golden has, for each of the four blockouts, the resolved sectors (every edge with its numbers and links), masses, pieces, colliders, sight walls, a `sectorAt` grid at 0.5 m over the bounding box, and the nav answers (`clear` for every node pair at margin 0.3 with the doors open and shut, `nearestNode` for the spawn and every hotspot, `nearAWall` for every node).
  - *Expected failure:* the fixtures test finds no entry for `geometry.golden.json`.
  - *Verify:* the recorder run twice gives the same bytes; it reads the checkout and writes nothing there.
  - *Done: red `ENOENT geometry.golden.json` in both new fixtures tests; the recorder ran on its first try. Run twice it wrote identical bytes (157 kB), and the Last Light checkout stayed clean. Clinic 7 sectors, 3 masses, 37 pieces, 34 colliders, 28 sight walls, 18 nodes (54 of 153 node pairs clear with the doors open, 53 with them shut); dawn 9 sectors; bay 19 sectors, 30 nodes; prologue 7 sectors. 12 of 12 in `fixtures.test.ts`.*
- [ ] **2. Resolving sectors** (`sectors.test.ts`; `sectors.ts` up to `resolveSectors`, `edges`, `insideSector`, `sectorAt`, `floorAt`, `polygonArea`, `crossing`, `segmentDistance`).
  - *Red, by case:* a clockwise outer loop is reversed so the room is on the left, a counter-clockwise hole reversed; an edge has the right `dir`, `normal`, `length`, `u0`, `prev` and `succ` on a square with a hole; a portal's `next` is the target sector and an unknown target throws `unknown portal target`; a pilaster becomes three notch walls and a mass, mirrored when the loop is reversed; the sector's trim is `DEFAULT_TRIM` overridden by its own, and an edge's trim by its wall's; `crossing` and `segmentDistance` on fixed numbers (crossing, touching, parallel, apart); `sectorAt` respects holes; all four resolved blockouts equal the golden (sectors, masses); the source tests: every loop is closed, simple and wound with the room on its left, sectors do not overlap, portals match on both sides, on each blockout.
  - *Expected failure:* module missing.
  - *Done: red `Cannot find module './sectors'`. `sectors.ts` is a port of `resolveSectors` and the queries, with `reverse`, the pilaster notches and `area` kept private, `Edge` and `Sector` readonly with the links built through a private unlinked type, and `edges(sectors)`, `sectorAt(map, p)` and `floorAt(map, x, z)` taking the resolved list instead of reading `SECTORS`. 47 tests: the toy cases (expectations from running Last Light's `resolveSectors`, `crossing`, `segmentDistance` and `polygonArea` on the same inputs), and on each blockout the golden (sectors with every edge, masses, and the `sectorAt` and `floorAt` grid) plus the three source tests. A 1e-7 change to `u0` fails six of them, so the golden is as tight as its numbers. Last Light's normals are `-0` on axis-aligned edges and the toy cases compare through JSON, as the golden does. `src/testing/geometry-golden.ts` holds the golden's types and the shape helper that step 3 and 4 reuse.*
- [ ] **3. Pieces, colliders and the resolved map** (`sectors.test.ts`; `pieces`, `opening`, `walkBlocker`, `resolveMap`).
  - *Red, by case:* a solid wall is one piece floor to ceiling; a portal to a floor 0.30 higher leaves a `lower` piece that blocks walking and one 0.20 higher leaves one that does not (`STEP` 0.25); a lower ceiling leaves an `upper` piece; `opening` is between the higher floor and the lower ceiling; a masked, blocking portal is a collider across its opening; `sightWalls` holds the pieces that span 1.5 m; all four maps equal the golden (pieces, colliders, sight walls); the source test: colliders cover every solid wall and every step too tall to climb, and nothing else, on each blockout.
  - *Expected failure:* `resolveMap` is not exported.
  - *Done: red `resolveMap` not exported (the suite did not load). `pieces`, `opening`, `walkBlocker`, `resolveMap` and the `Piece`, `Collider` and `ResolvedMap` types are in `sectors.ts`; `opening` takes a `PortalEdge` (an edge with a `next`, narrowed by the exported `isPortal`), where Last Light's reads `next!` and throws on a solid wall. The tests are in `pieces.test.ts`, since `sectors.test.ts` is at 400 lines: 19 tests, the toy cases from running Last Light's `useMap` on the same inputs (a 0.30 step blocks, 0.20 and exactly `STEP` do not, lintel, step and lintel, masked and blocking, eye-height ends), and on each blockout the golden for pieces, colliders and sight walls plus the collider source test. Mutations caught: `>= STEP` fails three tests including the golden; `y0 < 1.5` fails only the toy case, since no shipped wall starts at exactly 1.5 m. Last Light's collider list tests `block` alone, without `mask`; the port does the same.*
- [ ] **4. Nav queries** (`nav.test.ts`; `nav.ts`).
  - *Red, by case:* `segmentHitsBox` for a hit, a miss, a graze with and without margin, a segment parallel to a face and inside it; `clear` is false through a wall, through a shut door box and through furniture, true with the door open, true when an end is inside the obstacle (a hotspot on a desk); `wallsOnly` ignores furniture; a raised solid's sides are ignored from its top, a dock's are not; `nearestNode` picks the nearest clear node and returns null when none is clear; all four blockouts equal the golden's nav answers; the source tests: every nav node stands inside a sector, every nav edge is clear with the doors open at margin 0.3, every hotspot can be reached from the spawn within its reach, on each blockout.
  - *Expected failure:* module missing.
- [ ] **5. Gates and records.**
  - *Run in order:* `pnpm format`, `pnpm docs:stack` (commit if it changes), `pnpm check`; the purity test already covers `src/geometry` once it is added to its layer list.
  - *Records:* as in ED3D.1: master plan (02) and continuation prompt (03) in the docs follow-up after #93; nothing ticked in 02 from this PR.

## Verification

Local, Node 24: `pnpm check` and the package's tests. The package has no browser or GPU suite, so parity and e2e are not selected. No goldens of the sim change: this package touches no sim code.

**Owner acceptance:** none of its own; the geometry is judged through the checks (ED3D.2) and the views (ED3D.4) it feeds.

## Risks and how the plan answers them

- **A port that is subtly different.** The golden is Last Light's own output on the four shipped files, compared exactly, plus Last Light's own source tests, so a changed expression shows up as a changed number.
- **Last Light's code is not runnable as it stands under Node.** The recorder builds a scratch copy with explicit extensions and stub scene files; the stubs only supply the module-level `useMap` and `useLevel` calls the game makes at import, which the recorder then redoes with the fixture's own data.
- **Float comparison.** The port keeps the arithmetic, and the golden is compared with `toEqual` after a JSON round trip (which writes `-0` as `0`), as for `expand`.
