# The Last Light's prologue against the framework: survey

**Date:** 2026-11-11. **Stage:** 2 (plan) of workstream 2, slice 1. **Tracker:** [`../progress.md`](../progress.md).
**Spec:** [`../specs/2026-11-11-last-light-on-the-framework-design.md`](../specs/2026-11-11-last-light-on-the-framework-design.md).
**Plan:** [`../plans/2026-11-11-last-light-prologue.md`](../plans/2026-11-11-last-light-prologue.md).

This is the survey the spec asks slice 1 to start with. It lists everything the prologue needs at run time and in the
editors, marks each item, and corrects the spec's slice table where the code disagrees.

**Revised the same day** for the spec as re-set by the Owner (`main` at `f52d0ae9`): The Last Light is the framework's 3D
reference game at `games/the-last-light`, fully MIT, written by feature; Ember Hall (`games/base-3d`) is removed in this
slice. The revision added four sections (where the old code is tangled, October's fixtures as the starting point, Ember
Hall's references, the sounds and music with their source) and re-ruled every (c) and (d) against the two reference
games, Emberwick and The Last Light.

**Audited** the same day ([the plan audit](2026-11-11-last-light-prologue-plan-audit.md), at `main` `81ce53a9`): rows
5, 26, 49 and 51, the sounds and music section and Ember Hall's table were corrected, and the marks follow the spec's
three homes; each correction names its finding.

## What was read, and what was not run

- **The framework:** `main` at `89d66a23`, and for the revision `f52d0ae9` (Ember Hall's references were measured there). Read: `AGENTS.md`, the tracker, both specs, the shared-polish plan, the
  READMEs and sources of `sectors`, `nav`, `puzzle`, `systems`, `narrative`, `cutscenes`, `places`, `feel`,
  `audio-synth`, `ui-screens`, `debug`, `character-kit`, `world-kit`, `editors`, `packages/3d` (the level schema, the
  camera, the look), `packages/editor`, `packages/editor-3d`, `examples/3d-story`, `examples/2d-story`,
  `games/base-3d`, `tooling/consumer-smoke`, `docs/provenance/sources.md`, `docs/refactor/progress.md` (the look and
  camera rows) and `docs/refactor/2026-11-08-complete-game-gaps.md`.
- **The game:** `mcthaydt/PixiJS3D_Experiment_001` at `92e6704` (read only). Read: `AGENTS.md`,
  `docs/superpowers/STATUS.md`, `docs/superpowers/editor-gaps.md`, all 16 files of `src/scenes/prologue/` (1,142
  lines), `docs/art/blockout-prologue/blockout.json` (its shape), `scripts/verify/playthrough.mjs`, and the modules the
  prologue pulls from `src/game`, `src/narrative`, `src/render`, `src/ui`, `src/audio` and `src/scenes/clinic` (sizes
  and the parts the prologue calls).
- **Not run:** nothing was built or tested. `node_modules` is not installed in this container, and this stage writes
  documents only. Every "already in the framework" below was read in the source, not exercised. Two things
  first marked "to check" (the room occluders against the game's room visibility, and the look's lamp kinds against
  the game's nine) were then read and are settled in rows 2 and 5.

## Six findings that change the plan

1. **The game has not moved since the extraction.** Its head, `92e6704`, is the commit
   `docs/provenance/sources.md` records as the extraction commit. The framework's extensions were written from this
   exact code, so the framework's schemas are the game's data shapes, renamed.
2. **The prologue's content already exists in the framework's own shapes.** The October extraction converted all four
   scenes once and kept the results as test fixtures: `prologue.puzzle.toml` (484 lines), `prologue.systems.toml`
   (948), `prologue.cutscenes.toml` (1,020), and the prologue's lines, text, storylets, beats and help. They prove the
   puzzle, the creature, the cutscenes and the story are expressible as framework content today. The scripts that
   wrote them (`convert-adventure-*.ts`) lived in `automata-plus` and are not in this repository, so slice 1 writes a
   small converter new, and starts from these fixtures (see "October's fixtures as the starting point").
3. **Those fixtures hold the game's story, word for word.** When this survey was first written that contradicted the
   spec. The Owner has since settled it: the game is a reference game in this repository, its story and art are MIT,
   and the port may start from those files.
4. **The prologue is not self-contained.** It borrows four things from the clinic's scene package: its props
   (`props.ts` re-exports the clinic's), its dressing (`dress.ts` runs the clinic's `dressClinic` through a
   clinic-shaped view of the prologue's world), its room visibility policy and its room names. In the remake the props
   and dressing are replaced by the builders' work, so the borrow ends; the converter still has to read
   `src/scenes/clinic/props.ts` to know where each piece of furniture stands.
5. **No game on the framework sends a verb or a walk.** `@automata/puzzle` takes a `puzzle.verb` command "sent by the
   game once its walker is in reach", and `@automata/nav` takes `nav.walk-to`; no game, example or extension sends
   either. Pointing at a thing, walking to it and using it is the largest missing piece, and it is generic.
6. **Three of the suite's editors do not read a 3D game's files where the prologue needs them.** Sequence previews a
   cutscene over a 2D level's walls only; Writer opens lines and conversations but not storylets, beats or help;
   nothing opens a HUD's layout (the UI editor is workstream 3).

## October's fixtures as the starting point

All of it is on `main`, from the October extraction, each file headed "converted once from an earlier game. Do not
edit." The game's head is still the commit they were converted from (`92e6704`), so every one is **still true to the
game**; the blockout fixture was compared with the game's file and holds the same JSON.

| Where | What it holds | Use in slice 1 |
|---|---|---|
| `extensions/puzzle/src/testing/fixtures/prologue.puzzle.toml` | The puzzle: 12 facts, 4 items, 34 actions | Copied to the game as its puzzle file |
| `extensions/systems/src/testing/fixtures/prologue.systems.toml` | The figure, 19 tuned numbers as literals, 8 rules, the matrix, scenarios, fairness | Copied; every call the file names gets a fate: `chase` and `fleeGoal` rewritten as `goTo` and `flee`, `replan` a clock, `stop`, `leave`, `wake` and `vigil` the game's hooks, R15 (`burnLight`, on the old fact `light`) and the `footsteps` rule dropped (audit 7) |
| `extensions/narrative/src/testing/fixtures/prologue.{lines,locale,storylets,beats,help,dialogue}.toml`, `canon.toml` | 74 line records, their English text, the deck, beats, hints, the canon | Copied; each line's text is joined to its record as `words`. The dialogue file holds no conversation (`graphs = []`) and is not copied (audit 16) |
| `extensions/cutscenes/src/testing/fixtures/prologue.cutscenes.toml` | The five scripts, each evaluated with Ada at one place | Copied; three get a mark, `found` gets a camera at an anchor and the figure stands at her own anchor (audit 17) |
| `packages/editor/src/shared/kit/documents/testing/fixtures/blockout-prologue.json` | Rooms, walls, masses, the spawn, 21 boxes, 22 hotspots, 15 lamps, nav, zones | Converted to an `af-sector/2` level and a nav graph |
| `extensions/{sectors,nav}/src/testing/fixtures/clinic.*` | The clinic's rooms, graph and boxes | Slice 2's |

**Not in any fixture,** so read from the game's repository once, by the converter or by hand:
- how each line is said (`src/scenes/prologue/delivery.ts`, 22 lines);
- where each piece of furniture stands (`src/scenes/clinic/props.ts`, 39 models; only their place and size are read);
- the objective's nine ordered conditions and the solver's model (`rules.ts`, `puzzle-model.ts`);
- the bots' tactic (`rules.ts` `PLAYTEST`).

The fixtures stay where they are: the extensions' own tests read them. The game gets copies under its `content/`,
and from then on the game's files are the source for the game.

## The marks

- **(a)** Already in the framework: the package, the file and the content kind are named.
- **(b)** Expressible as framework content after conversion: the converter writes it; nothing new is built.
- **(c)** Missing from the framework and generic: built in core or an extension. Since `acb0361d` the spec decides
  which ("Where a new piece goes"): core if any game could use it, an extension if it is generic within a genre, the
  game otherwise. The plan's "Homes" table rules each (c) below (the plan audit, finding 31; the spec as corrected at
  `909f6b10`): interact and the HUD are adventure-genre extensions, and the hand lamp's mechanism (row 31) is a carried
  light in `@automata/systems`, the game keeping its item and numbers. The first draft's rule ("both reference games") is replaced.
- **(d)** This game's own: a small feature in `games/the-last-light`.

## Run time: the rooms

| # | The prologue has | In the game | Mark | In the framework |
|---|---|---|---|---|
| 1 | 7 sectors with corners, walls, portals, holes (the counter), windows, doors, handrails and trims; 3 masses | `map.ts`, generated from `blockout.json` | (b) | An `af-sector/2` level: `packages/3d/src/shared/level/af-sector-2.schema.ts`, read with `readLevel` from `@automata/3d/level`; file `content/levels/prologue.af-sector.json`. Two wall members the format leaves out (`hideFrom`, `cut`) are the old renderer's; the converter reports them and drops them |
| 2 | Which rooms are drawn from each camera zone: the hall's view draws reception, the ward and the north corridor; the corridor's draws only the corridor; the supply room's only itself; each mass has owners | `../clinic/visibility.ts` (a `RoomPolicy`), `src/render/room-visibility.ts` | **(c)**, settled by reading | **Missing.** `@automata/3d`'s occluders (`features/camera/occluders/occluder-rule.ts`) cut away a wall that faces the camera or stands between the eye and the player; nothing says which rooms a view draws, and no file in `packages/3d/src` holds such a rule. Without it the corridor's follow camera would draw the hall and the ward around it. A view gains an optional list of the rooms it draws, in `@automata/3d` (plan task 9b). It goes in the 3D package because the level format and the camera views are there; Emberwick has no rooms |
| 3 | 21 collider boxes | `level.ts` `BOXES` | (b) | Props with footprints in the level, and nav's `blocked` (the precedent is `clinic.boxes.toml`) |
| 4 | 22 hotspots: a point, a name, a reach, two of them hiding places | `level.ts` `HOTSPOTS` | (b) | Level entities of a definition `hotspot` (`entityDefs`, `entities`); Levels 3D's Things tool places and edits them; the editor's `puzzle-hotspots` check reads them. The name becomes the message key `hotspot.<id>`, its English in the game's `messages/ui/en.json` (audit 11) |
| 5 | 15 lamps of 9 kinds (desk, screen, pendant, bulb, fluorescent, fire, spark, moon, fill) | `level.ts` `LAMPS`, `src/render/look.ts` | (b), with a small (c), settled by reading | `lamps` in the level (`LampPlace`). The look's lamp kit (`packages/3d/src/features/world/library/lamp-kit.json`) has six kinds: `bulb`, `desk`, `fluorescent`, `neon`, `pendant`, `sodium`. Seven of the prologue's lamps are of kinds it has (a desk, two pendants, three bulbs and a fluorescent; audit 22). The two `fire` lamps (burning curtains), the `spark` and the `screen` glow are dark all through the prologue (the curtains hang, there is no leak, and the line says the monitor is dark), so they are not written and the converter reports them. That leaves two `moon` lamps (light through a barred window) and two `fill` lamps (a soft light with no fitting): both kinds are generic and are added to the kit (plan task 9b) |
| 6 | Lamps that change with the story: two dead bulbs, everything out at lights out, lamps dying one by one in `rest` | `dress.ts`, cutscene `light` keys | (a) and (d) | Lamp levels while a scene plays: `PieceStates` and `lampState` (`@automata/3d/level`), and the cutscene director's `light` track. Which fact dims which lamp is the game's: a small view feature reading a data table |
| 7 | 18 nav nodes, 22 edges (one through a door), a 12-stop patrol | `level.ts` `NODES`, `EDGES`, `PATROL` | (b) | A `nav-graph` (`extensions/nav/src/shared/nav-graph.content.ts`), `content/nav/prologue.toml`; the patrol is the agent's `routine` in the systems file |
| 8 | The spawn | `SPAWN` | (b) | A level entity `spawn`, as `examples/3d-story` has |
| 9 | Three camera zones: the hall fixed, the corridor and the supply room following | `ZONES` | (b) | The level's `views` and each sector's `view`; the rules are `packages/3d/src/features/camera/play-camera.ts` and `sim/view-zone.ts`, which already follow The Last Light's camera (the Owner, 2026-11-10). `figureFill` on the closet zone was a fix for the old sprites and is dropped |
| 10 | Bounce points for indirect light | `BOUNCE` | dropped | The look bakes room light its own way. Reported by the converter, not carried |
| 11 | Furniture and wall pieces: 39 placed models from the paid props pipeline | `../clinic/props.ts` | (c) in part | Not converted: the models came from the paid props pipeline, and the target is the builders' scenes. Each piece is placed again as a world-kit or core generator (`bed`, `bench`, `cabinet`, `filingCabinet`, `shelf`, `shelvingUnit`, `counter`, `chair`, `noticeboard`, `waterCooler`, `mopBucket`, `curtains`, `screen`, `table`, `bin`, `lamp`). **Missing generators**, generic, for `@automata/world-kit`: a sink, a trolley, a wheelchair, a gurney, a monitor on a cart, a wall clock, a wall cabinet with a keypad, a locker, a drip stand |
| 12 | Wall signs and reserved wall spans | `../clinic/props.ts` `SIGNS`, `RESERVED` | (b) | The level's `lettering` and `decals`, which world-kit draws |
| 13 | Dressing that follows the world (the cabinet door open, the supply door open, the bed made) | `../clinic/dress.ts` through `clinicView` | (a) and (d) | Prop states and doors: `PieceStates` (`propState`, `doorOpen`). The table "this fact shows this state" is the game's, as in row 6 |
| 14 | The look: DUEL palette, dither, point filtering, no real-time lights | `src/render/look.ts`, the filters | (a) | `@automata/3d`'s look (`features/look/`), `DEFAULT_LOOK`. What the builders' look still lacks is listed under "What slice 1 waits for" |

## Run time: the player and the puzzle

| # | The prologue has | In the game | Mark | In the framework |
|---|---|---|---|---|
| 15 | Ada walks: camera-relative stick and keys, and walk-to on a click | `src/game/movement.ts`, `simulation.ts`, `src/input.ts` | (d) for the stick, (a) for walk-to | The stick walker is a game feature (`examples/3d-story/src/features/wick/` is the pattern, 41 lines); walk-to is `nav.walk-to`. The camera turn is `CameraTurn` from `@automata/3d/sim` |
| 16 | **Use a hotspot:** point at it, walk into reach, act; use a held item on it; combine two items; type a code | `simulation.ts`, `src/room-input.ts`, `src/ui.ts` | **(c)** | **Missing.** A new extension, `@automata/interact`: commands that take "use this hotspot", walk with nav when out of reach, and send `puzzle.verb` on arrival. An extension, not core: only adventure-style games need it, and Emberwick does not |
| 17 | The puzzle: 12 facts, 4 items, 34 actions, a fallback, the goal | `puzzle.ts`, `src/game/puzzle.ts` | (b) | The `puzzle` content kind (`extensions/puzzle/src/shared/puzzle.content.ts`), `content/puzzles/prologue.toml`. The spec's "23 puzzle steps" is not a count found in the files; the converted puzzle has 34 actions |
| 18 | Items and an inventory | `w.items`, `give`, `take` | (a) | Puzzle's own state and effects (`puzzle.gave`). The spec lists "items and an inventory" as forced into the framework; the state already is. What is missing is the inventory on screen (row 30) |
| 19 | Two calls data cannot say: `read` and `fill` | `rules.ts` | (d) | `puzzleExtension({ calls })`. `fill` is the lamp's arithmetic. `read` may need no code: narrative already derives `read.<hotspot>` (`puzzle-reader.ts`) |
| 20 | Facts that live outside the puzzle: `lit`, `fuel` | `rules.ts` `FACTS` | (d) | Puzzle's mapped facts (`PuzzleOptions['facts']`), given to systems too |
| 21 | Which hotspots exist tonight (three of act one's are hidden; two open with the supply room) | `available`, `HIDDEN` | (b) | The three hidden ones are simply not placed in the prologue's level; the two gated ones are a condition on the hotspot entity, read by `@automata/interact` (row 16) |
| 22 | The door that opens with the key | `nav()` | (a) | `NavDoor` (`nav.door`), set from the fact by a rule in the systems file |
| 23 | The solver's model, and the proof the puzzle can be finished | `puzzle-model.ts` | (a) and (d) | `@automata/puzzle/solver`; the model is a file in the game, run in a test and by Schematic's "Can it be finished?" |
| 24 | Checkpoints (three in the puzzle, one at lights out) and coming back to one | `emit.checkpoint`, `src/game/session.ts` | (a) and (d) | `puzzle.checkpoint` is an event "the game decides what that saves"; the sim has snapshots (`packages/sim/src/shared/world/snapshot.ts`). Keeping one and restoring it is a small game feature. Generic enough to move to an extension when the clinic needs it; slice 1 keeps it small and in the game |
| 25 | The objective line: nine sentences chosen by the world's state, and a point to walk to | `rules.ts` `objective`, `objectiveTarget` | (b) for the choice, (c) for the screen | The choice is written as an ordered list of conditions in a content file, which the old code already is (nine `if`s). The line on screen is a HUD piece (row 30) |
| 26 | The register as a save point (ask, sign, leave) | `presentation.ts` `saves` | (a) | Core's save slots: using the register opens them, with `prologue.registerAsk` as the question, `registerSign` and `registerLeave` as the answers and `registerSigned` once written (plan task 14). The four are narrative lines; the fixture's dialogue file holds no conversation (`graphs = []`), so the game has none (audit 16) |
| 27 | The act card ("PROLOGUE: FIRST NIGHT") and room names | `presentation.ts` | (d) | A caption at the start of the opening cutscene; room names are messages. The map and minimap that use room names are slice 2 |

## Run time: the creature and the dark

| # | The prologue has | In the game | Mark | In the framework |
|---|---|---|---|---|
| 28 | The figure: 7 modes, 4 senses, 24 transitions, a patrol, 19 tuned numbers, 8 rules, 4 scenarios, fairness targets, a design matrix | `systems.ts`, `src/game/systems.ts`, `agents.ts`, `probes.ts` | (b) | The `systems` content kind (`extensions/systems/src/shared/systems.content.ts`), `content/systems/prologue.toml`. The tuned numbers stop borrowing the clinic's and become the prologue's own literals, which is also what Schematic can edit (the game's ledger, gap 65) |
| 29 | Light as a sense: she flees it and will not step into it | `litBy`, `refuses` | (a) | `env.lights` in the systems resource (`systems.resource.ts`), the `inLight` condition, the `light` sense, the `refuses` option. The game says where the light is each step |
| 30 | **The HUD in play:** the objective line, the inventory (select, examine, combine, use), the examine box for a line, the keypad, the "use" prompt over a hotspot, touch buttons | `src/ui.ts` (501 lines), `src/ui/inspect.ts`, `kit.ts`, `glyphs.ts` | **(c)** | **Missing.** A new extension, `@automata/hud`: five pieces drawn from a `hud` content file that holds each piece's place, size and word keys, so the coming UI editor edits a file, not code. An extension: Emberwick writes its own small HUD and would not use it. Narrative's dialogue box (`extensions/narrative/src/features/box/`) is reused for the examine box |
| 31 | The hand lamp: off or lit, fuel that burns, a refill, F to toggle, a radius | `src/game/tools.ts`, `rules.ts` | (d) | A small sim feature in the game, `lamp`: a component, a toggle command, a burn system, and the light it gives systems (row 29). It is this game's rule; when the clinic's lighter and torch cross, the three are looked at together |
| 32 | Footsteps as noise | hook `footsteps` | (d) | `systems.hear` from a game system (the README's own example). Six lines |
| 33 | Waking her, her vigil, her leaving | hooks `wake`, `vigil`, `leave` | (d) | `systemsExtension({ hooks })`: the vigil's clock and the two moves |
| 34 | Chasing, re-routing and fleeing to the dark | hooks `chase`, `replan`, `fleeGoal` | (b), with one small (c) | The systems presets (`extensions/systems/src/testing/fixtures/presets.json`: Hunter, Coward) chase with `goTo = "player"` and flee with `flee`, with no hooks, so the converter writes `chase` as `goTo = "player"` and `fleeGoal` as `flee = "light"`. `replan` re-routes to her every 0.4 s on its own clock; if a transition cannot say "again every so often" without the agent's one timer, `goTo` gains an optional `every` in `@automata/systems` (plan task 4) |
| 35 | Hiding: two places, she pulls Ada out if she saw her go in | `src/game/pursuit.ts` | (a) | `systems.hide` and `systems.unhide`, `sawHide`, `pursuit.ts` in `@automata/systems`. `@automata/interact` sends `hide` when the hotspot is a hiding place |
| 36 | Peeking through a doorway: Ada stands still facing a doorway into another camera zone for 0.6 s, and the camera leans up to 1.2 m through it; moving, turning, hiding or a verb ends it; a shut door shows nothing | `src/game/peek.ts` (129 lines) | (a) for the camera, (c) for the rule | The camera side is there (`clampPeek`, `PEEK_REACH` in `play-camera.ts`). The sim rule (who is peeking through which doorway, kept in sim state so replays carry it) is missing. It is generic sneaking, so it goes in `@automata/systems` beside hiding and door-follow, which already read the same doorways (plan task 4) |
| 37 | A catch that only practises: `found` plays, Ada is back at the lights-out checkpoint, the figure is somewhere fair | `emit: { caught: 'practice' }`, `resetFor` | (a) and (d) | `systems.caught` carries the cause. What a catch does is the game's: play `found`, restore the checkpoint (row 24), put her far away (a hook) |
| 38 | Door-follow | transitions `crossed`, `followThrough` | (a) | In `@automata/systems` (`pursuit.ts`) |
| 39 | The bots' tactic: hide behind the screen until she has gone | `PLAYTEST` | (a) and (d) | `@automata/systems/bots` (`play`, `playtest`, `fairness`); the tactic is a function in the game's test file |

## Run time: the story

| # | The prologue has | In the game | Mark | In the framework |
|---|---|---|---|---|
| 40 | 74 line records: examine lines, notes, item names and texts, captions, objectives, the register's lines, journal headings, storylet lines | `story.ts` | (b) | The `lines` content kind (`narrative.content.ts`), `content/lines/prologue.toml`, each line with its English `words`. The content compiler lifts the words into messages; `automata words` (workstream 1) writes `content/messages/<lang>.json` for the other five languages |
| 41 | How a line is said: pauses, pace, a direction, emphasis | `delivery.ts` (22 lines of 74), `src/narrative/delivery.ts` | **(c)** | **Missing.** Narrative's lines have no delivery. A `delivery` on a line (pace, a direction for the writer, and the words with pause marks) and a box that types it out belong in `@automata/narrative`. The marked words are a second text of the same line; the plan keeps the pause marks out of the translated words so a translation never has to carry them (plan task 5). Emphasis (`*not*`, `_not._`) is not carried, for the same reason; the converter reports each (audit 10) |
| 42 | Three storylets with triggers (`inspect:`, `dwell:`) and conditions | `storylets.ts`, `src/narrative/storylets.ts` | (b) | The `storylets` kind; `narrative.heardVerb` feeds `inspect`; `dwell` reads `sector.entered`. The converted fixture has all three |
| 43 | Two beats, six hint ladders, six deductions | `beats.ts`, `help.ts` | (b) | The `beats` and `help` kinds, and the tools that check them (`@automata/narrative/tools`). No screen shows hints or deductions in the prologue; the journal is slice 2 |
| 44 | The canon (people, motifs) the lines name | `src/narrative/canon.ts` | (b) | The `canon` kind. Only the part the prologue's lines name is converted |
| 45 | Five cutscenes (`opening`, `keypad`, `lightsOut`, `found`, `rest`): shots with lens changes, cuts, fades, flicker, lamp levels, a sting, a prop state, actors with poses and turns, captions | `cutscenes.ts`, `src/game/cutscene-builder.ts` | (b), with one (c) | The `cutscene` kind (`cutscenes.content.ts`), `content/cutscenes/prologue.toml`; the director, the caption and the lint are there. **One gap:** four of the five are functions of where Ada stands. Actors can stand at an anchor (`at = "player"`), but a camera key cannot, so `found` (shot where the catch happened) cannot be said. A camera key relative to an anchor is added to `@automata/cutscenes` (plan task 6). `opening`, `lightsOut` and `rest` put Ada on a mark first, which the old code nearly does already |
| 46 | A cutscene drawn in 3D: the camera, the figures posed, lamps, doors, fades | `src/render/stage.ts` | (a) in pieces, (c) as one | `examples/3d/cutscenes` wires the director to the camera, `updatePieces` and the light by hand. There is a ready stage for 2D (`@automata/cutscenes/stage-2d`) and none for 3D. A `stage-3d` in `@automata/cutscenes` that does that wiring once, with actors, is missing and generic (plan task 6) |
| 47 | Cutscene poses: `read`, `flinch`, `sit`, `sleep`, `pulse` | actor keys | (b), **waits** | Figure actions and seats (`figure-actions`, `figure-seat` from character-kit). Ember Hall has a `flinch` action that is rewritten for Ada before Ember Hall goes; the others are written as content in the Studio (plan task 13). No paid stage |
| 48 | Films before and after cutscenes | `presentation.ts` `fmv` | out | The Owner: films are out |

## Run time: sound, feel and the shell

| # | The prologue has | In the game | Mark | In the framework |
|---|---|---|---|---|
| 49 | Sound cues by event: pick-ups, the keypad's buzz and chime, the sting, the lamps going out, the lamp lighting, the figure's modes, doors, curtains, hiding | `src/audio/cues.ts`, `events.ts` | (b) | The `audio` content kind and `createAudioSynth` (`@automata/audio-synth`); the Audio editor edits it. Its `event` rows are the old table's; a cue whose `sound` is a core sound alias plays a recorded file in place of its voices. The synth cues are written new as content, since the framework's synth is a rewrite. No sound table of the game's own (audit 1). See "Sounds and music, with their source" |
| 50 | Footsteps by floor surface | `src/audio/foley.ts` | (c), small | **Missing:** `sources.md` records foley as not ported. A step sound chosen by the floor's material is generic; it is a table in the audio file read with the sector's floor texture (plan task 7). The spec's "samples" needs nothing new: core already plays sound files, which is how the three recorded effects cross |
| 51 | Music: three slots by rule (lights on; the figure about; the practice chase) and silence while Ada hides | `src/audio/music.ts`, `music-rules.ts` | (b) | The `audio` kind's `slot` and `music_rule` rows and `createMusicDirector` (`@automata/audio-synth`), which the Audio editor edits; the game only fills the music state each frame. The old order holds: an overlay holds, hidden is silence (`music-rules.ts:80`), then the chase, the figure about, lights on (audit 1, 2). The files cross as they are (below) |
| 51b | Room acoustics, hallucinated sounds | `space.ts`, `hallucinations.ts` | not in slice 1 | Acoustics is slice 4 in the spec's table; hallucinations are act one's |
| 52 | Feel: flicker, a flinch, shake within limits | `src/feel/` | (a) | `@automata/feel` and its `feel` kind; the Feel editor edits it |
| 53 | Title, pause, settings, save slots, gamepad, touch, rebinding | `src/ui/boot.ts`, `settings-ui.ts`, `gamepad.ts`, `menu-nav.ts`, `focus.ts`, `access.ts` | (a) | Core's default screens and input (`@automata/framework`). None of the game's copies cross |
| 54 | Six languages, a first-run language pick, a flashing warning, interface sounds, a splash, credits, fonts for every language | (the game has none of these) | (a), **from workstream 1** | Shared polish, being built on `claude/shared-polish-build`: `defineGame`'s `firstRunLanguage`, `photosensitivity`, `opening`, `uiSounds`; `automata words`; `fonts.toml` and the font build; Splash and Credits in `@automata/ui-screens`. The prologue flickers, so it turns the warning on |
| 55 | A debug driver the playthrough script calls (`window.game.click`, `skip`, `light`) | `src/main.ts` | (a) | `@automata/debug`'s driver and the sim's replay and hash tools. The bots in plan tasks 12 and 15 send the commands a player's input sends |

## The editors: which one opens what, today

| The prologue's content | File in `games/the-last-light` | Editor | Today |
|---|---|---|---|
| Rooms, walls, doors, windows, masses | `content/levels/prologue.af-sector.json` | Levels 3D | Opens and saves `af-sector/2` |
| Hotspots, the spawn, hiding places | the same file, as things | Levels 3D (Things) | Opens. The definitions (`hotspot` with a name, a reach, a hide flag, a condition) are data in the level |
| Lamps, props, lettering | the same file | Levels 3D | Opens lamps and props. **To check in plan task 16:** that a lamp's level and a prop's kit parameters are editable, not only its place |
| Camera views per room | the same file | Levels 3D (areas) | Opens: a definition with an area is the camera zone |
| Nav nodes and edges | `content/nav/prologue.toml` | Schematic (Places) | Opens. Levels 3D also links nav things on the plan; the file is Schematic's |
| The figure, the rules, the tuned numbers, the patrol | `content/systems/prologue.toml` | Schematic | Opens; Watch shows her modes beside the game through `@automata/debug` |
| The puzzle | `content/puzzles/prologue.toml` | Schematic (Puzzle) | Opens; "Can it be finished?" runs the solver |
| Lines | `content/lines/prologue.toml` | Writer | Opens. **Lacks** a line's delivery (row 41) |
| The register's four lines | `content/lines/prologue.toml` (no dialogue file: the fixture's has none, audit 16) | Writer | Opens |
| Storylets, beats, hints and deductions | `content/storylets/`, `content/beats/`, `content/help/` | none | **Lacks.** Writer does not open these three kinds. They are checked by the build and edited as text until Writer grows them. Not needed for the spec's "one edit in each", so it is suite work listed below, not a slice 1 task |
| Cutscenes | `content/cutscenes/prologue.toml` | Sequence | Opens and edits keys on every track. **Lacks** a 3D level under the preview: `plan-view.ts` reads only a 2D level's walls (plan task 8) |
| Ada and the figure | `content/figures/*.toml`, `content/figure-*/` | Studio | Opens figures, swatches, gaits, actions and clips |
| Tuned numbers the player feels (walk speed, lamp radius, fuel) | `content/tuning.toml` | Tuner | Opens |
| Sound cues and which event plays which | `content/audio/audio.toml` | Audio | Opens |
| Feel | `content/feel/feel.toml` | Feel | Opens |
| The HUD's layout and words | `content/hud/play.toml` | none | **Lacks**, on purpose: the UI editor is workstream 3. The file is the hand-over |
| Words in six languages | `content/messages/<lang>.json` | none | By design: `automata words` writes them; a translation editor is "later" in the shared-polish spec |

The spec's "Done means" names six editors for slice 1: Levels 3D, Writer, Sequence, Schematic, the Studio and the
Tuner. All six open their part of the prologue once it is converted. Sequence needs task 8 for its preview to show the
ward.

## The game's editor-gaps ledger against the suite

The ledger has 76 rows. Read against the suite as it is on `main`:

| Ledger rows | What they asked for | The suite today |
|---|---|---|
| 1, 21, 23, 24, 37, 62 | Add rooms, doors, lamps, hotspots; room visibility; camera zones; nav and patrols | **Closed.** Levels 3D (rooms, things, areas, links) and Schematic (places, patrol) |
| 25, 26 | Styles and wall presets; rooms that are not rectangles, holes, masses | **Closed** for shapes and holes (Levels 3D edits corners); styles are a Definitions table. Masses: **to check** |
| 27, 33, 75 | Place props and dress a room | **Closed in a different way:** props are level data, and world-kit's dresser furnishes a room from one word |
| 31 | The prologue shares the clinic's visibility policy, so its rooms cannot be edited | **Closed by the port:** the prologue gets its own level file |
| 32, 35, 63 | Wire a door to puzzle state; give a hotspot its lines and puzzle entry; add an action and a fact | **Closed.** Schematic's Puzzle screen adds items, facts and actions; a door is a rule |
| 17, 18, 64, 65 | Add a tuned number, change its range; agents, modes, transitions, rules and scenarios read-only; helper-built rows | **Closed** for agents, modes, transitions, senses, patrol, numbers and rules. **Open:** scenarios and the design matrix are not edited in Schematic |
| 50, 51, 53, 54 | Helper-built actions; an approximate lock graph; trace and sweep | **Closed** for actions (content files have no helpers). **Open:** sweep has no control; "Check now" for fair play has no runner yet (`extensions/systems/README.md` says so) |
| 5, 9, 10, 13, 14, 73 | Add, delete and rename a line; speaker; motifs | **Closed** in Writer for add, delete, rename and speaker. Motifs on a line: **to check** |
| 6, 12 | Add a conversation, a node, a choice; edit conditions and next | **Closed** in Writer |
| 7, 8, 60, 61, 67 | Beats, hint rungs and deductions, storylet decks, journal headings | **Open.** Writer opens none of these kinds |
| 72 | How a line is said, and hear it typed | **Open.** Narrative has no delivery (plan task 5 adds it; Writer's field is in the same task) |
| 11, 74 | Move a line between cutscenes; add a shot, a caption, a prop state, a sound; lint exceptions; where the trigger puts the player | **Closed** for adding and removing keys on every track. **Open:** lint exceptions (`lintAllow`) and the trigger's mark are edited as text |
| 56, 57, 58, 59 | Cutscenes made from a simulation, free rig poses, camera roll, many actors with weapons | **Out:** they came from the fight spike |
| 36 | Preview what a zone's camera sees | **Closed** by Levels 3D's walk view. **Open in Sequence:** no camera-eye preview of a 3D shot (plan task 8 gives the plan view; a camera-eye view is suite work after slice 1) |
| 34, 71 | Light a room and see it | **Open:** Levels 3D places lamps; a baked preview in the editor is **to check** |
| 68, 76 | Write a sound set; map an event to a cue | **Closed** by the Audio editor for synth cues and the event table |
| 42, 46, 55 | New character; swatches, hair, items, gaits; structural figure edits | **Closed** by the Studio |
| 43, 44, 45 | Figure gates and paid pose costs | **Gone:** no paid stage; poses are content |
| 2, 22, 29, 66, 69, 70 | The facility: wings, joins, phases, locks, connectors | **Open, and slice 4's:** the connected facility is not in the framework |
| 16 | Canon is read-only | **Open:** Writer reads the canon and does not edit it |
| 19 | Create a scene's files from a template | **Closed** by `automata create-game` and `automata add`, for a game; per scene it is still by hand |
| 3, 4, 15, 20, 28, 30, 38, 39, 40, 41, 47, 48, 49, 52 | Pipeline records, undo of created files, the interchange import, generated screenplays, the old editor's bridge | **Do not apply:** they are about the old editor's own machinery, which is retired |

**What the suite still lacks, as suite work** (not all of it slice 1's):

1. Writer: storylets, beats, hints and deductions, journal headings; delivery (slice 1, task 5); canon edits.
2. Sequence: a 3D level under the plan preview (slice 1, task 8); a camera-eye preview; lint exceptions and the
   trigger's mark as fields.
3. Schematic: scenarios, the design matrix, sweep, and a runner for the fair-play check.
4. A UI editor (workstream 3) for `content/hud/*.toml` and the default screens.
5. The facility (slice 4).

## Corrections to the spec's slice table

The spec's row for slice 1 says it forces these into the framework: "The converter; the game package and the pin;
hotspots, items and an inventory; the objective line; the hand lamp, its fuel and light as a sense; hiding and
peeking; a catch and a checkpoint; captions and the dialogue box in 3D; samples and footsteps". The survey disagrees
on these points, and the spec's table is corrected in the same commit as this survey:

| The spec said | The survey found |
|---|---|
| The converter | Small: October's fixtures already hold the puzzle, the creature, the story and the cutscenes. It converts the blockout to a level and a nav graph, joins words to lines, and reads delivery and furniture places from the game's repository. It runs once |
| The game package; Ember Hall's removal | Stay. Ember Hall is 173 files and is named in 58 files of code and tooling (below) |
| Hotspots | Already data: level entities. Missing is **using** one: `@automata/interact` |
| Items and an inventory | The state is in `@automata/puzzle`. Missing is the inventory on screen: `@automata/hud` |
| The objective line | The choice is content; the line on screen is a piece of `@automata/hud` |
| The hand lamp and its fuel | The game's own (a small sim feature), not the framework's |
| Light as a sense | Already in `@automata/systems` |
| Hiding | Already in `@automata/systems` |
| Peeking | It is through a doorway, not from a hiding place. The camera side is in `@automata/3d`; the sim rule is added to `@automata/systems` |
| A catch and a checkpoint | The catch event and the sim's snapshots are there; what a catch does is the game's |
| Captions and the dialogue box in 3D | Both exist and draw over any renderer. Missing is a **3D cutscene stage**, and **delivery** for lines |
| Samples and footsteps | Samples need nothing new: core plays sound files and music, and the twelve recorded files the prologue plays cross as they are. Footstep sound by floor surface is added to `@automata/audio-synth` |
| (not listed) | A camera key relative to an anchor, in `@automata/cutscenes` |
| (not listed) | Nine prop generators in `@automata/world-kit` |
| (not listed) | Sequence's preview over a 3D level |
| (not listed) | The `source-names` rule, which forbids the game's name in the folders it scans |
| (not listed) | Which rooms a camera view draws, and two lamp kinds (`moon`, `fill`), in `@automata/3d` |
| "about 1,100 lines of scene code, one creature, 23 puzzle steps" | 1,142 lines in 16 files; one creature; 34 puzzle actions (23 was not found as a count), 74 line records, 5 cutscenes, 22 hotspots, 15 lamps |

Slices 2 to 4 are not surveyed. One note for slice 2: the spec gives it "the Night Nurse in full", and the prologue's
figure already runs on her rules less the water and the ambush, so most of her crosses in slice 1.

## What slice 1 waits for

- **Workstream 1** (shared polish), on `claude/shared-polish-build`: the languages, `automata words`, the fonts, the
  first-run steps, Splash and Credits. The game's shell task (plan task 18) starts after it merges.
- **The builders' look** (`docs/refactor/progress.md`, "eb-look"): haze, sky and the dresser are done; albedo tiles are
  on a branch; WebGPU still loses its device in the headless container. Slice 1 uses what is on `main` when plan task 13 starts and lists the difference in its report.
- **Painted figures** (cycle c7, `claude/c7-af`): the character kit's painted figures and fashion are done on the
  branch; the runway example is on hold. Ada and the figure are built in the Studio from whatever has merged.
- **Workstream 4** (the builders' look and figures, spec at `44c4da09`): it runs ahead of the dressing (plan task 13),
  which starts when it says so, and it adds the wardrobe the game's figures need (street clothes, a ward nurse's
  uniform, the Night Nurse) as character-kit entries (the plan audit, finding 32).
- Nothing from the Owner for the translations: the building session writes the five translations of the prologue's
  lines and records them with `automata words --mark`, as workstream 1 does for menus (the coordinator, relaying the
  Owner, 2026-11-11).

## Where the old code is tangled, duplicated or works around something

The spec ("A refactor, not a transcription") asks for these to be marked. Each is rewritten, not carried; the plan
names the rewrite beside the task that does it. The old behaviour and its tests are the specification.

| # | In the old code | What is wrong | In the new game |
|---|---|---|---|
| T1 | `dress.ts` `clinicView`: the prologue's world is cast into the clinic's world shape (`as unknown as`) so the clinic's dressing can draw it; `props.ts` re-exports the clinic's | One scene borrowing another's code through a cast | The prologue has its own level and its own table of states; nothing is borrowed |
| T2 | `story.ts` `TOOL_TEXT`, `rules.ts`: the hand lamp is stored as `light: 'lighter'` and its text aliased to `lighter` and `torch` | The lamp pretends to be act one's lighter so the shared tools work | A `lamp` feature that is a lamp |
| T3 | `rules.ts`: `objective` and `objectiveTarget` are the same nine-branch ladder written twice | Duplication; they can drift | One ordered list of rows in a content file, each with its line and its target |
| T4 | `rules.ts` `available` and `puzzle-model.ts` `available` and `HIDDEN` | The same rule in two places | A condition on the hotspot, read by both the sim and the solver's model |
| T5 | `rules.ts`: `T` is a `Proxy` over module-level tunables; `retune` mutates them and rebuilds a module-level `systems` | Global mutable state, so two sims cannot differ | Tuned numbers are content, loaded per sim |
| T6 | `rules.ts` `FACTS`: a hand-written getter and setter per world field | Boilerplate for what the puzzle's state already holds | Facts live in the puzzle; only `lit` and `fuel` are mapped |
| T7 | `systems.ts` `same('lighterRadius', …)`: values borrowed from the clinic's module at import time | A scene's numbers depend on another scene's file | Literals in the prologue's own systems file |
| T8 | `puzzle.ts` `reading()`, `look()`, `either()`: helper-built actions | The old editor could not edit them (its ledger, gap 50) | Plain rows in TOML |
| T9 | `level.ts` `ZONES`: `contains` and `enter` are closures over `zoneAt` in a generated file | Camera zones as code | A `view` on each sector, as data |
| T10 | `cutscenes.ts`: `fit()` picks a lens to keep sprites under `MAX_SPRITE_SCALE`; `figureFill`; `clearSpot`, `bedside()` clamp marks at run time | Workarounds for the sprite atlases, and staging computed in code | The figures are drawn from the true view, so the lens is the script's; marks are data |
| T11 | `src/ui.ts` (501 lines): objective, inventory, messages, keypad, prompts and touch in one DOM module; `src/ui/boot.ts`, `settings-ui.ts`, `gamepad.ts`, `menu-nav.ts`, `focus.ts` | One file for every screen; its own menus, settings and pad code | `@automata/hud` pieces from a file; the framework's shell |
| T12 | `src/audio/samples.ts`: sound files inlined as data URLs and decoded by hand; `music-play.ts` chains copies of a file to loop it | The game's own loader and looper beside what a framework gives | The twelve recorded files are ordinary sound and music files played by core's audio (`@automata/framework`'s sound files and music slots); the synth makes the rest |
| T13 | `src/game/` by kind (`simulation.ts` 325 lines, `session.ts`, `rules.ts` per scene), one flat `tests/` | Grouped by kind, not by feature | `src/features/<feature>/` owning its code and data, `tests/` mirroring `src/`, an architecture test |
| T14 | `rules.ts`: `resetFor: w => HOOKS.resetFor(w, null, null!)` | A hook called with a null context it happens not to read | A plain function |

## Ember Hall: what names it

Measured on `main` at `f52d0ae9` with `git ls-files` and `git grep` for `base-3d`, `base3d`, `Ember Hall` and
`af-games/base`, and again by the plan audit at `81ce53a9` with the case-insensitive
`ember[ _-]?hall|base[-_]?3d|af-games/base`, which also finds the `BASE_3D` constant (audit 3). `games/base-3d` holds
**173 tracked files**. Outside it and outside `docs/`, **61 files** name it:

| Where | Files | What they do with it |
|---|---|---|
| `packages/editor-3d` | 20 | A sample game for the suite (`src/app/suite/sample-3d/`, 12 content files copied from it), `src/testing/{game-files,hall-library}.ts`, six unit tests that open its level or library (one is named `ember-hall.test.ts`) |
| `packages/tools` | 8 | `check-steps.ts` (`ROLE_LAYOUT_GAMES = ['base-3d']`), `serve-editor.ts` (a comment), six tests that use its folder as the game |
| `packages/3d` | 6 | Comments, a fixture of rooms modelled on its rooms, three tests |
| `tooling` | 6 | `check-style` (`--role-layout` exists only for it), `examples-runner` (two ports and a test importing `games/base-3d/e2e/origin.ts`), three `repo-hygiene` tests of the gate scripts |
| `spikes/3d-look` | 4 | A spike that draws its room |
| `.github/workflows` | 2 | `3d.yml` (paths, its journeys, a `game-ci` job), `game-ci.yml` (a comment) |
| Root | 4 | `package.json` (seven scripts filter on `@af-games/base-3d`; `style` and `source-names` name its folder), `knip.jsonc`, `.vscode/settings.json`, `AGENTS.md` |
| `packages/editor` | 4 | The journeys' harness defines `BASE_3D` as Ember Hall's folder (`tests/e2e/harness/fixtures.ts:23`), and three journeys copy it and play the edit: `dark-levels-3d`, `levels-3d-edit-reaches-the-game`, `new-3d-game-plays-its-edits` (audit 3; the first count had the harness only) |
| Others | 8 | `packages/content` and `extensions/pipelines` tests (one each), `examples/README.md`, `examples/3d/playwright.config.ts` (a comment), two pending changesets, `pnpm-lock.yaml` |

Current documents that name it: `AGENTS.md`, `docs/README.md`, `docs/status.md`, `examples/README.md`,
`docs/adr/0007-3d-look.md`, `docs/provenance/sources.md`. In `sources.md`, line 91 records
`games/base-3d/content/figure-actions/look.toml` as where a builder file went, and `pnpm source-names` fails on a row
whose file is gone, so that row moves to the same file in `packages/3d/tests/fixtures/` (audit 4). `docs/refactor/` (34 files), `docs/superpowers/` and
`docs/archive/` are records and are not rewritten.

The spec names the frame budget; `tooling/frame-budget` does not name Ember Hall today, so there is nothing to move
there (the plan adds the prologue to it). The tools' 3D template (`packages/tools/src/shared/create-game/template-3d-content/`)
already has its own small content (a figure in a room) and does not import Ember Hall's, so the spec's "keeps a small
starter of its own" is already true; what remains is the tests around it that use Ember Hall's folder.

## Sounds and music, with their source

So the MIT claim can be judged (the spec's constraint).

| What the prologue plays | In the old game | Source | In the new game |
|---|---|---|---|
| Pick up an item, the keypad's buzz, the keypad's chime, the sighting sting, a footstep, the lamp lighting | Synth recipes in `src/audio/cues.ts` | The game's own code | Written new as rows of the `audio` file for the framework's synth. MIT |
| The lamps going out as Ada rests (`lamps-out.ogg`), the pulse counted at the practice catch (`pulse-counted.ogg`); `all-lamps-die.ogg` is never played by the prologue (`lightsOut` has its own `sting` key, and a cutscene with sound keys skips its event, `src/main.ts:344`) | Recorded effects, `src/audio/sfx/` | Made with ElevenLabs sound effects (`eleven_text_to_sound_v2`) through the old sound pipeline (`docs/audio/sound-pipeline.md`) | **Brought across as they are** (the Owner, 2026-11-11: "I paid for the elevenlabs so it's fine"). MIT with the game; each is a line in the provenance file. `all-lamps-die.ogg` stays out: nothing plays it |
| Music: the slot `first-night` (it plays `the-last-light.ogg`), `four-seventeen.ogg`, `back-to-bed-ada.ogg` | `src/audio/music/` | Made with ElevenLabs music through the old sound pipeline; the Owner's Suno tracks were planned and are not in the repository | **Brought across as they are,** on the same word. MIT with the game; each is a line in the provenance file |
| The night ward as the opening starts (`opening-ward.ogg`), the cabinet opening (`cabinet-open.ogg`), and the figure entering `dormant`, `patrol`, `investigate`, `hunt` and `flee` (`nurse-settle`, `nurse-move-off`, `turn-to-sound`, `nurse-sees`, `nurse-back-off`; her agent id is `nurse`) | Recorded effects played by the events table (`src/audio/events.ts:77-79, 118`, `src/main.ts:344, 602`); the first count missed them (audit 2) | Made with ElevenLabs, as above | **Brought across as they are,** on the same word (option B, the coordinator, 2026-11-11: every recorded file the prologue plays crosses). MIT with the game; each is a line in the provenance file |
| Music while Ada hides | `music-rules.ts:80`: silence, above the prologue's rows | | A `music_rule` row, `silence` |
| Voices | none in the prologue | | |
| Fonts | `src/ui/font-*.gen.ts` | Generated bitmap fonts | Not brought across: workstream 1's font set (Fusion Pixel, OFL 1.1) |
| Figures, props, textures | Atlases and models from the paid character, props and art pipelines | Paid | Not brought across: the builders' figures and the world kit |

So the game's provenance file lists thirteen outside assets: the twelve ElevenLabs files the prologue plays (nine
effects and three music tracks; file, what it is, made with ElevenLabs through the old sound pipeline, its date) and the
font with its licence. Everything else is made in this repository. Which sound is a recorded file and which a
synth cue is a row of `content/audio/audio.toml` (a cue with or without a `sound` alias), so swapping one for the
other later is a content change.

**One thing to know:** the game's old rule "no `fetch()` at runtime" was why it inlined its sound files. Core's audio
loads a game's packaged sound files the way every game on the framework does. The plan reads the rule as "nothing
from the network at run time", which packaged files obey; the coordinator has been told.

## Open, for the Owner

Nothing. Settled since the first draft, by the Owner through the coordinator (2026-11-11):

- **The fixtures** stay, and the port starts from them.
- **The translations** are written by the building session and recorded with `--mark`; when the Owner's API key is
  saved, a last step runs `automata words` for real.
- **The three cutscenes on a mark** are allowed as staging; the line, its timing and what it names must hold, and
  the plan lists the three.
- **The `source-names` rule** drops The Last Light's name ("it's no longer a source game"), and
  `docs/provenance/sources.md` says so.
- **Every recorded sound and music file the prologue plays crosses as it is** ("I paid for the elevenlabs so it's
  fine"): twelve files, found by the plan audit in the game's events table (option B, the coordinator, 2026-11-11);
  `all-lamps-die.ogg` stays out because nothing plays it.

