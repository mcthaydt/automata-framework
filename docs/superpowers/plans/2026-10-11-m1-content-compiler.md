# M1.3 Content compiler: TDD plan

- **Spec:** [`2026-10-11-m1-content-design.md`](../specs/2026-10-11-m1-content-design.md) (extract and improve FloorFifty's compiler, §0)
- **Branch:** `claude/af-m1-content-tts573`, stacked on PR #4 (`claude/ruken-first-af-60n4bh`)
- **Progress:** 0 / 14 tasks
- **Commands:** focused `pnpm --filter @mcthaydt/automata-content exec vitest run --project node <file>`; `pnpm --filter @mcthaydt/automata-content typecheck`; `pnpm check` before each commit; parity `pnpm --filter @mcthaydt/automata-content exec vitest run --project browsers`.

Every task: port or write the test, run it, see it fail for the stated reason (usually "module not found" first, then the assertion), write the least code, see it pass, `pnpm format`, commit with the tick. "Port" means the FloorFifty `122a220` test named, rewritten against the AF API with the same cases.

## Files

| File | Produces | Consumes |
|---|---|---|
| `packages/content/{package.json,tsconfig.json,vitest.config.ts}` | the package; `node` and `browsers` projects | — |
| `src/diagnostics/diagnostic.ts` | `Diagnostic`, `DiagnosticCode`, `formatDiagnostic`, `sortDiagnostics` | — |
| `src/parse/locate-keys.ts` | `locateKeys(text)`, `positionOf(index, keyPath)` | — |
| `src/parse/parse-document.ts` | `parseDocument(source, schema)` | smol-toml, zod, locate-keys |
| `src/schema/content-schema.ts` | `defineContentSchema`, `contentRef`, `localized`, `ContentSchemaDef` | zod |
| `src/schema/references.ts` | `resolveMarkers(items, located)` → data, refs checked, localized texts | content-schema |
| `src/tuning/check-tuning.ts`, `src/tuning/tuning-table.ts` | `checkTuning`, `checkTuningLayer`, `TunableDeclarations`, table render/update/verify | diagnostic |
| `src/flow/check-flow.ts`, `src/flow/flow-mermaid.ts` | `checkFlow`, `FlowCapabilities`, `FlowGraph`, `flowMermaid` | diagnostic |
| `src/palette/palette.ts`, `src/palette/endesga-64.ts` | palette schema and check, `parsePaintNetPalette`, `ENDESGA_64` | zod |
| `src/game/game-facts.ts` | `game.toml`/`assets.toml` schemas, `rukenFields`, checks | `@ruken/manifest` |
| `src/locale/messages.ts` | `messageKey`, `renderMessages`, `checkTranslation` | — |
| `src/hash/canonical-file.ts`, `src/hash/content-hash.ts` | `canonicalFile`, `contentHash` | `@mcthaydt/automata-sim/hash` |
| `src/generate/content-generator.ts`, `src/generate/render-types.ts` | `defineContentGenerator`, built-in generators, `content.d.ts` | zod `toJSONSchema` |
| `src/compile/{errors,read-sources,compile-content,write-outputs}.ts` | `compileContent`, `buildContent`, `verifyContent`, tagged errors | everything above, `@effect/platform` `FileSystem` |
| `src/preload/preload-list.ts` | `preloadList` | `FileSystem` |
| `src/vite/automata-content.ts`, `src/vite/index.ts` | `automataContent()` | compile, vite |
| `src/cli/run-cli.ts`, `src/cli/main.ts` | `automata-content` | compile, `@effect/platform-node` |
| `src/testing/fixtures/{valid,equivalent-a,equivalent-b}/`, `src/testing/fixture-game.ts`, `src/testing/temp-tree.ts` | the FloorFifty-shaped fixture game and temp copies | node:fs |
| `src/index.ts` | the public API | — |

## Tasks

### T1 Scaffold and diagnostics
- [x] Port `parse.test.ts` "formats source-aware diagnostics": `formatDiagnostic` gives `content/tuning.toml:12:1  GRAVITY  outOfRange: expected -1200..-100, received -2000`; `sortDiagnostics` orders by file, line, column, keyPath, code. Fails: module missing.
- [x] Implement `diagnostics/diagnostic.ts`; add `tsconfig.json` and `vitest.config.ts` (sim's shape).

### T2 Key positions
- [x] Test `locate-keys`: top-level key; `[table]` key; `[[transitions]]` third element's `to`; dotted key `a.b = 1`; quoted key; a `key =` inside a multi-line string is not indexed; a multi-line array is skipped; `positionOf` falls back to the deepest indexed prefix, then `1:1`. Fails: module missing.
- [x] Implement the line scanner.

### T3 Parse one document
- [x] Port `parse.test.ts` "maps unknown keys … to source diagnostics" and "reports a TOML syntax error against the file that carries it", plus: a missing required key is `missingField`, a wrong type is `invalidType`, each at its key's line and column; a syntax error is `invalidToml` at smol-toml's line/col. Fails: module missing.
- [x] Implement (FloorFifty `parseFile`, `toDiagnostics`).

### T4 Schemas and references
- [x] Port `validate/references.test.ts` cases (unknown reference, wrong kind) through `contentRef`; plus kind validation, reserved kinds, references inside arrays/records/unions, `localized` collection with key paths. Fails: module missing.
- [x] Implement `content-schema.ts` and `references.ts`.

### T5 Tuning
- [ ] Port `validate/bounds.test.ts` (complete base, partial layer, int, invariant, inclusive endpoints, unknown name, base transcribed from declarations) with FloorFifty's `TUNABLES` subset as a fixture; add authored-range cases (in range, out of range at `value`, `min > max`, `step <= 0`, ranged non-number, bad name) and the code-owned refusal of inline ranges. Port `compiler.test.ts` "the author guide" to `tuning-table`. Fails: module missing.
- [ ] Implement.

### T6 Flow
- [ ] Port `validate/flow.test.ts` with FloorFifty's real `flow.toml` and its `FLOW_TARGETS`/`SCREEN_IDS`/`TRANSITION_STYLES` as a fixture capability map; add: no capabilities (graph rules only), `terminal` exempts a dead end, unknown style, sorted output, pinned `flowMermaid`. Fails: module missing.
- [ ] Implement.

### T7 Palette
- [ ] Test: `parsePaintNetPalette` of `docs/art/palettes/endesga-64.txt` equals `ENDESGA_64` (64 unique, in order); `palette.toml` with uppercase hex is stored lowercase; duplicate, bad hex, 1 color and 257 colors are `invalidPalette`. Fails: module missing.
- [ ] Implement.

### T8 Messages, game facts, Ruken fields
- [ ] Port `messages.test.ts` (keys, inlang `$schema`, stays out of the payload); add key collision, translation missing/extra keys, `languages` derived with `en` required, rating and event-name checks, and a `ruken.toml` built around `rukenFields` that `@ruken/manifest`'s `parseManifest` accepts. Fails: module missing.
- [ ] Implement.

### T9 Canonical file and hash
- [ ] Port `determinism.test.ts` `canonicalizeValue` cases to `canonicalFile`; test `contentHash(data)` equals `hex64(xxhash64(utf8(canonicalJson(data))))`; `content-hash.parity.test.ts` pins one hash in Chromium, WebKit and Firefox. Fails: module missing.
- [ ] Implement.

### T10 Generators and `content.d.ts`
- [ ] Test `defineContentGenerator` (files, diagnostics, a throw becomes `generatorFailed`); `renderTypes` pinned text for strings, numbers, enums, optionals, arrays, records, references and nested objects, `unknown` with a comment otherwise; the fixture game's `content.d.ts` typechecks in a consumer and a wrong ID literal does not. Fails: module missing.
- [ ] Implement.

### T11 Compile, build, verify
- [ ] Port `parse.test.ts` "readSources …" and `compiler.test.ts` (check writes nothing, build writes, retains prior bytes and leaves no temps after invalid input, reports a missing required source, detects missing/malformed/different-bytes outputs, accepts what it just wrote) and `determinism.test.ts` "equivalent trees"; add: several broken files report every diagnostic sorted, `InvalidContentConfig` cases, generator clash/escape, nested IDs and `invalidId`, the hash moves on any authored change. Fails: module missing.
- [ ] Implement `read-sources`, `compile-content`, `write-outputs`, `errors`.

### T12 Preload list
- [ ] Test: screens' files in order, deduplicated; default the flow entry; `dir/*` accepted when the folder exists; all missing files listed together; the result passes `parseManifest` as `[loading] preload`. Fails: module missing.
- [ ] Implement.

### T13 Vite plugin
- [ ] Port `watch.test.ts` to the dev server: a valid save sends `automata:content` with the new hash; a bad save sends `automata:content-error`, keeps the last good bytes and module; the next good save recovers; a `*.toml.example` change does nothing. Plus `vite build` embeds the hash and a broken file fails the build. Fails: module missing.
- [ ] Implement.

### T14 CLI, exports, full check
- [ ] Port `bin/content.ts` behavior as `runCli` tests: `check` 0/1, `build` writes, `check --verify-artifact` fails after a hand edit, `docs` rewrites the table, a bad command or config is 2. Fails: module missing.
- [ ] Implement; export the public API; `pnpm check`, browsers project and the full local CI run green.

## Execution log

- 2026-10-11: first spec and plan committed (`1ea5731`, `262352b`); rewritten the same day for the audit's direction (extract FloorFifty's compiler with its tests) and the integration notes (`@mcthaydt/automata-sim/hash`, Effect 3.22.2, palette).
