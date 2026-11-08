# What's missing to make a whole game with the editors

2026-11-08. Checked against `main`, the open pull-request stack up to #476, the extensions port (#458), the old
`automata-plus` repository and the plans in this folder. Nothing was built.

## The short answer

The editors make a game's **stuff**: levels, numbers, 3D characters, and (being built now) sounds, feel, dialogue,
cutscenes and puzzles. What a game **does** (run, jump, pick things up, get hurt, win) is still written in code, every
time. A new 2D game from `create-game` is a yellow square that moves around a level, and the only editor its list opens
is Levels. A new 3D game opens Levels 3D, the Studio and the Tuner, and its hero's walk is code too.

Three things stop "editors only" before any missing editor does:

1. **In a 2D game, what you paint doesn't show up.** Core has no code that draws a level's tiles or the characters
   placed in it. The new-game template draws walls as plain rectangles, and Emberwick draws its own art in code. (In 3D
   it does work: the rooms, props and lamps you build are drawn for you.)
2. **Dialogue, cutscenes and enemy behaviour only work in 3D games.** The extensions behind Writer, Sequence and
   Schematic's characters refuse to start without 3D levels (`requires: ['sectors', …]`).
3. **Schematic's behaviour is sneak-and-chase.** A character can patrol, hear, see, chase and lose you. There is no
   health, damage, attack or anything shot. Schematic's other half, puzzles (locks, keys, goals, checkpoints), is fine.

## Area by area

"Code" means the framework can do it today if someone writes it. "Editor" means a person can do it without code.

| Area | Code today | Editor today | Needs |
|---|---|---|---|
| **What the game does** (moving, jumping, pickups, hazards, winning) | Yes, written per game | No | Ready-made behaviours you pick for a character (see 2 below) |
| **2D level drawn in the game** | No: no tile drawing, no placed characters shown | Painted in Levels, but unseen in play | Core fix, no new editor (1) |
| **2D pictures** | Yes: import an image, pack frames into one sheet | Add tiles imports a picture | Nothing more. Drawing pixels belongs in a paint app |
| **2D animation** | Partly: a sheet of frames, picked by a number the game sets | No | Named clips (idle, run, jump) with a speed, as data and a tab in Characters (4) |
| **3D characters** | Yes | Studio: figures, poses, clips, walks | Nothing |
| **3D props and wall looks** | Yes, plus the world kit's ready-made props | Only a list of material names | Later, if ever |
| **Menus** | Yes: Title, Pause, Settings, Save slots; Results, Loading and Error in an extension | No, but they work without one | Nothing. Their words are a later "Words" job |
| **HUD** (score, hearts, timer) | Written per game | No | A few ready-made HUD pieces set up as data (5) |
| **Characters and items as data** | Yes: types with settings (number, words, yes or no, list, link…) and values per placed copy | Characters (2D) and Definitions (3D) | Game-wide tables (shops, loot) later |
| **Controls** | Yes: keys, pads, touch, rebinding in Settings | Players can rebind; the game's defaults are code | Defaults in a content file, shown in an editor (6) |
| **Enemy and NPC behaviour** | 3D only, sneak-and-chase | Schematic (being built) | Fights and 2D (2, 3) |
| **Dialogue and cutscenes** | 3D only | Writer, Sequence (being built) | Work in 2D too (3). Also: nothing draws a dialogue box yet, so Writer needs one |
| **Saving and progress** | Yes: save slots, what to keep is code; puzzles have checkpoints | No | Going to the next level as a ready-made behaviour (2) |
| **Languages** | Yes: words pulled out for translators, translations checked, a Language setting | No | Later. A free translation tool (inlang) reads the same files |
| **Player settings** | Yes: controls, sound, picture, vibration, camera, language, touch | Not needed | Nothing |
| **Sound and music** | Yes: sound files, music loops, a sound synth | Audio (being built) | The Audio editor should take your own sound files and say which music plays where |
| **Sparks, dust and smoke** | No (Emberwick codes its own); Feel does shake, freeze, flash, squash | No | Later: a "burst" row in Feel |
| **Name, icon, store page** | `ship.config.ts` and the game's own code | No | The "Make a full game from the editors" thread |

## What I recommend, in order

1. **Draw 2D levels in the game.** Core draws a level's tile layers and shows each placed character with its picture,
   so what you paint in Levels is what you play. Every 2D game needs it, and it needs no new editor.
2. **Ready-made behaviours** you pick for a character in Characters (2D) or Definitions (3D): the player (platformer
   or top-down, the two kinds the Levels templates already make), pickup, hazard, health, a door or exit to the next
   level, and an enemy that walks back and forth or chases. One new extension; no new editor. This is the step that turns
   the editors into a game maker.
3. **Writer, Sequence and Schematic in 2D.** Let their extensions use a 2D level's areas instead of insisting on 3D
   rooms, and add a dialogue box to show the lines. The "Build the remaining editors" thread should say in its spec
   whether it takes this on.
4. **Animations.** In Characters: pick a sprite sheet, cut it into frames, name the clips, set their speed, watch them
   play. Not a pixel painter: free tools (LibreSprite, Pixelorama) do that, and import is enough.
5. **HUD pieces.** A counter, hearts or a bar, and a timer, each tied to a number the game keeps and put in a corner.
   Not a screen designer.
6. **Default controls as data.** One content file of actions and their keys, buttons and touch controls, shown in the
   Tuner or a small Controls page.

Leave for later: game-wide tables, a translation editor, particles, a 3D prop and material editor.

Items 1 to 3 are the ones a person hits first. Without them, someone who only uses the editors can build levels and
characters but cannot make them do anything.

## Where I checked

- New game: `packages/tools/src/shared/create-game/template-game.ts` (the square), `template-level.ts` (walls as
  rectangles), `template-content/editors.toml` (Levels only).
- No 2D tile drawing: nothing in `packages/automata/src` reads a level's `tiles`, `auto` or `objects` layers;
  `packages/content/src/shared/level-2d/read-level.ts` gives `entitiesOf` and `intGridRows` for game code to use.
- 3D draws the level: `packages/3d/src/features/world/build.ts`.
- Animation: `packages/automata/src/features/render/views/sprite-view.ts` (frames picked by the pose's `frame` number);
  `packages/content/src/shared/assets/atlases.schema.ts` (a folder of frames packed into one sheet).
- 3D-only extensions: `extensions/{narrative,cutscenes,systems}/src/app/*.extension.ts` (`requires`), on #458.
- Schematic's content: `extensions/systems/src/shared/sim/systems.schema.ts` (senses: light, sound, sight, warmth,
  touch; modes and patrols; no health or damage anywhere in `packages/` or `extensions/`); the old suite spec
  (`docs/archive/superpowers/specs/2026-10-30-editor-suite-design.md`) names Schematic as `puzzle.toml` plus
  `agents.toml`, and lists "a frame-by-frame sprite editor, particles, a UI composer" as out of scope.
- No dialogue box: no screen or component in `packages/` or `extensions/` draws a line or a choice.
- Menus and settings: `packages/automata/src/app/screens/` and `extensions/ui-screens/`.
- Controls: `games/emberwick/src/app/make-game.ts` (keys in code), `packages/automata/src/features/input/bindings/`.
- Languages: `packages/content/src/shared/locale/messages.ts`.
- Characters view: `packages/editor/src/features/characters/`; 3D definitions:
  `packages/editor-3d/src/features/levels-3d/definitions/`.
