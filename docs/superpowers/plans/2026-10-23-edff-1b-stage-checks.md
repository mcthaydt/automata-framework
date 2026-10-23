# EDFF.1b FloorFifty stage checks: TDD plan

- **Task:** EDFF.1b, the second slice of EDFF.1 in [02](../../02-master-delivery-plan.md). [2D editor spec](../specs/2026-10-23-editor-2d-design.md) §10.7 (the checks), §9 (the diagnostic shape), acceptance FF-o ("the shipped stages open with zero errors").
- **Lane:** FloorFifty profile. **Depends on:** EDFF.1a (`StageDocument`, `StageValue`, the schema), ED2D.1 (`Diagnostic`). Stacks on #151. **Unblocks:** EDFF.1d (the `Profile.check` and the fixes), EDFF.2 onward (the Checks view and the inspectors' inline diagnostics).
- **Status:** Planned 2026-10-23 on `claude/project-thread-73sp69-edff1b`. The 2D spec is drafted, not reviewed.
- **Progress:** 7 of 8 steps (the PR is step 8's last part). Implemented and locally checked 2026-10-23; not CI verified.

## Why the checks are written out, not read from the schema

The vendored schema is the file's contract: it refuses a stage it cannot read, and `parseStage` reports its issues as parse errors. A **command** produces a value the schema would refuse (a duplicated layer has its alias twice; a dragged sink leaves a range; a layer moved past a nearer one breaks the depth order), and the editor must keep that document open, show what is wrong and where, and offer the repair. So the checks evaluate the value, by the schema's own rules, and carry an id-based path the inspectors and the Checks view link to. The risk of two copies of one rule is closed by a test that makes the schema the oracle: for a catalogue of single edits to the shipped stages, the checks report an error at an issue's path exactly when the schema refuses the value (step 3).

## Scope

**In** (`packages/editor-2d/src/profiles/floorfifty-stage/`, headless, Node `unit` project):

- `tunables.ts`: the tunable declarations vendored from FloorFifty (`packages/shared/src/common/tuning.ts` at `ee5d44e`: type, range and default of each of 35 tunables, and the code-only invariants), and `courseTopFloor`. Needed here for `unknownTunable`, `tunableRange` and the course's top floor; EDFF.1c's course generator reads the same module.
- `check-schema.ts` (identity, aliases, presentation, course shape), `check-layers.ts`, `check-set-pieces.ts`: the rules the schema enforces, as diagnostics (`id`, `displayName`, `emptyAlias`, `presentationRange`, `seedInvalid`, `phraseOrder`, `phraseRange`, `emptyPurpose`, `purposeTooLong`, `noLayers`, `layerRange`, `plateOnlySky`, `arcOnlyCity`, `driftOnPlate`, `plateFirst`, `duplicateAlias`, `layerOrder`, `setPieceRange`, `tooManyPieces`). `check-types.ts`: the context, the finding constructors, `elementPath`, `rangeText`, the severity sort.
- `suggest.ts`: the names nearest to a misspelt one by edit distance (used for aliases and tunables), and `either`.
- `check-course.ts`: `phraseOverlap`, `phrasePastTop`, `floorsUnaccounted`, `extensionOverlap`, `extensionPastTallest`, `extensionUnaccounted`.
- `check-references.ts`: `unknownAssetAlias` (error when the art manifest is loaded, with suggestions), `aliasesUnchecked` (info when it is not), `unknownReference` (a set piece naming a layer the stage does not draw).
- `check-tuning.ts`: `unknownTunable`, `codeOnlyTunable`, `tunableRange`. `check-editor.ts`: `flashRate`.
- `stage-checks.ts`: `checkStage(document, context)` and `StageCheckContext`; severity order.
- `testing/art-aliases.json`: the 304 asset aliases of FloorFifty's art manifest at `ee5d44e` (names only), the loaded manifest of the alias tests.

**Out, with owner:**

| What | Where |
|---|---|
| `Profile.check` (maps `ProjectContext.assets` to a `StageCheckContext`), the repairs the `fix` names call | EDFF.1d |
| The Checks view, inline diagnostics in inspectors | EDFF.2 onward |
| Loading a manifest or `tuning.toml` from a folder | ED2D.5 (Home and storage) |
| `unusedLayer` (§10.7) | Cut, see decision 6 |

## Decisions made here (written into spec §10.7)

1. **The checks run on the value, not on the schema.** `checkStage(document, context)` never calls `stageSchema`; the agreement test (step 3) calls it as the oracle.
2. **Paths** are the parse errors' paths with the list index replaced by the element's id: `theme.layers[b2].depth`, `theme.setPieces[b0].layers`, `course.phrases[2].toFloor` (phrases are four fixed entries, so they keep an index), `course.extension[b1]`, `courseTuning.GRAVITY`. A path never changes when the list is reordered.
3. **Context.** `StageCheckContext` is `{ aliases?, tunables?, baseTuning?, tallestFloor? }`. Without it the checks use the bundled declarations, the declared defaults and the tallest finite course of 49 (spec §10.2). `aliases` is the set of asset aliases of the loaded art manifest.
4. **The course's top floor** is `COURSE_FLOOR_COUNT - 1` of the base tuning with the stage's `courseTuning` on top (FloorFifty `validate/course.ts`). When that count is itself out of range, the course checks are skipped and `tunableRange` reports it, as FloorFifty does (one bad number reads as one finding).
5. **A range of floors is one finding.** FloorFifty reports a sentence per floor; a person fixing "floors 5 to 7 are also in the teach phrase" wants one line. The messages name the layer or phrase, the value and the limit, in words.
6. **`unusedLayer` is cut.** The spec lists it as info with no definition, and no rule that needs only the document and a manifest of aliases says a layer is unused (a layer nothing names is the normal case). Reversible: it returns when the Compose view defines what unused means.
7. **Added codes** for schema rules the §10.7 list did not name: `emptyAlias` (an alias key that is empty), `noLayers` (a theme needs a layer), `purposeTooLong` (240), `seedInvalid` (a seed that is not a whole number from 0), `presentationRange` (the presentation's ranges), `codeOnlyTunable` (FloorFifty's `invariantNotAuthorable`: a code-only invariant such as `TICK_HZ`), `aliasesUnchecked` (one info finding when no manifest is loaded, in place of one per alias). `emptyPurpose` is an error, not editor-only: the schema refuses an empty purpose.
8. **`flashRate`** is a warning when four or more flashes of the sky flashes that start together (the pieces on one floor) begin within one second, by the director's own schedule: flash `i` of a piece starts `i × max(334, holdMs / flashes)` ms after the piece (FloorFifty `set-piece-director.ts`, WCAG 2.3.1). The director already spaces one piece's flashes; two pieces on one floor can stack.
9. **Fix names** are kebab-case repairs the profile (EDFF.1d) maps to commands: `reorder-layers` (`layerOrder`), `fit-phrases` (`floorsUnaccounted`), `remove-name` (`unknownReference`). A misspelt alias carries its suggestions in the message, not a fix (the inspector's alias picker chooses).

## Contract

```ts
interface StageCheckContext {
  readonly aliases?: ReadonlySet<string> | undefined         // the loaded manifest; absent = unchecked
  readonly tunables?: Readonly<Record<string, TunableDeclaration>> | undefined
  readonly baseTuning?: Readonly<Record<string, number>> | undefined  // tuning.toml; absent = declared defaults
  readonly tallestFloor?: number | undefined                 // default 49
}
checkStage(document: StageDocument, context?: StageCheckContext): readonly Diagnostic[]   // errors, then warnings, then info; stable within a severity
courseTopFloor(declarations, base, overrides): number | undefined   // undefined when COURSE_FLOOR_COUNT is out of range
suggestNames(name: string, known: Iterable<string>, limit?: number): readonly string[]   // nearest by edit distance (suggest.ts)
```

## Steps

Each step: a failing test first (reason recorded), the smallest change, the folder's tests, `tsc`, then a hand mutation pass on the new file. Tick when its checks pass.

- [x] **1. Tunable declarations.** `tunables.ts` and its test: the 35 names with their types, ranges and defaults equal FloorFifty's (spot values and a count), the invariants list, `courseTopFloor` (default 19, an override of 30 gives 29, a count out of range or not whole gives `undefined`).
- [x] **2. Contract and runner.** `stage-checks.ts`: a document that is valid gives no findings; findings are ordered error, warning, info, and keep source order within a severity. First failing test: the four shipped stages give no errors (needs steps 3 to 7; the step lands the runner with the empty sources and the severity sort, and the shipped-stage golden is added with the last source).
- [x] **3. Schema rules.** `check-schema.ts`, `check-layers.ts`, `check-set-pieces.ts`. One test per code (exact path, message and fix), and the **agreement test**: a catalogue of 49 edits within the types a command can produce (a number may be any number, NaN included; a required key is never missing; an enum is never outside its members), applied to `MINIMAL_STAGE` and the four shipped stages, singly and as 600 seeded sequences of one to three, each checked against `stageSchema.safeParse`: no schema issue means no error finding, and every schema issue's path (index form, converted to ids) has an error finding at it.
- [x] **4. Course.** `check-course.ts` against FloorFifty's own cases (`tests/content/validate/course.test.ts` at `ee5d44e`): overlap, past the top, holes, extension overlap with the phrases or itself, past the tallest, unaccounted, ranges described as `5–7`, and the stage's `courseTuning` lengthening the climb.
- [x] **5. References.** `check-references.ts`: aliases against the real manifest aliases (the four stages: none unknown; a misspelt one gives the nearest suggestions; no manifest gives the one info), and set pieces naming layers the stage does not draw (with `remove-name`).
- [x] **6. Tuning.** `check-tuning.ts`: unknown name, code-only invariant, range, whole-number for `int`, against the declarations passed in.
- [x] **7. Flash rate.** `check-editor.ts`: the schedule of step 8 of the decisions, with the boundary (three flashes in a second pass, four warn) and the shipped stages (none).
- [ ] **8. Gates and records.** The four shipped stages give zero errors and no warnings with the real manifest aliases; `pnpm check`-equivalent focused gates (`tsc`, lint, style, knip, boundaries, the package's unit tests); spec §10.7 rewritten as built, 02 and 03 updated; PR on #151.

## Execution record

Run 2026-10-23 on `claude/project-thread-73sp69-edff1b` (stacked on EDFF.1a). Each file was checked by hand mutation (the working-tree mutants are run with the file's own tests; a survivor is closed with a test or named below).

| Step | What landed | Evidence |
|---|---|---|
| 1 | `tunables.ts`: 35 declarations, generated from FloorFifty's `tuning.ts` by a script that reads the source (not transcribed by hand), the 11 invariants, `courseTopFloor` | 16 tests; 7 mutants, 1 survived (default equal to the minimum in the shipped data) and was closed with a test using other declarations. The plan said 37 tunables; the source has 35 |
| 2, 3 | `check-types.ts`, `check-schema.ts`, `check-layers.ts`, `check-set-pieces.ts`, the runner | check-types 9, check-schema 32, check-layers 29, check-set-pieces 17, agreement 51 (the shipped stages, 49 edits swept over 5 bases, 600 seeded sequences). Mutants: layers 26 (1 survived, a tie naming the first nearest layer, closed), schema 44 (2 equivalent: `+` to `*` in the id pattern, because an empty id or unlock is answered before the pattern; the `unlock !== undefined` guard, because `test(undefined)` matches "undefined"), set pieces 27 (none survived) |
| 4 | `check-course.ts` with floors as runs | 32 tests, among them FloorFifty's own cases and a phrase that ends at floor 1e15. 36 mutants; 15 survived the first pass and 12 were closed with tests; equivalent: the early return for an entry that ends at the top (an empty span divides to nothing), `Math.max(span.from, top + 1)` (a claim at or below the top is never read), the `top === undefined` guard (needed for the types) |
| 5 | `check-references.ts`, `suggest.ts`, `testing/art-aliases.json` | check-references 18, suggest 13. The four shipped stages have no unknown alias against the real manifest's 304 aliases. 27 + 21 mutants; every survivor closed with a test (leading characters, a mistake before a swap, the reach per six characters, the list of three) |
| 6 | `check-tuning.ts` | 13 tests; 11 mutants, 1 equivalent (asking for two guesses instead of one: only the first is used) |
| 7 | `check-editor.ts`: `flashRate` | 12 tests; 20 mutants, equivalent: the 334 ms constant (two gaps of it never reach 1000 ms and all pieces of a floor start at 0), `flashes < 1` (an empty schedule anyway), the finite-hold guard (NaN never passes a comparison), the sort (the first second is the busiest because all pieces of a floor start together), the `skyFlash` filter and the lone-piece guard (needed for the types). `holdMs = 0` closed with a test |
| 8 | Runner `stage-checks.ts` (14 tests): the four shipped stages give no finding with the manifest loaded and one info without; spec §10.7 rewritten as built | Folder 21 test files; package 830 tests in 32 files; `tsc -p .`, Biome, `pnpm style` (0 findings), `pnpm knip` and `pnpm boundaries` (0) clean; `pnpm deps:new` not applicable (no new dependency) |

### Deviations

- **Codes.** `unusedLayer` is cut (decision 6); the codes `emptyAlias`, `noLayers`, `presentationRange`, `seedInvalid`, `purposeTooLong`, `codeOnlyTunable` and `aliasesUnchecked` were added (decision 7). Spec §10.7 says so.
- **File names.** The plan named `check-identity.ts`; the identity, alias, presentation and course-shape rules are in `check-schema.ts`, and the suggestion code moved to `suggest.ts` when the tuning check also needed it.
- **Enums.** The agreement test leaves out edits that put a value outside an enum (a mood, a particle): the types keep a command from producing one, and the checks do not repeat the enum lists.

### Not done

- The `Profile.check` that maps `ProjectContext.assets` to `StageCheckContext`, and the repairs the `fix` names call (EDFF.1d). Loading `tuning.toml` and the art manifest from a folder (ED2D.5).
- Not CI verified. Owner acceptance is not claimed; the spec is drafted, not reviewed.
