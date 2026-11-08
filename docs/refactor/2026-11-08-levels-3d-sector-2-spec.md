# Levels 3D opens real 3D rooms: design spec

- **What this is:** the spec for Levels 3D reading and writing `af-sector/2`, written with `superpowers:brainstorming`
  (no subagents) on 2026-11-08. Its plan is [2026-11-08-levels-3d-sector-2-plan.md](2026-11-08-levels-3d-sector-2-plan.md);
  its tasks join the [3D slice plan](2026-11-07-3d-slice-plan.md) as 15.5 and 16.1b to 16.1e.
- **Checked against:** PR #476's head `399d0558` (branch `claude/project-thread-m6iu2z`), where this branch starts.
- **Path:** architectural (a format change under the editor's whole edit model, and a contract change in
  `@automata/3d/level`). The brainstorming gates (questions, sections, the written-spec review) are met by the Owner's
  standing words, "everything is auto approved and accepted, do not wait on me to do any approvals" (2026-10-31), and by
  the Opus plan audit that follows this document; the user's rule wins over the skill's gate.

## 1. The brief

**Found by the 3D editor build (thread m6iu2z, PR #476):** a person who opens Ember Hall's room
(`games/base-3d/content/levels/room.af-sector.json`) in Levels 3D gets "af-sector/2 is not a version this editor reads
(af-sector/1)". The same is true of every game `create-game --template 3d` makes (its room is `/2`), so the whole 3D
game loop of task 18.3 cannot start.

**Why:** task 7.1 made `/2` the game's format and gave core one reader, `readLevel` (`@automata/3d/level`), but the
editor's level profile is typed on `/1` (`AfSector`, a number for a floor, a wall's `texture`) under about 2,200 tests.
Task 7.1's log moved the editor's switch to 14.1 and 16.2; neither task does it (14.1 moved files, 16.2 assumes it).

**Asked for (the coordinator's brief, 2026-11-08 06:47):**

1. Levels 3D reads and writes `af-sector/2`, so a person can open, draw, view and save Ember Hall, then play it and see
   their edits.
2. No bridge that drops fields.
3. On the real page: a 3D game shows both a Levels and a Levels 3D tab; the Studio tab should be called Characters; the
   refusal text is dark on dark.
4. Humans edit content; behaviour stays code. Every word passes the drunk grandma test.

**Assumed (say so if wrong):** `/1` files still open (the toy and sample levels, older checkouts), and are written as
`/2` from the first change. Lamps are moved and removed here but placed by 16.2's Lamp tool. Camera views are picked
per room, not edited (their numbers stay as written).

## 2. What done looks like

1. Ember Hall opens in Levels 3D in the suite, in Plan, 3D and Walk, with its five rooms, both pits, its five props and
   its three things.
2. A person can draw a room, move a crate, raise a floor, mark a room as a pit and pick its camera, and each is one
   Undo.
3. The file on disk changes only where the person changed it: every other byte stays, numbers keep their written form
   (`"floor": 0` stays a number; a plane written as an object stays an object), and every member the editor does not
   edit (views, sky, dress, decals, lettering, masses, paths, look, time, reads, seed, grime, a room's door and zone, a
   wall's decor, bands and window grid) is still there, as written.
4. Play shows the edit: the crate is where it was put, the floor is at its new height (journey, read from the game's
   own state, not a screenshot).
5. A `/1` file opens with the words of section 6 and is written as `/2` from the first change, nothing lost.
6. A 3D game's tabs are its own editors, with one Levels; the figure editor is called Characters; a file that does not
   open is shown in words a person can read (contrast at least 4.5:1).

## 3. Approaches

**A. Retype the edit model on `/2` (`EditSector.floor: Plane`, `EditWall.surface`).** The model would match the file.
Cost: about 64 places read a height as a number (edits, checks, geometry, views) and about 50 test files build
fixtures with numbers; the risk is in the size of the change, not its idea.

**B. One `/2` profile whose access objects translate (chosen).** The edit model keeps its own vocabulary (a room has a
floor *height*, a wall has a *texture* name), which every edit and its tests already speak. The `/2` profile's access
objects are the one place that knows the file's shape: they hand the edits a view of each room and write the edits back
into the file's own members. The written values ride with each view, so nothing an edit does not touch is lost, and a
round-trip property test over every fixture proves it. The `/1` profile goes; a `/1` file is upgraded on open.

**C. Keep the `/1` profile and add a `/2` one beside it.** Two profiles for one format family means every edit is tested
twice and the `/1` one is dead weight once the toy levels are upgraded. Rejected.

B is chosen because it changes the files that know the format and leaves the edits, which are the bulk of the tests,
alone; and because the projection is small enough to prove lossless by test. The cost if wrong: a later edit that needs
a slope or a placed surface has to widen the view (the access objects are where it would go).

## 4. The model the editor holds is the file as written

The editor writes a change by diffing two models and patching the text (`patchJson`), and it refuses unless the model
it starts from equals `JSON.parse(text)`. Core's `afSector2Schema` turns a bare-number plane into `{ z }`, so a model
parsed by it never equals Ember Hall's text (`"floor": 0`), and every save would be refused.

So core gains the file *as written*:

- `afSector2FileSchema` and `type AfSector2File`: the same members as `afSector2Schema`, with a plane as written,
  `number | Plane`, and no transform. Both schemas are made by one function from the plane's schema, so they cannot
  drift. `afSector2Schema` is unchanged for every reader (the game, the world builder).
- `planeZ(plane: number | Plane): number` and `withPlaneZ(plane, z)` (keeps a number a number, an object an object).
- `migrateAfSector1File(level: AfSector): AfSector2File`: the format and each wall's `texture` to `surface`; planes stay
  as written. `migrateAfSector1` becomes "migrate the file, then read its planes", so the two cannot disagree.

The `af-sector-2.schema.ts` file is 577 lines today; the walls, decor, bands and dressing go to
`af-sector-2-parts.schema.ts` so both stay under 600.

## 5. One `/2` profile

`packages/editor-3d/src/shared/level-session/af-sector/` becomes the `/2` profile (`afSector2Profile`, codec id
`af-sector`), and the `/1` profile is deleted. Its parts:

- **Codec:** `afSector2FileSchema`; member orders from `AfSector2`'s field order (file: `format, name, title,
  materials, styles, views, sectors, masses, props, cast, lamps, time, look, paths, sky, seed, grime, dress, reads,
  decals, lettering, entityDefs, entities`; room: `/1`'s plus `zone, pit, grime, door, dress`); id arrays `sectors,
  props, cast, lamps, entityDefs, entities`. A newer minor opens with the existing warning; another major is refused.
- **Upgrade:** the codec gets an optional `upgrade(text)`: for a `/1` file it returns the `/2` text made by patching the
  `/1` text to `migrateAfSector1File`'s model (so only `format` and the walls' `texture` keys change), or nothing for a
  file that needs none. `readLevel` (the editor's) upgrades first, then parses; the outcome says `upgraded: true`.
- **Rooms (`SectorAccess`):** `list` gives one view per room, the same object each time for the same room (a `WeakMap`),
  with `floor` and `ceiling` as heights and each wall's `texture` as its surface's swatch name. The written planes, the
  written surfaces and the room's first corner ride on the view under a symbol, so an edit that spreads a room keeps
  them. `withSectors` writes a view back: a height into its plane as written (`withPlaneZ`), a texture into its surface
  (a name stays a name; a placed surface keeps its placement and changes its `tile`), and every other member as the edit
  left it. A view the edit did not touch is the room itself, so an unchanged level is the same object.
  - A sloped plane's slope runs from the room's first corner (`world/sectors.ts`). When an edit moves that corner (a
    drag, a split, a merge, a reversed loop), the write-back moves `z` by the slope times the shift, so the surface stays
    where it was. A test pins it.
  - Things placed along a wall (`decor[].pos`) follow a reversed or split wall the way a door and a window already do
    (`reversedWall`, the split in `vertex-edits.ts`). A wall with a window grid (`windows`) cannot be split: "This wall
    has a row of windows. Take them off first, then split the wall."
- **Geometry (`build.ts`):** a `/2` room to the engine's `SectorDef` with `planeZ` heights and the surface's name; the
  level's `masses` go to `resolveOrThrow`. A `pit` room's floor is drawn as a pit in the Plan (hatched, with the word
  "Pit" in its label).
- **Things:** the editor's things are the file's `entities` (as now) and also its `props`, `cast` and `lamps`, each
  under a definition the profile makes from the game (section 7), so selecting, dragging, turning, removing and Undo
  work through the existing thing edits. A prop is written back as `{ id, use, at, angle? }`, a character as
  `{ id, who, at, angle? }`, a lamp as `{ id, kind, at }` with its other members untouched (`mergeMembers`). These
  definitions are read only: a definition edit on one says "Crate comes from the game's furniture, so it can't be changed
  here." The Things palette offers the game's furniture and characters; lamps are placed by 16.2's Lamp tool.
- **Materials and checks:** the material table edits rename and refuse over `/2`'s names (a wall's `surface` and its
  placed `tile`, `upper`, `lower`, the bands, a plane's `surface`, the sector textures). The checks gain one: a prop,
  swatch or character the game lacks ("The room uses a swatch called "rust", but the game has none. Pick another in the
  room's Floor.").
- **New level:** the New level template writes `/2`.

The fields `/2` adds are covered like this:

| Field | In the editor |
|---|---|
| plane `z` | edited as the room's floor or ceiling height |
| plane `slope`, `sky`, `surface` | carried as written; `slope` kept in place when the first corner moves |
| wall `surface` | edited as the wall's material |
| `upper`, `lower`, `dado`, `cornice`, `skirting`, `rail`, `trim` as a surface, `none` | carried as written (16.2 edits trim) |
| `decor` | carried; follows a split or reversed wall |
| `windows` | carried; a wall with a grid refuses a split (16.2 edits it) |
| room `pit` | a checkbox, "Pit (the player falls in)" |
| room `view` and the file's `views` | a picker, "Camera", of the file's views and "None" |
| room `zone`, `grime`, `door`, `dress` | carried as written |
| `props`, `cast` | things: shown, placed, moved, turned, removed |
| `lamps` | things: shown, moved, removed; placed in 16.2 |
| `masses` | drawn as solid blocks; carried as written |
| `title`, `time`, `look`, `paths`, `sky`, `seed`, `grime`, `dress`, `reads`, `decals`, `lettering` | carried as written (16.2 edits `time`) |

## 6. Opening and the words

- A `/2` file opens with no message.
- A `/1` file opens with a line in the status bar: "This room was made with an older version. Your next change saves it
  in the new version, and nothing in it is lost." The first change writes the upgraded text with the change, as one
  write and one Undo.
- A file that does not open is a card on the canvas in the stage's light ink on the dark stage, at least 4.5:1:
  "<File> can't be opened." (Ember Hall's is "Room can't be opened.") then the reason in words ("It was made by a newer version of the editor. Update
  AF, then open it again.") and "Your file is unchanged." No format id, path or schema text on screen (18.1's rule);
  the details stay behind a "Details" disclosure for a person who asks.

## 7. The game's library, read only

Levels 3D reads the game's furniture (`world-props`), swatches (`world-swatches`) and characters (`figures`) from the
content folder that holds the level's `levels/` folder, through the suite workspace (`read`, and a listing of a folder).
It never writes them. They feed the Things palette (by name: "Crate", "Barrel"), the material picker (each swatch with
its DUEL colour), the "missing name" check, and the 3D view's world build (16.3). A game with none of these folders
gets the file's own `materials` table and the names it already uses, as today.

If the workspace port has no way to list a folder, it gets one optional method, `list(folder)`, backed by the dev
server's existing listing; a port without it gives the fallback above.

## 8. The suite on a 3D game

- **One Levels.** The rail shows an editor only when the game's editor list names it (both pages). When the list does not
  load, every installed editor shows, read only, as today. A game that lists only one level editor sees it called
  "Levels"; a game that lists both sees "Levels 2D" and "Levels 3D".
- **Characters.** The figure editor's label, card and on-screen name are "Characters" (its id stays `studio`, which the
  editor lists use).
- **The refusal card** as in section 6.

## 9. Proof

- Core: the two schemas agree on every fixture; `migrateAfSector1File` changes only `format` and wall `texture` keys;
  `planeZ`/`withPlaneZ` keep the written form.
- Editor, unit: for every fixture (the toy level upgraded, the depot, Ember Hall, both base scenes, the five builder
  maps), `withSectors(level, list(level)) === level`; for every edit in the existing suites, run on the `/2` fixtures,
  every member outside the one edited is unchanged (`firstDifference` limited to the edit's path); Ember Hall opened,
  edited and patched leaves every other byte; a sloped room's surface stays when its first corner moves.
- Editor, DOM and layout: the pit checkbox, the camera picker, the things palette with furniture, at the eight sizes.
- Suite: the rail on a 3D game has Levels and Characters (and Tuner), not Levels 3D; the refusal card's contrast.
- Journey (served, Chromium, phone and iPad): copy base-3d, open the room, move a crate, raise a floor, check the file,
  Play, read the crate's place and the floor's height from the running game.
- The existing editor-3d counts stay, but for tests that test the `/1` profile itself, each named in the log.

## 10. Out of scope

Editing a camera view's numbers, slopes, placed surfaces, bands, decor and window grids (16.2 takes trim, windows and
time; the rest waits for a person to ask); the world-kit's dressing (`dress` is carried, never filled: core never
imports an extension); drawing the views in the game's look (16.3).
