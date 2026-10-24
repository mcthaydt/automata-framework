# EDFF.1d FloorFifty commands, fixes and the profile: TDD plan

- **Task:** EDFF.1d, the fourth and last slice of EDFF.1 in [02](../../02-master-delivery-plan.md). [2D editor spec](../specs/2026-10-23-editor-2d-design.md) §10.6 (commands and views), §7 (the `Profile` interface), §8 flows "New stage", "Fix", "Export".
- **Lane:** FloorFifty profile. **Depends on:** EDFF.1a (`StageDocument`, `printStage`), EDFF.1b (`checkStage`, `courseTopFloor`), EDFF.1c (`createCourse` is not used here; the Course view of EDFF.3 is). Stacks on #157. **Unblocks:** EDFF.2 (the Compose view calls the layer commands), EDFF.3 (the Course view calls the course commands), EDFF.4 (the Pieces view), EDFF.5 (FF-o rebuilds the four stages through these commands) and ED2D.4c (registers the profile in `app/profiles.ts`).
- **Status:** Planned 2026-10-23 on `claude/project-thread-73sp69-edff1d`. The 2D spec is drafted, not reviewed.
- **Progress:** 9 of 9 steps. Implemented and locally checked 2026-10-23; draft PR #160 (stacked on #157); not CI verified.

## Why the commands reach every stage

FF-o says "rebuild Dawn, Rooftops, Snow Shrine and Sunken Dome from empty stages; each re-parses to a value that equals the shipped file's value". The Compose, Course, Pieces and Stage views of the later tasks only call the commands of this slice, so a field no command can set is a field no view can edit. Step 9 proves the set is complete the cheap way, before any screen exists: a test builds each shipped stage from the Empty template with commands alone and compares it with the value its file parses to. The spec's list of 23 names did not reach the identity fields, the optional aliases, an extension entry's fields or a missing course, which that test would have found missing; they are added here (decision 3).

## Scope

**In** (`packages/editor-2d/src/profiles/floorfifty-stage/`, headless, Node `unit` project):

- `commands/`: the named edits of spec §10.6, each `(document, …) => document`. Pure; they never validate ranges (a value out of range is a finding of the checks, spec §10.7), only keep the document's structure whole: a list index that is not there throws `RangeError`, an element added gets a fresh id from the injected `IdSource`, a move keeps its id, a duplicate gets a new one, an edit that changes nothing returns the same object, `course.extension` is unset when it empties.
- `stage-fixes.ts`: `applyStageFix(document, diagnostic, context)`, the one-step repairs the checks name (`reorder-layers`, `fit-phrases`, `remove-name`).
- `templates/`: Empty, Simple city, Sky only.
- `floorfifty-stage.ts`: the `Profile<StageDocument>` object (`id: 'floorfifty-stage'`): `sniff`, `parse`, `print`, `check`, `fix`, `templates`, the seven views of the rail and the stage TOML export.
- Two additions to the shared `Profile` interface (decision 1 and 2), backward compatible: `fix?` and a second `base` argument to `ExportTarget.files`.

**Out, with owner:**

| What | Where |
|---|---|
| Registering the profile in `app/profiles.ts` (the architecture rule lets only that file import a profile; the file does not exist until the app does) | ED2D.4c |
| The views themselves (Svelte components for `ComposeView`, `CourseView`, `PiecesView`, `StageView`, `AssetsView`; `ChecksView` and `ExportView` are shared with the level project) | EDFF.2, EDFF.3, EDFF.4, ED2D.7 |
| Where the app reads the art manifest's aliases and `tuning.toml` from (the folder store), and so the base tuning that the checks and `fit-phrases` read | ED2D.5, EDFF.5; until then the profile reads `ProjectContext.assets` as the manifest's aliases and the declared tuning defaults |
| A "Copy of…" template (it copies an open document and its base text, which is an app flow) | ED2D.4c |
| A command that moves a phrase boundary and the next phrase's start together (range steppers) | EDFF.3, if the Course view wants it; `fitPhrasesToCourse` tidies what steppers leave |

## Decisions made here (written into spec §10.6)

1. **`Profile.fix?(value, diagnostic, context)` applies the repair a diagnostic names.** A finding's `fix` is a name (`reorder-layers`); the app cannot map a profile's names to commands without knowing the profile (G-s forbids profile ids in `app/`). So the profile does it. Absent when a profile offers no repair; the level project gains its own with ED2D.7.
2. **`ExportTarget.files(value, base)` gets the text the document was loaded from.** A stage must export with its comments, which only `print(base, value)` keeps. `base` is `''` for a document never loaded (a template's); the profile then prints against its own minimal stage text, and `print('', value)` does the same. The level project's targets ignore it.
3. **Commands beyond the spec's 23:** `setStageId`, `setUnlock`, `setPreviewAlias`, `setAmbienceAlias` (the Stage and Assets views edit them), `setExtension` (an extension entry's fields), `addCourse` and `removeCourse` (a stage may have no course, and three of the four shipped stages differ from the Empty template by it), `removePresentation` and `removeCitySink` (the block and the arc are optional), and `sortLayersByDepth` (the repair for `layerOrder`, a command in its own right). Each is a few lines, all of them are needed for step 9, none is speculative. `addCourse(document, ids, { seed, top, tallest })` also adds the one extension entry from `top + 1` to `tallest` that the checks want a purpose for (`extensionUnaccounted`), so the course it makes has no error; the first design added the phrases only and the checks said so.
4. **`dragLayerSink(document, index, delta)` rounds to whole units and does not clamp.** The game snaps city layers to whole device pixels; a sub-unit sink is noise in the file. A sink dragged out of range is a finding (`layerRange`) shown at once, as the spec says of a dragged sink. The caller passes the delta from the gesture's start document, so a gesture is one `History` transaction and replays from where it began.
5. **`fitPhrasesToCourse(document, top)` keeps every phrase's start where it can.** Each phrase ends the floor before the next one starts and the last ends at `top`; the first starts at 1; a start that is out of order or past what four phrases leave room for moves just far enough. A gap is absorbed by the phrase before it, an overlap trimmed from it, and a missing tail added to `finish`. It changes exactly what was wrong, where a proportional re-division would move every boundary the author chose. `top` is an argument so the command knows nothing of tuning; the fix reads it from the stage's `courseTuning` through `courseTopFloor`.
6. **`reorder-layers` sorts each plate's layers by depth, in the slots the plate already holds.** Sky and city layers keep their places in the list, which is the drawing order across plates; within a plate the order is the schema's rule. One application clears every `layerOrder` finding. It is a stable sort, so equal depths keep their order.
7. **`remove-name` removes the one name the finding points at.** A swarm left with no layer stays an error (`setPieceRange`), a `weatherBurst` left with none drops its `layers`, which means every layer.
8. **A new set piece goes after the last piece on a floor at or below its own**, so a file written in floor order stays in it; a move changes the floor and nothing else, so the index a drag holds stays valid.
9. **`rerollSeed(document, rng)` takes the course's own `Rng`** (`createRng` of whatever entropy the app has) and draws from 0 to 99 999, the magnitude of the shipped seeds; a draw equal to the current seed steps to the next number.
10. **Templates use the game's real aliases** (`world.rooftopsSky`, `world.sun`, `world.cityFar`, …), so a loaded manifest accepts them and an unloaded one reports `aliasesUnchecked` only. Empty is the smallest valid stage (one sky plate); Sky only adds the sun and a cloud band; Simple city adds two skylines, the presentation block and a four-phrase course on the default 19-floor climb.

## Contract

```ts
// commands/*.ts: (document, …) => StageDocument
renameStage(doc, name) / setStageId(doc, id) / setUnlock(doc, unlock | undefined)
setPlatformAlias / setBackdropAlias / setLight / setPreviewAlias / setAmbienceAlias
setCourseTuning(doc, name, value | undefined)
setPresentation(doc, field, value) / removePresentation(doc) / setCitySink(doc, phrase, value) / removeCitySink(doc)
addLayer(doc, ids, layer, at?) / removeLayer / duplicateLayer(doc, ids, index) / moveLayer(doc, from, to)
setLayerField(doc, index, field, value) / dragLayerSink(doc, index, delta)
addCourse(doc, seed, top) / removeCourse(doc) / setSeed / rerollSeed(doc, rng) / setPhrase(doc, name, field, value)
fitPhrasesToCourse(doc, top) / addExtension(doc, ids, entry) / setExtension(doc, index, field, value) / removeExtension
addSetPiece(doc, ids, kind, floor) / moveSetPiece(doc, index, floor) / setSetPieceField(doc, index, field, value) / removeSetPiece

// stage-fixes.ts
applyStageFix(doc, diagnostic, context): StageDocument

// floorfifty-stage.ts
floorFiftyStage: Profile<StageDocument>
```

## Steps

Each step starts with the failing test, confirms why it fails, then makes the minimal change. Hand mutation checks close the survivors, as in EDFF.1b and EDFF.1c.

- [x] **1. Identity, aliases and tuning.** `commands/edit-helpers.ts` (fresh id, index check, list insert/remove/move, set-or-drop a key) and `commands/identity-edits.ts`: each edit changes its field and nothing else, an unset value drops the key, an edit that changes nothing returns the same document, the printed text of each differs from the base in exactly the lines that hold the value.
- [x] **2. Presentation.** `commands/presentation-edits.ts`: a field set on a stage with no presentation creates it with the game's neutral values, `setCitySink` creates the table with zeros for the other phrases, removal drops the table.
- [x] **3. Layers.** `commands/layer-edits.ts`: add (at the end, or at an index), remove, duplicate (a fresh id, next to the original), move (the id travels), field edits including unsetting an optional field, `dragLayerSink` (rounds, does not clamp, 0 is the same document), index errors.
- [x] **4. Course.** `commands/course-edits.ts`: `addCourse` tiles 1 to the top, `removeCourse` drops the extension ids, seed and reroll (never the same seed, deterministic for a given rng), phrase fields, `fitPhrasesToCourse` on a gap, an overlap, a short tail, out-of-order starts and a tiling that is already right (same document), extension entries (added with a fresh id, edited, removed; the key goes when the list empties).
- [x] **5. Set pieces.** `commands/piece-edits.ts`: a default piece of each of the five kinds is valid by the schema, sorted insertion, move keeps the index, a field a kind does not have is refused, optional fields unset.
- [x] **6. Fixes.** `stage-fixes.ts`: `reorder-layers` clears `layerOrder` and moves nothing across plates, `fit-phrases` clears `floorsUnaccounted` for a stage with its own `COURSE_FLOOR_COUNT`, `remove-name` removes by position and by piece id, an unknown fix and a finding the document no longer has are refused.
- [x] **7. Templates.** `templates/`: each creates a document the schema accepts with zero errors from the checks (aliases checked against the manifest list), ids come from the injected source and are all distinct, `create` twice gives equal documents from equal sources.
- [x] **8. The profile.** `floorfifty-stage.ts` and the interface additions: `sniff` claims `.toml` stage files and nothing else, `parse` and `print` equal the codec (byte for byte on the four stages), `print('', template)` re-parses to the template, `check` maps `ProjectContext.assets` to the manifest, `fix` applies the named repair, the rail has seven views in the spec's order, the export is one file whose text is `printStage(base, document)`, the profile registers in a registry.
- [x] **9. Acceptance at the model level, gates and records.** FF-o's model half (the four stages rebuilt from Empty with commands alone), FF-b (one line), FF-c (remove, add, reorder; re-parse equals; every other comment line unchanged; the original document prints to the original bytes), FF-d, FF-f; package tests, typecheck, Biome, `pnpm style`, knip, boundaries; spec §10.6 as built, 02 row, 03 paragraph; push, draft PR stacked on #157.

## Execution record

Implemented 2026-10-23 on `claude/project-thread-73sp69-edff1d`. Steps 1 to 5 test first (a test file, a run that failed because the module did not exist, then the module). Steps 6 to 8 had their tests written before their modules, but a hand mutation run held the sources, so their first run was against finished code and no failing-first run was seen; the mutation checks below are what stands in for it.

1. `commands/edit-helpers.ts` (15 tests) and `commands/identity-edits.ts` (20): every command changes its field and nothing else, an unset value drops the key, a no-op returns the same document, and the printed text differs from the base in exactly the lines that hold the value (also for a tunable added to and removed from `[courseTuning]`).
2. `commands/presentation-edits.ts` (18).
3. `commands/layer-edits.ts` (32): FF-b (a sink 150 to 160 is one line), a layer moved past a nearer one is reported by the checks with the repair, a duplicate leaves `duplicateAlias`, a drag out of range leaves `layerRange`.
4. `commands/course-edits.ts` (43): `addCourse` gives a course with no error, `fitPhrasesToCourse` on a gap, an overlap, a short tail, a lower top, out-of-order and fractional starts.
5. `commands/piece-edits.ts` (28): each kind's default passes the schema and the checks, sorted insertion, a field a kind does not have is refused.
6. `stage-fixes.ts` (15, through `applyStageFix`): FF-d and FF-f, a reorder that clears every `layerOrder` finding and keeps each plate's slots, `remove-name` by piece id and position.
7. `templates/stage-templates.ts` and `new-stage.ts` (21): each template has no error and no warning with the manifest of 304 aliases loaded, only `aliasesUnchecked` without it, and prints against the new-stage text and reads back as itself.
8. `floorfifty-stage.ts` (18) and the `Profile` additions: the four shipped stages open and print back byte for byte through the profile (FF-a), `sniff` claims a stage the parser refuses, `check` reads the assets as aliases, `fix` clears a `layerOrder` finding.
9. `stage-acceptance.test.ts` (11): FF-o's model half (each shipped stage rebuilt from the Empty template with commands alone equals the value of its file, prints, and the checks find nothing), FF-c, FF-a. Gates: `pnpm check` exit 0 (package: 1253 tests in 48 files), `pnpm api-report --update` (the `Profile` and `ExportTarget` additions are the whole diff of `editor-2d.api.md`).

Hand mutation checks (`mutate2.py`, one change at a time, the file's tests must fail): 15 in the helpers, 13 in identity, 12 in presentation, 26 in layers, 44 in course, 33 in pieces, 16 in the fixes, 9 in `sortLayersByDepth`, 22 in the profile, 23 in the templates, 5 in the new-stage text. First-round survivors that a test closed: the `particle`, `density`, `flashes`, `tone` and `speed` defaults and the taken-id checks of `addSetPiece`, `duplicateLayer` and `addExtension` (an id the document already has), `fit-latest` (a floor left for every phrase after), `fitcmd-top` (a top of exactly four), `position-off` (one past the last name), `theme-regex` (a `[[theme.layers]]` header) and the template layers' values. Two redundant `next === current` guards in the presentation commands were removed instead of tested (`withPresentation` already returns the same document). Survivor left, an equivalent mutant: `duplicateLayer` placing the copy at `index` instead of `index + 1` (the copy equals the original, so the layer list is the same; the ids test pins the id's place). One was removed by a simplification: `fix` no longer passes the project context on (no repair reads an alias), which made its context mutant meaningless.

### Deviations

- The commands are in `commands/` as five files by group, not one `stage.commands.ts`; the spec now says so.
- Ten commands beyond the spec's list (decision 3), `Profile.fix` and the second argument of `ExportTarget.files` (decisions 1 and 2) are additions to the shared contract. They are backward compatible and written into spec §7 and §10.6.
- `addCourse` also adds the extension entry (decision 3).

### Not done

- The profile is not registered: `app/profiles.ts` does not exist until ED2D.4c, and the architecture rule lets only that file import a profile.
- The views are names on the rail (`ComposeView`, `CourseView`, `PiecesView`, `StageView`, `AssetsView`); their components are EDFF.2 to EDFF.4 and the Stage and Assets views have no task row yet (they belong with EDFF.2 or EDFF.5).
- `ProjectContext.assets` is read as the art manifest's aliases. Which workspace file supplies them, and `tuning.toml` for the base tuning, is decided with the folder store (ED2D.5, EDFF.5); until then `fit-phrases` and the course checks use the declared defaults.
- No command moves a phrase boundary together with the next phrase's start (range steppers); EDFF.3 adds one if the Course view wants it.
- "Copy of…" is an app flow.
- The first draft of FF-e says a misspelled alias offers "the nearest alias as a fix"; the checks put the nearest names in the message (EDFF.1b) and a finding's `fix` is a name, so choosing one is the view's `setLayerField` and friends.
- Not CI verified.
