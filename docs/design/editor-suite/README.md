# Editor suite mockups

Twenty-two screens for the editors that sit beside the 2D and 3D level editors: Sequence, Tuner, Writer, Studio,
Schematic, Audio and Feel, a Review desk, and the shell, dialogs and portrait views they share. Like the level editor
mockups they are written once as scene-kit trees and rendered both as HTML and as Figma frames, so the artifact and the
Figma file cannot drift apart. They are review material, not production code: nothing here ships.

- Figma file: [Automata Editors](https://www.figma.com/design/8H4vY5xZj7xIedrvDdwg2d), pages `Suite · Shell`,
  `Suite · Sequence`, `Suite · Tuner`, `Suite · Writer`, `Suite · Studio`, `Suite · Schematic`, `Suite · Audio`,
  `Suite · Feel` and `Suite · Portrait`.
- Source: [The Last Light editor suite spec](https://github.com/mcthaydt/PixiJS3D_Experiment_001/blob/main/docs/superpowers/specs/2026-10-16-editor-suite-design.md)
  and the code under `editor/src/client` and `src` in that repository (`main` at `92e6704`, 2026-10-22).

## Which editors there are

The audit behind the mockups is `inventory.mjs`; the gallery renders it as a table. In short:

| Editor | Edits | Lives in The Last Light | AF keeps it | Home in AF |
| --- | --- | --- | --- | --- |
| Sequence | Shots, lens, ease, caption lines, sound and light keys of a cutscene | `src/scenes/<id>/cutscenes.ts` | Yes | `cutscenes` extension |
| Tuner | A scene's tunables, bounded, with a fairness measure | `src/scenes/<id>/systems.ts` | Yes | `systems`, with `feel` and `audio-synth` rows |
| Writer | Lines, dialogue graphs, beats, hint ladders | `story.ts`, `dialogues.ts`, `beats.ts`, `help.ts` | Yes | `narrative` extension |
| Studio | A character's turnaround, outfits, sliders, poses, pipeline gates | `characters/*.json`, `docs/art/*/character.json` | Yes | `pipelines` extension (character pipeline) |
| Schematic | A scene's puzzle chain and its agents | `puzzle.ts`, `puzzle.json`, `systems.ts` | Yes | `puzzle` and `systems` extensions |
| Audio | Cue recipes, event mapping, mix | A game board (`src/audio/board.ts`) | Yes, as a new editor | `audio-synth` extension |
| Feel | The feel table: event by channel | A game board (`src/feel/board.ts`) | Yes, as a new editor | `feel` extension |
| Levels | Sectors, portals and props | `blockout.json` | Already designed | 3D level editor (ED3D), 2D level editor (ED2D) |
| Review desk | Nothing; shows a change set's evidence and gates | Specified, not built | Yes | Editor shell |
| Export and import | A scene as scene-interchange v2 TOML or JSON, by plan | `interchange.ts` | Yes | Editor shell |
| Shell | Editor picker, change set, checks, gates, Ask, Undo, Ship | `main.ts`, `editor-api.ts`, `bridge.ts` | Rebuilt on AF ports | Editor shell |

Two ideas carry over from The Last Light and shape every screen. Edits keep the span of the literal they change, so a
value that is computed rather than written down goes to Ask (Claude proposes a diff, checked before it is written).
And gates are shown but never recorded by an editor: the owner approves on GitHub, and the Review desk links there.

There is no editor code for sprite or animation frames, tilesets, materials, entities, prefabs, particles or a UI
composer. The Studio's poses cover part of the first; the level editors cover the next three; particles were cut from
the plan (PD-5); the UI composer has neither code nor plan.

## Files

- `data.mjs`: the sample data, read from the Bay scene (arrival cutscene, tunables, `bay.c1` dialogue, the shutter
  puzzle). Names, times, values, bounds, line texts and gate names are the files'. Measured results, check results,
  token counts, lock states and the character art are illustrative: the mockups do not run the game.
- `parts.mjs`: the suite's building blocks (shell, rail, tab bar, lanes, ruler, graph nodes, charts, pipeline, cards)
  and the art helpers (`artParts`). They compose the 2D parts in `../editor-2d/parts.mjs`.
- `screens-*.mjs`, `screens.mjs`: the screens, each `{ id, page, name, w, h, note, build(S, P, Q, A) }`, grouped by
  editor.
- `inventory.mjs`, `gallery.mjs`: the audit and the review page published as an artifact.
- `build.mjs`: the commands below. The scene kit it imports is `../editor-kit/scene/`.

```sh
node build.mjs list                              # screens, pages and sizes
node build.mjs screen seq-timeline out.html      # one screen at 1:1, for a screenshot
node build.mjs gallery out.html [--pr <url>]     # the review page for the Artifact tool
node build.mjs figma-collection                  # `use_figma` code that adds the Editor Suite colour variable (once)
node build.mjs figma-parts count                 # the chunks the suite parts are stored in, with length and hash
node build.mjs figma-parts 1                     # `use_figma` code that stores chunk 1 on the _kit page (once per chunk)
node build.mjs figma seq-timeline 0              # `use_figma` code that renders one screen at x = 0 on its page
```

`figma` code loads the kit (`scene-kit`), its Figma runtime (`figma-runtime`), `parts-2d` and the suite chunks
`parts-suite-1`, `parts-suite-2` and so on from text nodes on the `_kit` page. Keep the suite chunks outside the 3D
lane's `module:3x` range. Chunks are under 38,000 characters because a `use_figma` call carries 50 KB. After storing a
chunk, compare the length and hash it returns with `figma-parts count`.

The suite adds one variable, `color/ed/feel` (the Feel editor's pink), in a collection named `Editor Suite` beside the
Editor Kit variables. Everything else binds to the Editor Kit.

The screens in the Figma file use the 1194 × 834 and 834 × 1194 shells the level editors use: top bar 52, rail 56 (an
editor switcher with all nine editors), panels 264, inspector 320 and a dock on landscape; a compact top bar, a
64 px tab bar with the same nine editors, sheets and drawers on portrait. Touch targets are 44 px and primary actions
48 px.

Where each frame sits on its page (left edge, in px; every frame's top is 0):

| Page | Frames |
| --- | --- |
| `Suite · Shell` | suite-home 0, review-desk 1294, ask-diff 2588, ship-dialog 3882, interchange 4702 |
| `Suite · Sequence` | seq-timeline 0, seq-portrait 1294 |
| `Suite · Tuner` | tuner-sliders 0, tuner-fairness 1294 |
| `Suite · Writer` | writer-lines 0, writer-dialogue 1294 |
| `Suite · Studio` | studio-turnaround 0, studio-outfits 1294, studio-poses 2588 |
| `Suite · Schematic` | schematic-chain 0, schematic-agent 1294 |
| `Suite · Audio`, `Suite · Feel` | audio-cues 0, feel-matrix 0 |
| `Suite · Portrait` | tuner-portrait 0, writer-portrait 934, studio-portrait 1868, review-portrait 2802 |

A screen's `build` is sent to Figma as source text, so it may use only its four arguments (`S`, `P`, `Q`, `A`) and
its own locals. A helper declared at module level renders in the HTML and then fails in Figma.
