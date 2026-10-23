# ED3D.1 Format and codec: TDD plan

- **Task:** ED3D.1 in [02](../../02-master-delivery-plan.md) (row lands with the ED3D follow-up). [ED3D spec](../specs/2026-10-23-editor-3d-design.md) §2 (Format, Codec), §4.1, §4.5, decisions ED3D-D2, D3, D4. Acceptance: the patch halves of ED3-b and ED3-o (§13); the rest of those cases need the model and the shell.
- **Lane:** editor-3d. **Depends on:** ED3D.0 (the spec, review pending). It needs no editor-kit code, no Svelte and no DOM.
- **Status:** Drafted 2026-10-23. Not reviewed, not implemented. Nothing below starts until ED3D.0 is reviewed.
- **Progress:** 6 of 11 steps.

## Sources, read at these commits

- **The Last Light, `mcthaydt/PixiJS3D_Experiment_001` at `92e6704` (2026-10-22):**
  - `scripts/pipeline/blockout-format.ts` (243 lines): the types, `wallOf`, `roomSector`, `applyOpenings`, `deriveNav`, `expand`.
  - `src/game/sector-format.ts` (64) and the `Box`, `Hotspot`, `Lamp` types of `src/game/level.ts`: the sector vocabulary the blockout types extend. The other imports of `level.ts` (the clinic scene, `sectors`) are the game's and stay behind.
  - `scripts/pipeline/json-edit.ts` (225): `formatJsonNumber`, `formatJsonScalar`, `applyJsonEdits` (all or nothing, expected-text check, `JSON.parse` of the result).
  - `editor/src/server/json-structure.ts` (285): `insertElement`, `removeElement`, `insertMember`, `removeMember`, `replaceValue`, `setMember`, and the layout it copies (indent unit, brace spacing, packed lines up to width 120). It finds spans with `ts.parseJsonText`.
  - `editor/src/client/plan.ts`: `scanJson` (about 65 lines), the browser-safe scanner the plan view already runs. It is the base of the new scanner.
  - `docs/art/blockout-{clinic,clinic-dawn,bay,prologue}/blockout.json` and `docs/art/blockout-facility/facility.json`: 14,471, 28,030, 17,128, 14,091 and 8,701 bytes. `scripts/pipeline/facility-lib.ts` (634 lines) is the reader that says which `facility.json` members the game uses.
  - Tests that come with the code: `editor/tests/json-edit.test.ts` (117 lines), the structure cases of `editor/tests/level-edits.test.ts` (lines 60 to 106), the `expand` cases of `tests/blockout.test.ts` (the openings and nav derivation block, lines 145 to 192).
- **AF on `main` (`5ad4a84`):** `packages/host` is the scaffold to copy (private-package fields from `packages/game`). Pins from `docs/versions.md`: `zod` 4.6.5, `vitest` 5.0.3. `biome.json` formats every file not listed under `files.includes`, so the hand-formatted fixtures must be listed there.
- **Not used:** `typescript`. The package and its tests do not import it. `blockout-lib.ts`'s `validate` is ED3D.2; `generate`, `bind` and `freshness` stay in Last Light (ED3D-D5).

## Scope

**In:** the package scaffold; the fixtures with their provenance; Zod schemas for `blockout.json` and `facility.json`; `expand`; the scanner, the literal and structure edits, and the model diff with its refusals; `FileCodec` for both files.

**Out:**

| What | Where |
|---|---|
| Validator rules, locators, seeded violations | ED3D.2 |
| Document, selection, commands (`addRoom`, `addOpening`, ...) and their tests from `level-edits.test.ts` | ED3D.3. Their expected text is kept; they are written against `patch`. |
| `checks`, `materials`, `hints` of `LevelProfile` | ED3D.2 and ED3D.8. ED3D.1 delivers the `schema`, `parse` and `patch` members as `FileCodec`; `LevelProfile<D> extends FileCodec<D>` later. |
| The Last Light `generate`, `bind`, stage and freshness code | Stays in that repository. |
| Svelte, the kit, any view | ED3D.4 and after. |

## Contract

### `packages/editor-3d` (create; private, no changeset)

```
package.json  tsconfig.json  vitest.config.ts
src/index.ts
src/format/sector.schema.ts     Trim, WindowDef, DoorDef, WallDef, Corner, SectorDef, MassDef, and the format constants
src/format/blockout.schema.ts   Style, Room, Opening, BlockoutBox, BlockoutHotspot, BlockoutLamp, Anchor, ZoneSpec, Nav, Blockout
src/format/facility.schema.ts   Facility (wings, joins, street, phases, locks)
src/format/expand.ts            wallOf, roomSector, applyOpenings, deriveNav, expand, BlockoutError
src/codec/locate.ts             scan
src/codec/print.ts              formatJsonNumber, formatJsonScalar, JsonWriteError
src/codec/layout.ts             readLayout
src/codec/structure.ts          insertElement, removeElement, insertMember, removeMember, replaceValue, setMember
src/codec/patch.ts              patchJson
src/profile/file-codec.ts       FileCodec, ParseResult, PatchResult
src/profile/last-light.codec.ts blockoutCodec, facilityCodec
src/testing/fixtures.ts         loadFixture, FIXTURE_NAMES (excluded from the public entry)
src/testing/fixtures/           the five files, SOURCE.json, literals.golden.json, expand.golden.json
```

`package.json`: `type: module`, `private: true`, `exports: { ".": "./src/index.ts" }`, `dependencies: { "zod": "4.6.5" }`, `devDependencies: { "vitest": "5.0.3" }`, scripts `test`, `test:unit`, `typecheck` as `packages/host`. `biome.json` adds `!packages/editor-3d/src/testing/fixtures` to `files.includes`. Every ported file starts with `// Extracted from The Last Light <path> (92e6704).`

### Schemas

- Zod 4, one schema per type in the sources; types are `z.infer`. Objects are `z.looseObject`: an unknown member is kept, so the diff never deletes it (§4.5).
- **A schema is a pure validator.** No defaults, transforms or coercions: for each fixture, `schema.parse(JSON.parse(text))` deep-equals `JSON.parse(text)`.
- `Corner` is `[x, z]` or `[x, z, wall]`; `wall` is a string (a cutaway group's name) or a `WallDef` with an optional `preset`. `On` is a template-literal string matching `box:*` or `wall:*`.
- `facility.schema.ts` lists the members `facility-lib.ts` reads; the rest stay unknown members.
- An issue's path is the JSON path as `(string | number)[]`.

### `src/codec/locate.ts`

```ts
export type JsonPath = readonly (string | number)[]
export interface Span { readonly start: number; readonly end: number }               // [start, end)
export type JsonKind = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null'
export interface JsonNode {
  readonly path: JsonPath
  readonly kind: JsonKind
  readonly span: Span                              // a container's span runs from its opening to its closing bracket
  readonly keySpan: Span | undefined               // the quoted key, when the node is an object member
  readonly children: readonly JsonNode[]           // members or elements, in document order
}
export interface JsonLiteral { path: JsonPath; kind: 'string' | 'number' | 'boolean' | 'null'; span: Span; text: string; value: string | number | boolean | null }
export interface Scan { readonly root: JsonNode; node(path: JsonPath): JsonNode | undefined; readonly literals: readonly JsonLiteral[] }
export class JsonScanError extends Error { readonly offset: number }
export function scan(text: string): Scan           // throws JsonScanError
```

### `src/codec/print.ts` and `structure.ts`

`formatJsonNumber` and `formatJsonScalar` are ported as they are (a number prints with no exponent and at most 4 decimals, rounded, so float noise such as `0.1 + 0.2` becomes `0.3`); a value that cannot be written throws `JsonWriteError` (Last Light's `JsonEditError`, renamed because there are no edits to fail). `applyJsonEdits` and `applyJsonValueEdits` are **not** ported: they are the path-addressed edit batch of the live-edit design, and ED3D-D4 replaced it with the model diff. What they guarded is covered where the diff is: the expected-text check by the `before-mismatch` refusal, the re-parse by `verifyPatched`, and "a no-change save is byte-identical" and "one edit changes only its own span" by the round-trip and ED3-b tests.

`structure.ts` ports the six functions of `json-structure.ts` on `scan`. Each also has a form that returns a splice (`{ start, end, text }` in the original text's coordinates) so that the diff can collect all its edits against one scan and apply them together, from the end of the text to the start.

### `src/codec/patch.ts`

```ts
export interface PatchRules {
  readonly idArrays: readonly string[]                                    // array keys matched by `id`
  readonly memberOrder: (path: JsonPath) => readonly string[] | undefined // where a new key goes in an object
}
export type PatchRefusalReason = 'unwritable-value' | 'invalid-text' | 'before-mismatch' | 'verify-failed'
export type PatchResult =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly path: JsonPath; readonly reason: PatchRefusalReason; readonly detail: string }
export function patchJson(text: string, before: unknown, after: unknown, rules: PatchRules): PatchResult
```

The rules are those of spec §4.5. The diff collects splices against one scan of `text`; they are checked for overlap and applied from the end of the text to the start (splices that insert at the same offset keep their emission order). Before it returns, `patchJson` parses the result and requires it to equal `after` with its numbers printed the way the file writes them.

### `src/profile/file-codec.ts`

```ts
export type ParseResult<D> =
  | { readonly ok: true; readonly value: D }
  | { readonly ok: false; readonly issues: readonly { path: JsonPath; message: string }[] }
export interface FileCodec<D> {
  readonly id: string                                  // 'last-light-blockout', 'last-light-facility'
  readonly schema: z.ZodType<D>
  parse(text: string): ParseResult<D>                  // invalid JSON is one issue at path []
  patch(text: string, before: D, after: D): PatchResult
}
```

## Steps

Each step starts with its test, run red, with the failure reason recorded; the red test is committed with its fix. Strict TDD applies to everything under `packages/`.

- [x] **1. Scaffold and fixtures** (`fixtures.test.ts`; `package.json`, `tsconfig.json`, `vitest.config.ts`, `src/index.ts`, `src/testing/fixtures.ts`, the five files, `SOURCE.json`, `biome.json`).
  - *Red:*
    - each fixture's byte length and sha256 equal the ones in `SOURCE.json` (repository, commit `92e6704`, source path, sha256);
    - `biome.json` lists `!packages/editor-3d/src/testing/fixtures` under `files.includes`, so `pnpm format` cannot reformat a fixture.
  - *Expected failure:* `Cannot find module './fixtures'`.
  - *Verify:* `pnpm install` (the lockfile gains the package), `pnpm --filter @mcthaydt/automata-editor-3d test`, `pnpm format` changes nothing under the fixtures.
  - *Done: red `Failed to resolve import './fixtures'`, then 8 of 8 green; `pnpm format` left the fixtures alone; typecheck needed `@types/node` 24.19.1 (the docs/versions.md pin) for `node:fs`.*
- [x] **2. Sector and blockout schemas** (`blockout.schema.test.ts`; `sector.schema.ts`, `blockout.schema.ts`).
  - *Red, by case:* the four blockouts parse; **pure validator** (parse output deep-equals the input); an unknown member of a room survives a parse; one bad value per family is refused with its path (`rooms.1.corners.0` a corner with one number, `lamps.0.color` two numbers, `zones.0.area.x` a non-pair, `nav.edges.2` a non-string, `openings.0.span` three numbers); an `on` that matches neither `box:` nor `wall:` is refused; a wall name that is neither string nor object is refused.
  - *Expected failure:* module missing.
  - *Done: red `Cannot find module './blockout.schema'`; then 25 of 25 green with the schemas as first written (eleven refusal cases, the four fixtures parse and `toStrictEqual` their own value). Typecheck then needed `| undefined` on every optional member and tuple element (`exactOptionalPropertyTypes`), which added `PartialTrim`. `src/index.ts` re-exports the schemas so knip sees them used.*
- [x] **3. Facility schema** (`facility.schema.test.ts`; `facility.schema.ts`).
  - *Red:* `facility.json` parses and is its own parse; a wing whose `offset` is not three numbers, a phase whose `rooms` is not a list of strings and a lock with no `id` are each refused at their path (`wings.0.offset`, `phases.0.rooms`, `locks.0.id`); unknown members survive. Members the game does not read (`differences`, `hints`, the `why` notes) are typed as loosely as `facility-lib.ts` treats them.
  - *Expected failure:* module missing.
  - *Done: red `Cannot find module './facility.schema'`; then 36 of 36 green (nine refusal cases, adding a lock `kind` outside `key|code|power|latch|barricade`, a `carry` outside `none|world`, a door rule that is neither a word nor a fact, a join side naming nothing, a street without `clear` and a three-number street point to the three in the plan). The member types come from `facility-lib.ts`'s `Manifest`, which is stricter than the plan's first sketch of `facility-plan.ts`.*
- [x] **4. `expand`** (`expand.test.ts`, the Last Light cases of `tests/blockout.test.ts` lines 145 to 192 with the game's imports removed; `expand.ts`).
  - *Red, by case:*
    - an opening splits both facing walls and adds the connector, north-west corner first;
    - nav is derived and crosses the opening through its door; a derived edge named in `nav.drop` is left out, in either direction; with `derive: false` the nav the file writes is taken, without its `on` attachments;
    - a box loses its `role` and a hotspot its `on`; a style and a wall preset apply, and an unknown one is refused with `BlockoutError`;
    - an opening no pair of facing walls covers, and an opening that names an unknown room, are refused;
    - for each blockout fixture, `expand` equals `expand.golden.json` whole, which Last Light's own `expand` produced once at `92e6704` (`record-expand.mjs`, the recording command is in `SOURCE.json`; the golden's sha256 is checked by `fixtures.test.ts`).
  - *Expected failure:* module missing.
  - *Done: red `Cannot find module './expand'` and `GOLDEN_NAMES is not iterable`; then 49 of 49 green on the first run of the port, including the four fixtures against the golden. Typecheck then asked for explicit return types (`isolatedDeclarations`) and non-null assertions came out of the tests. Not ported: the starter-blockout case (`starterBlockout` is `blockout-lib.ts`'s scaffold, not the format) and the `validate` calls (ED3D.2).*
- [x] **5. Scanner** (`locate.test.ts`, the cases of `json-edit.test.ts` for `listJsonLiterals` on `scan`; `locate.ts`).
  - *Red, by case:*
    - the sample from the Last Light test: each number has its path and span, minus included;
    - every member has a key span, every container a span covering its braces, and `node(path)` finds a node and its children in order;
    - the five fixtures' literal spans equal `literals.golden.json` (generated once from Last Light's `listJsonLiterals` at `92e6704`; the recording command is in `SOURCE.json`);
    - for every literal of every fixture, `JSON.parse(text.slice(start, end))` equals the value at that path in `JSON.parse(text)`;
    - a corpus of invalid texts each throws `JsonScanError` with an offset inside the text: trailing comma, single quotes, a comment, `01`, `.5`, `NaN`, a raw newline inside a string, an unterminated string, a missing colon, trailing garbage, a no-break space as whitespace, empty input;
    - a corpus of valid texts that `JSON.parse` accepts is accepted: `1e3`, `-0`, `"é"`, `[]`, `{}`, nested empties, tabs and CRLF;
    - a duplicate key in one object throws, naming the key.
  - *Expected failure:* module missing.
  - *Done: red `Cannot find module './locate'`; then 92 of 92 green on the first run (the 42 new cases include the five fixtures against `literals.golden.json`, which Last Light's TypeScript 5.9.3 scanner recorded through `record-literals.mjs`; its sha256 is checked by `fixtures.test.ts`). The scanner is `scanJson` from Last Light's plan view with member and container spans, JSON-only whitespace, raw-control-character and duplicate-key refusals added. The returned shape is a node tree (`root`, `node(path)`, `children`) and not the two maps the first sketch of this plan had, because the structure edits need each container's children in order.*
- [x] **6. Printing values** (`print.test.ts`, the `formatJsonNumber` case of `json-edit.test.ts` with `JsonEditError` renamed `JsonWriteError`; `print.ts`).
  - *Red:*
    - `formatJsonNumber` writes no exponent and trims float noise to 4 decimals (`0.1 + 0.2` is `0.3`, `-1.23456` is `-1.2346`, `-0.00001` is `0`, `12`, `0.0001`); `NaN` and `1e22` throw `JsonWriteError` (the latter naming the exponent);
    - `formatJsonScalar` writes strings as JSON strings (quotes, backslashes and newlines escaped; accented letters as they are), booleans and `null`, numbers through `formatJsonNumber`, and refuses an object;
    - for every number literal of the five fixtures, the printed form of its value parses back to the same number when the file wrote at most 4 decimals, so printing a number the file already has never changes it.
  - *Expected failure:* module missing. The number assertions are not edited.
  - *Done: red `Cannot find module './print'`; then 101 of 101 green on the first run.*
  - *Deviation recorded:* `applyJsonEdits` is not ported (see Contract), and the plan's first sketch of this step (literal edit batches on the four files) moves to steps 8 and 10, where the same guarantees are asserted on `patchJson`.
- [ ] **7. Structure edits and layout** (`structure.test.ts`, `layout.test.ts`, the structure cases of `level-edits.test.ts` lines 60 to 106; `layout.ts`, `structure.ts`).
  - *Red:*
    - on each fixture, appending a copy to `rooms`, `boxes`, `hotspots` and `lamps` is a pure insert, written on one line if its neighbour is and over several if not, and removing it restores the text byte for byte;
    - insert in the middle, remove the first and the last element, `[]` round trips;
    - a member goes where the schema's order puts it and packs on its neighbour's line when it fits; a duplicate key is refused;
    - a path that is missing or not a container is refused;
    - `readLayout` returns the indent unit and packing width of each fixture (2 spaces, 120) and of three small samples (tabs, 4 spaces, one-line).
  - *Expected failure:* module missing.
- [ ] **8. The diff** (`patch.test.ts`; `patch.ts`, without the refusals of step 9).
  - *Red, by rule of spec §4.5:*
    - equal models give the same text (every fixture);
    - **ED3-b:** setting the clinic hall's `ceiling` from 4.9 to 5.1 changes exactly that number's span: the longest common prefix and suffix of old and new text leave only `4.9` against `5.1`;
    - maps keyed by id: a new `anchors` key is inserted in order, a removed one is removed, a changed value is a literal edit;
    - id arrays: a new room id inserts at its position, a missing id is removed, a changed room is edited in place, the same ids in another order are diffed by position and still give the new model;
    - positional arrays: equal length is element by element (a moved corner changes only its two numbers); a removed corner removes one element (prefix and suffix trimmed); an added corner inserts; one removed and two added pairs the first and inserts the second;
    - a wall that goes from a string to an object is replaced whole, in the neighbours' layout;
    - an unknown member of a changed room is still there afterwards, byte for byte.
  - *Expected failure:* module missing.
- [ ] **9. Refusals and verification** (`patch.refusal.test.ts`; `patch.ts`, which exports `verifyPatched(text, after)` for the test and not from the public entry).
  - *Red, by case (**ED3-o**):*
    - `unwritable-value`: `NaN`, `Infinity` and `1e22` in `after` refuse with the path of the value, and nothing is returned to write; `0.12345` is written as `0.1235` and `0.1 + 0.2` as `0.3`, and the check compares the re-parse with `after` rounded the same way;
    - `invalid-text`: a text with a trailing comma refuses, with the scanner's offset in `detail`;
    - `before-mismatch`: a `before` that is not what the text parses to refuses at the first differing path;
    - `verify-failed`: `verifyPatched` on a text that does not parse to `after` (a wrong edit set built in the test) refuses at the first differing path; this is the guard against a codec bug, so the test builds the bug;
    - a refused patch carries no text, so a caller cannot save a half result.
  - *Expected failure:* the step 8 `patchJson` writes `NaN` as text and returns `ok: true` for the other cases, and `verifyPatched` does not exist.
- [ ] **10. File codecs and the round trip** (`last-light.codec.test.ts`, `roundtrip.test.ts`; `file-codec.ts`, `last-light.codec.ts`, `src/index.ts`).
  - *Red, by case:*
    - `parse` returns the value for each fixture and issues with paths for a bad file; invalid JSON is one issue at `[]`;
    - `patch(text, v, v)` is byte-identical for each of the five files;
    - a seeded run (a fixed linear congruential seed in the test, not `Math.random`): 60 edits per fixture drawn from nudge a number, change a string to another one already in the file, remove an element, add a copy with a new id. Each patched text parses to the edited model, and the changed region (found from the longest common prefix and suffix of old and new text) is the only region that differs;
    - the same edit applied and then reverted through `patch(text2, after, before)` returns the original bytes for the number and string cases and for add then remove; a removal then re-add of a middle element is checked to equal the model only, and the test says why;
    - the public entry exports the codecs, the schemas, `expand`, `patchJson`, `scan` and their types, and nothing from `src/testing`.
  - *Expected failure:* module missing.
- [ ] **11. Gates and records.**
  - *Run in order:* `pnpm format`, `pnpm docs:stack` (commit if it changes), `pnpm check` (lint, typecheck, boundaries, style, knip, unit tests).
  - *Purity:* a test reads the source of `src/format`, `src/codec` and `src/profile` and fails on an import of `svelte`, `typescript`, `effect`, a DOM global, `Date`, a timer or `Math.random` (ED3D-D1), so the rule is enforced and not only written.
  - *Records:* tick ED3D.1 in 02 for the gates that passed (locally checked only; CI verified and Owner accepted stay open); add an execution row; update 03.

## Verification

Local, Node 24: `pnpm check` and the package's tests. CI runs the same unit job; the package has no browser or GPU suite, so parity and e2e are not selected and are reported as omitted. No golden changes anywhere: this package touches no sim code.

**Owner acceptance:** none of its own. What the codec guarantees is judged in the ED3D.12 iPad pass through ED3-b and ED3-o.

## Risks and how the plan answers them

- **The scanner is new code in a safety-critical position.** Four independent checks bound it: Last Light's own `json-edit` tests, the golden literal list from Last Light's TypeScript-based scanner, `JSON.parse` agreement on every literal, and the invalid-input corpus. The verify step in `patchJson` re-parses every result.
- **Fixtures from another repository.** `SOURCE.json` records repository, commit and sha256, and the fixtures test fails if a file drifts. A newer Last Light revision is a deliberate update of fixtures, goldens and expected counts together.
- **The format may grow (non-rectangular rooms, props: editor-gaps #26, #27).** Unknown members are kept, so a newer file still opens and saves without loss; its new members are not edited until a schema amendment.
