# Edited content shows in play

Status: spec, 2026-11-08. Plan: [`2026-11-08-content-in-play-plan.md`](2026-11-08-content-in-play-plan.md). Evidence:
[`2026-11-08-complete-game-gaps.md`](2026-11-08-complete-game-gaps.md) (the investigation; its paths are
repeated below where a task needs them). Plan audit (2026-11-08, findings F1 to F21, all fixed here and in the plan):
[`2026-11-08-content-in-play-plan-audit.md`](2026-11-08-content-in-play-plan-audit.md).

## 1. The goal, and what it is not

The Owner, 2026-11-08 04:14: "I didn't say anything about no code, I want humans to be able to modify content."

So the goal is: **what a person changes in an editor is what the game shows**, in 2D as in 3D. Code stays the way a
game says what it does (moving, jumping, winning). This work closes the places where a person edits content today and
then never sees it in play, or cannot edit content that is still written in code.

Test of every item below: does it let a person see or change a game's content? If it only replaces game code, it is cut.

| Gap step (gaps doc) | Decision | Why |
| --- | --- | --- |
| 1. Core draws 2D tile layers and placed characters | **Keep** | Tiles, auto tiles, objects and placed characters are painted in Levels and are invisible in play. |
| 2. Ready-made behaviours (player, pickup, hazard, health, exit, enemy) | **Cut** | It exists to replace game code. A game's code reads the characters' fields the Characters view already edits. |
| 3. Narrative, cutscenes and systems in 2D; dialogue box and captions | **Keep** | Writer, Sequence and Schematic content runs only in 3D games, and nothing draws a line or a caption anywhere. |
| 4. Animation clips in Characters | **Keep** | Clips (frames, speed, loop) are art content. Code still picks which clip plays, by name. |
| 5. HUD pieces as data | **Cut** | A HUD's numbers belong to the game's code, and pieces-as-data mostly replace that code. The HUD's words already go through the game's messages, which translators edit. |
| 6. Default controls as data | **Keep** | Which keys, buttons and touch controls a game starts with, and what each action is called, is content a designer tunes; today it is code. |

## 2. Core draws a 2D level (step 1)

Core gets one way to show an exported level (`levels/<id>.toml` plus `project.toml`, as the 2D editor writes them):

- **Background:** the level's colour, and its image in its mode (`fit`, `cover`, `repeat`, `repeat-x`).
- **Tile layers** (`tiles`), **auto layers** (`auto`, drawn from their exported stacks, depth 0 first) and **objects
  layers**, back to front in the reverse of `project.layers`, as the editor draws them
  (`packages/editor/src/shared/level-2d/canvas/draw/level-draw-list.ts:145`).
- **IntGrid layers are not drawn.** They are the game's rules (walls, water), shown through the auto layers built on them.
- **Placed characters** (entities layers): each item drawn with its definition's picture (section 4) in the box the
  editor gives it (`entityBounds`: its position, its pivot, and its own `w`/`h` when the definition is resizable). A definition the game spawns itself (its player, its enemies) is listed in `live`; core does not draw those
  items, and the game draws its entity with `pictureView` (section 4) so it still looks the way Characters says.
- **A tile with no picture** (a placeholder tileset, a missing image, an index past the set) draws as the editor's
  flat placeholder colour, `PLACEHOLDER_COLORS[tile % 12]`. Never a crash, never an empty hole the editor did not show.

One owner for the tile rules: the row tokens (`7h`, `.*5`, `12hv*3`), the frame of a tile in its tileset, and the
placeholder colours move from the editor into `@automata/content/level-2d`. The editor imports them from there.

How a game opts in: `defineGame({ level: levelScene({ project, levels, images, start, live }) })`. `project` and
`levels` are the compiled content's non-sim half (`content.project`, `content.levels` from `virtual:automata/content`;
`project` is a `sim: false` kind). `images` maps a workspace path to the URL the build gives it. Add tiles writes every
picture flat in `assets/` (`assets/terrain.png`, the editor's `tilePicturePath` rule; a subfolder is refused by the
workspace policy), so a new game builds the map with `import.meta.glob('/assets/*.{png,webp,jpg,jpeg}', { eager: true,
query: '?url', import: 'default' })` and drops the leading `/`. The scene draws `start` and redraws when the game's
`current(sim)` names another level. It reads the sim through the draw layer's `DrawSim` (a stage hook's `FrameInfo`
carries no sim), so `defineGame` wires it beside the draw layer. It is drawn under the entity views and over nothing
else; the camera is the game's. A 3D game (`createRenderer` set) with `level` is a spec error: "`level` draws 2D levels;
a 3D game draws its rooms itself."

This is presentation only (law 2). The sim never reads the scene; a game's sim keeps reading the level with
`intGridRows` and `entitiesOf`, as now.

The new-game template stops drawing walls as rectangles: it uses `level` and draws its square with `pictureView` of
`player-start`, so a person who paints the level or gives the player start a picture sees it in the game. Its walls
still show with no picture: the `ground` auto layer is built on `collision`, and its placeholder tileset draws as the
placeholder colours. A painted tile is a picture only once Add tiles has given the game a tileset image. Emberwick
keeps its own drawing; moving it is not part of this work.

## 3. Writer, Sequence and Schematic content in 2D (step 3, runtime half)

The editors are the "Build the remaining editors" thread's (PR #478). This work makes their content run in a 2D game.

### 3.1 Places: one small contract instead of "requires sectors"

`narrative`, `cutscenes`, `nav` and `systems` read 3D rooms today (`requires: ['sectors', …]`). What they need from
sectors is small: where an entity stands on the plan, which room that is (id and zone), whether a straight line is
blocked for walking or for sight, how to place a spawned agent, and the rooms' list. A new extension
`extensions/places` (`@automata/places`) holds that contract as types and pure helpers only (no sim state, no plugin):

```ts
export interface PlanPoint { readonly x: number; readonly z: number }
export interface PlanRoom { readonly id: string; readonly zone: string }
export interface Places {
  /** The extension that provides the places: 'sectors' (3D) or 'level-2d' (2D). Consumers require it. */
  readonly provider: string
  at(ctx: SimContext, sid: number): PlanPoint | undefined
  move(ctx: SimContext, sid: number, to: PlanPoint): void
  /** The components a new agent standing at `p` is spawned with. */
  spawnAt(p: PlanPoint): readonly SpawnPart[]
  rooms(ctx: SimContext): readonly PlanRoom[]
  /** 1-based index into `rooms`, 0 for none. */
  roomAt(ctx: SimContext, p: PlanPoint): number
  walk(ctx: SimContext, doors: Readonly<Record<string, boolean>>): Blocked
  sight(ctx: SimContext, doors: Readonly<Record<string, boolean>>): Blocked
  /**
   * Where a walker leaves room `from` for room `to`: the middle of the edge they share, and the point `THROUGH` past it
   * inside `to`; null when they do not touch. Systems' pursuit follows the player through it (`crossingOf` today).
   */
  crossing(ctx: SimContext, from: string, to: string): PlanCrossing | null
}
export interface PlanCrossing { readonly x: number; readonly z: number; readonly into: PlanPoint }
```

`Blocked` moves from `nav` to `places` (nav re-exports it). `Point` stays a sectors name and becomes an alias of
`PlanPoint`. In 2D, `z` is the level's `y` (down the screen); every consumer already treats the plan as two numbers.

**The plan is in metres in both dimensions.** Every number the consumers hold is in metres: systems' speeds (metres a
second), sense ranges and radii, pursuit's `THROUGH` (0.5) and `FOLLOW_CLEAR` (1.5), nav graphs and patrol points. A 2D
level is in pixels, so `level2dPlaces` converts at its edge: one metre is `metre` level pixels, by default the walls
layer's grid (16 px in the new-game template). A patrol point at `{ x: 4, z: 2 }` is the cell 4 across and 2 down. No
consumer learns about pixels.

- `blockedBy` (today `extensions/nav/src/shared/sim/blocked.ts`) moves into `sectors`, and nav re-exports it. Nav
  depends on sectors, so sectors cannot import nav; this keeps `sectorsPlaces` free of a cycle.
- `sectors` exports `sectorsPlaces`, built from what consumers read today (`InSector`, `resolvedMap`, `blockedBy`,
  and `crossing` from systems' `crossingOf`, which moves with it). It is the default for every consumer, so **no 3D
  hash, golden or replay moves**. Each plugin's `dependsOn` becomes `[places.provider, …]` (so `'sectors'` in 3D, as
  now), and no plugin's `config` gains a field. If a hash moves, the change is wrong.
- `navExtension` and `navPlugin` stay as they are (sectors) for 3D games; `createNavExtension({ places })` is new, and
  `navExtension = createNavExtension()`.
- A new extension `extensions/level-2d` (`@automata/level-2d`, name `level-2d`) exports `level2dPlaces(options)`:
  - position: **the game's own position component**, named in the options (`position: { component, x: 'x', y: 'y' }`,
    in level pixels). A 2D game already moves its player with its own component, and one piece of state has one
    owner (law 2), so places reads and writes that component instead of keeping a copy. A game with none uses the
    extension's `level-2d.at` `{ x: f32, y: f32 }`. `spawnAt` spawns with whichever it is;
  - rooms: the items of the definition tagged `area` (resizable rectangles placed in Levels), `id` from the item's
    `name` field or else its id, `zone` from its `zone` field or else the id; the first area in file order wins where
    two overlap. Characters cannot set a definition's tags or make it resizable, so the new-game template and the 2D
    story example ship an `area` definition (Area, a rectangle, resizable both ways, tagged `area`, text fields `name`
    and `zone`); a person places and stretches areas in Levels;
  - walls: IntGrid cells whose value is in `solid` (default: the value whose id is `solid`); walking and sight both
    test the segment against those cells, with the walker's margin;
  - crossing: two areas whose rectangles share an edge of positive length touch; the crossing is that shared
    segment's middle, and `into` is `THROUGH` metres past it inside `to`.
- `narrativeExtension`, `cutscenesExtension`, `navExtension` and `systemsExtension` take `places?: Places`. Their
  `requires` becomes `[places.provider, …the rest]`, so a 2D game requires `level-2d` and never `sectors`.

### 3.2 Cutscenes in a 2D game

The director is unchanged (it already gives a scene state at any time). `extensions/cutscenes` adds a 2D stage for it,
as a new entry `@automata/cutscenes/stage-2d` (the director's own package; `level-2d` stays sim-only, so a 2D game with
areas and no cutscenes pulls no cutscene code). The stage reads `CutsceneState` (`id`, `start`) through the draw
layer's `DrawSim` and asks the director for the state at `(tick - start) / tickRate`:

- the camera centres on `look`'s `x` and `z` (metres, converted with the level's `metre`); `lens` and the camera's
  height are ignored;
- each actor is the placed character whose `name` field (or else id) is the actor's `who`, drawn at the actor's `x`
  and `z` with its picture; a cue's clip plays on it (section 4); the item's normal drawing is hidden while the scene
  runs;
- the fade and the shake are drawn; the caption shows in the caption box (3.3);
- doors, lamps, props, time and grade are 3D only. The cutscenes lint gains `rule: '3d-only'`, a warning on such a
  key when the game says it is 2D: "This step only works in 3D games. It does nothing here." (Sequence shows lint
  warnings in words already.) The lint's floor and wall checks read the same `Places` the sim uses (`roomAt`, `walk`)
  instead of `ResolvedMap`, so a 2D cutscene is checked against its level's areas and walls.

### 3.3 A dialogue box and captions

Nothing draws a line, a choice or a caption today, in 2D or 3D. The dialogue box is the narrative extension's
`hud.overlay` component and the caption is the cutscenes extension's, so a game that adds the extension gets them with
no code. (The caption cannot live in narrative: cutscenes depends on narrative, so narrative reading cutscenes' state
would be a cycle.)

- **Dialogue box:** along the bottom of the visible region. The speaker's name, then the line. While more follows, a
  "Next" button (48 px), which takes focus, so Enter, Space and the pad's A press it; with choices, one button per
  choice (each at least 48 px, stacked on a phone, its number 1 to 9 shown and pressable on a keyboard). It never
  covers Pause. Focus moves to the first choice when choices appear and comes back to the game when the conversation
  ends.
- **Caption:** a line of text above the dialogue box's place, shown while a cutscene's caption is up. A caption is
  not a button and takes no focus. Captions are narrative lines (kind `caption`), so they read their words the same
  way the box does.
- **Words.** A line record's `text` is a locale key, not the words (`lines.schema.ts`). The box and the caption show
  `words(key)`, which the game passes as `narrativeExtension({ words })` (its message catalog, the same one its screens
  use). A key with no words is reported once with `reportError` ("The line "<id>" has no words yet. Write them in
  Writer.") and the box shows the speaker with an empty line; a key is never shown to a player. Where Writer saves the
  words is the Writer spec's call (PR #478, one spec per editor); `words` reads that same catalog, and the 2D story
  journey (section 9) proves the two meet. The box adds only "Next", which goes through the game's messages like every
  screen word.

A slot component takes no props today and cannot read the sim. Core adds one small thing: a play context for slot
components, `usePlay()`, giving the read-only sim (`DrawSim`, the draw layer's own view) updated each frame, and
`send(command)`, which queues a command for the next tick and hands it to the sim through the same `commands(tick)`
callback the input map's commands go through (`default-screens.ts`), after them, in send order, so anything that
records that stream records it too (law 1). Nothing else is added to core for this step.

### 3.4 Systems (enemy and NPC behaviour) in 2D

With `places`, the systems agents patrol, sense and chase in a 2D level: patrol points and nav nodes are plan points
in metres (one metre is one grid cell by default); sight is blocked by solid cells; a chase follows the player through
touching areas. Light and warmth senses read the game's own `derived` facts in 2D (a 2D level has no lamps); the
systems lint says so when a 2D game's agent uses them without a derived fact: "2D levels have no lamps, so this sense
never notices anything unless the game's code says how bright it is."

`nav` in 2D walks the authored graph like 3D. A 2D level's graph is written the way a 3D scene's is today, in metres;
drawing one in Levels is not part of this work.

Schematic is being re-specified as the game's AI editor (PR #478, one spec per editor). Whatever it adds to `systems`
reads positions, rooms and walls through `places`, so it works in 2D and 3D alike; this work changes how systems reads
the world and nothing in its schema.

## 4. Animation clips (step 4)

A character definition may have an animation: a picture cut into equal frames, and named clips over those frames.

```toml
[entities.animation]
image = "assets/hero.png"
frame = { w = 16, h = 24 }
[[entities.animation.clips]]
id = "idle"
frames = [0, 1]
fps = 4
loop = true
[[entities.animation.clips]]
id = "run"
frames = [2, 3, 4, 5]
fps = 10
loop = true
```

- It lives in the level project with the definition and is exported to `project.toml`
  (`projectContentSchema` gains the optional `animation`; a file without it reads as before).
- A definition's picture is its animation's first clip's first frame, else its tile when its shape is `tile` (the
  editor draws a tile only then: `level-draw-list.ts` `entitiesOf`), else its colour as its flat shape (rectangle,
  ellipse, or the editor's point marker). Game and editor share this rule from `@automata/content/level-2d`
  (`pictureOf(def)`), so they cannot drift.
- `pictureView(project, def, images, { clip? })` (core render) draws an entity with its definition's picture. With an
  animation it is a Pixi `AnimatedSprite`: `clip(components)` returns the clip's name from the entity's state; a
  change restarts the new clip from its first frame; a name the definition lacks shows the first clip and is reported
  once with `reportError`. Clip timing is presentation time; the sim never reads it.
- **In Characters** (2D editor): a definition gets an "Animation" section. "Add picture" picks an image the same way
  Add tiles does and writes it into the game's `assets/` (flat, `pictureAsset`'s name). Add tiles' write is inline in
  `AddTilesDialog.svelte` today and a feature may not import another, so the pick-and-write moves to `shared/pictures/`
  and both use it; frame width and height; a strip of the cut frames (numbered);
  the clips as rows (name, frames by tapping them in the strip, speed in frames a second, "Repeat" yes or no); the
  chosen clip plays beside the rows. Removing a clip asks nothing and is undone with Undo. No pixel painting: the
  section says "Draw your frames in any paint app, then add the picture here."

## 5. Default controls as data (step 6)

`content/controls.toml` holds a game's default controls: the actions, what each sends, and its keys, pad buttons, touch
button and name. It is the same data `keys()` takes in code today.

```toml
command = "move"
[[action]]
id = "left"
label = "Left"
send = { x = -1 }
keys = ["ArrowLeft", "KeyA"]
pad = [14]
touch = true
```

- `@automata/content` adds the `controls` kind (Zod; `label`, `keys`, `pad`, `touch`, `stick`, `gesture`, `required`
  as `keys()` options name them). It is not sim content. Reserved keys (`Escape`, `Tab`) and pad buttons 8 and 16 are
  refused by the schema with "That key is kept for the menus." `RESERVED_KEYS` and `RESERVED_PAD_BUTTONS` move from
  core's `input-profile.schema.ts` into `@automata/content/controls` (content is below core, so it cannot import
  them); core imports them from there, one owner.
- Core adds `controlsFrom(command, controls)`. It cannot be built on `keys()`: `keys()` names its actions
  `<command>-<n>` and merges actions that send the same payload, and its `touch` is one switch for every action. So
  `keys()`'s body becomes a shared builder over a list of actions, `keys()` keeps its generated ids (saved player
  bindings of today's games are keyed by them and keep working), and `controlsFrom` passes the file's actions with
  their own ids, labels and per-action `touch`. A `send` the command's schema refuses fails the game's start with the
  action's id and the schema's sentence.
- The **Tuner** gains a "Controls" section when the game has the file: one row per action with its name (editable),
  its keys as chips, "Add key" (it says "Press a key on your keyboard." with a Cancel button, since a phone has no
  Escape), its pad buttons, and "Show a button on touch screens" yes or no. Key and pad names are core's own prompt
  words (`keyLabel`, `padLabel` in `shared/ui/prompts/prompt-label.ts`, exported for this), the same names the game's
  prompts and Settings show. Players still rebind in Settings; the Tuner changes what a new player starts with.
- The new-game template moves its arrow and WASD keys into `content/controls.toml` and its editor list opens it in the
  Tuner. PR #478 is changing new games to list every editor's files; the controls row is added beside those rows, not
  in place of them.

## 6. Where things live

| Piece | Package | Why there |
| --- | --- | --- |
| Tile rules, placeholder colours, `pictureOf`, `animation` schema, `controls` kind, reserved keys | `@automata/content` (`level-2d/`, `controls/`) | Read by the editor, the game and the sim-safe readers; one owner |
| `levelScene`, `pictureView`, `controlsFrom`, `usePlay` | `@automata/framework` (core) | Every 2D game needs them; small; no extension import |
| Places contract | `extensions/places` | Shared by four extensions; core never needs it |
| `sectorsPlaces`, `blockedBy`, the sector crossing | `extensions/sectors` | Sectors' own geometry; nav and systems re-export or call it |
| 2D places | `extensions/level-2d` | 2D-only behaviour stays opt-in; sim only |
| 2D cutscene stage, caption | `extensions/cutscenes` (`stage-2d` entry, `hud.overlay`) | Beside the director and its state |
| Dialogue box | `extensions/narrative` | Only a game with narrative needs it |
| The 2D story example | `examples/2d-story` (private) | The game the served journey plays; proves the content meets the runtime |
| Animation section, Controls section | `@automata/editor` (Characters, Tuner) | Those views are core editors |

Core grows by four small functions and one context. Everything that only some games need is in an extension.

## 7. The drunk grandma test

- Every new word on a screen is a plain sentence: "Next", "Add picture", "Add key", "Show a button on touch screens",
  "Repeat", "Press a key on your keyboard."
- No key codes on screen: keys and pad buttons show as core's prompt words (`keyLabel`: `ArrowLeft` is "←", `KeyA`
  is "A"; `padLabel` for the pad), the same names the game shows a player.
- Nothing a player sees is a key or an id: a line with no words shows none and is reported (3.3).
- An error in play names the thing a person made: "The level "Cave" uses tile 70, but "Terrain" has 64 tiles."
- A clip that does not exist is never a blank sprite: the first clip shows.

## 8. Not in this work

- The cut steps 2 and 5 (section 1).
- Drawing nav graphs or patrol routes in Levels; a 2D nav graph is written as TOML.
- Moving Emberwick onto `levelScene` (it draws its own art).
- Writer, Sequence and Schematic editors themselves (PR #478).
- 3D animation (the Studio already has clips).

## 9. Checks

- Unit tests for every reader and helper; DOM tests for the dialogue box, the Animation section and the Controls
  section; a real-browser layout test of the dialogue box at phone size (portrait and landscape) and at 1024 px.
- **Served journeys prove that what is made in the editors shows up in play** (the Owner's standing rule,
  2026-11-08: unit tests alone do not count). Both run against the game `automata editor` serves and open it with the
  editor's Play button (the "Make a full game from the editors" work, stacked on #473):
  - **Levels and characters:** a new game from `create-game`; in the suite, Add tiles with a real picture, paint one
    `decor` tile, give `player-start` the shape Tile and a tile, give `coin` an animation; Save; Play. The game's level
    container holds a sprite at the painted cell with the picture's frame, the square's view shows the chosen tile, and
    a placed coin plays its clip (screenshot looked at and explained in the log).
  - **Dialogue, cutscenes and AI in 2D:** `examples/2d-story` (a 2D level with two areas, a wall, an NPC, one guard,
    one conversation and one cutscene). In the suite: change a line's words in Writer, a caption in Sequence and the
    guard's chase speed in Schematic; Save; Play. Walking into the NPC opens the dialogue box with the new words; a
    choice is picked with a tap; the cutscene runs with the new caption; the guard sees the player across open cells
    and loses them behind the wall. Phone and iPad sizes.
  If #478's Writer, Sequence or Schematic is not built when this runs, that editor's step is left unchecked and named
  as pending; the journey never edits the file behind the editor's back and calls it done.
- 3D: the sectors, narrative, cutscenes, nav and systems tests and the 3D parity hashes are unchanged.
- 2D: a systems scene in a 2D level (an agent patrols, sees the player past an open cell, loses them behind a wall)
  gives the same hash in Node, Chromium, WebKit and Firefox.
- `pnpm check`; `pnpm build`, `pnpm api-report --update`, `pnpm agent-skills --write` and `pnpm cheatsheet` after the
  core exports change.
