# The Last Light on the framework: design

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
code. This work is the adoption.

## What the Owner decided (2026-11-11)

- **The target** is The Last Light remade with the builders' figures and scenes, once those are in the framework. It
  is not the game as it looks today.
- **The way** is one scene at a time, end to end, the prologue first (approach A below).
- **The bar** for everything shared is FloorFifty's finish: languages, gamepad, responsive screens. Workstream 1
  ([shared polish](2026-11-11-shared-polish-design.md)) supplies what the framework lacked.
- **Out:** the films (FMV) and the fight spike.
- `automata-plus` is cut and `automata-website` is retired. `automata-skills` is kept.
- Nothing is copied wholesale; an older repository is a reference for behaviour.

## Goals

1. The Last Light plays on the framework: the sim on Koota with the same-hash promise, content as files, the
   framework's shell around it.
2. Every piece of its content opens and saves in the editor suite: rooms in Levels 3D, lines in Writer, cutscenes in
   Sequence, puzzles and creatures in Schematic, figures in the Studio, numbers in the Tuner, sound in Audio, feel in
   Feel. A change made by hand in an editor shows in play.
3. Whatever the game needs that the framework lacks is built in the framework (core or an extension), never in a
   private copy inside the game.
4. When the last scene is across, The Last Light's own runtime, editor and scripts are deleted, and the two builders
   have nothing the framework does not.

## Non-goals

- Pixel parity with today's game. The look changes on purpose, so the old pixel baselines do not guard this work.
- The films and the fight spike.
- New story. The approved screenplays stay the authority (The Last Light's `AGENTS.md`: the script wins).
- Any paid pipeline stage. The builders' figures and scenes are free to run.
- A public release. The framework refuses to publish a 3D game publicly while Pixi 3D is in beta; lifting that is
  the Owner's.

## Anti-goals

- A game that plays but cannot be opened in the editors.
- A converter that has to be re-run forever. It runs once per scene; after that the content files are the source.
- The game's own menus, settings, gamepad, save or language code surviving beside the framework's.
- A changed line. A line changes only on the Owner's word.

## Constraints

- Both repositories' `AGENTS.md`. In the framework: the seven laws, feature folders, tests first and in `tests/`,
  `pnpm check`. In The Last Light: the script wins, tone (worn, not grimy; no gore), the camera rules in
  `docs/design/camera-rules.md`, no real-time lights, no `fetch()` at runtime, the repository stays private.
- The Last Light's story and art are private; the framework is MIT. Game content never enters the framework's
  repository, tests or examples.
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

In The Last Light's repository (`mcthaydt/PixiJS3D_Experiment_001`), as a new game package beside the old code, in the
framework's game shape: `content/`, `src/app/`, `src/features/<x>/`, `src/shared/`, `tests/`. It consumes the framework
at a pinned commit, built and packed, since the 3D packages are not on a registry. The old `src/`, `editor/` and
`scripts/` stay untouched as the reference until the whole game is across, then they are deleted in one change.

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

### One scene's slice

Each scene goes through the same steps.

1. **Convert once.** A script reads the scene's package (`src/scenes/<id>/`: level and map, dress and props, story,
   dialogues, beats, help, cutscenes, puzzle, systems, rules) and its `blockout.json`, and writes framework content:
   an `af-sector/2` level, nav, puzzle, systems, narrative and cutscene files, and the lines as messages, which are then
   translated into the other five languages. It reports
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
| 1 | Prologue (about 1,100 lines of scene code, one creature, 23 puzzle steps) | The converter; the game package and the pin; hotspots, items and an inventory; the objective line; the hand lamp, its fuel and light as a sense; hiding and peeking; a catch and a checkpoint; captions and the dialogue box in 3D; samples and footsteps |
| 2 | Clinic (act one) | The Night Nurse in full; journal, map and minimap; the dialer; hints and deductions; storylets in play; conversations with staging and faces |
| 3 | The Dock (act two) | The Porter; the ambulance crew, the pacing director, the grapple and barricades; the crew playthrough route |
| 4 | Clinic at dawn (act three) | The three endings; the connected facility with its phases and locks; room acoustics |

The table is the coordinator's reading of the gap survey; slice 1's plan starts with its own survey of the prologue
and corrects it.

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

The Last Light's paid pipelines (character, props, art) are not ported: the builders replace them. The free ones the
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
- How the pin is built and packed.
- The game package's name and folder.

## Done means, for slice 1

- The prologue plays from its first cutscene to its end under a bot, twice with the same hash, in Chromium.
- It opens in Levels 3D, Writer, Sequence, Schematic, the Studio and the Tuner; one edit in each shows in play.
- It runs under the framework's shell with a gamepad and with touch at phone size, and its menus and its story lines
  are in the six languages.
- Every framework addition has its tests and passes `pnpm check`; nothing of the game's story or art is in the
  framework's repository.
- The old game still builds and plays, untouched.

## The coordinator's calls, for the Owner to check

1. The game lives in The Last Light's repository beside the old code, pinned to a framework commit.
2. The old runtime, editor and scripts are deleted only when the last scene is across.
3. The scene order and what each brings (the table above).
4. The paid pipelines and The Last Light's own editor are retired, not ported.
5. Settled by the Owner (2026-11-11): the story lines are translated too. Each scene's lines ship in the six languages,
   written by workstream 1's `automata words` command, with no review state. English stays the approved
   script; a translation never changes a line.
6. Each slice is its own plan, audit, build, audit and fixes cycle; this spec covers all four, and slice 1 is planned
   first.
