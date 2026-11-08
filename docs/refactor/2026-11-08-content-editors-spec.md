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
| `schematic` | Schematic | `@automata/systems`, `@automata/puzzle` | `content/systems/*.toml`, `content/puzzles/*.toml` | Says how enemies and other characters behave, and the world's rules and puzzles |

**Schematic covers enemy and NPC behaviour.** A `systems` file's agents are the game's enemies and other characters:
what each one senses (sight, sound, light, warmth, touch), its modes (patrol, chase, search), how fast it moves in
each, and when it switches mode ("From Patrol to Chase when it sees the player"). Its rules are the world's ("When the
generator is off, the lights go out"). A `puzzle` file is the scene's items, facts and actions. Schematic shows all of
these as sentences a person reads top to bottom, not as a node graph.

Left out on purpose (the Owner's rule, "editors have only essential features"): the narrative extension's canon,
storylets, beats and puzzle help (`content/canon`, `storylets`, `beats`, `help`), and the nav graph. They are written
by the game's tools and pipelines today, and a person making a game does not start there. Their files open read only on
Home with "No editor for this file yet." They can join Writer and Schematic later.

## 3. Where they live

The editor package (`@automata/editor`) is core, and core never imports an extension (Plus port, P-D1 B). So the five
editors live in one new private package beside the extensions they edit:

- `extensions/editors`, `@automata/extension-editors`, `private: true`, MIT.
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

- The rail lists a registered editor only when the game's editor list names it, so a game with no sounds never sees
  Audio. With no readable list, it lists every registered editor (the person still needs a way in).
- The leftover "Plus build (EDS.P)" comment in `create-suite.ts` goes. The suite's test that no card says "Plus" stays.
- The editor list's `LABELS` keep the five names, so a list that names one on a page without it still reads well.
- The sample game (`platformer.editors.toml` and its files) gains a small file for each of the five, so the page opened
  without a checkout shows them working.

## 8. Not in this work (for the Owner to decide)

The suite has no editor for these. Each would be its own spec. None is built unless the Owner asks.

1. **2D sprites and animation.** Art comes in by import (Add tiles), but nothing draws or animates a 2D sprite.
2. **Menus and HUD.** The `ui-screens` kit is code; there is no screen or HUD layout editor.
3. **Item and enemy tables.** The Tuner edits single numbers; there is no table of items or enemies with their stats.
4. **Default controls.** Players can rebind in the game; nothing edits the game's default bindings.

## 9. Checks

- Each editor: unit tests for its model (file to sentences and back), DOM tests for its regions (jsdom, Testing Library),
  and one Chromium layout test at phone and iPad sizes.
- The package joins `pnpm check` (lint, typecheck, boundaries, style, knip, unit tests).
- A journey on the sample game per editor: open it from Home, change one thing, see the file change, Undo.
