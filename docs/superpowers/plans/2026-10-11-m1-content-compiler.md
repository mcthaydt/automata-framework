# M1.3 Content compiler: TDD plan

- **Spec:** [`2026-10-11-m1-content-design.md`](../specs/2026-10-11-m1-content-design.md) (extract and improve FloorFifty's compiler, §0)
- **Branch:** `claude/af-m1-content-tts573`, stacked on PR #4 (`claude/ruken-first-af-60n4bh`)
- **Progress:** 15 / 15 tasks (T15: the PR #8 audit fixes), locally verified; not CI verified (hosted Actions get no runners) and not yet reviewed
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
| `src/files/content-files.ts` | `readTextIfPresent`, `listFiles`, `writeFileAtomically`, `FileError`: the only module that touches the disk | `node:fs`, effect |
| `src/compile/{errors,read-sources,built-in-generators,compile-content,write-outputs}.ts` | `compileContent`, `buildContent`, `verifyContent`, tagged errors | everything above, content-files |
| `src/preload/preload-list.ts` | `preloadList` | content-files |
| `src/vite/automata-content.ts`, `src/vite/index.ts` | `automataContent()` | compile, vite |
| `src/cli/run-cli.ts`, `src/cli/main.ts` | `automata-content` | compile |
| `src/testing/fixtures/{valid,equivalent-a,equivalent-b}/`, `src/testing/fixture-game.ts` | the FloorFifty-shaped fixture game and `copyFixture` temp copies | node:fs |
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
- [x] Port `validate/bounds.test.ts` (complete base, partial layer, int, invariant, inclusive endpoints, unknown name, base transcribed from declarations) with FloorFifty's `TUNABLES` subset as a fixture; add authored-range cases (in range, out of range at `value`, `min > max`, `step <= 0`, ranged non-number, bad name) and the code-owned refusal of inline ranges. Port `compiler.test.ts` "the author guide" to `tuning-table`. Fails: module missing.
- [x] Implement.

### T6 Flow
- [x] Port `validate/flow.test.ts` with FloorFifty's real `flow.toml` and its `FLOW_TARGETS`/`SCREEN_IDS`/`TRANSITION_STYLES` as a fixture capability map; add: no capabilities (graph rules only), `terminal` exempts a dead end, unknown style, sorted output, pinned `flowMermaid`. Fails: module missing.
- [x] Implement.

### T7 Palette
- [x] Test: `parsePaintNetPalette` of `docs/art/palettes/endesga-64.txt` equals `ENDESGA_64` (64 unique, in order); `palette.toml` with uppercase hex is stored lowercase; duplicate, bad hex, 1 color and 257 colors are `invalidPalette`. Fails: module missing.
- [x] Implement.

### T8 Messages, game facts, Ruken fields
- [x] Port `messages.test.ts` (keys, inlang `$schema`, stays out of the payload); add key collision, translation missing/extra keys, `languages` derived with `en` required, rating and event-name checks, and a `ruken.toml` built around `rukenFields` that `@ruken/manifest`'s `parseManifest` accepts. Fails: module missing.
- [x] Implement.

### T9 Canonical file and hash
- [x] Port `determinism.test.ts` `canonicalizeValue` cases to `canonicalFile`; test `contentHash(data)` equals `hex64(xxhash64(utf8(canonicalJson(data))))`; `content-hash.parity.test.ts` pins one hash in Chromium, WebKit and Firefox. Fails: module missing.
- [x] Implement. (Parity passed in Chromium, WebKit and Firefox at T14.)

### T10 Generators and `content.d.ts`
- [x] Test `defineContentGenerator` (files, diagnostics, a throw becomes `generatorFailed`; T15 changed this to `InvalidContentConfig`); `renderTypes` pinned text for strings, numbers, enums, optionals, arrays, records, references and nested objects, `unknown` with a comment otherwise; the fixture game's `content.d.ts` typechecks in a consumer and a wrong ID literal does not. Fails: module missing.
- [x] Implement.

### T11 Compile, build, verify
- [x] Port `parse.test.ts` "readSources …" and `compiler.test.ts` (check writes nothing, build writes, retains prior bytes and leaves no temps after invalid input, reports a missing required source, detects missing/malformed/different-bytes outputs, accepts what it just wrote) and `determinism.test.ts` "equivalent trees"; add: several broken files report every diagnostic sorted, `InvalidContentConfig` cases, generator clash/escape, nested IDs and `invalidId`, the hash moves on any authored change. Fails: module missing.
- [x] Implement `read-sources`, `compile-content`, `write-outputs`, `errors`. Done with file access in `files/content-files.ts` (`node:fs` in Effect) instead of `@effect/platform`, and the built-in generators in `compile/built-in-generators.ts`.

### T12 Preload list
- [x] Test: screens' files in order, deduplicated; default the flow entry; `dir/*` accepted when the folder exists; all missing files listed together; the result passes `parseManifest` as `[loading] preload`. Fails: module missing.
- [x] Implement. Also added `pathKind` to `files/content-files.ts`; no `game.toml` gives an empty list.

### T13 Vite plugin
- [x] Port `watch.test.ts` to the dev server: a valid save sends `automata:content` with the new hash; a bad save sends `automata:content-error`, keeps the last good bytes and module; the next good save recovers; a `*.toml.example` change does nothing. Plus `vite build` embeds the hash and a broken file fails the build. Fails: module missing.
- [x] Implement. `root` defaults to Vite's root; the tests record HMR events by replacing `server.ws.send` on a middleware-mode server.

### T14 CLI, exports, full check
- [x] Port `bin/content.ts` behavior as `runCli` tests: `check` 0/1, `build` writes, `check --verify-artifact` fails after a hand edit, `docs` rewrites the table, a bad command or config is 2. Fails: module missing.
- [x] Implement; export the public API; `pnpm check`, browsers project and the full local CI run green.

### T15 PR #8 audit fixes (each with a failing test first)
- [x] The dev plugin recovers on the next good save after a crash (test timed out before the fix).
- [x] `nan`/`inf`/`-inf` refused as `invalidType` at the key, in documents and in tuning; TOML dates become ISO strings; CRLF normalized before parsing, so multi-line strings hash the same.
- [x] Ruken fields and asset paths checked by Ruken's `parseManifest` (`game/ruken-check.ts`); the copied path, rating, language and event-name rules deleted.
- [x] The bin runs from a path with spaces (`fileURLToPath` + `normalizePath`).
- [x] `outputs.txt` lists every output; `build` removes listed outputs it no longer produces, and `--verify-artifact` reports them.
- [x] Low: `skippedFile` warnings for misnamed files; schema and generator throws are `InvalidContentConfig` (code `generatorFailed` removed).
- [x] Re-audit at `7430820`: `__proto__` keys refused (`reservedKey`; `constructor` and `prototype` stay data), translation names must be language tags, a BOM is stripped, near-miss document names warn.
- [x] Spec updated, with the M2.2 decision that store and display metadata in `game.toml` stays out of the save-gating hash.

## Execution log

- 2026-10-11: first spec and plan committed (`1ea5731`, `262352b`); rewritten the same day for the audit's direction (extract FloorFifty's compiler with its tests) and the integration notes (`@mcthaydt/automata-sim/hash`, Effect 3.22.2, palette).
- 2026-10-11: T1–T10 landed (`71fac06`..`5ec5f1c`): diagnostics with positions, the key locator, document parsing, schema registration and references, tuning, flow, palette, hash, messages, game facts, generators and `content.d.ts`.
- 2026-10-11: T11 landed: compile, build and verify over one file-access module. Rulings: `@effect/platform` dropped for `node:fs` behind `files/content-files.ts` (coordinator, so `@mcthaydt/automata-node` is a one-file swap); `tuning.toml`/`flow.toml` are required when the game passes `tunables`/`flow`; translations are checked only when every source parsed; generators run only on content that passed every check. `Data.TaggedError` classes extend an annotated constant because `isolatedDeclarations` cannot type a call in `extends`.
- 2026-10-11: T12 landed: `preloadList` compiles, then checks each preload file (or `dir/*` folder) in `dist/` and reports every missing one as `missingAsset` at its `assets.toml` line.
- 2026-10-11: T13 landed: the `automataContent()` Vite plugin (serialized builds, 50 ms debounce, `automata:content` / `automata:content-error`, last good module kept) with FloorFifty's watch tests ported to a dev server, plus `vite build` embedding the hash and failing on a broken file.
- 2026-10-11: T14 CLI landed: `runCli` with check, build, docs and `--verify-artifact` (outputs and the guide's table), exit codes 0/1/2, and a bin Node runs directly. Found by the bin test: a config loaded through another module runner had its own copy of `content-schema.ts`, so `instanceof` missed its markers; markers now carry a brand and the registries live on `globalThis` (test: a second module copy).
- 2026-10-11: rebased on PR #4 at `476688e`. Local CI on Node 24.21.0: lint, typecheck, boundaries, style and every unit test (`turbo --force`: content 150, sim 149, check-style 22, check-boundaries 29) pass; parity passes in Chromium, WebKit and Firefox for content (3) and sim (165). `ci.yml`'s parity job runs only the sim's browsers project, so the content hash parity test is not in hosted CI yet (request to the integration owner).
- 2026-10-11: T15 landed (`275d0ce`..`e00bd89`), the coordinator's audit of PR #8: crash recovery in the dev plugin, nan/inf refused, dates kept as ISO strings, CRLF normalized, Ruken's `parseManifest` instead of copied rules, the bin in paths with spaces, stale-output removal through `outputs.txt`, `skippedFile` warnings, and game-code throws as `InvalidContentConfig`. Ruling: the M2.2 hash split for `game.toml` store metadata is recorded in spec §3.2, not built now. Deviation: the verify test for a deleted `game.toml` asserts the two lines it is about, because `game` is also in `content.json`, so the content outputs are stale too.
- 2026-10-11: after T15, local CI on Node 24.21.0 (`turbo --force`): lint, typecheck, boundaries, style and unit tests pass (content 167, sim 149, check-style 29, check-boundaries 29); parity passes in Chromium, WebKit and Firefox for content (3) and sim (165).
- 2026-10-11: T15 re-audit (`b103fd6`): the `__proto__` regression from `toJsonValues` (refused as `reservedKey` rather than kept with `defineProperty`, because Zod and canonical JSON copy objects with assignment and would drop it again), language-tag translation names, BOM stripping in `readSources`, and near-miss warnings at the top of `content/` (coordinator override of the earlier scope-out). Then (coordinator): an `outputs.txt` entry with any backslash is ignored, so `..\x` cannot leave the folder on Windows; the test lists a file literally named `..\x` on Linux and checks that it is neither reported nor deleted. Accepted as documented: an output folder from before `outputs.txt` keeps its stale files for one build, and `assets.toml` skips the Ruken check while `game.toml` fails to parse.
- 2026-10-11: after the re-audit fixes, local CI on Node 24.21.0 (`turbo --force`) is green (content 172, sim 149, check-style 29, check-boundaries 29); parity passes in Chromium, WebKit and Firefox (content 3, sim 165).
- 2026-10-11: after the backslash fix (`4bf7911`), local CI on Node 24.21.0 (`turbo --force`) is green (content 173, sim 149, check-style 29, check-boundaries 29); parity passes in Chromium, WebKit and Firefox (content 3, sim 165).
