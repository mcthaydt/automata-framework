# M1.3 Content compiler (`@mcthaydt/automata-content`)

- **Date:** 2026-10-11
- **Status:** Draft, for review in this lane's PR. Stacks on PR #4 (`claude/ruken-first-af-60n4bh`).
- **Lane:** content ([04 How we build](../../04-how-we-build.md#lanes-2026-10-11)). Owns `packages/content/` and changes nothing outside it. Hashes through `@mcthaydt/automata-sim/hash`.
- **Builds on:** A0+A1 spec §5 (the design), master spec §9 (M1 content scope), the [M1 shared contracts](2026-10-11-m1-shared-contracts-design.md) §2 (`ContentSchemaDef` is this lane's type), [art direction](../../art/README.md) (the palette is content; Endesga 64 is AF's default).
- **Approach: extract and improve.** FloorFifty already has a tested content compiler. AF takes its game-agnostic parts with their tests and generalizes them over game-registered Zod schemas, then adds what the A0+A1 design asks for and FloorFifty lacks: source positions, references by kind, XXH64, typed declarations, Effect, a Vite plugin, Ruken manifest fields and the palette.

## 0. Sources

| Source (FloorFifty `122a220`, `packages/content/src/` unless noted) | Lines | AF file | Kept | Changed |
|---|---|---|---|---|
| `diagnostics.ts` | 35 | `diagnostics/diagnostic.ts` | stable `code`, `file`, `keyPath`, `message`; one sort for every pass | adds `line`, `column`; format becomes `file:line:col  keyPath  code: message` |
| `parse.ts` (`parseFile`, `toDiagnostics`, `codeFor`, `valueAt`) | 233 | `parse/parse-document.ts` | TOML then Zod; `unknownField` per unrecognized key; `missingField` versus `invalidType`; one diagnostic per issue | generic over any schema instead of FloorFifty's twelve kinds; TOML syntax errors carry smol-toml's line and column (code `invalidToml`) |
| `read-sources.ts` | 94 | `compile/read-sources.ts` | `content/...` labels; `.toml.example` ignored; sorted reads; an absent folder is empty; a missing required file is a diagnostic, not a throw | an Effect over the one file-access module (§3.2); folders and files come from the registered schemas; nested folders give `a/b` IDs |
| `validate/references.ts` | 132 | `schema/references.ts` | `unknownReference`, `wrongKind` (an ID that exists as another kind) | references are declared in the schema with `contentRef(kind)` instead of a hand-written join; IDs are unique per kind, because they are paths |
| `validate/bounds.ts` | 114 | `tuning/check-tuning.ts` | `TunableDeclaration` (`int`/`float`, inclusive `min`/`max`, `default`); `unknownField`, `invalidType`, `outOfRange`, `missingField`, `invariantNotAuthorable`; complete base versus partial layers | declarations and invariants are passed in by the game; ranges may also be authored inline (A0+A1 §5) |
| `validate/flow.ts` | 123 | `flow/check-flow.ts` | entry check, one transition per pair, no self-transition, nothing back into the entry, reachability, every reachable screen can leave; `FLOW_TARGETS` as a capability map | the entry, screens, pairs and styles are the game's (`FlowCapabilities`); without a map, the graph rules still apply |
| `canonicalize.ts` (`canonicalizeValue`) | 143 | `hash/canonical-file.ts` | sorted keys, arrays in authored order, 2-space indent, one trailing newline | the hash is computed separately (below) |
| `revisions.ts` | 99 | `hash/content-hash.ts` | the hash preimage never contains the hash | one XXH64 (`@mcthaydt/automata-sim/hash`) over `canonicalJson(data)` instead of three SHA-256 revisions; partitioned revisions are an M2.0 question |
| `messages.ts` | 71 | `locale/messages.ts` | inlang message format; `content_<kind>_<id>_<field>` snake-case keys; written beside the artifact, not in it; a stale file is `staleArtifact` | fields are marked with `localized()` instead of listed by hand; translations are checked for missing and extra keys |
| `build.ts` (`writeAtomically`) | 41 | `files/content-files.ts`, `compile/write-outputs.ts` | temp file beside the target, then rename; a failed compile writes nothing | an Effect over the one file-access module (§3.2) |
| `compiler.ts` (`compile`, `verifyArtifact`) | 135 | `compile/compile-content.ts` | every pass runs before reporting; verify rebuilds in memory and compares bytes (`staleArtifact`) | an Effect program with typed errors |
| `watch.ts` | 91 | `vite/automata-content.ts` | builds serialized on one chain; 50 ms debounce; publish only after a successful write; a bad save reports and keeps the last good bytes | Vite's watcher and HMR instead of chokidar |
| `author-guide.ts` | 90 | `tuning/tuning-table.ts` | a generated tunable table between markers, verified in CI | reads declared or inline ranges |
| `bin/content.ts` | 86 | `cli/run-cli.ts`, `cli/main.ts` | `check`, `build`, `check --verify-artifact`, `docs`; exit 1 on diagnostics | `watch` is the Vite plugin's job; exit 2 for config and write errors |
| `tests/content/{parse,determinism,compiler,messages,watch}.test.ts`, `validate/{flow,bounds,references}.test.ts`, `fixtures/{valid,equivalent-a,equivalent-b}` | ~1,200 | `src/**/*.test.ts`, `src/testing/fixtures/` | every generic case | rewritten against a FloorFifty-shaped fixture game (characters, songs, stages, catalog, tuning, flow) registered through the AF API |

Left in FloorFifty (game rules, not framework): the item schemas (`schema/*`), `validate/{course,modes,aliases,stills,juice,set-pieces,event-routing}.ts`, `bin/{survey-seeds,compose-stills}.ts`, catalog/pack/draft semantics and `resolveTuning` layering. Each is expressible as a game schema plus a generator on the AF API.

Other sources: RukenApp `b30d31b` `packages/manifest` (vendored as `@ruken/manifest`: `Manifest`, `RATINGS`, `ANALYTICS_NAME_RE`, `parseManifest`); FloorFifty `deploy/tools/ruken-pack.ts` `preloadFor` (line 160); AF `docs/art/palettes/endesga-64.txt`.

## 1. Goal and boundaries

A game author writes TOML under `content/`. `automata-content` turns it into one canonical JSON artifact, its XXH64 hash, a `content.d.ts` with typed accessors, and the derived files the rest of AF needs: the source-language messages, the flow graph, the tuning metadata and the Ruken manifest fields. A save with any problem reports every problem as `file:line:col  keyPath  code: message` and writes nothing.

**Deliverables**
1. `defineContentSchema`, `contentRef`, `localized` (schema registration; `ContentSchemaDef` for `defineExtension`).
2. `compileContent`, `buildContent`, `verifyContent` (Effect programs) and their typed errors.
3. Built-in documents: `tuning.toml`, `flow.toml`, `palette.toml`, `game.toml`, `assets.toml`.
4. Outputs (default folder `content/generated/`): `content.json`, `content.hash`, `content.d.ts`, `messages/<source>.json`, `tuning-meta.json`, `flow.mmd`, `ruken-fields.json`, and `outputs.txt` (the list of all of them, §3.7).
5. `defineContentGenerator` hook; the built-in generators are written on it.
6. `preloadList` (post-build) for Ruken's `[loading] preload`.
7. `automataContent()` Vite plugin with `virtual:automata/content`.
8. CLI `automata-content check|build|docs [--verify-artifact]`.

**Not in M1.3**
- Content inside the sim (`SimOptions.content`, snapshot `contentHash`, `SnapshotMismatchError`): M2.2.
- Writing `ruken.toml` and zipping: ship (M1.2) merges `ruken-fields.json` and the preload list and checks the file with `@ruken/manifest`.
- The telemetry catalog generator (later); `analytics.custom_events` comes from `game.toml` until then.
- Restarting the sim on change: the plugin emits an event; the runtime (M1.5) acts on it.
- FloorFifty's partitioned revisions (`rulesetRevision`, `courseRevision`): M2.0 decides whether replays need finer hashes.
- Palette LUTs, the palette gate and theme tokens (M3, M1.6): they read the compiled palette.

## 2. Ownership

| State | Owner | Writers | Consumers |
|---|---|---|---|
| Authored TOML and translations under `content/` | the game | authors, translators | the compiler (read only) |
| Compiled outputs | `content` | the compiler only; never hand-edited (`--verify-artifact` catches edits) | runtime (M1.5), sim (M2.2), ship (M1.2), ui (palette, strings), pipelines (palette) |
| Content hash | `content` computes it | — | boot hash check (M1.5), sim snapshot header (M2.2), evidence identity |
| XXH64 and canonical JSON | sim (`@mcthaydt/automata-sim/hash`) | sim lane | content, sim |
| Ruken manifest types, `RATINGS`, `ANALYTICS_NAME_RE`, `parseManifest` | Ruken (`@ruken/manifest`, vendored) | Ruken | content imports them and never copies them |
| Default palette (Endesga 64) | integration (`docs/art/palettes/endesga-64.txt`) | — | content embeds it, with a test that it matches the file |

## 3. Contracts

### 3.1 Schema registration (`schema/content-schema.ts`)

```ts
type ContentSchemaPlace = { readonly folder: string } | { readonly file: string }
interface ContentSchemaDef<K extends string = string, S extends z.ZodType = z.ZodType> {
  readonly kind: K; readonly schema: S; readonly place: ContentSchemaPlace
}
function defineContentSchema<const K extends string, S extends z.ZodType>(kind: K, schema: S, place: ContentSchemaPlace): ContentSchemaDef<K, S>
function contentRef<const K extends string>(kind: K): z.ZodType<string>   // the ID of another item of `kind`
function localized(): z.ZodType<string>                                    // player-facing text in the source language
```

- `kind` matches `^[a-z][a-z0-9-]*$` and is unique. `tuning`, `flow`, `palette`, `game`, `assets` are reserved. A duplicate or reserved kind, or two schemas on one folder or file, fails before any file is read (`InvalidContentConfig`).
- **Collections** (`{ folder }`): every `content/<folder>/**/*.toml` (not `*.toml.example`) is one item. Its ID is the path below `<folder>` without `.toml`, `/`-separated: `content/weapons/melee/sword.toml` is `melee/sword`. Each segment matches `^[a-z0-9-]+$` (FloorFifty's ID rule); a file that breaks it is `invalidId` at `file:1:1`. An absent folder is an empty collection.
- **Single documents** (`{ file }`): `content/catalog.toml`. Missing is `missingField` at `file:1:1` unless the schema accepts `undefined`.
- Write schemas with `z.strictObject` so a misspelled key is reported, not ignored (FloorFifty's lesson).
- `contentRef(kind)` checks the ID shape and tags the value. After validation the compiler walks the parsed value, checks each tagged ID against the IDs of `kind`, and replaces the tag with the plain string. Errors: `unknownReference` (`no song has the id dusk-rnu`), `wrongKind` (`dusk-run is a song, not a stage`). Why tag-and-walk: Zod 4 cannot report facts out of a refinement, and walking the data finds references inside arrays, records and unions without re-implementing Zod's traversal.
- `localized()` works the same way; the text stays in `content.json` and gets a message key (§3.7).
- Markers and registrations work across copies of this module: a game's `automata.content.ts` or Vite config can be loaded by another module runner, which evaluates its own copy. A marker is recognized by its `automataContentMarker` brand rather than `instanceof`, and the `contentRef`/`localized` registries live on `globalThis` under a `Symbol.for` key.

### 3.2 Compile, build, verify (`compile/`)

```ts
interface ContentOptions {
  readonly root: string                                   // project root; content is <root>/content
  readonly schemas: readonly ContentSchemaDef[]
  readonly tunables?: TunableDeclarations                 // code-owned names and ranges (§3.4)
  readonly invariants?: readonly string[]                 // names that are code-only (§3.4)
  readonly flow?: FlowCapabilities                        // code-owned screens, pairs, styles (§3.5)
  readonly generators?: readonly ContentGenerator[]
  readonly outDir?: string                                // default "content/generated"
}
compileContent(options): Effect<CompiledContent, ContentCompileFailed | InvalidContentConfig>
buildContent(options):   Effect<CompiledContent, ContentCompileFailed | InvalidContentConfig | ContentWriteFailed>
verifyContent(options):  Effect<void, ContentCompileFailed | InvalidContentConfig>  // staleArtifact per differing file
```

**File access.** Every read and write goes through one module, `files/content-files.ts` (`readTextIfPresent`, `listFiles`, `writeFileAtomically`, `pathKind`, `removeFile`), which runs `node:fs` inside `Effect.tryPromise` and fails with `FileError`. Nothing else in the package touches the disk, so moving to `@mcthaydt/automata-node` (ship lane) changes that file alone. The programs therefore need no Effect service; `@effect/platform` is not a dependency.

`CompiledContent = { data, hash, files: ReadonlyMap<string, string>, warnings: readonly Diagnostic[] }`, where `files` maps each output path (relative to `outDir`) to its exact text, so build and verify compare the same bytes. `warnings` are `skippedFile` diagnostics (step 2); they never fail a compile and are not in the hash or the outputs. The CLI prints each as `warning <formatted line>` and the plugin logs it with Vite's `logger.warn`.

Ordered steps; every step runs on every file even when an earlier file failed:
1. Validate the options (kinds, places, generator names).
2. Read sources (sorted; FloorFifty `read-sources.ts`). Items are `*.toml` files; `*.toml.example` drafts and hidden files (`.DS_Store`, editor swap files) are skipped silently. Any other file in a collection folder or in `content/messages/` (`dusk-run.TOML`, `notes.md`, `de.JSON`) is skipped with a `skippedFile` warning, so a misnamed file never vanishes without a word (audit of PR #8). At the top of `content/`, a TOML-ish file (its name contains `.toml`, any case) whose stem (before the first dot, ignoring case) is one or two edits from a document's (`tunning.toml`, `Game.toml`, `flow.toml.bak`) warns `did you mean tuning.toml?`; other files there (a README) stay quiet. A translation's file name must match the language-tag rule (`fr.json`, `pt-BR.json`), else `invalidId`, because it becomes a language in `ruken-fields.json`. A leading UTF-8 byte order mark is removed from every source before parsing.
3. Parse each file: smol-toml, then the schema (FloorFifty `parse.ts`). Index key positions (§3.3). CRLF is normalized to LF before parsing, so line endings inside multi-line strings never change the hash. TOML dates and times become their canonical ISO strings (`TomlDate.toISOString()`), so JSON never silently drops them. `nan`, `inf` and `-inf` are refused as `invalidType` at the key (`KEY must be a finite number, received nan`), because canonical JSON cannot hold them. A `__proto__` key is refused as `reservedKey`, because JavaScript would read it as the object's prototype and drop it from the data and the hash; `constructor` and `prototype` are ordinary keys. A schema that throws (a bug in a transform or refinement) is `InvalidContentConfig` naming the schema and the file it was reading: the game's code is wrong, not the content.
4. Built-in checks: tuning (§3.4), flow (§3.5), palette (§3.6), game and assets (§3.8). `tuning.toml` is required when the game passes `tunables`, and `flow.toml` when it passes `flow`; otherwise both are optional. Translations (§3.7) are checked only when every source parsed, because a file that fails to parse contributes no message keys and would make every one of its keys look stale.
5. Resolve references, collect localized text (§3.1).
6. Run generators (§3.7), only when steps 2 to 5 found nothing, so a generator always sees content that passed every check.
7. Any diagnostic: fail with `ContentCompileFailed { diagnostics }`, sorted by file, line, column, keyPath, code. Nothing is written.
8. Assemble `data`; `hash = hex64(xxhash64(utf8(canonicalJson(data))))`; `content.json` is `data` in FloorFifty's canonical file form (sorted keys, 2-space indent, trailing newline). Both forms sort keys, so collections keyed by ID are in ID order; arrays keep authored order because order is meaning.

`data` = `{ <collection kind>: { <id>: item }, <document kind>: value, tuning: { NAME: value }, flow?, palette, game?, assets? }`. The hash covers all of it.

**Decision for M2.2 (audit of PR #8, coordinator, 2026-10-11).** Store and display metadata in `game.toml` (rating, descriptors, estimated hours, analytics event names and any later listing fields) must not be part of the content hash that gates save restore: fixing a store descriptor must not refuse every player's save. M2.2, which brings the hash into the sim's snapshot header, either splits it into a separate hash or excludes it from the gating hash. Until then `content.hash` keeps covering all of `data`; the boot check (M1.5) and evidence identity use it as it is.

Tuning metadata, messages, `flow.mmd`, `content.d.ts` and `ruken-fields.json` are derived files outside the hash (FloorFifty: "derived beside the artifact, never inside it").

**Errors** (`Data.TaggedError`): `ContentCompileFailed { diagnostics }`; `InvalidContentConfig { message }` (the game's code is wrong); `ContentWriteFailed { path, cause }`. A source that cannot be read is a diagnostic, as in FloorFifty, so check and watch keep their recovery path.

**Diagnostic** (`diagnostics/diagnostic.ts`): `{ code, file, line, column, keyPath, message }`, `line` and `column` 1-based, `file` project-relative with `/`. `formatDiagnostic` gives `content/tuning.toml:12:1  GRAVITY  outOfRange: expected -1200..-100, received -2000`. `keyPath` is the dotted path (`transitions.3.to`), or empty for the whole file. Codes (FloorFifty's where they apply): `invalidToml`, `invalidType`, `missingField`, `unknownField`, `invalidId`, `unknownReference`, `wrongKind`, `outOfRange`, `invariantNotAuthorable`, `invalidFlow`, `invalidPalette`, `invalidGame`, `missingAsset`, `duplicateMessageKey`, `staleTranslation`, `staleArtifact`, `reservedKey`, and the warning `skippedFile`. (A draft had `generatorFailed`; a generator that throws is a bug in the game's code, so it is `InvalidContentConfig`.)

### 3.3 Source positions (`parse/locate-keys.ts`)

smol-toml returns values only, so a line scanner indexes where keys are:
- it tracks the current table from `[a.b]` and array-of-tables headers `[[a]]` (each array keeps a running index), and records each `key = value` (dotted and quoted keys too) at its key's column;
- it skips the inside of multi-line strings and of multi-line arrays and inline tables (bracket depth, ignoring brackets inside strings);
- a diagnostic is placed at the deepest indexed prefix of its key path (an element of an inline array lands on its key), else at `1:1`.

smol-toml has already accepted the file, so the scanner only finds keys; it never decides validity.

### 3.4 Tuning (`tuning/`)

`content/tuning.toml` is optional. Two ways to declare ranges, matching the two sources:
- **Code-owned** (FloorFifty): the game passes `tunables: { NAME: { type: 'int' | 'float', min, max, default } }` and `invariants`. Then `tuning.toml` must name every tunable once with a bare number: FloorFifty's rules and codes exactly. Inline ranges are refused (`invalidType`: ranges are declared in code for this game).
- **Authored** (A0+A1 §5): no `tunables` option. Each key is `NAME = value` (number, boolean or string; no slider) or `NAME = { value, min, max, step? }`. `min <= max`, `step > 0`, the value inside the range; an integer value with integer bounds gives `int` metadata.

Both: names match `^[A-Z][A-Z0-9_]*$`; numbers are finite. `checkTuningLayer(layer, declarations, { complete })` is exported for games that layer partial overrides (FloorFifty's stages and modes). Outputs: `data.tuning = { NAME: value }` (hashed); `tuning-meta.json = { NAME: { type, value, min?, max?, step? } }` (debug sliders, A6/M5); and, for docs, `renderTuningTable` / `updateTuningTable` / `verifyTuningTable` between `<!-- BEGIN GENERATED TUNABLES -->` markers in a guide the game names (FloorFifty `author-guide.ts`).

### 3.5 Flow (`flow/`)

`content/flow.toml` is optional; FloorFifty's format (`entry`, `[[transitions]]` with `from`, `event`, `to`, optional `transition`), plus optional `terminal = ["Credits"]` for screens with no way out by design.

Always (FloorFifty `validate/flow.ts`): `entry` is a screen with no incoming transition; each `(from, event)` once; no self-transition; every screen reachable from the entry; every reachable, non-terminal screen has an outgoing transition. Code `invalidFlow`.

With `FlowCapabilities = { entry?, screens, targets?: { [from]: { [event]: readonly screen[] } }, styles?: readonly string[] }` (FloorFifty's `SCREEN_IDS`, `FLOW_TARGETS`, `TRANSITION_STYLES`): screens only from `screens`; when `targets` is given, every declared pair present, no undeclared pair, and the destination in the pair's list; the entry must equal `entry` when given; `transition` must be in `styles` (default `['cut']`). Without capabilities, `transition` is `cut` or a kebab-case name the runtime checks.

Outputs: `data.flow = { entry, screens (sorted), terminal, transitions (sorted by from, event, to; FloorFifty's `byPair`) }`, `ScreenId`/`FlowEvent` unions in `content.d.ts`, and `flow.mmd` (Mermaid `stateDiagram-v2`) for review.

### 3.6 Palette (`palette/`)

`content/palette.toml` is optional:

```toml
name = "Endesga 64"
colors = ["#ff0040", "#131313"]   # 6-digit hex, any case; stored lowercase
```

Rules: 2 to 256 colors, each `#rrggbb`, no duplicates (`invalidPalette` at `colors`, naming both indices). Absent, `data.palette` is AF's default, Endesga 64, embedded in `palette/endesga-64.ts`. A test parses `docs/art/palettes/endesga-64.txt` (paint.net `AARRGGBB` lines, `;` comments) with `parsePaintNetPalette` and asserts that the embedded list equals it in order and has 64 unique colors. The palette is in the hash, so the renderer's LUT, theme tokens and the pipelines' palette gate all read one checked source.

### 3.7 Generators and derived files

```ts
interface GeneratorInput { readonly data: ContentData; readonly hash: string; readonly schemas: readonly ContentSchemaDef[]; readonly messages: MessageCatalog; readonly tuning: TuningMeta }
interface GeneratorOutput { readonly files?: Readonly<Record<string, string>>; readonly diagnostics?: readonly Diagnostic[] }
function defineContentGenerator(name: string, generate: (input: GeneratorInput) => GeneratorOutput): ContentGenerator
```

Generators are pure: data in, files and diagnostics out. A throw is `InvalidContentConfig` (`generator "NAME" threw: message`), like any other bug in the game's code. Two generators writing one path, or a path outside `outDir`, is `InvalidContentConfig`. Built-in generators (always on, written with the same hook):

| Name | File | Rule |
|---|---|---|
| `types` | `content.d.ts` | `declare module 'virtual:automata/content'` with `content: ContentData` and `contentHash: string`; each collection's ID union (`type SongId = 'dusk-run' \| …`); each item type rendered from `z.toJSONSchema(schema, { io: 'output' })` for object, array, string, number, boolean, enum, literal, union, record and optional; a reference renders as its kind's ID union; anything else renders `unknown` with a comment naming the field. Plus `ScreenId`, `FlowEvent`, `TuningName`. |
| `messages` | `messages/<source>.json` | FloorFifty `messages.ts`: inlang format, keys `content_<kind>_<id>_<keyPath>` in snake_case (`/` and `-` become `_`, camelCase splits). Two values on one key: `duplicateMessageKey`. Each `content/messages/<lang>.json` must have exactly the source keys: `staleTranslation` lists the missing and extra keys. |
| `tuning-meta` | `tuning-meta.json` | §3.4 |
| `flow` | `flow.mmd` | §3.5 |
| `ruken-fields` | `ruken-fields.json` | §3.8 |

`outputs.txt` is added after the generators: every other output path, sorted, one per line. `buildContent` reads the previous `outputs.txt` before writing and, after writing, deletes each file it lists that this compile no longer produces (deleting `game.toml` removes `ruken-fields.json`, so ship never reads a stale one). A file the list does not name is never touched. The list is relative to `outDir`, so an entry that could leave it is ignored: one with `..`, any backslash, or an absolute start (`/x`, `C:/x`). Lines split on LF or CRLF, so a checkout that converted line endings still removes stale outputs. `verifyContent` reports each listed file that still exists but is no longer produced as `staleArtifact` (`X is no longer produced; run automata-content build`).

### 3.8 Game facts, assets, Ruken fields, preload

```toml
# content/game.toml: facts Ruken's manifest asks for that only the game knows
source_language = "en"           # default "en"
rating = "everyone"              # @ruken/manifest RATINGS
descriptors = []
estimated_hours = 1.5            # optional
custom_events = ["level_complete"]
preload_screens = ["Splash"]     # optional; default [flow entry]
```

```toml
# content/assets.toml: the files each screen waits for before it shows
[screens.Splash]
files = ["fonts/inter-latin.woff2", "art/splash.png"]
```

- `languages` is derived, never typed: the source language, then each `content/messages/<lang>.json` present, sorted.
- Content's own rules: `source_language` is a language tag; `custom_events` are unique; `assets.toml` screens must be flow screens when there is a flow; `preload_screens` must have `assets.toml` entries. Code `invalidGame`.
- **Ruken decides the rest** (`game/ruken-check.ts`, audit of PR #8). `checkWithRuken` writes a minimal `ruken.toml` around the `[content]` and `[analytics]` fields and a `[loading] preload` of every file in `assets.toml` (screens sorted, files in order), runs Ruken's own `parseManifest`, and places each refusal back at the key that produced it: `content.languages` at `source_language`, `content.rating`, `content.descriptors`, `content.estimated_hours` and `analytics.custom_events` at their `game.toml` keys, and `loading.preload[i]` at the asset path, with the file named instead of the slot. The message is `Ruken CODE: message` (for example `Ruken PRELOAD_PATH_INVALID: …`). Content keeps no copy of Ruken's path, rating, language or event-name rules. The other tables are placeholders Ruken accepts. Strings are written as TOML basic strings with every control character escaped, DEL included. A refusal the check cannot trace to a key (text TOML cannot hold, or a placeholder Ruken no longer accepts) is still an `invalidGame` problem at the top of `game.toml` (or `assets.toml` without one), never a throw. The assets are checked even when `game.toml` fails to parse, with placeholder fields.
- `ruken-fields.json` = `{ content: { languages, rating, descriptors, estimated_hours? }, analytics: { custom_events } }`, typed `Pick<Manifest, 'content' | 'analytics'>` from `@ruken/manifest`. Without `game.toml` it is not written, and ship reports the missing fields.
- **`preloadList({ options, distDir })`** (post-build Effect, FloorFifty's `preloadFor`): the files of each `preload_screens` screen in order, deduplicated in first-seen order. Every file must exist in `dist/` (a `dir/*` entry needs the folder); otherwise `missingAsset` lists every missing path at once.

### 3.9 Vite plugin (`vite/automata-content.ts`, export `@mcthaydt/automata-content/vite`)

```ts
function automataContent(options: Omit<ContentOptions, 'root'> & { root?: string }): Plugin  // root defaults to Vite's
```

- `buildStart`: `buildContent`. In `vite build` a failure fails the build with every formatted diagnostic. In `vite dev` diagnostics print and the last good output keeps being served.
- `configureServer`: watches `content/`; changes to `.toml` and message files (not `*.toml.example`, not `outDir`) debounce 50 ms, then rebuild on one serialized chain (FloorFifty `watch.ts`). Success: invalidate the virtual module and send the custom HMR event `automata:content` with `{ hash }`. Failure: send `automata:content-error` with the formatted diagnostics; outputs and the module stay as they were. An event is sent only when the build's result changed since the previous build (a new `hash`, or different diagnostics), so the several `change` events macOS fires for one save — or the watcher's startup noise — never send a second, identical event.
- `virtual:automata/content` exports `content` and `contentHash`. Its `load` waits for the build chain, so it never serves a build in progress; with no good build yet it fails with the diagnostics.
- A build that crashes (a defect, not a typed failure) is reported like a failed build (`the content compiler crashed: …`); the chain never rejects, so the next good save recovers without a server restart (audit of PR #8).
- `skippedFile` warnings are logged with Vite's `logger.warn` after each good build.
- Closing the server (`buildEnd`) clears the pending debounce and awaits the chain.

### 3.10 CLI (`cli/`, bin `automata-content`)

`check` (compile, write nothing, print `content <hash>`), `build` (write), `check --verify-artifact` (fail on any stale output, and on a stale tunable table in the configured guide: FloorFifty's repository gate), `docs [guide.md]` (rewrite the tunable table; the path defaults to the config's `guide`). Options come from `automata.content.ts` in the working directory (default export `ContentConfig`: `ContentOptions` without `root`, plus an optional `guide`) until M1.8's `automata.config.ts` replaces it; it is loaded with Vite's `runnerImport`, so it may be TypeScript. Exit 0 clean, 1 diagnostics, 2 config or write errors and usage. `runCli(argv, cwd, io?)` is the tested function; `main.ts` is the bin, which Node runs directly and which loads `run-cli.ts` through `runnerImport` because the package source uses extensionless imports Node cannot resolve. It turns its own URL into a path with `fileURLToPath` and Vite's `normalizePath`, so the bin works from a folder with spaces and on Windows (a URL's `pathname` spells a space `%20` and a drive `/C:`).

## 4. Lifecycle

- **Build:** `vite build` → plugin builds → the bundle imports the virtual module. Ship (M1.2) then calls `preloadList` on `dist/` and merges `ruken-fields.json` into `ruken.toml`.
- **Dev:** first build at server start; each save rebuilds on the chain; outputs change only on success; closing the server stops the watcher and awaits the chain.
- **CI:** `automata-content check --verify-artifact` (ship wires it into `game-ci.yml`).
- Each compile is a pure function of the files and options; nothing is cached between runs.

## 5. Failure policy

| Case | Result |
|---|---|
| TOML syntax error | `invalidToml` at smol-toml's line/col; other files still checked |
| Schema issue | one diagnostic per issue at the key (`missingField`, `unknownField` per key, `invalidType`) |
| Bad file name for an ID | `invalidId` at `file:1:1` |
| Missing required document | `missingField` at `file:1:1`; good outputs untouched |
| Dangling or wrong-kind reference | `unknownReference` / `wrongKind` at the referring key |
| Tuning | `outOfRange`, `invalidType`, `unknownField`, `missingField`, `invariantNotAuthorable` at the name |
| Flow | `invalidFlow` at the transition, `entry` or screen |
| Palette | `invalidPalette` at `colors` |
| Game / assets | `invalidGame` / `missingAsset` at the key |
| Message key clash / translation drift | `duplicateMessageKey` / `staleTranslation` |
| `nan` / `inf` / `-inf` | `invalidType` at the key |
| `__proto__` key | `reservedKey` at the key |
| Translation named other than a language tag | `invalidId` at `file:1:1` |
| File in a content folder that is not read, or a near miss of a document name | `skippedFile` warning at `file:1:1`; the compile still succeeds |
| Schema or generator throws | `InvalidContentConfig` naming the schema and file, or the generator, exit 2 |
| Committed output differs | `staleArtifact` per file (`--verify-artifact`) |
| Output no longer produced | `build` deletes it (only files in the last `outputs.txt`); `--verify-artifact` reports `staleArtifact` while it is there |
| Compiler crash in dev | logged and sent as `automata:content-error`; the next good save recovers |
| Bad options | `InvalidContentConfig`, exit 2, before reading content |
| Write fails | `ContentWriteFailed`, exit 2; each file is written to a temp beside it and renamed, so no file is half written and temps are removed |

## 6. Test allocation

Node unit tests (Vitest project `node`) against fixture trees copied to a temp folder:
- `testing/fixtures/valid/`: a FloorFifty-shaped game registered through the AF API: `characters/*.toml` (localized `displayName`), `songs/*.toml`, `stages/*.toml` (a `contentRef('song')`), `catalog.toml` (references to all three), FloorFifty's real `flow.toml` and `tuning.toml` with its `TUNABLES` declarations, `game.toml`, `assets.toml`, `messages/fr.json`; plus `equivalent-a/` and `equivalent-b/` (same meaning; different key order, file order and line endings).
- Ported FloorFifty cases (§0) and one test per §5 row asserting the exact formatted line.
- Exit-criteria tests (§10).

Parity: `hash/content-hash.parity.test.ts` hashes a fixed canonical string through `@mcthaydt/automata-sim/hash` in Chromium, WebKit and Firefox and expects the Node value. The compiler itself runs only in Node.

Vite: a real `build()` of a fixture app importing the virtual module; a dev server (`createServer`, no listening port) for the event and last-good tests.

No DOM, layout, GPU or Owner visual gates in this task.

## 7. Feedback workflow

Focused: `pnpm --filter @mcthaydt/automata-content exec vitest run --project node <file>`. Before each commit: `pnpm check`. Before the PR: the browsers project for the parity test and the full local CI run ([04](../../04-how-we-build.md)).

## 8. Dependencies (exact pins, `packages/content/package.json` only)

`effect` 3.22.2 (repo-wide), `smol-toml` 1.9.0 (Ruken's pin), `zod` 4.6.5, `@ruken/manifest` (`file:` the vendored tarball), `@mcthaydt/automata-sim` `workspace:*`; peer and dev `vite` 8.3.2 (Ruken's pin); dev `@types/node` 24.19.1, `vitest` 5.0.3, `@vitest/browser-playwright` 5.0.3, `playwright` 1.63.0 (the sim's pins). Rows for `docs/versions.md` are appended once the ship lane's file exists.

## 9. Ruken alignment

| Behavior | Ruken contract |
|---|---|
| `ruken-fields.json` `content` and `analytics` | `@ruken/manifest` `Manifest`, checked with `parseManifest` (§3.8) |
| `assets.toml` files and `preloadList` entries | `Manifest.loading.preload` (Ruken M2.1g), checked with `parseManifest` (`PRELOAD_PATH_INVALID`) |

Content never writes `ruken.toml` and never redefines a Ruken field.

**Requests to the integration owner**
- Resolved (coordinator, 2026-10-11): `defineContentSchema` results live in `*.content.ts` and `defineContentGenerator` results in `*.generator.ts`, enforced by `tooling/check-style`.
- Resolved (coordinator, 2026-10-11): both tuning modes (§3.4) stay: code-owned ranges (FloorFifty) and authored ranges (A0+A1).

## 10. Exit criteria

1. The fixture game (FloorFifty's real `flow.toml` and `tuning.toml` with its declarations) compiles; its flow passes with FloorFifty's capability map.
2. Every §5 row has a test asserting the exact formatted diagnostic; one save with several broken files reports all of them, sorted.
3. A dangling reference fails the compile (A0+A1 §8 item 6).
4. `content.hash` equals `hex64(xxhash64(utf8(canonicalJson(data))))` from `@mcthaydt/automata-sim/hash`; the parity test passes in Node, Chromium, WebKit and Firefox.
5. `equivalent-a` and `equivalent-b` give byte-identical outputs; changing any authored value changes the hash.
6. `content.d.ts` typechecks in a fixture consumer, and a wrong ID literal is a type error there.
7. `vite build` embeds the hash; a broken file fails it; in dev a broken save keeps the last good content and sends the error event, and the next good save recovers.
8. `check --verify-artifact` catches a hand-edited, missing, reformatted or no-longer-produced output; `build` removes outputs it no longer produces; `build` leaves no temp files and keeps good bytes on failure.
9. The embedded Endesga 64 equals `docs/art/palettes/endesga-64.txt`.
10. `pnpm check` and the full local CI run pass on Node 24.
