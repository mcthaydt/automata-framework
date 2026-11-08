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
`level-2d` extension provides it in 2D (sim only; the plan is in metres, and places reads the game's own position
component). The dialogue box is `narrative`'s `hud.overlay` component; the caption and the 2D cutscene stage are
`cutscenes`' (it depends on narrative, not the other way). A small `examples/2d-story` game proves it all in a served
journey.

**Tech Stack:** TypeScript 6.0.3, PixiJS 8, Svelte 5.57.1, Zod 4.6.6, Koota (sim), Vitest 5.0.3 (jsdom + Testing
Library; Chromium, WebKit and Firefox for browser and parity), Vite 8.3.3.

**Spec:** [`2026-11-08-content-in-play-spec.md`](2026-11-08-content-in-play-spec.md)

**Base:** stacked on PR #478 (content editors). Before Task 1, merge up so the branch also has #473 (suite Levels 2D,
Add tiles), #476, and the "Make a full game from the editors" PR (stacked on #473: `automata editor` serves the game
and the editor has Play). Task 7 reuses Add tiles' picture write, Task 9 edits the suite Tuner, and both served
journeys (Tasks 4 and 16) press Play. Record the merge in the log. Merge #478 up again before Task 9 (it changes the
template's `editors.toml` to list every editor's files) and before Task 16 (its Writer, Sequence and Schematic).

**Audit:** [`2026-11-08-content-in-play-plan-audit.md`](2026-11-08-content-in-play-plan-audit.md) (F1 to F21, fixed
below). Its sections 3 and 4 are the evidence for each path and signature the tasks name.

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
- What a person makes in an editor must be seen in play in a served journey (Owner, 2026-11-08), not only in unit
  tests: Task 4 (levels, characters, clips) and Task 16 (dialogue, cutscenes, AI in 2D). A journey step that could
  not run is left unchecked and named, never replaced by writing the file directly.
- The plan in `places` is in metres in 2D and 3D; only `level2dPlaces` knows about pixels.
- One owner per piece of state: in 2D, places reads and writes the game's own position component.

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
6. **A line whose words were never written.** The box shows the speaker and no key; one report names the line. Test
   in Task 13.
7. **A guard tuned in 3D numbers walking a 2D level** (speed 1.4 metres a second). It crosses about 22 px a second on
   a 16 px grid, not 1.4 px. Test in Task 11 (`metre` conversion) and Task 15.
8. **A phone with no keyboard pressing "Add key".** "Cancel" ends it with no edit. Test in Task 9.

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
  - `pictureOf(def: ContentEntityDef): { kind: 'animation'; animation: ContentAnimation } | { kind: 'tile'; tileset: string; index: number } | { kind: 'flat'; shape: 'rect' | 'ellipse' | 'point'; color: string }`
    (the animation branch arrives in Task 5; a tile only when `shape === 'tile'`, as `level-draw-list.ts` `entitiesOf`
    draws it; `color` defaults as the editor's does)

- [ ] **Step 1: Failing tests.** `tileRows` on rows `['.*2 7h 3v*2 0hv']` gives
  `[undefined, undefined, {tile:7,flipX:true,flipY:false}, {tile:3,flipY:true,…}, {…same}, {tile:0,flipX:true,flipY:true}]`;
  a bad token `7x` throws `Level <id>, layer <layer>, row 0: "7x" is not a tile.`; asking an intgrid layer throws the
  same sentence shape `read-level.ts` uses. `tileFrame` with padding 1, spacing 2, 16×16 tiles, 4 columns: tile 5 is
  `{x:19,y:19,w:16,h:16}`; tile 16 of a 4×4 set is `undefined`. `placeholderColor(13) === '#5a7d8a'`. `pictureOf`
  of a def with `tile` set and `shape = 'rect'` is `flat` (the editor shows no tile there), and with `shape = 'tile'`
  is `tile`.
- [ ] **Step 2:** Run `pnpm --filter @automata/content test -- tile-` and see both fail on the missing module.
- [ ] **Step 3:** Implement. The tile token grammar is the editor's (`cells-codec.ts` header): index, then `h`, `v`
  or `hv`, then optional `*n`. Sim-safe like `read-level.ts`: no Node, no clock.
- [ ] **Step 4:** Point the editor at content: `tile-draw.ts` imports `PLACEHOLDER_COLORS` and `tileFrame` (its frame
  sum becomes `tileFrame`'s, which uses the same `padding + i * (tile + spacing)`), and `level-draw-list.ts`
  `entitiesOf` asks `pictureOf` whether to draw a tile; the editor's level tests
  (`pnpm --filter @automata/editor test -- level-2d`) pass unchanged.
- [ ] **Step 5:** `pnpm check`, changeset (`@automata/content` patch), commit
  `feat(content): tile rows, tile frames and placeholder colours for games`.

### Task 2: Core draws a level (`levelScene`)

**Files:**
- Create: `packages/automata/src/features/render/level-2d/level-draw-list.ts` (pure),
  `packages/automata/src/features/render/level-2d/level-scene.ts` (Pixi)
- Modify: `packages/automata/src/app/define-game.ts` (`GameSpec.level`, mounted in `pixiOptions` beside the draw
  layer, and `problemsOf`: `level` with `createRenderer` is the problem
  `` `level` draws 2D levels; a 3D game draws its rooms itself. ``), `packages/automata/src/app/draw/` (the draw
  layer hands its `DrawSim` to the scene each frame: `PixiStageHooks.draw` gets only `FrameInfo`, which has no sim),
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
  - `LevelScene.add(hooks: LevelSceneHooks): void` with
    `LevelSceneHooks = { draw(sim: DrawSim, scene: { container: Container; hide(itemId: string, hidden: boolean): void }): void }`,
    called each frame after the scene's own redraw check (Task 14's cutscene stage is the first user)
  - `levelDrawList(project, level, images: ReadonlySet<string>, live): LevelDraw` where
    `LevelDraw = { background: {color: string; image?: string; mode}; items: readonly DrawItem[] }` and
    `DrawItem = { kind: 'tile'; image: string; frame; x; y; flipX; flipY } | { kind: 'flat'; color: string; x; y; w; h; ellipse: boolean }`,
    back to front

- [ ] **Step 1: Failing unit tests** on `levelDrawList` with the template project (`packages/tools/src/shared/create-game/template-content/`
  read in the test): layers come back to front in the reverse of `project.layers`; the intgrid `collision` layer adds
  no items; an auto layer's depth 0 comes before depth 1; a placeholder tileset gives `flat` items with
  `placeholderColor(tile)`; an `entities` item of a `live` def gives nothing; a `coin` with no tile gives a `flat`
  ellipse in `#facc15` at its pivot-adjusted box (pivot 0.5, 0.5, size 8); a resizable item uses its own `w`/`h`, as
  the editor's `entityBounds` does; an objects item sits top-left at its position at its tileset's tile size.
  `defineGame` with `level` and `createRenderer` fails with the sentence above. Review Focus 1: a tileset with
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

- [ ] **Step 1: Failing tests:** a def with `shape = 'tile'` and a `tile` gives a `Sprite` whose texture frame is
  `tileFrame`'s; a def with a `tile` but `shape = 'rect'` gives the flat rectangle (as the editor draws it); a def
  with neither tile nor animation gives a `Graphics` of its colour and shape; anchor equals pivot; an unknown def
  throws.
- [ ] **Step 2:** See them fail.
- [ ] **Step 3:** Implement on Task 1's `pictureOf` (§4): animation's first frame, else tile when the shape is tile,
  else colour.
- [ ] **Step 4:** Tests pass; `pnpm check`.
- [ ] **Step 5:** Commit `feat(render): pictureView draws an entity as its character looks in the editor`.

### Task 4: The new game shows what the editor painted

**Files:**
- Modify: `packages/tools/src/shared/create-game/template-game.ts`, `template-level.ts` (remove `level.view.ts` and
  `drawLevel`; add `src/features/level/level-scene.ts`: `project` and `levels` from the virtual module's `content`
  export, which `compiled-content.d.ts` now declares beside `simContent`, and the images map from
  `import.meta.glob('/assets/*.{png,webp,jpg,jpeg}', { eager: true, query: '?url', import: 'default' })` with the
  leading `/` dropped, because Add tiles writes `assets/<name>.png` flat), `template-content/project.toml` and the
  level project `levels/start.af2d.json` (add the `area` definition: label "Area", shape `rect`, resizable `xy`, tag
  `area`, text fields `name` and `zone`; Characters cannot set tags or resizing, so the template carries it)
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
- [ ] **Step 5: Served journey** (extend the full-game PR's create, edit, save, play journey rather than writing a
  second loop): create a game; `automata editor` serves the editor and the game; in the suite, Add tiles with a real
  16 px tileset PNG fixture (the template's `terrain` is a placeholder with no image, so without this a painted tile
  draws as a flat colour, never a sprite); paint one `decor` tile with it; in Characters give `player-start` the shape
  Tile and a tile; Save; press Play. Assert the level container holds a sprite at the painted cell whose texture frame
  is that tile's, and the square's view texture is the chosen tile; the walls (the `ground` auto layer) show. Run in
  Chromium (iPad and phone projects). Look at the screenshot and explain it in the log. Task 7 adds the clip step.
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
- Create: `packages/editor/src/shared/pictures/pick-picture.ts` (moved out of `features/tiles/`: `PICTURE_TYPES`,
  `pictureAsset`, and the list-then-write-`absent` step and its refusal sentence that are inline in
  `AddTilesDialog.svelte` today; a feature may not import another feature, so Characters cannot reach them where they
  are)
- Modify: `features/tiles/add-tiles.ts` and `AddTilesDialog.svelte` (use the shared write; Add tiles' tests pass
  unchanged), `EntityInspector.svelte`, `entities-session.ts` (edits for `animation`), the project command that writes a
  def (`packages/editor/src/shared/level-2d/model/commands/`)
- Test: `packages/editor/tests/unit/characters/animation-model.test.ts`,
  `packages/editor/tests/unit/characters/animation-section.test.ts` (DOM),
  `packages/editor/tests/browser/characters/animation-section.layout.test.ts`

**Interfaces:**
- Consumes: Task 5's types; `writePicture(files: WorkspaceFiles, chosen: { name: string; bytes: Uint8Array }): Promise<{ ok: true; path: string } | { ok: false; message: string }>`
  from `shared/pictures/pick-picture.ts` (made in this task from Add tiles' code; reused, not copied).
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
- [ ] **Step 5: Served journey step:** add to Task 4's journey: give `coin` an animation (Add picture with a 4-frame
  strip fixture, a clip `spin` of frames 0 to 3), Save, Play; the placed coin's view is an `AnimatedSprite` whose
  frame advances between two readings.
- [ ] **Step 6:** `pnpm check`; commit `feat(editor): animation clips in Characters`.

### Task 8: Controls as data

**Files:**
- Create: `packages/content/src/shared/controls/controls.schema.ts`, `controls-kind.ts`; entry
  `@automata/content/controls`
- Create: `packages/automata/src/features/input/controls-from.ts`, `packages/automata/src/features/input/input-map-of.ts`
  (the body of `keys()` over a list of actions)
- Modify: `packages/automata/src/features/input/keys.ts` (builds its actions as today, `<command>-<n>` ids and
  payload merging, then calls `inputMapOf`), `input-profile.schema.ts` (imports `RESERVED_KEYS` and
  `RESERVED_PAD_BUTTONS` from `@automata/content/controls`, which now owns them), `packages/automata/src/entries/game.ts`
- Test: `packages/content/tests/unit/controls/controls.schema.test.ts`,
  `packages/automata/tests/unit/input/controls-from.test.ts`

**Interfaces:**
- Produces:
  - `interface ControlsFile { readonly command: string; readonly action: readonly ControlAction[] }`,
    `ControlAction = { id; label?; send: Record<string, unknown>; keys?: string[]; pad?: number[]; touch?: boolean; stick?: StickDirection[]; gesture?: GestureName[]; required?: boolean }`
  - `controlsKind(): ContentSchemaDef` (file `controls.toml`, `{ sim: false }`)
  - `controlsFrom<Z>(command: CommandDef<Z>, file: ControlsFile): InputMap`

- [ ] **Step 1: Failing tests:** the spec's example parses; `keys = ["Escape"]` and `pad = [8]` fail with "That key
  is kept for the menus."; for every set of held keys, `controlsFrom(Move, file).toCommand` gives the same commands as
  the template's `keys(Move, …)` call today (copy that call into the test); the profile's action ids are the file's
  (`left`, not `move-0`) and its labels are the file's; an action with `touch = false` has no touch button while the
  others keep theirs; two actions that send the same payload stay two rows; `keys()`'s existing tests pass unchanged
  (its ids stay `move-0`…, so saved player bindings keep working); `command = "jump"` with `Move` throws
  `The controls file is for "jump", but the game sends "move".`; a `send` the schema refuses throws naming the
  action's id.
- [ ] **Step 2:** See them fail; move `keys()`'s body into `inputMapOf(command, actions, options)`, make `keys()` and
  `controlsFrom` both call it, and move the reserved lists into content; see them pass.
- [ ] **Step 3:** `pnpm check`; api report; changesets; commit `feat(input): default controls from content/controls.toml`.

### Task 9: Controls in the Tuner, and the new game uses the file

**Files:**
- Create: `packages/editor/src/features/suite/tuner/controls-section.ts` (model),
  `packages/editor/src/features/suite/tuner/ControlsSection.svelte`
- Modify: the Tuner's view and session (`tuner-session.ts`); `packages/automata/src/entries/` (export `keyLabel` and
  `padLabel` from `shared/ui/prompts/prompt-label.ts`, the names the game's prompts and Settings already show; the
  private `labelFor` in `keys.ts` uses `keyLabel` too); `packages/tools/src/shared/create-game/template-content/` (add
  `controls.toml`, and a Tuner row for it in `editors.toml` beside the rows #478 adds for every editor's files),
  `template-game.ts` (`controlsFrom`)
- Test: `packages/editor/tests/unit/suite/tuner/controls-section.test.ts` (model + DOM),
  `packages/tools/tests/unit/create-game/template-controls.test.ts`

**Interfaces:**
- Consumes: Task 8; the kit content documents (span-preserving edits).

- [ ] **Step 1: Failing tests:** the section lists one row per action with its label and key chips ("←", "A");
  pad button 0 shows `padLabel(0, 'generic', …)`'s word; editing a label rewrites only that literal; "Add key" shows
  "Press a key on your keyboard." and a Cancel button, then pressing `KeyJ` adds `"KeyJ"` and shows "J"; pressing
  Escape or tapping Cancel ends it with no edit (Review Focus 8); pressing Escape or Tab is never added; "Show a button
  on touch screens" toggles `touch`; a game without `controls.toml` shows no section.
- [ ] **Step 2:** See them fail; implement; pass. Touch targets 44 px; phone layout test at 390×844.
- [ ] **Step 3:** The template writes `content/controls.toml` (its arrows, WASD and D-pad) and `game.ts` uses
  `controlsFrom(Move, content.controls)`; the generated game's tests pass.
- [ ] **Step 4: Served journey step:** add to Task 4's journey: in the Tuner, Add key `KeyJ` to "Left", Save, Play;
  holding J moves the square left.
- [ ] **Step 5:** `pnpm check`; commit `feat(tuner): change a game's default controls`.

### Task 10: The `places` contract; sectors provides it; consumers take it

**Files:**
- Create: `extensions/places/` (package files modelled on `extensions/feel`; `src/shared/places.ts`,
  `src/entries/index.ts`)
- Create: `extensions/sectors/src/shared/sim/sectors-places.ts`; export from `@automata/sectors/sim`
- Move: `extensions/nav/src/shared/sim/blocked.ts` (`blockedBy`) into `extensions/sectors/src/shared/sim/` (nav
  re-exports it; nav depends on sectors, so `sectorsPlaces` in sectors cannot import nav), and the geometry of
  `extensions/systems/src/shared/sim/pursuit.ts` `crossingOf` (edge middle, normal, `THROUGH`) into `sectorsPlaces.crossing`
- Modify: `extensions/nav/src/shared/sim/route.ts` (`Blocked` moves to places, re-exported),
  `nav.system.ts`, `nav.plugin.ts` (`dependsOn: [places.provider]`), `extensions/nav/src/app/nav.extension.ts`
  (`createNavExtension({ places })`; `navExtension = createNavExtension()` stays the 3D default);
  `extensions/narrative/src/shared/sim/narrative.system.ts`, `narrative.plugin.ts` (`dependsOn`),
  `narrative.extension.ts`; `extensions/cutscenes/src/app/cutscenes.extension.ts`, `src/shared/lint.ts` (its floor
  and wall checks call `Places` `roomAt` and `walk` instead of `ResolvedMap`);
  `extensions/systems/src/shared/sim/{world.ts,pursuit.ts,load-systems.ts,systems.plugin.ts}`, `systems.extension.ts`.
  No plugin's `config` gains a field: the 3D games build the same plugins as before, byte for byte.
- Test: `extensions/places/tests/unit/places.test.ts`, `extensions/sectors/tests/unit/sectors-places.test.ts`; the
  existing suites of all five extensions unchanged

**Interfaces:**
- Produces: the spec §3.1 `Places`, `PlanPoint`, `PlanRoom`, `PlanCrossing`, `Blocked`, `THROUGH`;
  `sectorsPlaces: Places` (`provider: 'sectors'`); each consumer's options gain `places?: Places` (default
  `sectorsPlaces`), and its extension's `requires` and its plugin's `dependsOn` become `[places.provider, …]`.

- [ ] **Step 1: Failing tests:** `sectorsPlaces` over the clinic fixture returns the same point, room and blocked
  answers as `InSector`/`resolvedMap`/`blockedBy` for five fixed points, and the same crossing as today's
  `crossingOf` for every pair of touching clinic sectors; `narrativeExtension({ places: fake })` requires
  `fake.provider` and not `sectors`, and its plugin depends on `fake.provider`; `createNavExtension({ places: fake })`
  the same; `navExtension` is unchanged.
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
- Produces: `level2dPlaces(options: { level: ContentLevel; project: ContentProject; position?: { component: ComponentDef; x: string; y: string }; metre?: number; areas?: string; walls?: string; solid?: readonly number[] }): Places`
  (`provider: 'level-2d'`; `position` defaults to `Level2dAt`; `metre` (level pixels per metre) to the walls layer's
  grid; `areas` to the def tagged `area`; `walls` to the first intgrid layer; `solid` to the value whose id is
  `solid`); `level2dExtension(): ExtensionDef<'level-2d'>` (its plugin registers `Level2dAt`); component `Level2dAt`
  (`level-2d.at`, `{ x: f32, y: f32 }`, level pixels).

- [ ] **Step 1: Failing tests:** with `metre` 16, a game component at `{ x: 64, y: 32 }` is the plan point
  `{ x: 4, z: 2 }`, and `move` to `{ x: 5, z: 2 }` writes `x = 80` into that same component (no second copy);
  Review Focus 7: an agent at 1.4 metres a second covers 22.4 px in a second; a segment through a solid cell is
  blocked for walking and sight; one grazing a cell's corner within the margin is blocked, outside it is not; rooms
  come from `area` items with `name`/`zone` fields; Review Focus 5: two overlapping areas, the first in file order
  wins, and a point on a shared edge belongs to the first; `crossing` of two areas sharing an edge of positive length
  is that edge's middle with `into` `THROUGH` metres inside `to`, and corner contact gives null.
- [ ] **Step 2:** See them fail; implement with the sim's own math (`@automata/sim/math`), iterating cells in row
  order; pass.
- [ ] **Step 3:** `pnpm check`; commit `feat(level-2d): rooms, walls and positions from a 2D level`.

### Task 12: `usePlay()` for slot components

**Files:**
- Create: `packages/automata/src/shared/ui/slots/play-context.svelte.ts`
- Modify: `packages/automata/src/app/screens/PlayScreen.svelte` (provide the context), the play session that merges
  input commands each tick (where `InputSource.commands` is read for the app loop's `run({ commands })`),
  `packages/automata/src/entries/extension.ts`. The queue joins the stream in `default-screens.ts`'s
  `appLoop.run({ commands })`: the input map's commands for the tick, then the sent ones in send order. There is no
  recorder in the runtime; "recorded" means anything that records that stream sees them.
- Test: `packages/automata/tests/unit/ui/play-context.test.ts`

**Interfaces:**
- Produces: `usePlay(): { readonly sim: DrawSim | undefined; send(command: Command): void }` (reactive `sim`,
  updated each frame; `send` queues for the next tick and the queue is recorded with input).

- [ ] **Step 1: Failing tests:** a slot component rendered in `PlayScreen` reads `sim.tick` and sees it advance; a
  command sent at tick 10 reaches the sim's tick 11 after the input command, in send order; feeding the same stream
  (captured from `commands(tick)` in the test) to a fresh sim reaches the same hash.
- [ ] **Step 2:** See them fail; implement; pass.
- [ ] **Step 3:** `pnpm check`; api report; changeset; commit `feat(ui): slot components read the game and send commands`.

### Task 13: The dialogue box

**Files:**
- Create: `extensions/narrative/src/features/box/DialogueBox.svelte`, `dialogue-box.ts` (model)
- Modify: `extensions/narrative/src/app/narrative.extension.ts` (`ui.slots['hud.overlay']`; option
  `words?: (key: string) => string | undefined`, the game's message catalog; a line record's `text` is a locale key)
- Test: `extensions/narrative/tests/unit/box/dialogue-box.test.ts` (model + DOM),
  `extensions/narrative/tests/browser/box/dialogue-box.layout.test.ts`

**Interfaces:**
- Consumes: `usePlay()`; narrative's `NarrativeDialogue` resource and its view function in `dialogue.ts`;
  `AdvanceCommand`, `ChooseCommand`; the game's lines and messages.
- Produces: `dialogueBoxModel(view: View | null, lines: (id: string) => LineRecord | undefined, words: (key: string) => string | undefined): BoxModel | null`
  (`BoxModel = { speaker: string; text: string; next: boolean; choices: readonly { index: number; text: string }[]; missing: readonly string[] }`);
  `BOX_HEIGHT_VAR = '--af-dialogue-box-height'`, the CSS variable the box sets on the play field so Task 14's caption
  sits above it.

- [ ] **Step 1: Failing tests:** no conversation shows nothing; a line shows speaker and its words with "Next"; "Next"
  has focus, so Enter, Space and the pad's A advance; the last line before choices shows the choices and no "Next";
  key 2 chooses the second; Review Focus 4: two taps on a choice in one tick send one `ChooseCommand`; focus moves to
  the first choice when they appear and back when it ends; Review Focus 6: a line whose key has no words shows the
  speaker and an empty line (never the key) and reports once
  `The line "<id>" has no words yet. Write them in Writer.`
- [ ] **Step 2:** See them fail; implement; pass.
- [ ] **Step 3: Layout test** at 390×844, 844×390 and 1024×768: the box never covers Pause, choices stack on a
  phone, every button at least 48 px tall, long lines wrap inside the box.
- [ ] **Step 4:** `pnpm check`; commit `feat(narrative): a dialogue box`.

### Task 14: Cutscenes on a 2D stage, and the caption

**Files:**
- Create: `extensions/cutscenes/src/features/stage-2d/cutscene-stage-2d.ts`, entry `@automata/cutscenes/stage-2d`
  (beside the director; `level-2d` stays sim-only, so a 2D game without cutscenes pulls none of this);
  `extensions/cutscenes/src/features/caption/Caption.svelte` (cutscenes' own `hud.overlay`: narrative cannot read
  cutscenes' state, since cutscenes depends on narrative)
- Modify: `extensions/cutscenes/src/shared/lint.ts` (`LintWorld.dimensions?: 2 | 3`, rule `3d-only`),
  `extensions/cutscenes/src/app/cutscenes.extension.ts` (`ui.slots['hud.overlay']`, option `words` as narrative's)
- Test: `extensions/cutscenes/tests/unit/stage-2d/cutscene-stage-2d.test.ts`,
  `extensions/cutscenes/tests/unit/caption/caption.test.ts` (DOM), `extensions/cutscenes/tests/unit/lint-2d.test.ts`

**Interfaces:**
- Consumes: `createDirector`, `SceneState`, `CutsceneState`; Task 2's `LevelScene` and the draw layer's `DrawSim`;
  Task 6 `pictureView` clips; Task 11's `metre`; Task 13's `BOX_HEIGHT_VAR`.
- Produces: `cutsceneStage2d(options: { scene: LevelScene; project: ContentProject; images: Readonly<Record<string, string>>; camera: Camera2d; metre: number; scripts: Readonly<Record<string, PlacedScript>> }): LevelSceneHooks`
  (driven per frame with the `DrawSim`; the director's time is `(tick - CutsceneState.start) / tickRate`).

- [ ] **Step 1: Failing tests:** the camera centres on `look[0] * metre, look[2] * metre`; an actor whose `who`
  matches a placed item's `name` is drawn at its `x, z` (in metres, times `metre`) and the item's own drawing hides
  until `done`; a cue starts the named clip; fade draws a black rectangle at the fade's alpha; with no cutscene
  under way nothing is drawn. Caption: a caption line shows its words above the box's place and takes no focus; a
  caption with no words reports once and shows nothing. Lint: a script with `lamps` in a 2D world warns
  `This step only works in 3D games. It does nothing here.`; the same in 3D does not; an actor key off every area
  in a 2D world is the existing "off the floor" error, through `Places.roomAt`.
- [ ] **Step 2:** See them fail; implement; pass.
- [ ] **Step 3:** `pnpm check`; commit `feat(cutscenes): cutscenes and captions play in a 2D level`.

### Task 15: Systems in a 2D level, the same in every engine

**Files:**
- Modify: `extensions/systems/src/shared/sim/systems-checks.ts` (2D light/warmth lint)
- Create: `extensions/level-2d/src/testing/patrol-2d.ts` (a 2D scene: one agent, one area pair, a wall),
  `extensions/level-2d/tests/unit/sim/systems-2d.test.ts`, the parity entry the runner's parity job reads
  (follow `extensions/systems/src/testing/patrol-script.ts`)

- [ ] **Step 1: Failing tests:** the agent patrols (its points in metres, one metre a 16 px cell), sees the player
  across open cells, loses them behind a solid cell, and follows into the touching area through `crossing`; its
  speed in pixels is its metres-a-second speed times 16 (Review Focus 7); a 2D agent with a `light` sense and no
  `derived` fact gets
  `2D levels have no lamps, so this sense never notices anything unless the game's code says how bright it is.`
- [ ] **Step 2:** See them fail; implement; pass in Node.
- [ ] **Step 3:** Record the scene's hash in Node; the parity job compares Chromium, WebKit and Firefox. Report which
  engines ran.
- [ ] **Step 4:** `pnpm check`; commit `test(level-2d): enemy behaviour in a 2D level, checked in every engine`.

### Task 16: A 2D story game, edited in the suite and played

The Owner's rule (2026-11-08): content made in the editors must be seen in play, in a served journey. No game uses
`narrative`, `cutscenes` or `systems` in 2D (none uses `narrative` at all today), so this task adds the smallest one.

**Files:**
- Create: `examples/2d-story/` (private, the shape of a `create-game` game plus the extensions): a level project
  with two `area`s ("Hall", "Yard"), a solid wall between them with one gap, an NPC (`keeper`, placed with a `name`),
  a guard; `content/dialogue/keeper.toml` and `content/lines/keeper.toml` (one line, one choice of two),
  `content/cutscenes/gate.toml` (a caption, the keeper walking two cells), `content/systems/guard.toml` (patrol, sight,
  chase), `content/editors.toml` listing Levels, Writer, Sequence, Schematic and the Tuner; `src/` wires
  `level2dExtension`, `narrativeExtension({ places, words })`, `cutscenesExtension({ places, words })`,
  `createNavExtension({ places })`, `systemsExtension({ places })`, `levelScene`, `pictureView` and
  `cutsceneStage2d`. Its behaviour is code: touching the keeper sends `StartCommand`; the second choice starts the
  cutscene.
- Create: `examples/2d-story/tests/e2e/story-in-play.test.ts`

- [ ] **Step 1: Failing unit test** in the example: a scripted run (touch the keeper, Advance, choose 2) reaches the
  cutscene and then the guard's chase, with the same hash in Node twice.
- [ ] **Step 2:** Build the example until it passes; `pnpm check`.
- [ ] **Step 3: Served journey** (Chromium, phone and iPad projects): `automata editor` in the example serves the
  editor and the game. In the suite: Writer changes the keeper's line to "The gate sticks in the rain."; Sequence
  changes the caption to "Later, at the gate."; Schematic changes the guard's chase speed; Save after each. Press
  Play. Walk into the keeper: the dialogue box shows "The gate sticks in the rain." with "Next"; tap the second choice;
  the caption "Later, at the gate." shows above the box's place and the keeper walks; then the guard sees the player
  through the gap and loses them behind the wall. Assert each in the DOM or by reading the sim through the test hook,
  and look at the screenshots and explain them in the log.
- [ ] **Step 4:** If one of #478's Writer, Sequence or Schematic is not built yet, leave its step unchecked, say so in
  the log and the PR, and keep the rest of the journey running. Never write the TOML directly and count it as edited.
- [ ] **Step 5:** Commit `test(examples): a 2D story edited in the suite shows in play`.

### Task 17: Docs and the gate

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
- 2026-11-08: plan audit (Opus, medium): 21 findings, all fixed in the spec and this plan
  ([`2026-11-08-content-in-play-plan-audit.md`](2026-11-08-content-in-play-plan-audit.md)). New Task 16 (the 2D story
  example and its served journey); docs and the gate are now Task 17. 17 tasks.
- 2026-11-08 (build, Sonnet high): merged #478, #473, the full-game-loop PR (#480) up; #476 conflicted heavily with #480 and
  was left out. Tasks 1 to 3 done (tile readers in content; `levelScene`; `pictureView`).
- 2026-11-08 Task 4 done. The template draws its level with core's `levelScene` and its square with `pictureView` of the
  player start (the square stands on the start: bottom edge there). The journey `paint-shows-in-game` makes a game, adds a
  picture in Add tiles, paints Decor tile 5, gives the player start a tile of the picture in Characters, then presses
  Play and reads the canvas pixels (painted cell = tile 5's colour; player = the picture's tile 2 colour). Ran on iPad and
  phone Chromium. Findings: (1) Characters was not in the suite's Levels 2D (only on the standalone page the plan deletes
  in 15.2), so it was ported into the suite (Characters view beside Level and Tiles). (2) No UI points a tile layer at an
  Add-tiles tileset, so the painted cell shows the starter tileset's placeholder colour; only characters can wear the
  added picture. Gap, reported to the coordinator. (3) A real bug the journey found: `/api/list` answered 500 when the
  content build's temp file vanished between readdir and stat, and the Levels 2D save queue then stayed rejected, so
  later edits were never saved. Fixed both (list skips a vanished file; a save that throws shows as a refusal and the
  queue goes on), each with a failing test first.
- 2026-11-08 Task 5 done: `ContentAnimation`, `ContentClip`, `animationSchema` in `@automata/content/level-2d`; the editor's
  `EntityDef2D.animation` and project schema take it; the export carries it.
- 2026-11-08 Task 5b (added on the coordinator's word, after Task 5): the gap Task 4 found. The Level panel shows a "Tiles
  from" picker for a tiles or objects layer once the game has more than one tileset; choosing one is a step
  (`setLayerTileset`: tiles the new set has keep their number, cells past its end are cleared in every level). The
  journey now paints Decor with Add-tiles tile 5 and plays: the pixel at the cell is that tile's colour. iPad and phone.
- 2026-11-08 Task 6 done: core's `pictureView` plays a character's clips (`clips.ts`); the draw list carries placed
  characters with an animation. `examples/2d-story` exists as a skeleton (level, content, tests) so later tasks have a game.
- 2026-11-08 Task 7 done: Characters has an Animation section (choose a picture of frames, frame size, clips with frames,
  speed, repeat, remove). Journey `animation-plays-in-game`: the player start gets a 4-frame picture and a clip of its
  four frames; the saved project holds the clip; in Play the canvas shows the frame colours in turn. Layout test at the
  four sizes in mouse and touch (only a phone's strip overflows; every control meets the pointer's target size).
- 2026-11-08 Task 8 done (Sonnet high, second build session): `@automata/content/controls` owns the controls kind and the lists of what
  may be bound (reserved keys and pad buttons, stick directions, gestures); `controlsFrom` and `keys()` both end in
  `inputMapOf` (`input-map-of.ts`), so ids, payload merging and saved bindings are unchanged. Rulings: a pad button 8 or 16
  in the file says "That button is kept for the menus." (the plan said "key" for both; a pad has buttons, not keys, and the
  drunk grandma test wants the right noun). The browser-entry boundary lists gain `controls`.
- 2026-11-08 Task 9 done: the Tuner's session now holds two files in one history (`TunerState.controls`), so a controls edit and
  a tuning edit undo in one list. Controls section: name, key chips (remove), pad chips (shown, not edited), Add key (waits,
  Cancel, Escape ends it, Tab never taken so Cancel stays reachable), touch switch; layout test at the eight sizes in mouse
  and touch (Chromium). The new game's `content/controls.toml` and the Tuner row in `editors.toml`; `game.ts` calls
  `controlsFrom(Move, CONTROLS)`. Ruling: its own journey file (`controls-change-the-game`) rather than another step in the
  long paint journey, so each journey stays one story; it presses Add key and J in the Tuner, Plays, holds J, and the
  square moves left (iPad and phone, Chromium; the first version flaked on iPad because it held J for a fixed 600 ms, now
  it looks again until the square has moved).
- 2026-11-08 Task 10 done: `extensions/places` (private) holds the `Places` contract; `sectorsPlaces` (sectors) answers it with
  exactly what nav, narrative and systems read before (`InSector`, the resolved map, `blockedBy`, systems' crossing maths),
  so no 3D hash, golden or replay moved (unit suites: sectors 49, nav 25, narrative 137, cutscenes 71, systems 63,
  pipelines 190, base-3d 105, all green). `blockedBy` moved from nav to sectors (nav re-exports it). Each consumer takes
  `places?: Places` (default sectors) and its extension/plugin `requires`/`dependsOn` the provider. Rulings: (1) `Places`
  gained `roomOf(ctx, sid)`, the room as of the last step, because narrative and systems read `InSector.sector` (membership
  decided in sectors' `cleanup`), which can lag the position by a step; reading `roomAt(position)` instead would move a
  3D hash. (2) The cutscene lint has no sim context, so it takes a structural `LintFloor` (`sectorAt`, `segmentBlocked`;
  sectors' `ResolvedMap` fits) instead of `Places`; cutscenes' extension requires `options.places?.provider ?? 'sectors'` by
  name and no longer lists `@automata/sectors` as a peer. (3) Nothing added to any plugin's `config`. Pre-existing and left:
  `pnpm typecheck` fails in `extensions/editors` (svelte-check warning exits 1) and knip lists `examples/2d-story/ship.config.ts`,
  `@automata/feel` and `@testing-library/user-event` in `extensions/editors`.
- 2026-11-08 Task 11 done: `extensions/level-2d` (private, `@automata/level-2d`, sim entry `./sim`): `level2dPlaces`, `Level2dAt`,
  `cellWalls`, `level2dExtension`. 15 unit tests (Node). Rulings: (1) a point on a shared edge goes to the first area, so
  containment is on closed rectangles in file order (spec). (2) `cellWalls` with no margin treats touching a cell's edge as
  not crossing it (a walker may stand on a floor's top edge); with a margin it is the distance from the segment to the cell
  that must reach the margin. (3) A walls layer with no value called `solid` and no `solid` option throws a sentence, so a
  mistyped layer does not silently mean "no walls"; a project with no IntGrid layer has no walls. (4) `roomOf` reads the
  position now (no lag in 2D). (5) `Math.hypot` is refused by `pnpm boundaries` in sim code, so the maths uses `hypot` from
  `@automata/sim/math`.
- 2026-11-08 Task 12 done: `PlaySession` / `usePlay()` in `packages/automata/src/shared/ui/slots/play-context.svelte.ts`, exported from
  `@automata/framework` (the `ui` entry; not `/extension`, which Node reads and must not pull in a `.svelte.ts`). `PlayScreen` provides the
  context and refreshes the session each animation frame, only when a hud component exists. Rulings: (1) `send` takes
  `{ type, payload }` (a full `Command` fits); the stream fills in tick, source 0 and a seq of its own (`tick + 1 + n`; the input
  map's seq is the tick, and a seq may be used once per source in a step). (2) The recording is "the stream
  `appLoop.run({ commands })` is given"; there is no recorder in the runtime. Tests: 6 in jsdom (read follows the frame, rAF
  refresh, read-only view, the outside-a-screen sentence, order and seqs, a recorded stream replays to the same hash).
- 2026-11-08 Task 13 done: the dialogue box (`extensions/narrative/src/features/box/`: `dialogue-box.ts` model, `DialogueBox.svelte`,
  `box-slot.ts`). `narrativeExtension({ words, lines })` puts it in `hud.overlay` (only when `words` is given, so a 3D game
  that draws its own lines is unchanged). Narrative now builds Svelte (svelte-check typecheck, jsdom tests name the environment
  on their first line, `alsoInNode` narrowed to `tests/browser/shared` so the layout test runs only in browsers). Rulings:
  (1) `lines` is a second option: line records are content and the sim does not hold them, so the box cannot find a line's
  speaker and key without it (the spec named only `words`). (2) The box reads the conversation with `view()` over a reader
  built from the draw layer's read-only view (`puzzleReader`, factored out of narrative.system so the sim and the box use
  one function); a condition on a fact the game maps through `options.facts` is not visible to the box, so such a choice
  could show that the sim then refuses (it does nothing). (3) The speaker is `words('speaker.<id>')`, else the id read aloud
  (`nurse-jo` as `Nurse jo`); "Next" is `words('dialogue.next')`, else "Next". (4) The pad's A is read by the box itself
  (the default play screen only steers its menus with a pad): it presses the focused button. (5) Core: `PlayHost`/`mountInPlay`
  in `@automata/framework/testing` mounts a slot component in the real `PlayScreen`; `.af-game-play__field` is
  `position: relative`. Tests: 15 DOM/model (jsdom), 3 layout (Chromium: 390x844, 844x390, 1024x768; WebKit and Firefox are
  not installed here); core screens layout suite 401 passes in Chromium.
