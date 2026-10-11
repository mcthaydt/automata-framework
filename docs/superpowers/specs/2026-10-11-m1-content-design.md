# M1.3 Content compiler (`@mcthaydt/automata-content`)

- **Date:** 2026-10-11
- **Status:** Draft, for review in this lane's PR. Stacks on PR #4 (`claude/ruken-first-af-60n4bh`).
- **Lane:** content (`docs/04-how-we-build.md` §Lanes). Owns `packages/content/` and changes nothing outside it. The lane rules allow an additive `./hash` export in `packages/sim`; it is on hold while the integration thread decides whether XXH64 moves to a small shared hash package (§2), so content reads the hash through one adapter file that is the only line to change when that lands.
- **Builds on:** A0+A1 spec §5 (the design this task implements), master spec §9 (M1 content scope), extraction map §`content`.
- **Sources (read at these commits):**
  - FloorFifty `122a220`: `content/flow.toml`, `content/tuning.toml`, `docs/content-authoring.md`, `packages/content/src/{parse,diagnostics,messages,canonicalize}.ts`, `packages/content/src/validate/{flow,bounds}.ts`, `packages/shared/src/common/tuning.ts`, `deploy/tools/ruken-pack.ts` (`rukenToml` line 92, `preloadFor` line 160).
  - RukenApp `b30d31b`: `packages/manifest/src/types.ts` (schema 1: `[content]`, `[analytics]`, `[loading]`), `docs/versions.md` (pins).
  - AF `17f18c0`: `packages/sim/src/hash/{xxhash64,canonical}.ts` (XXH64 and canonical JSON, shared with the sim).

## 1. Goal and boundaries

A game author writes TOML under `content/`. `automata-content` turns it into one canonical JSON artifact, its XXH64 hash, a `content.d.ts` with typed accessors, and the derived files the rest of AF needs: the source-language message catalog, the flow graph, and the Ruken manifest fields (`[content]`, `[analytics]`, `[loading] preload`). A save with any problem reports every problem as `file:line:col  <path>  <message>` and writes nothing.

**Deliverables**
1. `defineContentSchema`, `contentRef`, `localized` (schema registration).
2. `compileContent` (an Effect program over `FileSystem`) and its typed errors.
3. Built-in documents: `tuning.toml` (ranges), `flow.toml` (screen graph), `game.toml` (Ruken `[content]`/`[analytics]` facts), `assets.toml` (per-screen files).
4. Outputs: `content.json`, `content.hash`, `content.d.ts`, `locales/<source>.json`, `tuning-meta.json`, `flow.mmd`.
5. Generators: `defineContentGenerator` hook, plus the built-in locale, flow, manifest-fields and preload generators.
6. `automataContent()` Vite plugin with `virtual:automata/content`.
7. A small CLI, `automata-content check|build`, that exits non-zero on any error (the `cli` package wraps it in M1.8).
8. `src/hash/content-hash.ts`: the one adapter over the shared XXH64 and canonical JSON (§2).

**Not in M1.3**
- Wiring content into the sim (`SimOptions.content`, snapshot `contentHash`, `SnapshotMismatchError`): M2.2.
- Writing `ruken.toml` and zipping: the **ship** lane (M1.2). Content returns the fields; ship merges, parses with `@ruken/manifest` and validates.
- The telemetry catalog generator (A0+A1 §5 lists it as later). `analytics.custom_events` comes from `game.toml` until then.
- Hot-restarting the sim on change (A2/M1.5 consumes the plugin's event).
- Per-subsystem revisions (FloorFifty's `rulesetRevision`/`courseRevision`). M1 has one hash; M2.0 decides whether replays need finer ones.
- Translation tooling beyond checking that a translation file has exactly the source keys.

## 2. Ownership

| State | Owner | Writers | Consumers |
|---|---|---|---|
| Authored TOML under `content/` | the game | authors | the compiler (read only) |
| Locale translations `content/locales/<lang>.json` | the game | translators | the compiler (checks keys) |
| Compiled outputs (`generated/` by default) | `content` | the compiler only; never hand-edited | runtime (M1.5), sim (M2.2), ship (M1.2), ui (strings) |
| Content hash | `content` (computes) | — | sim snapshot header (M2.2), boot hash check (M1.5), evidence identity |
| XXH64 + canonical JSON | `sim` today (`src/hash/`), exported from its root; a shared hash package if integration decides so | sim lane / integration | content (through `src/hash/content-hash.ts` only), sim |
| Ruken manifest field types | Ruken `@ruken/manifest` `types.ts` | Ruken | content mirrors the four fields it emits until ship vendors the package (§9) |

Until the hash location is settled, `content-hash.ts` imports `canonicalJson`, `xxhash64` and `hex64` from `@mcthaydt/automata-sim`'s root (which also loads Koota; harmless in Node build tooling) and encodes UTF-8 with `TextEncoder`, which matches the sim's `utf8` for every string, lone surrogates included (both write U+FFFD; a test pins this). No other content file imports the sim.

## 3. Contracts

### 3.1 Schema registration (`schema/define-content-schema.ts`)

```ts
type ContentSchemaOptions = { readonly folder: string } | { readonly file: string }
function defineContentSchema<K extends string, S extends z.ZodType>(kind: K, schema: S, options: ContentSchemaOptions): ContentSchema<K, S>
function contentRef<K extends string>(kind: K): z.ZodType<string>      // an ID of another item of `kind`
function localized(): z.ZodType<string>                                 // player-facing text in the source language
```

- `kind` matches `^[a-z][a-z0-9-]*$` and is unique; `tuning`, `flow`, `game`, `assets` are reserved. Duplicate or reserved kinds fail before any file is read (`InvalidContentConfig`).
- `{ folder }` is a **collection**: every `content/<folder>/**/*.toml` is one item. Its ID is the path relative to `<folder>` without `.toml`, `/`-separated (`content/weapons/melee/sword.toml` → `melee/sword`). IDs match `^[a-z0-9-]+(/[a-z0-9-]+)*$`; a file name that breaks the rule is an error at `file:1:1`.
- `{ file }` is a **single document** (`content/catalog.toml`). A missing single document is an error unless the schema accepts `undefined`.
- Schemas are strict by convention (`z.strictObject`); an unknown key reports its own position, as FloorFifty's `unknownField` does.
- `contentRef(kind)` is `z.string()` plus a transform that wraps the ID in a private `ContentRefMarker`. After validation the compiler walks the parsed value, checks each marker against the IDs of `kind`, and replaces it with the plain ID string. A dangling reference is an error at the referring value's position. (Why a marker: Zod 4 cannot record extra facts from inside a refinement, and walking the data finds references inside unions, records and arrays without re-implementing Zod's traversal.)
- `localized()` works the same way with a `LocalizedMarker`; the text stays in `content.json` and gets a message key (§3.6).

### 3.2 Compile (`compile/compile-content.ts`)

```ts
interface CompileOptions {
  readonly root: string                    // the content folder, e.g. "content"
  readonly schemas: readonly ContentSchema[]
  readonly generators?: readonly ContentGenerator[]
  readonly flow?: FlowCapabilities          // optional code-owned screens/events/styles (§3.5)
  readonly tuning?: z.ZodType               // optional code-owned tunable names and types (§3.4)
}
const compileContent: (options: CompileOptions) => Effect<CompiledContent, ContentCompileFailed | ContentIoError | InvalidContentConfig, FileSystem | Path>
const writeCompiled: (compiled: CompiledContent, outDir: string) => Effect<void, ContentIoError, FileSystem | Path>
```

`CompiledContent` = `{ json: string; hash: string; data: ContentData; files: ReadonlyMap<string, string>; meta: { tuning: TuningMeta; flow: FlowGraph | undefined; messages: MessageCatalog; manifest: RukenContentFields } }`. `files` is every output file name → its exact bytes, so writing and verifying are the same comparison.

Ordered steps (each step runs on every file even when an earlier file failed, so one save reports everything):
1. **Validate config:** kinds, reserved names, folder/file clashes.
2. **Discover:** collections by glob, single documents and built-ins by name. Sorted by path so diagnostics and output are stable on every OS.
3. **Parse** with smol-toml. A `TomlError` becomes one diagnostic at its own line and column; that file stops there.
4. **Locate:** build a key-path → `line:col` index of the file (§3.3).
5. **Validate** with Zod 4 (`safeParse`). Each issue becomes a diagnostic at the deepest indexed position of its path.
6. **Built-in checks:** tuning ranges (§3.4), flow graph (§3.5), `game.toml`, `assets.toml` (§3.7).
7. **Resolve references** and collect localized text.
8. **Run generators** (§3.6). A generator's diagnostics join the rest.
9. If any diagnostic exists: fail with `ContentCompileFailed { diagnostics }` (sorted by file, line, col, path). Nothing is written.
10. **Canonicalize and hash:** `json = canonicalJson(data)` (keys sorted at every depth, so collections keyed by ID are sorted by ID; arrays keep authored order because order is meaning). `hash = hex64(xxhash64(utf8(json)))`, the same functions the sim uses.

`ContentData` = `{ [collectionKind]: { [id]: item }, [documentKind]: value, tuning: { [name]: value }, flow?: FlowGraph, assets?: ScreenAssets, game?: GameFacts }`. Tuning metadata, the message catalog and `flow.mmd` are **outside** the hash: they change no behavior. Localized text is inside (it is content).

**Errors (Effect `Data.TaggedError`)**
- `ContentCompileFailed { diagnostics: readonly Diagnostic[] }` — authored problems.
- `ContentIoError { path, reason }` — a file could not be read or written (not an authoring problem; reported as such).
- `InvalidContentConfig { message }` — the game's code registered something invalid.

`Diagnostic = { file: string; line: number; column: number; path: string; message: string }`, both 1-based; `formatDiagnostic(d)` = `` `${file}:${line}:${column}  ${path}  ${message}` `` with `file` relative to the project root and `/`-separated. `path` is the Zod path joined with `.` (`transitions.3.to`), or `(document)` for a whole-file problem.

### 3.3 Source positions (`compile/locate.ts`)

smol-toml returns values only, so the compiler indexes positions itself with a line scanner:
- Tracks the current table from `[a.b]` and array-of-tables headers `[[a]]` (with each array's running index), and records every `key = value` (dotted keys included) at the column of its key.
- Skips the inside of multi-line strings (`"""`, `'''`) and of multi-line arrays and inline tables (bracket depth, ignoring brackets inside strings).
- Elements of inline arrays and keys inside inline tables are not indexed; their diagnostics fall back to the enclosing key's position. A path nobody indexed falls back to `1:1`.

This is deliberately not a TOML parser: smol-toml has already accepted the file, so the scanner only needs to find where keys are.

### 3.4 Tuning (`tuning/`)

`content/tuning.toml` (optional). Each top-level key is a tunable, written either bare or with a range:

```toml
GRAVITY = { value = -275.0, min = -1200.0, max = -100.0, step = 5.0 }
COURSE_FLOOR_COUNT = { value = 20, min = 20, max = 100 }
DEBUG_LABEL = "climb"            # bare: no range, no slider
```

- Names match `^[A-Z][A-Z0-9_]*$`. Values are finite numbers, booleans or strings. `min`, `max`, `step` are numbers; `min <= max`; `step > 0`; ranged values must be numbers; an integer `value` with integer bounds is reported as `int` in the metadata.
- `value` outside `[min, max]`: `out of range: expected -1200..-100, received -2000` at the `value` key (FloorFifty's `outOfRange` wording).
- `tuning` is a reserved kind, so a game cannot register it as a schema. Instead, `CompileOptions.tuning?: z.ZodType` validates the **values map** after range checks. That is FloorFifty's safety line ("content selects, never defines"): a game that wants code-owned names and ranges passes a strict schema of them, and an unknown or missing tunable fails. A game that passes nothing gets the A0+A1 behavior (ranges authored in TOML).
- Output: `data.tuning = { NAME: value }` (in the hash) and `tuning-meta.json = { NAME: { type, value, min?, max?, step? } }` for the debug sliders (A6/M5), outside the hash.

### 3.5 Flow graph (`flow/`)

`content/flow.toml` (optional), FloorFifty's format:

```toml
entry = "Splash"

[[transitions]]
from = "Gameplay"
event = "raceFinished"
to = "GameEnd"
transition = "liquid"   # optional; absent means "cut"
```

Always checked (from FloorFifty `validate/flow.ts`):
- `entry` is a screen; nothing transitions back into the entry.
- Each `(from, event)` pair appears once; no self-transitions.
- Every screen named anywhere is reachable from the entry, and every reachable screen has an outgoing transition. (A game with a true terminal screen says so: `terminal = ["Credits"]`.)

When the game passes `FlowCapabilities = { screens, events?: Record<screen, Record<event, readonly screen[]>>, styles }` (FloorFifty's `FLOW_TARGETS` and `TRANSITION_STYLES`), the compiler also requires: screens only from the list, every declared pair present and no undeclared pair, a destination from the pair's list, and a style from `styles`. Without it, `transition` may be `"cut"` or any `^[a-z][a-z0-9-]*$` name; the runtime (M1.5) rejects styles it does not implement.

Generated: `data.flow = { entry, screens (sorted), transitions (sorted by from, event), terminal }`, the `ScreenId`/`FlowEvent` unions in `content.d.ts`, and `flow.mmd` (a Mermaid `stateDiagram-v2`) for review.

### 3.6 Generators and outputs

```ts
interface ContentGenerator { readonly name: string; generate(input: GeneratorInput): Effect<GeneratorOutput, never, never> }
type GeneratorOutput = { readonly files?: Readonly<Record<string, string>>; readonly diagnostics?: readonly Diagnostic[] }
function defineContentGenerator(name: string, generate: GeneratorInput => GeneratorOutput | Effect<GeneratorOutput>): ContentGenerator
```

Generators get the validated data and metadata and return files (path relative to the output folder → bytes). Two generators writing the same path, or a path outside the output folder, is an `InvalidContentConfig`. Built-in generators, always on:

| Generator | Output | Rule |
|---|---|---|
| `types` | `content.d.ts` | Declares `ContentData`, each collection's ID union (`type WeaponId = 'melee/sword' \| …`), each item type, `ScreenId`, `FlowEvent`, `TuningName`, and the accessors `getItem(kind, id)` / `listIds(kind)` over `virtual:automata/content`. Item types are rendered from `z.toJSONSchema(schema, { io: 'output' })` for the JSON subset (object, array, string/number/boolean, enum, literal, union, record, optional); references render as the target kind's ID union. A schema outside that subset renders as `unknown` with a comment naming the field. |
| `locale` | `locales/<source>.json` | Inlang message format (FloorFifty `messages.ts`): `{ "$schema": "https://inlang.com/schema/inlang-message-format", <key>: <text> }`, canonical. Key = `content_<kind>_<id>_<path>` in snake_case (`/` and `-` become `_`, camelCase splits). Two values mapping to one key is an error at the second. Each `content/locales/<lang>.json` must have exactly the source keys; a missing or extra key is an error in that file. |
| `flow` | `flow.mmd` | §3.5. |
| `manifest` | `ruken-fields.json` | `{ content: { languages, rating, descriptors, estimated_hours? }, analytics: { custom_events } }` (§3.7). |

**Preload (post-build).** `preloadList({ compiled, distDir })` is a separate Effect, because it needs the built `dist/`. It returns `loading.preload` for ship to write: the files of each screen listed in `game.toml` `preload_screens` (default: the flow entry), in that order, then deduplicated in first-seen order. Every entry is relative, `/`-separated, inside `dist/`, and either an existing file or a `dir/*` folder that exists (Ruken M2.1g); anything else fails with every missing path listed, as FloorFifty's `preloadFor` does.

### 3.7 `game.toml` and `assets.toml`

```toml
# content/game.toml: facts Ruken's manifest asks for that only the game knows
source_language = "en"
rating = "everyone"              # Ruken RATINGS: everyone | teen | mature
descriptors = []
estimated_hours = 1.5            # optional
custom_events = ["level_complete"]
preload_screens = ["Splash"]     # optional; default [flow.entry]

# content/assets.toml: files each screen waits for before it shows
[screens.Splash]
files = ["fonts/inter-latin.woff2", "art/splash.png"]
```

- `languages` is derived, never authored (R-80 spirit): `[source_language]` followed by each `content/locales/<lang>.json` present, the rest sorted. Language tags match BCP 47 (`^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2})?$`).
- `custom_events` names match `^[a-z][a-z0-9_]*$`, unique.
- `assets.toml` screens must be flow screens when a flow exists; `preload_screens` must have `assets.toml` entries.
- `rating` uses Ruken's enum exactly. If `game.toml` is absent, `ruken-fields.json` is not emitted and ship reports the missing fields.

### 3.8 Vite plugin (`vite/automata-content.plugin.ts`)

```ts
function automataContent(options: CompileOptions & { outDir?: string }): Plugin   // outDir default "generated"
```

- `buildStart`: compile and write. In `vite build` an error fails the build with every diagnostic. In `vite dev` the diagnostics print and the last good output keeps being served (FloorFifty `watch.ts`: "an invalid save changes nothing").
- `configureServer`: watches `root`; on a change it recompiles. On success it writes the outputs, invalidates the virtual module and sends a custom HMR event `automata:content` with `{ hash }` (A2/M1.5 restarts the sim on it); on failure it sends `automata:content-error` with the formatted diagnostics.
- `resolveId`/`load`: `virtual:automata/content` exports `content` (the data) and `contentHash`.

### 3.9 CLI (`cli/main.ts`, bin `automata-content`)

`automata-content check` (validate, write nothing), `automata-content build` (write), `automata-content check --verify` (fail if `generated/` differs from what a build would write: FloorFifty's `--verify-artifact`). It reads `automata.content.ts` from the working directory for the `CompileOptions` (until M1.8's `automata.config.ts`). Exit codes: 0 clean, 1 authored errors, 2 config or IO errors.

## 4. Data and lifecycle flow

- **Build:** `vite build` → plugin `buildStart` → compile → write → bundle imports the virtual module. Ship (M1.2) then calls `preloadList` on `dist/` and merges `ruken-fields.json`.
- **Dev:** first compile at start; each save recompiles; outputs change only on success; the last good content stays live.
- **CI:** `automata-content check --verify` in the game's CI (wired by ship's `game-ci.yml`).
- No long-lived state: each compile is a pure function of the files plus options. The plugin's watcher is closed with the server.

## 5. Failure policy

| Case | Result |
|---|---|
| TOML syntax error | one diagnostic at smol-toml's line/col; other files still checked |
| Schema issue / unknown key / wrong type | one diagnostic per issue at the key's position |
| Dangling `contentRef` | `unknown <kind> "<id>"` at the referring value |
| Tuning out of range / bad range | at the `value` (or `min`/`max`/`step`) key |
| Flow: unreachable, dead-end, duplicate pair, bad entry | at the transition or `entry`; whole-graph problems at `flow.toml`'s `entry` |
| Locale key collision / translation drift | at the second value / in the translation file |
| Missing preload file | `preloadList` fails listing every missing path |
| Unreadable file / unwritable output | `ContentIoError`, exit 2; nothing partially written (outputs are written to a temp folder and renamed) |
| Invalid game config | `InvalidContentConfig`, exit 2, before reading content |
| Generator throws | treated as a defect and surfaced with the generator's name (Effect `die`), exit 2 |

## 6. Test allocation

All tests are Node unit tests (Vitest, `packages/content/src/**/*.test.ts`) against fixture trees written to a temp folder and the real `NodeFileSystem` layer. Fixtures:
- `testing/fixtures/minimal/`: one collection with a reference, a tuning file, a flow, `game.toml`, `assets.toml`, one translation.
- FloorFifty's real `flow.toml` and `tuning.toml` (copied at `122a220`, ranges added from `tuning.ts`) must compile, and the FloorFifty flow graph must pass the graph checks.
- Broken fixtures, one per failure row in §5, each asserting the exact formatted line.

Parity: the content hash must equal the sim's XXH64 of the same bytes; one `*.parity.test.ts` runs a fixed canonical JSON string through the shared hash in Chromium, WebKit and Firefox and compares with the Node hash (the compiler itself only runs in Node).

Vite plugin: a real `vite build` of a two-file fixture (asserting the virtual module's hash and that a broken file fails the build), and the dev path through `createServer` with a write-then-wait-for-event test.

No DOM, layout, GPU or Owner visual gates in this task.

## 7. Feedback workflow

`pnpm --filter @mcthaydt/automata-content test:unit` for focused runs; `pnpm check` before each commit; the parity project with the sim's browser config. Every failing test is seen to fail for its stated reason before code is written.

## 8. Dependencies (exact pins, in `packages/content/package.json` only)

`effect` 4.0.2 (newest on npm on 2026-10-11), `@effect/platform-node` 4.0.2 (its `platform-node-shared` 4.0.3 asks for `effect ^4.0.3`, which is not published yet: a peer warning only), `smol-toml` 1.9.0 (Ruken's pin), `zod` 4.6.5, `vite` 8.3.2 (peer + dev; Ruken's pin), `@mcthaydt/automata-sim` `workspace:*` (the shared hash), `@types/node` 24.19.1, `vitest` 5.0.3, `@vitest/browser-playwright` 5.0.3, `playwright` 1.63.0 (dev; the sim's pins). Ship's `docs/versions.md` records them when that lane lands.

## 9. Ruken alignment

| Behavior | Ruken contract |
|---|---|
| `ruken-fields.json` `content.languages/rating/descriptors/estimated_hours` | `packages/manifest/src/types.ts` `Manifest.content`, `RATINGS` |
| `analytics.custom_events` | `Manifest.analytics` |
| `loading.preload` entries: relative paths or `dir/*` | `Manifest.loading` (Ruken M2.1g) and `packages/validation` `preload-list` |

Content does not write `ruken.toml` or redefine its schema: it emits these fields and ship checks the whole file with Ruken's parser. Until ship vendors `@ruken/manifest`, content keeps a four-field mirror type with a test that names `types.ts` at `b30d31b`; the mirror is replaced by an import in the integration step that lands both lanes.

**Requests to other owners**
- *integration:* add `defineContentSchema` → `schema` and `defineContentGenerator` → a role to `tooling/check-style`'s `DEFINE_ROLE` (or confirm they stay unenforced).
- *integration:* the FloorFifty split (ranges in code) versus A0+A1 (ranges in TOML) is resolved here by supporting both (§3.4); confirm.

## 10. Exit criteria

1. FloorFifty's `flow.toml` and range-annotated `tuning.toml` compile; the flow's graph checks pass.
2. Every §5 row has a fixture whose exact `file:line:col  path  message` output is asserted; one save with several broken files reports all of them.
3. A dangling reference fails the compile (A0+A1 §8 item 6).
4. `content.hash` equals `hex64(xxhash64(utf8(content.json)))` via the shared XXH64, identical in Node, Chromium, WebKit and Firefox.
5. Reordering keys or files in the source does not change `content.json` or the hash; changing any authored value does.
6. `content.d.ts` typechecks in a fixture consumer, and a wrong ID literal is a type error there.
7. `vite build` with the plugin embeds the hash; a broken file fails the build; in dev a broken save keeps the last good content and emits the error event.
8. `automata-content check --verify` fails on a hand-edited `content.json`.
9. `pnpm check` passes locally on Node 24, plus the parity project in all three browsers.
