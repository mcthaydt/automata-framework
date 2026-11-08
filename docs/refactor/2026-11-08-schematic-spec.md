# Schematic: the game's AI editor

Status: spec, 2026-11-08. Shared parts: [`2026-11-08-content-editors-spec.md`](2026-11-08-content-editors-spec.md)
(package, session, look, words). Plan: [`2026-11-08-schematic-plan.md`](2026-11-08-schematic-plan.md).

## 1. Why

The Owner, 2026-11-08: "Each editor needs its own plan and spec, the schematic looks particularly weak; that's how we do
AI." Schematic is where a person makes the game's characters think: what an enemy notices, what it does about it, and
when it gives up. The first draft showed behaviour as sentences and left most of it read only ("Edit this in the file
for now"). That is not an AI editor. This spec makes every part of a character's behaviour editable, shows it as a
diagram you can read at a glance, and lets the person watch it run and check that it is fair.

Schematic also edits the scene's puzzle (items, facts, actions, the goal), the other half of "how the world works".

## 2. What the content can say today

`@automata/systems` (`content/systems/<scene>.toml`, schema `systems.schema.ts`) gives each scene:

- **Characters** (`agents`): modes (`patrol`, `hunt`, any names), the mode it starts in, a speed per mode in metres per
  second, senses (sight with a range and optionally through walls only, hearing with a reach, light, warmth, touch with
  a radius), a patrol route (`routine`: stops on the nav graph with a wait and actions at each), named game hooks for
  what data cannot say, and **switches** (`transitions`): from a mode (or any mode, `*`) to a mode, when every
  condition holds, at a priority (the highest that holds wins), with actions on the way.
- **Conditions** (`Probe`, 12 kinds): in light; heard a noise of a kind within a reach; sees the player; within some
  metres of warmth; touching the player; a fact is a value; a character is in a mode; at a place; waited more than some
  seconds; not (any condition); the player crossed a portal; saw the player hide within a radius.
- **Actions** (`SysEffect`, 9 kinds): switch a character's mode; go to a place or a point; flee from something; make a
  noise of a kind and loudness at a place; set a fact; start a cutscene, a line or a catch; call a game hook; follow
  the player through a portal after a delay; set an ambush.
- **World rules** (`rules`): when conditions hold (every so many seconds), do actions. A rule may be only a sentence of
  design text, with no conditions, that names which switches carry it out.
- **Numbers** (`tunables`): named values with a range, a unit and a note.
- **Fairness**: scripted bot players (`scenarios`: a setup, a playing style, what should happen within how long, with
  what probability, over how many seeds) and thresholds (`fairness`: how often a careful player wins, how long before
  the first threat, how much warning a threat gives, the most deaths a run may take). The bots run in Node
  (`@automata/systems/bots`).
- **The design table** (`objects`, `matrix`): what each thing in the scene does to each other thing, and which rule
  makes it so. It is design notes, not behaviour.

`@automata/puzzle` (`content/puzzles/<scene>.toml`) gives the scene's facts, items, actions at hotspots with conditions
and effects, the goal, and lethal and systemic notes; its solver finds whether the puzzle can be finished and where a
player can get stuck.

What it cannot say yet: health, damage or attacks, and 2D levels (systems requires 3D `sectors`). The "Plan a whole
game with no code" work owns both (content editors spec, section 8). Schematic is built so that their new conditions
and actions appear in it without changing the editor (section 5.4).

## 3. What a person does in Schematic

1. **Pick a character** from the scene's list, or **add one from a ready-made behaviour**: Guard (patrols, chases what
   it sees, searches, gives up), Sentry (stands still, raises the alarm), Hunter (follows sound), Coward (runs from
   light or the player), Wanderer (walks a route, ignores the player). Each is a full set of modes and switches she can
   change; nothing is hidden.
2. **See how it behaves** as a diagram: each mode is a box with its speed ("Hunt, 2.2 m/s"); each switch is an arrow
   labelled with its condition in words ("sees the player"). Switches from any mode come from a box called "Any mode".
   Tapping a box or an arrow selects it.
3. **Change a switch**: its from and to modes, its conditions ("sees the player" and "is not in light"), its actions
   ("make a shriek noise here, loudness 6"), and its place in the order ("Checked first" to "Checked last"). Every
   condition and action kind can be added, changed and removed (section 5).
4. **Change what it notices**: sight distance and through-walls, hearing reach, touch radius, light, warmth.
5. **Change its patrol**: the stops in order, how long it waits at each, what it does there.
6. **Change the world's rules** with the same condition and action pieces.
7. **Watch it run** (section 6): the game beside the diagram, restarted on each change, with the character's current
   mode lit in the diagram.
8. **Check it is fair** (section 7): run the bot players and see, in words, whether a careful player gets through.
9. **Change the puzzle**: items, facts, actions and the goal, and run the solver.

Left out (essential only): the design table (`objects`, `matrix`) and the puzzle's design notes (`lethal`, `systemic`)
open in the file, read only, with "Design notes, kept in the file." They describe the design and change no behaviour.

## 4. Screens

Phone first; the same pieces rearrange by width (suite shell modes).

- **Panel** (a sheet on a phone): the scene picker (one `content/systems/*.toml` per scene), then "Characters" (each
  by name, from `agents[].id` read as words), "World rules", "Numbers", "Fair play", and "Puzzle" when the scene has a
  puzzle file. "Add a character" (48 px) at the foot of Characters.
- **Canvas, a character:** the diagram (section 4.1) above the list of switches, highest priority first ("Checked
  first"). On a phone the diagram and the list are two tabs, "Diagram" and "List"; on an iPad and wider they share the
  canvas, the diagram on top.
- **Inspector** (a sheet on a phone): what is selected. A mode: its name, its speed, "Starts here" (the initial mode).
  A switch: from, to, conditions, actions, order. The character itself (nothing selected): its senses, its patrol, its
  game hooks (read only: names the game's code gives it).
- **Status:** the file's problems counted; the last fairness run's verdict ("Fair play: last checked 2 changes ago").
- **Watch** (section 6): a split like the Tuner's, the game on one side.

### 4.1 The diagram

- Boxes are modes; arrows are switches; "Any mode" is a box when the character has `from = "*"` switches.
- Layout is computed, never saved: the start mode on the left, then modes in the order a breadth-first walk from it
  reaches them, in columns; an arrow that loops to its own mode is a small loop on the box. The file stays the only
  truth and holds no positions.
- An arrow's label is its first condition in words, then "and 1 more". Two switches between the same two modes are one
  arrow with both labels stacked.
- Select by tap; pan with one finger or the scroll wheel; zoom with a pinch or Ctrl-scroll; "Fit" button. Touch targets
  on boxes and labels are at least 44 px.
- Drawn in SVG in the page (a few dozen boxes at most), not Pixi: it is a diagram of text, it needs the page's text
  and focus, and every box and arrow is a button a screen reader can reach.

### 4.2 Words

Every condition and action has a sentence with fields in it, and the sentence is the editor (section 5). Mode and
fact names are the person's own words, shown as written with dots and dashes as spaces. Key names never show:
`sawHide` is "saw the player hide", `warmthWithin` is "is within [3] m of warmth", `followThrough` is "follows the
player through [door] after [2] s".

## 5. Building conditions and actions

### 5.1 One table of pieces

The editor's whole vocabulary is one table, `pieces.ts`: for each condition kind and each action kind, its sentence,
its fields (each a number with a range and unit, a text, a choice from the file's modes, characters, facts, places or
hooks), how to read it from the file, how to write it, and a default for a new one. The diagram, the list, the
inspector and the add menus all read this table. A kind the table does not have (from a newer extension) shows its
sentence as "Something the editor cannot show yet" with the file's text beside it, read only, and the rest of the
character stays editable.

### 5.2 Adding

"Add a condition" and "Add an action" open a menu of sentences grouped in plain words: "What it notices" (sees,
hears, touching, in light, warmth, saw hiding), "Where things are" (at a place, crossed a portal), "What is true" (a
fact, another character's mode), "Time" (has waited more than). "Not" is a switch on any condition ("does not see the
player"), not a separate kind she has to nest.

### 5.3 Choices from the file

A mode field offers the character's modes; a character field the scene's characters; a fact field the facts the
puzzle and the rules name, plus "a new fact…"; a place field the nav graph's named nodes (`content/nav/<scene>`), read
through the workspace; a hook field the character's hooks. A value that names nothing ("goes to bedsde") shows the
schema's problem in words on that field.

### 5.4 Pieces from other extensions

When the runtime work adds health, damage or attacks, it adds kinds to `systems.schema.ts`; Schematic gains them by
adding rows to `pieces.ts` (one row each, with its test). The plan for that work names the rows.

## 6. Watch it run

The Tuner already shows the game's dev page beside its settings and restarts the game when content changes. Schematic
does the same: "Watch" opens the game beside the diagram. When the debug extension is in the game, the game's page posts
each character's current mode and the switch it last took to the editor's window (a new message this plan adds to the
debug overlay; the editor checks both the message's source window and its origin, as the framework's rules require),
and the diagram lights that mode and flashes the arrow taken. Without the debug extension, Watch
still shows the game, and the diagram says "Add the debug overlay to your game to see which mode each character is
in." With no game served (the sample), Watch says "Open your game with automata editor to watch it run."

## 7. Check it is fair

"Fair play" lists the scenarios as sentences ("A careful player who hides gets past the Porter within 90 s, 8 times
in 10, over 20 tries") and the thresholds as numbers with words ("A careful player wins at least [70] % of the time").
"Check now" runs the bots through the suite's checks port as a game check: the pipelines' `systems` stages
`scenarios` and `playtest` (`automata-pipe systems run <scene> --json`, which reads the scene's `systems.pipe.toml`),
declared in the game's editor list as an `after` check with `measure = true`. They run in Node beside the game, never
in the page. A game without the pipelines extension or the scene's `systems.pipe.toml` sees "Fair play needs the
pipelines extension" and how to add it. The result reads: "Fair: 3 of 3 checks pass" or "Not fair yet: a careful player won 4 times in 10; the
target is 7." Each failing check names the scenario. Results go stale (greyed, "changed since this check") when the
file changes.

## 8. The puzzle

The scene's puzzle as a list: Items, Facts (each with its starting value), Actions ("At the shutter, using the crank:
when the power is on, open the shutter"), and the Goal. Each action is conditions, then effects, built from a second
pieces table of the puzzle's condition and effect kinds. "Can it be finished?" runs the solver as a game check
(the pipelines' `puzzle` pipeline, `automata-pipe puzzle run <scene> --json`) and says "Yes, in 14 steps" or "No: the player can get stuck after
taking the fuse (open it)". A lock graph view is later (open choice 4).

## 9. Starting

- A game with no systems file: "This scene has no characters yet." and "Add a character" with the ready-made
  behaviours. It writes `content/systems/<scene>.toml` with the scene, an empty design table, and fairness thresholds
  at the extension's defaults. When the game's editor list has no row for `content/systems/*.toml`, the page says so
  and shows the row to add, in a copyable block; `create-game`'s template has the row.
- When the game does not use the systems extension: "This game does not use characters that think yet. Add the
  systems extension to your game to use Schematic," with a link to its README. (No silent fallback.)

## 10. Checks

- `pieces.ts`: one test per condition and action kind: read from the file, the sentence, write back unchanged, and the
  new default passes the schema.
- The diagram layout: a pure function from a character to boxes and arrows, tested on the converted fixtures
  (`clinic`, `bay`, `prologue`: up to nine modes and dozens of switches) for no overlapping boxes and every switch
  drawn.
- DOM tests: select a mode and change its speed; add, reorder and remove a switch; add a "not" condition; add a
  character from each ready-made behaviour and pass the schema; a dangling mode name shows its problem on its field.
- Layout tests in Chromium at phone (390x844) and iPad (820x1180): the diagram fits and pans, every target is 44 px.
- A journey on the sample: open Schematic, change a guard's sight range, the file changes, Undo.
- Watch's message bridge: a message from another origin or window is ignored (test).

## 11. Open choices for the Owner

1. **Which ready-made behaviours ship.** Recommended: Guard, Sentry, Hunter, Coward, Wanderer (section 3).
2. **Fair play in the editor or only in `automata check`.** Recommended: in the editor, as above; it is how a person
   knows the AI is beatable.
3. **A patrol drawn on the level** (stops on the map) or a list of stops. Recommended: the list now; the map when the
   2D and 3D level views can be embedded read only.
4. **The puzzle as a lock graph** (entry to goal) or a list. Recommended: the list now, the graph after.
