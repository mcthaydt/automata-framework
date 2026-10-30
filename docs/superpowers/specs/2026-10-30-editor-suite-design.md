# EDS: the editor suite (the editors beside the level editors, their shell and their shared ports)

> **Status:** Draft, review pending (Owner). Drafted 2026-10-30 (lane **editor-suite**, task EDS.0) on the editor kit, 2D and 3D editor specs' recommended defaults, open to veto. Not reviewed, not implemented: no plan for EDS.1 onward may start before this spec's review, and implementation also waits for the level editors (02, EDS section direction). Task rows: [EDS.0 to EDS.11](../../02-master-delivery-plan.md#eds-editor-suite-coordinator-decision-2026-10-23-0741z). Shared pieces are in the [editor kit spec](./2026-10-23-editor-kit-design.md); the two level editors are the [2D editor spec](./2026-10-23-editor-2d-design.md) and the [3D editor spec](./2026-10-23-editor-3d-design.md).
>
> **Why (Owner, 2026-10-23, relayed then; restated 2026-10-30):** extract The Last Light's editor suite and make it good, tablet first and web based; every editor the Owner asked for is in the plan: Sequence, Tuner, Writer, Studio (the character editor), Schematic, Audio and Feel, beside the 2D and 3D level editors, with the shell, dialogs and portrait views they share. **Audio and Feel are their own editors**, not rows of the Tuner as The Last Light's own spec §6.3 has them (decided 2026-10-23 07:54Z on the Owner's approval: a cue timeline and a channel grid do not fit a slider list). The mockups are signed off (ED.0b, Owner, 2026-10-23 20:35 UTC: "the mockups are signed of tell them"); the base 3D game is "authored in the editors" (Owner, 2026-10-23). **2026-10-30 (decision 5):** FigureBuilder (`mcthaydt/FigureBuilder` `a1f7246`) is a Studio source. **2026-10-30 (decision 7):** `games/base-3d` uses core only, and the M6 extensions are Plus, so the editors that edit M6 content are Plus and §3 decides where they live.

## 0. Sources

| Source | Revision | Used for |
|---|---|---|
| The Last Light `docs/superpowers/specs/2026-10-16-editor-suite-design.md` (§3 principles, §5 shell, §6 editors, §7 Claude, §9 contracts, §11 Owner answers) | `mcthaydt/PixiJS3D_Experiment_001` `92e6704` (2026-10-22) | The editors, the shell, Ask with a token cap, change sets, gates shown and never recorded, the byte-identical round trip |
| The Last Light `editor/README.md`, `editor/src/server/*.ts` (33 files), `editor/src/client/*.ts` (21 files), `editor/tests/*.test.ts` (29 files), `editor.manifest.json` | same | What each editor does today, the route table, the policy (allowlist, generated, never), locks, fairness before and after, Ship's compare link, interchange plan then apply; the manifest is the model for `content/editors.toml` |
| The Last Light `docs/interchange/README.md` | same | scene-interchange versions 1 and 2: provenance, plan before apply |
| FigureBuilder `src/render/figure/{genes,hair,streetwear,cast,motion}.ts`, `library/{hair,poses}.json`, `crew/crew.ts` | `mcthaydt/FigureBuilder` `a1f7246` (2026-10-28) | The 14 face sliders (`HeadShape`), the hair pieces (8 kinds, 11 library styles), the 7 lookbook stands and `fits`, the 8 garment swatch roles and `TAKES` (§6.2) |
| FloorFifty `content/tuning.toml` (35 tunables), `content/juice.toml` | `SNEKPRTY/FloorFifty` `677d456` | The second game for the Tuner and the document tests |
| Mockups: `docs/design/editor-suite/` (32 screens; `inventory.mjs`, `data.mjs`, `parts.mjs`), Figma pages `Suite · …` in [Automata Editors](https://www.figma.com/design/8H4vY5xZj7xIedrvDdwg2d), gallery [Automata Editor Suite](https://claude.ai/artifact/4vnT6mStr69Ufo9UAc4ApL) | PRs #134, #138, #141, #144 (merged); signed off 2026-10-23 20:35 UTC | Screens, regions, sizes and states (§9) |
| AF `packages/editor-3d/src/ports/ports.ts`, `app/ask-controller.ts`, `codec/patch.ts`; `packages/editor-2d/src/profiles/floorfifty-stage/stage-codec.ts`; `packages/editor-kit/src/storage/` | `main` `6aee63b` | The ports and codecs this spec merges (§4.3, §4.4) |
| AF specs: [M1 content](./2026-10-11-m1-content-design.md) §3.4 (tuning, `tuning-meta.json`); [M3](./2026-10-18-m3-3d-characters-design.md) §4.4 (figures, poses, clips, §4.4.6 what the Studio needs) and §4.6 (G5, G6); [M5](./2026-10-16-m5-saves-audio-design.md) §4.7 with ASSET.0 to ASSET.2 (sound recipes); [M6](./2026-10-16-m6-gameplay-extensions-design.md) §3 and §4 (feel, puzzle, systems, narrative, cutscenes, audio-synth); [PRODUCT](./2026-10-16-product-core-and-plus-design.md) §6 (Plus); `tooling/core-packs` (`--extra` packs private packages for Plus) | `main` `6aee63b` | The content each editor edits and who owns it |

## 1. What The Last Light's suite does today (measured)

- **One server welded to one game.** A Node server (localhost; `EDITOR_TOKEN` for the iPad over the LAN) reads the game checkout and writes only through a policy: files `editor.manifest.json` lists as editable, never generated files, gate records, `pipeline.config.json`, frozen contracts, `.claude/` or `.github/`.
- **Six editors built (P0 to P6):** cutscenes (the timeline), tuner, writer's desk, levels, studio, schematic. Audio and feel have boards inside the game (`?audio=board`, `?feel=board`) and are edited by hand (`editor-gaps.md` #68, #76).
- **Edits are literal spans of TypeScript.** The TypeScript parser finds a literal and the server rewrites only its span; anything computed goes to Ask. AF's content is TOML and JSON, so the same idea becomes span-preserving value edits of content files (§4.4).
- **Around every editor:** a change set (a git branch `edit/<title>` with checkpoint commits of only the files the editor wrote), a checks pill (the game's free pipe commands, one job per kind), gate pills (every `gates.json`, read only), Ask (one Messages API call per request, a unified diff accepted or rejected, a token cap per change set, refused over a locked tunable or a frozen line), Undo per change set (each accepted diff one step, undoing only if the file still reads what the step wrote), Ship (push, then GitHub's compare link; the editor never opens the PR itself), Export and Import (scene-interchange v2, a plan before Apply, one undo step for every file).
- **Not built there:** the Review desk (§6.7 of its spec), Ask through the Agent SDK, check streaming, undo of a created file, locks that outlive the server.
- **Not reusable as is:** the server's commands, gates and frozen fixtures are The Last Light's; the client has no touch or Pencil layer beyond 44 pt targets; every editor reads TypeScript.

## 2. Scope

In: one suite app that mounts nine editors on one shell, the ports they share, the game's editor list, and the free and Plus homes of each editor.

**The nine editors** are the seven beside the level editors and the two level editors. The rail has nine entries, as the mockups draw it: the seven, one **Levels** entry that opens the 2D or the 3D level editor by the file's profile, and **Review**, which edits nothing.

| Editor | Edits (contract owner of the content) | Default glob in `content/editors.toml` | Tier and home | Rows |
|---|---|---|---|---|
| **Tuner** | Core tunables: `content/tuning.toml`, bounds from the compiler's `tuning-meta.json` (M1 content §3.4); a game's tuning layers checked by `checkTuningLayer` (the `[tuning]` table of FloorFifty's `modes/*.toml`; the rest of those files is not the Tuner's). With `systems` installed, also `SystemsDef` tunables (M6.7), through a Plus source (§4.6) | `content/tuning.toml`, `content/modes/*.toml` | Free, `packages/editor-suite`; the `systems` source and the fairness measure are Plus | EDS.4a, EDS.4b |
| **Studio** | `figure`, `figure-pose` and `figure-clip` content and the figure library (swatches, gaits, hair, headwear, items, rig limits) of `figures` (M3.5, M3.6; free, M3R-D20) | `content/figures/*.toml`, `content/figure-poses/*.toml`, `content/figure-clips/*.toml`, `content/figure-library/*.toml` (proposed; M3.5 and M3.6 own the folders) | Free, `packages/editor-suite`; the gate bar reads the Plus `pipelines` gates G5 and G6 when the game declares them | EDS.9a to EDS.9d |
| **Audio** | Core sound recipes rendered to WAV at build (ASSET.2; format owned by ASSET.0). With `audio-synth` installed, its cues, the event-to-cue map and the mix (M6.10), through Plus panels (§4.6) | `content/sounds/*.toml` (proposed; ASSET.0 owns it); `content/audio/cues.toml` (proposed; M6.10a owns it) | Free for recipes, `packages/editor-suite`; the `audio-synth` panels are Plus | EDS.5a, EDS.5b (proposed split, §14) |
| **Feel** | `FeelDef`: `[limits]` and `[[entry]]` rows by channel (camera, pose, visual, word, haptic, audio) of `feel` (M6.1) | `content/feel.toml` (M6 §4.1) | Plus, `automata-plus/packages/editor-plus` | EDS.3 |
| **Writer** | `LineRecord`s, `DialogueGraph`s, beats, canon and hint ladders of `narrative` (M6.8); a line's text in the locale content (PRODUCT.L), because a line is a key in the sim | `content/scenes/*/story.toml`, `content/scenes/*/dialogues.toml` (proposed; M6.8a owns them); `content/messages/*.json` for the text | Plus, `editor-plus` | EDS.6 |
| **Schematic** | `PuzzleDef` of `puzzle` (M6.6) and `SystemsDef` agents and rules of `systems` (M6.7) | `content/scenes/*/puzzle.toml`, `content/scenes/*/agents.toml` (proposed; M6.6a and M6.7a own them) | Plus, `editor-plus` | EDS.7 |
| **Sequence** | `CutsceneScript` of `cutscenes` (M6.9): shots, lens, ease, actors, caption line keys (narrative), sound and light keys | `content/cutscenes/*.toml` (M6 §4.8) | Plus, `editor-plus` | EDS.8 |
| **Levels 2D** | `*.af2d.json` and its AF content export; FloorFifty stages (ED2D §6, §10) | as ED2D | Free, `packages/editor-2d`, mounted (§4.7) | ED2D rows, EDS.2d |
| **Levels 3D** | `af-sector/1`, The Last Light's `blockout.json` and `facility.json` (ED3D §4.5, §4.6) | as ED3D | Free, `packages/editor-3d`, mounted (§4.7) | ED3D rows, EDS.2d |

The globs are defaults the suite's game template writes; a game's own `content/editors.toml` is the truth (§4.2). Where the mockups show another path (`content/feel/effects.toml`, `content/characters/*.json`, `*.clips.json`), the content's owning spec wins and the screens keep their layout (EDS-D17).

The shell around them (all free): the editor switcher, Suite home, the change-set, checks and gate pills, Undo, the Ask diff dialog, Ship, the Review desk, Export and Import.

Out: running the game inside the editor, except the Sequence preview through an optional port (EDS-D14); a frame-by-frame sprite editor, particles (PD-5), a UI composer (no code, no plan; `inventory.mjs` `NO_EDITOR_YET`); paid pipeline stages (the Studio's mockup row "request a new pose", whose paid run waited for G7, is not built: M3 is procedural with no paid stage, so a pose is authored by hand on the rig); recording a gate; editing The Last Light, FloorFifty or FigureBuilder (decision 8: fixtures are converted AF-side with their source commit).

## 3. Decisions

| ID | Decision | Default and why |
|---|---|---|
| EDS-D1 | **Home: a new private package, `packages/editor-suite`** (Svelte 5, like the kit and both level editors) | The shell, the switcher, Home, the dialogs, Review, interchange, the free editors (Tuner, Studio, Audio) and the level-editor mounts. A headless `./core` entry (editor list, workspace policy, change-set journal, interchange; no Svelte, DOM or clock) and a `./node` entry (the Node adapters, EDS.1d) for `automata editor`. Private like the kit (EDK-D1): it is served as a built app, never imported by a game. |
| EDS-D2 | **The shared ports and content documents live in `editor-kit`** (headless entries `./ports` and `./documents`); **this spec owns their shapes**; ED3D's `ports.ts` moves onto them in EDS.1b and is deleted | The kit is the only package below `editor-2d`, `editor-3d` and the suite (EDK §3: editors never import each other). In the suite they would make a ring (the suite mounts the 3D editor, the 3D editor needs the ports). One contract owner: this spec; the kit spec gets a dated note naming it. |
| EDS-D3 | **A Plus-only editor lives in automata-plus, in one package, `packages/editor-plus`,** as suite editors registered with `defineSuiteEditor` against the free suite's ports and contribution points. Its build composes the free suite and the Plus editors into one static app (`createSuite({ editors })`), published to the Plus registry as built files; `automata editor` serves that build instead of the free one when the game depends on it | Plus gets the free suite as source through `tooling/core-packs --extra` (editor-kit, editor-2d, editor-3d, editor-suite are private and pack their source), so a buyer never installs a private AF package. One package keeps Svelte out of the extension packages (they stay renderer-free and import no editor); each Plus editor imports its content schema from its extension's package, so the schema has one owner. **Rejected:** a runtime plugin ABI loading Plus modules into a prebuilt free suite (needs a shared Svelte runtime and a published suite API; no consumer before 1.0), and an `./editor` entry inside each extension package (Svelte in seven packages, seven builds). The free suite never imports Plus. |
| EDS-D4 | **Tiers:** free suite = shell, Review, interchange, Tuner on core tunables, Studio, Audio on core recipes, the two level editors; Plus = Feel, Writer, Schematic, Sequence, the Tuner's `systems` source, the Audio editor's `audio-synth` panels | Decision 7: Plus content gets Plus editors; core content gets free ones. `figures` is free (M3R-D20) and ASSET.2's recipes are core, so base-3d is authored in the suite for its tuning, sounds, figures, poses, clips and levels (GAME-3D.1k reads this row; its feel, dialogue and cutscenes stay game code). |
| EDS-D5 | **Two contribution points, no more:** `tuner.source` (a source of bounded tunables and an optional measure) and `audio.panel` (a tab in the Audio editor) | Each has a consumer (the `systems` tunables and fairness, EDS.4b; the `audio-synth` cue map and mix, EDS.5b). A third point is added with its first consumer, not before. |
| EDS-D6 | **The game's editor list is `content/editors.toml`, format `af-editors/1`**, schema and loader in `editor-suite/core` (EDS.1c) | The Last Light's `editor.manifest.json` as TOML in the game's content folder: file rows (glob, editor, modes, gates, checks), checks, gates, generated and never globs (§4.2). The compiler skips it (it is not a content document; the loader warns if the content compiler ever reads it). |
| EDS-D7 | **Every file row names its gates, an empty list included**; a missing `gates` key is a schema error | "FloorFifty declares no gates and says so" (EDS.1c). An editor never invents a gate, and silence never reads as "no gates". |
| EDS-D8 | **Checks run in two phases:** `before` checks run on the candidate text and a failure refuses the write; `after` checks run on the written change set and turn the pill red without undoing anything. The content compile of the touched file is always a `before` check; a game command defaults to `after` | The Last Light refused a blockout edit its validator failed (422) and ran lints after; AF keeps both behaviours and lets the game choose per check. A frozen line (The Last Light's pinned act-one text) is a game's `before` check, not a suite feature. |
| EDS-D9 | **Ask edits one document per proposal**: the provider returns the whole document as it would read (ED3D's `Proposal.text`), the suite diffs it, runs the `before` checks and shows the diff; the token cap is per change set and only the person raises it | ED3D.10a's controller already works this way. A multi-file request (rename a speaker everywhere) is out of v1: Ask says so. Without a provider, Ask is off, never an error. |
| EDS-D10 | **Ship pushes the branch and opens a draft PR with the user's `gh`**; without `gh` or its login it returns the compare link, as The Last Light does | 02 EDS.2c and EDS.1d. The description is drafted from the changes, the checks and the gates, and the person edits it first. |
| EDS-D11 | **The second-game rule** (§8): no editor names a game, scene, gate, check or path; each editor's acceptance edits two games' content | 02 EDS.11. Enforced by an architecture test over the suite's and `editor-plus`'s sources, like ED2D's G-s. |
| EDS-D12 | **Mounting: the suite owns the one `EditorShell`;** each editor, the two level editors included, exports a `SuiteEditor` (regions as snippets, its session factory) from a `./suite` entry; sessions outlive their views | No nested top bar; the level editors' own app roots keep working on the same surfaces; switching editors keeps selection and undo because they live in the session, not the component (EDS.2d). |
| EDS-D13 | **The Studio draws figures with `render-pixi3d`'s `figure` view** (M3.5d) on the vendored `@pixi/3d` | The Studio must show the figure as the game draws it (procedural meshes on Endesga 64, decision 6). This differs from ED3D-D6 (the 3D level editor's own flat viewport) on purpose: a sector plan does not need the game's renderer, a figure does. |
| EDS-D14 | **A `Preview` port, optional,** shows a game frame for the Sequence (and the Tuner's "play here") when `automata editor` runs beside the game's dev server; without it the editor shows its own diagram and the preview says "not connected" | The mockups' "bridge down" state (`states-offline`). The port's game side is the Plus `debug` driver (M6.2), so its adapter is Plus; the shape is here. |
| EDS-D15 | **scene-interchange v2 in AF bundles content values, with provenance as file path and key path** (not spans), owned by the suite's `./core` | AF content is already data, so export is the listed files' values grouped by editor section, and import is a plan of value edits through §4.4's documents. The Last Light's semantic v2 document is the shape's model; its TypeScript provenance is not needed. |
| EDS-D16 | **FigureBuilder's additions follow the accepted Studio patterns:** face sliders as folded groups in the head's fields, hair as a style picker with its pieces listed, stands as chips beside the poses, garment colours grouped by swatch role; no new screen | ED.0b's Studio is accepted; these fit its "tap a part, only its fields show" rule. Their screenshots go to the Owner in EDS.9a for visual acceptance (pending, never ticked by an agent). |
| EDS-D17 | **Where the mockups and a content owner disagree on a path or a format, the owner wins** and the screen keeps its layout | The mockups predate M3's TOML collections and M6's file names (they show `content/characters/*.json`, `content/feel/effects.toml`). |
| EDS-D18 | **Tuner locks live in the suite session**, per change set, never in a file; a tunable's unit and note come from its trailing or preceding TOML comment | The Last Light keeps locks in server memory. AF's `tuning.toml` has no unit or note field; adding one is a content-spec change request, not made here. |
| EDS-D19 | **Undo:** each document keeps its kit `History`; the top bar's Undo acts on the active editor's document; an Ask diff is one step of its document; an import is one change-set step that undoes every file it wrote or none; starting or closing a change set clears every history | The Last Light's per-change-set rules on the kit's per-document history. A step undoes only if the document still reads what it wrote (the kit's mtime guard covers the file underneath). |

## 4. Ownership and architecture

Dependency direction:

```
games (content/editors.toml) ─ read by ─► automata editor (packages/cli) ─► editor-suite/node
editor-plus (automata-plus) ─► editor-suite ─► editor-2d, editor-3d ─► editor-kit ─► @mcthaydt/automata-ui (geometry), Svelte
                    │                  └──────────────────────────────► editor-kit (./ports, ./documents)
                    └─► the Plus extensions' schemas (feel, narrative, puzzle, systems, cutscenes, audio-synth)
editor-suite ─► figures, render-pixi3d (Studio), content (tuning-meta, compile of one file)
```

`editor-kit` never imports an editor; the level editors never import the suite; the suite never imports `editor-plus` or a Plus package.

```
packages/editor-suite/
  src/core/        editors.schema.ts, editor-list.ts, workspace-policy.ts, change-set-journal.ts, interchange/   headless
  src/node/        disk workspace, git change set, checks runner, gates reader, Ask (EDS.1d)                      Node only
  src/shell/       Suite.svelte, switcher, Home, pills, Ask dialog, Ship, Review desk, interchange dialogs
  src/editors/     tuner/, studio/, audio/        one folder per free editor, each a SuiteEditor
  src/testing/     fakes of every port, the two games' fixtures (§12)
```

| Contract | Owner | Consumers |
|---|---|---|
| Port shapes (§4.3), `SuiteEditor`, contribution points (§4.6) | This spec; code in `editor-kit/ports` | editor-2d, editor-3d, editor-suite, editor-plus |
| Content documents (§4.4) | This spec; code in `editor-kit/documents` | every editor; ED2D's FloorFifty codec and ED3D's `patchJson` move onto it (EDS.1a) |
| `af-editors/1` (§4.2) | This spec; code in `editor-suite/core` | the suite, the Node adapters, the `create-game` template |
| scene-interchange v2 for AF (§4.8) | This spec; `editor-suite/core/interchange` | the shell's Export and Import |
| Every content schema an editor edits | Its milestone spec (§2's table) | the editor imports it; never copies it |
| Shell geometry, history, storage, widgets, gestures | Kit spec | everything above |

### 4.1 `SuiteEditor`

```ts
interface SuiteEditor<S> {
  readonly id: string                          // 'tuner', 'studio', 'feel', 'levels-2d', ... the id editors.toml names
  readonly label: string; readonly icon: IconName; readonly hue: string   // the `color/ed/*` token
  /** Opens the files of one editor-list row group for a scene (or the whole game); never throws: a bad file is a state. */
  open(files: readonly WorkspaceFile[], ports: SuitePorts): Promise<S>    // S: the editor's session (documents, History, Selection, view state)
  readonly regions: SuiteRegions<S>            // Svelte snippets: panel, canvas, inspector, dock?, status?, tools? (top bar, right of the suite pills)
  readonly contributions?: readonly ContributionPoint[]   // the points this editor offers (§4.6)
}
function defineSuiteEditor<S>(editor: SuiteEditor<S>): SuiteEditor<S>
function createSuite(options: { editors: readonly SuiteEditor<unknown>[]; contributions?: readonly Contribution[] }): Suite
```

An editor id the list names but no installed editor provides opens Home with that row marked "editor not installed" and the package that provides it (§11). Two editors with one id fail `createSuite` at build time.

### 4.2 The game's editor list (`content/editors.toml`, `af-editors/1`)

```toml
format = "af-editors/1"
scenes = "content/scenes/{scene}/"        # optional: the folder whose {scene} names the scene picker lists

[[file]]
glob = "content/tuning.toml"
editor = "tuner"
modes = ["edit", "ask"]                   # edit: direct value and structure edits; ask: Claude may propose a diff
gates = []                                # required, possibly empty (EDS-D7)
checks = ["content", "game-check"]

[[file]]
glob = "content/scenes/{scene}/puzzle.toml"
editor = "schematic"
modes = ["edit", "ask"]
gates = ["P-G1"]
checks = ["content", "puzzle-validate"]

[[check]]
id = "puzzle-validate"
run = ["automata", "pipe", "puzzle", "validate", "{scene}", "--json"]   # argv, no shell; {scene} and {path} only
when = "after"                            # before | after (EDS-D8); "content" is built in and always before
joins = []                                # generated files a passing run adds to the change set (a blockout generate)
measure = false                           # true: its --json rows are a before-and-after measure (the fairness)

[[gate]]
id = "P-G1"
name = "Puzzle design"
records = "docs/gates/**/gates.json"      # read only; the record shape is the pipelines platform's (M3.8)

generated = ["content/generated/**", "tests/generated/**"]
never = ["content/editors.toml", "package.json", ".github/**", ".claude/**", "**/gates.json"]
```

- The first `[[file]]` row whose glob matches a path wins (the mockups' `fileRow`); a file no row matches is read only, with the reason.
- `never` always includes `content/editors.toml` itself, `.git/**` and the gate records, whatever the game writes: the suite cannot widen its own allowlist, and an Ask diff cannot add a command to `run` (§11).
- `run` is argv. The Node adapter runs it in the game checkout with no shell, one job per check id, output capped at 200 KB (The Last Light's runner rules); `{scene}` and `{path}` are the only substitutions and are checked against the row's glob first.
- FloorFifty's list has `gates = []` on every row and no `[[gate]]`; the gate pill reads "No gates".

### 4.3 Ports (`editor-kit/ports`, EDS.1b)

```ts
interface SuitePorts { workspace: Workspace; changeSet?: ChangeSet; checks: ChecksRunner; gates?: Gates; ask?: AskProvider; preview?: Preview }

interface Workspace {                                     // a kit ProjectStore behind the editor list's policy
  files(editor?: string, scene?: string): Promise<WorkspaceFile[]>      // { path, editor, scene?, gates, checks, modes, writable, why? }
  read(path: string): Promise<{ text: string; mtime: number } | undefined>
  write(path: string, text: string, expected: { mtime: number } | 'absent'): Promise<WriteResult>  // kit WriteResult, plus reason 'policy'
  generated(path: string): Promise<string | undefined>   // a compiler output, read only: tuning-meta.json
}
interface ChangeSet {                                     // supersedes editor-3d ports.ts ChangeSet (current, begin, record kept)
  current(): Promise<{ title: string; branch: string; base: string } | undefined>
  begin(title: string): Promise<void>
  record(files: readonly string[]): Promise<void>
  checkpoint(message: string): Promise<{ commit: string }>
  ship(draft: { title: string; body: string }): Promise<{ branch: string; pushed: boolean; pr?: string; compareUrl: string }>
  close(): Promise<void>
  list(): Promise<readonly ChangeSetSummary[]>           // the Review desk: open change sets with files, checks, gates, tokens
}
interface ChecksRunner {                                  // supersedes editor-3d ports.ts Generator (a check with `joins`)
  declared(): readonly CheckDef[]
  run(request: { checks: readonly string[]; candidates?: readonly { path: string; text: string }[] }): Promise<CheckRun>
}
interface CheckRun { readonly id: string; result(): Promise<CheckResult[]>; cancel(): void }
interface CheckResult {
  readonly check: string; readonly status: 'pass' | 'warn' | 'fail' | 'error'
  readonly findings: readonly { path?: string; keyPath?: string; line?: number; column?: number; severity: 'error' | 'warning'; message: string }[]
  readonly measure?: readonly { id: string; label: string; value: number; threshold?: number; ok: boolean }[]
  readonly joined?: readonly string[]; readonly output: string
}
interface Gates { states(ids: readonly string[]): Promise<readonly GateState[]> }   // read only: never a write method
interface GateState { id: string; name: string; decision: 'approved' | 'rejected' | 'open' | 'unknown'; decidedAt?: string; url?: string }
interface AskProvider {                                   // supersedes editor-3d ports.ts AskProvider; Proposal is unchanged
  propose(request: { prompt: string; path: string; scope: readonly string[]; document: string; budget: number; context?: AskContext }): Promise<Proposal>
}
interface Preview { show(target: { kind: string; id: string; t?: number }): Promise<PreviewFrame | 'not-connected'> }   // optional (EDS-D14)
```

- **A missing optional port is the feature off**, never an error (ED3D §4.4): no `changeSet` → edits save to the workspace and Ship is hidden; no `gates` → the gate pill shows "Gates not readable"; no `ask` → no Ask button.
- **Merge with `packages/editor-3d/src/ports/ports.ts`** (EDS.1b): `ChangeSet` keeps its three methods with the same meaning; `Generator { command, run }` becomes a declared check with `joins` (ED3D.10b's "run by the game" rows read `CheckDef.run` for the command and call `run`); `AskProvider.propose(prompt, scope, budget, document)` becomes the request object with `path` added; `Proposal` is unchanged. ED3D's `ask-controller.ts` and `testing/fake-ask.ts` re-point to the kit, keep their tests, and `ports.ts` is deleted, so there is one owner.
- **Reopened gates** are computed by the suite, not a port: a gate is reopened when the change set touches a file whose row lists it. The pill shows each with its recorded decision; nothing records one.
- **The token budget** is the change set's: the suite keeps `{ used, cap }` in the change-set journal, passes the remainder as `budget`, refuses a request whose estimate passes it (The Last Light: characters / 3.5 plus the output cap) and records what each used.

### 4.4 Content documents (`editor-kit/documents`, EDS.1a)

```ts
type KeyPath = readonly (string | number)[]
interface ContentDocument {
  readonly path: string; readonly format: 'toml' | 'json'; readonly text: string
  value(): unknown                                         // parsed; schema validation is the editor's (it holds the schema)
  literals(): readonly { keyPath: KeyPath; span: readonly [number, number]; text: string }[]
  comments(keyPath: KeyPath): { before?: string; trailing?: string }   // the Tuner's unit and note (EDS-D18)
  edit(edits: readonly ContentEdit[]): EditResult          // all or nothing
}
type ContentEdit =
  | { keyPath: KeyPath; expected: unknown; set: unknown }  // a value: its literal's span only
  | { keyPath: KeyPath; insert: unknown; at?: number }     // a table, array item or key, laid out like its siblings
  | { keyPath: KeyPath; remove: true }
type EditResult = { ok: true; document: ContentDocument; changed: readonly (readonly [number, number])[] }
                | { ok: false; keyPath: KeyPath; reason: 'expected-mismatch' | 'unwritable-value' | 'invalid-text' | 'verify-failed'; message: string }
function openDocument(path: string, text: string): ContentDocument   // format from the extension
```

- **Rules:** an unchanged document prints byte for byte; a value edit changes only its literal's span; a number keeps its spelling when its value does not change and is printed with no exponent and at most four decimals otherwise (ED3D-b's rule); comments and blank lines survive; every edit is re-parsed and compared with the intended value before it is returned (`verify-failed` otherwise).
- **TOML** generalises the FloorFifty stage codec (`@decimalturn/toml-patch`, EDFF.1a): the stage codec keeps its stage-structure reconciliation and calls the kit for value edits. **JSON** is ED3D's `patchJson` with its scanner and layout, moved into the kit with its tests; `editor-3d/codec` re-exports or imports it.
- Tested on FloorFifty's `tuning.toml` and `juice.toml`, the AF content fixtures, the four Last Light blockouts, and a locale `messages/*.json`.

### 4.5 Change-set journal (`editor-suite/core`)

Holds, for the open change set: the files written, each write's before and after text (for the Review desk's diff and for an import's all-or-none undo), the token use, the latest check run per check id with before-and-after measures, and the session's locks. It is kept beside the kit's autosave journal in OPFS (`<branch>.journal`), so a reload restores the pills, the measures and the import undo step; it is never written to the checkout or committed.

### 4.6 Contribution points (EDS-D5)

```ts
// tuner.source: offered by the free Tuner
interface TunableSource { id: string; files(ws: Workspace, scene?: string): Promise<TunableFile[]>; measure?: string }  // `measure`: a check id with measure = true
interface TunableFile { path: string; groups: readonly { label: string; tunables: readonly Tunable[] }[] }
interface Tunable { name: string; keyPath: KeyPath; value: number | boolean | string; min?: number; max?: number; step?: number; unit?: string; note?: string; editable: boolean; why?: string }
// audio.panel: offered by the free Audio editor
interface AudioPanel { id: string; label: string; files: string; panel: Snippet<[AudioPanelContext]> }   // `files`: the editor id of its rows
type Contribution = { point: 'tuner.source'; source: TunableSource } | { point: 'audio.panel'; panel: AudioPanel }
```

The free Tuner ships the core source (`tuning.toml` plus `tuning-meta.json`); `editor-plus` adds the `systems` source and its fairness check. The free Audio editor ships the recipe panel; `editor-plus` adds Cues, Events and Mix.

### 4.7 How the level editors mount (EDS.2d)

`editor-2d` and `editor-3d` each add a `./suite` entry that wraps their existing app core as a `SuiteEditor`: the panel, canvas, inspector, dock and status snippets they already pass to `EditorShell`, and a session made from the same controllers their own app root uses. The suite passes them its ports; ED3D's checks panel and Ask read the suite's `checks` and `ask`, and the 2D editor's Export keeps its own targets. Their standalone apps stay (ED2D's Home, ED3D's app) and are what `automata editor --editor levels-2d` would serve alone. Selection, undo and the view's camera live in the session, so switching to Tuner and back restores them (EDS-k).

### 4.8 scene-interchange v2 for AF (EDS-D15)

```ts
interface InterchangeDocument {
  format: 'scene-interchange'; version: 2; scene?: string; source: { commit?: string }
  sections: Record<string, Record<string, unknown>>        // editor id → path → the file's value
  provenance?: Record<string, { path: string; keyPath: KeyPath }>   // JSON pointer into `sections` → where it is written
}
```

Export writes the open scene's listed files (or the whole game without scenes) from the change set as they are, TOML or JSON, deterministically (sorted keys, no clock unless `--stamp`). Import parses, validates the version and each section with the editors' schemas, and builds a **plan**: each value change with its diff, the gate it reopens, the checks it runs and what is refused and why (a path not in the list, a `never` path, a locked value, a schema error). Apply is enabled only on a clean plan, writes each file through `Workspace.write` with its expected mtime, and is one change-set undo step (EDS-D19). Export then import unchanged is an empty plan (EDS-p).

## 5. Ordered flows

1. **Open.** `automata editor` (ED2D.9, EDS.1d) serves the suite against a checkout; on the iPad without a server, the suite opens an OPFS workspace imported from a folder or zip (kit §4.7). The suite loads `content/editors.toml`; a missing or invalid list opens Home with the error and a "Start a list" template (§11).
2. **Home.** Lists the editors the list names for the open scene, what each edits, the change set and the gates it reopens. Tapping one opens it with its files.
3. **Change set.** The first edit with no change set asks for a title (`ChangeSet.begin`); without the port, edits save to the workspace directly.
4. **Edit.** A direct edit is a `ContentEdit` on the document; the editor's schema validates the new value; the `before` checks run on the candidate text; on pass the document is written (`Workspace.write`, mtime guarded), recorded in the change set, and the `after` checks start. On a `before` failure nothing is written and the field shows the finding (EDS-g).
5. **Ask.** A request about the selection: the provider gets the document as the person sees it, the scope and the remaining budget; the proposal's text becomes a candidate; the suite diffs it, runs the `before` checks and shows the Ask diff dialog. Accept is enabled only when the checks pass and the diff touches no locked value; Accept writes it as one undo step; Reject drops it. An edit, undo or redo while a proposal is in flight or on show drops it (ED3D.10a's rule).
6. **Checks.** The pill shows running, pass, warn or fail with the failing check one tap away; a `measure` check keeps its last result before the change set's first write as **before** and its latest as **after** (the Tuner's fairness).
7. **Gates.** The pill lists each reopened gate with its recorded decision and its link; never a button that records.
8. **Undo.** EDS-D19.
9. **Ship.** Checkpoint, push, open a draft PR (or return the compare link), with a description drafted from the journal; gates still need the owner.
10. **Review desk.** Lists the open change sets (`ChangeSet.list`): diff before and after, checks, measures, gates with links, tokens spent. Records nothing.
11. **Export and import.** §4.8.

## 6. The editors

Each editor: what it edits, its direct edits, what goes to Ask, its checks, its states. Gates and check names are always the game's (§4.2); the ones named below are The Last Light's, as examples.

### 6.1 Tuner (free; EDS.4a, EDS.4b)

- **Edits:** `content/tuning.toml` values; the `[tuning]` tables of tuning layers (FloorFifty's modes). Bounds: inline `{ value, min, max, step }` or, for a code-owned game, `tuning-meta.json` (the compiler's output, through `Workspace.generated`); a tunable without bounds is a number box with no slider.
- **Direct:** drag a slider or type in the box, held to the tunable's bounds; a value outside is refused before the write (the content check); booleans are toggles; strings are text fields. Lock and unlock (EDS-D18).
- **Ask:** a key that is not a literal value (a table, an array) and "make the Nurse a little less punishing" requests.
- **Plus source (EDS.4b):** `systems` tunables per scene grouped as the content groups them, and the `fairness` check as the measure: rows with value, threshold, change and direction, before and after. With no measure declared the Fairness tab is absent.
- **States:** no tuning file (template offer), code-owned bounds unavailable (the compiler has not run: "Run checks to read bounds", number boxes only), locked, out of bounds refused, measure running, stale (a file changed since).

### 6.2 Studio (free; EDS.9a to EDS.9d)

- **Edits:** a figure's sliders, genes, skin, gait, hand, outfits (garments and their fields), default outfit, hair; `figure-pose` files; `figure-clip` files; library entries only through "Copy to this figure" (a library edit is the library file's own row, read only by default).
- **Look (EDS.9a):** tap a part to open its fields (only the picked part's fields show; the rest are folded rows); drag a hem to change a length; drag sideways to turn; outfits under the stage; a new figure starts from a starter on the stage, never an empty form (`studio-first-run`).
- **FigureBuilder additions (EDS-D16; not in the ED.0b mockups):**
  - **Face, 14 sliders** (`HeadShape`, 0 to 1, 0.5 average), in the head's fields as five folded groups: Structure (`width`, `jaw`, `chin`), Cheeks (`cheekHeight`, `cheekWidth`), Nose and lips (`bridge`, `nose`, `lips`), Brows (`browArch`, `browWeight`, `browHeight`), Lids (`crease`, `hood`, `liner`). Defaults are `DEFAULT_HEAD`'s; a value left at its default is not written.
  - **Hair:** a style picker over the hair library (11 styles at `a1f7246`), and for an inline style its pieces as a list (`scalp`, `rows`, `tail`, `fall`, `bun`, `sweep`, `block`, `edges`) with each piece's fields; a library style is read only with "Copy to this figure".
  - **Stands:** the 7 lookbook stands (`handOnHip`, `thumbsInPockets`, `kangarooPocket`, `armsCrossed`, `handInPocket`, `hipAndPocket`, `handInJacketPocket`) as chips beside the poses; a stand the outfit does not suit (FigureBuilder's `fits`: a placed hand finds no opening) is shown disabled with the reason and its fallback. Stands arrive as `figure-pose` content with a fit check (a change request to M3.6b, which already matches `hands-on-hips` against `handOnHip`).
  - **Garment roles:** a garment's swatch fields grouped by role (`main`, `rib`, `inside`, `trim`, `stitch`, `sole`, `hardware`, `lens`), each swatch picker filtered by the role's `TAKES` (a trim takes trim, main and hardware).
  - Each needs M3.5 to carry the field (M3.0A); a field M3.5 does not extract is not shown, and the gap is a change request to M3, not a Studio-only format.
- **Pose by hand (EDS.9b):** handles on the hands, feet, hips, chest and head, a pole per knee and elbow, a look-at target; each drag calls `figures.solve` (S7-Q8: at most 0.1 ms) and shows a handle out of reach or at a limit in amber with the clamped joints; pin a hand or foot; mirror; save a `figure-pose`.
- **Animate (EDS.9c):** keys at the playhead on a timeline laid out like Sequence's; eases (`step`, `linear`, `in`, `out`, `inOut`, Bézier); loop, mode and mask pickers; markers and cues rows; scrub and play through `sample` and `evaluate`, stepped at the gait's pose rate with a Smooth preview; onion skins and the hand's path.
- **Pipeline bar (EDS.9d):** the gates the list names for the figure's files (G5 sheet and G6 install from the Plus `pipelines`) in a drawer with their decisions and a link to the review sheet; stale stages from the pipeline's status check; no paid stage exists to run. Without declared gates the bar says "No gates".
- **Ask:** "a sign-the-ledger pose" proposes a `figure-pose` file; anything a compile check refuses stays unwritable.
- **States:** no figure (starter offer), a figure that fails its compile checks (opens; Checks lists them; the stage draws the last valid build), out of reach, at a limit, a stand that does not fit, 3D context lost (the fields keep working; the stage shows a recover action).

### 6.3 Audio (free recipes, Plus panels; EDS.5a, EDS.5b)

- **Recipes (EDS.5a, free):** each sound a recipe of voices (tones swept between two pitches, filtered noise, start and length), as ASSET.0's format defines it; edit a voice, audition it through the same render the build uses (ASSET.2), see the rendered size against the budget. Audition is presentation only and needs a user gesture to unlock audio (kit and M5 rule).
- **Plus panels (EDS.5b):** Cues (audio-synth cue recipes, when `audio-synth` keeps its own format; if it adopts ASSET.2's, the recipe panel serves both), Events (the event-to-cue map, every event a cue or a written "none" reason), Mix (master gain, the duck rule), with `pipe audio check` (true peak, clicks, loudness) as an `after` check.
- **States:** no recipes (template), audio locked until a tap, render failed (the finding; the text is untouched), over the size budget (warn).

### 6.4 Feel (Plus; EDS.3)

- **Edits:** `content/feel.toml`: `[limits]` (shake, hit stop, flash frames and alpha) and `[[entry]]` rows: the event (`on`, a sim event id or a pattern) by the six channels.
- **Direct:** the event by channel table; a cell opens its channel's fields; a value past `[limits]` is refused before the write; a `word` takes a locale key, never a literal (M6 §4.1).
- **Previews:** reduced motion and reduced flashing beside the full preview, showing what each drops (shake, pose holds, squash, word motion, bursts; flash and flicker), from `feel`'s pure `frame()` with a fixed event list and `TestClock`-style time; no game needed.
- **Coverage:** `automata pipe feel coverage` as an `after` check: every declared event answered or given a written reason.
- **States:** no `feel` extension in the game (the rows open read only with "install feel"), an unknown event id, a pattern that matches nothing (warn).

### 6.5 Writer (Plus; EDS.6)

- **Edits:** `LineRecord`s (speaker, beat, motifs, facts; the text through the locale file), dialogue graphs (nodes, choices, stance), beats, hint ladders. A line's text is a value edit in `content/messages/<source>.json` (span-preserving JSON); other languages show "stale" after a change and are never rewritten by the Writer.
- **Lints as written:** `automata pipe narrative lint` and `dialogue lint` as `after` checks, the canon's banned words and stance bounds as `before` checks when the game declares them.
- **Views:** Lines (the screenplay order with where each is spoken), Dialogue graph (nodes by distance from the start, stance range over paths), Beats coverage, Hints.
- **States:** a line key with no text (error), a reworded line that reopens a gate (banner with the gate), a node unreachable (lint finding with Locate).

### 6.6 Schematic (Plus; EDS.7)

- **Edits:** `puzzle.toml` (facts, items, actions with conditions and effects, goal, fallback) and `agents.toml` (agents' modes, speeds, senses, transitions; rules). Direct: a condition's fact and value (of the fact's declared type), an action's seconds, its `say` key, fallback lines; anything structural through the editor's add and remove commands or Ask.
- **Views:** the lock graph from entry to goal with each hint ladder under its lock, the selected action as conditions → action → effects, an agent's modes and transitions.
- **Solve:** `automata pipe puzzle validate|solve|softlocks|routes --json` as `after` checks (one job), results marked stale when a file changes.
- **States:** unsolvable (the solver's finding), softlock found (Locate to the state), a cross-extension effect whose extension is missing (content error from M6.6a).

### 6.7 Sequence (Plus; EDS.8)

- **Edits:** `content/cutscenes/<id>.toml`: camera keys (time, position, look, lens, ease), actor keys (who, time, at, facing, pose or clip), captions (time, until, a `narrative` line key), light and sound keys.
- **Direct:** retime a key by dragging it on the timeline, lens slider, ease picker, pick a caption line from the Writer's lines, a light's level, a sound's time. A position that names an anchor (`at = "door.ward"`) is shown resolved and goes to Ask to change.
- **Preview:** scrub over `cutscenes`' `evaluate` drawn as a plan diagram of camera and actors; a game frame through `Preview` when connected (EDS-D14); "not connected" otherwise.
- **Checks:** `cutscenes` lint (camera inside the map, actors on walkable floor, caption keys exist, minimum cut length) as `after`.
- **States:** preview not connected, a caption key missing, an anchor that does not resolve.

### 6.8 Levels 2D and 3D (free; mounted)

As their specs; the suite adds only the mount (§4.7), the shared pills and Ship.

## 7. Checks and gates

- **`content`** (built in, `before`): the touched file parses and its schema (and the extension's compile checks, importable as functions where the owner exports them, e.g. figures §4.4.6) accepts the candidate.
- **Game checks** come from the list: `automata check` and `automata pipe <pipeline> <read-only command>` are the expected ones; the Node adapter runs whatever argv the list declares, because the list is the game owner's file and the suite can never write it.
- **A check that throws** is `error` with its output; the others still run. A check already running for the same id is replaced by the new run (the old one is cancelled), not queued (The Last Light refused the second; a replace is kinder on a tablet and still one job per id).
- **Gates:** §4.3. A change set whose writes are all undone reopens nothing.

## 8. The second-game rule (EDS-D11)

1. No source file in `editor-suite` or `editor-plus` names a game, a scene id, a gate id, a check id or a content path; an architecture test greps the sources for the two fixture games' ids, their gate names and their file names and fails on any hit outside `testing/`.
2. Every editor's acceptance (§13) edits the content of **two games**: the first and the second listed in the table below, each with its own `content/editors.toml`, checks green and the edit visible as a diff.
3. A feature one game needs and the other cannot use is a list option or a contribution, never an `if` on a game.

| Editor | First game | Second game |
|---|---|---|
| Tuner (core) | FloorFifty `content/tuning.toml` (code-owned bounds, no gates) | base-3d `content/tuning.toml` (authored bounds) |
| Tuner (`systems`) | The Last Light Bay's `systems.ts` tunables, converted by M6.7a's one-off converter | base-adventure (M6.12) |
| Studio | base-3d (Wick and the townsfolk, GAME-3D.1j) | The Last Light's cast (Ada, the Nurse, the Porter from `src/render/figure/characters/*.json` at `92e6704`, converted), starting from FigureBuilder's crew where the cast lacks a part |
| Audio (recipes) | base-3d | Emberwick (`games/emberwick`) |
| Audio (`audio-synth`) | The Bay's cues, converted by M6.10a | base-adventure |
| Feel | The Bay's `feel/effects.ts`, converted by M6.1 | FloorFifty's values as M6.1c's `feel` preset (a `feel.toml`; FloorFifty's own `juice.toml` is not an event-by-channel table and FloorFifty is not edited, decision 8; it stays a document test fixture, §4.4) |
| Writer, Schematic, Sequence | The Bay, converted by M6.6a, M6.7a, M6.8a and M6.9a | base-adventure |
| Levels 2D and 3D | As ED2D and ED3D (Mossgate, Hollowmere, FloorFifty; the depot and the Last Light blockouts) | |

## 9. UI inventory

Each row is a mockup frame (ED.0b, signed off); states are what the DOM tests and layout checks cover.

| Frame | Components | States that must exist |
|---|---|---|
| `suite-home` | Top bar (scene picker, change-set, checks and gate pills, Ship), rail of nine, editor cards (what each edits, its file), change-set card | No list, invalid list, editor not installed, no change set, no scenes (picker hidden) |
| `review-desk`, `review-portrait` | Change-set list, diff before and after, checks, measures, gate cards with links, tokens | No open change set, gates not readable, a check failing, a gate approved after the change (still reopened) |
| `ask-diff` | Prompt, scope chip, diff, check results, token meter, Accept, Reject | Asking, ghost passing, ghost failing (Accept disabled), over budget, locked value, no provider, failed |
| `ship-dialog` | Title, drafted description, files, checks, gates, Ship | Ready, a check failing (warns, still allowed: a draft), pushing, pushed with PR, pushed with compare link only, push failed |
| `interchange`, `interchange-export` | Format, file list; plan with changes, diffs, gates, checks and refusals; Apply | Clean plan, plan with refusals (Apply disabled), empty plan, a file moved on since the plan |
| `states-code-checks` | Source tab (read only, changed line marked), failing checks in the pill and the dock, running checks | Running, failing, passing |
| `states-offline` | Preview "not connected", Ask refusal, Ask at the cap, empty editor with template and Ask offers | as listed |
| `tuner-sliders`, `tuner-fairness`, `ff-tuner`, `tuner-portrait` | Groups rail, slider rows (value, bounds, unit, note, lock), inspector, Fairness dock | §6.1 |
| `studio-look`, `studio-pose`, `studio-ik`, `studio-animate`, `studio-pipeline`, `studio-first-run`, `studio-portrait` | Stage with picking, part fields, outfit and pose chips, handles, timeline, pipeline drawer | §6.2, plus the four FigureBuilder groups (screens to the Owner in EDS.9a) |
| `audio-cues`, `audio-portrait` | Recipe list, voice lanes, audition, mix and budget strip; Plus tabs Cues, Events, Mix | §6.3 |
| `feel-matrix`, `feel-portrait` | Event by channel table, cell fields, reduced previews strip | §6.4 |
| `writer-lines`, `writer-dialogue`, `writer-portrait` | Lines, graph, beats, hints; inspector; lint list | §6.5 |
| `schematic-chain`, `schematic-agent`, `schematic-portrait` | Lock graph, action card, agent modes, solve results | §6.6 |
| `seq-timeline`, `seq-portrait` | Cutscene list, preview with filmstrip, shot card, timeline lanes | §6.7 |

## 10. Responsive and input inventory

The shell modes and sizes are the kit's (EDK §4.2, §7); the level editors keep theirs (ED2D §12, ED3D §10).

| Context | Size | Suite behaviour |
|---|---|---|
| iPad 11″ landscape | 1194×834 | `wide`: top bar 52, rail 56 with nine entries, panel 264, canvas, inspector 320, dock |
| iPad 11″ portrait | 834×1194 | `medium`: compact top bar, 64 px tab bar with the same nine, panel and inspector as drawers, dock as a sheet |
| iPad mini landscape | 1133×744 | `wide`, `short` tier: dock summoned; pills collapse to icons with counts, never hidden |
| iPad 13″, desktop | 1366×1024, 1440×900 and up | `wide`, hover states, full keyboard |
| Phone | 390×844 | `compact`: Home, Review desk and every editor's inspector edits work; the Studio's handle posing and the timelines are view and scrub only; nothing crashes or is unreachable |

Input: touch drags sliders, handles and keys, two-finger pan and pinch on the stage and timelines; Pencil drags handles and scrubs and never pans; keyboard: Cmd Z and Shift Cmd Z, Cmd 1 to 9 the switcher entries in rail order, Cmd K Ask, Cmd S Checkpoint, Space play in Studio Animate and Sequence. Targets are 44 px, primary actions 48 px (Ship, Accept, Apply). Rotation or the keyboard opening never remounts an editor: sessions hold state (EDS-D12) and the kit keeps regions mounted.

## 11. Failure and recovery

| Failure | Behaviour |
|---|---|
| **Ask diff rejected by a check** | The diff shows the failing `before` findings at their lines; Accept is disabled; nothing is written; Rewrite asks again with the findings in the prompt; Reject drops it |
| **Ask diff rejected by the person** | Dropped; the document, history and journal are untouched; the tokens it used stay counted |
| Ask over budget, no provider, provider error | Over budget: refused before sending, with "only the owner raises the cap"; no provider: no Ask button; error: a toast with the reason; the document is untouched |
| Ask diff touches a locked value, a `never` or generated path, or another file | Refused with the key or path named; nothing written |
| A document changed while a proposal was on show | The proposal is dropped (ED3D.10a) |
| **A `before` check fails on a direct edit** | Not written; the field keeps the old value and shows the finding (kit widgets' refusal state) |
| **An `after` check fails** | The pill turns red with the failing check one tap away and Locate to the finding; nothing is undone; Ship warns and still drafts the PR |
| A check throws or times out | `error` with its output; other checks run; the pill says which |
| **A gate is reopened** | The pill and Home show it with its last decision and link; undoing every write to its files clears it; the editor never records or clears a decision |
| Gate records unreadable | "Gates not readable" with the reason; edits still work; Ship lists the gates the list names as "state unknown" |
| `content/editors.toml` missing, invalid or a newer major `format` | Home shows the error with the key path (or the format found); every editor is read only; "Start a list" writes a template only with the person's tap, and only the template, never into an existing list |
| An editor the list names is not installed (a Plus editor in the free build) | Home marks the row "not installed" with the package that provides it; its files open read only in the Source tab |
| A file no row matches, or a `never` path | Read only with the reason |
| Write conflict, quota, permission | Kit §6 (Keep mine, Take theirs, Save as copy; quota pauses autosave) |
| A document the codec cannot patch byte-exactly | `verify-failed`: not written; the path and reason are shown; Save reformatted (one confirmed step) or Export a copy |
| Ship push fails, `gh` missing or not logged in | Push failure: the reason, the commits stay local; `gh` unavailable: the compare link (EDS-D10) |
| An import plan's file moved on before Apply | Apply refused for the plan; "Plan again" |
| Undo of a step whose file moved on | Refused with the path; the history keeps the step |
| 3D context lost (Studio, 3D level editor) | Fields keep working; the stage shows the recover action; no edit lost |
| Preview not connected or the bridge drops mid-scrub | The diagram stays; the frame says "not connected"; nothing else changes |
| Reload mid change set | The journal restores the pills, measures, locks and the import undo step; the kit's Restore or Discard for unsaved documents |

## 12. Testing

| Layer | Where | What |
|---|---|---|
| Unit (renderer-free) | `editor-kit/documents`, `editor-kit/ports` fakes and contract tests, `editor-suite/core` | Documents on every fixture (round trip byte for byte, one span per value edit, structure inserts laid out like siblings, `verify-failed`); one contract test per port run against its fake and, for EDS.1d, its Node adapter; `af-editors/1` schema and loader on both games' lists; first-match rule; policy (never, generated, `editors.toml` itself); reopened gates; token budget; interchange export, plan and empty-plan round trip |
| Source tests | Extracted code | The Last Light's `json-edit`, `changeset`, `checks`, `ask`, `policy`, `interchange-flow`, `tunables` and `studio` cases that cover ported behaviour, with their assertions kept and imports re-pointed (ED3D §12's rule); FigureBuilder's face, hair and stand cases for what M3.5 extracts are M3's, consumed here |
| Node adapters | `editor-suite/node`, temp git repos | Disk workspace allowlist; a branch per change set; checkpoint commits only written files; Ship against a local bare remote with a fake `gh` (and without one: the compare link); argv-only checks with the output cap; Ask with a stubbed client |
| DOM component | Vitest browser mode | Every §9 state; keyboard; refusal states; Ask dialog Accept disabled with findings |
| Layout contract | Real browser, Chromium, WebKit and Firefox | The shell at every §10 size: region boxes, nine rail entries, the 64 px tab bar, 44 and 48 px targets, no horizontal scroll, no remount on rotation |
| Tablet journeys | Playwright WebKit iPad profiles (EDK.6b) | One journey per editor over both of its games (§8); the switch-and-return journey (EDS-k) |
| Visual | GPU runner (D-5) | Screenshots for the Owner's visual acceptance only; never auto-promoted |
| Device | The Owner's iPad, asked in the session | EDS.11; never ticked by an agent |

Fixtures: FloorFifty's `tuning.toml`, `juice.toml` and a generated `tuning-meta.json` (`677d456`); The Last Light's Bay converted by the M6 converters and its cast converted (`92e6704`), each with its source commit; FigureBuilder's crew and libraries for what M3.5 extracts (`a1f7246`); both games' `content/editors.toml`; one seeded violation per `before` check; a fake `AskProvider` returning a fixed passing and a fixed failing proposal. Ports are faked in CI; no live Claude, git remote or `gh` in a required gate. Focused feedback first: one document or one port, then the layer, then `pnpm check`.

## 13. Acceptance cases

| ID | Case | Pass |
|---|---|---|
| EDS-a | Open FloorFifty's `tuning.toml` in the Tuner, change nothing, save | Byte-identical |
| EDS-b | Drag `MAX_MOVE_SPEED` to a new value inside its bounds and save | The diff is that number's span; Undo restores the text; the gate pill reads "No gates" |
| EDS-c (fail) | Type a value past a tunable's `max` | Refused before the write with the bound named; nothing written |
| EDS-d | Lock a tunable, then Accept an Ask diff that changes it | Accept refused with the key named; nothing written |
| EDS-e | Ask proposes a change that a `before` check fails | The finding shows at its line; Accept disabled; nothing written; Rewrite sends the finding |
| EDS-f | Ask proposes a passing change; Accept; then Undo | One write, one undo step; Undo restores the file byte for byte |
| EDS-g (fail) | A direct edit fails the `content` check | Not written; the field keeps the old value with the finding |
| EDS-h | An `after` check fails following a write | Pill red; Locate selects the finding; nothing undone; Ship warns and still drafts |
| EDS-i | Edit a file whose row lists two gates | Both shown as reopened with their recorded decisions and links; no control records one; undoing the edit clears both |
| EDS-j | Ship with `gh` available, then without | A draft PR URL; then the compare link; both push the branch with only the written files committed |
| EDS-k | Select a sector in Levels 3D, switch to Tuner, edit, switch back | The sector is still selected; Levels 3D's Undo undoes its own last step, not the Tuner's |
| EDS-l | The free build opens a list that names `feel` | Home marks Feel "not installed" with the Plus package; its file opens read only |
| EDS-m (fail) | `content/editors.toml` has a row without `gates` | The list fails to load with that row's key path; every editor is read only |
| EDS-n (fail) | An Ask diff targets `content/editors.toml` | Refused (a `never` path); nothing written |
| EDS-o | Export the Bay as TOML, edit one caption time in the export, import | A plan with that one change, its gate and its checks; Apply writes it as one undo step |
| EDS-p | Export a scene, import it unchanged | An empty plan; Apply disabled |
| EDS-q | Studio: drag Wick's right hand past its reach | The handle turns amber with the shortfall; the clamped joints are listed; saving the pose writes the dragged target as authored |
| EDS-r | Studio: set the face's `jaw` slider and pick a stand the outfit does not suit | `jaw` is one value edit in the figure file; the stand is disabled with the reason and its fallback |
| EDS-s | Studio Animate: add a key at the playhead, set its ease, add a `contact` marker, scrub | The clip file gains the key, ease and marker; scrub matches `sample` at the playhead within 1e-6 |
| EDS-t | Feel: set a shake past `[limits]` | Refused before the write; the reduced-motion preview drops the shake |
| EDS-u | Writer: reword a line | Only the source locale file's string span changes; other languages show stale; the narrative lint runs after |
| EDS-v | Schematic: change an action's seconds and run Solve | One span in `puzzle.toml`; solver results update and are marked fresh |
| EDS-w | Sequence: drag a shot's start, preview not connected | One time literal changes; the diagram follows; the frame says "not connected" |
| EDS-x | Rotate the iPad mid-drag in the Tuner and mid-key in Studio Animate | No remount; the drag's transaction and the playhead survive |
| EDS-y | The second-game rule | The architecture test passes; each editor's journey passes on both games of §8 |
| EDS-z | Reload with an open change set and a measure | The pills, the before and after measures, the locks and the import undo step come back |

Owner visual acceptance (the built suite and the FigureBuilder groups) and the Owner's iPad pass are recorded by the Owner, never ticked by an agent.

## 14. Tasks

Order and dependencies refine the [master plan](../../02-master-delivery-plan.md#eds-editor-suite-coordinator-decision-2026-10-23-0741z)'s EDS rows; changes to rows are proposed here for the integration owner to apply in 02. Implementation waits for this spec's review and for ED2D.10 and ED3D.12 (02's direction), except the headless EDS.1a to EDS.1c if the Owner agrees.

| Row | Task | Needs | Cases |
|---|---|---|---|
| EDS.0 | This spec, reviewed | ED.0b, EDK.0, ED2D.0, ED3D.0 | |
| EDS.1a | Content documents in `editor-kit/documents` (§4.4): the TOML half from the FloorFifty codec, `patchJson` moved from editor-3d with its tests; FloorFifty's `tuning.toml` and `juice.toml`, AF fixtures, the blockouts, a messages file | EDS.0, EDK.2, EDFF.1 | EDS-a |
| EDS.1b | Ports in `editor-kit/ports` with fakes and contract tests (§4.3); `SuiteEditor`, `createSuite` shapes; ED3D's `ports.ts` moved onto them and deleted | EDS.0, EDK.2, EDK.5 | |
| EDS.1c | `af-editors/1` schema and loader in `editor-suite/core` (new package skeleton); the policy; both games' lists as fixtures | EDS.0 | EDS-m, EDS-n (policy) |
| EDS.1d | Node adapters in `editor-suite/node` behind `automata editor`: disk workspace on ED2D.9's server store, git change set, Ship with `gh` or the compare link, argv checks, gates reader, Ask with the developer's own credentials | EDS.1b, EDS.1c, ED2D.9 | EDS-j |
| EDS.2a | Suite app: switcher (rail of nine, 64 px tab bar), Home, editor-not-installed and list-error states, layout at every §10 size | EDS.1b, EDS.1c, EDK.1 to EDK.5 | EDS-l, EDS-m |
| EDS.2b | Pills, Undo (EDS-D19), the Ask diff dialog on ED3D.10a's controller, the change-set journal | EDS.2a | EDS-d to EDS-i, EDS-z |
| EDS.2c | Ship, the Review desk, Export and Import (§4.8) | EDS.2b, EDS.1d | EDS-j, EDS-o, EDS-p |
| EDS.2d | `./suite` entries in editor-2d and editor-3d; both mounted; the switch-and-return journey | EDS.2a, ED2D.4c4b, ED3D.5f | EDS-k |
| **EDS.P** (proposed) | `automata-plus/packages/editor-plus`: the composed build from core packs (`--extra` the four editor packages), its registry publish, `automata editor` choosing it; one placeholder Plus editor proving the path | EDS.2a, PRODUCT.5e | EDS-l (inverse: installed) |
| EDS.4a | Tuner on core tunables | EDS.2b, EDS.1a | EDS-a to EDS-d |
| EDS.9a | Studio Look with the FigureBuilder groups; screenshots to the Owner | EDS.2b, M3.5d | EDS-r |
| EDS.9b | Studio pose by hand | EDS.9a, M3.6b | EDS-q |
| EDS.9c | Studio Animate | EDS.9b, M3.6d | EDS-s |
| EDS.9d | Studio pipeline gate bar | EDS.9a, M3.9a (fixture records before it) | EDS-i |
| **EDS.5a** (proposed split of EDS.5) | Audio on core sound recipes | EDS.2b, EDS.1a, ASSET.2 | |
| EDS.3 | Feel (in `editor-plus`) | EDS.P, EDS.1a, M6.1c | EDS-t |
| EDS.6 | Writer (in `editor-plus`) | EDS.P, EDS.1a, M6.8b | EDS-u |
| EDS.7 | Schematic (in `editor-plus`) | EDS.P, EDS.1a, M6.6a, M6.7a | EDS-v |
| EDS.4b | Tuner `systems` source and the fairness measure (in `editor-plus`) | EDS.4a, EDS.P, M6.7b | |
| **EDS.5b** (proposed split of EDS.5) | Audio's `audio-synth` panels (in `editor-plus`) | EDS.5a, EDS.P, M6.10b | |
| EDS.8 | Sequence and the `Preview` adapter (in `editor-plus`) | EDS.P, EDS.6, M6.9b, M6.2 | EDS-w |
| EDS.10 | Pencil and touch polish, phone layouts, an axe pass and focus order, journeys for every editor in the WebKit iPad profiles | EDS.3, EDS.4b, EDS.5a, EDS.5b, EDS.6, EDS.7, EDS.8, EDS.9c, EDS.9d, EDK.6b | EDS-x, EDS-y |
| EDS.11 | Acceptance on two games per editor (§8); then the Owner's iPad pass | EDS.10 | all |

Critical path for the base 3D game: EDS.1a to EDS.1c → EDS.2a → EDS.2b → EDS.4a and EDS.9a to EDS.9c (GAME-3D.1j needs EDS.9c; GAME-3D.1k needs EDS.4a and EDS.5a). The Plus editors follow M6 in automata-plus and are not on the launch's critical path. Each row gets a TDD plan before code; the first commit of each PR is that plan.

## 15. Open questions (the Owner, in the session)

1. Is a Plus editor in automata-plus's `editor-plus`, composed into one build (EDS-D3), what you want, or should Plus editors load into the free suite at run time? Default: `editor-plus`.
2. Should the Audio editor be split into free recipes and Plus panels (EDS-D4, EDS.5a and EDS.5b)? Default: yes, so base-3d can author its sounds in the suite.
3. Do FigureBuilder's face sliders, hair pieces, stands and garment roles in the Studio's existing patterns (EDS-D16) need new mockups first, or are screenshots from EDS.9a enough? Default: screenshots from EDS.9a for your visual acceptance.
4. Are stands `figure-pose` content with a fit check (§6.2), or a separate kind? Default: `figure-pose`, a change request to M3.6b.
5. May the headless EDS.1a to EDS.1c run beside the level editors (02's EDS direction)? Default: yes, if you agree; nothing else starts early.
6. Should Ask use the developer's own Claude login or an API key with the per-change-set cap (The Last Light's Q3)? Default: the developer's own credentials through the Node adapter, with the cap kept by the suite; an API key only for the optional live check.
