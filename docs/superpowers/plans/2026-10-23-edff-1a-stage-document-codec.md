# EDFF.1a FloorFifty stage document and TOML codec: TDD plan

- **Task:** EDFF.1a, the first slice of EDFF.1 in [02](../../02-master-delivery-plan.md). [2D editor spec](../specs/2026-10-23-editor-2d-design.md) §10.1 (FF-D1 to FF-D3), §10.2 (the stage files), §10.3 (document and codec); acceptance FF-o (the byte-for-byte parts) and G-c (a parse error never replaces the file).
- **Lane:** FloorFifty profile, parallel to the 2D editor lane. **Depends on:** ED2D.1 (the `Profile` interface, `Result`, `ParseError`), EDK.2. Stacks on #128. **Unblocks:** EDFF.1b (checks), EDFF.1c (composition and course), EDFF.1d (commands and the profile object), EDFF.2 (the Compose view).
- **Status:** Planned 2026-10-23 on `claude/project-thread-73sp69-edff1`. The 2D spec is drafted, not reviewed.
- **Progress:** 1 of 8 steps.

## Why the codec is more than `toml-patch`

FF-D2 chose `@decimalturn/toml-patch` 3.3.1 (MIT) because the files are written by people for people: `rooftops.toml` is 30% comments and the editor must never destroy them. A spike on the four shipped stages (2026-10-23, from `/home/claude/floorfifty` at `ee5d44e`) measured what the library does:

| Edit | Result |
|---|---|
| `patch(text, parse(text))` | byte-equal on all four stages |
| One scalar changed (`sink = -140` to `-130`) | exactly that one line differs |
| An optional key added or removed | exactly that one line is added or removed |
| An array-of-tables element **removed** | the table goes, but the comments around it are wrong: in `rooftops` a removal also deleted the seven-line comment above the unrelated `[theme.presentation]` for every index, in `snow-shrine` and `sunken-dome` the removed layer's own leading comment stayed behind and now describes its neighbour |
| An element inserted or two elements swapped | the document re-parses to the new value, but the swapped element's comment does not travel with it |

So the library carries every in-place change (it is exact there), and **this package carries the structure of the three lists** (`course.extension`, `theme.layers`, `theme.setPieces`) with a small block engine: spec §10.3 rules 2 and 3 are the engine's tests. `course.phrases` is always four entries in a fixed order, so it never changes shape.

## Scope

**In:** `packages/editor-2d/src/profiles/floorfifty-stage/` (headless, runs in the `unit` project in Node):

- `stage.schema.ts`: the vendored Zod stage schema (FF-D3), `StageValue` and the names the other slices share.
- `stage-document.ts`: `StageDocument`, the profile's `V`: the value plus a stable id for every element of the three lists, so the codec knows which element of the loaded text an edited element is.
- `toml-blocks.ts`: the block engine: scan a text into tables and their leading comment blocks, then remove, insert and move whole tables with their comments.
- `stage-codec.ts`: `parseStage` (positions for every error) and `printStage(base, document)`.
- `testing/stages/*.toml` and `testing/shipped-stages.ts`: the four shipped stages as fixtures, with their provenance.
- The dependency `@decimalturn/toml-patch` 3.3.1 and its row in `docs/versions.md`.

**Out, with owner:**

| What | Where |
|---|---|
| Checks (schema messages for people, course, aliases, set pieces) | EDFF.1b |
| `composeStage`, the seeded course generator, tuning declarations | EDFF.1c |
| Stage commands, templates, the `Profile` object, registering it | EDFF.1d |
| Views, drafts of invalid fields | EDFF.2 onward |
| Tunable names and ranges for `courseTuning` | EDFF.1b (the schema here checks only "a finite number") |

## Decisions made here (written into spec §10.3)

1. **The profile's value is a `StageDocument`, not a bare `StageValue`.** `ids` holds one string per element of `extension`, `layers` and `setPieces`, in the same order. A parsed document numbers its elements `b0`, `b1`, … per list, so `printStage(base, parse(base))` is the identity; a command that adds an element gives it a fresh id from the injected `IdSource`; removing and moving elements removes and moves their ids. Without ids the codec could not tell "moved" from "removed and a new one added" and would lose the comments of a move (rule 3).
2. **The block engine edits the three lists before `patch` runs.** `printStage` finds the base's elements by id, removes the ones the document dropped, moves the ones it reordered, inserts the new ones, and only then calls `patch(text, value)` for the scalar differences, so `patch` never sees a structural change.
3. **A table's own comments** are the contiguous `#` lines directly above its header. A comment block separated from the next header by a blank line belongs to nobody: removing a table leaves it where it is, and it keeps its single blank line above.
4. **New tables follow the file's style:** a blank line between tables, keys in the schema's order, and a table with no siblings goes after the last table that comes before it in the schema's order (`courseTuning`, `course`, `course.phrases`, `course.extension`, `theme`, `theme.layers`, `theme.presentation`, `theme.presentation.citySink`, `theme.setPieces`).
5. **Line endings and the final newline are the base's.** A base with `\r\n` stays `\r\n`; a base with no final newline keeps none.
6. **Positions.** A TOML syntax error carries the library's line and column. A schema issue carries its path (`theme.layers[3].sink`) and the line of that key, found by the block scan; an issue on a key that is missing points at the table header.
7. **Provenance.** The schema and the fixtures name the FloorFifty commit they were taken from (`ee5d44e`); a refresh is a re-copy at a newer commit with the diff reviewed (FF-D3). `@floor-fifty/shared` branded ids (`asContentId`) become plain strings here.

## Contract

```ts
// stage.schema.ts
export const PHRASE_NAMES: readonly ['teach', 'combine', 'recover', 'finish']
export const stageSchema: z.ZodType<StageValue>      // strict; rules of spec §10.2
export type StageValue, StageLayer, StageSetPiece, StagePhrase, StageExtension

// stage-document.ts
export interface ListIds { readonly extension: readonly string[]; readonly layers: readonly string[]; readonly setPieces: readonly string[] }
export interface StageDocument { readonly value: StageValue; readonly ids: ListIds }

// stage-codec.ts
export function parseStage(text: string): Result<StageDocument, readonly ParseError[]>
export function printStage(base: string, document: StageDocument): string
```

## Files

- Create: `packages/editor-2d/src/profiles/floorfifty-stage/{stage.schema.ts, stage-document.ts, toml-blocks.ts, stage-codec.ts}` with a `.test.ts` for each, `testing/stages/{dawn,rooftops,snow-shrine,sunken-dome}.toml`, `testing/shipped-stages.ts`, `testing/PROVENANCE.md`.
- Modify: `packages/editor-2d/package.json` and `pnpm-lock.yaml` (the dependency), `docs/versions.md`, `src/index.ts` and `index.test.ts` (export `parseStage`, `printStage`, `StageDocument`, `StageValue`), `tooling/api-report/reports/editor-2d.api.md`, the 2D spec §10.3, `docs/02`, `docs/03`.
- The architecture test already keeps `model/`, `tiles/` and the generic `app/` free of profile ids; a profile folder may use its own names.

## Steps

Each step starts with a failing test and the reason it fails. After each: the package's `typecheck` and `test:unit`, then a hand mutation pass on the new file (one condition or constant at a time; every survivor gets a test or a reason it is equivalent).

- [x] **1. Schema.** Fails: the module does not exist. All four shipped stages (as parsed TOML) pass; each rule of spec §10.2 fails with the right path and message for its offending value: `id` pattern, `displayName` over 48, phrases not `teach, combine, recover, finish` once each in order, `toFloor` below `fromFloor`, `depth`/`sink`/`haze`/`arc`/`drift` ranges, `extend = "plate"` on a city layer, `arc` on a sky layer, `drift` on a plate, a plate that is not the first sky layer, a duplicate alias, a layer nearer than the one after it in its plate, no layers, every set-piece kind's bounds and required fields, more than 16 pieces, an unknown key anywhere (strict).
- [ ] **2. Parse with positions.** Fails: no `parseStage`. A shipped stage opens as a document whose ids are `b0…` per list; a TOML syntax error reports the line and column; a schema issue reports its path and the line of its key (the table header for a missing key); several issues are all reported; the document of an empty text reports the missing keys.
- [ ] **3. Block scan.** Fails: no `toml-blocks`. For each shipped stage the scan finds the tables the file has (counts per name), each table's header line, its leading comment lines (contiguous `#` directly above) and its last content line; floating comment blocks are in no table's range; `\r\n` text scans the same; a header inside a comment or a string is not a header.
- [ ] **4. Identity print.** Fails: no `printStage`. `printStage(text, parseStage(text))` equals `text` for the four stages and for a `\r\n` variant and a variant with no final newline.
- [ ] **5. Value edits.** Fails: `printStage` with an edited value changes more than the edit. One scalar edit (a layer's `sink`, `displayName`, a set piece's `holdMs`, a phrase's `purpose`) changes exactly that line; an optional key added or removed adds or removes exactly its line; `theme.presentation` and its `citySink` can be added, edited and removed; `course` can be added and removed; every result re-parses to the edited value.
- [ ] **6. List edits.** Fails: a list edit loses or misplaces comments. Removing an element removes it and its leading comment block and nothing else (checked for each element of each list of each stage); a removed element's neighbours keep one blank line between them; a floating comment stays; inserting at the end, in the middle and into an empty list puts the table where the style says with keys in the schema's order; moving an element moves it with its comments; edits to several lists and scalars in one document print together.
- [ ] **7. Property check.** Fails: a random edit sequence breaks an invariant. A seeded generator applies 200 random sequences of 1 to 8 list and scalar edits to each stage and asserts: the output re-parses to exactly the edited value; every comment line of the base that belonged to an element still in the document is in the output once; no comment line appears that the base did not have; an empty sequence prints the base.
- [ ] **8. Exports, records and gates.** Fails: `index.test.ts` lists the new names. Export `parseStage`, `printStage` and the types; the dependency row in `docs/versions.md` (MIT, FF-D2, 2026-10-23); `pnpm api-report --update`; amend spec §10.3; update 02 and 03; `pnpm lint`, `style`, `knip`, `boundaries`, the package's `typecheck` and `test:unit`; note that `pnpm deps:new` could not run in this sandbox.

## Gates

`pnpm --filter @mcthaydt/automata-editor-2d typecheck` and `test:unit`; repo-level `pnpm lint`, `style`, `knip`, `boundaries`, `pnpm api-report`, and the versions test of `tooling/versions`. Not run here: CI, WebKit and Firefox parity (the codec is pure text work with no engine-specific behavior), the full-repo `test:unit` (once before the PR leaves draft), `pnpm deps:new` (the registry's API host is unreachable from the sandbox), and any visual check (no screens).

## Execution record
- **Step 1** (2026-10-23): the vendored schema. 70 tests: the four shipped stages pass, every rule of spec §10.2 fails with its path and message, and every numeric range accepts both ends and refuses what lies beyond. Deviation from the plan as written: the types of `StageValue` and its parts are written out by hand (with `| undefined` on optional keys) and `stageSchema` is annotated `z.ZodType<StageValue>`, because the repo's `isolatedDeclarations` cannot infer an exported Zod schema; `ED2D.1`'s `project.schema.ts` does the same. Hand mutation pass: 110 numeric mutants of the bounds and 20 of the refinement rules; the only survivors are `toFloor` minimum 1 on a phrase and on an extension, which the "must not be below fromFloor" rule refuses anyway (equivalent in effect: the same values are refused, only the message differs).
