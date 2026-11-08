# Edited content shows in play

Status: spec, 2026-11-08. Plan: [`2026-11-08-content-in-play-plan.md`](2026-11-08-content-in-play-plan.md). Evidence:
[`2026-11-08-complete-game-gaps.md`](2026-11-08-complete-game-gaps.md) (the investigation; its paths are
repeated below where a task needs them).

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
- **Placed characters** (entities layers): each item drawn with its definition's picture (section 4) at its position and
  pivot. A definition the game spawns itself (its player, its enemies) is listed in `live`; core does not draw those
  items, and the game draws its entity with `pictureView` (section 4) so it still looks the way Characters says.
- **A tile with no picture** (a placeholder tileset, a missing image, an index past the set) draws as the editor's
  flat placeholder colour, `PLACEHOLDER_COLORS[tile % 12]`. Never a crash, never an empty hole the editor did not show.

One owner for the tile rules: the row tokens (`7h`, `.*5`, `12hv*3`), the frame of a tile in its tileset, and the
placeholder colours move from the editor into `@automata/content/level-2d`. The editor imports them from there.

How a game opts in: `defineGame({ level: levelScene({ project, levels, images, start, live }) })`. `images` maps a
workspace path (`assets/tiles/terrain.png`) to the URL the build gives it; a new game builds it with
`import.meta.glob`. The scene draws `start` and redraws when the game's `current(sim)` names another level. It is drawn
under the entity views and over nothing else; the camera is the game's.

This is presentation only (law 2). The sim never reads the scene; a game's sim keeps reading the level with
`intGridRows` and `entitiesOf`, as now.

The new-game template stops drawing walls as rectangles: it uses `level` and draws its square with `pictureView` of
`player-start`, so a person who paints the level or gives the player start a picture sees it in the game. Emberwick
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
  /** Rooms whose edges touch, for a chase that leaves one room for another. */
  neighbours(ctx: SimContext, room: string): readonly string[]
}
```

`Blocked` moves from `nav` to `places` (nav re-exports it). `Point` stays a sectors name and becomes an alias of
`PlanPoint`. In 2D, `z` is the level's `y` (down the screen); every consumer already treats the plan as two numbers.

- `sectors` exports `sectorsPlaces`, built from what consumers read today (`InSector`, `resolvedMap`, `blockedBy`). It
  is the default for every consumer, so **no 3D hash, golden or replay moves**. If one does, the change is wrong.
- A new extension `extensions/level-2d` (`@automata/level-2d`, name `level-2d`) exports `level2dPlaces(options)`:
  - position: its own component `level-2d.at` `{ x: f32, z: f32 }`;
  - rooms: the items of the definition tagged `area` (resizable rectangles placed in Levels), `id` from the item's
    `name` field or else its id, `zone` from its `zone` field or else the id; the first area in file order wins where
    two overlap;
  - walls: IntGrid cells whose value is in `solid` (default: the value whose id is `solid`); walking and sight both
    test the segment against those cells, with the walker's margin;
  - neighbours: areas whose rectangles share an edge of positive length.
- `narrativeExtension`, `cutscenesExtension`, `navExtension` and `systemsExtension` take `places?: Places`. Their
  `requires` becomes `[places.provider, …the rest]`, so a 2D game requires `level-2d` and never `sectors`.

### 3.2 Cutscenes in a 2D game

The director is unchanged (it already gives a scene state at any time). `extensions/level-2d` adds a 2D stage for it:

- the camera centres on `look`'s `x` and `z` (as the level's `x` and `y`); `lens` and the camera's height are ignored;
- each actor is the placed character whose `name` field (or else id) is the actor's `who`, drawn at the actor's `x`
  and `z` with its picture; a cue's clip plays on it (section 4); the item's normal drawing is hidden while the scene
  runs;
- the fade and the shake are drawn; the caption shows in the caption box (3.3);
- doors, lamps, props, time and grade are 3D only. The cutscenes lint gains `rule: '3d-only'`, a warning on such a
  key when the game says it is 2D: "This step only works in 3D games. It does nothing here." (Sequence shows lint
  warnings in words already.)

### 3.3 A dialogue box and captions

Nothing draws a line, a choice or a caption today, in 2D or 3D. The narrative extension gains them in the
`hud.overlay` slot, so a game that adds the extension gets them with no code:

- **Dialogue box:** along the bottom of the visible region. The speaker's name, then the line. While more follows, a
  "Next" button (48 px) and the advance key; with choices, one button per choice (each at least 48 px, stacked on a
  phone, numbers 1 to 9 on a keyboard). It never covers Pause. Focus moves to the first choice when choices appear and
  comes back to the game when the conversation ends.
- **Caption:** a line of text above the dialogue box's place, shown while a cutscene's caption is up. A caption is
  not a button and takes no focus.
- Words a player reads come from the game's lines (`content/lines`); the box adds only "Next", which goes through the
  game's messages like every screen word.

A slot component takes no props today and cannot read the sim. Core adds one small thing: a play context for slot
components, `usePlay()`, giving the read-only sim (`DrawSim`, the draw layer's own view) updated each frame, and
`send(command)`, which queues a command for the next tick exactly as input does, so it is recorded and replayed the
same way (law 1). Nothing else is added to core for this step.

### 3.4 Systems (enemy and NPC behaviour) in 2D

With `places`, the systems agents patrol, sense and chase in a 2D level: patrol points and nav nodes are plan points
(`x`, `z` = level `x`, `y`); sight is blocked by solid cells; a chase follows the player through neighbouring areas.
Light and warmth senses read the game's own `derived` facts in 2D (a 2D level has no lamps); the systems lint says so
when a 2D game's agent uses them without a derived fact: "This sense needs the game to say how bright it is here."

`nav` in 2D walks the authored graph like 3D. A 2D level's graph is written the way a 3D scene's is today, with level
pixel points; drawing one in Levels is not part of this work.

## 4. Animation clips (step 4)

A character definition may have an animation: a picture cut into equal frames, and named clips over those frames.

```toml
[entities.animation]
image = "assets/characters/hero.png"
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
- A definition's picture is its animation's first clip's first frame, else its tile, else its colour as a flat shape
  (the editor's look).
- `pictureView(project, def, images, { clip? })` (core render) draws an entity with its definition's picture. With an
  animation it is a Pixi `AnimatedSprite`: `clip(components)` returns the clip's name from the entity's state; a
  change restarts the new clip from its first frame; a name the definition lacks shows the first clip and is reported
  once with `reportError`. Clip timing is presentation time; the sim never reads it.
- **In Characters** (2D editor): a definition gets an "Animation" section. "Add picture" picks an image the same way
  Add tiles does and writes it into the game's `assets/`; frame width and height; a strip of the cut frames (numbered);
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
  as `keys()` options name them). It is not sim content.
- Core adds `controlsFrom(command, controls)`, which builds the same `InputMap` `keys(command, …)` builds; a `send`
  the command's schema refuses fails the game's start with the action's id and the schema's sentence. Reserved keys
  (`Escape`, `Tab`) and pad buttons 8 and 16 are refused by the schema with "That key is kept for the menus."
- The **Tuner** gains a "Controls" section when the game has the file: one row per action with its name (editable),
  its keys as chips, "Add key" (press the key), its pad buttons, and "Touch button" yes or no. Players still rebind in
  Settings; the Tuner changes what a new player starts with.
- The new-game template moves its arrow and WASD keys into `content/controls.toml` and its editor list opens it in the
  Tuner.

## 6. Where things live

| Piece | Package | Why there |
| --- | --- | --- |
| Tile rules, placeholder colours, `animation` schema, `controls` kind | `@automata/content` (`level-2d/`, `controls/`) | Read by the editor, the game and the sim-safe readers; one owner |
| `levelScene`, `pictureView`, `controlsFrom`, `usePlay` | `@automata/framework` (core) | Every 2D game needs them; small; no extension import |
| Places contract | `extensions/places` | Shared by four extensions; core never needs it |
| 2D places, 2D cutscene stage | `extensions/level-2d` | 2D-only behaviour stays opt-in |
| Dialogue box, caption | `extensions/narrative` | Only a game with narrative needs them |
| Animation section, Controls section | `@automata/editor` (Characters, Tuner) | Those views are core editors |

Core grows by four small functions and one context. Everything that only some games need is in an extension.

## 7. The drunk grandma test

- Every new word on a screen is a plain sentence: "Next", "Add picture", "Add key", "Touch button", "Repeat".
- No key codes on screen: `ArrowLeft` shows as "←", `KeyA` as "A", pad 0 as "A button (bottom)".
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
- A journey: a new game from `create-game`, a tile painted and a picture given to the player start in the suite, Save,
  and the dev game shows both (screenshot compared and explained, plus a DOM check that the level container has the
  painted tile's sprite).
- 3D: the sectors, narrative, cutscenes, nav and systems tests and the 3D parity hashes are unchanged.
- 2D: a systems scene in a 2D level (an agent patrols, sees the player past an open cell, loses them behind a wall)
  gives the same hash in Node, Chromium, WebKit and Firefox.
- `pnpm check`; `pnpm build`, `pnpm api-report --update`, `pnpm agent-skills --write` and `pnpm cheatsheet` after the
  core exports change.
