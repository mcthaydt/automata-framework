# The content editors: Feel, Audio, Writer, Sequence and Schematic

Status: spec, 2026-11-08. Plan: [`2026-11-08-content-editors-plan.md`](2026-11-08-content-editors-plan.md).

## 1. Why

The suite was designed for nine editors and has four (Tuner, Levels 2D, Levels 3D, the Studio). The other five were
to come from an `editor-plus` package that was never written (2D editors audit S2; Plus audit G3). The Plus audit
filed them as "a gap to record, not one to fill". The Owner has now overruled that (2026-11-08): "The editors are only
paid when we package for iOS and Android, all plus are free; build the remaining editors."

So every editor is free. Only the iOS and Android packaging of the editor apps is paid, and that code lives in its
own private repository, never here. Nothing in this repository says "Plus", "paid" or "comes with" about an editor.

## 2. What each editor edits

Each editor edits one extension's content, as TOML files in the game's `content/` folder. The schemas are the
extensions' own (`*.content.ts`); the editors never redefine them.

| Editor | Rail label | Extension | Files | What a person does there |
| --- | --- | --- | --- | --- |
| `feel` | Feel | `@automata/feel` | `content/feel/*.toml` | Says what the player feels when something happens: shake, freeze, flash, a word, a rumble, a sound |
| `audio` | Audio | `@automata/audio-synth` | `content/audio/*.toml` | Makes and plays sounds and music beds; says which sound plays when something happens |
| `writer` | Writer | `@automata/narrative` | `content/dialogue/*.toml`, `content/lines/*.toml` | Writes who says what, and the choices the player picks from |
| `sequence` | Sequence | `@automata/cutscenes` | `content/cutscenes/*.toml` | Lays out a cutscene's steps in time: camera, actors, captions, sounds |
| `schematic` | Schematic | `@automata/systems`, `@automata/nav`, `@automata/puzzle` | `content/systems/*.toml`, `content/nav/*.toml`, `content/puzzles/*.toml` | Says how enemies and other characters behave, and the world's rules and puzzles |

**Schematic covers enemy and NPC behaviour.** A `systems` file's agents are the game's enemies and other characters:
what each one senses (sight, sound, light, warmth, touch), its modes (patrol, chase, search), how fast it moves in
each, and when it switches mode ("From Patrol to Chase when it sees the player"). Its rules are the world's ("When the
generator is off, the lights go out"). A `puzzle` file is the scene's items, facts and actions. Schematic shows all of
these as sentences a person reads top to bottom; a character's modes and switches are also drawn as a diagram, and the
scene's places (its nav graph) are a list (Schematic spec, sections 4.1 and 8).

Left out on purpose (the Owner's rule, "editors have only essential features"): the narrative extension's canon,
storylets, beats and puzzle help (`content/canon`, `storylets`, `beats`, `help`). (The nav graph is Schematic's
Places: without it a character has nowhere to patrol; the Schematic plan audit, H2.) They are written
by the game's tools and pipelines today, and a person making a game does not start there. Their files open read only on
Home with "No editor for this file yet." They can join Writer and Schematic later.

## 3. Where they live

The editor package (`@automata/editor`) is core, and core never imports an extension (Plus port, P-D1 B). So the five
editors live in one new private package beside the extensions they edit:

- `extensions/editors`, `@automata/editors`, `private: true`, MIT.
- It depends on `@automata/editor` (the suite, the kit, `defineSuiteEditor`) and on the five extensions above. The
  extensions do not depend on it: a game that uses `feel` gets no Svelte from this package.
- Its `src/` has the usual shape: `features/feel`, `features/audio`, `features/writer`, `features/sequence`,
  `features/schematic`, `shared/` (what two or more editors use), `app/suite/` (its suite page), `entries/` (re-exports
  only). A feature imports only itself and `shared/`.
- Its suite page (`suite.html`, `src/app/suite/main.ts`) registers the core editors (`createTuner`, `createLevels2d`
  from `@automata/editor/suite`) and the five, the same way `editor-3d`'s suite page adds Levels 3D and the Studio.
  `vite build --mode suite` builds it to `dist/suite`, which `automata editor --app-dir` serves. Joining it with
  `editor-3d`'s page into one page is the 3D editor work's call (it runs on PRs #472 and #473), not this one's; this
  package exports `contentEditors()` so that page can add them with one line.

## 4. One session shape for every editor

All five edit TOML through the kit's content documents, so a value edit rewrites only its own literal and comments
survive. One shared session does the work the Tuner's session does today, for any file and schema:

- `openTomlSession({ path, ports, schema })` reads the file, keeps its text in a kit `History`, and checks it with the
  extension's Zod schema after every change.
- `edit(label, edits)` applies `ContentEdit`s, writes the new text through the workspace port with the mtime it read,
  and only then records one undo step labelled `label`. A refused write (a conflict, the editor list's policy) is a
  message in words and the history is left as it was.
- `problems()` is the schema's issues, each with its key path and a sentence a person can act on.
- `undo`, `redo`, and `ask` (the whole-text proposal, one undo step) plug straight into `SuiteUndo` and `SuiteAskTarget`.

A file that does not parse opens as a read-only text view with the line and column of the mistake, never a crash.
A game without the file shows one button that makes it ("Start a feel file"), as the Tuner does.

## 5. How they look

Every editor follows the suite's frame and the 2026-11-06 visual direction (near-black cabinet, slightly rounded
corners, Geist). All five share one layout:

- **Panel:** the list of things in the file, in the person's words ("When the player is hit", "Door creak").
- **Canvas:** the chosen thing as plain sentences with inline fields ("Shake the screen [0.4]"; "Freeze the action for
  [80] ms").
- **Inspector:** only where a thing has more than fits in a sentence (a sound's voices; a cutscene step's timing).
- **Status:** the file's problems, counted, each one taking you to its field.

Phone first: on a phone the panel is a sheet and the canvas fills the screen. Touch targets are at least 44 px and the
primary action 48 px. Audio's Play button and Sequence's Play button preview in the page only (Web Audio, the
cutscene's own director at the page's clock); nothing plays by itself.

## 6. The drunk grandma test

Every word on screen passes it. No key names (`hit_stop_ms`), no schema words (`entry`, `probe`, `transition`), no
package names. Units a person can feel: milliseconds become "ms" beside a number she can slide, trauma 0..1 becomes a
"how hard" slider, a frequency becomes a pitch she can hear with Play. An empty file says what to do next in one
line. Errors say what is wrong and where, in a sentence.

## 7. The suite's own changes

- **Every registered editor stays on the rail**, whether or not the game has its files yet. (A first build hid an
  editor the game's list did not name; the Owner, 2026-11-08: that leaves a game with no sounds no way to add its
  first one. Reverted.) An editor whose files the game does not have yet opens on a page that says what it is for and
  offers to start one; each editor's own spec designs that page.
- Starting a first file needs the game's editor list to name that file, or the write is refused by the list's
  policy. So `create-game`'s template list (`packages/tools/src/shared/create-game/template-content/editors.toml`)
  names every content editor's files, and the "start" page of an editor says how to add the list row when an older
  game's list lacks it. Each editor's plan carries its row.
- The leftover "Plus build (EDS.P)" comment in `create-suite.ts` goes. The suite's test that no card says "Plus" stays.
- The editor list's `LABELS` keep the five names, so a list that names one on a page without it still reads well.
- The sample game (`extensions/editors/src/app/suite/sample/`) gains a small file for each of the five, so the page
  opened without a checkout shows them working.

## 7b. One spec and plan per editor

The Owner, 2026-11-08: "Each editor needs its own plan and spec." This document holds only what the five share (the
package, the session, the look, the words, the suite's changes). Each editor has its own spec and plan, written,
audited and built through the project's pipeline before its code merges:

| Editor | Spec and plan | State |
| --- | --- | --- |
| Schematic (the game's AI: how enemies and other characters behave) | `2026-11-08-schematic-{spec,plan}.md` | Plan audited (`2026-11-08-schematic-plan-audit.md`); build next |
| Feel | `2026-11-08-feel-{spec,plan}.md` | Built ahead of its spec; plan audited (`2026-11-08-feel-plan-audit.md`): the plan brings it in line and makes the game play it; build next |
| Audio | `2026-11-08-audio-{spec,plan}.md` | Half built ahead of its spec; plan audited (`2026-11-08-audio-plan-audit.md`): the plan finishes it and makes the game play it; music waits for the Owner; build next |
| Writer | `2026-11-08-writer-{spec,plan}.md` | Plan audited (`2026-11-08-writer-plan-audit.md`); saves a line's words in the line (Writer spec, section 4); build next |
| Sequence | `2026-11-08-sequence-{spec,plan}.md` | Plan audited (`2026-11-08-sequence-plan-audit.md`); build next |

`shared/game-events.ts` (the game's events, for Feel and Audio) is made by whichever of Feel's Task 2 and Audio's
Task 4 runs first.

## 8. Not in this work

Owned by the content-in-play plan (project files, `2026-11-08-content-in-play-spec.md` and its plan, PR #479):

1. **2D sprites and animation** (its section 4, animation clips).
2. **Default controls** (`controls.toml`, edited in the Tuner; its Task 9 adds that row to the template's
   `editors.toml` beside these editors' rows).
3. **2D games.** Narrative, cutscenes, nav and systems read the world through `@automata/places`, so what Writer,
   Sequence and Schematic's characters make plays in 2D and 3D. The editors add nothing that reads the world another
   way (Schematic spec, section 2).
4. **The dialogue box and captions.** The box shows `words(key)` from the game's message catalog; the Writer spec
   says where Writer saves the words (Writer spec, section 4), and the content-in-play journey edits a line in Writer
   and sees the box show it.

Still for the Owner to decide, each its own spec if wanted:

5. **Menus and HUD.** Cut by the content-in-play audit: a HUD's numbers are the game's code, and its words already go
   through the game's messages.
6. **Item and enemy tables.** The Tuner edits single numbers; there is no table of items or enemies with their stats.
7. **Combat.** Schematic's characters sneak, chase and search; no extension has health or damage yet.

## 9. Checks

- Each editor: unit tests for its model (file to sentences and back), DOM tests for its regions (jsdom, Testing Library),
  and one Chromium layout test at phone and iPad sizes.
- The package joins `pnpm check` (lint, typecheck, boundaries, style, knip, unit tests).
- A journey on the sample game per editor: open it from Home, change one thing, see the file change, Undo.
- And each editor's change seen in play, in a served journey (the Owner, 2026-11-08): Feel and Audio play on the game's
  stage (their plans add the player each lacked); Writer and Sequence run their steps of the content-in-play journey in
  `examples/2d-story`. An editor is not done until its journey runs.
