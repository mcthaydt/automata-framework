# Schematic: the game's AI editor

Status: spec, 2026-11-08, revised by the plan audit the same day
([`2026-11-08-schematic-plan-audit.md`](2026-11-08-schematic-plan-audit.md), findings H1 to H10 and M1 to M12). Shared
parts: [`2026-11-08-content-editors-spec.md`](2026-11-08-content-editors-spec.md) (package, session, look, words).
Plan: [`2026-11-08-schematic-plan.md`](2026-11-08-schematic-plan.md).

## 1. Why

The Owner, 2026-11-08: "Each editor needs its own plan and spec, the schematic looks particularly weak; that's how we do
AI." Schematic is where a person makes the game's characters think: what an enemy notices, what it does about it, and
when it gives up. The first draft showed behaviour as sentences and left most of it read only ("Edit this in the file
for now"). That is not an AI editor. This spec makes every part of a character's behaviour editable, shows it as a
diagram you can read at a glance, lets the person watch it run and check that it is fair, and proves in a served game,
2D and 3D, that what she changes is what the characters do.

Schematic also edits the scene's places (where characters can walk) and its puzzle (items, facts, actions, the goal).

## 2. What the content can say today

`@automata/systems` (`content/systems/<scene>.toml`, schema `systems.schema.ts`, checks `systems-checks.ts`) gives each
scene:

- **Characters** (`agents`): modes (`patrol`, `hunt`, any names), the mode it starts in, a speed per mode in metres per
  second (every mode needs one; 0 is standing still), senses (sight with a range, and whether only walls block it;
  hearing with a reach; light; warmth, a reach per kind of warm thing; touch with a radius), a patrol (`routine`: stops
  at named places with a wait and actions at each), named game hooks for what data cannot say, and **switches**
  (`transitions`): from a mode (or any mode it moves in, `*`) to a mode, when every condition holds, with an order
  number (`priority`) and actions on the way.
- **Conditions** (`Probe`, 12 kinds): in light; heard a noise of a kind (or any) within a reach; sees the player;
  within some metres of warmth; touching the player; a fact is a value; a character is in a mode; at a place; has
  stood still more than some seconds; not (any condition); the player just went through a doorway; saw the player
  hide within a radius. Facts include the character's own: `self.idle` (it got where it was going), `self.blocked`
  (it is stuck), `self.<name>` (its own notes), and `pursuit.hidden` (the player is hiding).
- **Actions** (`SysEffect`, 9 kinds): switch a character's mode; go to or run from a place (a named place, the player,
  itself, the last noise, the nearest light or warmth, another character, or a point); make a noise of a kind and
  loudness at a place; set a fact (including resetting its wait, `self.timer = 0`); start a cutscene, a line or a
  catch; call a game hook; follow the player through a doorway after a delay; set an ambush.
- **World rules** (`rules`): when conditions hold (every so many seconds), do actions. A rule may be only a sentence of
  design text, with no conditions, that names which switches carry it out.
- **Numbers** (`tunables`): named values with a range, a unit and a note.
- **Fairness**: scripted bot players (`scenarios`) and thresholds (`fairness`). The bots run in Node
  (`@automata/systems/bots`) on a scene module the game's code writes (`SystemsScene`, `bots/scene.ts`).
- **The design table** (`objects`, `matrix`): design notes, not behaviour.

`@automata/nav` (`content/nav/<scene>.toml`) gives the scene's **places**: named points in metres and which pairs a
character can walk between (`nodes`, `edges`, an edge may need a door open). Patrol stops, "is at" and "go to" name
these places. No other editor writes this file (content editors spec, section 2), so Schematic does (section 8).

`@automata/puzzle` (`content/puzzles/<scene>.toml`) gives the scene's facts, items, hotspots, actions with conditions
and effects, the goal, and how the characters open or close the way (`systemic`, `lethal`); its solver
(`createSolver(def)`, plain TypeScript) finds whether the puzzle can be finished and where a player can get stuck.

What it cannot say yet: health, damage or attacks (content editors spec, section 8). Schematic is built so that new
conditions and actions appear in it without changing the editor (section 5.4).

**2D and 3D alike.** The content-in-play work (PR #479, its section 3.4) makes systems read the world through
`@automata/places`, provided by `sectors` in 3D and `level-2d` in 2D, and leaves the systems schema alone. A place is
a plan point in metres in both (in 2D, one metre is one grid cell by default). Schematic adds nothing that reads the
world any other way. In a 2D level the light and warmth senses need the game's own derived facts, so beside them
Schematic shows the systems lint's words: "2D levels have no lamps, so this sense never notices anything unless the
game's code says how bright it is."

## 3. What a person does in Schematic

1. **Pick a character** from the scene's list, or **add one from a ready-made behaviour** (section 9): Guard, Sentry,
   Hunter, Coward, Wanderer. Each is a full set of modes and switches she can change; nothing is hidden.
2. **See how it behaves** as a diagram: each mode is a box with its speed ("Hunt, 2.2 m/s"; "Watch, stands still");
   each switch is an arrow labelled with its condition in words ("sees the player"). Switches from any mode come from
   a box called "Any mode it moves in". The patrol mode is marked "Walks its patrol here". Tapping a box or an arrow
   selects it.
3. **Change a switch**: its from and to modes, its conditions ("sees the player" and "is not in light"), its actions
   ("make a shriek noise here, loudness 6"), and its place in its group's order. Every condition and action kind can
   be added, changed and removed (section 5).
4. **Change what it notices**: how far it sees and what blocks its view, how far it hears, its touch, light and warmth.
5. **Change where it starts and its patrol**: the stops in order, how long it waits at each, what it does there.
6. **Change the places** characters walk between (section 8).
7. **Change the world's rules** with the same condition and action pieces.
8. **Watch it run** (section 6): the game beside the diagram, restarted on each change, with each character's current
   mode lit and a log of its switches in words.
9. **Check it is fair** (section 7) and **change the puzzle** (section 10).

Left out (essential only): the design table (`objects`, `matrix`) opens in the file, read only, with "Design notes,
kept in the file." It changes no behaviour.

## 4. Screens

Phone first; the same pieces rearrange by width (suite shell modes).

- **Panel** (a sheet on a phone): the scene picker (one `content/systems/*.toml` per scene), then "Characters" (each
  by name, from `agents[].id` read as words), "Places", "World rules", "Numbers", "Fair play", and "Puzzle" when the
  scene has a puzzle file. "Add a character" (48 px) at the foot of Characters.
- **Canvas, a character:** the diagram (section 4.1) above the list of switches (section 4.3). On a phone the diagram
  and the list are two tabs, "Diagram" and "List"; on an iPad and wider they share the canvas, the diagram on top.
- **Inspector** (a sheet on a phone): what is selected. A mode: its name, its speed, "Starts in this mode". A switch:
  from, to, conditions, actions, order. The character itself (nothing selected): where it starts, its senses, its
  patrol, and "Things its game code does" (its hooks, read only: names the game's code gives it).
- **Status:** the file's problems counted, each taking you to its field; while there are any, "Your game is still
  playing the last version that worked. Fix the problems to see this one." The last fairness run's verdict ("Fair
  play: last checked 2 changes ago").
- **Watch** (section 6): a split like the Tuner's, the game on one side.

### 4.1 The diagram

- Boxes are modes; arrows are switches; "Any mode it moves in" is a box when the character has `from = "*"` switches.
- Layout is computed, never saved: the start mode on the left, then modes in the order a breadth-first walk from it
  reaches them, in columns; modes nothing reaches in a last column; an arrow that loops to its own mode is a small loop
  on the box. The file stays the only truth and holds no positions.
- An arrow's label is its first condition in words, then "and 1 more". Two switches between the same two modes are one
  arrow with both labels stacked. A switch that runs when it hears or when it stops is drawn dashed, with an ear or a
  pause mark, so its timing shows (section 4.3).
- Select by tap; pan with one finger or the scroll wheel; zoom with a pinch or Ctrl-scroll; "Fit" button. A box's and
  a label's target is never under 44 px: the smallest zoom stops there, and past it the diagram scrolls.
- Drawn in SVG in the page (a few dozen boxes at most), not Pixi: it is a diagram of text, it needs the page's text
  and focus, and every box and arrow is a button a screen reader can reach.

### 4.2 Words

Every condition and action has a sentence with fields in it, and the sentence is the editor (section 5). Mode, fact and
place names are the person's own words, shown as written with dots and dashes as spaces; a fact's name is quoted
("“power on” is yes"). Key names never show: `sawHide` is "saw the player hide", `warmthWithin` is "is within [3] m
of warmth", `followThrough` is "follows the player through [the doorway she used] after [2] s, then [hunts]".

### 4.3 How a character decides (the rules the editor states)

These are the interpreter's rules (`agent-step.ts`), and the canvas says them in one line each under the list:

- **Three groups.** "All the time": switches checked every moment. "When it hears something": switches that ask
  "hears", checked the moment a noise is made. "When it stops or is stuck": switches that ask "has got where it was
  going" or "is stuck", checked after it moves. The list shows the three groups; the order (`priority`) counts only
  within a group, and dragging or "Move up" stays within it. A switch cannot ask both "hears" and "stops" (the check
  says so).
- **Every switch that fits runs.** "Switches are checked from the top. Every one whose conditions hold does its
  actions." A catch or a cutscene stops the rest, and so does a switch into or out of a mode it stands still in.
- **Any mode it moves in.** A switch from any mode skips modes with speed 0.
- **The patrol.** The patrol runs only in a mode called `patrol` or `routine`. That mode shows "Walks its patrol here";
  renaming it is refused: "This mode walks the patrol, so it keeps its name. Add a new mode instead."
- **Waiting.** "Has stood still more than [8] s" counts time standing still, and a mode change does not reset it.
  "Reset its wait" is an action. When a mode has a switch out that waits and no switch into it resets the wait, the
  mode shows: "This may switch at once: nothing resets its wait on the way in."
- **Standing still.** In a mode with speed 0, time does not count and it never "gets where it was going": only "All the
  time" switches run there. A switch out of such a mode that waits or asks "has got where it was going" shows: "This
  never happens: it stands still in [Alarm]."

## 5. Building conditions and actions

### 5.1 One table of pieces

The editor's whole vocabulary is one table, `pieces.ts`: for each condition kind and each action kind, its sentence,
its fields (each a number with a range and unit, a text, or a choice from the file's modes, characters, facts, places
or hooks), how to read it from the file, how to write it, and a default for a new one. The diagram, the list, the
inspector and the add menus all read this table. Facts with their own meaning (`self.idle`, `self.blocked`,
`self.timer`, `pursuit.hidden`) are rows of their own with their own sentences. A kind the table does not have (from a
newer extension) shows its sentence as "Something the editor cannot show yet" with the file's text beside it, read
only, and the rest of the character stays editable.

### 5.2 Adding

"Add a condition" and "Add an action" open a menu of sentences grouped in plain words: "What it notices" (sees, hears,
hears anything, touching, in light, warmth, saw hiding), "Where things are" (at a place, has got where it was going,
is stuck, the player went through a doorway, the player is hiding), "What is true" (a fact, another character's mode,
its own note), "Time" (has stood still more than). Actions: "Move" (go to, run from, follow through a doorway, lie in
wait), "Change" (switch mode, set a fact, reset its wait), "Tell the game" (make a noise, say a line, play a cutscene,
catch the player, a thing its game code does). "Not" is a switch on any condition ("does not see the player"), not a
separate kind she has to nest.

### 5.3 Choices from the file

A mode field offers the character's modes; a character field the scene's characters; a fact field the facts the puzzle
and the rules name, plus "a new fact…"; a hook field the character's hooks. A place field offers, in order: the player,
itself, the last noise it heard, the nearest light, the nearest warm thing, each other character, each named place
(section 8), and "a point…" (metres). A doorway field for the follow offers "the doorway she just used" and each pair of
touching rooms. An ambush's one-time name is made by the editor, never asked for. A value that names nothing ("goes to
bedsde") shows the check's problem in words on that field.

### 5.4 Pieces from other extensions

When the runtime work adds health, damage or attacks, it adds kinds to `systems.schema.ts`; Schematic gains them by
adding rows to `pieces.ts` (one row each, with its test). The plan for that work names the rows.

### 5.5 Problems

The editor checks what the game's content compiler checks, so what Schematic says is fine is what the game plays: the
file's shape (`systemsDefShape`) and every name check (`checkSystems`), with the scene's places as the known nodes.
Hooks are the game's code, so the editor counts every hook the file names as known and leaves a missing one to the
compiler. Each check message has a sentence at its field ("Hunt switches to “chse”, which is not one of its modes.").

## 6. Watch it run

The Tuner already shows the game's dev page beside its settings, and the content plugin restarts the game when content
changes. Schematic does the same: "Watch" opens the game beside the diagram, and each saved change restarts it.

When the debug extension is in the game and the game gives it the presentation bus (`installDebug({ bus })`), debug
forwards the sim events the editor names in the frame's address (`?af-watch=<the editor's origin>&events=systems.mode`)
to the parent window, posting only to that origin and only when framed. The editor checks both the message's source
window and its origin. Each `systems.mode` event (`{ agent, from, to }`, already emitted by the sim) lights the
character's new mode, flashes the arrow from `from` to `to` (or the Any-mode arrow when only that fits), and adds a line
to the log under the diagram: "12.4 s: guard went from Patrol to Hunt." A mode set by a rule or an ambush lights the box
with no arrow. Nothing in the sim changes, so no hash moves.

Without the debug extension, or without the bus, Watch still shows the game, and the diagram says "You can see the
game, but not which mode each character is in. Ask whoever writes your game's code to add the debug extension." with a
link to its README. With no game served, Watch says what the Tuner pane says: "Your game shows here when you open the
editors in your game's folder." While the file has problems, the pane says the game is still playing the last version
that worked (section 5.5).

## 7. Check it is fair

"Fair play" lists the scenarios as sentences ("A careful player who hides gets past the Porter within 90 s, 8 times in
10, over 20 tries") and the thresholds as numbers with words ("A careful player wins at least [70] % of the time").

"Check now" runs the bots in Node, never in the page, as a game check by its id (the pipelines' `systems` stages,
`automata-pipe systems run <scene> --json`). The check is a `[[check]]` row that no file row names, so it runs only
when she presses the button, not after every change. The bots play a scene module the game's code writes
(`systems.pipe.toml` names it); a game without the pipelines extension or that module sees: "Fair play needs two
things from your game's code: the pipelines extension, and a fair-play file for this scene." with a link to the
systems README. The result reads "Fair: 3 of 3 checks pass" or "Not fair yet: a careful player won 4 times in 10; the
target is 7." Each failing check names its scenario. Results go stale (greyed, "changed since this check") when the
file changes.

## 8. Places

The scene's places (`content/nav/<scene>.toml`) as a list: each place's name, where it is ("4 across, 2 down", in
metres, which is grid cells in a 2D level), and "Walks to" (the places a character can walk to from it, each a chip;
an edge that needs a door says "through the [door]"). Add, rename (every patrol stop, "is at" and "go to" naming it
changes in the same undo step) and remove (refused while anything names it, with what does). A new game has no nav
file: "Characters need places to walk between. Add the first place." Places drawn on the level are later (open choice
3).

## 9. Ready-made behaviours

Each is written with today's conditions and actions only, and each is tested in the sim in 2D and 3D (plan Task 8).
Every one has at least one patrol stop, which is where it starts unless the level places it.

- **Guard:** Patrol (1.4 m/s) → Hunt (2.2 m/s) when it sees the player; Hunt → Hunt, all the time while it sees her:
  go to the player; Hunt → Search (1.4 m/s) when it does not see her, resetting its wait (it keeps walking to where it
  last saw her); Search → Hunt when it sees her; Search → Patrol when it has got where it was going and has stood still
  more than 5 s; Any mode it moves in → Catch (stands still) when touching the player: catch the player. Sight 6 m,
  hearing 8 m, touch 0.6 m.
- **Sentry:** Patrol (stands still, one stop at its post) → Alarm (stands still) when it sees the player: make an
  "alarm" noise here, loudness 15, and set "alarm" to yes; Alarm → Patrol when it does not see her (a still mode counts
  no time, section 4.3). Sight 8 m.
- **Hunter:** Patrol (1.2 m/s) → Listen when it hears anything: reset its wait, go to the last noise; Listen (1.8 m/s)
  → Patrol when it has got where it was going and has stood still more than 4 s; Any mode it moves in → Catch when
  touching the player: catch the player. Hearing 12 m, touch 0.6 m.
- **Coward:** Patrol (1.2 m/s) → Flee (2.4 m/s) when it sees the player: reset its wait, run from the player; Flee →
  Patrol when it does not see her and has stood still more than 3 s. Sight 6 m.
- **Wanderer:** Patrol (1 m/s), three stops, waits 2 s at each, no senses; it ignores the player.

## 10. The puzzle

The scene's puzzle as a list: Items, Facts (each with its starting value), Actions ("At the shutter, using the crank:
when the power is on, open the shutter"), and the Goal. Each action is conditions, then effects, built from a second
pieces table of the puzzle's condition and effect kinds. How the characters open the way (`systemic`) and what can kill
the player (`lethal`) show read only as sentences, because the solver counts them.

"Can it be finished?" runs the solver (`createSolver` from `@automata/puzzle/solver`) on the edited puzzle in a Web
Worker in the page; it needs no game code. It says "Yes, in 14 steps" or "No: the player can get stuck after taking
the fuse (open it)". A lock graph view is later (open choice 4).

## 11. Starting

- A game with no systems file: "This scene has no characters yet." and "Add a character" with the ready-made
  behaviours. It writes `content/systems/<scene>.toml` with the scene, empty design table, numbers, rules and
  scenarios, the new character, and fairness thresholds of a careful player winning 9 times in 10, the first threat
  after 20 s, 1.5 s of warning, at most 1 death a run, and a 1.3 safe-window margin (`systems/testing/toy.ts`).
- When the game's editor list has no row for `content/systems/*.toml` or `content/nav/*.toml`, the page says so and
  shows the row to add, in a copyable block; `create-game`'s template has both rows.
- When the game does not use the systems extension: "This game does not use characters that think yet. Add the
  systems extension to your game to use Schematic," with a link to its README. (No silent fallback.)

## 12. Checks

- `pieces.ts`: one test per condition and action kind and per special fact: read from the file, the sentence, write
  back unchanged, and the new default passes the schema and the checks.
- The diagram layout: a pure function from a character to boxes and arrows, tested on the converted fixtures (`bay`:
  eight modes and 74 switches; `clinic-dawn`, `clinic`, `prologue`) for no overlapping boxes or labels and every switch
  drawn once.
- The problems: each `checkSystems` message has a sentence and lands on its field.
- DOM tests: select a mode and change its speed; add, reorder within a group and remove a switch; add a "not"
  condition; rename a mode and a character everywhere; the patrol mode's rename is refused; add a character from each
  ready-made behaviour and pass the checks; a dangling mode name shows its problem on its field.
- The ready-made behaviours, run in the sim in 2D and 3D, do what their lines say.
- Layout tests in Chromium at phone (390x844) and iPad (820x1180): the diagram fits and pans, every target is 44 px at
  every zoom.
- A journey on the sample: open Schematic, change a guard's sight range, the file changes, Undo.
- **Served journeys in play, 2D and 3D** (the Owner's rule): every edit made in Schematic, saved, and then measured in
  the running game: a sight range that changes whether the guard sees the player standing at a fixed distance, a chase
  speed measured over a second, a switch whose target mode changes what the guard does, and a character added from a
  ready-made behaviour that appears and walks its patrol. In 2D, also Check now's verdict changing with a sight edit.
- Watch's message bridge: a message from another origin or window is ignored, and debug posts only when framed with an
  origin and only to it.

## 13. Open choices for the Owner

1. **Which ready-made behaviours ship.** Recommended: Guard, Sentry, Hunter, Coward, Wanderer (section 9).
2. **Fair play in the editor or only in `automata check`.** Recommended: in the editor, as above. It works only in a
   game whose code provides the scene's fair-play file (no template can write it); the 2D story example has one. If
   that is not worth it, cut Fair play from the first build and show its numbers read only.
3. **A patrol and places drawn on the level** or lists. Recommended: lists now; the map when the 2D and 3D level views
   can be embedded read only.
4. **The puzzle as a lock graph** (entry to goal) or a list. Recommended: the list now, the graph after.
