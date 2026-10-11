# M1.3 Content compiler: TDD plan

- **Spec:** [`2026-10-11-m1-content-design.md`](../specs/2026-10-11-m1-content-design.md)
- **Branch:** `claude/af-m1-content-tts573`, stacked on PR #4 (`claude/ruken-first-af-60n4bh`)
- **Progress:** 0 / 13 tasks
- **Commands:** `pnpm --filter @mcthaydt/automata-content test:unit` (focused), `pnpm --filter @mcthaydt/automata-content typecheck`, `pnpm check` (before each commit), `pnpm --filter @mcthaydt/automata-content exec vitest run --project browsers` (parity).

Every task: write the test, run it, see it fail for the stated reason, write the least code, see it pass, `pnpm format`, commit with the tick.

## Files

| File | Produces | Consumes |
|---|---|---|
| `packages/content/{package.json,tsconfig.json,vitest.config.ts}` | the package, node + browsers projects | — |
| `src/hash/content-hash.ts` | `canonicalContentJson`, `contentHash` | `@mcthaydt/automata-sim` root (`canonicalJson`, `xxhash64`, `hex64`) |
| `src/diagnostics/diagnostic.ts` | `Diagnostic`, `formatDiagnostic`, `sortDiagnostics` | — |
| `src/locate/locate-keys.ts` | `locateKeys(text) → KeyIndex`, `positionOf(index, path)` | — |
| `src/parse/parse-document.ts` | `parseDocument(file, text, schema) → { value } \| { diagnostics }` | smol-toml, zod, locate |
| `src/schema/content-schema.ts` | `defineContentSchema`, `contentRef`, `localized`, markers | zod |
| `src/schema/resolve-markers.ts` | `collectMarkers(value)`, `replaceMarkers(value)` | markers |
| `src/tuning/tuning.ts` | `compileTuning(doc) → { values, meta, diagnostics }` | diagnostic, locate |
| `src/flow/flow-graph.ts`, `src/flow/flow-mermaid.ts` | `checkFlow`, `FlowGraph`, `FlowCapabilities`, `flowMermaid` | diagnostic |
| `src/game/game-facts.ts` | `game.toml`/`assets.toml` schemas, `rukenFields` | zod |
| `src/locale/messages.ts` | `messageKey`, `messageCatalog`, `checkTranslation` | markers |
| `src/types/render-types.ts` | `renderContentTypes` (`content.d.ts`) | zod `toJSONSchema` |
| `src/generate/content-generator.ts` | `defineContentGenerator`, `ContentGenerator` | effect |
| `src/compile/errors.ts`, `src/compile/compile-content.ts`, `src/compile/write-compiled.ts` | `compileContent`, `writeCompiled`, `verifyCompiled`, errors | everything above, `effect/FileSystem` |
| `src/preload/preload-list.ts` | `preloadList` | `effect/FileSystem` |
| `src/vite/automata-content.ts`, `src/vite/index.ts` | `automataContent()` | compile, vite |
| `src/cli/main.ts`, `src/cli/run-cli.ts` | `automata-content check\|build [--verify]` | compile, `@effect/platform-node` |
| `src/testing/fixture-tree.ts` | `withFixtureTree(files)` temp folders | node:fs |

## Tasks

### T1 Package scaffold and the hash adapter
- [ ] Test `hash/content-hash.test.ts`: `contentHash('{"a":1}')` equals `hex64(xxhash64(<sim utf8 bytes>))`; a lone surrogate encodes the same as the sim's `utf8`; `canonicalContentJson({b:1,a:[2,1]})` is `{"a":[2,1],"b":1}`. Fails: module missing.
- [ ] Implement with `TextEncoder` and the sim's root exports.
- [ ] `hash/content-hash.parity.test.ts`: a fixed string's hash is the same pinned hex in Chromium, WebKit and Firefox.

### T2 Diagnostics
- [ ] Test: `formatDiagnostic` gives `content/a.toml:3:5  x.y  message`; `sortDiagnostics` orders by file, line, column, path. Fails: missing.
- [ ] Implement.

### T3 Key positions
- [ ] Tests over FloorFifty-shaped text: top-level key; `[table]` key; `[[transitions]]` index 3 `to`; dotted key `a.b = 1`; key inside a multi-line string is not indexed; multi-line array skipped; `positionOf` falls back to the deepest indexed prefix, then `1:1`. Fails: missing.
- [ ] Implement the line scanner.

### T4 Parse one document
- [ ] Tests: invalid TOML → one diagnostic at smol-toml's line/col; Zod issue → diagnostic at the key; unknown key in a strict object → at that key; valid → value. Fails: missing.
- [ ] Implement.

### T5 Schemas, references, localized text
- [ ] Tests: `defineContentSchema` validates kind names; `contentRef('weapon')` parses an ID into a marker; `collectMarkers` finds refs and localized text inside arrays, records and unions with their paths; `replaceMarkers` returns plain strings. Fails: missing.
- [ ] Implement.

### T6 Tuning
- [ ] Tests: bare and ranged values; out of range message at `value`; `min > max`, `step <= 0`, ranged non-number, bad name; meta has `int`/`float`; an optional game schema rejects an unknown name. FloorFifty's `tuning.toml` with ranges from `tuning.ts` compiles. Fails: missing.
- [ ] Implement.

### T7 Flow graph
- [ ] Tests: FloorFifty `flow.toml` passes; duplicate pair, self-transition, transition into entry, unreachable screen, dead end (and `terminal` exempts it), unknown entry; with capabilities: undeclared pair, missing pair, wrong target, unknown style. `flowMermaid` output pinned. Fails: missing.
- [ ] Implement.

### T8 Game facts, assets and locale keys
- [ ] Tests: `game.toml` rating enum, event names, language tag; `assets.toml` screens must be flow screens; `rukenFields` derives `languages` from translations present; `messageKey('weapon','melee/sword','info.displayName')` is `content_weapon_melee_sword_info_display_name`; key collision; translation missing/extra key. Fails: missing.
- [ ] Implement.

### T9 Type declarations
- [ ] Tests: `renderContentTypes` for a schema with string, number, enum, optional, array, record, ref, nested object gives pinned text; an unsupported field renders `unknown` with a comment; the output typechecks with `tsc` in a fixture consumer and a wrong ID literal fails it. Fails: missing.
- [ ] Implement.

### T10 Compile and write (Effect)
- [ ] Tests (temp fixture trees, `NodeFileSystem` layer): minimal fixture compiles to pinned JSON and hash; source key/file order does not change the hash, a value change does; several broken files report every diagnostic sorted; dangling ref; reserved/duplicate kind → `InvalidContentConfig`; generator files appear in `files`, a clash or escaping path → `InvalidContentConfig`; `writeCompiled` writes every file; `verifyCompiled` reports a hand-edited `content.json`. Fails: missing.
- [ ] Implement discovery, the ordered steps and the built-in generators.

### T11 Preload list
- [ ] Tests: files of `preload_screens` in order, deduplicated; default is the flow entry; `dir/*` accepted when the folder exists; missing files listed together; absolute or `..` paths refused. Fails: missing.
- [ ] Implement.

### T12 Vite plugin
- [ ] Tests: `vite build` of a fixture app importing `virtual:automata/content` embeds the hash; a broken file fails the build with the formatted line; dev server: a valid save emits `automata:content` with the new hash, a broken save emits `automata:content-error` and keeps the old module. Fails: missing.
- [ ] Implement.

### T13 CLI and exports
- [ ] Tests: `runCli(['check'])` exit 0 on the minimal fixture, 1 with authored errors (printed lines), 2 on a config error; `build` writes; `check --verify` fails after a hand edit. Fails: missing.
- [ ] Implement; export the public API from `src/index.ts`; `pnpm check` and the browsers project green.

## Execution log

- 2026-10-11: spec committed (`e356550`).
