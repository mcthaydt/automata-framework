# ED3D.7c Zones and nav edges as things (Last Light): TDD plan

- **Task:** ED3D.7c, the third part of ED3D.7 (Things). [ED3D spec](../specs/2026-10-23-editor-3d-design.md) §4.7 (things are instances of definitions; the Last Light profile defines its fixed set, zone among them, and maps each to its array), §5.1 (Last Light's things include nav nodes and edges and camera zones), §5.4 (`thing.*`, and for Last Light nav edge add and remove), §7 (`ids`: the zone rules; `nav`: an edge is clear by the margin with the doors open). Row: "Camera zones (rectangles) and nav edges (add and remove, through a door, refused when not clear by the margin, in the nav check's sentences) through the same Things path; 7a made a nav node a floor thing." Model, profile and the Things tool controller; no Svelte, DOM, Pixi or clock.
- **Lane:** editor-3d. **Depends on:** ED3D.7a (#168, merged: `ThingAccess`, `addThing`, `moveThing`, `setThingField`, `removeThing`), ED3D.7b (#231, ready, not merged: `createThingsTool`; this branch stacks on it), ED3D.1c (`geometry/nav.ts` `clear`, `navWorld`, `openDoors`), ED3D.2 (`checks/last-light/ids.ts`, `nav-problems.ts`).
- **Status:** Drafted 2026-10-30. Steps are ticked only when their checks pass.
- **Progress:** 2 of 5 steps.

## Why this task exists

7a and 7b put Last Light's spawn, boxes, hotspots, lamps, anchors and nav nodes through one path: a definition, a reader, an access that writes the file's own arrays, four edits and a tool. A camera zone and a nav edge were left out because neither has the point a thing has (1b2 decision 6, 7a's Out). This task gives each a place on that path without the core naming either: a zone becomes a thing of a `zone` definition that also bounds a rectangle of the plan, and a nav edge becomes a _link_ between two things of one definition, which a profile may declare.

## Sources, read at these commits

- **The Last Light `92e6704`:** `editor/src/server/level-edits.ts` (`addZone`, `setZoneArea`, `areaOf`, `cameraOf` (the follow camera's distance of 14 m), `addNavEdge`, `removeNav`, `handNav`: what the shipped editor refuses and in which words), `editor/src/client/level-tools.ts` (the Zone tool drags a rectangle; the Edge tool starts at a node), `editor/src/client/levels.ts` (a zone is drawn as a marker at its `look` point and its area as a rectangle; a node's card lists its edges with Remove). Anything taken from these is recorded beside the code with the commit.
- **AF (this branch, on #231):** `checks/last-light/ids.ts` (the zone sentences, the door-box sentence of a nav edge), `checks/last-light/nav-problems.ts` (`edge a–b is not clear by 0.3 m with the doors open`), `geometry/nav.ts`, `profile/last-light-things.ts`, `profile/last-light-entities.ts`, `profile/thing-access.ts`, `model/thing-edits.ts`, `things/things-tool-controller.ts`, `entities/thing-def.schema.ts`.

## Scope

**In:** the zone and edge sentences shared by the checks and the edits; a `zone` definition, its reader and its access; the definition fact `area`; `ThingLinks` on `LevelProfile` with Last Light's nav edges; the edits `addLink` and `removeLink`; the Things tool's rectangle drag for a definition with an `area`, its link mode and `unlink`; the entry; the tests.

**Out, with where each goes:**

| What                                                                                                                          | Where                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Painting zones' rectangles and markers, edges, the link and rectangle previews, a door picker, a node card listing its edges  | ED3D.7d                                                                                         |
| A zone's camera switch (follow or fixed shot as one action), a room's zone, the room-visibility policy entry a new zone needs | ED3D.7d inspector over the fields; the policy stays the game's (spec §3 Out, editor-gaps #21)   |
| Redrawing an existing zone's area by a drag                                                                                   | ED3D.7d (the four fields are set through `setField` here)                                       |
| Removing a node together with its edges in one action                                                                         | ED3D.7d or ED3D.11 (7a refuses while an edge names the node; `unlink` then remove is two steps) |

## Decisions this plan makes (each vetoable by the Owner)

1. **A zone is a `point` thing at its `look` point, floating at the look's height** (`sit: 'free'`; `x`, `y`, `z` are `look[0]`, `look[1]`, `look[2]`), which is where Last Light's own plan draws a zone's marker. Dragging the marker moves the camera's look point. A place in the middle of the area would not do: every shipped zone has an open side (`area.z: [null, -1.25]`), so most zones have no middle.
2. **Its fields are `distance` (float, at least 0, required), `follow` (float, 0 to 1) and `x0`, `z0`, `x1`, `z1` (floats, each optional): the sides of its area, an absent side open,** as the file's `area: { x: [x0, x1], z: [z0, z1] }` with `null` for an open side. The zone's other members (its camera `x`, `hysteresis`, `depthFollow`, `enter` and anything the schema does not know) are not fields: the access carries them through untouched, in their order. A zone's camera `x` is not a field because a thing keeps `x` for its place.
3. **A definition may name four float fields that bound a rectangle of the plan:** `area: [x0, z0, x1, z1]` on `ThingDef`, a fourth 3D fact beside `shape`, `size` and `sit` (ED3D-D14 lists three; this adds one, and an `af-sector/1` file may use it too). The schema refuses an `area` whose names are not four different float fields of the definition. The Things tool reads it, so the core still names no zone.
4. **A zone edit keeps the `ids` check's zone rules, in its sentences, and the shipped editor's size rule:** an edit is refused with the first zone sentence the new level has that the old did not (`the first zone has no area: it is the rest of the map`, `zone zone1 needs an area (only the first zone covers the rest)`, `zone hall: follow 1.5 is outside 0 (fixed) to 1 (the follow camera)`), and with `the area is at least 0.5 m along x` (Last Light `level-edits.ts` `areaOf`). So removing the first zone of several, or the only one, is refused. A zone is still named by the rooms and openings whose `zone` it is: removal is refused with `room a: zone a` and `opening ab: zone a`.
5. **A nav edge is a link** (`profile/thing-links.ts`: `ThingLink { a, b, via? }`, `ThingLinks<D> { def, noun, list, add, remove }`, `LevelProfile.links`, optional; AF sector has none). Last Light's joins things of `node` and passes through a box (`via`, the door). The edits are `addLink` (`link.add`, `Add nav edge a–b`) and `removeLink` (`link.remove`, `Remove nav edge a–b`), each one undo step; the spec's "nav edge add and remove".
6. **An edge is refused** where the shipped editor refuses it, in the checks' words where a check has one: `this blockout derives its nav from the rooms and openings …` (Last Light `handNav`) when `nav.derive` is not `false`; `no nav node x`; `an edge joins two different nodes`; `there is already an edge a–b` (either way round); `nav edge a–b: x is not a door box` (the `ids` sentence); `edge a–b is not clear by 0.3 m with the doors open` (the `nav` sentence, through `clear` with every door open, as the check asks). Removing one that is not there is `no nav edge a–b`.
7. **The Things tool:** a drag that starts on nothing with a definition that has an `area` picked draws a rectangle (`gesture: 'area'`), rounded to the grid as a place is; `view.place` carries the rectangle and the dry run's answer; the drag's end adds the thing at the rectangle's middle with the four sides as values, as one undo step (cancelled: nothing). A zone placed this way starts with whatever `pick` gave it (`{ distance: 14, follow: 1 }` is the shipped editor's follow camera) and floats at its sector's floor (the shipped editor writes a look height of 1, which the follow camera ignores). `startLink(via?)` with one thing of the links' definition selected starts a link from it (`view.linking`); hovering another shows `view.link`, a dry run like `place`; a tap on one adds the link and ends the mode, a refusal keeps it with the sentence, a tap on nothing or `cancelLink()` ends it. `unlink(a, b)` removes a link. The links' sub-layer being hidden or locked refuses all three with the layer's sentence.

## Contract

```
packages/editor-3d/src/checks/last-light/ids.ts            zoneProblems, edgeDoorProblem
packages/editor-3d/src/checks/last-light/nav-problems.ts   NAV_MARGIN, unclearEdge
packages/editor-3d/src/entities/thing-def.schema.ts        ThingDef.area
packages/editor-3d/src/profile/last-light-entities.ts      the zone definition, zones read as things
packages/editor-3d/src/profile/last-light-zones.ts         zoneThing, zoneAccess (add, replace, remove, references)
packages/editor-3d/src/profile/thing-links.ts              ThingLink, ThingLinks
packages/editor-3d/src/profile/last-light-nav-links.ts     lastLightNavLinks
packages/editor-3d/src/profile/level-profile.ts            LevelProfile.links?
packages/editor-3d/src/model/link-edits.ts                 addLink, removeLink
packages/editor-3d/src/things/things-tool-controller.ts    gesture 'area', ThingPlace.area, view.linking, view.link,
                                                           startLink, cancelLink, unlink
packages/editor-3d/src/index.ts                            the public entry gains them
```

```ts
export interface ThingLink {
  readonly a: string;
  readonly b: string;
  readonly via?: string | undefined;
}
export interface ThingLinks<D> {
  readonly def: string; // the definition whose things a link joins
  readonly noun: string; // 'nav edge', for labels
  list(doc: D): readonly ThingLink[];
  add(doc: D, link: ThingLink, geometry: Geometry): D; // throws ThingAccessError
  remove(doc: D, a: string, b: string): D; // throws ThingAccessError
}
export function addLink<D>(link: ThingLink): Edit<D>;
export function removeLink<D>(link: Pick<ThingLink, "a" | "b">): Edit<D>;
export interface Rectangle {
  readonly x0: number;
  readonly z0: number;
  readonly x1: number;
  readonly z1: number;
}
export type LinkPlace = ThingLink &
  (
    | { readonly action: "add" }
    | { readonly action: "none"; readonly reason: string }
  );
```

## Steps

Tests use the toy blockout (rooms `a` (0, 0)–(4, 4) and `b` (4.125, 0)–(7, 4), the door `abDoor` in the opening between them, one zone `a`), with `nav.derive: false` and a few nodes where a case needs them, the four shipped blockouts, and the depot for the AF profile.

- [x] **1. The zone and edge sentences have one owner** (`checks/last-light/ids.test.ts`, `nav-problems.test.ts`; `ids.ts`, `nav-problems.ts`).
  - *Red, by case:* `zoneProblems(zones)` gives the first zone's, a later zone's and a follow's sentence with their locators; `edgeDoorProblem` says `nav edge a–b: x is not a door box` and nothing for a door box or no door; `unclearEdge` says `edge a–b is not clear by 0.3 m with the doors open` for an edge through a wall and nothing for a clear one or one through an open door. The checks' own tests stay as they are and green.
  - *Expected failure:* the three functions are not exported.
  - *Done 2026-10-30:* red (5 failing: not exported), then green; `idProblems` and `navProblems` now call `zoneProblems`, `edgeDoorProblem` and `unclearEdge`, and the checks' 389 tests and the checks golden are unchanged.
- [x] **2. A zone is a thing** (`entities/thing-def.schema.test.ts`, `profile/last-light-entities.test.ts`, `profile/last-light-zones.test.ts`, `profile/last-light-things.test.ts`, `model/thing-edits.test.ts`; `thing-def.schema.ts`, `last-light-entities.ts`, `last-light-zones.ts`, `last-light-things.ts`).
  - *Red, by case:* `area` must name four different float fields; the zone definition reads every zone of the four shipped files as a thing at its look point with its fields, no reader problem and no field misfit, and every locator of the seeded violations now names a definition (the zone exception goes); each shipped zone written back unchanged is the level itself; moving a zone changes only its `look`; setting `x0` gives an area side, clearing the last side of a later zone is refused in the `ids` sentence, a side on the first zone is refused, a side under 0.5 m is refused, `follow` past 1 is refused by the field; adding a zone appends it with `id`, `look`, `distance`, `follow`, `area` in the file's order and is refused without an area; removal is refused while a room or an opening names it and for the first of several; `takenIds('zone')` is the zone ids; the codec writes an added and a moved zone as a minimal patch.
  - *Expected failure:* `area` is not in the schema; no `zone` definition.
  - *Done 2026-10-30:* red (the `area` refusals missing; 10 entity tests failing on the missing definition), then green: `profile/last-light-zones.ts` (`zoneDefinition`, `zoneEntry`, `zoneAccess`), 18 tests in `last-light-zones.test.ts` through the four thing edits; the 7a "every thing as read is the level itself" test now covers every shipped zone, the `entities` check's detail on the toy is `4 things of 7 definitions`, and the seeded violations' zone exception is gone. A zone problem is compared by its sentence and its locator, so adding a zone with an area to a level with none is refused as well (a level with no zone and one whose first zone has an area say the same sentence).
- [ ] **3. A nav edge is a link** (`profile/last-light-nav-links.test.ts`, `model/link-edits.test.ts`; `thing-links.ts`, `last-light-nav-links.ts`, `level-profile.ts`, `last-light-profile.ts`, `link-edits.ts`).
  - *Red, by case:* `list` is the file's edges; `addLink` adds `[a, b]` and `[a, b, door]` as one undo step labelled `Add nav edge a–b`; refused in each sentence of decision 6 (derived nav, a missing node, one node twice, an edge already there either way round, a via that is not a door box, an edge through a wall); an edge through the open door is accepted; `removeLink` takes out the edge either way round, refuses one that is not there; after an accepted add the `nav` and `ids` checks have no new problem; the AF profile has no links and `addLink` is refused with `this level has no links`; a node with an edge still cannot be removed, and can once the edge is gone.
  - *Expected failure:* the modules are missing.
- [ ] **4. The Things tool draws rectangles and links** (`things/things-tool-controller.test.ts`; `things-tool-controller.ts`).
  - *Red, by case:* with `zone` picked, a drag on nothing is `gesture: 'area'` with the rectangle rounded to the grid in `view.place`, and its end adds `zone1` with that area as one step and selects it; a too-small rectangle is refused with the sentence; a cancelled drag adds nothing; a drag with a point definition picked on nothing is still not taken; a drag from a zone's marker moves it; `startLink` without one node selected answers `select one node first`; with one, `view.linking` names it, a hover over another node is a `link` preview (`add`, or `none` with the sentence), a tap adds the edge as one step and ends the mode, a refused tap keeps it, a tap on nothing ends it, `cancelLink` ends it; `unlink` removes an edge and answers the sentence for one that is not there; a hidden or locked `node` layer refuses `startLink` and `unlink`; the AF depot answers `this level has no links`.
  - *Expected failure:* `startLink`, `unlink` and the `area` gesture are missing.
- [ ] **5. Entry, gates and records.** The entry exports the new names (asserted in `index.test.ts`). Run in order: `pnpm format`, `TURBO_FORCE=true pnpm check`, `pnpm api-report` (no change: private package), `pnpm changeset status --since=origin/main`, `node tooling/release/src/check-changesets.ts`.

## Verification

Local, Node 24: the package's focused tests while iterating, then `pnpm check`. No browser or GPU suite is selected (no DOM, no painting, no sim code).

## Risks

| Risk                                                                     | Mitigation                                                                                                                          |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Zones as things change what the `entities` check says of a shipped level | Every shipped zone's look point is in a sector and its values fit (step 2 asserts no new problem); the checks golden stays as it is |
| An edit and the `ids` or `nav` check disagree about a zone or an edge    | The edits call the checks' own functions for those sentences (step 1)                                                               |
| The tool's file passes 600 lines                                         | The link mode moves into its own module if it does                                                                                  |

## Execution log
