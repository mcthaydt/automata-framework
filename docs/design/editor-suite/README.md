# Editor suite mockups

Thirty-two screens for the editors that sit beside the 2D and 3D level editors: Sequence, Tuner, Writer, Studio,
Schematic, Audio and Feel, a Review desk, and the shell, dialogs and portrait views they share. Like the level editor
mockups they are written once as scene-kit trees and rendered both as HTML and as Figma frames, so the artifact and the
Figma file cannot drift apart. They are review material, not production code: nothing here ships.

The Owner accepted every screen except the character editor on 2026-10-23 ("everything is perfect but the character
one"). Since then the accepted screens keep their layout and only their data changed: they edit AF content files
(`content/scenes/<id>/*.toml`, `content/tuning.toml`) instead of The Last Light's TypeScript, and their gate pills
come from the game's editor list. The Studio was redesigned, and one FloorFifty screen shows a second game. The Owner accepted the Studio's look the
same morning and asked for an IK rig and animation, so the Studio gained Pose by hand and Animate; a States page, an
Export screen, three more portraits and the nine look fixes the audit flagged followed. `LATEST` in `changes.mjs`
lists those since the Studio's acceptance. The Owner signed off all 32 screens on 2026-10-23 20:35 UTC ("the mockups
are signed of tell them", recorded as `SIGNED_OFF`), so the gallery shows that list as signed off.
`changes.mjs` lists each change in one line; the gallery shows them before and after.

- Figma file: [Automata Editors](https://www.figma.com/design/8H4vY5xZj7xIedrvDdwg2d), pages `Suite · Shell`,
  `Suite · Sequence`, `Suite · Tuner`, `Suite · FloorFifty`, `Suite · Writer`, `Suite · Studio`, `Suite · Schematic`,
  `Suite · Audio`, `Suite · Feel`, `Suite · States` and `Suite · Portrait`.
- Source: [The Last Light editor suite spec](https://github.com/mcthaydt/PixiJS3D_Experiment_001/blob/main/docs/superpowers/specs/2026-10-16-editor-suite-design.md)
  and the code under `editor/src/client` and `src` in that repository (`main` at `92e6704`, 2026-10-22); its
  `editor.manifest.json` gives each file's editor and gates. FloorFifty (`SNEKPRTY/FloorFifty` at `ee5d44e`) gives the
  second game's `content/tuning.toml`.

## Which editors there are

The audit behind the mockups is `inventory.mjs`; the gallery renders it as a table. In short:

| Editor | Edits | AF content file (from The Last Light) | Gates | AF keeps it | Home in AF |
| --- | --- | --- | --- | --- | --- |
| Sequence | Shots, lens, ease, caption lines, sound and light keys of a cutscene | `content/scenes/*/cutscenes.toml` (`cutscenes.ts`) | C-G1 | Yes | `cutscenes` extension |
| Tuner | A game's tunables, bounded, with a fairness measure | `content/scenes/*/tuning.toml` (`systems.ts`); FloorFifty `content/tuning.toml` | S-G2; none | Yes | `systems` extension |
| Writer | Lines, dialogue graphs, beats, hint ladders | `content/scenes/*/story.toml`, `dialogues.toml` | N-G1 | Yes | `narrative` extension |
| Studio | A character's look and poses, edited on the character | `content/characters/*.json`, `content/art/*/character.json` | G1, G6; G1 to G7 | Yes | `pipelines` extension (character pipeline) |
| Schematic | A scene's puzzle chain and its agents | `content/scenes/*/puzzle.toml`, `agents.toml` | P-G1; S-G1, S-G3 | Yes | `puzzle` and `systems` extensions |
| Audio | Cue recipes, event mapping, mix | `content/audio/cues.toml` (a game board) | Q-AUD | Yes, as its own editor | `audio-synth` extension |
| Feel | The feel table: event by channel | `content/feel/effects.toml` (a game board); FloorFifty `juice.toml` | Q-FEEL; none | Yes, as its own editor | `feel` extension |
| Levels | Sectors, portals and props | `content/levels/*/blockout.json` | E1 to E4, LOOK-G1 | Already designed | 3D level editor (ED3D), 2D level editor (ED2D) |
| Review desk | Nothing; shows a change set's evidence and gates | Specified, not built | Yes | Editor shell |
| Export and import | A scene as scene-interchange v2 TOML or JSON, by plan | `interchange.ts` | Yes | Editor shell |
| Shell | Editor picker, change set, checks, gates, Ask, Undo, Ship | `main.ts`, `editor-api.ts`, `bridge.ts` | Rebuilt on AF ports | Editor shell |

The content paths are proposed: The Last Light keeps these values in TypeScript today, and AF's content spec (M1, §3.4)
puts tunables in `content/tuning.toml` with `UPPER_SNAKE` names, which FloorFifty already does. Which editor opens a
file and which gates a change reopens come from the game's editor list (`D.editors`, a proposed
`content/editors.toml` that follows The Last Light's `editor.manifest.json`); an editor never invents a gate, and a
game with no gates (FloorFifty) says so.

Audio and Feel are their own editors by the Owner's decision (2026-10-23). The Last Light's suite spec §6.3 had put
cues and feel into the Tuner as rows under Q-AUD and Q-FEEL; the gates stay, the editors move out.

Two ideas carry over from The Last Light and shape every screen. Edits change one value in the file and keep the rest
of it as written, so a value that is computed rather than written down goes to Ask (Claude proposes a diff, checked
before it is written). And gates are shown but never recorded by an editor: the owner approves on GitHub, and the
Review desk links there.

The Studio is the character editor the Owner asked to rework. The character is the picker: tap a part to open its
fields, drag the hem to change a length, drag sideways to turn, tap an outfit or a pose under the stage. Only the
picked part's fields show, the rest are folded rows, the pipeline is a bar that opens as a drawer, and a new character
starts from a starter already on the stage. It uses the same shell as every editor (change set, checks, gates, Ask,
Undo, Ship). `Q.studioView` and `Q.studioPortrait` in `parts.mjs` build its screens.

There is no editor code for sprite or animation frames, tilesets, materials, entities, prefabs, particles or a UI
composer. The Studio's poses cover part of the first; the level editors cover the next three; particles were cut from
the plan (PD-5); the UI composer has neither code nor plan.

## Files

- `data.mjs`: the sample data, read from the Bay scene (arrival cutscene, tunables, `bay.c1` dialogue, the shutter
  puzzle) and FloorFifty's `content/tuning.toml`, with the proposed AF paths and both games' editor lists. Names,
  times, values, bounds, line texts and gate names are the files'. Measured results, check results,
  token counts, lock states and the character art are illustrative: the mockups do not run the game.
- `parts.mjs`: the suite's building blocks (shell, rail, tab bar, lanes, ruler, graph nodes, charts, pipeline, cards)
  and the art helpers (`artParts`). They compose the 2D parts in `../editor-2d/parts.mjs`.
- `screens-*.mjs`, `screens.mjs`: the screens, each `{ id, page, name, w, h, note, build(S, P, Q, A) }`, grouped by
  editor.
- `inventory.mjs`, `gallery.mjs`: the audit and the review page published as an artifact.
- `changes.mjs`: what changed since the Owner's approval, one line per screen, shown before and after in the gallery.
- `build.mjs`: the commands below. The scene kit it imports is `../editor-kit/scene/`.

```sh
node build.mjs list                              # screens, pages and sizes
node build.mjs screen seq-timeline out.html      # one screen at 1:1, for a screenshot
node build.mjs gallery out.html [--pr <url>] [--before <dir>]   # the review page for the Artifact tool
node build.mjs figma-collection                  # `use_figma` code that adds the Editor Suite colour variables
node build.mjs figma-parts count                 # the chunks the suite parts are stored in, with length and hash
node build.mjs figma-parts 1                     # `use_figma` code that stores chunk 1 on the _kit page (once per chunk)
node build.mjs figma seq-timeline 0              # `use_figma` code that renders one screen at x = 0 on its page
```

`figma` code loads the kit (`scene-kit`), its Figma runtime (`figma-runtime`), `parts-2d` and the suite chunks
`parts-suite-1`, `parts-suite-2` and so on from text nodes on the `_kit` page. Keep the suite chunks outside the 3D
lane's `module:3x` range. Chunks are under 38,000 characters because a `use_figma` call carries 50 KB. After storing a
chunk, compare the length and hash it returns with `figma-parts count`.

For the before and after, check out the approved commit beside this one and pass its folder:
`git worktree add /tmp/approved 74c1f2c` then `--before /tmp/approved/docs/design/editor-suite`.

The suite adds one colour per editor (`color/ed/sequence`, `ed/tuner`, `ed/writer`, `ed/studio`, `ed/schematic`,
`ed/audio`, `ed/feel`, `ed/levels`, `ed/review`) and `color/edge/default` for graph edges, in a collection named
`Editor Suite` beside the Editor Kit variables. The values are the hues the Owner approved, so editors no longer borrow
FloorFifty's layer and phase tokens, except `ed/audio`, which is cyan (`#4ec3d6`) so it no longer equals `state/warn`
(audit M3).
Everything else binds to the Editor Kit.

The screens in the Figma file use the 1194 × 834 and 834 × 1194 shells the level editors use: top bar 52, rail 56 (an
editor switcher with all nine editors), panels 264, inspector 320 and a dock on landscape; a compact top bar, a
64 px tab bar with the same nine editors, sheets and drawers on portrait. Touch targets are 44 px and primary actions
48 px.

Where each frame sits on its page (left edge, in px; every frame's top is 0):

| Page | Frames |
| --- | --- |
| `Suite · Shell` | suite-home 0, review-desk 1294, ask-diff 2588, ship-dialog 3882, interchange 4702, interchange-export 5602 |
| `Suite · Sequence` | seq-timeline 0, seq-portrait 1294 |
| `Suite · Tuner` | tuner-sliders 0, tuner-fairness 1294 |
| `Suite · FloorFifty` | ff-tuner 0 |
| `Suite · Writer` | writer-lines 0, writer-dialogue 1294 |
| `Suite · Studio` | studio-look 0, studio-pose 1294, studio-pipeline 2588, studio-first-run 3882, studio-ik 5176, studio-animate 6470 |
| `Suite · Schematic` | schematic-chain 0, schematic-agent 1294 |
| `Suite · Audio`, `Suite · Feel` | audio-cues 0, feel-matrix 0 |
| `Suite · States` | states-code-checks 0, states-offline 1294 |
| `Suite · Portrait` | tuner-portrait 0, writer-portrait 934, studio-portrait 1868, review-portrait 2802, schematic-portrait 3736, audio-portrait 4670, feel-portrait 5604 |

A screen's `build` is sent to Figma as source text, so it may use only its four arguments (`S`, `P`, `Q`, `A`) and
its own locals. A helper declared at module level renders in the HTML and then fails in Figma.
