# Levels 3D opens real 3D rooms: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task by task,
> with superpowers:test-driven-development for every code change and superpowers:verification-before-completion before
> ticking a box. Native, in the session: the Owner allows no subagents (no Task-tool delegation, no workflows). Steps use
> checkbox (`- [ ]`) syntax. Tick a step only when its check has passed, in the same session.

**Goal:** Levels 3D reads and writes `af-sector/2`, so a person opens Ember Hall's room, draws, views and saves it, then
plays it and sees their edits; a 3D game's suite shows one Levels and a Characters tab, and a file that does not open
says so in readable words.

**Architecture:** Core gains the level *as written* (`afSector2FileSchema`: a plane is `number | Plane`, no transform),
because the editor patches text from a model that must equal `JSON.parse(text)`. Editor-3d's `/1` profile becomes one
`/2` profile whose access objects translate between the file and the edit model's vocabulary (heights and a wall's
texture name), carrying every written value on the view, so the edits and their tests stay; a `/1` file is upgraded on
open. The file's props, characters and lamps become things, defined from the game's own content, read only.

**Tech Stack:** pnpm 10, Node 24 (`/opt/node24/bin`), TypeScript, Zod 4.6.6, Svelte 5.57, Vitest 5 (browser mode),
Playwright 1.63.

**Spec:** [2026-11-08-levels-3d-sector-2-spec.md](2026-11-08-levels-3d-sector-2-spec.md). The tasks join the
[3D slice plan](2026-11-07-3d-slice-plan.md) (section "Where these tasks go" below).

## Global Constraints

- The 3D slice plan's Global Constraints hold (TDD, 600-line files, `--features`, `pnpm format` then `pnpm check`,
  Conventional Commits with the session's attribution lines, copy in `docs/refactor/copy.md` under "3D editors", 44 px
  targets and 48 px primary actions, Chromium in the cloud and WebKit/Firefox ticked for the runner).
- No bridge that drops fields: every member of a `/2` file the editor does not edit is written back as it was written.
- A number in the file stays a number and an object stays an object (`"floor": 0` is never rewritten as `{ "z": 0 }`).
- `afSector2Schema`, `readLevel` and `migrateAfSector1` keep their signatures and results; base-3d's replay hash and the
  render goldens do not move.
- Levels 3D never writes the game's library (`world-props`, `world-swatches`, `figures`) and never imports an extension.
- Behaviour stays code: the editor edits data in the level file only.
- Words on screen name no format id, path, schema message, plan ID or source name; the details are behind "Details".
- `@automata/3d` gets no changeset (phase 20); `@automata/editor` and `editor-3d` are private. If an exported type of a
  published package changes, `pnpm build`, `pnpm api-report --update`, `pnpm api-index --write`.

## Review Focus

1. **A plane written as an object with a slope, whose room's first corner is dragged, split off or merged away:** the
   floor's surface stays where it was (z re-based by the slope). Test in 16.1c:
   `a sloped floor stays put when its first corner moves`.
2. **A `/2` file with members no edit knows (views, sky, decor, a placed surface, `dress`, a room's `door`), then ten
   different edits and their Undo:** the text after Undo is byte for byte the text before. Test in 16.1c:
   `every edit and its undo leave the rest of Ember Hall's text unchanged`.
3. **A `/1` file opened, then closed without a change:** the file on disk is untouched; the first change writes the
   upgrade and the change as one write, one Undo, and Undo puts the `/1` text back. Test in 16.1c:
   `an older room is written only with the first change, and Undo puts it back`.
4. **A level naming a prop, swatch or character the game does not have, or a game with no library folders:** the room
   opens, the thing is drawn as a plain box named by its id, the checks name it, and the palette offers the file's own
   names. Tests in 16.1d: `a prop the game lacks still opens and is named in the checks`,
   `a game with no library folders offers the file's own names`.
5. **The game's editor list fails to load on a 3D game:** the rail still shows every installed editor, read only, as
   today, not an empty bar. Test in 15.5: `a list that does not load shows every editor`.

## Where these tasks go

They run on branch `claude/project-thread-n9tc3p`, stacked on #476, after task 16.1's third slice, in this order:
15.5, 16.1b, 16.1c, 16.1d, 16.1e; then the rest of 16.1 (the label-left inspector, the layers sheet), 16.2, 16.3. The
3D plan's task count goes from 54 to 59. Changes to the 3D plan, made in the same commit as this plan:

- Task 7.1's log entry gets "The editor's switch to `/2` is tasks 16.1b to 16.1e."
- **16.2:** drop `placeProp` (furniture is placed from the Things palette, 16.1d); keep `placeLamp`, `setTimeOfDay`,
  `setWallTrim`, `setWindows` and the checks other than "a prop, swatch or character the game lacks" (16.1d).
- **16.3:** the 3D view builds its world from the library 16.1d reads (`gameLibrary`).
- **17.1:** "on-screen name Characters" is done in 15.5.
- **18.2:** `BASE_3D` in the fixtures is done in 16.1e; its Step 1 keeps only the clean-up test.

---

### Task 15.5: The suite shows a game's own editors, by their names

**Files:**
- Modify: `packages/editor/src/features/suite/shell/suite-entries.ts`, `Suite.svelte` (passes the list's editors),
  `home-model.ts` (`LABELS.studio = 'Characters'`), `packages/editor-3d/src/features/studio/studio-suite-editor.ts`
  (`label: 'Characters'`) and the Studio's own top bar name, `packages/editor-3d/src/features/levels-3d/Levels3dRegions.svelte`
  (the refusal card), `levels-3d-session.ts` (the refusal's words), `docs/refactor/copy.md`
- Create: `packages/editor/src/shared/kit/tokens/contrast.ts` (moved out of `tokens.test.ts`), exported from
  `@automata/editor/kit/testing`
- Test: `packages/editor/tests/unit/suite/shell/suite-entries.test.ts`,
  `packages/editor/tests/browser/layout/suite/shell/suite-phone.test.ts` (a full-page case),
  `packages/editor-3d/tests/unit/levels-3d/levels-3d-session.test.ts`,
  `packages/editor-3d/tests/browser/layout/app/suite/suite-levels.test.ts` (the card's contrast)

**Interfaces:**
- Produces: `suiteEntries(editors: readonly Pick<SuiteEditor<unknown>, 'id' | 'label'>[], listed?: readonly string[]): SuiteEntry[]`
  (`listed` undefined when the list did not load); `contrastRatio(foreground: string, background: string): number`
  (CSS colours, WCAG ratio).

- [ ] **Step 1: Write the failing tests**

```ts
it('shows only the editors the game lists, with one Levels', () => {
  const entries = suiteEntries([tuner, levels2d, levels3d, studio], ['levels-3d', 'studio', 'tuner'])
  expect(entries.map((e) => e.label)).toEqual(['Tuner', 'Levels', 'Characters'])
})
it('says Levels 2D and Levels 3D when the game lists both', () => {
  expect(suiteEntries([levels2d, levels3d], ['levels-2d', 'levels-3d']).map((e) => e.label))
    .toEqual(['Levels 2D', 'Levels 3D'])
})
it('a list that does not load shows every editor', () => {
  expect(suiteEntries([tuner, levels2d, levels3d], undefined)).toHaveLength(3)
})
it('a room made by a newer version says so in words', async () => {
  const session = await openLevels3d(files('room.af-sector.json', '{"format":"af-sector/3","name":"r","sectors":[]}'), ports, options)
  expect(session.state).toMatchObject({ kind: 'error',
    message: "Room can't be opened.",
    reason: 'It was made by a newer version of AF. Update AF, then open it again.' })
})
// layout, eight sizes: the refusal card's text against its background
expect(contrastRatio(style(heading).color, backgroundOf(card))).toBeGreaterThanOrEqual(4.5)
expect(card.textContent).not.toMatch(/af-sector|\.json|format/)
```

  And in `suite-phone.test.ts`, the full page on a 3D game (`SAMPLE_3D`'s list): tabs `['Tuner', 'Levels', 'Characters']`.
- [ ] **Step 2: Run, expect FAIL** (`pnpm exec vitest run --project unit` in each package; the layout files with
  `--project 'layout (chromium)'`): four labels and the card's ratio (the stage is `--charcoal`, the text `--ink`).
- [ ] **Step 3: Implement.** The rail filters by `listed`; a level editor's label is "Levels" when it is the only
  `levels-*` id listed, else "Levels 2D"/"Levels 3D" (the 2D editor's label is "Levels" today, so the rule decides
  both). `Levels3dState`'s error gets `reason: string` and `details: readonly ParseIssue[]`; the card is the stage's
  ink (`--stage-ink`, `--stage-muted`) on the stage, with `<details><summary>Details</summary>` around the issues. The
  words (copy.md, old and new): missing file "There is no such file."; newer major "It was made by a newer version of
  AF. Update AF, then open it again."; any other refusal "Something in it isn't written the way a room is. Details
  says where."; the heading `${fileTitle(path)} can't be opened.`; then "Your file is unchanged."
- [ ] **Step 4: Run, expect PASS**; editor and editor-3d unit, Chromium layout `suite`, `app/suite`; `pnpm knip`.
- [ ] **Step 5: Commit** `fix(suite): a game's own editors by their names; a room that won't open says why`

### Task 16.1b: The level as written, in core

**Files:**
- Create: `packages/3d/src/shared/level/af-sector-2-parts.schema.ts` (surfaces, walls, decor, bands, window grid,
  dress: moved from `af-sector-2.schema.ts`), `packages/3d/src/shared/level/plane.ts`
- Modify: `af-sector-2.schema.ts` (one `levelSchemas(plane)` makes both schemas), `af-sector-1-to-2.migration.ts`,
  `packages/3d/src/entries/level.ts` (exports)
- Test: `packages/3d/tests/unit/shared/level/af-sector-2-file.test.ts`, `migration.test.ts`

**Interfaces:**
- Produces: `type WrittenPlane = number | Plane`; `type AfSector2File` (as `AfSector2` with every `floor`/`ceiling` a
  `WrittenPlane`); `afSector2FileSchema: z.ZodType<AfSector2File>`; `planeZ(plane: WrittenPlane): number`;
  `withPlaneZ(plane: WrittenPlane, z: number): WrittenPlane`; `migrateAfSector1File(level: AfSector): AfSector2File`.
  Exported from `@automata/3d/level` with the types `AfSectorEntry2File`, `AfWall2`, `Surface`, `SurfaceTex`,
  `PropPlace`, `CastPlace`, `LampPlace`.

- [ ] **Step 1: Write the failing tests**

```ts
it('reads a level as written: a number stays a number', () => {
  const room = afSector2FileSchema.parse(EMBER_HALL) // games/base-3d/content/levels/room.af-sector.json
  expect(room).toEqual(EMBER_HALL)
  expect(room.sectors[0].floor).toBe(0)
})
it('agrees with the reader on every fixture', () => {
  for (const f of V2_FIXTURES) // Ember Hall, BASE_SCENES' two levels, the five converted builder maps
    expect(afSector2Schema.parse(afSector2FileSchema.parse(f))).toEqual(afSector2Schema.parse(f))
})
it('keeps a plane as it is written', () => {
  expect(withPlaneZ(0, 1.5)).toBe(1.5)
  expect(withPlaneZ({ z: 0, slope: [0.1, 0] }, 1.5)).toEqual({ z: 1.5, slope: [0.1, 0] })
  expect(planeZ({ z: 2 })).toBe(2)
})
it('upgrades a /1 file by its format and its walls\' texture only', () => {
  for (const f of V1_FIXTURES) {
    const two = migrateAfSector1File(f)
    expect(paths(diff(f, two))).toEqual(['format', ...wallTexturePaths(f)])
    expect(afSector2Schema.parse(two)).toEqual(migrateAfSector1(f))
  }
})
```

- [ ] **Step 2: Run, expect FAIL** (`pnpm --filter @automata/3d exec vitest run --project unit shared/level`).
- [ ] **Step 3: Implement.** `levelSchemas(plane: z.ZodType<WrittenPlane | Plane>)` returns the room and level
  schemas; `afSector2Schema = levelSchemas(planeSchema).level` (unchanged output), `afSector2FileSchema =
  levelSchemas(z.union([z.number(), planeObjectSchema])).level`. `migrateAfSector1 = (l) =>
  afSector2Schema.parse(migrateAfSector1File(l))`. Both schema files stay under 600 lines.
- [ ] **Step 4: Run, expect PASS**; the 3D unit tests and base-3d's unit tests and golden replay (hash unchanged);
  `pnpm boundaries` (`@automata/3d/level` imports only zod).
- [ ] **Step 5: Commit** `feat(3d): the level as written, so an editor can patch it byte for byte`

### Task 16.1c: One `/2` profile (**session break** after the fixtures are upgraded)

**Files:**
- Modify (retyped on `AfSector2File`; the folder and file names stay): `packages/editor-3d/src/shared/level-session/af-sector/{af-codec,af-sectors,build,af-things,af-entities,af-definitions,af-checks,af-material-edits,af-template}.ts`,
  `af-sector-profile.ts`, `registry.ts`, `materials.ts`, `file-codec.ts` (optional `upgrade`),
  `features/levels-3d/document/read-level.ts` (upgrades first), `features/levels-3d/levels-3d-session.ts` (holds the
  upgrade until the first step), `features/levels-3d/home/new-level.ts`, `shared/edit/wall-geometry.ts` and the split in
  `shared/edit/vertex-edits.ts` (decor follows), `src/app/suite/sample-3d/hall.af-sector.json`,
  `src/testing/fixtures/depot.af-sector.json`, `packages/editor/src/testing/suite/fixtures/depot.af-sector.json`,
  `src/testing/toy-af-sector.ts` (upgraded to `/2`: format and wall `texture` keys only)
- Create: `shared/level-session/af-sector/room-views.ts` (the views and their write-back)
- Test: `tests/unit/shared/level-session/af-sector/room-views.test.ts`, `ember-hall.test.ts`; the existing
  `af-sector/*.test.ts` and `shared/edit/*.test.ts` on the upgraded fixtures; `levels-3d-session.test.ts`

**Interfaces:**
- Consumes: 16.1b's `afSector2FileSchema`, `planeZ`, `withPlaneZ`, `migrateAfSector1File`.
- Produces: `afSectorProfile: LevelProfile<AfSector2File>` (the only profile); `FileCodec.upgrade?(text: string):
  string | undefined`; `ReadOutcome` `parsed` gains `upgraded: boolean` and `original: string`;
  `roomView(entry: AfSectorEntry2File): EditSector` and `writeRoom(view: EditSector): AfSectorEntry2File`.

- [ ] **Step 1: Upgrade the fixtures** (format and wall `texture` → `surface` only, by `migrateAfSector1File`) and
  record the counts before: editor-3d unit (2127 at #476's head), layout, canvas, journeys. Run the suites → the
  failures are only the `/1` profile's own tests (the schema refuses `/2`). **Session break here if needed.**
- [ ] **Step 2: Write the failing tests**

```ts
it('lists the same view for the same room, and writes an untouched level back as itself', () => {
  for (const f of V2_FILE_FIXTURES) {
    const rooms = afSectorAccess.list(f)
    expect(afSectorAccess.list(f)[0]).toBe(rooms[0])
    expect(afSectorAccess.withSectors(f, rooms)).toBe(f)
  }
})
it('writes a height into the plane as it was written', () => {
  const raised = editFloor(EMBER_HALL, 'start', 0.5)
  expect(raised.sectors[0].floor).toBe(0.5)
  expect(editFloor(SLOPED, 'ramp', 1).sectors[0].floor).toEqual({ z: 1, slope: [0.25, 0], surface: 'stone' })
})
it('writes a texture into the surface as it was written', () => {
  expect(wallOf(setTexture(PLACED, 'brick')).surface).toEqual({ tile: 'brick', repeat: [2, 1] })
})
it('a sloped floor stays put when its first corner moves', () => {
  const moved = moveCorner(SLOPED, 'ramp', 0, [1, 0])
  expect(heightAt(moved, 'ramp', [4, 2])).toBeCloseTo(heightAt(SLOPED, 'ramp', [4, 2]))
})
it('every edit and its undo leave the rest of Ember Hall\'s text unchanged', () => {
  for (const edit of TEN_EDITS) { // draw a room, move a corner, split a wall, raise a floor, set a texture, add/move/remove a thing, merge, delete
    const after = applyAndPatch(EMBER_HALL_TEXT, edit)
    expect(outsidePath(after, edit.path)).toEqual(outsidePath(EMBER_HALL_TEXT, edit.path))
    expect(undoAndPatch(after, edit)).toBe(EMBER_HALL_TEXT)
  }
})
it('decor follows a reversed wall', () => {
  expect(reversedWall({ decor: [{ kind: 'sign', pos: 1, width: 1 }] }, 4)).toMatchObject({ decor: [{ pos: 3 }] })
})
it('a wall with a row of windows is not split', () => {
  expect(splitWall(GRID, 'shop', 0, 2)).toEqual(refused('This wall has a row of windows. Take them off first, then split the wall.'))
})
it('an older room is written only with the first change, and Undo puts it back', async () => {
  const session = await openLevels3d(files('room.af-sector.json', V1_TEXT), ports, options)
  expect(ports.writes).toEqual([])
  draw(session)
  expect(ports.writes).toHaveLength(1)
  expect(JSON.parse(ports.writes[0].text).format).toBe('af-sector/2')
  await suiteUndo(session)
  expect(await ports.read('room.af-sector.json')).toBe(V1_TEXT)
})
```

  `SLOPED`, `PLACED` and `GRID` are small `/2` fixtures in `src/testing/toy-af-sector.ts` (a ramp room with
  `floor: { z: 0, slope: [0.25, 0], surface: 'stone' }`, a wall with `surface: { tile: 'tiles', repeat: [2, 1] }`, a
  wall with `windows`).
- [ ] **Step 3: Run, expect FAIL.**
- [ ] **Step 4: Implement.** The views carry `{ floor, ceiling, first: [x, z], walls }` as written under
  `const WRITTEN = Symbol('written')`; `writeRoom` re-bases a sloped plane's `z` by `slope · (newFirst − oldFirst)`, and
  matches a wall to its written surface by the view's own carried value (spread with the wall). Codec orders and id
  arrays are spec section 5's. The `/1` profile's code goes; `detectProfile` keeps "a format starting af-sector/". The
  status line shows, for an upgraded file, "This room was made with an older version. Your next change saves it in the
  new version, and nothing in it is lost." (copy.md).
- [ ] **Step 5: Run, expect PASS**; editor-3d unit (the count of step 1, less the `/1` profile's own tests, each named in
  the log), Chromium layout and canvas, journeys; the 2D editor's suite fixtures test; `pnpm knip`, typecheck.
- [ ] **Step 6: Commit** `feat(levels-3d): read and write af-sector/2, every member kept as written`

### Task 16.1d: Furniture, characters and lamps from the game

**Files:**
- Create: `packages/editor-3d/src/shared/level-session/game-library.ts` (reads the library),
  `shared/level-session/af-sector/af-placed.ts` (props, cast and lamps as things)
- Modify: `af-entities.ts`, `af-things.ts`, `af-definitions.ts` (read-only definitions refuse), `af-checks.ts` (the
  missing-name check), `materials.ts` (the game's swatches), `levels-3d-session.ts` (reads the library on open),
  `features/levels-3d/things/` (the palette groups: Things, Furniture, Characters), `plan/` (a thing's mark and turn);
  if needed `packages/editor/src/shared/kit/ports/suite-ports.ts` (`list?(folder)`) and its adapters
- Test: `tests/unit/shared/level-session/game-library.test.ts`, `af-sector/af-placed.test.ts`,
  `tests/unit/levels-3d/things/*.test.ts` (DOM), `tests/browser/layout/app/suite/suite-draw.test.ts` (a Furniture case)

**Interfaces:**
- Produces: `interface GameLibrary { swatches: ReadonlyMap<string, WorldSwatch>; props: ReadonlyMap<string, WorldProp>;
  figures: readonly string[] }`; `readGameLibrary(levelPath: string, workspace: SuiteWorkspace): Promise<GameLibrary>`
  (`EMPTY_LIBRARY` when there is none); thing definitions with ids `prop:<use>`, `cast:<who>`, `lamp:<kind>` and
  `readOnly: true`; the profile's `entities(doc, library)` and `materials(doc, library)`.

- [ ] **Step 1:** Check whether `workspace.files()` returns paths no editor-list row names (a unit test on
  `openSuitePorts` and `samplePorts`). If it does not, the port gets `list?(folder: string): Promise<readonly string[]>`
  backed by the dev server's listing, with a test per adapter; record which in the log.
- [ ] **Step 2: Write the failing tests**

```ts
it('reads base-3d\'s furniture and swatches by name', async () => {
  const library = await readGameLibrary('content/levels/room.af-sector.json', base3dWorkspace())
  expect([...library.props.keys()]).toEqual(['barrel', 'crate'])
  expect([...library.swatches.keys()]).toContain('lava')
})
it('a game with no library folders offers the file\'s own names', async () => {
  expect(afMaterials(TOY, await readGameLibrary('levels/toy.af-sector.json', emptyWorkspace())).map((m) => m.id))
    .toEqual(TOY_OWN_NAMES)
})
it('Ember Hall\'s crates are things you can move, turn and remove', () => {
  const kit = afEntityKit(EMBER_HALL, BASE_3D_LIBRARY)
  expect(kit.things.filter((t) => t.def === 'prop:crate').map((t) => t.id)).toEqual(['crate-1', 'crate-2', 'crate-3'])
  const moved = afThingAccess.replace(EMBER_HALL, 'prop:crate', 'crate-2', { ...crate2, x: 3, values: { angle: 90 } })
  expect(moved.props?.[1]).toEqual({ id: 'crate-2', use: 'crate', at: [3, 6.5], angle: 90 })
})
it('a crate placed from the palette is written as a prop', () => {
  expect(afThingAccess.add(EMBER_HALL, newThing('prop:crate', 'crate-4', 0, 10)).props?.at(-1))
    .toEqual({ id: 'crate-4', use: 'crate', at: [0, 10] })
})
it('a prop the game lacks still opens and is named in the checks', () => {
  expect(afSectorChecks(withProp(EMBER_HALL, 'piano'), BASE_3D_LIBRARY)).toContainEqual(expect.objectContaining({
    message: 'The room has furniture called "piano", but the game has none. Remove it, or add it to the game.' }))
})
it('furniture is not changed here', () => {
  expect(renameDefinition(EMBER_HALL, 'prop:crate', 'box')).toEqual(
    refused("Crate comes from the game's furniture, so it can't be changed here."))
})
// DOM: the palette shows Things (Ember, Goal, Spawn), Furniture (Barrel, Crate) and Characters, by name, never by id
```

- [ ] **Step 3: Run, expect FAIL.** **Step 4: Implement.** Names in words by `fileTitle` of the record's id
  (`crate` → "Crate"); a lamp is a thing with `y` its height; a prop with three `at` values writes `y` as the third. A
  thing whose definition the game lacks draws as a 0.5 m box with its id. Swatches parse with `worldSwatchContent`'s
  schema (`@automata/3d` world content entry); a record that does not parse is left out and named in the checks.
- [ ] **Step 5: Run, expect PASS**; editor-3d unit, Chromium layout `suite-draw` (eight sizes, mouse and touch: pick
  Crate under Furniture, tap in the hall, Undo reads "Undo Add crate"), canvas; `pnpm knip`.
- [ ] **Step 6: Commit** `feat(levels-3d): the game's furniture, characters and lamps in the room`

### Task 16.1e: Pits, cameras, and Ember Hall played after an edit

**Files:**
- Modify: `features/levels-3d/inspector/{inspector-cards.ts,inspector-edits.ts,SectorCard.svelte}` (Pit, Camera),
  `shared/edit/sector-edits.ts` (`setSectorPit`, `setSectorView`), `plan/plan-scene.ts` (a pit is hatched and labelled),
  `games/base-3d/src/testing/route.ts` (`showRoom`), base-3d's play view (calls it under the test flag),
  `packages/editor/tests/e2e/harness/fixtures.ts` (`BASE_3D`, a `game` fixture option)
- Create: `packages/editor/tests/e2e/journeys/levels-3d-edit-reaches-the-game.test.ts`
- Test: `tests/unit/shared/edit/sector-edits.test.ts`, `tests/unit/levels-3d/inspector/*.test.ts` (DOM),
  `games/base-3d/tests/unit/testing/route.test.ts`, the journey

**Interfaces:**
- Consumes: 16.1c's profile, 16.1d's things; `copyGame`, `runEditor`, `runGame` (`tests/e2e/harness/`).
- Produces: `setSectorPit(args: { sector: string; pit: boolean }): Edit<D>`, `setSectorView(args: { sector: string;
  view: string | null }): Edit<D>` (labels "Make <room> a pit", "Set the camera of <room>");
  `showRoom(world: RoomWorld, area: AreaSource, enabled: boolean, root: HTMLElement): void` writing
  `data-props="crate-1:-4.00,6.50;…"` and `data-floors="start:0.00;…"`.

- [ ] **Step 1: Write the failing tests**: `undo restores the level byte for byte` for both edits; `Pit is a checkbox
  that says "Pit (the player falls in)"`; `Camera lists the room's views by name and None` (Ember Hall: Start, Middle,
  Goal); `showRoom writes each prop's place and each floor's height only with the flag`; and the journey:

```ts
test('a crate moved and a floor raised in Levels 3D are where the game draws them', async ({ page, editor, game }) => {
  await openLevel(page, editor, 'Room')            // Ember Hall's room, in the suite's Levels tab
  await dragThing(page, 'crate-2', [3, 6.5])
  await setRoomField(page, 'middle', 'Floor height', '0.5')
  expect(readJson(game, 'content/levels/room.af-sector.json')).toMatchObject({
    props: expect.arrayContaining([expect.objectContaining({ id: 'crate-2', at: [3, 6.5] })]) })
  expect(changedLines(game, 'content/levels/room.af-sector.json')).toHaveLength(2)
  const play = await runGame(game, { testing: true })
  await expect(play.page.locator('html')).toHaveAttribute('data-props', /crate-2:3\.00,6\.50/)
  await expect(play.page.locator('html')).toHaveAttribute('data-floors', /middle:0\.50/)
})
```

  The journey runs at 1194 × 834 and 390 × 844.
- [ ] **Step 2: Run, expect FAIL.** **Step 3: Implement.** **Step 4: Run, expect PASS**: unit, DOM, Chromium layout at
  the eight sizes, the journey in Chromium (`pnpm --filter @automata/editor test:e2e --grep levels-3d-edit`), base-3d's
  unit tests and replay hash unchanged. WebKit on the runner.
- [ ] **Step 5:** Update `docs/refactor/progress.md` (59 tasks; rows 15.5, 16.1b to 16.1e) and the 3D plan's log.
  **Commit** `feat(levels-3d): pits and cameras; an edit to Ember Hall shows in play`

---

## Self-review (writing-plans, 2026-11-08)

1. **Spec coverage:** section 4 → 16.1b; 5 → 16.1c (codec, upgrade, rooms, geometry, materials, template) and 16.1d
   (things, checks); 6 → 15.5 (refusal) and 16.1c (upgrade line); 7 → 16.1d; 8 → 15.5; 9 → each task's tests and
   16.1e's journey; the field table's pit and camera → 16.1e. Masses: 16.1c's `build.ts` passes them.
2. **Types:** `AfSector2File`, `WrittenPlane`, `planeZ`, `withPlaneZ`, `migrateAfSector1File` (16.1b) are the names
   16.1c consumes; `GameLibrary` and `readGameLibrary` (16.1d) the names 16.1e and 16.3 use.
3. **Open choice, decided by a check:** whether the workspace port needs `list` (16.1d Step 1).
4. **Not proven here:** WebKit and Firefox (the runner), and the views in the game's look (16.3).
