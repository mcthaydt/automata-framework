# Edited content shows in play Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task
> (the project runs plans natively, never with subagents). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** What a person changes in an editor is what the game shows: 2D levels and placed characters drawn in play,
Writer, Sequence and Schematic content running in 2D games with a dialogue box and captions, animation clips edited in
Characters, and default controls as data edited in the Tuner.

**Architecture:** Tile rules, the `animation` schema and the `controls` kind live in `@automata/content` (one owner for
editor and game). Core (`@automata/framework`) gains four small functions (`levelScene`, `pictureView`,
`controlsFrom`, `usePlay`) and nothing that only some games need. A new types-only extension `places` replaces
"requires sectors" in `narrative`, `cutscenes`, `nav` and `systems`; `sectors` provides it in 3D unchanged, and a new
`level-2d` extension provides it in 2D with a 2D cutscene stage. The dialogue box and caption are `narrative`'s
`hud.overlay` components.

**Tech Stack:** TypeScript 6.0.3, PixiJS 8, Svelte 5.57.1, Zod 4.6.6, Koota (sim), Vitest 5.0.3 (jsdom + Testing
Library; Chromium, WebKit and Firefox for browser and parity), Vite 8.3.3.

**Spec:** [`2026-11-08-content-in-play-spec.md`](2026-11-08-content-in-play-spec.md)

**Base:** stacked on PR #478 (content editors). Before Task 1, merge up so the branch also has #473 (suite Levels 2D,
Add tiles) and #476: Task 7 reuses Add tiles' picture write, and Task 9 edits the suite Tuner. Record the merge in the
log.

## Global Constraints

- Goal (Owner, 2026-11-08 04:14): "I want humans to be able to modify content." Code stays the way to write behaviour.
  Nothing here adds ready-made behaviours or HUD pieces (spec §1).
- Core (`packages/*`) never imports an extension. Extensions are opt-in and never edit core's contracts.
- Laws: only the sim changes gameplay state; presentation observes. Same seed, content and inputs give the same hash in
  every engine. A 3D hash, golden or replay that moves means the change is wrong (spec §3.1).
- Feature folders (`app/`, `features/<x>/`, `shared/`, `entries/`, `testing/`); `pnpm boundaries` passes.
- Tests in `tests/` (`unit/<feature>/`, `browser/`, `e2e/`), suffix `.test.ts`, code imported as `#src/…`.
- Files at most 600 lines; kebab-case with role suffixes; comments say why, never which plan asked.
- Zod only; PixiJS only for drawing; Effect never in the sim or in `@automata/framework`.
- Copy passes the drunk grandma test: no key codes, schema words or package names on screen (spec §7).
- Touch targets at least 44 px, primary actions 48 px; phone first.
- Published packages changed get a `patch` changeset; `places` and `level-2d` are new extensions and follow the
  extensions' own publish rule (`extensions/*/package.json` of `feel` is the model).
- After changing a published package's exports or doc comments: `pnpm build`, `pnpm api-report --update`,
  `pnpm agent-skills --write`, `pnpm cheatsheet`; commit what they write.
- Test first: write the failing test and see it fail for the right reason.

## Review Focus

1. **A level whose tileset image is missing or whose tile index is past the set.** The tile draws as the placeholder
   colour, the level still shows, one `reportError` names the level and tileset. Test in Task 2.
2. **A `live` definition the level does not place, or a level with no entities layer.** Nothing is drawn for it and
   nothing throws. Test in Task 2.
3. **A clip name the definition lacks, or a definition with an animation but no image loaded yet.** The first clip
   (or the tile, or the colour) shows; one report. Test in Task 6.
4. **A dialogue choice tapped twice in one tick, or Next pressed while choices are up.** One `ChooseCommand` is sent;
   Next is not offered while choices are. Test in Task 13.
5. **A 2D area that overlaps another, or a point on a shared edge.** The first area in file order wins, every engine
   alike. Test in Task 11.

---

### Task 1: Tile rules in content, one owner

**Files:**
- Create: `packages/content/src/shared/level-2d/tile-cells.ts`, `packages/content/src/shared/level-2d/tile-frame.ts`
- Modify: `packages/content/src/shared/level-2d/read-level.ts` (export the shared token reader), the
  `@automata/content/level-2d` entry
- Modify: `packages/editor/src/shared/level-2d/canvas/draw/tile-draw.ts` (import `PLACEHOLDER_COLORS`, `tileFrame`),
  `packages/editor/src/shared/level-2d/model/cells-codec.ts` (token parsing of tile cells delegates to content)
- Test: `packages/content/tests/unit/level-2d/tile-cells.test.ts`, `tests/unit/level-2d/tile-frame.test.ts`

**Interfaces:**
- Produces:
  - `interface TileCell { readonly tile: number; readonly flipX: boolean; readonly flipY: boolean }`
  - `tileRows(level: ContentLevel, layer: string): readonly (readonly (TileCell | undefined)[])[]` (tiles layer)
  - `autoStacks(level: ContentLevel, layer: string): readonly (readonly (readonly (TileCell | undefined)[])[])[]`
    (one grid per depth, depth 0 first)
  - `objectsOf(level: ContentLevel, layer: string): readonly ContentObjectItem[]`
  - `tileFrame(tileset: ContentTileset, tile: number): { x: number; y: number; w: number; h: number } | undefined`
    (undefined past the set)
  - `PLACEHOLDER_COLORS: readonly string[]` (the twelve, moved verbatim from `tile-draw.ts`)
  - `placeholderColor(tile: number): string`

- [ ] **Step 1: Failing tests.** `tileRows` on rows `['.*2 7h 3v*2 0hv']` gives
  `[undefined, undefined, {tile:7,flipX:true,flipY:false}, {tile:3,flipY:true,…}, {…same}, {tile:0,flipX:true,flipY:true}]`;
  a bad token `7x` throws `Level <id>, layer <layer>, row 0: "7x" is not a tile.`; asking an intgrid layer throws the
  same sentence shape `read-level.ts` uses. `tileFrame` with padding 1, spacing 2, 16×16 tiles, 4 columns: tile 5 is
  `{x:19,y:19,w:16,h:16}`; tile 16 of a 4×4 set is `undefined`. `placeholderColor(13) === '#5a7d8a'`.
- [ ] **Step 2:** Run `pnpm --filter @automata/content test -- tile-` and see both fail on the missing module.
- [ ] **Step 3:** Implement. The tile token grammar is the editor's (`cells-codec.ts` header): index, then `h`, `v`
  or `hv`, then optional `*n`. Sim-safe like `read-level.ts`: no Node, no clock.
- [ ] **Step 4:** Point the editor at content: `tile-draw.ts` imports `PLACEHOLDER_COLORS` and `tileFrame`; the
  editor's level tests (`pnpm --filter @automata/editor test -- level-2d`) pass unchanged.
- [ ] **Step 5:** `pnpm check`, changeset (`@automata/content` patch), commit
  `feat(content): tile rows, tile frames and placeholder colours for games`.

### Task 2: Core draws a level (`levelScene`)

**Files:**
- Create: `packages/automata/src/features/render/level-2d/level-draw-list.ts` (pure),
  `packages/automata/src/features/render/level-2d/level-scene.ts` (Pixi)
- Modify: `packages/automata/src/app/define-game.ts` (`GameSpec.level`, mounted in `pixiOptions`),
  `packages/automata/src/entries/render.ts` and `entries/game.ts`
- Test: `packages/automata/tests/unit/render/level-draw-list.test.ts`,
  `packages/automata/tests/browser/render/level-scene.test.ts`

**Interfaces:**
- Consumes: Task 1's readers and `tileFrame`, `placeholderColor`.
- Produces:
  - `interface LevelSceneOptions { project: ContentProject; levels: Readonly<Record<string, ContentLevel>>; images: Readonly<Record<string, string>>; start: string; live?: readonly string[]; current?: (sim: DrawSim) => string }`
  - `levelScene(options: LevelSceneOptions): LevelScene` (validates `start` and `live` against the project now; throws
    `There is no level "<id>". Open it in the editor and press Save.`)
  - `GameSpec.level?: LevelScene` — mounted at index 0 of `stage.world`, so entity views draw over it
  - `levelDrawList(project, level, images: ReadonlySet<string>, live): LevelDraw` where
    `LevelDraw = { background: {color: string; image?: string; mode}; items: readonly DrawItem[] }` and
    `DrawItem = { kind: 'tile'; image: string; frame; x; y; flipX; flipY } | { kind: 'flat'; color: string; x; y; w; h; ellipse: boolean }`,
    back to front

- [ ] **Step 1: Failing unit tests** on `levelDrawList` with the template project (`packages/tools/src/shared/create-game/template-content/`
  read in the test): layers come back to front in the reverse of `project.layers`; the intgrid `collision` layer adds
  no items; an auto layer's depth 0 comes before depth 1; a placeholder tileset gives `flat` items with
  `placeholderColor(tile)`; an `entities` item of a `live` def gives nothing; a `coin` with no tile gives a `flat`
  ellipse in `#facc15` at its pivot-adjusted box (pivot 0.5, 0.5, size 8). Review Focus 1: a tileset with
  `image = "assets/missing.png"` not in `images` gives `flat` items and the scene reports once
  `The level "<name>" uses the picture "assets/missing.png", which is not in the game.`, and a tile past the set
  reports `The level "Cave" uses tile 70, but "Terrain" has 64 tiles.` Review Focus 2: a `live` id
  the level never places, and a level with no entities layer, both give a list without throwing.
- [ ] **Step 2:** See them fail (module missing).
- [ ] **Step 3:** Implement `levelDrawList`, then `levelScene`: one `Container`, sprites per tile from
  `Texture` frames of `Assets.load(images[path])` (cached per path), `Graphics` for flat items; rebuilt only when
  `current(sim)` changes. A flip is `scale.x = -1` / `scale.y = -1` about the tile's centre.
- [ ] **Step 4: Browser test** (Chromium in the session, all three engines on the runner): a 2×1 level with a
  real 32×16 tileset PNG fixture draws two tiles; read back the canvas pixel at each tile's centre and compare with the
  fixture's colours.
- [ ] **Step 5:** `pnpm check`; `pnpm build`, `pnpm api-report --update`, `pnpm cheatsheet`; changeset; commit
  `feat(render): core draws a 2D level's tiles and placed characters`.

### Task 3: `pictureView` (still pictures)

**Files:**
- Create: `packages/automata/src/features/render/views/picture-view.ts`
- Modify: `packages/automata/src/entries/render.ts`
- Test: `packages/automata/tests/unit/render/picture-view.test.ts`

**Interfaces:**
- Consumes: Task 1 `tileFrame`, `placeholderColor`; `view-pose.ts` `placeView`, `anchorXY`.
- Produces: `pictureView(project: ContentProject, def: string, images: Readonly<Record<string, string>>, options?: PictureViewOptions): EntityViewFactory`
  with `PictureViewOptions = { clip?: (components: Readonly<Record<string, Readonly<FieldRecord>>>) => string }`
  (used from Task 6). The anchor is the def's `pivot`. Throws `There is no character "<def>" in the project.`

- [ ] **Step 1: Failing tests:** a def with `tile` gives a `Sprite` whose texture frame is `tileFrame`'s; a def with
  neither tile nor animation gives a `Graphics` of its colour and shape; anchor equals pivot; an unknown def throws.
- [ ] **Step 2:** See them fail.
- [ ] **Step 3:** Implement. The picture rule is the spec's (§4): animation's first frame, else tile, else colour.
- [ ] **Step 4:** Tests pass; `pnpm check`.
- [ ] **Step 5:** Commit `feat(render): pictureView draws an entity as its character looks in the editor`.

### Task 4: The new game shows what the editor painted

**Files:**
- Modify: `packages/tools/src/shared/create-game/template-game.ts`, `template-level.ts` (remove `level.view.ts` and
  `drawLevel`; add `src/features/level/level-scene.ts` with the `import.meta.glob` images map),
  `template-content/project.toml` and `template-content/levels/start.toml` only if the export changes them
- Test: `packages/tools/tests/unit/create-game/template-game.test.ts`, the existing create-game install test
- Test (journey): `packages/editor/tests/e2e/journeys/paint-shows-in-game.test.ts`

**Interfaces:**
- Consumes: `levelScene`, `pictureView`.

- [ ] **Step 1: Failing test:** the generated `src/app/game.ts` passes `level:` and its views use
  `pictureView(project, 'player-start', images)`; no generated file mentions `WALL_COLOR` or `drawLevel`.
- [ ] **Step 2:** See it fail.
- [ ] **Step 3:** Change the template. The square keeps its code (moving is behaviour) and now looks like the player
  start; `live: ['player-start']`.
- [ ] **Step 4:** The generated game type-checks and its tests pass (`pnpm --filter @automata/tools test -- create-game`).
- [ ] **Step 5: Journey:** create a game, open the suite, paint one `decor` tile and give `player-start` a tile in
  Characters, Save, load the dev game; assert the level container holds a sprite at the painted cell and the player
  view's texture is the chosen tile. Run in Chromium (iPad and phone projects). Look at the screenshot and explain it
  in the log.
- [ ] **Step 6:** Commit `feat(create-game): the new game draws the level and characters the editor made`.

### Task 5: The `animation` schema

**Files:**
- Modify: `packages/content/src/shared/level-2d/content.schema.ts` (`ContentEntityDef.animation?`),
  `packages/editor/src/shared/level-2d/model/project-types.ts` (`EntityDef.animation?`),
  `packages/editor/src/shared/level-2d/model/project.schema.ts`,
  `packages/editor/src/shared/level-2d/profiles/level-project/content-export.ts`
- Test: `packages/content/tests/unit/level-2d/animation.test.ts`, the export test beside `content-export`

**Interfaces:**
- Produces: `interface ContentAnimation { readonly image: string; readonly frame: ContentSize; readonly clips: readonly { readonly id: string; readonly frames: readonly number[]; readonly fps: number; readonly loop: boolean }[] }`
  Rules: at least one clip; clip ids unique (`Two clips are called "run".`); `fps` 1 to 60; `frames` non-empty,
  each a whole number at least 0.

- [ ] **Step 1: Failing tests:** the spec's TOML example parses; a project without `animation` parses unchanged
  (existing fixtures); duplicate clip ids and `fps = 0` fail with the sentences above; the export of a def with an
  animation round-trips through `projectContentSchema`.
- [ ] **Step 2:** See them fail.
- [ ] **Step 3:** Implement in both schemas and the export (deterministic key order like the rest of the export).
- [ ] **Step 4:** `pnpm check`; changeset (`@automata/content`); commit `feat(content): a character's animation clips`.

### Task 6: `pictureView` plays clips

**Files:**
- Modify: `packages/automata/src/features/render/views/picture-view.ts`; `level-draw-list.ts` (a placed animated
  character shows its first clip playing)
- Test: `packages/automata/tests/unit/render/picture-view-clips.test.ts`

**Interfaces:**
- Consumes: Task 5 `ContentAnimation`; `PictureViewOptions.clip`.

- [ ] **Step 1: Failing tests:** an animated def gives an `AnimatedSprite` with the first clip's frames and
  `animationSpeed = fps / 60`, `loop` from the clip; `clip` returning `'run'` swaps to run's frames and restarts at
  frame 0, and returning `'run'` again does not restart; Review Focus 3: `'fly'` (absent) keeps the first clip and
  calls `reportError` once with `The character "<label>" has no clip "fly".`; before the image loads, the view shows
  the def's tile or colour.
- [ ] **Step 2:** See them fail.
- [ ] **Step 3:** Implement with Pixi's `AnimatedSprite` (it times itself on the shared ticker: presentation time,
  never the sim).
- [ ] **Step 4:** `pnpm check`; api report; commit `feat(render): pictureView plays a character's clips by name`.

### Task 7: The Animation section in Characters

**Files:**
- Create: `packages/editor/src/features/characters/AnimationSection.svelte`,
  `packages/editor/src/features/characters/animation-model.ts`
- Modify: `EntityInspector.svelte`, `entities-session.ts` (edits for `animation`), the project command that writes a
  def (`packages/editor/src/shared/level-2d/model/commands/`)
- Test: `packages/editor/tests/unit/characters/animation-model.test.ts`,
  `packages/editor/tests/unit/characters/animation-section.test.ts` (DOM),
  `packages/editor/tests/browser/characters/animation-section.layout.test.ts`

**Interfaces:**
- Consumes: Task 5's types; Add tiles' picture write from #473 (the function that writes a picked image into
  `assets/`; reuse it, do not copy it).
- Produces: `animationModel(def: EntityDef, imageSize: Size | undefined): { frames: number; clips: readonly ClipRow[] }`
  and edit commands `setAnimationPicture`, `setFrameSize`, `addClip`, `renameClip`, `toggleFrame`, `setFps`,
  `setLoop`, `removeClip` (each one undo step).

- [ ] **Step 1: Failing model tests:** frame count from image size and frame size (a 64×24 picture with 16×24 frames
  has 4); a clip's frames past the count are flagged `This clip uses frame 6, but the picture has 4.`; `addClip`
  names `idle`, then `clip 2`, `clip 3`.
- [ ] **Step 2: Failing DOM tests:** "Add picture" opens the picker; tapping frames adds them in order; "Repeat" is a
  switch; the preview plays the chosen clip; removing a clip and pressing Undo brings it back; every control is at
  least 44 px; the hint reads "Draw your frames in any paint app, then add the picture here."
- [ ] **Step 3:** See them fail; implement; see them pass.
- [ ] **Step 4: Layout test** at 390×844, 844×390 and 1024×768: no horizontal scroll, the frame strip scrolls in
  its own region.
- [ ] **Step 5:** `pnpm check`; commit `feat(editor): animation clips in Characters`.

### Task 8: Controls as data

**Files:**
- Create: `packages/content/src/shared/controls/controls.schema.ts`, `controls-kind.ts`; entry
  `@automata/content/controls`
- Create: `packages/automata/src/features/input/controls-from.ts`
- Modify: `packages/automata/src/entries/game.ts`
- Test: `packages/content/tests/unit/controls/controls.schema.test.ts`,
  `packages/automata/tests/unit/input/controls-from.test.ts`

**Interfaces:**
- Produces:
  - `interface ControlsFile { readonly command: string; readonly action: readonly ControlAction[] }`,
    `ControlAction = { id; label?; send: Record<string, unknown>; keys?: string[]; pad?: number[]; touch?: boolean; stick?: StickDirection[]; gesture?: GestureName[]; required?: boolean }`
  - `controlsKind(): ContentSchemaDef` (file `controls.toml`, `{ sim: false }`)
  - `controlsFrom<Z>(command: CommandDef<Z>, file: ControlsFile): InputMap`

- [ ] **Step 1: Failing tests:** the spec's example parses; `keys = ["Escape"]` and `pad = [8]` fail with "That key
  is kept for the menus."; `controlsFrom(Move, file)` gives the same `profile` and `toCommand` results as the
  template's `keys(Move, …)` call today (copy that call into the test); `command = "jump"` with `Move` throws
  `The controls file is for "jump", but the game sends "move".`; a `send` the schema refuses throws naming the
  action's id.
- [ ] **Step 2:** See them fail; implement by building `keys()` arguments from the file (labels keyed by the action's
  first key); see them pass.
- [ ] **Step 3:** `pnpm check`; api report; changesets; commit `feat(input): default controls from content/controls.toml`.

### Task 9: Controls in the Tuner, and the new game uses the file

**Files:**
- Create: `packages/editor/src/features/suite/tuner/controls-section.ts` (model),
  `packages/editor/src/features/suite/tuner/ControlsSection.svelte`
- Modify: the Tuner's view and session (`tuner-session.ts`), the key-name words (reuse the Settings screen's
  `labelFor` words where they exist), `packages/tools/src/shared/create-game/template-content/` (add
  `controls.toml`, list it in `editors.toml` for the Tuner), `template-game.ts` (`controlsFrom`)
- Test: `packages/editor/tests/unit/suite/tuner/controls-section.test.ts` (model + DOM),
  `packages/tools/tests/unit/create-game/template-controls.test.ts`

**Interfaces:**
- Consumes: Task 8; the kit content documents (span-preserving edits).

- [ ] **Step 1: Failing tests:** the section lists one row per action with its label and key chips ("←", "A");
  pad button 0 shows "A button (bottom)"; editing a label rewrites only that literal; "Add key" then pressing `KeyJ` adds `"KeyJ"` and shows "J"; pressing
  Escape cancels with no edit; "Touch button" toggles `touch`; a game without `controls.toml` shows no section.
- [ ] **Step 2:** See them fail; implement; pass. Touch targets 44 px; phone layout test at 390×844.
- [ ] **Step 3:** The template writes `content/controls.toml` (its arrows, WASD and D-pad) and `game.ts` uses
  `controlsFrom(Move, content.controls)`; the generated game's tests pass.
- [ ] **Step 4:** `pnpm check`; commit `feat(tuner): change a game's default controls`.

### Task 10: The `places` contract; sectors provides it; consumers take it

**Files:**
- Create: `extensions/places/` (package files modelled on `extensions/feel`; `src/shared/places.ts`,
  `src/entries/index.ts`)
- Create: `extensions/sectors/src/shared/sim/sectors-places.ts`; export from `@automata/sectors/sim`
- Modify: `extensions/nav/src/shared/sim/route.ts` (`Blocked` moves to places, re-exported),
  `nav.system.ts`, `extensions/nav/src/app/*.extension.ts`;
  `extensions/narrative/src/shared/sim/narrative.system.ts`, `narrative.extension.ts`;
  `extensions/cutscenes/src/app/cutscenes.extension.ts`, `src/shared/lint.ts` (`LintWorld.map` optional);
  `extensions/systems/src/shared/sim/{world.ts,pursuit.ts,load-systems.ts}`, `systems.extension.ts`
- Test: `extensions/places/tests/unit/places.test.ts`, `extensions/sectors/tests/unit/sectors-places.test.ts`; the
  existing suites of all five extensions unchanged

**Interfaces:**
- Produces: the spec §3.1 `Places`, `PlanPoint`, `PlanRoom`, `Blocked`; `sectorsPlaces: Places` (`provider: 'sectors'`);
  each consumer's options gain `places?: Places` (default `sectorsPlaces`) and its `requires` becomes
  `[places.provider, …]`.

- [ ] **Step 1: Failing tests:** `sectorsPlaces` over the clinic fixture returns the same point, room and blocked
  answers as `InSector`/`resolvedMap`/`blockedBy` for five fixed points; `narrativeExtension({ places: fake })`
  requires `fake.provider` and not `sectors`.
- [ ] **Step 2:** See them fail; implement; replace each consumer's direct `InSector`/`resolvedMap` read with the
  `places` call. Keep reads in the same order (state hashes depend on it).
- [ ] **Step 3:** Run every extension's suite and the 3D parity script; record that no hash, golden or replay moved.
  If one moved, stop and find why (law 3).
- [ ] **Step 4:** `pnpm check`; changesets; commit `refactor(extensions): a places contract instead of requiring 3D rooms`.

### Task 11: `level-2d` provides places in a 2D level

**Files:**
- Create: `extensions/level-2d/` (package; `src/shared/sim/level-2d-places.ts`, `src/shared/sim/level-2d.component.ts`,
  `src/shared/sim/cell-walls.ts`, `src/app/level-2d.extension.ts`)
- Test: `extensions/level-2d/tests/unit/sim/level-2d-places.test.ts`, `tests/unit/sim/cell-walls.test.ts`

**Interfaces:**
- Consumes: Task 1 readers (`intGridRows`, `entitiesOf`); `Places`.
- Produces: `level2dPlaces(options: { level: ContentLevel; project: ContentProject; areas?: string; walls?: string; solid?: readonly number[] }): Places`
  (`provider: 'level-2d'`; `areas` defaults to the def tagged `area`, `walls` to the first intgrid layer, `solid` to
  the value whose id is `solid`); `level2dExtension(): ExtensionDef<'level-2d'>`; component `Level2dAt`
  (`level-2d.at`, `{ x: f32, z: f32 }`).

- [ ] **Step 1: Failing tests:** a segment through a solid cell is blocked for walking and sight; one grazing a
  cell's corner within the margin is blocked, outside it is not; rooms come from `area` items with `name`/`zone`
  fields; Review Focus 5: two overlapping areas, the first in file order wins, and a point on a shared edge belongs to
  the first; neighbours are areas sharing an edge of positive length (corner contact is not one).
- [ ] **Step 2:** See them fail; implement with the sim's own math (`@automata/sim/math`), iterating cells in row
  order; pass.
- [ ] **Step 3:** `pnpm check`; commit `feat(level-2d): rooms, walls and positions from a 2D level`.

### Task 12: `usePlay()` for slot components

**Files:**
- Create: `packages/automata/src/shared/ui/slots/play-context.svelte.ts`
- Modify: `packages/automata/src/app/screens/PlayScreen.svelte` (provide the context), the play session that merges
  input commands each tick (where `InputSource.commands` is read for the app loop's `run({ commands })`),
  `packages/automata/src/entries/extension.ts`
- Test: `packages/automata/tests/unit/ui/play-context.test.ts`

**Interfaces:**
- Produces: `usePlay(): { readonly sim: DrawSim | undefined; send(command: Command): void }` (reactive `sim`,
  updated each frame; `send` queues for the next tick and the queue is recorded with input).

- [ ] **Step 1: Failing tests:** a slot component rendered in `PlayScreen` reads `sim.tick` and sees it advance; a
  command sent at tick 10 reaches the sim's tick 11 with the input command, in send order; a replay of the recorded
  stream reaches the same hash.
- [ ] **Step 2:** See them fail; implement; pass.
- [ ] **Step 3:** `pnpm check`; api report; changeset; commit `feat(ui): slot components read the game and send commands`.

### Task 13: The dialogue box and the caption

**Files:**
- Create: `extensions/narrative/src/features/box/DialogueBox.svelte`, `dialogue-box.ts` (model),
  `extensions/narrative/src/features/box/Caption.svelte`
- Modify: `extensions/narrative/src/app/narrative.extension.ts` (`ui.slots['hud.overlay']`)
- Test: `extensions/narrative/tests/unit/box/dialogue-box.test.ts` (model + DOM),
  `extensions/narrative/tests/browser/box/dialogue-box.layout.test.ts`

**Interfaces:**
- Consumes: `usePlay()`; narrative's `NarrativeDialogue` resource and its view function in `dialogue.ts`;
  `AdvanceCommand`, `ChooseCommand`; the game's lines and messages.
- Produces: `dialogueBoxModel(view: View | null, lines: (key: string) => { speaker?: string; text: string }): BoxModel | null`

- [ ] **Step 1: Failing tests:** no conversation shows nothing; a line shows speaker and text with "Next"; the last
  line before choices shows the choices and no "Next"; key 2 chooses the second; Review Focus 4: two taps on a choice
  in one tick send one `ChooseCommand`; focus moves to the first choice when they appear and back when it ends; a
  caption from the cutscene state shows above the box and takes no focus.
- [ ] **Step 2:** See them fail; implement; pass.
- [ ] **Step 3: Layout test** at 390×844, 844×390 and 1024×768: the box never covers Pause, choices stack on a
  phone, every button at least 48 px tall, long lines wrap inside the box.
- [ ] **Step 4:** `pnpm check`; commit `feat(narrative): a dialogue box and captions`.

### Task 14: Cutscenes on a 2D stage

**Files:**
- Create: `extensions/level-2d/src/features/cutscene-stage/cutscene-stage-2d.ts`
- Modify: `extensions/cutscenes/src/shared/lint.ts` (`LintWorld.dimensions?: 2 | 3`, rule `3d-only`)
- Test: `extensions/level-2d/tests/unit/cutscene-stage/cutscene-stage-2d.test.ts`,
  `extensions/cutscenes/tests/unit/lint-2d.test.ts`

**Interfaces:**
- Consumes: `createDirector`, `SceneState`; Task 6 `pictureView` clips; Task 13 caption.
- Produces: `cutsceneStage2d(options: { scene: LevelScene; project: ContentProject; images; camera: Camera2d }): PixiStageHooks`

- [ ] **Step 1: Failing tests:** the camera centres on `look[0], look[2]`; an actor whose `who` matches a placed
  item's `name` is drawn at its `x, z` and the item's own drawing hides until `done`; a cue starts the named clip;
  fade draws a black rectangle at the fade's alpha. Lint: a script with `lamps` in a 2D world warns
  `This step only works in 3D games. It does nothing here.`; the same in 3D does not.
- [ ] **Step 2:** See them fail; implement; pass.
- [ ] **Step 3:** `pnpm check`; commit `feat(level-2d): cutscenes play in a 2D level`.

### Task 15: Systems in a 2D level, the same in every engine

**Files:**
- Modify: `extensions/systems/src/shared/sim/systems-checks.ts` (2D light/warmth lint)
- Create: `extensions/level-2d/src/testing/patrol-2d.ts` (a 2D scene: one agent, one area pair, a wall),
  `extensions/level-2d/tests/unit/sim/systems-2d.test.ts`, the parity entry the runner's parity job reads
  (follow `extensions/systems/src/testing/patrol-script.ts`)

- [ ] **Step 1: Failing tests:** the agent patrols, sees the player across open cells, loses them behind a solid
  cell, and follows into the neighbouring area; a 2D agent with a `light` sense and no `derived` fact gets
  `This sense needs the game to say how bright it is here.`
- [ ] **Step 2:** See them fail; implement; pass in Node.
- [ ] **Step 3:** Record the scene's hash in Node; the parity job compares Chromium, WebKit and Firefox. Report which
  engines ran.
- [ ] **Step 4:** `pnpm check`; commit `test(level-2d): enemy behaviour in a 2D level, checked in every engine`.

### Task 16: Docs and the gate

**Files:**
- Modify: `docs/status.md`, `docs/refactor/progress.md`, the `level-2d` and `places` READMEs, `docs/README.md`
  where it lists extensions; the agent skills the generator writes

- [ ] **Step 1:** `pnpm format`, `pnpm check`, `pnpm build`, `pnpm api-report --update`, `pnpm agent-skills --write`,
  `pnpm cheatsheet`; commit what they wrote.
- [ ] **Step 2:** Push; open the PR ready; record in the log which suites ran (session: Node, Chromium) and which are
  pending (WebKit, Firefox, GPU journeys on the runner).

## Log

- 2026-11-08: spec and plan written (Opus, medium). Steps 2 and 5 of the gaps doc cut on the Owner's correction
  (04:14): the goal is people editing content, not games without code.
