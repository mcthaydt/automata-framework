# The Last Light, the framework's 3D reference game: design

**Date:** 2026-11-11. **Status:** draft by the coordinator; the Owner chose the approach, the calls at the end are open
to correction. **Stage:** 1 (spec). **Tracker:** [`../progress.md`](../progress.md), workstream 2.

## Why

The framework and its editor suite exist so that games like The Last Light are easier to make, and so their content
can be changed by hand. FigureBuilder and EnvironmentBuilder were long spikes to give it better figures and scenes;
they are to be replaced by the framework and its suites (the Owner, 2026-11-11).

The framework was extracted from The Last Light at its 2026-10-11 commit
([extraction map](../../archive/superpowers/specs/2026-10-11-core-and-extensions-extraction-map.md)), which says the
game "moves onto it at its adoption". That never happened. The game kept its own runtime, editor and pipelines, the
framework grew without its hardest consumer, and the builders became a third and fourth copy of the figure and scene
code. This work is the adoption, in the form the Owner set: the framework gains what the game has, and the game
becomes the framework's 3D reference.

## What the Owner decided (2026-11-11)

- **What this is.** "We're building out what's missing from the last light, we aren't actually shipping the last light
  in automata framework; it's more of the 3D example like emberwick is the 2D." The work builds into the framework
  everything The Last Light has that the framework lacks, and The Last Light is the game that proves it: **the 3D
  reference game**, in the framework's own repository, as Emberwick is the 2D one. It is not a private product moved
  onto the framework from outside.
- **Ember Hall is cut.** "Cut emberhall it's ass and doesn't show what we can do here, The Last Light becomes the 3D
  reference game."
- **The target** is The Last Light remade with the builders' figures and scenes, not the game as it looks today.
- **The way** is one scene at a time, end to end, the prologue first (approach A below).
- **A refactor**, by feature, where the old code's quality is questionable.
- **The bar** for everything shared is FloorFifty's finish. Workstream 1
  ([shared polish](2026-11-11-shared-polish-design.md)) supplies what the framework lacked.
- **Out:** the films (FMV) and the fight spike.
- The earlier clinic work in the framework (#575, #596, #606, #588) is superseded.
- The story lines are translated into the six languages. A UI editor is coming (workstream 3).
- `automata-plus` is cut and `automata-website` is retired. `automata-skills` is kept.

## Goals

1. The framework can do everything The Last Light does (films and the fight spike aside), as core or as extensions,
   each with its tests, its editor support and its documentation.
2. The Last Light is the 3D reference game in `games/`: the sim on Koota with the same-hash promise, content as files,
   the framework's shell around it. It is what every 3D change is judged on, what the 3D journeys play, and what shows
   on the site what the framework can do.
3. Every piece of its content opens and saves in the editor suite: rooms in Levels 3D, lines in Writer, cutscenes in
   Sequence, puzzles and creatures in Schematic, figures in the Studio, numbers in the Tuner, sound in Audio, feel in
   Feel. A change made by hand in an editor shows in play.
4. Ember Hall (`games/base-3d`) is removed, and everything that leaned on it leans on The Last Light or on a small
   fixture of its own.
5. When the last scene is across, the two builders have nothing the framework does not.

## Non-goals

- Pixel parity with today's game. The look changes on purpose, so the old pixel baselines do not guard this work.
- The films and the fight spike.
- New story. The approved screenplays stay the authority (The Last Light's `AGENTS.md`: the script wins).
- Any paid pipeline stage. The builders' figures and scenes are free to run.
- A public release. The framework refuses to publish a 3D game publicly while Pixi 3D is in beta; lifting that is
  the Owner's.
- Changing The Last Light's own repository (`mcthaydt/PixiJS3D_Experiment_001`). It is the reference this work reads;
  what becomes of it afterwards is the Owner's.

## Anti-goals

- A game that plays but cannot be opened in the editors.
- A converter that has to be re-run forever. It runs once per scene; after that the content files are the source.
- A private copy, inside the game, of anything another game would need; or, the other way, game-specific code or
  names pushed into core or an extension.
- The game's own menus, settings, gamepad, save or language code beside the framework's.
- A changed line. A line changes only on the Owner's word.

## Constraints

- The framework's `AGENTS.md`: the seven laws, feature folders, tests first and in `tests/`, `pnpm check`. The game
  keeps The Last Light's own design rules: the script wins, tone (worn, not grimy; no gore), the camera rules in its
  `docs/design/camera-rules.md`, no real-time lights, no `fetch()` at runtime.
- The reference game is fully open source, like Emberwick (the Owner, 2026-11-11: "The story, art, and music can be
  MIT; it's a fully open source game like emberwick is"). Its story, lines, art, sounds and music are MIT with the
  rest of the repository; there is no separate notice. The recorded sounds and music made with ElevenLabs through the
  old sound pipeline come across as they are (the Owner: "I paid for the elevenlabs so it's fine"). As the framework's
  other examples do, the game keeps a provenance file saying where each asset the builders did not make came from.
- The Last Light is no longer a "source game" (the Owner, 2026-11-11: "it's no longer a source game"). It is the 3D
  reference game, so the repository's source-names check stops forbidding its name, and
  `docs/provenance/sources.md` says so. The other source names stay as they are.
- No subagents. Each stage in its own session and branch.

## Approaches

- **A. One scene at a time, end to end** (the Owner's choice). A new game on the framework; the prologue is ported
  first and must play to its end and open in the suite; each missing piece is built in the framework as a scene needs
  it. The first scene is slow, because it pays for the converter and the HUD, but every addition has a consumer.
- **B. Framework first, game after.** Build every missing piece, then port. Nothing is playable for a long time and
  pieces are built against guesses, which is how the two drifted apart.
- **C. Swap the engine in place.** Replace modules one by one under the running game. There is no clean seam: its
  state is in Miniplex and its scenes are TypeScript modules, so each swap needs throwaway glue.

## The design

### Where the game lives

In the framework's repository, at `games/the-last-light`, beside `games/emberwick`, in the framework's game shape:
`content/`, `src/app/`, `src/features/<x>/`, `src/shared/`, `tests/`. It uses the workspace's packages directly, so
there is no pin and no packing. Like Ember Hall before it, it is private while Pixi 3D is in beta.

The Last Light's own repository is the reference: its scenes, screenplay, design documents and behaviour are read
from there (at `92e6704`). Scene content already converted in October sits in the framework's test fixtures
(`extensions/{narrative,puzzle,systems,cutscenes,sectors,nav}/src/testing/fixtures/`, the editor's `blockout-prologue`
and `facility`). With the game now a reference game here, that content is where it belongs, and the port may start
from those files where they are still true to the game.

### Ember Hall goes

`games/base-3d` is removed in the slice where The Last Light's prologue first plays, not before, so the 3D gates are
never without a game. In that slice everything that names it moves: the 3D journeys and the frame budget play the
prologue; `packages/tools`' 3D template and `create-game` keep a small starter of their own (a figure in a room) that
no longer borrows Ember Hall's content; the editors' and tooling's tests that open Ember Hall's files open the new
game's or a fixture; `.github/workflows/3d.yml`, the guides, `docs/status.md`, `docs/README.md` and `AGENTS.md` name The
Last Light. The core rule "core is what both reference games need" now reads against Emberwick and The Last Light,
which is what lets the horror systems, the HUD screens and the rest be judged core or extension honestly.

### A refactor, not a transcription

The Owner, 2026-11-11: "You have permission to refactor the last light on framework if the code quality is
questionable, at a minimum, we'd need to do it for the feature folders because it wasn't coded like that". The old
game is grouped by kind (`src/game/`, `src/render/`, `src/ui/`, `src/audio/`) with one flat `tests/`. The new game is
written by feature from its first file: `src/features/<feature>/` owning its code and its data, imports going only
downward, `src/shared/` for what has no feature logic, `tests/` mirroring `src/`, and an architecture test that fails
on a broken layer or a test beside the source. Beyond the folders, where the old code is tangled, duplicated, or
carries a workaround for something the framework now does, the port writes it properly instead of carrying it across;
the old behaviour and its tests are the specification, the old code is not. Each such rewrite is named in the plan with
its reason, and the playthrough proves the behaviour held.

### The 3D examples go too, and are recreated after the prologue

The Owner looked at screenshots of all 19 examples in `examples/3d` on 2026-11-11 (none crashes; two draw almost
nothing, `world-level-room` and `look-pixel-art`; about half are a lone figure on a bare slab) and decided: "all
examples should be recreated after the prologue". So `examples/3d`, its journeys and goldens, and `examples/3d-story`
are removed in the same slice as Ember Hall, when the prologue plays, and the site's Examples page lists no 3D example
until the new ones exist. The 3D workflow's coverage then comes from the reference game's own journeys and the
packages' browser tests. Recreating them is its own piece of work straight after slice 1: each new example is a small
cut of the reference game (a room, a figure, a cutscene, the look, the HUD), so it looks right because the game
does, and each has its journey. `examples/3d/wardrobe`, the worked example of a wardrobe extension, is judged with the
rest. The 2D examples are untouched.

### Where a new piece goes

The Owner, 2026-11-11: "it shouldn't go into the framework unless it's generic, it can go into extensions if it's
generic, but genre-scoped, we can have custom code for 3D example game". Three homes, judged in this order:

1. **Core** (`packages/`): only what any game could use, whatever its genre, and which imports no extension (core
   never does). The framework's own test still applies: every target needs it, or both reference games do. A view
   that names the rooms it draws passes. Using a thing in the world and a HUD drawn from data do not pass today:
   Emberwick uses neither, and as planned they lean on `puzzle`, `nav` and `narrative`, so they are adventure-genre
   extensions; their dependency-free halves are written so they can move to core later, when a second game or the UI
   editor needs them.
2. **An extension** (`extensions/`): generic within a genre. Another game of the same kind would use it unchanged, and
   a game of another kind would not want it: a creature that hunts by light and sound, hiding and peeking, a lamp that
   burns fuel, a pacing director. It names no character, room or line of The Last Light.
3. **The game** (`games/the-last-light`): what is this game's alone, written as its own features: the prologue's rule
   arithmetic, the Night Nurse's particular behaviour, a hook only this story needs. Custom code here is fine and is
   not a failure to generalise.

A piece that does not clearly pass the test for a home goes one step down the list. The plan says for each addition
which home it has and why; the plan audit checks each one, and nothing lands in core or an extension that carries the
game's own names or assumptions.

### One scene's slice

Each scene goes through the same steps.

1. **Convert once.** A script reads the scene's package (`src/scenes/<id>/`: level and map, dress and props, story,
   dialogues, beats, help, cutscenes, puzzle, systems, rules) and its `blockout.json`, and writes framework content:
   an `af-sector/2` level, nav, puzzle, systems, narrative and cutscene files, and the lines as messages, which are then
   translated into the other five languages. Where October's fixtures already hold a true conversion, it starts there. It reports
   everything it could not express.
2. **Close the gaps in the framework.** Each thing the converter could not express, or the scene needs at run time,
   is added to the framework as data the editors can show, with tests there first. What only this game needs (a
   rule's arithmetic, a hook) is a small sim feature in the game.
3. **Dress it with the builders' work.** Figures from the framework's figure builder and character kit; rooms lit and
   textured by the look that is landing in `@automata/3d` and the world kit; The Last Light's gameplay camera, which
   the framework's default now follows.
4. **Prove it plays.** A playthrough bot reaches the scene's end from its start with no page errors, on the
   framework's replay and hash tools, in place of `scripts/verify/playthrough*.mjs`.
5. **Prove it edits.** A journey opens the scene in each editor that owns part of it, makes one change, and sees it
   in play.
6. **Prove the shell.** The scene runs under the framework's title, pause, settings, save slots, languages, gamepad
   and touch, at phone size, with none of the game's own copies.

### The order of scenes, and what each brings

| Slice | Scene | What it forces into the framework |
|---|---|---|
| 1 | Prologue (1,142 lines of scene code in 16 files, one creature, 34 puzzle actions, 74 lines, 5 cutscenes) | The game package, written by feature; a small converter starting from October's fixtures; Ember Hall's removal; using a hotspot (`@automata/interact`); the play HUD as data: objective line, inventory, examine box, keypad, prompt (`@automata/hud`); peeking through a doorway as a sim rule, and a re-route on a clock (`@automata/systems`); a line's delivery (`@automata/narrative`); a 3D cutscene stage and a camera key at an anchor (`@automata/cutscenes`); footsteps by floor (`@automata/audio-synth`); nine prop generators (`@automata/world-kit`); Sequence's preview over a 3D level; the rooms a camera view draws, and two lamp kinds (`@automata/3d`); the `source-names` rule. Already there, so not forced: hotspots as level things, items, light as a sense, hiding, the catch event, checkpoints' snapshots, captions and the dialogue box. The game's own: the hand lamp and its fuel, the vigil, what a catch does |
| 2 | Clinic (act one) | The Night Nurse in full; journal, map and minimap; the dialer; hints and deductions; storylets in play; conversations with staging and faces |
| 3 | The Dock (act two) | The Porter; the ambulance crew, the pacing director, the grapple and barricades; the crew playthrough route |
| 4 | Clinic at dawn (act three) | The three endings; the connected facility with its phases and locks; room acoustics |

The table is the coordinator's reading of the gap survey. Slice 1's row was corrected on 2026-11-11 by its survey
([`../audits/2026-11-11-last-light-prologue-survey.md`](../audits/2026-11-11-last-light-prologue-survey.md), "Corrections
to the spec's slice table"); rows 2 to 4 are still the coordinator's reading.

### What is already there, so not rebuilt

Sectors, nav, puzzle with its solver, systems (senses, patrols, bots, fairness), narrative (dialogue, storylets,
hints, the screenplay tool), cutscenes with a lint, feel, synth audio, saves, settings, input, the targets, the
procedural figures and kits, the DUEL look, and the suite's editors. The port uses them and files what is wrong with
them as framework fixes.

### What depends on other workstreams

- **Workstream 1**, for the shell's languages, first run, interface sounds, splash and credits.
- **The builders' look** in `@automata/3d` and the world kit (`docs/refactor/eb-look/`) and the painted figures in the
  character kit. Slice 1 uses whatever has merged and lists what it still waits for; it does not rebuild it.
- **The 3D slice of the refactor** (stage 3 of 6 in `docs/refactor/progress.md`). Slice 1 builds on `main` as it is.

### The earlier clinic work is superseded

Other sessions had begun putting the clinic into the framework: `claude/clinic-level3d` (#575), `claude/clinic-1`
(#596), `claude/clinic-2` (#606) and `claude/tll-extensions-1` (#588), all drafts, with their records under
`docs/refactor/clinic/` and `docs/refactor/tll-extensions/` on those branches. The Owner, 2026-11-11: "supersede it".
This port replaces that work and starts fresh with the prologue. Those branches are references for behaviour and for
what was learned (room-by-room drawing, wall tops, room visibility); nothing is merged from them, and a framework
change the port needs is planned and built here. Their pull requests are not this workstream's to close.

### The pipelines and gates

The Last Light's paid pipelines (character, props, art) are not brought across: the builders replace them. The free ones the
framework already has (audio, narrative, puzzle, systems) take over their scenes as they cross. The script-wins rule
and the screenplay stay; the cutscene audit and the look checks cross only when a slice needs them. The Last Light's
own editor is not ported: its 156-line gaps ledger (`docs/superpowers/editor-gaps.md`) is read against the suite in
slice 1's survey, and what the suite still lacks becomes suite work.

### HUD screens, with a UI editor coming

The suite has no UI editor yet; the Owner wants one (workstream 3 in the tracker), able to change layout, look,
content and whole screens, including the default ones. So each HUD screen a slice adds (the objective line, the
inventory, later the journal, map and dialer) keeps its layout and its words as data from the start, so that editor
can take it over without a rewrite.

## Left to the builder

- The converter's shape, and what counts as data against a game hook, scene by scene.
- Whether a new piece is core or an extension, by the framework's rule (core only if every target or both reference
  games need it).
- What the 3D template's own starter is once Ember Hall is gone.

## Done means, for slice 1

- The prologue plays from its first cutscene to its end under a bot, twice with the same hash, in Chromium.
- It opens in Levels 3D, Writer, Sequence, Schematic, the Studio and the Tuner; one edit in each shows in play.
- It runs under the framework's shell with a gamepad and with touch at phone size, and its menus and its story lines
  are in the six languages.
- Every framework addition has its tests and passes `pnpm check`.
- `games/base-3d` is gone and nothing names it; the 3D workflow's suites and journeys pass on The Last Light.
- The game's folder carries its provenance file, and everything in it is MIT.

## The coordinator's calls, for the Owner to check

1. The game is `games/the-last-light`; Ember Hall is removed in slice 1, when the prologue plays, not before.
2. The 3D template keeps a small starter of its own rather than The Last Light's content.
3. Settled by the Owner: the game's story, art and music are MIT, like Emberwick's.
4. The scene order and what each brings (the table above).
5. The Last Light's paid pipelines and its own editor are not brought across.
6. Each slice is its own plan, audit, build, audit and fixes cycle; this spec covers all four, and slice 1 is planned
   first.
