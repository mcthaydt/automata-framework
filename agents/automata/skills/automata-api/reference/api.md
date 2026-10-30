# Automata API reference, version 0.0.3

> Every export of every published `@mcthaydt/automata-*` entry point at version 0.0.3, generated from the published `.d.ts` files. An export that is not listed here does not exist in this version.

## `@mcthaydt/automata-content`

### `import { … } from '@mcthaydt/automata-content'`

#### `AssetsSource` (interface)

What `content/assets.toml` says: for each screen, the files it waits for (`dir/*` names every file in a
folder).

```ts
interface AssetsSource {
  readonly screens: Readonly<Record<string, {
    readonly files: readonly string[];
  }>>;
}
```

#### `buildContent` (const)

Compiles, writes every output under the output folder, then removes the outputs it no longer produces.

```ts
const buildContent: (options: ContentOptions) => Effect.Effect<CompiledContent, ContentCompileFailed | InvalidContentConfig | ContentWriteFailed>;
```

#### `checkTuningLayer` (function)

Checks one layer of tuning against code-owned declarations. `complete` is true for the base layer, which
must name every tunable; false for a partial override (FloorFifty's stage and mode layers).

Invariants are rejected before unknown names so the more specific answer wins, then non-numbers, then
integer declarations, then the inclusive range.

```ts
function checkTuningLayer(layer: Readonly<Record<string, unknown>>, options: TuningOptions & {
  readonly tunables: TunableDeclarations;
}, { complete }: {
  readonly complete: boolean;
}): Problem[];
```

#### `compileContent` (const)

Compiles `<root>/content` in memory. Writes nothing.

```ts
const compileContent: (options: ContentOptions) => Effect.Effect<CompiledContent, ContentCompileFailed | InvalidContentConfig>;
```

#### `CompiledContent` (interface)

The result of a compile: the content and its hash, the sim partition, every output file's text, warnings,
the languages and each language's message catalog.

```ts
interface CompiledContent {
  readonly data: ContentData;
  /** Over all of `data`: the boot check and evidence identity. Never compared with `sim.hash`. */
  readonly hash: string;
  /** What the sim receives, and the hash that gates snapshots and replays (M2.2 spec §3.2). */
  readonly sim: SimPartition;
  /** Each output path, relative to the output folder, to its exact text. Build and verify use the same bytes. */
  readonly files: ReadonlyMap<string, string>;
  /** Problems that do not stop a compile (`skippedFile`), sorted. They are not part of the hash or the outputs. */
  readonly warnings: readonly Diagnostic[];
  /** The source language, then each translation's language, sorted. */
  readonly languages: readonly string[];
  /**
   * Each language's checked catalog (without `$schema`), in `languages` order. Derived beside the hashed data,
   * never inside it, so a translation edit moves neither hash. Paraglide and the glyph sets read these.
   */
  readonly catalogs: ReadonlyMap<string, MessageCatalog>;
  /**
   * Where each language's messages are written, in `languages` order: a source message at its text in the
   * TOML, a translated one at its key in `messages/<lang>.json`. The glyph gate names a message by these (M5.5).
   */
  readonly messageLocations: ReadonlyMap<string, ReadonlyMap<string, MessageLocation>>;
}
```

#### `ContentCompileFailed` (class)

The authored content has problems. Every one is listed, sorted; nothing was written.

```ts
class ContentCompileFailed extends CompileFailedBase {}
```

#### `ContentConfig` (type)

The default export of `automata.content.ts`.

```ts
type ContentConfig = Omit<ContentOptions, "root"> & {
  /** The authoring guide whose tunable table `docs` writes and `--verify-artifact` checks. */
  readonly guide?: string | undefined;
};
```

#### `ContentData` (type)

The compiled content as it is written to `content.json` and hashed.

```ts
type ContentData = Readonly<Record<string, unknown>>;
```

#### `ContentGenerator` (interface)

A generator: a unique name and a pure `generate` that turns compiled content into extra files. Create one
with `defineContentGenerator`.

```ts
interface ContentGenerator {
  readonly name: string;
  generate(input: GeneratorInput): GeneratorOutput;
}
```

#### `contentHash` (function)

16 lowercase hex digits.

```ts
function contentHash(data: unknown): string;
```

#### `ContentOptions` (interface)

What the content compiler is given: the project root, the registered kinds, and optionally tunables,
invariants, flow capabilities, generators, an output folder and Paraglide.

```ts
interface ContentOptions {
  /** The project root; content is read from `<root>/content`. */
  readonly root: string;
  readonly schemas: readonly ContentSchemaDef[];
  /** Code-owned tunable names and ranges. Absent: ranges are authored in `tuning.toml`. */
  readonly tunables?: TunableDeclarations | undefined;
  /** Code-only constants an author may not write in `tuning.toml`. */
  readonly invariants?: readonly string[] | undefined;
  /** Code-owned screens, pairs and styles for `flow.toml`. */
  readonly flow?: FlowCapabilities | undefined;
  readonly generators?: readonly ContentGenerator[] | undefined;
  /** Relative to `root`. Default `content/generated`. */
  readonly outDir?: string | undefined;
  /** Compile the catalogs with Paraglide on each build (PRODUCT.L2). Absent: no Paraglide output. */
  readonly paraglide?: ParaglideOptions | undefined;
}
```

#### `contentRef` (function)

The ID of another content item of `kind`. Checked to exist, and to be that kind, after parsing.

```ts
function contentRef<const K extends string>(kind: K): z.ZodType<string, string>;
```

#### `ContentSchemaDef` (interface)

A content kind a game registers: its name, the Zod schema each item must match, where its TOML files live,
and whether the sim receives it. Create one with `defineContentSchema`.

```ts
interface ContentSchemaDef<K extends string = string, S extends z.ZodType = z.ZodType> {
  readonly kind: K;
  readonly schema: S;
  readonly place: ContentSchemaPlace;
  /**
   * Whether the sim receives this kind (M2.2 spec §3.1). Default true: content is gameplay unless the game
   * says otherwise, so a forgotten flag can only refuse a snapshot, never let a gameplay change through.
   */
  readonly sim: boolean;
}
```

#### `ContentSchemaOptions` (interface)

Options for `defineContentSchema`; `sim: false` keeps the kind out of the sim's content and its hash.

```ts
interface ContentSchemaOptions {
  readonly sim?: boolean;
}
```

#### `ContentSchemaPlace` (type)

Where a kind's files are: every TOML file under a folder (a collection), or one file (a document).

```ts
type ContentSchemaPlace = {
  readonly folder: string;
} | {
  readonly file: string;
};
```

#### `ContentWriteFailed` (class)

An output could not be written. Files already replaced are whole; none is half written.

```ts
class ContentWriteFailed extends WriteFailedBase {}
```

#### `DEFAULT_OUT_DIR` (const)

Where outputs go when `outDir` is not set: `content/generated`, relative to the project root.

```ts
const DEFAULT_OUT_DIR = "content/generated";
```

#### `DEFAULT_PALETTE` (const)

The palette a game gets when it has no `content/palette.toml`: Endesga 64.

```ts
const DEFAULT_PALETTE: Palette;
```

#### `defineContentGenerator` (function)

Defines a generator by name and `generate` function. Generators do no I/O: the compiler writes their files.
A generator that throws, repeats another's name, returns a path outside the output folder or writes a file
another generator wrote is reported as `InvalidContentConfig`.

```ts
function defineContentGenerator(name: string, generate: (input: GeneratorInput) => GeneratorOutput): ContentGenerator;
```

#### `defineContentSchema` (function)

Registers a content kind: a name, its Zod schema, and a folder (every TOML file in it is an item) or one
file (a single document). The sim receives the kind unless `{ sim: false }`. A bad registration (a name
that does not start with a lower-case letter followed by lower-case letters, digits and dashes, a built-in
name, a duplicate, or a place two kinds share) is reported when content compiles, as `InvalidContentConfig`.

```ts
function defineContentSchema<const K extends string, S extends z.ZodType>(kind: K, schema: S, place: ContentSchemaPlace, options?: ContentSchemaOptions): ContentSchemaDef<K, S>;
```

#### `Diagnostic` (interface)

One authoring problem: a stable `code`, the file to open, the 1-based line and column, the dotted key
inside it and a message that says what to write instead.

```ts
interface Diagnostic {
  readonly code: DiagnosticCode;
  /** Project-relative, `/`-separated, e.g. `content/tuning.toml`. */
  readonly file: string;
  readonly line: number;
  readonly column: number;
  /** Dotted path inside the file (`transitions.3.to`), or '' for the whole file. */
  readonly keyPath: string;
  readonly message: string;
}
```

#### `DiagnosticCode` (type)

Stable codes. Tests and tools match on these, so a code is never renamed, only added.

```ts
type DiagnosticCode = "invalidToml" | "invalidType" | "missingField" | "unknownField" | "invalidId" | "unknownReference" | "wrongKind" | "outOfRange" | "invariantNotAuthorable" | "invalidFlow" | "invalidPalette" | "invalidGame" | "missingAsset" | "invalidAsset" | "offPalette" | "missingGlyph" | "duplicateMessageKey" | "staleTranslation" | "staleArtifact" | "reservedKey" | "simReference" | "skippedFile";
```

#### `FlowCapabilities` (interface)

What the game's code implements: the screens, and optionally the pairs and destinations each allows.

```ts
interface FlowCapabilities {
  /** The only screen a session may begin on. */
  readonly entry?: string;
  readonly screens: readonly string[];
  /** For each screen and event, the destinations that screen is prepared to enter (FloorFifty `FLOW_TARGETS`). */
  readonly targets?: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;
  /** Transition styles the runtime draws. Default: only `cut`. */
  readonly styles?: readonly string[];
}
```

#### `FlowGraph` (interface)

The checked screen flow from `flow.toml`: the entry screen, every screen, the terminal screens and every
transition, in a fixed order.

```ts
interface FlowGraph {
  readonly entry: string;
  /** Sorted. */
  readonly screens: readonly string[];
  /** Sorted. */
  readonly terminal: readonly string[];
  /** Sorted by from, event, then to (FloorFifty `byPair`): declaration order means nothing. */
  readonly transitions: readonly FlowTransition[];
}
```

#### `FlowTransition` (interface)

One checked move in the flow: on `event` the game goes `from` one screen `to` another, drawn in the
`transition` style (`cut` when unwritten).

```ts
interface FlowTransition {
  readonly from: string;
  readonly event: string;
  readonly to: string;
  readonly transition: string;
}
```

#### `formatDiagnostic` (function)

`content/tuning.toml:12:1  GRAVITY  outOfRange: expected -1200..-100, received -2000`

```ts
function formatDiagnostic(d: Diagnostic): string;
```

#### `GameSource` (interface)

What `content/game.toml` says about the game: its source language, rating, content descriptors, estimated
hours, the analytics events it may send, and the screens whose files are preloaded.

```ts
interface GameSource {
  /** The language the TOML is written in. Default `en`. */
  readonly source_language: string;
  readonly rating: Rating;
  readonly descriptors: string[];
  readonly estimated_hours?: number | undefined;
  readonly custom_events: string[];
  /** The screens whose files Ruken preloads, in order. Default: the flow's entry. */
  readonly preload_screens?: string[] | undefined;
}
```

#### `GeneratorInput` (interface)

Everything a generator is given: the compiled content and its hash, the sim partition, the registered
schemas, the message catalog and the tuning metadata.

```ts
interface GeneratorInput {
  readonly data: ContentData;
  readonly hash: string;
  /** The sim partition and its hash (M2.2), so a generator never re-derives it from `schemas`. */
  readonly sim: SimPartition;
  readonly schemas: readonly ContentSchemaDef[];
  readonly messages: MessageCatalog;
  readonly tuning: TuningMeta;
}
```

#### `GeneratorOutput` (interface)

What a generator returns: files to write and diagnostics to report. Both are optional.

```ts
interface GeneratorOutput {
  /** Path relative to the output folder → the file's exact text. */
  readonly files?: Readonly<Record<string, string>>;
  readonly diagnostics?: readonly Diagnostic[];
}
```

#### `InvalidContentConfig` (class)

The game's code registered something unusable (a duplicate kind, a clashing generator).

```ts
class InvalidContentConfig extends InvalidConfigBase {}
```

#### `localized` (function)

Text a player reads, written in the source language. It gets a message key for translators.

```ts
function localized(): z.ZodType<string, string>;
```

#### `MessageCatalog` (type)

One locale's messages: message key to translated text.

```ts
type MessageCatalog = Readonly<Record<string, string>>;
```

#### `messageKey` (function)

The message key of one text. `id` is absent for a single-document kind.

```ts
function messageKey(kind: string, id: string | undefined, path: DataPath): string;
```

#### `MessageLocation` (interface)

A message's place in its file, 1-based.

```ts
interface MessageLocation {
  readonly file: string;
  readonly line: number;
  readonly column: number;
}
```

#### `Palette` (interface)

The game's palette: a name and its colors.

```ts
interface Palette {
  readonly name: string;
  /** `#rrggbb`, lowercase, in authored order. */
  readonly colors: readonly string[];
}
```

#### `ParaglideOptions` (interface)

Where and which catalogs `ContentOptions.paraglide` compiles with Paraglide on build.

```ts
interface ParaglideOptions {
  /** Where the generated `runtime.js` and `messages.js` go, relative to the root. Emptied on each compile. */
  readonly outdir: string;
  /** The game's own catalogs, `{locale}` path patterns relative to the root (`messages/ui/{locale}.json`). */
  readonly catalogs?: readonly string[] | undefined;
}
```

#### `PreloadInput` (interface)

What `preloadList` reads: the content options (to compile `game.toml` and `assets.toml`) and the built game
folder.

```ts
interface PreloadInput {
  readonly options: ContentOptions;
  /** The built game folder (Vite's `dist/`). */
  readonly distDir: string;
}
```

#### `preloadList` (const)

The files Ruken preloads before the game starts, in order, for `[loading] preload`: each `preload_screens`
screen's files from `assets.toml` (the flow's entry when none is named), without repeats. Empty without a
`game.toml`. Fails with `ContentCompileFailed` carrying a `missingAsset` diagnostic for every file the
build lacks, all at once, or with `InvalidContentConfig`.

```ts
const preloadList: (input: PreloadInput) => Effect.Effect<string[], ContentCompileFailed | InvalidContentConfig>;
```

#### `renderTuningTable` (function)

Every tunable once, sorted by name, with its type, range and value in `content/tuning.toml`.

```ts
function renderTuningTable(meta: TuningMeta): string;
```

#### `RukenFields` (type)

The `[content]` and `[analytics]` tables of Ruken's manifest, worked out from `game.toml` and the languages
present and written to `ruken-fields.json`.

```ts
type RukenFields = Pick<Manifest, "content" | "analytics">;
```

#### `SimPartition` (interface)

The part of the compiled content the sim receives (`tuning` and every kind with `sim: true`) and its hash,
which gates snapshots and replays.

```ts
interface SimPartition {
  /** `tuning` and each sim kind, the same objects as in the full data. */
  readonly data: ContentData;
  /** `contentHash(data)`: exactly what `createSim` computes from the same data. */
  readonly hash: string;
}
```

#### `sortDiagnostics` (function)

Returns the diagnostics in the one fixed order (file, line, column, key, code, message), without changing
the input. The order never depends on locale.

```ts
function sortDiagnostics(diagnostics: readonly Diagnostic[]): Diagnostic[];
```

#### `TunableDeclaration` (interface)

A tunable a game declares in code: `int` or `float`, an inclusive range and a default. Content selects a
value inside the range and never widens it.

```ts
interface TunableDeclaration {
  readonly type: TunableType;
  /** Inclusive lower bound. */
  readonly min: number;
  /** Inclusive upper bound. */
  readonly max: number;
  readonly default: number;
}
```

#### `TunableDeclarations` (type)

A game's tunables by name (upper-case words joined by underscores, such as `GRAVITY`).

```ts
type TunableDeclarations = Readonly<Record<string, TunableDeclaration>>;
```

#### `TuningMeta` (type)

Every tunable's type, value and range (`min`, `max`, `step`) by name, as written to `tuning-meta.json` for
debug sliders.

```ts
type TuningMeta = Readonly<Record<string, TuningEntryMeta>>;
```

#### `verifyContent` (const)

Fails with `staleArtifact` for each committed output that differs from a fresh compile.

```ts
const verifyContent: (options: ContentOptions) => Effect.Effect<void, ContentCompileFailed | InvalidContentConfig>;
```

#### `withTuningTable` (function)

The guide with its generated section replaced, or undefined when it has no markers.

```ts
function withTuningTable(guide: string, meta: TuningMeta): string | undefined;
```

### `import { … } from '@mcthaydt/automata-content/assets'`

#### `ATLAS_EXTRUDE` (const)

Pixels of each frame's edge repeated around it, so filtering never samples a neighbour.

```ts
const ATLAS_EXTRUDE = 1;
```

#### `ATLAS_PADDING` (const)

Transparent pixels between cells, and between a cell and the page edge.

```ts
const ATLAS_PADDING = 1;
```

#### `ATLAS_PAGE_MAX` (const)

The largest atlas page side, in pixels: WebGL2's guaranteed `MAX_TEXTURE_SIZE`.

```ts
const ATLAS_PAGE_MAX = 2048;
```

#### `AtlasFrameTooLarge` (class)

A frame that cannot fit a page even alone.

```ts
class AtlasFrameTooLarge extends Error {
  readonly frame: FrameSize;
  constructor(frame: FrameSize);
}
```

#### `AtlasOutputs` (interface)

What `buildAtlases` produces; the caller writes it.

```ts
interface AtlasOutputs {
  /** `<atlas>-<page>.png` and `<atlas>-<page>.json`, sorted by name. */
  readonly files: ReadonlyMap<string, Uint8Array>;
}
```

#### `buildAtlases` (const)

Builds every atlas `<root>/content/atlases.toml` names, or fails with every problem found. Without the file
there is nothing to build.

```ts
const buildAtlases: (root: string) => Effect.Effect<AtlasOutputs, ContentCompileFailed>;
```

#### `buildFonts` (const)

Builds every subset `<root>/content/fonts.toml` names, or fails with every problem found. Without the file
there is nothing to build, and the content is not compiled.

```ts
const buildFonts: (options: ContentOptions) => Effect.Effect<FontOutputs, ContentCompileFailed | InvalidContentConfig>;
```

#### `fontCoverage` (function)

Whether a font file (TrueType, OpenType, woff or woff2) has a glyph for each character.

```ts
function fontCoverage(font: Uint8Array): (character: string) => boolean;
```

#### `FontOutputs` (interface)

What `buildFonts` produces; the caller writes it.

```ts
interface FontOutputs {
  /** `<font>-<locale>-<hash8>.woff2` and `fonts.json` (`{ font: { locale: file } }`), sorted by name. */
  readonly files: ReadonlyMap<string, Uint8Array>;
}
```

#### `FontsFile` (interface)

`content/fonts.toml`: each source font by name.

```ts
interface FontsFile {
  readonly font: Readonly<Record<string, FontSource>>;
}
```

#### `FontSource` (interface)

One source font: its committed file, the sha256 of its bytes, its licence and the languages it serves.

```ts
interface FontSource {
  readonly file: string;
  readonly sha256: string;
  readonly license: string;
  readonly locales: readonly string[];
}
```

#### `FrameSize` (interface)

A frame to pack: its name (the PNG's file name without `.png`) and size in pixels.

```ts
interface FrameSize {
  readonly name: string;
  readonly width: number;
  readonly height: number;
}
```

#### `PackedAtlas` (interface)

Every frame's placement, and the pages they fill.

```ts
interface PackedAtlas {
  /** Each page's side, in pixels. */
  readonly pageSizes: readonly number[];
  /** In code-unit order of the frame names. */
  readonly placements: readonly Placement[];
}
```

#### `packFrames` (function)

Packs `frames` into atlas pages. Throws `AtlasFrameTooLarge` for a frame no page can hold.

```ts
function packFrames(frames: readonly FrameSize[]): PackedAtlas;
```

#### `Placement` (interface)

Where a frame's own pixels are: inside its extrusion, on page `page`.

```ts
interface Placement {
  readonly name: string;
  readonly page: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
```

#### `subsetWoff2` (function)

The font cut to `characters`, as woff2. A character the font lacks is simply not in the subset.

```ts
function subsetWoff2(source: Uint8Array, characters: ReadonlySet<string>): Promise<Uint8Array>;
```

### `import { … } from '@mcthaydt/automata-content/locale'`

#### `ALWAYS_CHARACTERS` (const)

Printable ASCII, CJK symbols and punctuation, half- and full-width forms, and the symbols the UI draws.

```ts
const ALWAYS_CHARACTERS: readonly string[];
```

#### `catalogCharacters` (function)

Every character the catalog's messages show. `$schema` is the file's format, not text a player reads.

```ts
function catalogCharacters(catalog: MessageCatalog): Set<string>;
```

#### `ContentText` (type)

`text(kind, id, path, authored, inputs?)`: the text in the active locale, or the authored text.

```ts
type ContentText = (kind: string, id: string | undefined, path: DataPath, authored: string, inputs?: Readonly<Record<string, unknown>>) => string;
```

#### `ContentTextOptions` (interface)

Options for `createContentText`.

```ts
interface ContentTextOptions {
  /** Called once per key the messages lack. */
  readonly onMissing?: ((key: string) => void) | undefined;
}
```

#### `createContentText` (function)

A lookup over the messages module Paraglide compiles into `paraglide.outdir` (its `messages.js`, imported whole).

```ts
function createContentText(messages: Readonly<Record<string, unknown>>, options?: ContentTextOptions): ContentText;
```

#### `localeCharacters` (function)

What a locale's subset font is cut to: `ALWAYS_CHARACTERS` and the catalog's characters.

```ts
function localeCharacters(catalog: MessageCatalog): Set<string>;
```

#### `MessageCatalog` (type)

One locale's messages: message key to translated text.

```ts
type MessageCatalog = Readonly<Record<string, string>>;
```

#### `messageKey` (function)

The message key of one text. `id` is absent for a single-document kind.

```ts
function messageKey(kind: string, id: string | undefined, path: DataPath): string;
```

#### `snakeKey` (function)

`snow-shrine` → `snow_shrine`, `fastFall` → `fast_fall`, `melee/sword` → `melee_sword`.

```ts
function snakeKey(value: string): string;
```

### `import { … } from '@mcthaydt/automata-content/vite'`

#### `automataContent` (function)

The Vite plugin that compiles content and serves it as `virtual:automata/content`. It builds when Vite
starts and on every save in dev, with the same build as `automata-content build`. A `vite build` with
content errors fails; a dev server keeps serving the last good content and reports the diagnostics through
Vite's logger and the `automata:content-error` event (`automata:content` after a good save).

```ts
function automataContent(pluginOptions?: AutomataContentOptions): Plugin;
```

#### `AutomataContentOptions` (type)

The plugin's options: `ContentOptions`, with `root` defaulting to Vite's root.

```ts
type AutomataContentOptions = Omit<ContentOptions, "root"> & {
  readonly root?: string | undefined;
};
```

#### `VIRTUAL_MODULE_ID` (const)

The import path of the compiled content: `content`, `contentHash`, `simContent` and `simContentHash`.

```ts
const VIRTUAL_MODULE_ID = "virtual:automata/content";
```

## `@mcthaydt/automata-host`

### `import { … } from '@mcthaydt/automata-host'`

#### `AnalyticsProps` (type)

The properties of one analytics event: flat names to strings, numbers or booleans, as the Ruken SDK accepts
them.

```ts
type AnalyticsProps = Record<string, string | number | boolean>;
```

#### `ErrorCode` (type)

Ruken's error codes (`@ruken/protocol` `ERROR_CODES`), as the SDK's `RukenError` carries them.

```ts
type ErrorCode = RukenError["code"];
```

#### `findRukenSdkMarkers` (function)

The markers found in `code` (built JavaScript), each named once; empty means no Ruken SDK code.

```ts
function findRukenSdkMarkers(code: string): string[];
```

#### `HOST_EXIT_CAP` (const)

How long the game may hold the host's close (FloorFifty `ruken/exit.ts`,
Ruken P6 §4 "1 s cap"). Ruken's own grace is 1.5 s
(`sdk-host/src/bridge/defaults.ts` `EXIT_GRACE_MS`), so the game always
answers before the host gives up on it.

```ts
const HOST_EXIT_CAP: Duration.Duration;
```

#### `HostError` (class)

Any failure after the handshake. A request that fails never falls back to another path.

```ts
class HostError extends HostErrorBase {}
```

#### `HostHandshakeFailed` (class)

The page is inside a frame, but the SDK got no usable welcome and fell back
to its standalone session. Not fatal: reported on `Hosting.handshake.fellBack`
and logged once (shared contracts §1.2).

```ts
class HostHandshakeFailed extends HostHandshakeFailedBase {}
```

#### `Hosting` (interface)

Everything a game may ask of, or hear from, its host: the `Hosting` contract
of the M1 shared contracts spec §1, implemented by the host lane.
The `Hosting` service tag.

```ts
interface Hosting {
  /**
   * Which session this is: 'ruken' when Ruken hosts it; 'standalone' when the Ruken adapter got the SDK's
   * standalone session; 'web' for the web adapter of an `itch` or `web` build (PUB spec §3).
   */
  readonly kind: "ruken" | "standalone" | "web";
  /** The host's name for UI, such as "Back to …": 'Ruken', 'itch.io' or 'this page' (PUB spec §3). */
  readonly hostName: string;
  /** Some when the page is inside a frame but the SDK fell back to standalone (shared contracts §1.2). */
  readonly handshake: {
    readonly fellBack: Option.Option<HostHandshakeFailed>;
  };
  readonly player: {
    readonly id: string;
    readonly displayName: string;
  };
  readonly locale: string;
  readonly granted: ReadonlySet<Capability>;
  /** Resolves on `session.ready` (at once standalone). No gameplay renders before it (R-04). */
  readonly ready: Effect.Effect<void, HostError>;
  readonly lifecycle: Subscribable.Subscribable<LifecyclePayload>;
  readonly input: Subscribable.Subscribable<InputModePayload>;
  readonly display: Subscribable.Subscribable<DisplayMetricsPayload>;
  readonly audio: Subscribable.Subscribable<AudioChange>;
  readonly entitlements: Subscribable.Subscribable<EntitlementsPayload>;
  readonly savesStatus: Subscribable.Subscribable<SavesStatus>;
  readonly saves: HostingSaves;
  readonly leaderboards: HostingLeaderboards;
  /** Ruken's `FullscreenRes`: `support` says what the device allows (for example `ios-home-screen`). */
  setFullscreen(on: boolean): Effect.Effect<FullscreenRes, HostError>;
  readonly round: {
    /** A round began. A second start before an end is dropped. */
    readonly start: Effect.Effect<void>;
    /** The open round ended. With no round open it is dropped. */
    end(outcome?: RoundOutcome): Effect.Effect<void>;
    /**
     * One item per round that ended, with its outcome, from the moment the stream
     * is read (nothing is replayed). A dropped end gives none. Ends when Hosting
     * shuts down. The `round-end` autosave trigger reads this.
     */
    readonly ended: Stream.Stream<RoundOutcome | undefined>;
  };
  /** A disclosed analytics event. Never fails: undisclosed, unconsented or refused events are dropped. */
  track(event: string, props?: AnalyticsProps): Effect.Effect<void>;
  /** Hands the player back to the host. Standalone it does nothing. */
  exit(reason?: "player" | "completed"): Effect.Effect<void, HostError>;
  /**
   * Answers the host's "Open game menu" while the scope is open: the handler
   * returns true when the game opened its own menu. With no handler the host
   * keeps its own drawer.
   */
  onMenuRequest(handler: () => boolean): Effect.Effect<void, never, Scope.Scope>;
  /**
   * Runs `handler` when the host closes the game, while the scope is open. The
   * host waits for it, but AF cuts everything off at `HOST_EXIT_CAP` (1 s),
   * inside Ruken's 1.5 s grace. Handlers run one after another in registration
   * order and the host save flush runs after the last, so a write a handler
   * makes is flushed. All of them share the one cap: a handler that never
   * returns costs the handlers after it and the flush.
   */
  onExiting(handler: Effect.Effect<void>): Effect.Effect<void, never, Scope.Scope>;
}
const Hosting: Context.Tag<Hosting, Hosting>;
```

#### `HostingLeaderboards` (interface)

The host's leaderboards (Ruken's `LeaderboardsApi`, PRODUCT spec §2 F1). Needs the `leaderboards` grant.
Each call relays the SDK's answer or error as a `HostError`: without the grant and standalone it fails
`UNSUPPORTED`, offline it fails with the host's code. None keeps a local board instead.

```ts
interface HostingLeaderboards {
  /** Submits `score` to `board` (a Ruken slug); `meta` is passed to the host as is. */
  submit(board: string, score: number, meta?: Parameters<LeaderboardsApi["submit"]>[2]): Effect.Effect<LeaderboardSubmitRes, HostError>;
  /** Reads `board`: the top entries or those around the player, as the SDK's options say. */
  get(board: string, query?: Parameters<LeaderboardsApi["get"]>[1]): Effect.Effect<LeaderboardGetRes, HostError>;
}
```

#### `HostingLive` (function)

The single `Hosting` layer for games (shared contracts §1.1).

```ts
function HostingLive(options: HostingOptions, seams?: HostingSeams): Layer.Layer<Hosting, HostError>;
```

#### `HostingOptions` (interface)

What the game asks of its host. In M1 the game passes these by hand; later they come from content.

```ts
interface HostingOptions {
  /** `[game].id` in ruken.toml; the host checks it. */
  readonly gameId: string;
  /** The capabilities the game asks the host for (`wants` in the hello). */
  readonly wants: readonly Capability[];
  /** Fixed for the game's whole life (Ruken's answer 7 in docs/spikes/s6-ruken-stub.md). */
  readonly pauseBehavior: PauseBehavior;
  /**
   * `[analytics].custom_events` in ruken.toml. When given, `track` drops every
   * other name before it reaches the SDK (FloorFifty `ruken/host.ts` `track`).
   */
  readonly disclosedEvents?: readonly string[];
  /** Test builds only: exact https origins also trusted to send the welcome. Passed to `Ruken.init` as is. */
  readonly testHostOrigins?: readonly string[];
}
```

#### `HostingSaves` (interface)

The player's saves (shared contracts §1.1). Each call relays the SDK's error as a `HostError`; none falls back.

```ts
interface HostingSaves {
  get(key: string): Effect.Effect<string | null, HostError>;
  set(key: string, value: string): Effect.Effect<void, HostError>;
  remove(key: string): Effect.Effect<void, HostError>;
  readonly flush: Effect.Effect<SavesFlushRes, HostError>;
  /** Every key the session holds, sorted by code unit (M5 spec §4.1). Fails `CANCELLED` once Hosting has shut down. */
  readonly keys: Effect.Effect<readonly string[], HostError>;
  /**
   * Another device's write, or the host's conflict choice, reached this session (`SavesApi.on('changed')`, M5 spec
   * §4.1). No current value: only changes. Ends when Hosting shuts down.
   */
  readonly changed: Stream.Stream<SavesChangedPayload>;
}
```

#### `HostingSeams` (interface)

Test seams. Games pass nothing; `HostingTest` passes the fake host's in-memory window pair.

```ts
interface HostingSeams {
  readonly env?: SdkEnv;
}
```

#### `makeHosting` (function)

Builds `Hosting` over `Ruken.init`. The SDK decides between a hosted session
and its standalone one (shared contracts §1.1), enforces grants and limits,
and owns the handshake's timing; AF relays what it reports.

When the scope closes, in this order: Hosting marks itself closed (later
calls fail with `HostError{code:'CANCELLED'}`), every observed stream ends,
and then the session is disposed.

```ts
function makeHosting(options: HostingOptions, seams?: HostingSeams): Effect.Effect<Hosting, HostError, Scope.Scope>;
```

#### `RUKEN_SDK_MARKERS` (const)

String literals only the Ruken SDK contains, which survive minification (PUB spec §3): the SDK's storage probe
key (`env-browser.ts`) and its standalone refusal message (`standalone.ts`), at RukenApp b30d31b. An `itch` or
`web` build must contain neither, because it bundles the web adapter instead of the SDK; a `ruken` build
contains both. The web adapter's own probe key (`WEB_STORAGE_PROBE_KEY`) is deliberately different.

Re-check these after re-vendoring the SDK: `target.build.test.ts` fails if a default build stops containing them.

```ts
const RUKEN_SDK_MARKERS: readonly string[];
```

#### `toHostError` (function)

Turns whatever the SDK threw or rejected with into a `HostError`.
- A `RukenError` keeps its code and retryable flag.
- A `QuotaExceededError` is what Ruken's save map throws for a save over a
  limit (`sdk/src/save-map.ts`); it becomes `QUOTA_EXCEEDED`, which Ruken
  marks not retryable.
- Anything else (a closed port, a bug) becomes `INTERNAL`, which Ruken marks retryable.

```ts
function toHostError(operation: string, cause: unknown): HostError;
```

### `import { … } from '@mcthaydt/automata-host/testing'`

#### `FakeHostClock` (interface)

The clock shape `@ruken/sdk-host`'s fake host takes; the game's `SdkEnv.timers` run on it too.

```ts
interface FakeHostClock {
  epochMs(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}
```

#### `FakeHostHandle` (interface)

The fake host behind `HostingTest`, for tests that drive the host side.

```ts
interface FakeHostHandle {
  readonly host: FakeHost;
  /** Every message of `type` the game sent the host, as payloads, in order. */
  sentByGame(type: string): unknown[];
}
const FakeHostHandle: Context.Tag<FakeHostHandle, FakeHostHandle>;
```

#### `HostingTest` (function)

`HostingLive` wired to `@ruken/sdk-host`'s fake host over in-memory ports,
with the real SDK in between (shared contracts §1.1). Provides `Hosting` and
`FakeHostHandle`; both are disposed when the scope closes.

```ts
function HostingTest(options?: HostingTestOptions): Layer.Layer<Hosting | FakeHostHandle, HostError>;
```

#### `HostingTestOptions` (interface)

What to change about `HostingTest`'s defaults: the game's hosting options, the fake host, the SDK
environment and the game's origin.

```ts
interface HostingTestOptions {
  /** Overrides for the game's options; the defaults ask for saves and pause in the menu. */
  readonly hosting?: Partial<HostingOptions>;
  /** Overrides for `createFakeHost` (clock, grants, seeded saves, consent, scripted UI and ads). */
  readonly host?: Partial<Omit<FakeHostOptions, "gameOrigin" | "gameId">>;
  /** Rewrites the game's `SdkEnv`, for example to forge where messages come from. */
  readonly env?: (env: SdkEnv) => SdkEnv;
  /** Where the game is served from; the SDK's allowlist depends on it. Defaults to `TEST_GAME_ORIGIN`. */
  readonly gameOrigin?: string;
}
```

#### `manualClock` (function)

SDK and fake-host timing (hello retries, the 10 s handshake give-up, request
timeouts) runs on this clock, so a test can step past them without waiting
(shared contracts §1.4). AF's own timing uses Effect's `TestClock` instead.
Timers fire in due order; a timer scheduled by another one fires in the same
`advance` if it falls due within it.

```ts
function manualClock(startMs?: number): ManualClock;
```

#### `ManualClock` (interface)

A clock that moves only when the test calls `advance`. It is both the fake
host's `BridgeClock` (`epochMs`) and the SDK's `SdkTimers` (`now`), so one
clock drives both sides (shared contracts §1.4).

```ts
interface ManualClock extends FakeHostClock {
  now(): number;
  advance(ms: number): void;
}
```

#### `realClock` (const)

Real time, for tests that only need the host to answer.

```ts
const realClock: FakeHostClock;
```

#### `runScoped` (function)

Runs a test program in a fresh scope, closing it (and every layer built inside) at the end.

```ts
function runScoped<A, E>(program: Effect.Effect<A, E, Scope.Scope>): Promise<A>;
```

#### `TEST_GAME_ORIGIN` (const)

The origin `HostingTest` serves the game from unless `gameOrigin` says otherwise.

```ts
const TEST_GAME_ORIGIN = "http://localhost:4400";
```

## `@mcthaydt/automata-node`

### `import { … } from '@mcthaydt/automata-node'`

#### `FileError` (class)

Reading, writing, listing or removing a file failed.

```ts
class FileError extends FileErrorBase {
  override get message(): string;
}
```

#### `Files` (interface)

The service's tag. A tag and an identity interface instead of `class Files extends Context.Tag(...)`, because
isolatedDeclarations cannot type a call in an `extends` clause (the pattern `host`'s `Hosting` uses).

```ts
interface Files {
  readonly _Files: unique symbol;
}
const Files: Context.Tag<Files, FilesService>;
```

#### `FilesLive` (const)

`Files` on `node:fs`: synchronous calls wrapped in `Effect.try`, so the first failure surfaces as a
`FileError`.

```ts
const FilesLive: Layer.Layer<Files>;
```

#### `FilesService` (interface)

The file operations build-time code needs, each as an Effect. A failed call fails with a `FileError` naming
the path, except `exists`, which cannot fail.

```ts
interface FilesService {
  readText(path: string): Effect.Effect<string, FileError>;
  /**
   * The file's bytes exactly as they are on disk, for binary inputs such as images: reading them as text
   * would replace every byte that is not valid UTF-8. The array owns its bytes (it is not a Node `Buffer`).
   */
  readBytes(path: string): Effect.Effect<Uint8Array, FileError>;
  /** Writes UTF-8 text, creating parent folders. */
  writeText(path: string, text: string): Effect.Effect<void, FileError>;
  exists(path: string): Effect.Effect<boolean>;
  /** Every file below `dir`, as `/`-separated paths relative to it, sorted. */
  listFiles(dir: string): Effect.Effect<readonly string[], FileError>;
  /** Removes a file or folder recursively; a missing path is not an error. */
  remove(path: string): Effect.Effect<void, FileError>;
}
```

#### `ProcessError` (class)

A program could not be started (not found, not executable). A non-zero exit is not this error.

```ts
class ProcessError extends ProcessErrorBase {
  override get message(): string;
}
```

#### `ProcessRunner` (interface)

The service's tag; see `Files` for why it is not a `Context.Tag` class.

```ts
interface ProcessRunner {
  readonly _ProcessRunner: unique symbol;
}
const ProcessRunner: Context.Tag<ProcessRunner, ProcessRunnerService>;
```

#### `ProcessRunnerLive` (const)

`ProcessRunner` on `node:child_process`: the real programs, with the parent's environment plus
`RunOptions.env`.

```ts
const ProcessRunnerLive: Layer.Layer<ProcessRunner>;
```

#### `ProcessRunnerService` (interface)

Runs a program with arguments and no shell. The effect fails with a `ProcessError` only when the program
cannot be started; interrupting it stops the program.

```ts
interface ProcessRunnerService {
  run(command: string, args: readonly string[], options?: RunOptions): Effect.Effect<RunResult, ProcessError>;
}
```

#### `RunOptions` (interface)

How a program is started: its working folder, extra environment, stdin, and whether its output is also
echoed.

```ts
interface RunOptions {
  readonly cwd?: string | undefined;
  /** Added to the parent's environment. */
  readonly env?: Readonly<Record<string, string>> | undefined;
  /** Written to the program's stdin, which is then closed. */
  readonly stdin?: Uint8Array | undefined;
  /** Also copy the program's output to this process's stdout and stderr as it arrives. */
  readonly echo?: boolean | undefined;
}
```

#### `RunResult` (interface)

What a finished program left: its exit code (128 when a signal killed it) and everything it wrote to stdout
and stderr, decoded as UTF-8. A non-zero exit code is a result, not a failure.

```ts
interface RunResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}
```

#### `TaggedErrorClass` (type)

The class `Data.TaggedError(tag)` returns, written out. isolatedDeclarations cannot infer the type of a call in
an `extends` clause, so each error extends a constant annotated with this type instead (the pattern of
`content`'s compile errors and `host`'s errors). `ship` uses it for its own errors.

```ts
type TaggedErrorClass<Tag extends string, Fields> = new (fields: Fields) => Cause.YieldableError & {
  readonly _tag: Tag;
} & Readonly<Fields>;
```

## `@mcthaydt/automata-physics`

### `import { … } from '@mcthaydt/automata-physics/2d'`

#### `body2d` (function)

The spawn part that gives an entity a rigid body of a `BodyKind`. Damping and velocities (`vx`, `vy` in
m/s, `angvel` in rad/s) are 0 unless given.

```ts
function body2d(kind: BodyKind, opts?: {
  linearDamping?: number;
  angularDamping?: number;
  vx?: number;
  vy?: number;
  angvel?: number;
}): SpawnPart;
```

#### `BodyKind` (const)

The codes a rigid body's `kind` field holds: `dynamic` (moved by gravity and contacts), `fixed` (never
moves), `kinematicPosition` (moved by writing its transform) and `kinematicVelocity` (moved by its
velocity). `BodyKind` is also the type of those values.

```ts
const BodyKind: {
  readonly dynamic: 0;
  readonly fixed: 1;
  readonly kinematicPosition: 2;
  readonly kinematicVelocity: 3;
};
type BodyKind = (typeof BodyKind)[keyof typeof BodyKind];
```

#### `Collider2D` (const)

One collider. `shape` is a `ShapeKind`; sizes are halves: ball radius `hx`; cuboid half extents `hx, hy`;
capsule radius `hx` and half-height `hy`. `groups` is Rapier's packed membership << 16 | filter.

```ts
const Collider2D: ComponentDef<typeof colliderFields>;
```

#### `collider2d` (const)

The spawn parts that give an entity a collider: `ball(radius)`, `cuboid(hx, hy)` with half extents, and
`capsule(halfHeight, radius)`. Each takes `ColliderOptions`, whose defaults are Rapier's (every group,
friction 0.5, no bounce, not a sensor).

```ts
const collider2d: {
  ball(radius: number, opts?: ColliderOptions): SpawnPart;
  cuboid(hx: number, hy: number, opts?: ColliderOptions): SpawnPart;
  capsule(halfHeight: number, radius: number, opts?: ColliderOptions): SpawnPart;
};
```

#### `ColliderOptions` (interface)

Options every collider helper takes. The defaults are Rapier's: every group, friction 0.5, no bounce.

```ts
interface ColliderOptions {
  readonly sensor?: boolean;
  readonly groups?: number;
  readonly friction?: number;
  readonly restitution?: number;
}
```

#### `CollisionEnded2D` (const)

Two colliders stopped touching, or one was removed. The payload is the one of `CollisionStarted2D`; ended
events come before started events in a tick.

```ts
const CollisionEnded2D: EventDef<typeof pair>;
```

#### `CollisionStarted2D` (const)

Two colliders began touching (or, with a sensor, overlapping). `a` and `b` are the entities' StableIds, `a`
the lower, and `sensor` is true when either collider is a sensor. Emitted in `postPhysics`, in `(a, b)`
order, after that tick's ended events.

```ts
const CollisionStarted2D: EventDef<typeof pair>;
```

#### `physics2d` (function)

The 2D physics plugin (M2.1 spec §3.5). Rapier's wasm loads inside `createSim`, through the dynamic import
in rapier-2d.ts, so importing this module costs nothing until a sim uses it.

```ts
function physics2d(options?: Physics2DOptions): PluginDef;
```

#### `Physics2DOptions` (interface)

The options of `physics2d`. Gravity is part of the sim's schema hash, so a different gravity is a different
sim.

```ts
interface Physics2DOptions {
  /** m/s², default { x: 0, y: -9.81 }. */
  readonly gravity?: {
    readonly x: number;
    readonly y: number;
  };
}
```

#### `RigidBody2D` (const)

A Rapier rigid body: its kind (`BodyKind`), damping, and linear (m/s) and angular (rad/s) velocity.

```ts
const RigidBody2D: ComponentDef<typeof bodyFields>;
```

#### `ShapeKind` (const)

The codes a collider's `shape` field holds: `ball`, `cuboid` and `capsule`. `ShapeKind` is also the type of
those values.

```ts
const ShapeKind: {
  readonly ball: 0;
  readonly cuboid: 1;
  readonly capsule: 2;
};
type ShapeKind = (typeof ShapeKind)[keyof typeof ShapeKind];
```

#### `transform2d` (function)

The spawn part that places an entity: `x` and `y` in metres and `rotation` in radians, each 0 unless given.

```ts
function transform2d(at?: {
  x?: number;
  y?: number;
  rotation?: number;
}): SpawnPart;
```

#### `Transform2D` (const)

Position in metres and rotation in radians. Rendered.

```ts
const Transform2D: ComponentDef<typeof transformFields>;
```

### `import { … } from '@mcthaydt/automata-physics/3d'`

#### `body3d` (function)

The spawn part that gives an entity a rigid body of a `BodyKind`. Damping and velocities (`vx`, `vy`, `vz`
in m/s, `wx`, `wy`, `wz` in rad/s) are 0 unless given.

```ts
function body3d(kind: BodyKind, opts?: {
  linearDamping?: number;
  angularDamping?: number;
  vx?: number;
  vy?: number;
  vz?: number;
  wx?: number;
  wy?: number;
  wz?: number;
}): SpawnPart;
```

#### `BodyKind` (const)

The codes a rigid body's `kind` field holds: `dynamic` (moved by gravity and contacts), `fixed` (never
moves), `kinematicPosition` (moved by writing its transform) and `kinematicVelocity` (moved by its
velocity). `BodyKind` is also the type of those values.

```ts
const BodyKind: {
  readonly dynamic: 0;
  readonly fixed: 1;
  readonly kinematicPosition: 2;
  readonly kinematicVelocity: 3;
};
type BodyKind = (typeof BodyKind)[keyof typeof BodyKind];
```

#### `Collider3D` (const)

One collider. `shape` is a `ShapeKind`; sizes are halves: ball radius `hx`; cuboid half extents `hx, hy, hz`;
capsule radius `hx` and half-height `hy`. `groups` is Rapier's packed membership << 16 | filter.

```ts
const Collider3D: ComponentDef<typeof colliderFields>;
```

#### `collider3d` (const)

The spawn parts that give an entity a collider: `ball(radius)`, `cuboid(hx, hy, hz)` with half extents, and
`capsule(halfHeight, radius)`. Each takes `ColliderOptions`, whose defaults are Rapier's (every group,
friction 0.5, no bounce, not a sensor).

```ts
const collider3d: {
  ball(radius: number, opts?: ColliderOptions): SpawnPart;
  cuboid(hx: number, hy: number, hz: number, opts?: ColliderOptions): SpawnPart;
  capsule(halfHeight: number, radius: number, opts?: ColliderOptions): SpawnPart;
};
```

#### `ColliderOptions` (interface)

Options every collider helper takes. The defaults are Rapier's: every group, friction 0.5, no bounce.

```ts
interface ColliderOptions {
  readonly sensor?: boolean;
  readonly groups?: number;
  readonly friction?: number;
  readonly restitution?: number;
}
```

#### `CollisionEnded3D` (const)

Two colliders stopped touching, or one was removed. The payload is the one of `CollisionStarted3D`; ended
events come before started events in a tick.

```ts
const CollisionEnded3D: EventDef<typeof pair>;
```

#### `CollisionStarted3D` (const)

Two colliders began touching (or, with a sensor, overlapping). `a` and `b` are the entities' StableIds, `a`
the lower, and `sensor` is true when either collider is a sensor. Emitted in `postPhysics`, in `(a, b)`
order, after that tick's ended events.

```ts
const CollisionStarted3D: EventDef<typeof pair>;
```

#### `physics3d` (function)

The 3D physics plugin (M2.1 spec §3.5). Rapier's wasm loads inside `createSim`, through the dynamic import
in rapier-3d.ts, so importing this module costs nothing until a sim uses it.

```ts
function physics3d(options?: Physics3DOptions): PluginDef;
```

#### `Physics3DOptions` (interface)

The options of `physics3d`. Gravity is part of the sim's schema hash, so a different gravity is a different
sim.

```ts
interface Physics3DOptions {
  /** m/s², default { x: 0, y: -9.81, z: 0 }. */
  readonly gravity?: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
}
```

#### `RigidBody3D` (const)

A Rapier rigid body: its kind (`BodyKind`), damping, and linear (m/s) and angular (rad/s) velocity.

```ts
const RigidBody3D: ComponentDef<typeof bodyFields>;
```

#### `ShapeKind` (const)

The codes a collider's `shape` field holds: `ball`, `cuboid` and `capsule`. `ShapeKind` is also the type of
those values.

```ts
const ShapeKind: {
  readonly ball: 0;
  readonly cuboid: 1;
  readonly capsule: 2;
};
type ShapeKind = (typeof ShapeKind)[keyof typeof ShapeKind];
```

#### `transform3d` (function)

The spawn part that places an entity: `x`, `y` and `z` in metres and a rotation quaternion (`qx`, `qy`,
`qz`, `qw`). Position is 0 and the rotation is the identity unless given.

```ts
function transform3d(at?: {
  x?: number;
  y?: number;
  z?: number;
  qx?: number;
  qy?: number;
  qz?: number;
  qw?: number;
}): SpawnPart;
```

#### `Transform3D` (const)

Position in metres and rotation as a unit quaternion. Rendered.

```ts
const Transform3D: ComponentDef<typeof transformFields>;
```

## `@mcthaydt/automata-ship`

### `import { … } from '@mcthaydt/automata-ship'`

#### `BoardName` (interface)

A board a source file names, by its name and position (1-based, at the opening quote).

```ts
interface BoardName {
  readonly board: string;
  readonly line: number;
  readonly col: number;
}
```

#### `boardNamesIn` (function)

The boards one source file names, in source order; `undefined` when it does not parse (its typecheck already
fails, and a half-read tree could report a board that is not there). `automata check` reads files through its
own `Files` and calls this; `findUndeclaredBoards` walks the disk.

```ts
function boardNamesIn(file: string, code: string): BoardName[] | undefined;
```

#### `BUILD_ID_PATTERN` (const)

A build's ID on the dev host: the commit's UTC time to the minute, then its short sha, for example
`202610111205-abcdef0` (FloorFifty `deploy/bin/build-tag`). Time first, so IDs sort as commits do.
The host's `deploy` script accepts only IDs matching BUILD_ID_PATTERN.

```ts
const BUILD_ID_PATTERN: RegExp;
```

#### `buildIdFor` (function)

The build ID for a commit: its UTC time to the minute, a dash, then the first seven characters of its sha.
Throws for a `sha` that is not 7 to 40 lower-case hex digits.

```ts
function buildIdFor(commit: {
  readonly time: Date;
  readonly sha: string;
}): string;
```

#### `ButlerFailed` (class)

butler exited non-zero. Its output was already shown as it ran; the CLI exits with butler's own code.

```ts
class ButlerFailed extends ButlerFailedBase {
  override get message(): string;
}
```

#### `checkManifest` (function)

Checks `ruken.toml` text with Ruken's own parser, so AF accepts exactly what Ruken accepts.

```ts
function checkManifest(toml: string): Effect.Effect<Manifest, ManifestInvalid>;
```

#### `checkVersion` (function)

A release's version must be its tag's (FloorFifty `deploy/tools/ruken-pack.ts`): the build Ruken shows as
0.10.2 is the one tagged v0.10.2. A branch build has no tag and passes. Returns what is wrong, or undefined.

```ts
function checkVersion(version: string, tag: string | undefined): string | undefined;
```

#### `declaredBoardsIn` (function)

The board ids a `ship.config.ts` declares: the keys of its `leaderboards` object, read from the source as written
(`automata check` reads files, it does not run them). `undefined` when the file does not parse, or `leaderboards`
is not written as an object (a spread or a variable), so the check says it could not read the boards.

```ts
function declaredBoardsIn(code: string): string[] | undefined;
```

#### `DeclaredInputs` (interface)

The `runtime.inputs` a `ship.config.ts` declares, with the position of its opening bracket.

```ts
interface DeclaredInputs {
  readonly inputs: string[];
  readonly line: number;
  readonly col: number;
}
```

#### `declaredInputsIn` (function)

The `runtime.inputs` a `ship.config.ts` declares, read from the source as written (`automata check` reads files, it
does not run them). `undefined` when the file does not parse or `runtime.inputs` is not an array of string literals.

```ts
function declaredInputsIn(code: string): DeclaredInputs | undefined;
```

#### `declaredOrientationIn` (function)

The `runtime.orientation` a `ship.config.ts` declares, read from the source as written (`automata check` reads
files, it does not run them). `undefined` when the file does not parse or `runtime.orientation` is not written as
a literal, so the check can say it could not read it.

```ts
function declaredOrientationIn(code: string): string | undefined;
```

#### `defineShipConfig` (function)

Identity function that gives a game's `ship.config.ts` type checking and editor completion.

```ts
function defineShipConfig(config: ShipConfig): ShipConfig;
```

#### `deployDev` (function)

Sends a prepared build to the dev host and returns its build ID and the URL it is served at. Fails with
`ManifestInvalid` for a bad `ruken.toml` in the build, `DeployFailed` when `tar` or `ssh` exits non-zero,
or a `FileError` or `ProcessError`. The temporary staging copy is removed either way.

```ts
function deployDev(input: DeployDevInput): Effect.Effect<{
  buildId: string;
  url: string;
}, DeployDevError, Files | ProcessRunner>;
```

#### `DeployDevInput` (interface)

What `deployDev` sends and where: a prepared build folder, the commit it came from, the dev host's ssh
target and URL, and whether the build becomes the one `/` redirects to.

```ts
interface DeployDevInput {
  /** A build folder `ship prepare` has written `ruken.toml` into. */
  readonly distDir: string;
  readonly commit: {
    readonly sha: string;
    readonly time: Date;
  };
  readonly tag: string | undefined;
  readonly branch: string | undefined;
  /** The ssh destination, e.g. `deploy@af-dev.floorfifty.duckdns.org`. */
  readonly target: string;
  /** The dev host's URL, e.g. `https://af-dev.floorfifty.duckdns.org`. It is also the page allowed to frame the game. */
  readonly siteUrl: string;
  /** Also make this build the one `/` redirects to. */
  readonly activate: boolean;
  /** The deploy key, when it is not in ~/.ssh (CI writes it to the runner's temp folder and removes it). */
  readonly sshKeyFile?: string | undefined;
  /** The dev host's known_hosts line, beside the key. */
  readonly knownHostsFile?: string | undefined;
}
```

#### `DeployFailed` (class)

The dev host's deploy step (tar or ssh) failed; `output` is what it printed.

```ts
class DeployFailed extends DeployFailedBase {
  override get message(): string;
}
```

#### `EntryMissing` (class)

`[game] entry` names a file the build does not have.

```ts
class EntryMissing extends EntryMissingBase {
  override get message(): string;
}
```

#### `EnvValue` (interface)

One variable read from a game's `.env*` files, whose value the bundle scan looks for in the build.

```ts
interface EnvValue {
  /** The `.env*` file the variable came from, relative to the game folder. */
  readonly file: string;
  readonly name: string;
  readonly value: string;
}
```

#### `FileError` (class)

Reading, writing, listing or removing a file failed.

```ts
class FileError extends FileErrorBase {
  override get message(): string {
    return `${this.path}: ${describe(this.cause)}`
  }
}
```

#### `findExecutable` (function)

The first `name` on `pathEnv` that is an executable file, or undefined. Windows also tries .exe, .cmd, .bat.

```ts
function findExecutable(name: string, pathEnv?: string, platform?: NodeJS.Platform): string | undefined;
```

#### `findInputsProblems` (function)

Each disagreement between `inputs` (a config's `runtime.inputs`) and what the `keys()` calls in a game's sources
bind, in `inputsProblems`' words; empty when they agree or the game has no `keys()` call to compare.

```ts
function findInputsProblems(gameDir: string, inputs: readonly string[]): string[];
```

#### `findOrientationMismatches` (function)

Every `defineGame` in a game's sources that plays in an orientation other than `declared` (its config's).

```ts
function findOrientationMismatches(gameDir: string, declared: string): OrientationMismatchFound[];
```

#### `findRootAbsoluteReferences` (function)

Every root-absolute reference to one of the build's own files in a built folder, walking it in name order.
Reads each file's syntax (scripts, stylesheets, pages, JSON), so comments and prose are not reported.

```ts
function findRootAbsoluteReferences(distDir: string): RootAbsoluteReferenceFound[];
```

#### `findSecretsInBuild` (function)

Every secret in a built folder. Files are read as latin1, one character per byte, so offsets are byte offsets;
each `.env` value is encoded the same way so it matches its UTF-8 bytes.

```ts
function findSecretsInBuild(distDir: string, envValues: readonly EnvValue[]): SecretFound[];
```

#### `findUndeclaredBoards` (function)

Every board a game's sources name that `declared` (its ship config's `leaderboards` keys) lacks.

```ts
function findUndeclaredBoards(gameDir: string, declared: readonly string[]): UndeclaredBoardFound[];
```

#### `gameOrientationsIn` (function)

The orientations the `defineGame` calls in one source file play in, in source order; `undefined` when the file
does not parse (its typecheck already fails, and a half-read tree could name an orientation that is not there).

```ts
function gameOrientationsIn(file: string, code: string): PlayedOrientation[] | undefined;
```

#### `inputsProblems` (function)

Each disagreement between `runtime.inputs` and the bindings, in action order; empty when they agree.

```ts
function inputsProblems(inputs: readonly string[], bindings: ShipInputBindings): string[];
```

#### `isBoardSource` (const)

Whether `file` is one of the game's sources the board check reads (`.ts`, `.tsx`, `.mts`, `.js`, `.mjs`).

```ts
const isBoardSource: (file: string) => boolean;
```

#### `isInputsSource` (const)

Whether `file` is one of the game's sources the check reads: not a test, whose fixture games are not shipped.

```ts
const isInputsSource: (file: string) => boolean;
```

#### `isOrientationSource` (const)

Whether `file` is one of the game's sources the check reads: not a test, whose fixture games are not shipped.

```ts
const isOrientationSource: (file: string) => boolean;
```

#### `ITCH_FIRST_PUSH_CHECKLIST` (const)

The one-time page settings butler cannot make (PUB spec §6), printed after a channel's first push. The
"Publish to itch.io" guide (PUB.5) carries the same list.

```ts
const ITCH_FIRST_PUSH_CHECKLIST: string;
```

#### `ITCH_LIMITS` (const)

itch.io's documented limits for an HTML5 upload; "MB" is read as 10^6 bytes.

```ts
const ITCH_LIMITS: {
  readonly maxFiles: number;
  readonly maxPathLength: number;
  readonly maxFileBytes: number;
  readonly maxTotalBytes: number;
};
```

#### `ITCH_LIMITS_SOURCE` (const)

Where itch.io's limits were read, and when.

```ts
const ITCH_LIMITS_SOURCE: {
  readonly url: string;
  readonly read: string;
};
```

#### `ItchBuildInvalid` (class)

The build breaks one of itch.io's rules; each problem names the file and the limit.

```ts
class ItchBuildInvalid extends ItchBuildInvalidBase {
  override get message(): string;
}
```

#### `ItchCheck` (type)

The `prepare --target itch` check that failed, in the order they run (PUB spec §4).

```ts
type ItchCheck = "entry" | "file-count" | "path-length" | "file-size" | "case" | "ruken-toml";
```

#### `ItchConfig` (interface)

What a game writes in `ship.config.ts`.

```ts
interface ItchConfig {
  /** The itch.io project as butler names it: `user/game`, lower case. */
  readonly project: string;
  /** The butler channel. Defaults to `html5`. */
  readonly channel?: string | undefined;
}
```

#### `itchConfigSchema` (const)

Checks a game's `itch` section: `project` is `user/game` in lower case, and `channel` defaults to `html5`.

```ts
const itchConfigSchema: z.ZodType<ItchSettings, ItchConfig>;
```

#### `ItchSettingMissing` (class)

`publish --target itch` lacks the config section, the key or butler; found before anything runs.

```ts
class ItchSettingMissing extends ItchSettingMissingBase {}
```

#### `ItchSettings` (interface)

The checked settings, with the channel filled in.

```ts
interface ItchSettings {
  readonly project: string;
  readonly channel: string;
}
```

#### `keysBindingsIn` (function)

What the `keys()` calls in one source file bind, one `<file>:<line>:<col> keys` entry per call (and `pad` and
`gestures` entries where it binds them); empty when the file has no call; `undefined` when it does not parse (its
typecheck already fails, and a half-read tree could name a device that is not there).

```ts
function keysBindingsIn(file: string, code: string): ShipInputBindings | undefined;
```

#### `ManifestInputsMismatch` (class)

`runtime.inputs` disagrees with the game's input bindings (M4 spec §4.13, I-g).

```ts
class ManifestInputsMismatch extends ManifestInputsMismatchBase {
  override get message(): string;
}
```

#### `ManifestInvalid` (class)

Ruken's parser refused the generated `ruken.toml`. `problems` are Ruken's own issues, unchanged.

```ts
class ManifestInvalid extends ManifestInvalidBase {
  override get message(): string;
}
```

#### `OrientationMismatch` (class)

The game plays in an orientation its ship config's `runtime.orientation` does not send Ruken (M4.7 follow-up).

```ts
class OrientationMismatch extends OrientationMismatchBase {
  override get message(): string;
}
```

#### `OrientationMismatchFound` (interface)

A game that plays in an orientation its ship config does not declare.

```ts
interface OrientationMismatchFound extends PlayedOrientation {
  /** The ship config's `runtime.orientation`. */
  readonly declared: string;
  /** Relative to the game folder, with forward slashes. */
  readonly file: string;
}
```

#### `parseEnvFile` (function)

The variables of one `.env` file: `KEY=value` lines, with `export`, quotes and `#` comments allowed.

```ts
function parseEnvFile(file: string, text: string): EnvValue[];
```

#### `PlayedOrientation` (interface)

An orientation a `defineGame` call plays in, at the literal's opening quote (or at the call, when it is left out).

```ts
interface PlayedOrientation {
  readonly orientation: string;
  readonly line: number;
  readonly col: number;
}
```

#### `portsFor` (function)

The ports a checkout's test server and preview build listen on (FloorFifty `playwright.config.ts`).
Several agents run at once, each in its own worktree; with fixed ports a second run either failed on a busy
port or, reusing the first run's server, silently tested another worktree's code. So each checkout path
hashes to its own slot. AF uses 4600–4799, clear of FloorFifty's 4400–4599 on the same machine; a second
example in the same run adds a fixed offset (the ui demo +100 on the preview port, Emberwick (`games/emberwick`) +300).
CI runs one job per machine and uses the fixed pair; AF_E2E_SERVER_PORT / AF_E2E_PREVIEW_PORT override.

```ts
function portsFor(checkoutPath: string, env: Readonly<Record<string, string | undefined>>): {
  server: number;
  preview: number;
};
```

#### `prepareBuild` (function)

Makes a built folder ready for `ruken publish` and the dev host (ship spec §3.3): checks the tag, the
entry page, root-absolute paths, secrets (QB-b), the leaderboards the game names (M5.7) and the orientation it plays in (M4.7) and the devices its `keys()` calls bind (M4.1), then writes `ruken.toml` once Ruken's parser accepts it. Every check
runs before the write, so a failed prepare leaves the folder as it was. Zipping and Ruken's build checks
(archive, size, file types) happen inside `ruken publish`, not here.

```ts
function prepareBuild(input: PrepareInput): Effect.Effect<{
  manifestPath: string;
}, PrepareError, Files>;
```

#### `PrepareInput` (interface)

What `prepareBuild` checks and writes into: the built folder, the ship config, and the optional release
tag, game folder and input bindings.

```ts
interface PrepareInput {
  /** The built game folder (Vite's `dist/`). */
  readonly distDir: string;
  readonly config: ShipConfig;
  /** The release tag being built, when there is one (`v1.2.3`). */
  readonly tag?: string | undefined;
  /**
   * The game folder, whose `.env*` values must not appear in the build (QB-b). The CLI passes its working folder;
   * when it is left out, no `.env` file is read and only key formats and high-entropy strings are checked.
   */
  readonly gameDir?: string | undefined;
  /**
   * The game's input bindings (its input map's `profile.bindings`), checked against `runtime.inputs` (I-g).
   * Left out, the `keys()` calls in `gameDir`'s sources are read instead (M4.1 follow-up); with neither, nothing
   * is checked.
   */
  readonly inputBindings?: ShipInputBindings | undefined;
}
```

#### `prepareItch` (function)

Makes a built folder ready for itch.io (PUB spec §4): the tag, root-absolute paths, secrets (QB.2: a page on
itch.io is public, so the build is scanned as Ruken's is), `index.html`, itch.io's
limits, reference case and a stray `ruken.toml` are checked in that order, and the first that fails stops
prepare before anything is written. Then `<id>-<version>-itch.zip` is written beside the build folder (not in
it, so `butler push <dist>` never uploads it), for a manual upload; butler pushes the folder itself.

The build itself must already be an itch build (`resolve.conditions: ['automata-web']`, PUB.1); that is the
game's build step, not ship's.

```ts
function prepareItch(input: PrepareItchInput): Effect.Effect<{
  zipPath: string;
}, PrepareItchError>;
```

#### `PrepareItchInput` (interface)

What `prepareItch` checks and zips: the built folder, the ship config and the release tag.

```ts
interface PrepareItchInput {
  /** The built game folder. It is checked and zipped as it is; nothing is written into it. */
  readonly distDir: string;
  readonly config: ShipConfig;
  /** The release tag being built, when there is one (`v1.2.3`). */
  readonly tag?: string | undefined;
  /** The game's folder, whose `.env*` values must not appear in the build (QB.2). Without it only keys and entropy are scanned. */
  readonly gameDir?: string | undefined;
}
```

#### `ProcessError` (class)

A program could not be started (not found, not executable). A non-zero exit is not this error.

```ts
class ProcessError extends ProcessErrorBase {
  override get message(): string {
    return `could not run ${this.command}: ${describe(this.cause)}`
  }
}
```

#### `PublishAuth` (class)

Exit 3: the token was missing, wrong or lacks the rights.

```ts
class PublishAuth extends PublishAuthBase {
  override get message(): string;
}
```

#### `PublishFailed` (class)

Any other exit code.

```ts
class PublishFailed extends PublishFailedBase {
  override get message(): string;
}
```

#### `PublishInput` (interface)

What `publishToRuken` needs: the prepared build folder, the game's folder, Ruken's site and token, and
whether to activate the build.

```ts
interface PublishInput {
  /** The prepared build folder (it already has its `ruken.toml`). */
  readonly distDir: string;
  /** Where Ruken's CLI reads and writes `.ruken/project.json` (the game's own folder). */
  readonly cwd: string;
  /** The Ruken site, e.g. `http://localhost:5173` for Ruken's local stack. */
  readonly api: string;
  /** A Ruken developer token. Passed in the environment, never on the command line. */
  readonly token: string;
  /** Make the build the game's active build once Ruken's checks pass. */
  readonly activate: boolean;
  /** The game's public id; otherwise Ruken uses `.ruken/project.json` or registers the game. */
  readonly game?: string | undefined;
  /** Ruken's CLI entry; defaults to the vendored `@ruken/cli`. */
  readonly cliPath?: string | undefined;
}
```

#### `PublishItchInput` (interface)

What `publishToItch` needs: the built folder, the ship config, the tag, the key and where butler is.

```ts
interface PublishItchInput {
  /** The built game folder. */
  readonly distDir: string;
  readonly config: ShipConfig;
  /** The release tag being built, when there is one (`v1.2.3`). */
  readonly tag?: string | undefined;
  /** The game's folder, for the secret scan's `.env*` values (see `PrepareItchInput.gameDir`). */
  readonly gameDir?: string | undefined;
  /** `BUTLER_API_KEY`. Passed in butler's environment, never on its command line. */
  readonly apiKey: string | undefined;
  /** butler as found on PATH (`findExecutable('butler')`), or undefined when it is not installed. */
  readonly butlerPath: string | undefined;
}
```

#### `PublishRejected` (class)

Exit 1: Ruken's checks rejected the build.

```ts
class PublishRejected extends PublishRejectedBase {
  override get message(): string;
}
```

#### `PublishTimeout` (class)

Exit 4: Ruken's checks took longer than the CLI waits.

```ts
class PublishTimeout extends PublishTimeoutBase {
  override get message(): string;
}
```

#### `publishToItch` (function)

Prepares the build for itch.io (every check of `prepareItch`), then pushes the folder with butler. It fails
before any zip or process when the `itch` section, the key or butler is missing, relays butler's exit code, and
retries nothing. `firstPush` is true when butler says the channel had no build yet.

```ts
function publishToItch(input: PublishItchInput): Effect.Effect<{
  firstPush: boolean;
}, PublishItchError, ProcessRunner>;
```

#### `publishToRuken` (function)

Runs Ruken's own `ruken publish` on a prepared build and returns the URL Ruken says the build is served at
(`undefined` when it prints none). Ruken's exit codes become `PublishRejected` (1), `PublishUsage` (2),
`PublishAuth` (3), `PublishTimeout` (4) and `PublishFailed` for any other.

```ts
function publishToRuken(input: PublishInput): Effect.Effect<{
  url: string | undefined;
}, PublishError, ProcessRunner>;
```

#### `PublishUsage` (class)

Exit 2: the command line was wrong.

```ts
class PublishUsage extends PublishUsageBase {
  override get message(): string;
}
```

#### `readEnvValues` (function)

The variables of every top-level `.env*` file in the game folder; none when the folder does not exist.

```ts
function readEnvValues(gameDir: string): EnvValue[];
```

#### `RootAbsoluteReference` (class)

The build names its own files from the origin's root, which 404s under `/b/<buildId>/`.

```ts
class RootAbsoluteReference extends RootAbsoluteReferenceBase {
  override get message(): string;
}
```

#### `rukenCliPath` (function)

The `ruken` bin of the vendored `@ruken/cli` package. The published `@mcthaydt/automata-ship` carries a copy of
Ruken's built CLI in `dist/vendor/ruken-cli/` (D-8, M2.4 spec §3.4); every built module sits directly in
`dist/`, so the copy is `./vendor/ruken-cli/cli.js` next to it. Running from `src` in the workspace there is
no copy, and the workspace's `@ruken/cli` dev dependency is used instead (`dist/cli.js`, next to its
`dist/index.js`). `moduleUrl` and `exists` are parameters only so tests can stand in for a built package.

```ts
function rukenCliPath(moduleUrl?: string, exists?: (path: string) => boolean): string;
```

#### `rukenToml` (function)

The text of `ruken.toml` (Ruken manifest schema 1) for a ship config. The same config always gives the same
text.

```ts
function rukenToml(config: ShipConfig): string;
```

#### `scanTextForSecrets` (function)

Every secret in one file's text.

```ts
function scanTextForSecrets(file: string, text: string, envValues: readonly EnvValue[]): SecretFound[];
```

#### `SecretFound` (interface)

A secret the bundle scan found in a built file, located without repeating the secret.

```ts
interface SecretFound {
  /** Relative to the build, with forward slashes. */
  readonly file: string;
  /** Index into the scanned text; a byte offset when the text was read as latin1 (as `findSecretsInBuild` does). */
  readonly offset: number;
  /** 1-based. */
  readonly line: number;
  readonly col: number;
  /** A gitleaks rule ID, `env-value` or `high-entropy`. */
  readonly rule: string;
  /** What was found, without the secret. */
  readonly detail: string;
}
```

#### `SecretInBuild` (class)

The build holds a key, an `.env` value or a high-entropy string (QB-b). The message never holds the secret.

```ts
class SecretInBuild extends SecretInBuildBase {
  override get message(): string;
}
```

#### `SHIP_PACKAGE` (const)

The name this package is published under.

```ts
const SHIP_PACKAGE = "@mcthaydt/automata-ship";
```

#### `ShipConfig` (interface)

What a game tells ship about itself, in Ruken's own manifest shape (`@ruken/manifest`'s `Manifest`).
Keys keep Ruken's snake_case so the config reads like the `ruken.toml` it becomes. ship fills in
`schema` and `allow_eval` (always false); every other field and allowed value is Ruken's, so a field
Ruken does not define is a type error here.

```ts
interface ShipConfig {
  readonly game: Manifest["game"];
  readonly runtime: Omit<Manifest["runtime"], "allow_eval">;
  readonly network: Manifest["network"];
  readonly content: Manifest["content"];
  readonly analytics?: Manifest["analytics"];
  readonly loading?: NonNullable<Manifest["loading"]>;
  readonly leaderboards?: Manifest["leaderboards"];
  /**
   * Where `automata-ship publish --target itch` pushes (PUB spec §4). Not a Ruken field: it is never written to
   * `ruken.toml`, and a Ruken build ignores it.
   */
  readonly itch?: ItchConfig | undefined;
}
```

#### `ShipInputBindings` (interface)

What ship reads of a game's input profile. ship is published and the profile's owner (`runtime`) is private,
so this is the read-only subset ship consumes, not a copy of the contract: a profile's `bindings` is
assignable to it.

```ts
interface ShipInputBindings {
  readonly [action: string]: {
    readonly pad?: readonly number[] | undefined;
    readonly touch?: boolean | undefined;
    readonly gesture?: readonly string[] | undefined;
  };
}
```

#### `testRemote` (function)

Pushes the current branch, dispatches CI for it, waits and returns the run's URL and one `<result>\t<job>`
line per job when it is green. Otherwise fails with a `TestRemoteFailed` whose `reason` says why (see
`TestRemoteReason`).

```ts
function testRemote(input: TestRemoteInput): Effect.Effect<{
  runUrl: string;
  jobs: readonly string[];
}, TestRemoteFailed | ProcessError$1, ProcessRunner>;
```

#### `TestRemoteFailed` (class)

`test-remote` stopped without a green run; `reason` says why and `message` says what to do.

```ts
class TestRemoteFailed extends TestRemoteFailedBase {}
```

#### `TestRemoteInput` (interface)

What `testRemote` runs and how long it waits. The timing fields are for tests: the defaults suit a real
run. `args` are the words after `test-remote`: nothing for the hosted checks, Playwright arguments for one
focused run, or `--nightly`.

```ts
interface TestRemoteInput {
  /** The words after `test-remote`. Split on whitespace, so a quoted multi-word value does not survive. */
  readonly args: readonly string[];
  /** Only a run created at or after this time (ISO 8601, UTC) is ours. */
  readonly since: string;
  /** How often, and how many times, to look for the dispatched run (default 45 × 2 s). */
  readonly pollAttempts?: number;
  readonly pollIntervalMs?: number;
  /** How often to look at the run while it is queued or running (default 20 s). */
  readonly watchIntervalMs?: number;
  /** Looks at a run with no job started before it counts as having no runner (default 30, 10 minutes). */
  readonly queuePolls?: number;
  /** Looks at a run in all before giving up on it (default 180, 60 minutes). */
  readonly runPolls?: number;
  /** Failed looks in a row (gh error or not JSON) before giving up on gh (default 5). */
  readonly viewRetries?: number;
}
```

#### `TestRemoteReason` (type)

Why `test-remote` stopped without a green run.

```ts
type TestRemoteReason = "usage" | "detached" | "uncommitted" | "push" | "dispatch" | "no-run" | "no-runner" | "timeout" | "gh-unavailable" | "red";
```

#### `UndeclaredBoard` (class)

The game names a leaderboard its ship config's `leaderboards` does not declare (M5 spec §4.8, L-b).

```ts
class UndeclaredBoard extends UndeclaredBoardBase {
  override get message(): string;
}
```

#### `UndeclaredBoardFound` (interface)

A board the game's sources name that its ship config does not declare, at the call site.

```ts
interface UndeclaredBoardFound {
  readonly board: string;
  /** Relative to the game folder, with forward slashes. */
  readonly file: string;
  /** 1-based, at the board name's opening quote. */
  readonly line: number;
  readonly col: number;
}
```

#### `VersionMismatch` (class)

A release tag that is not `v<version>`.

```ts
class VersionMismatch extends VersionMismatchBase {}
```

## `@mcthaydt/automata-sim`

### `import { … } from '@mcthaydt/automata-sim'`

#### `canonicalJson` (function)

Canonical JSON: object keys sorted at every depth, no whitespace. Numbers use the ECMAScript
Number-to-string algorithm, which every engine implements identically, except that -0 is written as -0.
Throws CanonicalJsonError for anything JSON can't represent exactly: NaN, Infinity, undefined, bigint,
functions, symbols, and non-plain objects (a Date, Map, Set, typed array or class instance would otherwise
serialize as {} and hash the same as every other one; M2.1 spec §10.7).

```ts
function canonicalJson(value: unknown): string;
```

#### `CanonicalJsonError` (class)

A value canonical JSON cannot represent exactly; hashing it anyway would let different values collide.

```ts
class CanonicalJsonError extends Error {
  constructor(message: string);
}
```

#### `Command` (interface)

Input to the sim (spec §4.4 rule 4). `source` is a player slot (u8), `seq` a per-source counter (u32).

```ts
interface Command {
  readonly tick: number;
  readonly source: number;
  readonly seq: number;
  readonly type: string;
  readonly payload: unknown;
}
```

#### `CommandDef` (interface)

A command the sim accepts as input: an id and the Zod schema its payload must match. Create one with
`defineCommand`.

```ts
interface CommandDef<Z extends z.ZodType = z.ZodType> {
  readonly kind: "command";
  readonly id: string;
  readonly schema: Z;
}
```

#### `CommandRecord` (interface)

A command as a system reads it this tick: the player slot that sent it (`source`), its per-source `seq` and
its parsed `payload`.

```ts
interface CommandRecord<P> {
  readonly source: number;
  readonly seq: number;
  readonly payload: P;
}
```

#### `ComponentDef` (interface)

A component: a stable id and a flat record of typed fields. Create one with `defineComponent`; game code
addresses entity data through the definition, never through `trait`.

```ts
interface ComponentDef<S extends FieldSchema = FieldSchema> {
  readonly kind: "component";
  readonly id: string;
  readonly fields: S;
  /** Field names in sorted order: the order used by snapshots. */
  readonly fieldNames: readonly string[];
  /** Included in RenderDelta rows (default true). */
  readonly render: boolean;
  /** Internal Koota storage. Game code never touches it. */
  readonly trait: Trait;
}
```

#### `createRng` (function)

A generator seeded from `seed` (through splitmix32): the same seed gives the same sequence in every engine.

```ts
function createRng(seed: number): Rng;
```

#### `createSim` (function)

Creates a sim from its plugins, seed and content; async, because a plugin may create engine state (a Rapier
world). Throws for a bad `tickHz`, a duplicate definition, an unknown plugin dependency or system ordering
reference, an ordering cycle, a system name the sim reserves, or an invalid resource start. If a plugin's
engine fails to start, the engines already created are disposed first.

```ts
function createSim(opts: SimOptions): Promise<Sim>;
```

#### `Def` (type)

Anything `definePlugin`'s flat `defs` list takes (DX spec §3.2).

```ts
type Def = ComponentDef | CommandDef | EventDef | ResourceDef | SystemDef;
```

#### `defineCommand` (function)

Defines a command by id and payload schema. Throws for an id that is not lower-case words separated by dots
or dashes.

```ts
function defineCommand<Z extends z.ZodType>(id: string, schema: Z): CommandDef<Z>;
```

#### `defineComponent` (function)

Defines a component from an id (lower-case words separated by dots or dashes) and its fields by name and
type. `render: false` keeps it out of the renderer's deltas. Throws for a bad id, no fields, a bad field
name or an unknown field type.

```ts
function defineComponent<S extends FieldSchema>(id: string, fields: S, opts?: {
  render?: boolean;
}): ComponentDef<S>;
```

#### `defineEvent` (function)

Defines an event by id and payload schema, to emit from a system with `ctx.emit`. Events come back in
`StepResult.events`; `ctx.emit` throws for a payload that fails the schema.

```ts
function defineEvent<Z extends z.ZodType>(id: string, schema: Z): EventDef<Z>;
```

#### `definePlugin` (function)

Defines a plugin from a name, its dependencies and its definitions, given in the keyed lists or in one flat
`defs` list sorted by kind. A plugin written either way registers the same lists and gets the same schema
hash. `config` is copied as canonical, frozen JSON, so anything that cannot hash exactly throws a
`CanonicalJsonError` here.

```ts
function definePlugin(spec: {
  name: string;
  dependsOn?: readonly string[];
  /** One flat list, sorted into the keyed lists by `kind`; each entry follows that list's keyed entries. */
  defs?: readonly Def[];
  components?: readonly ComponentDef[];
  commands?: readonly CommandDef[];
  events?: readonly EventDef[];
  resources?: readonly ResourceDef[];
  systems?: readonly SystemDef[];
  state?: (setup: PluginStateSetup) => Promise<PluginState>;
  config?: unknown;
}): PluginDef;
```

#### `defineResource` (function)

Defines a resource by id, schema and starting value. `createSim` parses `init()` with the schema, so a bad
start fails there.

```ts
function defineResource<Z extends z.ZodType>(id: string, schema: Z, init: () => z.input<Z>): ResourceDef<Z>;
```

#### `defineSystem` (function)

A system: `defineSystem(name, run)` runs in `gameplay`, `defineSystem(name, phase, run)` in that phase, and the
object form also takes `before`/`after`. All three build the same SystemDef (DX spec §3.2).

```ts
function defineSystem(name: string, run: (ctx: SimContext) => void): SystemDef;
function defineSystem(name: string, phase: Phase, run: (ctx: SimContext) => void): SystemDef;
function defineSystem(spec: SystemSpec): SystemDef;
```

#### `deriveSeed` (function)

Seed for a named substream: FNV-1a over the name's UTF-16 code units, mixed with the root seed.

```ts
function deriveSeed(rootSeed: number, name: string): number;
```

#### `EntityRef` (interface)

A live entity, addressed by its StableId. Writes are coerced per field type and mark the entity changed.

```ts
interface EntityRef {
  readonly sid: number;
  has(component: ComponentDef): boolean;
  get<S extends FieldSchema>(component: ComponentDef<S>): Readonly<FieldValues<S>>;
  set<S extends FieldSchema>(component: ComponentDef<S>, values: Partial<FieldValues<S>>): void;
  add<S extends FieldSchema>(component: ComponentDef<S>, values?: Partial<FieldValues<S>>): void;
  remove(component: ComponentDef): void;
}
```

#### `EventDef` (interface)

An event a system emits: an id and the Zod schema its payload must match. Create one with `defineEvent`.

```ts
interface EventDef<Z extends z.ZodType = z.ZodType> {
  readonly kind: "event";
  readonly id: string;
  readonly schema: Z;
}
```

#### `FieldRecord` (type)

One component's field values on an entity, by field name.

```ts
type FieldRecord = Record<string, number | boolean | string>;
```

#### `FieldSchema` (type)

A component's fields, by name.

```ts
type FieldSchema = Readonly<Record<string, FieldType>>;
```

#### `FieldType` (type)

A component field's type: `f32`, `f64`, `i32`, `u32`, `bool`, `entity` (a StableId, stored as a `u32`) or
`string`.

```ts
type FieldType = (typeof FIELD_TYPES)[number];
```

#### `FieldValue` (type)

The JavaScript type a field holds: `boolean` for `bool`, `string` for `string`, `number` for every other
type.

```ts
type FieldValue<T extends FieldType> = T extends "bool" ? boolean : T extends "string" ? string : number;
```

#### `FieldValues` (type)

The writable record of values a `FieldSchema` describes.

```ts
type FieldValues<S extends FieldSchema> = { -readonly [K in keyof S]: FieldValue<S[K]>; };
```

#### `hex64` (function)

16 lowercase hex digits.

```ts
function hex64(value: bigint): string;
```

#### `Phase` (type)

One of the six phases a tick runs through, in `PHASES` order.

```ts
type Phase = (typeof PHASES)[number];
```

#### `PHASES` (const)

Fixed phase order (spec §4.3).

```ts
const PHASES: readonly ["input", "prePhysics", "physics", "postPhysics", "gameplay", "cleanup"];
```

#### `PluginDef` (interface)

A bundle of definitions the sim registers together: components, commands, events, resources and systems,
the plugins it depends on, and optionally per-sim engine state and `config`. Create one with
`definePlugin`.

```ts
interface PluginDef {
  readonly kind: "plugin";
  readonly name: string;
  /** Creates this plugin's per-sim engine state; its systems see it as `ctx.pluginState`. */
  readonly state: ((setup: PluginStateSetup) => Promise<PluginState>) | undefined;
  readonly dependsOn: readonly string[];
  readonly components: readonly ComponentDef[];
  readonly commands: readonly CommandDef[];
  readonly events: readonly EventDef[];
  readonly resources: readonly ResourceDef[];
  readonly systems: readonly SystemDef[];
  /**
   * Settings that change what the plugin simulates (physics gravity), as plain JSON. Part of the schema hash,
   * so a snapshot never restores into a sim configured differently. Undefined when the plugin has none.
   */
  readonly config: unknown;
}
```

#### `PluginState` (interface)

Engine state a plugin keeps outside the ECS, such as a Rapier world (M2.1 spec §3.1). `createSim` creates
one per sim, so a PluginDef shared by many sims never shares engine state between them.

```ts
interface PluginState {
  /** Bytes for snapshot section 6. Must be canonical: the same state gives the same bytes in every engine. */
  snapshot(): Uint8Array;
  /**
   * Validates and parses `bytes` without touching the live state. Throwing here (a SnapshotFormatError for bad
   * bytes) leaves the sim exactly as it was. Otherwise the sim later calls exactly one of the result's
   * methods: `commit` when every part of the snapshot was valid, `discard` when another part was not.
   */
  prepareRestore(bytes: Uint8Array): PreparedRestore;
  /** Frees the engine. The sim calls it once, on `dispose` or when `createSim` fails after creating it. */
  dispose(): void;
}
```

#### `PluginStateSetup` (interface)

What a plugin's state may know when it is created.

```ts
interface PluginStateSetup {
  /** The sim's fixed step, 1 / tickHz seconds. */
  readonly dt: number;
}
```

#### `PreparedRestore` (interface)

A plugin's parsed restore, held until the sim knows whether the whole snapshot is valid.

```ts
interface PreparedRestore {
  /** Adopts the parsed state and frees the state it replaces. Must not throw. */
  commit(): void;
  /** Frees whatever `prepareRestore` built (a restored engine world). Must not throw. */
  discard(): void;
}
```

#### `RejectedCommand` (interface)

A command `step` dropped, with the reason.

```ts
interface RejectedCommand {
  readonly command: Command;
  readonly reason: RejectReason;
}
```

#### `RejectReason` (type)

Why `step` dropped a command: `bad-header` (a field is missing or out of range), `unknown-command` (no
plugin defines its type), `wrong-tick` (not the sim's current tick), `duplicate-seq` (the same source and
seq twice in one step) or `invalid-payload` (it fails the command's schema).

```ts
type RejectReason = "bad-header" | "unknown-command" | "wrong-tick" | "duplicate-seq" | "invalid-payload";
```

#### `RenderDelta` (interface)

What changed for the renderer since the last delta (spec §4.7). `changed` rows carry the entity's full
render state, so a removed component shows up as its absence. `resync` deltas list every live render
entity as added; the renderer drops everything it had first.

```ts
interface RenderDelta {
  readonly resync: boolean;
  readonly added: readonly RenderRow[];
  readonly changed: readonly RenderRow[];
  readonly removed: readonly number[];
}
```

#### `RenderRow` (interface)

One entity's render-flagged components (component id -> field values).

```ts
interface RenderRow {
  readonly sid: number;
  readonly components: Readonly<Record<string, Readonly<FieldRecord>>>;
}
```

#### `ResourceDef` (interface)

A value the sim keeps once, not on any entity: an id, a Zod schema and the `init` that gives its starting
value. Create one with `defineResource`.

```ts
interface ResourceDef<Z extends z.ZodType = z.ZodType> {
  readonly kind: "resource";
  readonly id: string;
  readonly schema: Z;
  readonly init: () => z.input<Z>;
}
```

#### `Rng` (interface)

A deterministic generator (xoshiro128**, 32-bit integer math only, so it is bit-exact in every engine).
Each system gets its own, seeded from the sim's seed and the system's name.

```ts
interface Rng {
  /** Next raw 32-bit unsigned output. */
  nextU32(): number;
  /** Uniform in [0, 1), 32 bits of precision. */
  next(): number;
  /** Uniform integer in [0, n). `n` must be a positive integer <= 2^32. */
  int(n: number): number;
  /** Copy of the current state, for snapshots. */
  state(): RngState;
}
```

#### `RngState` (type)

The four 32-bit words of a generator's state, as `Rng.state()` copies them and snapshots store them.

```ts
type RngState = [number, number, number, number];
```

#### `Sim` (interface)

A running simulation, stepped with commands, that can snapshot, restore and hash its state. `step` is the
only way gameplay state changes. Create one with `createSim`, and `dispose` it when done.

```ts
interface Sim {
  readonly seed: number;
  readonly tickHz: number;
  readonly tick: number;
  /** XXH64 of the canonical content this sim was created with, 16 hex digits; the snapshot header's value. */
  readonly contentHash: string;
  step(commands: readonly Command[]): StepResult;
  /** Setup and inspection outside `step` (tests, scene setup). Runtime changes go through commands. */
  spawn(parts: readonly SpawnPart[]): number;
  entity(sid: number): EntityRef | undefined;
  query(...components: ComponentDef[]): EntityRef[];
  resource<Z extends z.ZodType>(def: ResourceDef<Z>): z.output<Z>;
  /** Canonical snapshot v1 bytes (spec §4.6). */
  snapshot(): Uint8Array;
  /** Replaces the whole state. Throws SnapshotFormatError / SnapshotMismatchError and leaves the sim unchanged. */
  restore(bytes: Uint8Array): void;
  /**
   * A readable view of `bytes`, or of the current state when none are given (M2.3 spec §3.1). Decodes and checks
   * the header as `restore` does (SnapshotFormatError / SnapshotMismatchError) but not restore's later
   * cross-checks, and changes nothing.
   */
  describeSnapshot(bytes?: Uint8Array): SnapshotView;
  /** xxhash64 of the snapshot, 16 hex digits. */
  hash(): string;
  /** Frees the Koota world and every plugin's engine. Idempotent; any later call throws SimDisposedError. */
  dispose(): void;
}
```

#### `SIM_VERSION` (const)

The sim package's version, written into replay headers for information only (M2.3 spec §3.2). A constant
rather than a build-time define, so workspace tests and un-built replays carry the real version; M2.4's
version step updates it with package.json, and version.test.ts keeps the two equal.

```ts
const SIM_VERSION: string;
```

#### `SimCapacityError` (class)

More sims are alive than Koota allows worlds (16 per process). Dispose sims you no longer need.

```ts
class SimCapacityError extends Error {
  constructor(cause: unknown);
}
```

#### `SimContext` (interface)

What a system's `run` receives each tick (spec §4.1).

```ts
interface SimContext {
  readonly tick: number;
  /** Fixed step, 1 / tickHz. */
  readonly dt: number;
  /** This system's own RNG substream. */
  readonly rng: Rng;
  /** Compiled content, deep-frozen. */
  readonly content: unknown;
  /** Live entities that have every listed component, in ascending StableId order. */
  query(...components: ComponentDef[]): EntityRef[];
  entity(sid: number): EntityRef | undefined;
  /** Spawns immediately; returns the new StableId. */
  spawn(...parts: SpawnPart[]): number;
  /** Despawn is deferred to the end of the tick (built-in `entities.flush`). */
  despawn(sid: number): void;
  readonly commands: {
    of<Z extends z.ZodType>(def: CommandDef<Z>): ReadonlyArray<CommandRecord<z.output<Z>>>;
  };
  emit<Z extends z.ZodType>(def: EventDef<Z>, payload: z.input<Z>): void;
  resource<Z extends z.ZodType>(def: ResourceDef<Z>): z.output<Z>;
  /** The per-sim state of the plugin that registered this system (`definePlugin({ state })`), else undefined. */
  readonly pluginState: unknown;
}
```

#### `SimDisposedError` (class)

The sim was disposed; it holds no world any more, so every call that reads or changes state refuses.

```ts
class SimDisposedError extends Error {
  constructor();
}
```

#### `SimEvent` (interface)

An event a system emitted during a step: the event's id as `type`, and its parsed `payload`.

```ts
interface SimEvent {
  readonly type: string;
  readonly payload: unknown;
}
```

#### `SimFaultedError` (class)

A system threw during `step`. The tick was left half-applied, so the sim refuses `step`, `snapshot` and
`hash` until a successful `restore` (M2.1 spec §10.2). Failing closed is cheaper than rolling back every tick.

```ts
class SimFaultedError extends Error {
  readonly system: string;
  readonly tick: number;
  constructor(system: string, tick: number, cause: unknown);
}
```

#### `SimOptions` (interface)

What `createSim` takes: the root `seed`, the `plugins`, `tickHz` (an integer from 1 to 1000, default 60)
and the `content` the systems read as `ctx.content` (default `{}`).

```ts
interface SimOptions {
  readonly seed: number;
  readonly tickHz?: number;
  readonly content?: unknown;
  readonly plugins: readonly PluginDef[];
}
```

#### `SNAPSHOT_VERSION` (const)

The snapshot format version this build reads and writes; a snapshot of another version fails with
`SnapshotFormatError`.

```ts
const SNAPSHOT_VERSION = 1;
```

#### `SnapshotFormatError` (class)

Snapshot bytes that are not a valid snapshot of this format version: bad magic, an unsupported version,
truncated or malformed sections.

```ts
class SnapshotFormatError extends Error {
  constructor(message: string, options?: ErrorOptions);
}
```

#### `SnapshotMismatchError` (class)

A valid snapshot that belongs to another sim: `field` names the header value that differs (`schemaHash`,
`contentHash` or `tickHz`), with this sim's `expected` value and the snapshot's `actual` one.

```ts
class SnapshotMismatchError extends Error {
  readonly field: "schemaHash" | "contentHash" | "tickHz";
  readonly expected: string;
  readonly actual: string;
  constructor(field: "schemaHash" | "contentHash" | "tickHz", expected: string, actual: string);
}
```

#### `SnapshotView` (interface)

A readable copy of a snapshot, for diffs and reports (M2.3 spec §3.1). Plugin bytes are opaque engine state,
so they are described by length and hash only.

```ts
interface SnapshotView {
  readonly header: {
    readonly formatVersion: number;
    readonly schemaHash: string;
    readonly contentHash: string;
    readonly tick: number;
    readonly tickHz: number;
  };
  /** Per system, its RNG state words. */
  readonly rng: Readonly<Record<string, readonly number[]>>;
  /** Per resource id, its value parsed from canonical JSON. */
  readonly resources: Readonly<Record<string, unknown>>;
  readonly nextId: number;
  /** Ascending sid; per component id, its field values. Components the entity lacks are absent. */
  readonly entities: ReadonlyArray<{
    readonly sid: number;
    readonly components: Readonly<Record<string, FieldRecord>>;
  }>;
  /** Section 6, per stateful plugin: byte length and XXH64 of its bytes. */
  readonly plugins: Readonly<Record<string, {
    readonly byteLength: number;
    readonly hash: string;
  }>>;
}
```

#### `sortedEntries` (function)

Own enumerable [key, value] pairs, sorted by key.

```ts
function sortedEntries<V>(obj: Readonly<Record<string, V>>): Array<[string, V]>;
```

#### `sortedKeys` (function)

Own enumerable string keys, sorted by UTF-16 code unit.

```ts
function sortedKeys(obj: object): string[];
```

#### `SpawnPart` (type)

A component to spawn with: the definition alone (defaults) or [definition, initial values].

```ts
type SpawnPart = ComponentDef | readonly [ComponentDef, Readonly<Record<string, unknown>>];
```

#### `StepResult` (interface)

What one `step` produced: the new tick, the events emitted, the renderer's delta and the commands that were
rejected.

```ts
interface StepResult {
  /** The tick the sim is at after this step. */
  readonly tick: number;
  readonly events: readonly SimEvent[];
  readonly render: RenderDelta;
  /** Invalid commands, in input order. The sim has no I/O, so it reports instead of logging. */
  readonly rejected: readonly RejectedCommand[];
}
```

#### `SystemDef` (interface)

A system: a name, the phase it runs in, the systems it must run `before` or `after` within that phase, and
its `run`, called once per tick. Create one with `defineSystem`.

```ts
interface SystemDef {
  readonly kind: "system";
  readonly name: string;
  readonly phase: Phase;
  readonly before: readonly string[];
  readonly after: readonly string[];
  readonly run: (ctx: SimContext) => void;
}
```

#### `SystemSpec` (interface)

The object form of `defineSystem`: a name, a phase, the optional `before`/`after` ordering and the run.

```ts
interface SystemSpec {
  name: string;
  phase: Phase;
  before?: readonly string[];
  after?: readonly string[];
  run: (ctx: SimContext) => void;
}
```

#### `xxhash64` (function)

XXH64 of `data` with an unsigned 64-bit `seed`.

```ts
function xxhash64(data: Uint8Array, seed?: bigint): bigint;
```

### `import { … } from '@mcthaydt/automata-sim/hash'`

#### `canonicalJson` (function)

Canonical JSON: object keys sorted at every depth, no whitespace. Numbers use the ECMAScript
Number-to-string algorithm, which every engine implements identically, except that -0 is written as -0.
Throws CanonicalJsonError for anything JSON can't represent exactly: NaN, Infinity, undefined, bigint,
functions, symbols, and non-plain objects (a Date, Map, Set, typed array or class instance would otherwise
serialize as {} and hash the same as every other one; M2.1 spec §10.7).

```ts
function canonicalJson(value: unknown): string;
```

#### `hex64` (function)

16 lowercase hex digits.

```ts
function hex64(value: bigint): string;
```

#### `utf8` (function)

UTF-8 encoding without TextEncoder (the sim's lib has no DOM/Web APIs). Lone surrogates become U+FFFD.

```ts
function utf8(s: string): Uint8Array;
```

#### `xxhash64` (function)

XXH64 of `data` with an unsigned 64-bit `seed`.

```ts
function xxhash64(data: Uint8Array, seed?: bigint): bigint;
```

### `import { … } from '@mcthaydt/automata-sim/math'`

#### `atan` (function)

Deterministic arctangent. NaN stays NaN; `-0` stays `-0`.

```ts
function atan(x0: number): number;
```

#### `atan2` (function)

Finite inputs only (sim values are finite). Signed zeros follow the built-in atan2.

```ts
function atan2(y: number, x: number): number;
```

#### `cos` (function)

Deterministic cosine, in radians. NaN for a non-finite input.

```ts
function cos(x: number): number;
```

#### `exp` (function)

Deterministic `e` to the power `x`. Infinity above about 709.78, 0 below about -745.13.

```ts
function exp(x: number): number;
```

#### `hypot` (function)

No overflow scaling: inputs must satisfy x*x + y*y < 1.7e308.

```ts
function hypot(x: number, y: number): number;
```

#### `log` (function)

Deterministic natural logarithm. NaN for a negative input, `-Infinity` for 0.

```ts
function log(x0: number): number;
```

#### `pow` (function)

Deterministic `x` to the power `y`. An integer `y` of 64 or less in magnitude multiplies exactly; otherwise
it is `exp(y * log(x))`, and a negative `x` with a non-integer `y` is NaN.

```ts
function pow(x: number, y: number): number;
```

#### `sin` (function)

Deterministic sine, in radians. NaN for a non-finite input; `-0` stays `-0`.

```ts
function sin(x: number): number;
```

#### `tan` (function)

Deterministic tangent, in radians, as `sin(x) / cos(x)`.

```ts
function tan(x: number): number;
```

### `import { … } from '@mcthaydt/automata-sim/replay'`

#### `createRecorder` (function)

Starts recording `sim` from its current state, for the recorder's `step` to extend. Throws
`ReplayRecordError` for a `checkEvery` or `snapshotEvery` that is not an integer of at least 1.

```ts
function createRecorder(sim: Sim, options?: RecorderOptions): Recorder;
```

#### `createReplayStepper` (function)

Creates a stepper over `replay`: a fresh sim built from the replay's seed and tick rate, restored from its
start snapshot. Throws `SnapshotMismatchError` when the start snapshot belongs to another schema or
content, `SnapshotFormatError` when it is malformed, and `ReplayFormatError` when the header disagrees with
the start snapshot it describes; the sim it created is disposed first.

```ts
function createReplayStepper(replay: Replay, setup: ReplayStepSetup): Promise<ReplayStepper>;
```

#### `decodeReplay` (function)

Decodes `.replay` bytes (already inflated) into a `Replay`. Throws `ReplayFormatError`, with the byte
offset when known, for anything that is not a valid replay.

```ts
function decodeReplay(bytes: Uint8Array): Replay;
```

#### `DEFAULT_CHECK_EVERY` (const)

How often, in ticks, a recording stores a check hash when `RecorderOptions.checkEvery` is not given.

```ts
const DEFAULT_CHECK_EVERY = 60;
```

#### `encodeReplay` (function)

Encodes a replay as `.replay` bytes before deflate. The same run encodes to the same bytes in every engine.
Throws `ReplayFormatError` for a replay that cannot be encoded.

```ts
function encodeReplay(replay: Replay): Uint8Array;
```

#### `packReplay` (function)

Encodes a replay and deflates it into `.replay` file bytes.

```ts
function packReplay(replay: Replay, compression: ReplayCompression): Promise<Uint8Array>;
```

#### `Recorder` (interface)

Steps a sim and records the run as a `Replay`. Nothing else may step the sim while it records; the recorder
refuses to continue if something did.

```ts
interface Recorder {
  /** `sim.step` plus recording. */
  step(commands: readonly Command[]): StepResult;
  /** Adds the final tick and hash; the recorder is closed afterwards. */
  finish(): Replay;
}
```

#### `RecorderOptions` (interface)

What a recording takes: how often to store a check hash, whether to keep a reference hash and snapshots
(goldens), and free-form `meta`.

```ts
interface RecorderOptions {
  /** A check hash every this many ticks from the start (default 60, at least 1). */
  readonly checkEvery?: number;
  /** Goldens: also a hash after every step and a full snapshot every `snapshotEvery` ticks. */
  readonly reference?: {
    readonly snapshotEvery: number;
  };
  readonly meta?: Readonly<Record<string, string>>;
}
```

#### `Replay` (interface)

A recorded run: its header, the start snapshot, the accepted commands by tick, check hashes along the way
and the final tick and hash. Replaying it must reproduce every hash.

```ts
interface Replay {
  readonly header: ReplayHeader;
  /** sim.snapshot() when recording started: covers setup spawns and checkpoint starts. */
  readonly start: Uint8Array;
  /** Only ticks with accepted commands, ascending; commands within a tick in (source, seq) order. */
  readonly ticks: ReadonlyArray<{
    readonly tick: number;
    readonly commands: readonly ReplayCommand[];
  }>;
  /** sim.hash() after stepping to `tick`; ascending, in (startTick, finalTick]. */
  readonly checks: ReadonlyArray<{
    readonly tick: number;
    readonly hash: string;
  }>;
  readonly finalTick: number;
  readonly finalHash: string;
  /** Goldens only: a hash after every step, and full snapshots every `snapshotEvery` ticks. */
  readonly reference?: {
    /** Index i is the hash at startTick + 1 + i. */
    readonly hashes: readonly string[];
    readonly snapshots: ReadonlyArray<{
      readonly tick: number;
      readonly bytes: Uint8Array;
    }>;
  };
}
```

#### `REPLAY_FORMAT` (const)

The `.replay` format version this build reads and writes.

```ts
const REPLAY_FORMAT = 1;
```

#### `REPLAY_INFLATE_MAX_BYTES` (const)

Larger than FloorFifty's 1 MiB because goldens carry reference snapshots; player replays may pass less.

```ts
const REPLAY_INFLATE_MAX_BYTES: number;
```

#### `REPLAY_MAX_TICKS` (const)

The longest run a replay may hold: 2^24 ticks, over 77 hours at 60 Hz. Bounds the work a small forged file can
ask of playback (its final delta is one varint).

```ts
const REPLAY_MAX_TICKS: number;
```

#### `ReplayCheck` (interface)

A hash check at a tick: the hash the replay recorded (`expected`) and the hash the re-simulated sim has
(`actual`). A recorded command the sim now rejects reports as `expected: 'accepted'` with the rejection
reason as `actual`.

```ts
interface ReplayCheck {
  readonly expected: string;
  readonly actual: string;
}
```

#### `ReplayCommand` (interface)

A command as a replay stores it: the sim's `Command` without its tick, which the replay's `ticks` entry
carries.

```ts
interface ReplayCommand {
  readonly source: number;
  readonly seq: number;
  readonly type: string;
  readonly payload: unknown;
}
```

#### `ReplayCompression` (interface)

The deflate and inflate a `.replay` file needs. The sim imports no compression library, so callers pass an
adapter (testing/sim has one for Node and one for browsers).

```ts
interface ReplayCompression {
  deflate(bytes: Uint8Array): Promise<Uint8Array>;
  /** Rejects once the output would pass maxBytes, without inflating the rest. */
  inflate(bytes: Uint8Array, maxBytes: number): Promise<Uint8Array>;
}
```

#### `ReplayFormatError` (class)

Bytes that are not a valid `.replay` (M2.3 spec §5). `offset` is the byte where reading failed, when known.

```ts
class ReplayFormatError extends Error {
  readonly offset: number | undefined;
  constructor(message: string, offset?: number, options?: ErrorOptions);
}
```

#### `ReplayHeader` (interface)

The facts a replay needs before it plays: tick rate, seed, the schema and content hashes it was recorded
against, where it starts and how often it checks.

```ts
interface ReplayHeader {
  readonly tickHz: number;
  readonly seed: number;
  /** 16 hex digits, copied from the start snapshot's header. */
  readonly schemaHash: string;
  readonly contentHash: string;
  readonly startTick: number;
  readonly checkEvery: number;
  /** SIM_VERSION when recorded; informational, never compared. */
  readonly framework: string;
  /** Free-form (game, build id); always {} in a golden. */
  readonly meta: Readonly<Record<string, string>>;
}
```

#### `ReplayRecordError` (class)

A recording that cannot be exact: the sim stepped outside the recorder, a payload that is not JSON, and so on.

```ts
class ReplayRecordError extends Error {
  constructor(message: string, options?: ErrorOptions);
}
```

#### `ReplayStepper` (interface)

A replay playing back one tick at a time on its own sim. Create one with `createReplayStepper`, and
`dispose` it when done.

```ts
interface ReplayStepper {
  readonly sim: Sim;
  readonly tick: number;
  readonly done: boolean;
  /** One step. `check` is present at a check tick, the final tick, or when a recorded command was rejected. */
  step(): {
    readonly tick: number;
    readonly result: StepResult;
    readonly check?: ReplayCheck;
  };
  /** Steps to the end; stops at the first failed check. `checks` counts the checks that passed. */
  run(): {
    readonly ok: boolean;
    readonly checks: number;
    readonly failed?: {
      readonly tick: number;
    } & ReplayCheck;
  };
  dispose(): void;
}
```

#### `ReplayStepSetup` (interface)

What a stepper needs to rebuild the recorded sim: the same `plugins` and `content` the recording sim had.

```ts
interface ReplayStepSetup {
  readonly plugins: readonly PluginDef[];
  /** As SimOptions.content: the content the recording sim was given. */
  readonly content?: unknown;
}
```

#### `unpackReplay` (function)

Inflates `.replay` file bytes and decodes them. Throws `ReplayFormatError` for bytes that are not a
deflated replay or that inflate past `maxInflatedBytes` (default `REPLAY_INFLATE_MAX_BYTES`).

```ts
function unpackReplay(bytes: Uint8Array, compression: ReplayCompression, options?: {
  readonly maxInflatedBytes?: number;
}): Promise<Replay>;
```

## `@mcthaydt/automata-testing`

### `import { … } from '@mcthaydt/automata-testing'`

#### `documentScrolls` (function)

The document itself never scrolls; screens scroll inside declared regions.

```ts
function documentScrolls(doc: Document): string[];
```

#### `FakeResizeObserver` (interface)

Controls the fake `ResizeObserver` `installFakeResizeObserver` put in place: report a width to every
observer, then restore the original.

```ts
interface FakeResizeObserver {
  /** Reports `width` to every live observer, for every element it observes. */
  resize(width: number): void;
  restore(): void;
}
```

#### `fakeViewportWindow` (function)

A fake window of the given size. Its `screen` defaults to that size and its `navigator` names no browser.
Resizing and the keyboard fire `resize` on the window and the visual viewport, as a browser does.

```ts
function fakeViewportWindow(size: {
  width: number;
  height: number;
  /** Defaults to the window's starting size. */
  screen?: {
    width: number;
    height: number;
  };
  /** Defaults to a navigator that names no browser. */
  navigator?: object;
}): FakeViewportWindow;
```

#### `FakeViewportWindow` (interface)

A stand-in for the browser window the geometry owner reads: its size, `screen`, `navigator`, visual
viewport and `resize` listeners, with methods to rotate, open the keyboard and count live listeners.

```ts
interface FakeViewportWindow {
  readonly innerWidth: number;
  readonly innerHeight: number;
  readonly visualViewport: FakeVisualViewport;
  /** `screen`, which does not move when the page does. */
  readonly screen: {
    readonly width: number;
    readonly height: number;
  };
  /** `navigator`, for corrections that only one browser needs (DuckDuckGo's client-hint brands). */
  readonly navigator: object;
  addEventListener(type: string, listener: Listener): void;
  removeEventListener(type: string, listener: Listener): void;
  /** Rotation, a browser bar, a window drag: both viewports take the new size. */
  resize(width: number, height: number): void;
  /** The on-screen keyboard covers `height` px of the visual viewport; the layout keeps its size. */
  openKeyboard(height: number): void;
  closeKeyboard(): void;
  /** Live listeners on the window and its visual viewport together, to prove disposal. */
  listenerCount(): number;
}
```

#### `FakeVisualViewport` (interface)

The visual viewport of `FakeViewportWindow`: its height (less the keyboard, if open), an offset, and
listeners for `resize`.

```ts
interface FakeVisualViewport {
  readonly height: number;
  readonly offsetTop: number;
  addEventListener(type: string, listener: Listener): void;
  removeEventListener(type: string, listener: Listener): void;
}
```

#### `findClipped` (function)

Each element `selector` names is tall enough for what it holds (a crushed row clips its content).

```ts
function findClipped(root: ParentNode, selector: string): string[];
```

#### `findIntrusions` (function)

No visible control intersects a reserved area (Ruken's strip, a keyboard), in viewport px, by its
whole box. The one exception is a control that a declared scroll region clips (see `clippedBy`)
where that region is itself clear of every area: scrolling brings it into view. An undeclared
scroller earns nothing, and a fixed control is measured where it is drawn, whatever it sits inside.

```ts
function findIntrusions(root: ParentNode, rects: readonly LayoutRect[]): string[];
```

#### `findOffscreenControls` (function)

Every visible control is on screen, unless a declared scroll region (`[data-scroll-region]`)
clips it (see `clippedBy`): a fixed control, or one positioned outside the region, is judged
where it is drawn, since scrolling the region would never bring it into view.

```ts
function findOffscreenControls(root: ParentNode): string[];
```

#### `findOverlaps` (function)

Two elements' boxes do not overlap.

```ts
function findOverlaps(a: Element, b: Element): string[];
```

#### `findSmallTargets` (function)

Every visible control is at least `min` square, and a primary (`data-kind="primary"`) at least
`minPrimary` tall. A checkbox or radio is pressed through its label too, so the label is its target.

```ts
function findSmallTargets(root: ParentNode, min: number, minPrimary: number): string[];
```

#### `findUnreachable` (function)

Each element is fully inside the viewport, and the whole of it is in view: a tap at its centre
and at the middle of each edge lands on it or inside it, so nothing covers or clips any part.

```ts
function findUnreachable(elements: readonly Element[]): string[];
```

#### `hostDisplay` (function)

Ruken's display metrics for a hosted game. Defaults are Ruken's own fixture
(`packages/protocol/src/fixtures/display.ts` at b30d31b): a 48 x 56 tab on the right, landscape.

```ts
function hostDisplay(options?: {
  edge?: "left" | "right";
  width?: number;
  scale?: DisplayMetricsPayload["scale"];
  safeArea?: DisplayMetricsPayload["safeArea"];
}): DisplayMetricsPayload;
```

#### `installFakeResizeObserver` (function)

Replaces the global `ResizeObserver` with a fake that reports only the widths you give it, for components
measured under jsdom, which has no layout. Call `restore` when the test ends.

```ts
function installFakeResizeObserver(): FakeResizeObserver;
```

#### `LayoutRect` (interface)

Layout assertions as plain DOM functions (M1.6 spec §3.10), from FloorFifty's
`tests/e2e/support/layout.ts` at 122a220 (`expectReachable`, `expectControlsFit`,
`expectRowsWhole`, `expectApart`, `expectNoDocumentScroll`).

Each returns a list of human-readable problems; `[]` is a pass. They take no test framework, so
the same code runs in Vitest browser mode and inside a Playwright `page.evaluate` bundle. They
measure what a player meets: no scrolling, at the centre of what they would tap. They need a real
layout engine; in jsdom every box is 0x0.

```ts
interface LayoutRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
```

#### `MountedFixture` (interface)

A mounted Svelte fixture: the element it was mounted into and a way to unmount it.

```ts
interface MountedFixture {
  readonly target: HTMLElement;
  /** Unmounts the component; removes the target too when `mountFixture` created it. */
  unmount(): Promise<void>;
}
```

#### `mountFixture` (function)

Mounts a Svelte component with the given props and no renderer or host, and flushes effects so the first
render is finished. Mounts into `target`, or into a new `div` in `document.body`, which `unmount` removes.

```ts
function mountFixture<Props extends Record<string, unknown>>(component: Component<Props>, props: Props, target?: HTMLElement): MountedFixture;
```

#### `REFERENCE_SIZES` (const)

The viewports a layout is checked at: phones in both orientations, tablets, desktops, both sides of every
breakpoint and the tightest sizes, each with the classification it should get.

```ts
const REFERENCE_SIZES: readonly ReferenceSize[];
```

#### `ReferenceFormFactor` (type)

`@mcthaydt/automata-ui`'s `FormFactor`.

```ts
type ReferenceFormFactor = "phone-portrait" | "phone-landscape" | "tablet-portrait" | "desktop";
```

#### `ReferenceHeightTier` (type)

`@mcthaydt/automata-ui`'s `HeightTier`.

```ts
type ReferenceHeightTier = "short" | "compact" | undefined;
```

#### `ReferenceSize` (interface)

One viewport every primitive and screen is checked at: a name, its size, and the form factor and height
tier it must classify as.

```ts
interface ReferenceSize {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly formFactor: ReferenceFormFactor;
  readonly heightTier: ReferenceHeightTier;
  readonly group: "phone" | "tablet" | "desktop" | "boundary" | "tight";
}
```

#### `textSnippet` (function)

A Svelte 5 snippet rendering `<tag>text</tag>`, so a test can pass `children`, `body` or an icon
to a component without writing a wrapper component (Ruken `packages/ui/src/test-snippets.ts`).
Text is escaped unless `trusted` is set, for fixture markup such as list rows.

```ts
function textSnippet(text: string, tag?: string, trusted?: boolean): Snippet;
```

#### `TIGHT_SIZES` (const)

Sideways phones shorter than 780x270, where an open keyboard leaves the least room (framework
audit of #7, 2026-10-11). Not resting viewports a screen is laid out for: the overlays that must
keep their actions above a keyboard (ErrorPanel, the boot failure) are checked here too.

```ts
const TIGHT_SIZES: readonly ReferenceSize[];
```

#### `Variant` (interface)

A condition layered over a reference size. Each field that is set applies; the caller turns them
into the geometry owner's inputs (a covered visual viewport, Ruken's display metrics).

```ts
interface Variant {
  readonly name: "rest" | "keyboard" | "host-reserved-right" | "host-reserved-left" | "tv-scale";
  /** Px of the height the on-screen keyboard covers at this size. */
  readonly keyboard?: (size: ReferenceSize) => number;
  /** Ruken's reserved strip (its fixture is 48 px wide). */
  readonly hostReserved?: {
    readonly edge: "left" | "right";
    readonly width: number;
  };
  /** Ruken's TV-mode scale hint. */
  readonly scale?: 1 | 1.333;
}
```

#### `VARIANTS` (const)

The conditions each size is also checked under: at rest, with the on-screen keyboard open, with Ruken's
reserved strip on the right or the left, and at its TV scale.

```ts
const VARIANTS: readonly Variant[];
```

#### `visibleControls` (function)

Controls a player could see and reach: laid out, not hidden, not in an inert subtree.

```ts
function visibleControls(root: ParentNode): HTMLElement[];
```

### `import { … } from '@mcthaydt/automata-testing/e2e'`

#### `Direction` (type)

A direction on the D-pad or the stick.

```ts
type Direction = "up" | "down" | "left" | "right";
```

#### `Engine` (type)

The browser engine a matrix cell runs in.

```ts
type Engine = "chromium" | "webkit" | "firefox";
```

#### `FakePad` (class)

One standard controller in a real browser, driven through the Gamepad API the game itself reads.

```ts
class FakePad {
  private target;
  private constructor();
  /** Installs the fake before any game script runs, in every frame; call before `goto`. The pad starts unplugged. */
  static install(page: Page, options?: FakePadOptions): Promise<FakePad>;
  /** Drives the pad of `frame` from here on: the game's frame under the fake host. */
  in(frame: Page | Frame): this;
  connect(): Promise<void>;
  unplug(): Promise<void>;
  press(button: PadButton, frames?: number): Promise<void>;
  release(button: PadButton): Promise<void>;
  /** Press and release, held for one polled frame. */
  tap(button: PadButton): Promise<void>;
  stick(x: number, y: number, frames?: number): Promise<void>;
  /** Holds a direction on the D-pad or the stick. */
  hold(direction: Direction, mode: PadMode, frames?: number): Promise<void>;
  letGo(direction: Direction, mode: PadMode): Promise<void>;
  /** One step of a direction: held for one polled frame, then let go. */
  step(direction: Direction, mode: PadMode): Promise<void>;
  /** Waits `count` animation frames in the pad's frame, so the game's per-frame poll has run. */
  frames(count?: number): Promise<void>;
  private write;
}
```

#### `FakePadOptions` (interface)

How the fake pad reports itself: its mapping and its id (the id picks the prompts' glyphs).

```ts
interface FakePadOptions {
  /** `''` for a pad the browser does not map to the standard layout. Default `standard`. */
  readonly mapping?: "" | "standard";
  readonly id?: string;
}
```

#### `flick` (function)

A quick vertical swipe of `dy` pixels within `ms` milliseconds from `from` (M4 spec I-f: 40 px in 180 ms).

```ts
function flick(scope: Page | Frame, from: Point, dy: number, ms: number): Promise<void>;
```

#### `hold` (function)

A finger down on `target`'s centre until `until` resolves true (checked once a frame), then up.

```ts
function hold(target: Locator, until: () => Promise<boolean>): Promise<void>;
```

#### `INPUT_MATRIX` (const)

M4 spec §9.1's cells, in table order: 17 cells, 22 journeys (the desktop cells run under both hosts).

```ts
const INPUT_MATRIX: readonly MatrixCell[];
```

#### `InputDevice` (type)

The device a matrix cell plays with.

```ts
type InputDevice = "keyboard" | "gamepad" | "touch";
```

#### `MatrixCell` (interface)

One cell of the input × form-factor matrix: a form factor, a device and an engine, and the hosts it runs under.

```ts
interface MatrixCell {
  /** `<form factor>-<device>-<engine>`, for example `phone-portrait-touch-webkit`. */
  readonly id: string;
  readonly formFactor: MatrixFormFactor;
  readonly viewport: {
    readonly width: number;
    readonly height: number;
  };
  readonly device: InputDevice;
  readonly engine: Engine;
  readonly hosts: readonly MatrixHost[];
  /** M4-D11: the cells that run locally and in hosted CI; the rest belong to the GPU runner's nightly. */
  readonly local: boolean;
}
```

#### `MatrixFormFactor` (type)

A matrix cell's form factor, each with one viewport (M4 spec §9.1).

```ts
type MatrixFormFactor = "phone-portrait" | "phone-landscape" | "compact" | "tablet-portrait" | "desktop";
```

#### `MatrixHost` (type)

Where a journey runs: under the fake Ruken host, or standalone.

```ts
type MatrixHost = "fake-ruken" | "standalone";
```

#### `PAD_BUTTONS` (const)

The standard mapping's buttons by name: south (A on an Xbox pad) is 0, Start is 9, the D-pad 12 to 15.

```ts
const PAD_BUTTONS: {
  readonly south: 0;
  readonly east: 1;
  readonly west: 2;
  readonly north: 3;
  readonly lb: 4;
  readonly rb: 5;
  readonly lt: 6;
  readonly rt: 7;
  readonly select: 8;
  readonly start: 9;
  readonly ls: 10;
  readonly rs: 11;
  readonly dpadUp: 12;
  readonly dpadDown: 13;
  readonly dpadLeft: 14;
  readonly dpadRight: 15;
  readonly home: 16;
};
```

#### `PadButton` (type)

A standard-mapping button by name.

```ts
type PadButton = keyof typeof PAD_BUTTONS;
```

#### `PadMode` (type)

Whether a direction is held on the D-pad or the left stick.

```ts
type PadMode = "dpad" | "stick";
```

#### `Point` (interface)

A point in the target frame's own CSS pixels.

```ts
interface Point {
  readonly x: number;
  readonly y: number;
}
```

#### `swipe` (function)

A finger from `from` to `to` over `ms` milliseconds, one move a frame, on whatever is under it.

```ts
function swipe(scope: Page | Frame, from: Point, to: Point, ms: number): Promise<void>;
```

#### `tap` (function)

A finger down on `target`'s centre and straight up again.

```ts
function tap(target: Locator): Promise<void>;
```

### `import { … } from '@mcthaydt/automata-testing/input'`

#### `fakeGamepads` (function)

`target` hears `gamepadconnected` and `gamepaddisconnected`, as `window` does in a browser.

```ts
function fakeGamepads(options?: {
  readonly target?: EventTarget;
}): FakeGamepads;
```

#### `FakeGamepads` (interface)

Four gamepad slots a unit test plugs pads into and presses; `getGamepads` reads them as the browser's would.

```ts
interface FakeGamepads {
  readonly getGamepads: () => (Gamepad | null)[];
  /** Puts a pad at rest in `index` (0 by default): standard, unless `mapping` says otherwise. */
  connect(index?: number, options?: {
    readonly mapping?: "" | "standard";
    readonly id?: string;
  }): void;
  unplug(index?: number): void;
  press(button: number, value?: number, index?: number): void;
  release(button: number, index?: number): void;
  /** The left stick. */
  stick(x: number, y: number, index?: number): void;
}
```

### `import { … } from '@mcthaydt/automata-testing/sim'`

#### `Difference` (interface)

One difference between two snapshot views: its kind, where it is (`entity 4 bounce.ball.vx`), the entity's
sid when it is an entity, and both values as printed.

```ts
interface Difference {
  readonly kind: "header" | "rng" | "resource" | "entity" | "plugin";
  /** What differs, as printed: "entity 4 bounce.ball.vx", "resource bounce.stats.bounces". */
  readonly at: string;
  /** For entity differences, the entity's sid. */
  readonly sid?: number;
  readonly expected: string;
  readonly actual: string;
}
```

#### `diffSnapshotViews` (function)

Every difference between an expected and an actual snapshot view, field by field, in a fixed order (header,
rng, resources, next id, entities, plugin bytes) so a report reads the same in every engine. Empty when
they are equal.

```ts
function diffSnapshotViews(expected: SnapshotView, actual: SnapshotView): Difference[];
```

#### `expectGolden` (function)

Throws with the formatted report unless the golden matched or was just written.

```ts
function expectGolden(report: GoldenReport): void;
```

#### `formatGoldenReport` (function)

One report as text: a line for most outcomes, and for a divergence the tick and up to 20 differences.

```ts
function formatGoldenReport(report: GoldenReport): string;
```

#### `GOLDEN_MAX_PACKED_BYTES` (const)

A golden that passes this cannot be reviewed or loaded cheaply; lower snapshotEvery's cost instead.

```ts
const GOLDEN_MAX_PACKED_BYTES: number;
```

#### `goldenCommands` (function)

The Vitest browser commands that let golden tests read golden files in a browser: register them with
`browser: { commands: goldenCommands() }`. Only `.golden.json` and `.replay` files inside the project root
can be read, and nothing can be written.

```ts
function goldenCommands(options?: GoldenCommandsOptions): Record<string, BrowserCommand<[path: string], Promise<string | null>>>;
```

#### `GoldenReport` (type)

What a golden check found: `pass`, `written`, `missing`, `schema-changed`, `content-changed`,
`setup-changed` or `diverged` (with the first differing tick and the fields that differ).

```ts
type GoldenReport = {
  readonly name: string;
} & ({
  readonly kind: "pass";
  readonly checks: number;
} | {
  readonly kind: "written";
  readonly file: string;
  readonly bytes: number;
} | {
  readonly kind: "missing";
  readonly file: string;
} | {
  readonly kind: "schema-changed" | "content-changed";
  readonly expected: string;
  readonly actual: string;
} | {
  readonly kind: "setup-changed";
  readonly field: "seed" | "tickHz" | "ticks" | "every";
  readonly expected: number;
  readonly actual: number;
} | {
  readonly kind: "diverged";
  /** The first tick whose hash differs (the tick after the step), or the failed check when not exact. */
  readonly firstTick: number;
  readonly lastGoodTick: number;
  readonly exact: boolean;
  /** The tick the differences were taken at, when that is not firstTick. */
  readonly diffTick?: number;
  readonly differences: readonly Difference[];
});
```

#### `nodeCompression` (const)

Node only. zlib is imported when first used, so importing this module in a browser costs nothing.

```ts
const nodeCompression: ReplayCompression;
```

#### `replayGolden` (function)

Replays a golden `.replay` against the current sim and reports whether it still matches. With reference
data a divergence names the exact tick and every field that differs. With `AUTOMATA_UPDATE_GOLDENS=1` in
Node and a `record` option it records the file first, then checks what it wrote. A mismatch is a report, not
a throw: pass it to `expectGolden`.

```ts
function replayGolden(options: ReplayGoldenOptions): Promise<GoldenReport>;
```

#### `ReplayGoldenOptions` (interface)

What `replayGolden` checks: the `.replay` file, the plugins and content to replay it with, and how to
record it when updating goldens.

```ts
interface ReplayGoldenOptions {
  /** A deflated `.replay`; a relative path is taken from the test file's folder. */
  readonly file: string;
  readonly plugins: readonly PluginDef[];
  readonly content?: unknown;
  /**
   * How to record the golden when updating (Node, AUTOMATA_UPDATE_GOLDENS=1); absent for replays recorded
   * elsewhere. Either seed/tickHz/setup, or `create`, a game's own sim factory.
   */
  readonly record?: RecordFrom & {
    readonly drive: (recorder: Recorder, sim: Sim) => void | Promise<void>;
    /** A reference snapshot every this many ticks (default 1, so a divergence is diffed at its exact tick). */
    readonly snapshotEvery?: number;
  };
}
```

#### `RoundTripFailure` (interface)

One case whose restored run differed from the uninterrupted one: its number, sim seed, length, restore
tick, variant and a report of what differed.

```ts
interface RoundTripFailure {
  readonly case: number;
  readonly simSeed: number;
  readonly ticks: number;
  readonly at: number;
  readonly variant: RoundTripVariant;
  readonly report: string;
}
```

#### `RoundTripOptions` (interface)

What `snapshotRoundTripProperty` runs: the plugins, content and a command script, and how many cases of
what length to try.

```ts
interface RoundTripOptions {
  readonly plugins: readonly PluginDef[];
  readonly content?: unknown;
  readonly tickHz?: number;
  /** Builds each case's world; `rng` is derived from the case's sim seed. */
  readonly setup?: (sim: Sim, rng: Rng) => void;
  readonly script: (tick: number, rng: Rng) => readonly Command[];
  /** Default 200. */
  readonly cases?: number;
  /** Each case runs 1..maxTicks ticks (default 300). */
  readonly maxTicks?: number;
  /** Chooses which cases run (default 1). */
  readonly seed?: number;
}
```

#### `RoundTripVariant` (type)

How a case restores: into a `fresh` sim, or into one that has `dirty` (stepped on past the snapshot).

```ts
type RoundTripVariant = "fresh" | "dirty";
```

#### `simGolden` (function)

Plays a scripted run and compares the sim's hash every `every` ticks with the golden JSON file, reporting
the first recorded tick that differs. With `AUTOMATA_UPDATE_GOLDENS=1` in Node it records the file. Throws
for an `every` that is not an integer of 1 or more; a mismatch is a report, not a throw.

```ts
function simGolden(options: SimGoldenOptions): Promise<GoldenReport>;
```

#### `SimGoldenOptions` (interface)

What `simGolden` runs: the plugins, content, seed and scripted commands to play for `ticks` ticks, where
the golden JSON lives, and how often to record a hash.

```ts
interface SimGoldenOptions {
  readonly name: string;
  /** The golden is <dir>/__goldens__/<name>.golden.json; a relative dir is taken from the test file's folder. */
  readonly dir: string;
  readonly plugins: readonly PluginDef[];
  readonly content?: unknown;
  readonly seed: number;
  readonly tickHz?: number;
  readonly setup?: (sim: Sim) => void;
  /** Commands for each tick; `rng` is a stream of its own, derived from the seed. */
  readonly script: (tick: number, rng: Rng) => readonly Command[];
  readonly ticks: number;
  /** Record a hash every this many ticks (default 1). */
  readonly every?: number;
}
```

#### `snapshotRoundTripProperty` (function)

Checks that snapshot, restore and continue equals an uninterrupted run, over many seeds, run lengths and
restore points, alternating fresh and dirty restores. Returns `{ failures }`; an empty list means the
property held.

```ts
function snapshotRoundTripProperty(options: RoundTripOptions): Promise<{
  readonly failures: readonly RoundTripFailure[];
}>;
```

#### `streamCompression` (const)

Browsers and Node: CompressionStream / DecompressionStream('deflate-raw').

```ts
const streamCompression: ReplayCompression;
```

### `import { … } from '@mcthaydt/automata-testing/sim/commands'`

#### `goldenCommands` (function)

The Vitest browser commands that let golden tests read golden files in a browser: register them with
`browser: { commands: goldenCommands() }`. Only `.golden.json` and `.replay` files inside the project root
can be read, and nothing can be written.

```ts
function goldenCommands(options?: GoldenCommandsOptions): Record<string, BrowserCommand<[path: string], Promise<string | null>>>;
```

#### `GoldenCommandsOptions` (interface)

Options for {@link goldenCommands}.

```ts
interface GoldenCommandsOptions {
  /**
   * The folder golden files must be inside; defaults to the Vitest project's root. A package whose goldens sit
   * beside it rather than under it names an absolute folder holding both.
   */
  readonly root?: string;
}
```

### `import { … } from '@mcthaydt/automata-testing/sim/property'`

#### `RoundTripFailure` (interface)

One case whose restored run differed from the uninterrupted one: its number, sim seed, length, restore
tick, variant and a report of what differed.

```ts
interface RoundTripFailure {
  readonly case: number;
  readonly simSeed: number;
  readonly ticks: number;
  readonly at: number;
  readonly variant: RoundTripVariant;
  readonly report: string;
}
```

#### `RoundTripOptions` (interface)

What `snapshotRoundTripProperty` runs: the plugins, content and a command script, and how many cases of
what length to try.

```ts
interface RoundTripOptions {
  readonly plugins: readonly PluginDef[];
  readonly content?: unknown;
  readonly tickHz?: number;
  /** Builds each case's world; `rng` is derived from the case's sim seed. */
  readonly setup?: (sim: Sim, rng: Rng) => void;
  readonly script: (tick: number, rng: Rng) => readonly Command[];
  /** Default 200. */
  readonly cases?: number;
  /** Each case runs 1..maxTicks ticks (default 300). */
  readonly maxTicks?: number;
  /** Chooses which cases run (default 1). */
  readonly seed?: number;
}
```

#### `RoundTripVariant` (type)

How a case restores: into a `fresh` sim, or into one that has `dirty` (stepped on past the snapshot).

```ts
type RoundTripVariant = "fresh" | "dirty";
```

#### `snapshotRoundTripProperty` (function)

Checks that snapshot, restore and continue equals an uninterrupted run, over many seeds, run lengths and
restore points, alternating fresh and dirty restores. Returns `{ failures }`; an empty list means the
property held.

```ts
function snapshotRoundTripProperty(options: RoundTripOptions): Promise<{
  readonly failures: readonly RoundTripFailure[];
}>;
```

## `@mcthaydt/automata-ui`

### `import { … } from '@mcthaydt/automata-ui'`

#### `ActionBar` (const)

One row of actions that collapses as its container narrows (M1.6 spec §3.4; from FloorFifty
`ui/layout/ActionBar.svelte` at 122a220).

It gives way in a fixed order as its container narrows (`collapseLevel`): utilities to their icon,
then secondaries to their short label, and only then a wrap with the primary on its own row.
Three hidden, inert copies of the row ([data-measure]) report how wide it would be at each level,
so the choice is measured rather than guessed from breakpoints.

```ts
const ActionBar: import("svelte").Component<Props, {}, "">;
type ActionBar = ReturnType<typeof ActionBar>;
```

#### `ActionKind` (type)

The action bar's model (M1.6 spec §3.4; from FloorFifty `ui/layout/action-bar.ts` at 122a220).

One row of actions that gives way in a fixed order as its container narrows, so the primary
action is the last thing to lose its words:
  0. every label in full;
  1. utility actions drop to their icon;
  2. secondary actions take their short label;
  3. it wraps, with the primary alone on the first row.
Level 3 is a fallback: the layout contracts fail any reference size where a bar reaches it.

```ts
type ActionKind = 'primary' | 'secondary' | 'utility';
```

#### `applyGeometry` (function)

Writes the geometry where CSS reads it (spec §3.2). Only the geometry owner calls this.

```ts
function applyGeometry(root: HTMLElement, geometry: Geometry): void;
```

#### `arrowKeyNav` (function)

The menu direction an arrow key walks, as a d-pad would, or undefined when the key is not a bare
arrow or its target keeps that arrow. Up and Down always walk off an input, so no slider, radio
group or text field can hold focus; Left and Right stay with a slider or radio group, and with a
text field until its caret meets the end the arrow points at. Multi-line text keeps every arrow.

```ts
function arrowKeyNav(event: KeyboardEvent): NavDirection | undefined;
```

#### `AUDIO_BUSES` (const)

The buses the Audio group offers, in the order it shows them.

```ts
const AUDIO_BUSES: readonly AudioBus[];
```

#### `AudioBus` (type)

An audio bus (runtime's `AudioBusName`).

```ts
type AudioBus = 'master' | 'music' | 'sfx' | 'ui' | 'voice';
```

#### `AudioCopy` (interface)

Every word the Audio group shows, in the game's language.

```ts
interface AudioCopy {
    readonly title: string;
    readonly mute: string;
    /** FloorFifty's "Mute in background": silent while another window has focus. */
    readonly muteUnfocused: string;
    /** A toggle's state words. */
    readonly on: string;
    readonly off: string;
    readonly buses: Readonly<Record<AudioBus, string>>;
    /** A gain as the player reads it: "50%". */
    percent(value: number): string;
    /** When sound could not start (A-e). */
    readonly unavailable: string;
    /** While the host's own volume is below full. */
    readonly hostVolume: string;
}
```

#### `AudioSection` (const)

The Audio group of the Settings tab (M5 spec §7, M5.4), laid out as FloorFifty's (`SettingsPanel.svelte` at
a28dc44): Mute, Mute in the background, then a slider per bus with its percentage. Every change is reported at
once (`onchange`); the game applies and saves it, so there is no Apply. When sound could not start
(`available` false, A-e) the group says so and its controls stay shown but disabled. While the host's own volume is
below full, a note says it also applies, so a quiet game is not taken for a broken slider.

```ts
const AudioSection: import("svelte").Component<Props, {}, "">;
type AudioSection = ReturnType<typeof AudioSection>;
```

#### `AudioSectionChange` (type)

One change in the Audio group: a toggle's new state, or a bus's new gain.

```ts
type AudioSectionChange = {
    readonly kind: 'muted';
    readonly value: boolean;
} | {
    readonly kind: 'muteUnfocused';
    readonly value: boolean;
} | {
    readonly kind: 'gain';
    readonly bus: AudioBus;
    readonly value: number;
};
```

#### `AudioValue` (interface)

The player's audio choices (runtime's `AudioSettings`): the mutes, and a gain per bus from 0 to 1.

```ts
interface AudioValue {
    readonly muted: boolean;
    readonly muteUnfocused: boolean;
    readonly gains: Readonly<Record<AudioBus, number>>;
}
```

#### `BarAction` (interface)

One action in an `ActionBar`: an id, a label and a kind (`primary`, `secondary` or `utility`), what it does
when selected, and optionally a short label, an icon, a disabled state and a pressed state.

```ts
interface BarAction {
    readonly id: string;
    readonly label: string;
    /** What a secondary action says from level 2 ("Replay" for "Watch replay"). */
    readonly shortLabel?: string | undefined;
    /** A utility's icon; from level 1 the icon alone stands for it, and the label stays its name. */
    readonly icon?: Snippet | undefined;
    readonly kind: ActionKind;
    /** Receives the click, so an action can act on its own button. */
    readonly onSelect: (event: MouseEvent) => void;
    readonly disabled?: boolean | undefined;
    /** A toggle's state, rendered as `aria-pressed`. */
    readonly pressed?: boolean | undefined;
    /** Defaults to `id`. */
    readonly testId?: string | undefined;
}
```

#### `BarSample` (type)

One reading of the viewport, as `HiddenBrowserBar.measure` needs it.

```ts
type BarSample = {
    /** `screen.height`, in CSS pixels, for the current orientation. */
    screenHeight: number;
    innerHeight: number;
    portrait: boolean;
    /** A text field has focus. This browser shrinks the whole page for its keyboard. */
    editing: boolean;
    /** The page is fullscreen, where it legitimately reaches the screen edge. */
    fullscreen: boolean;
    /** The size has stopped moving since the last reading. */
    settled: boolean;
};
```

#### `BOOT_FAILURE_COPY_EN` (const)

English defaults in Ruken's tone (quiet, human, no blame); replaced by Paraglide keys in M5. `{host}` is filled
with the host's name (`Hosting.hostName`: 'Ruken', 'itch.io' …) by `withHostName`.

```ts
const BOOT_FAILURE_COPY_EN: BootFailureCopy;
```

#### `bootDeviceClass` (function)

The device class at boot, read from the window's pointer and screen; `desktop` when the window cannot
answer.

```ts
function bootDeviceClass(win?: Window): DeviceClass;
```

#### `BootFailure` (type)

The structural view of the runtime's boot error that the UI draws: one of six tagged cases, so ui never
imports the runtime.

```ts
type BootFailure = {
    readonly _tag: 'HostError';
    readonly code: ErrorCode;
    readonly retryable: boolean;
    readonly operation: string;
} | {
    readonly _tag: 'ContentHashMismatch';
    readonly expected: string;
    readonly actual: string;
} | {
    readonly _tag: 'AssetLoadFailed';
    readonly url: string;
    readonly status: number;
} | {
    readonly _tag: 'LoadStalled';
    readonly url: string;
    readonly bytesSoFar: number;
    readonly stalledMs: number;
} | {
    readonly _tag: 'RendererUnavailable';
    readonly tried: readonly ('webgl2' | 'webgpu')[];
} | {
    readonly _tag: 'BootDefect';
};
```

#### `BootFailureAction` (type)

Try again, Continue without loading, Back to {host}.

```ts
type BootFailureAction = 'retry' | 'continue' | 'exit';
```

#### `BootFailureCopy` (type)

The words for every boot failure state and action, by name. `BOOT_FAILURE_COPY_EN` holds the English
defaults.

```ts
type BootFailureCopy = Readonly<Record<BootFailureState | BootFailureAction, string>>;
```

#### `BootFailurePanel` (const)

The state a boot failure draws (M1 shared contracts §3; M1.6 spec §3.6): an ErrorPanel with the
failure's copy and its ways forward. The runtime passes its `BootError` and the handlers; this
component decides nothing beyond `bootFailureView`.

```ts
const BootFailurePanel: import("svelte").Component<Props, {}, "">;
type BootFailurePanel = ReturnType<typeof BootFailurePanel>;
```

#### `BootFailureState` (type)

What a boot failure draws: `start`, `connect`, `progress`, `damaged`, `download`, `download-stalled` or
`unsupported`.

```ts
type BootFailureState = 'start' | 'connect' | 'progress' | 'damaged' | 'download' | 'download-stalled' | 'unsupported';
```

#### `bootFailureView` (function)

Which state a failure draws and which ways forward it offers. `canExit` is whether the host granted `exit`;
without it "Back to …" is never offered (PUB spec §3.1).

- Host start (`init`): `Ruken.init` threw. Try again when Ruken says a retry can succeed;
  otherwise it is a build or config fault (a bad `gameId` or `wants`) the player cannot fix, so
  the panel is final. A failed in-frame handshake is not an error: the SDK falls back to standalone.
- Storage (`saves.*`): Try again when Ruken says a retry can succeed. Otherwise a standalone page
  may go on without the saved progress; inside Ruken the way forward is Back to Ruken, because
  playing on without the player's saves would silently fork their progress.
- Renderer: nothing on this device can fix it. Inside Ruken the player goes back; a standalone
  page has nowhere to go, so its panel is final.
- Everything else: Try again, which re-runs the boot program in a fresh scope (never a page reload
  inside a Ruken frame).

```ts
function bootFailureView(failure: BootFailure, hostKind: HostKind, canExit: boolean): BootFailureViewModel;
```

#### `BootFailureViewModel` (interface)

What `bootFailureView` decides for a failure: the state to draw and the ways forward, in order. No actions
means the panel is final.

```ts
interface BootFailureViewModel {
    readonly state: BootFailureState;
    readonly actions: BootFailureAction[];
}
```

#### `Button` (const)

The framework's button (M4 spec §4.12): an `.af-control` of one kind. A primary carries
`data-kind="primary"`, which both sizes it to the 48 px primary target and tells the layout check
to hold it to that size. The words are the caller's, in the game's language.

```ts
const Button: import("svelte").Component<Props, {}, "">;
type Button = ReturnType<typeof Button>;
```

#### `Chip` (const)

A short status label (M4 spec §4.12). Its tone is `data-tone` and an edge colour, and never only
that: every tone but `info` also shows a glyph a sighted player reads and says `toneLabel` to
assistive technology, so the tone survives with every colour removed. A warning or danger chip
without words throws while it mounts.

```ts
const Chip: import("svelte").Component<Props, {}, "">;
type Chip = ReturnType<typeof Chip>;
```

#### `classifyDevice` (function)

A fine primary pointer is a `desktop`; a coarse one is a `phone` when the screen's shorter side is under
600 px, otherwise a `tablet`.

```ts
function classifyDevice(input: {
    coarse: boolean;
    screenWidth: number;
    screenHeight: number;
}): DeviceClass;
```

#### `classifyFormFactor` (function)

The form factor of a layout viewport: a portrait one narrower than 600 px is `phone-portrait`, any other
portrait one `tablet-portrait`; a landscape one shorter than 500 px is `phone-landscape`, otherwise
`desktop`. A square viewport is landscape.

```ts
function classifyFormFactor(width: number, height: number): FormFactor;
```

#### `classifyHeightTier` (function)

The height tier of a layout height in CSS px: `compact` below 340, `short` up to 600, otherwise
`undefined`.

```ts
function classifyHeightTier(height: number): HeightTier;
```

#### `CollapseLevel` (type)

How far an action bar has collapsed: 0 every label in full, 1 utilities as icons, 2 secondaries on their
short labels, 3 wrapped with the primary on its own row.

```ts
type CollapseLevel = 0 | 1 | 2 | 3;
```

#### `collapseLevel` (function)

The first level whose one-row width fits. `widths` are the bar's unwrapped widths at levels 0, 1 and 2.

```ts
function collapseLevel(available: number, widths: readonly [number, number, number]): CollapseLevel;
```

#### `COMPACT_MAX_HEIGHT` (const)

Below this, compact: what a browser leaves a sideways phone (780 x 270 Chrome on a Galaxy,
667 x 320 Safari on an SE). 844 x 340, Safari on an iPhone 14, sits exactly on it and stays short.

```ts
const COMPACT_MAX_HEIGHT = 340;
```

#### `ControlsCopy` (interface)

Every word the Controls section shows, in the game's language.

```ts
interface ControlsCopy {
    readonly title: string;
    /** Each device section's heading. */
    readonly keyboard: string;
    readonly gamepad: string;
    readonly touch: string;
    /** The mark on the section of the device in the player's hand. */
    readonly inUse: string;
    readonly reset: string;
    /** On the button that waits for a press. */
    readonly press: string;
    /** A rebind button's name for assistive technology: "Change Jump on Keyboard". */
    rebind(action: string, device: string): string;
    capturing(action: string, device: string, secondsLeft: number): string;
    conflict(action: string, other: string): string;
    reserved(action: string): string;
    timedOut(action: string): string;
    saved(action: string): string;
}
```

#### `controlsMessage` (function)

The section's status line for `state`, with actions by their labels; empty in the list.

```ts
function controlsMessage(state: ControlsState, copy: ControlsCopy, labelOf: (action: string) => string): string;
```

#### `ControlsRow` (interface)

One game action in the Controls section: its id, its name and its bindings now.

```ts
interface ControlsRow {
    /** The action's id, as `onrebind` reports it. */
    readonly id: string;
    readonly label: string;
    readonly binding: PromptBinding;
}
```

#### `ControlsSection` (const)

The Controls tab's section (M4 spec §4.5, §7), laid out as FloorFifty's Controls tab (`SettingsPanel.svelte` at
a28dc44): one section per device the player can use, the one in their hand first and marked. Keyboard and
Controller list each action with one rebind button showing that device's prompt; the Controller appears once a pad
has connected (`devices`). Touch, when shown, says what the on-screen buttons do; they are the game's, so there is
nothing to rebind (§4.5). A status line says each step of a rebind (`state`), and Reset puts every binding back.
Every row is a 44 px target; long labels wrap, and the targets never shrink.

```ts
const ControlsSection: import("svelte").Component<Props, {}, "">;
type ControlsSection = ReturnType<typeof ControlsSection>;
```

#### `ControlsState` (type)

Where a rebind is: the list; waiting for a press (with the seconds left); refused because it would leave `with`
unbound; refused as reserved; timed out; or saved.

```ts
type ControlsState = {
    readonly kind: 'list';
} | {
    readonly kind: 'capturing';
    readonly action: string;
    readonly device: RebindDevice;
    readonly secondsLeft: number;
} | {
    readonly kind: 'conflict';
    readonly action: string;
    readonly with: string;
} | {
    readonly kind: 'reserved';
    readonly action: string;
} | {
    readonly kind: 'timed-out';
    readonly action: string;
} | {
    readonly kind: 'saved';
    readonly action: string;
};
```

#### `ControlsTouchMode` (type)

How touch drives play (runtime's `TouchMode`).

```ts
type ControlsTouchMode = 'buttons' | 'swipe';
```

#### `CornerControls` (const)

Back at the start, the game's own corner controls (Mute, a language flag) at the end, in the
same row on every screen (M1.6 spec §3.4; from FloorFifty `ui/layout/CornerControls.svelte` at
122a220). A screen does not render its own. `header` sits between them in the same row, on the
screen's centre line, so a short screen spends no row of its own on it.

```ts
const CornerControls: import("svelte").Component<Props, {}, "">;
type CornerControls = ReturnType<typeof CornerControls>;
```

#### `createGeometryOwner` (function)

Creates the geometry owner of a document, the only writer of its geometry: make one per document. It measures
at once, on every resize of the window or the visual viewport, and again at 100, 400 and 1000 ms as bars and
the keyboard settle, and publishes each measure on the root.

```ts
function createGeometryOwner(options: GeometryOwnerOptions): GeometryOwner;
```

#### `CURSOR_IDLE_MS` (const)

How long the pointer must be still before it hides on a gameplay screen.

```ts
const CURSOR_IDLE_MS = 2000;
```

#### `cursorHidden` (function)

Whether the pointer is hidden now: on a gameplay screen, not paused, and the pointer unused or idle.

```ts
function cursorHidden(state: {
    kind: ScreenKind | undefined;
    paused: boolean;
    lastInput: CursorInput;
    msSincePointerMove: number;
}): boolean;
```

#### `CursorInput` (type)

The device the player used last, as the cursor policy sees it.

```ts
type CursorInput = 'pointer' | 'keyboard' | 'gamepad' | 'touch';
```

#### `CursorRunner` (class)

Applies `cursorHidden` to a target element: `attach` follows pointer moves and key presses, and each `tick` sets the
element's `cursor` style. Detaching shows the pointer again.

```ts
class CursorRunner {
    private readonly target;
    private readonly options;
    private lastInput;
    private movedAt;
    private readonly now;
    constructor(target: HTMLElement, options?: {
        now?: () => number;
        kind?: () => ScreenKind | undefined;
        paused?: () => boolean;
    });
    noteInput(input: CursorInput): void;
    attach(events?: EventTarget): () => void;
    tick(): void;
}
```

#### `defaultSlot` (function)

The newest slot that can be continued; else the first slot; else none.

```ts
function defaultSlot(slots: readonly SaveSlotView[]): number | undefined;
```

#### `DeviceClass` (type)

The kind of device the player holds: `phone`, `tablet` or `desktop`, decided once at boot.

```ts
type DeviceClass = 'phone' | 'tablet' | 'desktop';
```

#### `Dialog` (const)

A question that needs an answer before the screen goes on (M1.6 spec §3.4; from Ruken
`packages/ui/src/Dialog.svelte` at b30d31b). The screen renders it only while it is open
(`{#if open}<Dialog>`) and decides what each action does; `onclose` is what Escape means, and it
should mean the safe choice.

Keyboard and focus (the rules live in `modal-scope.ts`, which Modal and Sheet share):
- Initial focus goes to the control marked `data-initial-focus` (the safe action), else the
  first control, else the dialog itself.
- Tab and Shift+Tab wrap inside the dialog, and focus that lands outside it is pulled back in.
  The scrim covers the page, so a pointer cannot reach out either.
- When the dialog goes away, focus returns to whatever had it before the dialog opened.
- Escape calls `onclose`. The focus navigator's Back arrives as Escape, so a controller closes
  it the same way. With dialogs stacked, only the topmost answers Escape and holds focus.
- While it is open the page behind it is `inert` (every sibling of the dialog and of each of its
  ancestors up to the body), so assistive technology and the browser cannot reach it either.

Layout: a sheet on the bottom edge on a phone, centred otherwise; always inside the insets and
above the keyboard. Its body is a declared scroll region, so on a 780 x 270 screen the actions
stay reachable however long the text is.

```ts
const Dialog: import("svelte").Component<Props, {}, "">;
type Dialog = ReturnType<typeof Dialog>;
```

#### `DISPLAY_QUALITIES` (const)

The tiers the Display section offers, best first.

```ts
const DISPLAY_QUALITIES: readonly DisplayQuality[];
```

#### `DisplayCopy` (interface)

Every word the Display section shows, in the game's language.

```ts
interface DisplayCopy {
    readonly title: string;
    /** The quality choice's name. */
    readonly quality: string;
    readonly qualities: Readonly<Record<DisplayQuality, string>>;
    /** Reduced motion as the browser reports it: "Reduced motion: on (from your device)". */
    reducedMotion(reduced: boolean): string;
}
```

#### `DisplayQuality` (type)

A graphics quality tier (runtime's `QualityTier`).

```ts
type DisplayQuality = 'high' | 'medium' | 'low';
```

#### `DisplaySection` (const)

The Display section of Settings (M4 spec §4.8, §7): the graphics quality tier as an option group (a pad's `adjust`
cycles it), and reduced motion as the browser reports it. Reduced motion is the player's system setting, so it is
shown and never changed here.

```ts
const DisplaySection: import("svelte").Component<Props, {}, "">;
type DisplaySection = ReturnType<typeof DisplaySection>;
```

#### `endonymOf` (function)

A language's name in its own language ("日本語" for `ja`), from the browser's `Intl.DisplayNames`. An engine without
it, or a tag it cannot name, gives the tag back, so the picker never shows nothing.

```ts
function endonymOf(tag: string): string;
```

#### `enterFullscreen` (function)

Enters element fullscreen, then asks for a landscape lock, which most phones refuse outside an installed app. A
refusal of either changes nothing: the game plays in the window (M4 spec §6).

```ts
function enterFullscreen(doc: Document, screen?: Screen): Promise<void>;
```

#### `ErrorAction` (interface)

One way forward from a failure (M1.6 spec §3.4).

```ts
interface ErrorAction {
    readonly id: string;
    readonly label: string;
    readonly kind: 'primary' | 'secondary';
    readonly onSelect: () => void;
}
```

#### `ErrorCode` (type)

Ruken's error code. The SDK exports the class, not the alias.

```ts
type ErrorCode = RukenError['code'];
```

#### `ErrorPanel` (const)

A failure, and what the player can do about it (M1.6 spec §3.4; from FloorFifty
`ui/components/ErrorPanel.svelte` at 122a220).

`role="alert"` rather than `role="status"`, because this interrupts: the player usually just
pressed something and needs to know it did not work. The panel is opaque, because a failure is
often the thing that means the artwork did not arrive. It sits at the top of the visible region,
under the corner row, so it never covers the way out of the screen it reports on, and its layer
passes taps through everywhere but the panel.

Where the room is short (a long message, a keyboard), the panel gives up space in this order:
first the message, which scrolls, down to one visible line; only then the gap that keeps it under
the corner row, so it rises over Back only when its actions cannot fit any other way. A final
panel has no actions and is the screen's last word, so it never rises: Back is its way out. The
actions sit outside the scrolling part and never shrink (framework audit of #7).

```ts
const ErrorPanel: import("svelte").Component<Props, {}, "">;
type ErrorPanel = ReturnType<typeof ErrorPanel>;
```

#### `fitColumns` (function)

The shape cut to the columns the largest group fills, at its rows. Run after `trimRows`.

```ts
function fitColumns<T>(shape: GridShape, groups: readonly PageGroup<T>[]): GridShape;
```

#### `fitShape` (function)

The most tiles of `minTile` px the box holds, never more than `most`, never below one by one.

```ts
function fitShape(most: GridShape, box: GridBox, minTile: number, gap: number): GridShape;
```

#### `FocusNavigator` (class)

Moves focus the way a d-pad would: `move` walks Tab order, `steer` walks a `[data-focus-grid]` spatially,
`page` offers a page turn, and `recover` puts focus back on the first control when a screen change dropped
it. `attach` listens for the player's own pointer and keys, so the navigator steps back from them.

```ts
class FocusNavigator {
    /**
     * Whether the navigator is the one moving focus: set by any navigator action, cleared by a
     * pointer or real key press. Only then does `recover` step in, so a mouse or keyboard player's
     * focus is never moved for them.
     */
    private engaged;
    private paused;
    /** Armed by `guard()` on a screen change; a confirm key held from the last screen is cancelled until it comes up. */
    private guarded;
    private readonly root;
    constructor(root?: () => ParentNode);
    /** Stops `recover` once the player presses anything that is not the navigator. */
    attach(target?: EventTarget): () => void;
    /**
     * Arms the pad guard (M4 spec §4.7, F-a): called on a screen change, it cancels repeating Enter and Space
     * keydowns until the key comes up or is pressed afresh. A pad's own confirm is an edge from `Input`, which
     * cannot repeat, so only the keyboard needs this; `attach` must be listening.
     */
    guard(): void;
    /** Paused while a screen transition covers the screen. */
    setPaused(paused: boolean): void;
    /**
     * Puts focus back on the first control, in Tab's order, when it has fallen to the page (the
     * screen it stood on was replaced) or out of an open dialog. Called each frame while the
     * navigator is in use; a controller player otherwise saw nothing selected after every screen change.
     */
    recover(): void;
    move(direction: 'next' | 'previous'): void;
    /**
     * One step in `direction` (M4 spec §4.7). Inside a `[data-focus-grid]` the move is spatial: the nearest control
     * whose centre lies that way, scored by distance along the direction plus twice the sideways offset, so a
     * straight line wins over a diagonal. Elsewhere it is DOM order: down and right go next, up and left previous.
     * Returns false when nothing lies that way in the grid, so the caller can page or stay put.
     */
    steer(direction: NavDirection): boolean;
    /**
     * Offers a page turn (PageUp/PageDown, the shoulder buttons, a page swipe) to the focused control. A
     * `[data-pager]` region above it takes the cancelable `af-page` event; returns whether one did.
     */
    page(delta: -1 | 1): boolean;
    /**
     * Changes the focused slider or option group by one step without leaving it (from FloorFifty's `adjust`, plus
     * radio groups for OptionGroup). Fires the event a pointer or arrow key would (`input` on a range, `change` on a
     * radio). Returns false when nothing adjustable has focus, so the caller steers instead.
     */
    adjust(delta: -1 | 1): boolean;
    confirm(): void;
    /** Sends Escape to the focused element, marked as the navigator's, so dialogs close through one path. */
    back(): void;
}
```

#### `FormFactor` (type)

The four form factors (M1.6 spec §3.1; from FloorFifty `ui/form-factor.ts` at 122a220).

Decided from the layout viewport's size alone. Whether the pointer is coarse is a different
question: it decides which controls mount, not how a screen is laid out. So a tablet with a
keyboard and a desktop with a touch screen both get the layout their shape asks for.

The one place the thresholds live. CSS reads the answer from `data-form-factor`, script from
the geometry owner, and neither re-derives it.

```ts
type FormFactor = 'phone-portrait' | 'phone-landscape' | 'tablet-portrait' | 'desktop';
```

#### `fullscreenSupport` (function)

Which fullscreen, if any, this browser can give a standalone page.

```ts
function fullscreenSupport(doc: Document, nav: Navigator): FullscreenSupport;
```

#### `FullscreenSupport` (type)

Ruken's answer to whether this browser can go fullscreen, and how.

```ts
type FullscreenSupport = FullscreenRes['support'];
```

#### `GateInputs` (type)

What `landscapeGate` decides from: the form factor, whether the pointer is coarse, the browser's fullscreen
support and state, and whether the page is installed as an app.

```ts
type GateInputs = {
    formFactor: FormFactor;
    /** `(pointer: coarse)`: the primary pointer is a finger. */
    coarse: boolean;
    support: FullscreenSupport;
    fullscreen: boolean;
    /** Installed and opened as an app (`display-mode` standalone or fullscreen): no browser bar. */
    installed: boolean;
};
```

#### `Geometry` (interface)

The geometry every screen lays out against: the layout size, form factor and height tier, the insets, the
usable and visible regions, what covers the page's foot, and the host's scale hint.

```ts
interface Geometry {
    readonly layout: {
        readonly width: number;
        readonly height: number;
    };
    readonly formFactor: FormFactor;
    readonly heightTier: HeightTier;
    /** Per side, the largest of the env inset, the host's safe area and the host's reserved strip. */
    readonly insets: Insets;
    readonly hostReserved: {
        readonly left: number;
        readonly right: number;
    };
    /** The layout viewport less the insets. */
    readonly usable: Rect;
    /** What the browser lays over the page's foot (keyboard, a bottom toolbar, a hidden bar), in whole px. */
    readonly visualInsetBottom: number;
    /** The part of `visualInsetBottom` that is a bar the browser does not report, in whole px. */
    readonly hiddenBarBottom: number;
    /** How much a keyboard shrank the layout viewport itself (see `restingLayout`), in whole px. */
    readonly keyboardResize: number;
    /** `usable` less the visual inset: what the player can actually see and reach. */
    readonly visible: Rect;
    readonly scale: HostDisplay['scale'];
}
```

#### `GeometryInput` (interface)

What `measureGeometry` reads: the layout viewport, the visual viewport, the safe-area insets, the host's
display metrics, a hidden bar's height and the layout before a keyboard shrank it.

```ts
interface GeometryInput {
    /** The layout viewport, `innerWidth x innerHeight`. Form factor and tier come from this alone. */
    readonly layout: {
        readonly width: number;
        readonly height: number;
    };
    /** The visual viewport, when the browser has one. The keyboard shrinks this, not the layout. */
    readonly visual?: {
        readonly height: number;
        readonly offsetTop: number;
    } | undefined;
    /** `env(safe-area-inset-*)`, read by a probe element. */
    readonly envSafeArea: Insets;
    /** Absent standalone. */
    readonly host?: HostDisplay | undefined;
    /** A bar the browser draws over the page without reporting it (`browser/hidden-browser-bar.ts`). */
    readonly hiddenBarBottom?: number | undefined;
    /**
     * The layout viewport before a keyboard shrank it, when one did. Browsers that ignore
     * `interactive-widget=resizes-visual` shrink the page itself for the keyboard; classifying the
     * shrunken page would remount the screen mid-typing, so the class comes from this instead.
     * The owner passes it only while a text field has focus and the width has not changed.
     */
    readonly restingLayout?: {
        readonly width: number;
        readonly height: number;
    } | undefined;
}
```

#### `GeometryOwner` (interface)

The one geometry owner of a document: `geometry.current` for components, `onChange` for script,
`setHostDisplay`, `remeasure` and `dispose`.

```ts
interface GeometryOwner {
    readonly geometry: GeometryState;
    /** Hears every measure; returns the unsubscribe. For consumers outside Svelte. */
    onChange(listener: (geometry: Geometry) => void): () => void;
    /** The host's display metrics changed (Ruken `display.metrics`), or `undefined` for standalone. */
    setHostDisplay(display: HostDisplay | undefined): void;
    /** For a screen that just mounted: a WebView's bars can settle with no event at all. */
    remeasure(): void;
    dispose(): void;
}
```

#### `GeometryOwnerOptions` (interface)

What `createGeometryOwner` needs: the window to read and the root to publish on, and optionally the host's
display, timers and a safe-area reader.

```ts
interface GeometryOwnerOptions {
    readonly window: ViewportWindow;
    /** Where the geometry is published: normally `document.documentElement`. */
    readonly root: HTMLElement;
    readonly host?: HostDisplay | undefined;
    readonly timers?: Timers | undefined;
    readonly readEnvSafeArea?: (() => Insets) | undefined;
}
```

#### `GeometryState` (interface)

The current geometry as rune state: reading `current` in a component or `$derived` tracks it.

```ts
interface GeometryState {
    readonly current: Geometry;
}
```

#### `GridBox` (interface)

The measured box a page is fitted into, in CSS px.

```ts
interface GridBox {
    readonly width: number;
    readonly height: number;
}
```

#### `GridPage` (interface)

One page: a group's items, padded with `undefined` to the page's capacity.

```ts
interface GridPage<T> {
    readonly key: string;
    readonly groupId: string;
    readonly title: string;
    readonly slots: readonly (T | undefined)[];
}
```

#### `GridShape` (interface)

A page's columns and rows.

```ts
interface GridShape {
    readonly columns: number;
    readonly rows: number;
}
```

#### `HeightTier` (type)

The height tiers (M1.6 spec §3.1; from FloorFifty `ui/height-tier.ts` at 122a220).

The form factor says what shape a screen is; the tier says how much height it has to spend.
Two screens of the same form factor can need different answers: a 1280 x 720 desktop and a
900 x 600 window are both desktop, and only one can afford a hero above the menu.

Written to `<html data-height>` by the geometry owner. Tokens tighten under it, so every
primitive tightens at once. Targets never shrink with the tier; gutters and decoration do.

```ts
type HeightTier = 'short' | 'compact' | undefined;
```

#### `HiddenBrowserBar` (class)

Recognises a browser bar the browser has stopped reporting (DuckDuckGo for Android's bottom bar) and
measures how much of the page's foot it covers. It keeps state: it learns the largest settled
screen-to-page gap for each orientation.

```ts
class HiddenBrowserBar {
    /** The bottom address bar's height when the gap cannot say (measured: 64). */
    static readonly FALLBACK_HEIGHT = 64;
    /**
     * The smallest honest portrait gap: a 24 px status bar and a 56 px address
     * bar, with no navigation bar at all. Below it, no bar is being accounted for.
     */
    static readonly MIN_PORTRAIT_GAP = 80;
    /** A change in the gap smaller than this is the system, not a bar. */
    static readonly MIN_HEIGHT = 40;
    /** Larger than this, and the page changed for some other reason. */
    static readonly MAX_HEIGHT = 120;
    /** A gap larger than this is a keyboard, and is never learned. */
    static readonly MAX_LEARNED_GAP = 200;
    private readonly honestGap;
    /** How much of the page's foot the browser's bar covers, in CSS pixels. */
    measure(sample: BarSample): number;
}
```

#### `HostDisplay` (type)

What the host says about the display: the parts of Ruken's `display.metrics` the geometry reads.
Imported from the vendored `@ruken/sdk`, never copied (M1 shared contracts).
`scale` is 1.333 on Ruken's TV mode: a hint to enlarge text and targets, never CSS zoom.

```ts
type HostDisplay = Pick<DisplayMetricsPayload, 'safeArea' | 'hostReserved' | 'scale'>;
```

#### `HostKind` (type)

`Hosting['kind']` (shared contracts §1.1), written out because ui never imports host. A `web` session (PUB
spec §3) draws as `standalone`: it has no host to go back to.

```ts
type HostKind = 'ruken' | 'standalone';
```

#### `hostReservedInsets` (function)

Ruken reserves a strip on one edge; its width is the rect's, never negative (FloorFifty `reservedOf`).

```ts
function hostReservedInsets(host: HostDisplay | undefined): {
    left: number;
    right: number;
};
```

#### `IconButton` (const)

A button whose face is an icon (M4 spec §4.12). Its accessible name is `label`, which it cannot
do without: an empty label throws while it mounts, so a nameless icon button fails its first test
instead of reaching a player. The icon is decoration and hidden from assistive technology.

```ts
const IconButton: import("svelte").Component<Props, {}, "">;
type IconButton = ReturnType<typeof IconButton>;
```

#### `InputMethod` (type)

The input method the player last used, app-wide.

Menus and tutorials teach the controls in the player's hand, and neither
lives inside the sim, so this is not the game's input. A mouse moves
nothing: it says nothing about which controls to teach. Which buttons a
controller carries (its glyph family) belongs to M4 input.

```ts
type InputMethod = 'keyboard' | 'gamepad' | 'touch';
```

#### `InputMethodTracker` (class)

Tracks the input method the player used last (`keyboard`, `gamepad` or `touch`) as rune state in `method`.
`attach` listens for key presses and touch or pen presses, counting a controller's Back (which arrives as
Escape) as the controller; `note` records one by hand.

```ts
class InputMethodTracker {
    /** A coarse pointer starts as touch, anything else as keyboard. */
    method: InputMethod;
    note(method: InputMethod): void;
    /** Listens in the capture phase, so a control that stops propagation still counts. */
    attach(target?: EventTarget): () => void;
}
```

#### `Insets` (interface)

CSS px on each side, all >= 0.

```ts
interface Insets {
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
    readonly left: number;
}
```

#### `installGlobalErrorHandlers` (function)

Installs once per window; a second call is a no-op. Returns the uninstall.

```ts
function installGlobalErrorHandlers(win: Window, onFatal: (errorClass: string) => void, 
/**
 * A promise nobody awaited that rejected. The game goes on -- a cue that
 * failed to fetch must not end a race -- so it is heard apart from `onFatal`.
 */
onRejection?: (errorClass: string) => void): () => void;
```

#### `interceptBackGesture` (function)

Holds the game's history entry and turns a back step off it into `onBack`.
`onBack` answers whether the game went back; `false` lets the step leave.

```ts
function interceptBackGesture(win: Window, onBack: () => boolean): () => void;
```

#### `isDuckDuckGo` (function)

DuckDuckGo names itself only in the client-hint brands, not the user agent.

```ts
function isDuckDuckGo(nav: object): boolean;
```

#### `isFullscreen` (function)

Whether the page is fullscreen now.

```ts
function isFullscreen(doc: Document): boolean;
```

#### `isTap` (function)

Whether a press that moved `dx`, `dy` px is a tap rather than a swipe.

```ts
function isTap(dx: number, dy: number): boolean;
```

#### `keyLabel` (function)

A key's label: the keyboard layout's own (`navigator.keyboard.getLayoutMap()`, a letter in capitals) when there
is one, else its `code` without the `Key` and `Digit` prefixes, an arrow as its arrow.

```ts
function keyLabel(code: string, layout?: ReadonlyMap<string, string>): string;
```

#### `landscapeGate` (function)

What a phone held sideways must do: `none`, `fullscreen` (one tap to go fullscreen) or `rotate-or-install`
(turn upright or add to the Home Screen). Only a coarse-pointer phone in landscape that is not installed is
ever gated.

```ts
function landscapeGate(inputs: GateInputs): LandscapeGateState;
```

#### `LandscapeGate` (const)

The landscape gate's cover (M4 spec §4.9, §7; FloorFifty `ui/components/LandscapeGate.svelte` at `ac72660`): over
every screen and every dialog, empty whenever the gate is open (`state` none). Where the browser can hide its bar,
one tap on the focused button does it; where it cannot, the cover says how to play. The runtime decides the state
(`landscapeGate`) and only standalone (M4-D5): under Ruken the host frames the game.

```ts
const LandscapeGate: import("svelte").Component<Props, {}, "">;
type LandscapeGate = ReturnType<typeof LandscapeGate>;
```

#### `LandscapeGateCopy` (interface)

The landscape gate's words: one tap to fullscreen, or how to play where a browser cannot hide its bar.

```ts
interface LandscapeGateCopy {
    readonly title: string;
    readonly body: string;
    /** The button that goes fullscreen. */
    readonly go: string;
    readonly uprightTitle: string;
    readonly uprightBody: string;
}
```

#### `LandscapeGateState` (type)

Nothing; a tap to go fullscreen; or turn upright / add to the Home Screen.

```ts
type LandscapeGateState = 'none' | 'fullscreen' | 'rotate-or-install';
```

#### `LanguageCopy` (interface)

Every word the Language group shows besides the languages' own names, in the game's language.

```ts
interface LanguageCopy {
    readonly title: string;
    /** The choice that follows the host and the browser (`Locale.set(null)`). */
    readonly automatic: string;
}
```

#### `LanguageSection` (const)

The Language group of the Settings tab (Owner, 2026-10-18), laid out as FloorFifty's (`LanguagePicker.svelte` at
a28dc44): Automatic, then each of the game's languages by its endonym, each in its own `lang` so a screen reader
says it in that language. A pick is reported at once (`Locale.set`); nothing remounts, so focus stays on it.
FloorFifty's flags are its own art; a game names its languages here, and may give its own names (`names`).

```ts
const LanguageSection: import("svelte").Component<Props, {}, "">;
type LanguageSection = ReturnType<typeof LanguageSection>;
```

#### `LeaderboardCopy` (interface)

Every word the panel shows, in the game's language.

```ts
interface LeaderboardCopy {
    readonly title: string;
    readonly loading: string;
    readonly empty: string;
    /** `UNSUPPORTED`: no grant, or standalone ("Scores aren't available here"). */
    readonly unavailable: string;
    /** `OFFLINE` ("You're offline"). */
    readonly offline: string;
    /** Said beside the player's own row. */
    readonly you: string;
    /** "+N more", for the rows below the fold. */
    readonly more: (count: number) => string;
}
```

#### `LeaderboardEntryView` (interface)

One row of a board, as the host gives it; `isMe` marks the player.

```ts
interface LeaderboardEntryView {
    readonly rank: number;
    readonly displayName: string;
    readonly score: number;
    readonly isMe: boolean;
}
```

#### `LeaderboardPanel` (const)

A board's rows, or why there are none (M5 spec §7): loading, entries (the player's row marked "you"
in words, not only by colour), empty, unavailable and offline. The rows are read, not chosen, so
they are out of the focus order; only the action row (Back, Play again) takes focus. Unavailable
and offline are what the host said: the panel never shows a board kept on the device instead.
The rows sit in a ScrollList, a declared scroll region, so on a short screen they scroll and the
action row stays.

```ts
const LeaderboardPanel: import("svelte").Component<Props, {}, "">;
type LeaderboardPanel = ReturnType<typeof LeaderboardPanel>;
```

#### `LeaderboardView` (type)

What the panel shows: the rows, or why there are none.

```ts
type LeaderboardView = {
    readonly state: 'loading';
} | {
    readonly state: 'entries';
    readonly entries: readonly LeaderboardEntryView[];
} | {
    readonly state: 'empty';
} | {
    readonly state: 'unavailable';
} | {
    readonly state: 'offline';
};
```

#### `LoaderOverlay` (const)

The loader over a screen while its assets load (M1.6 spec §3.4; from FloorFifty
`ui/components/LoaderOverlay.svelte` at 122a220). It shows real progress when the runtime has it
and an indeterminate bar before the first byte, says what is loading in words, and after the
runtime's slow threshold says quietly that it is slow, not failing. The slow line always holds
its height, so nothing shifts when it appears.

```ts
const LoaderOverlay: import("svelte").Component<Props, {}, "">;
type LoaderOverlay = ReturnType<typeof LoaderOverlay>;
```

#### `lockOverscroll` (function)

A Svelte action: `<div use:lockOverscroll>`.

```ts
function lockOverscroll(node: HTMLElement): {
    destroy(): void;
};
```

#### `measureGeometry` (function)

Turns what the browser and the host report into one `Geometry`. Pure. Each inset is the largest of the
browser's safe area, the host's and (at the sides) the host's reserved strip; the visible region is the
usable one less whatever covers the page's foot.

```ts
function measureGeometry(input: GeometryInput): Geometry;
```

#### `Modal` (const)

A panel over the screen with a visible Close (M4 spec §4.12; the rules of FloorFifty
`ui/components/Modal.svelte` at ac72660). Where Dialog asks a question that needs an answer,
Modal shows something the player can close at any time: a level list, a credits page.

It holds the page by the rules Dialog uses (`modal-scope.ts`): the page behind is inert, focus
moves in on open and back to the opener on close, Tab wraps, and Escape (or the pad's Back)
calls `onclose`. A tap on the dimmed page calls `onbackdrop` only when one is given; absent,
such a tap does nothing, so a stray tap never loses the player's place.

`anchor="bottom"` puts it on the bottom edge at every form factor; Sheet is that.

```ts
const Modal: import("svelte").Component<$$ComponentProps, {}, "">;
type Modal = ReturnType<typeof Modal>;
```

#### `ModalProps` (interface)

The props Modal and Sheet share.

```ts
interface ModalProps {
    title: string;
    /** The Close button's name, in the game's language. */
    closeLabel: string;
    onclose: () => void;
    /** A tap on the dimmed page around the panel; absent, such a tap does nothing. */
    onbackdrop?: (() => void) | undefined;
    children?: Snippet | undefined;
    /** What sits with the title (Settings' tabs): beside it where the dialog is 480 px wide, under it where not. */
    head?: Snippet | undefined;
    /** A long body (Settings) that widens on a short, wide band to set its groups two across; others keep their width. */
    wide?: boolean | undefined;
    /** A dialog that fills a phone's band, its body taking the rest and its actions at the bottom (Settings). */
    fill?: boolean | undefined;
    /** The buttons, in reading order. Mark the safe one with `data-initial-focus`. */
    actions?: Snippet | undefined;
    testId?: string | undefined;
}
```

#### `NavDirection` (type)

A direction a d-pad or an arrow key walks a menu.

```ts
type NavDirection = 'up' | 'down' | 'left' | 'right';
```

#### `nearestTarget` (function)

The button a point is on, or else the nearest within the margin, or nothing. Distance is to the button's edge,
so any point inside is 0.

```ts
function nearestTarget(x: number, y: number, targets: readonly TouchTarget[], margin?: number): string | undefined;
```

#### `onFullscreenChange` (function)

Hears fullscreen being entered or left, by the page or the player. Returns the unsubscribe.

```ts
function onFullscreenChange(doc: Document, listener: () => void): () => void;
```

#### `OptionGroup` (const)

A choice of one (M4 spec §4.8; the rules of FloorFifty `ui/layout/OptionGroup.svelte` at `ac72660`): a
segmented row whose chosen option is filled and marked, never only underlined or only coloured.

Native radios in a fieldset, where FloorFifty used `<button role="radio">`: the browser gives the arrow keys,
and the focus navigator's `adjust` cycles a named radio group, so a pad changes it without leaving it.

Controlled: it reports a choice through `onchange` and shows the `value` it is given. A choice the owner does
not take is undone, so what is checked is always the owner's value.

```ts
const OptionGroup: import("svelte").Component<Props, {}, "">;
type OptionGroup = ReturnType<typeof OptionGroup>;
```

#### `PAD_FOCUS` (const)

How the navigator focuses: with a ring, and without scrolling the page. `focusVisible` because a
browser draws no ring for script focus after a click or tap; `preventScroll` because the game owns
the viewport. (`focusVisible` is not yet in TypeScript's DOM types; Chromium, Firefox and Safari
take it.)

```ts
const PAD_FOCUS: FocusOptions;
```

#### `padKeyEvents` (const)

Keydown events the navigator sent itself. Back reaches the page as Escape so every dialog
handles it once, but it is not a keyboard: an input-method tracker skips these, or one press of
a controller's B would teach keyboard controls to a controller player.

```ts
const padKeyEvents: WeakSet<Event>;
```

#### `padLabel` (function)

A standard-mapping pad button's label on a pad of `glyphs`.

```ts
function padLabel(button: number, glyphs: PromptGlyphs, copy: PromptCopy): string;
```

#### `PadWord` (type)

The pad buttons known by a word, for a pad whose labels are not known.

```ts
type PadWord = 'bottom' | 'right' | 'left' | 'top' | 'leftBumper' | 'rightBumper' | 'leftTrigger' | 'rightTrigger' | 'select' | 'start' | 'leftStick' | 'rightStick' | 'home';
```

#### `PAGE_SWIPE` (const)

Swipe is the pagination on a paged region, on every form factor: a finger, a mouse drag, a trackpad's two-finger
sideways swipe. From FloorFifty `apps/client/src/ui/page-swipe.ts` at `ac72660`, unchanged but for a doc comment.
A press that moves less than 8 px is a tap, so swiping never picks by accident; a quick flick turns one page
whatever the distance; a slow drag snaps to the nearest page.

```ts
const PAGE_SWIPE: {
    readonly tapSlopPx: 8;
    readonly flickPxPerMs: 0.4;
    readonly wheelStepPx: 40;
};
```

#### `PagedGrid` (const)

A grid of items in pages that never scrolls (M4 spec §4.8; the page arithmetic of FloorFifty `ui/tile-pages.ts`
at `ac72660`). Each group starts its own page; the shape is `most`, cut to what the measured box holds at
`minTile` and to what the largest group fills. PagerDots show where it is.

The page is controlled: it reports `onpage` and shows the `page` it is given. A `[data-focus-grid]`, so the
focus navigator steers through the tiles spatially, and paging comes from the owner (a page swipe, a pad's
shoulder buttons, the dots).

```ts
const PagedGrid: $$IsomorphicComponent;
type PagedGrid<T extends {
    readonly id: string;
}> = InstanceType<typeof PagedGrid<T>>;
```

#### `PagedGridProps` (interface)

PagedGrid's props: groups of items, the most columns and rows a page has, and the page its owner shows.

```ts
interface PagedGridProps<T> {
    /** The grid's name for assistive technology, also the pager's. */
    label: string;
    groups: readonly PageGroup<T>[];
    /** The most columns and rows a page has. */
    most: GridShape;
    /** The current page, from 0; wrapped into range. */
    page: number;
    onpage: (page: number) => void;
    item: Snippet<[T]>;
    /** The smallest tile side, in px, before the shape drops a row or column. */
    minTile?: number | undefined;
    gap?: number | undefined;
    /** How a group's later pages are titled. */
    continued?: ((title: string, part: number) => string) | undefined;
    dotLabel?: ((position: number, total: number) => string) | undefined;
    testId?: string | undefined;
}
```

#### `PageGroup` (interface)

A titled run of items; each group starts its own page.

```ts
interface PageGroup<T> {
    readonly id: string;
    readonly title: string;
    readonly items: readonly T[];
}
```

#### `pageOf` (function)

The page holding the item with `id`, or -1 when no page does.

```ts
function pageOf<T extends {
    readonly id: string;
}>(pages: readonly GridPage<T>[], id: string): number;
```

#### `PagerDots` (const)

Where a paged view is (M4 spec §4.8; from FloorFifty `ui/layout/PagerDots.svelte` at `ac72660`): one row of
dots, each a whole touch target, or "3 / 11" once the dots would not fit on one row. It never wraps.

```ts
const PagerDots: import("svelte").Component<Props, {}, "">;
type PagerDots = ReturnType<typeof PagerDots>;
```

#### `pagerMode` (function)

PagerDots' choice (M4 spec §4.8; from FloorFifty `ui/layout/pager.ts` at `ac72660`): dots while they fit on one
row, a counter ("3 / 11") once they would not. Dots never wrap.

```ts
function pagerMode(count: number, max?: number, available?: number, dotSize?: number): 'dots' | 'counter';
```

#### `paginate` (function)

One group per page; a group longer than a page continues under `continued(title, part)`, "Title (2)" by default.
An empty group has no page.

```ts
function paginate<T>(groups: readonly PageGroup<T>[], capacity: number, continued?: (title: string, part: number) => string): GridPage<T>[];
```

#### `pastEdge` (function)

Whether a drag of `dy` (positive = finger moving down) would pass an edge.

```ts
function pastEdge(scroller: {
    scrollTop: number;
    scrollHeight: number;
    clientHeight: number;
}, dy: number): boolean;
```

#### `PHONE_LANDSCAPE_MAX_HEIGHT` (const)

A landscape viewport shorter than this is a phone, or a desktop window short enough to need
the phone's compact layout. 500 keeps the 932 x 430 class of phone inside it with room to spare.

```ts
const PHONE_LANDSCAPE_MAX_HEIGHT = 500;
```

#### `PHONE_PORTRAIT_MAX_WIDTH` (const)

A portrait viewport narrower than this is a phone; at or above it, a tablet.

```ts
const PHONE_PORTRAIT_MAX_WIDTH = 600;
```

#### `PointerLatch` (class)

Which fingers are down on which action. Reports only real changes: a second finger landing on a button already
held produces nothing, and lifting it produces nothing either. The action ends when its last finger lifts.

```ts
class PointerLatch {
    private readonly onInput;
    private readonly active;
    constructor(onInput: (action: string, active: boolean) => void);
    /** True while any finger holds the action; what the pressed style reads. */
    isHeld(action: string): boolean;
    press(action: string, pointerId: number): void;
    release(action: string, pointerId: number): void;
    /** Releases everything still held, reporting each action exactly once. */
    releaseAll(): void;
}
```

#### `PointerTracker` (interface)

What a SwipeSurface drives: runtime's `SwipeTracker` satisfies it, so ui need not import runtime. Times are
`PointerEvent.timeStamp`.

```ts
interface PointerTracker {
    readonly tuning: {
        readonly saturationPx: number;
    };
    readonly indicator: SwipeIndicatorView | undefined;
    down(id: number, x: number, y: number, t: number, options?: {
        readonly steers?: boolean;
    }): void;
    move(id: number, x: number, y: number, t: number): void;
    up(id: number, x: number, y: number, t: number): void;
    cancel(): void;
}
```

#### `probeEnvSafeArea` (function)

Reads `env(safe-area-inset-*)` through a hidden probe, since script cannot read `env()` directly.
An engine that does not compute `env()` (jsdom) yields 0 on every side.

```ts
function probeEnvSafeArea(root: HTMLElement): Insets;
```

#### `Prompt` (const)

A device prompt (M4 spec §4.6): the label of an action's input on the device in the player's hand, a key, a pad
button or the touch label, or "Unbound". It follows its props in place, so a rebind or a device switch never
remounts it, and it is never in the focus order. `data-prompt` is the kind.

```ts
const Prompt: import("svelte").Component<Props, {}, "">;
type Prompt = ReturnType<typeof Prompt>;
```

#### `PromptBinding` (interface)

What drives one action (runtime's `InputBinding`, the fields a prompt reads).

```ts
interface PromptBinding {
    readonly keys: readonly string[];
    readonly pad: readonly number[];
    readonly touch: boolean;
}
```

#### `PromptCopy` (interface)

Every word a prompt shows, in the game's language.

```ts
interface PromptCopy {
    /** An action with nothing on the active device. */
    readonly unbound: string;
    /** An action with an on-screen button, on touch. */
    readonly touch: string;
    readonly pad: Readonly<Record<PadWord, string>>;
}
```

#### `PromptDevice` (type)

The device a prompt is for (runtime's `InputDevice`).

```ts
type PromptDevice = 'keyboard' | 'gamepad' | 'touch';
```

#### `PromptGlyphs` (type)

The labels a pad's buttons carry (runtime's `GlyphFamily`).

```ts
type PromptGlyphs = 'xbox' | 'playstation' | 'generic';
```

#### `PromptView` (type)

What a prompt shows: its kind (`data-prompt`) and its label.

```ts
type PromptView = {
    readonly kind: 'key' | 'pad' | 'touch' | 'unbound';
    readonly label: string;
};
```

#### `promptView` (function)

What a prompt shows for `binding` on `device`: its first input there, or Unbound.

```ts
function promptView(binding: PromptBinding, device: PromptDevice, glyphs: PromptGlyphs, copy: PromptCopy, layout?: ReadonlyMap<string, string>): PromptView;
```

#### `readKeyboardLayout` (function)

The keyboard's layout map where the browser has one (`navigator.keyboard`, Chromium), or undefined: where the
browser has none or refuses (a cross-origin frame may), prompts name keys by their `code` (M4 spec §6).

```ts
function readKeyboardLayout(nav: Navigator): Promise<ReadonlyMap<string, string> | undefined>;
```

#### `RebindDevice` (type)

A device a player can rebind (touch buttons and gestures are the game's).

```ts
type RebindDevice = 'keyboard' | 'gamepad';
```

#### `Rect` (interface)

A rectangle in CSS px: its top-left corner and its size.

```ts
interface Rect {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}
```

#### `reducedMotion` (function)

Whether the player has asked for less movement.

Checked at call time rather than cached, because the setting can change
while the game is open. Primitives also honour it in CSS; this is for code
that moves things itself.

```ts
function reducedMotion(win?: Pick<Window, 'matchMedia'>): boolean;
```

#### `releaseStep` (function)

Pages to turn when a drag of `dx` px over `dtMs` is released: a swipe left is +1 (next).

```ts
function releaseStep(dx: number, dtMs: number, pageWidth: number): -1 | 0 | 1;
```

#### `RETRY_DELAYS_MS` (const)

The wait before each retry; when they are spent, the image has failed.

```ts
const RETRY_DELAYS_MS: readonly number[];
```

#### `RetryTimers` (type)

The timers `watchImage` waits with; tests pass fakes.

```ts
type RetryTimers = {
    setTimeout(run: () => void, ms: number): ReturnType<typeof setTimeout>;
    clearTimeout(handle: ReturnType<typeof setTimeout> | undefined): void;
};
```

#### `retryUrl` (function)

The URL a retry asks for; attempt 0 is the first request, as given.

```ts
function retryUrl(src: string, attempt: number): string;
```

#### `RotateHint` (const)

The rotate hint (M4 spec §4.9, §7): over a game locked to one orientation (`GameSpec.orientation`) on a phone held
the other way. The runtime pauses the game while it shows (`Time.pause('display')`). Not interactive: turning the
phone is the only way past it, so nothing in it takes focus. The words follow FloorFifty `RotateHint.svelte` at
`ac72660`, which offers the same advice as a toast.

```ts
const RotateHint: import("svelte").Component<Props, {}, "">;
type RotateHint = ReturnType<typeof RotateHint>;
```

#### `RotateHintCopy` (interface)

The rotate hint's words.

```ts
interface RotateHintCopy {
    readonly title: string;
    readonly body: string;
}
```

#### `RotateToast` (const)

The rotate toast (Owner amendment to M4 spec §4.9, 2026-10-18; FloorFifty `RotateHint.svelte` at a28dc44): for a
game with `rotateHint: 'toast'`, a small message at the top on a phone held the other way, "Turn your phone for a
bigger view", with an OK. It covers nothing and pauses nothing; the only part a thumb can hit is the OK, at 44 px.

```ts
const RotateToast: import("svelte").Component<Props, {}, "">;
type RotateToast = ReturnType<typeof RotateToast>;
```

#### `RotateToastCopy` (interface)

The rotate toast's words (`rotateHint: 'toast'`, FloorFifty's): the advice, and its OK.

```ts
interface RotateToastCopy {
    readonly text: string;
    readonly ok: string;
    /** The OK's name for assistive technology: what it dismisses. */
    readonly dismiss: string;
}
```

#### `SAVE_STATUS_TONES` (const)

`conflict` points the player at the host's own question (M5 spec §5), so it is a warning, not an error.

```ts
const SAVE_STATUS_TONES: {
    readonly [State in SaveStatusState]: SaveStatusTone;
};
```

#### `SaveSlotActivity` (type)

A write the caller has started and not finished, or one that failed.

```ts
type SaveSlotActivity = 'writing' | 'failed';
```

#### `SaveSlots` (const)

The save slots (M5 spec §6, §7): a row for each slot, and the few things a player does with one. Rows are chosen,
not acted on: the chosen row (the newest slot that can be continued, to begin with) decides the actions in the bar
under the list. Continue for a slot that can be opened, New game for an empty one, and Delete… for any that holds
something. A save that cannot be opened, or that a newer build made, offers nothing but Delete…, so writing over
it takes two steps. Delete… asks first, in a dialog whose safe button has focus; the question says so when a newer
build made the save.
The rows are in a ScrollList, a declared scroll region, so on a short screen they scroll and the bar stays. A label
and a time wrap to two lines and are then cut, with the whole text left in the row for assistive technology.
Nothing here reads a store: the runtime's slots arrive as `view` and the player's choices leave as callbacks.

```ts
const SaveSlots: import("svelte").Component<Props, {}, "">;
type SaveSlots = ReturnType<typeof SaveSlots>;
```

#### `SaveSlotsCopy` (interface)

Every word the list shows, in the game's language (each a PRODUCT.L message key).

```ts
interface SaveSlotsCopy {
    /** The list's accessible name. */
    readonly title: string;
    readonly loading: string;
    /** "Slot 3": a slot with no label of its own. */
    readonly slot: (slot: number) => string;
    readonly empty: string;
    /** `unreadable`: "This save can't be opened". */
    readonly unreadable: string;
    /** `newer`: "Saved by a newer version of the game". */
    readonly newer: string;
    /** `other-content`: saved with other game content; its progress loads, its snapshot does not (M5-D5). */
    readonly otherContent: string;
    readonly writing: string;
    readonly failed: string;
    /** Continue the chosen slot. */
    readonly load: string;
    readonly newGame: string;
    /** The action that opens the question, with its ellipsis. */
    readonly delete: string;
    readonly deleteTitle: string;
    /** The question's text; `name` is the slot's label or its "Slot N". */
    readonly deleteBody: (name: string) => string;
    /** The question's text for a slot a newer build made. */
    readonly deleteNewerBody: string;
    /** The confirming button. */
    readonly deleteConfirm: string;
    /** The safe button, which takes focus. */
    readonly cancel: string;
    /** "+N more", for the rows below the fold. */
    readonly more: (count: number) => string;
}
```

#### `SaveSlotsView` (type)

What the list shows: a moment of loading, or the slots.

```ts
type SaveSlotsView = {
    readonly state: 'loading';
} | {
    readonly state: 'slots';
    readonly slots: readonly SaveSlotView[];
};
```

#### `SaveSlotView` (type)

One slot, as the list shows it. `savedAt` is a time in milliseconds, kept as the header says.

```ts
type SaveSlotView = {
    readonly kind: 'empty';
    readonly slot: number;
    readonly activity?: SaveSlotActivity;
} | {
    readonly kind: 'ready' | 'other-content';
    readonly slot: number;
    readonly savedAt: number;
    readonly label?: string;
    readonly activity?: SaveSlotActivity;
} | {
    readonly kind: 'unreadable';
    readonly slot: number;
    readonly activity?: SaveSlotActivity;
} | {
    readonly kind: 'newer';
    readonly slot: number;
    readonly activity?: SaveSlotActivity;
};
```

#### `SaveStatus` (const)

The host's save state in words (M5 spec §7): checking, syncing, saved, offline-queued, retry, conflict, recovered, and
"no grant" for a game that was not given the saves grant ("Progress won't be kept"). It is not focusable. The line is
a polite live region that stays mounted while the state changes, so a screen reader hears each change.
With no `status` (the standalone session, where nothing syncs) it renders nothing at all.
A state that asks for notice (good news or a problem) shows a glyph beside its words, hidden from assistive
technology, which has the words, so the tone never rests on colour alone.

```ts
const SaveStatus: import("svelte").Component<Props, {}, "">;
type SaveStatus = ReturnType<typeof SaveStatus>;
```

#### `SaveStatusCopy` (type)

One line per state, in the game's language (each a PRODUCT.L message key).

```ts
type SaveStatusCopy = {
    readonly [State in SaveStatusState]: string;
};
```

#### `SaveStatusState` (type)

What the host says about the player's saves, or that there is no grant.

```ts
type SaveStatusState = 'checking' | 'syncing' | 'saved' | 'offline-queued' | 'retry' | 'conflict' | 'recovered' | 'no-grant';
```

#### `SaveStatusTone` (type)

How much a state asks of the player's notice. `info` states are working; the others carry a glyph beside the words.

```ts
type SaveStatusTone = 'info' | 'success' | 'warning';
```

#### `ScreenFrame` (const)

Every screen's frame: the visible region, a corner row, then a hero and a body (M1.6 spec §3.4; from
FloorFifty `ui/layout/ScreenFrame.svelte` at 122a220).

It fills the visible region: the layout viewport less the insets the geometry owner publishes
(safe area and Ruken's reserved strip), ending above whatever the browser lays over the page's
foot (the keyboard). Its first row is the corner controls, in flow, so they never sit over the
content. Below that it arranges a hero and a body:
  stack: hero above body; the hero takes what the body leaves, so on a short screen the hero
         shrinks first and never pushes the body off the screen;
  split: hero and body side by side.
The screen root picks the arrangement from the form factor and height tier; nothing inside the
frame branches on either. The body is the `af-screen` size container its contents query.

```ts
const ScreenFrame: import("svelte").Component<Props, {}, "">;
type ScreenFrame = ReturnType<typeof ScreenFrame>;
```

#### `ScreenKind` (type)

A screen's kind (`ScreenDef.kind`): only `gameplay` may hide the pointer.

```ts
type ScreenKind = 'menu' | 'gameplay';
```

#### `ScrollList` (const)

A list that keeps its rows (M1.6 spec §3.4; from FloorFifty `ui/layout/ScrollList.svelte` at 122a220).

It reserves `min(minRows, rowCount)` rows of `--af-row-h` as its minimum height, so on a short
screen its siblings shrink before a row is lost. The reserve is capped at the height its parent
gives it: where even that cannot hold the rows (TV scale on a compact phone) the list keeps what
fits and scrolls the rest inside its own box, rather than painting over the controls below it. For that to work its parent must give it a
`1fr` grid row or `flex: 1 1 auto`, never `minmax(0, 1fr)`, which ignores an item's minimum.
Rows mark themselves `data-row`. It is a declared scroll region (`data-scroll-region`): the layout
contracts allow controls to be off screen only inside one.

```ts
const ScrollList: import("svelte").Component<Props, {}, "">;
type ScrollList = ReturnType<typeof ScrollList>;
```

#### `scrollWithin` (function)

Brings `element` into view by scrolling its nearest scroll box, never the document.

```ts
function scrollWithin(element: HTMLElement): void;
```

#### `sendBack` (function)

Sends Back as an Escape to wherever a dialog would hear it, and reports
whether anything took it. A tap on a dialog's backdrop leaves focus on the
body, where the dialog's own Escape listener never hears a key, so an open
dialog is sent it directly.

```ts
function sendBack(doc: Document): boolean;
```

#### `SettingsScreen` (const)

The core Settings screen (M4 spec §4.8, M4-D8), laid out and behaving as FloorFifty's settings
(`ui/components/SettingsPanel.svelte` in `PauseOverlay.svelte` at a28dc44; Owner 2026-10-18: "match the layout and
function, not the style"): a dialog over the dimmed game, the same frame as Paused, so going between them reads as
one dialog changing its view. Tabs stay put and the chosen tab's sections scroll under them in one list that counts
what is below; Back sits under the dialog, and Escape and the dialog's Close go back too. Where the dialog is 560 px
wide (it widens on a short band) the sections go two across. The default screens give it Display and Controls;
extensions add theirs to the Settings tab through the `settings.sections` slot. A kit's styled screen replaces it
by flow (PRODUCT.6).

```ts
const SettingsScreen: import("svelte").Component<Props, {}, "">;
type SettingsScreen = ReturnType<typeof SettingsScreen>;
```

#### `SettingsSection` (type)

A section of the Settings screen: the screen's own snippet, or an extension's slot component.

```ts
type SettingsSection = {
    readonly snippet: Snippet;
} | {
    readonly component: UiComponent;
};
```

#### `SettingsTab` (interface)

A tab of the Settings screen (FloorFifty's Settings and Controls): its label and its sections, in order.

```ts
interface SettingsTab {
    readonly id: string;
    readonly label: string;
    readonly sections: readonly SettingsSection[];
}
```

#### `SETTLE_DELAYS_MS` (const)

When to measure again after a viewport event, in ms. A browser's bars and keyboard animate,
and the event can fire before the sizes stop moving: on an Android emulator the keyboard closed,
the last event fired mid-animation, and the inset was left at the keyboard's height with no
further event to correct it (FloorFifty). Each re-measure is only a read and a style write.

```ts
const SETTLE_DELAYS_MS: readonly number[];
```

#### `Sheet` (const)

A Modal on the bottom edge at every form factor (M4 spec §4.12): the same scoping, Close and
scroll region, where a thumb reaches the actions. Settings' sub-pages and a "more" menu use it.

```ts
const Sheet: import("svelte").Component<ModalProps, {}, "">;
type Sheet = ReturnType<typeof Sheet>;
```

#### `SHORT_MAX_HEIGHT` (const)

At or below this many CSS px of layout height, a screen is short.

```ts
const SHORT_MAX_HEIGHT = 600;
```

#### `Sleeper` (type)

Puts the game's sound to sleep while nobody can see it.

Locking a phone left a game's music playing. A hidden page is the signal
every browser gives for that, a backgrounded tab and a switched-away app
alike; `pagehide` and `freeze` cover the browsers that pause a page without
reporting it hidden first. The render loop needs nothing here: browsers
already stop animation frames for a hidden page.

A window that only loses focus stays awake. The page is still in view --
a second monitor, a chat app over the corner -- and an online game goes on
whether the player is clicked into it or not, so its sound does too.

Waking and sleeping on Ruken's `lifecycle` belongs to the runtime, over
`Hosting` (M1.5); this module is the browser half only.

Every gesture also asks the sound to come back from an interruption the
page was never told about: a call or Siri on a phone suspends the graph
while the page stays visible, and only a gesture may resume it.

```ts
type Sleeper = {
    sleep(): Promise<void>;
    wake(): Promise<void>;
    /** Resumes a graph the system suspended; for example an `AudioContext` the system suspended. */
    resumeOnGesture?(): Promise<void>;
};
```

#### `sleepWhenHidden` (function)

Puts a game's sound to sleep while its page is hidden and wakes it when the page shows again; a pointer,
touch or key gesture also asks sound the system suspended to resume. A window that only loses focus stays
awake. Returns a function that removes the listeners.

```ts
function sleepWhenHidden(doc: Document, sleeper: Sleeper, win?: Window): () => void;
```

#### `Slider` (const)

A number in a range (M4 spec §4.12): a labelled native `<input type="range">`, so the browser
gives the arrow keys and the focus navigator's `adjust` steps it. `valueText` gives the value its
words for assistive technology (`aria-valuetext`), and the same words show beside the track. The
thumb is a 44 px target, checked by the layout contract.

```ts
const Slider: import("svelte").Component<Props, {}, "">;
type Slider = ReturnType<typeof Slider>;
```

#### `slotActionsOf` (function)

What a player may do with a slot (M5 spec §6). A slot that cannot be opened, or that a newer build made, can only be
deleted: writing over it is two steps, delete then New game, so it is never one tap.

```ts
function slotActionsOf(slot: SaveSlotView): {
    readonly load: boolean;
    readonly newGame: boolean;
    readonly remove: boolean;
};
```

#### `Split` (const)

Two panes side by side where both fit at `min` px, stacked otherwise (M4 spec §4.8; from FloorFifty
`ui/layout/Split.svelte` at `ac72660`). Measured, because a container query cannot read a prop; stacked
until the first measurement, so a pane never starts squeezed.

```ts
const Split: import("svelte").Component<Props, {}, "">;
type Split = ReturnType<typeof Split>;
```

#### `splitMode` (function)

Split's choice (M4 spec §4.8; from FloorFifty `ui/layout/split.ts` at `ac72660`): side by side when both
columns and the gap between them fit at their minimum, stacked otherwise.

```ts
function splitMode(available: number, min: number, gap: number): 'row' | 'stack';
```

#### `STICKY_MARGIN_PX` (const)

How far outside a button a thumb still counts for it, in CSS pixels.

```ts
const STICKY_MARGIN_PX = 24;
```

#### `StickyPointers` (class)

Which button each finger is on, over the latch. A finger owns one button at a time: moving onto another releases
the first and presses the second; moving onto nothing keeps what it owns.

```ts
class StickyPointers {
    private readonly latch;
    private readonly owned;
    constructor(latch: PointerLatch);
    /** A finger landed on `action` (or on nothing); true when it pressed a button. */
    down(pointerId: number, action: string | undefined): boolean;
    move(pointerId: number, action: string | undefined): void;
    up(pointerId: number): void;
    releaseAll(): void;
}
```

#### `suppressPageGestures` (function)

Turns off the browser's document gestures over the game.

A right-click menu, a long-press menu or an image dragged off the page
reminds a player they are on a web page, which breaks the illusion the
screen is drawn. Text selection is off in CSS (`theme.css`); these two are
events, so they are cancelled here.

Text fields are the exception. A name or code field keeps its menu, so
text can be pasted from a message.

```ts
function suppressPageGestures(doc: Document): () => void;
```

#### `SwipeIndicatorView` (interface)

What a SwipeSurface draws: the thumb, the anchor it trails and whether it is past the dead zone.

```ts
interface SwipeIndicatorView {
    readonly anchor: {
        readonly x: number;
        readonly y: number;
    };
    readonly thumb: {
        readonly x: number;
        readonly y: number;
    };
    readonly steering: boolean;
}
```

#### `SwipeSurface` (const)

The whole visible screen as one swipe surface (M4 spec §4.4), from FloorFifty `ui/components/SwipeSurface.svelte`
at `ac72660`.

All bookkeeping is the tracker's (runtime `SwipeTracker`); this forwards pointer events, each with its own
`timeStamp`, and draws a thin thumb-to-anchor line so the player can see the dead zone. Which fingers may steer
is the game's rule (`steers`); any finger may flick or tap. Controls a screen draws above this surface keep their
taps. Pointer only, never in the focus order.

```ts
const SwipeSurface: import("svelte").Component<SwipeSurfaceProps, {}, "">;
type SwipeSurface = ReturnType<typeof SwipeSurface>;
```

#### `SwipeSurfaceProps` (interface)

SwipeSurface's props.

```ts
interface SwipeSurfaceProps {
    tracker: PointerTracker;
    /** Whether a finger landing at (x, y) may steer; any finger may flick or tap. Default: every finger. */
    steers?: ((x: number, y: number) => boolean) | undefined;
    testId?: string | undefined;
}
```

#### `tabbables` (function)

Everything Tab can reach under `root`, in DOM order: not disabled, inert or hidden.

```ts
function tabbables(root: ParentNode): HTMLElement[];
```

#### `tileSide` (function)

A square tile's side for the space a grid is given: the width shared by the columns and the `peek` (a fraction
of a tile) of the next page showing at the edge, and the height only when the box has one. A grid laid in a
content-sized panel passes an infinite height, because a height measured from its own tiles would only ever
confirm the smallest tile. Clamped to `min`..`max`.

```ts
function tileSide(shape: GridShape, box: GridBox, gap: number, limits: {
    readonly peek: number;
    readonly min: number;
    readonly max: number;
}): number;
```

#### `Timers` (interface)

Injected so tests drive the settle delays with fake timers.

```ts
interface Timers {
    set(callback: () => void, ms: number): unknown;
    clear(handle: unknown): void;
}
```

#### `Toast` (const)

A passing message (M4 spec §4.12): "Pad connected", "Saved", "This controller is not supported".
The owner shows it and takes it away; Toast neither times itself nor takes focus, so a player
in the middle of a menu is never moved.

It is a polite live region (`role="status"`), and an error is an alert. Every tone but `info`
shows a glyph and says `toneLabel` to assistive technology, so the tone survives with every
colour removed (U-b); a toned toast without words throws while it mounts.

It sits above Ruken's strip, the safe area and the keyboard, through the geometry owner's inset
variables, and slides in unless the player asked for less movement.

```ts
const Toast: import("svelte").Component<Props, {}, "">;
type Toast = ReturnType<typeof Toast>;
```

#### `Toggle` (const)

An on/off setting (M4 spec §4.12): a native checkbox with the switch role, so the browser gives
Space and the focus navigator's `adjust` flips it. The state shows in words (`onLabel`,
`offLabel`) beside the track, never in colour alone.

Controlled, as OptionGroup is: a click reports the new state through `onchange`, and the box
shows the `checked` it is given.

```ts
const Toggle: import("svelte").Component<Props, {}, "">;
type Toggle = ReturnType<typeof Toggle>;
```

#### `TouchButtonSpec` (interface)

One on-screen touch button (M4 spec §4.4): the action it holds and what it shows.

```ts
interface TouchButtonSpec {
    /** The profile's action id; also the button's `data-testid`. */
    readonly action: string;
    /** The button's face. */
    readonly label: string;
    /** Its name for assistive technology, where the face is a symbol. Default: the label. */
    readonly ariaLabel?: string | undefined;
    /** Which lower corner's group it sits in. Default `start`. */
    readonly side?: 'start' | 'end' | undefined;
    /** The game cannot be played without it: where the buttons do not all fit, only these show (M4.7). */
    readonly required?: boolean | undefined;
}
```

#### `TouchControls` (const)

The on-screen touch buttons (M4 spec §4.4), from FloorFifty `ui/components/TouchControls.svelte` at `ac72660`.

This is the element that produces pointer events and nothing more; the multi-touch bookkeeping is
`touch-controls.ts`. Each side's group takes the pointers, not the buttons, and reaches `STICKY_MARGIN_PX` past
them with an invisible margin, so a near miss presses the nearest button and a held thumb can slide from one to
the next. The group captures the pointer, so the release always arrives, however far the thumb wanders.

Pointer only: the buttons are never in the focus order, since a keyboard or pad drives the same actions directly.
Hidden (not unmounted) while the player uses another device, so the screen never remounts; hiding or coming down
releases whatever is held.

```ts
const TouchControls: import("svelte").Component<TouchControlsProps, {}, "">;
type TouchControls = ReturnType<typeof TouchControls>;
```

#### `TouchControlsProps` (interface)

TouchControls' props.

```ts
interface TouchControlsProps {
    buttons: readonly TouchButtonSpec[];
    /** An action's first finger landed. */
    onhold: (action: string) => void;
    /** An action's last finger lifted, or the controls hid or came down while it was held. */
    onrelease: (action: string) => void;
    /** False hides the controls without remounting them (the player put touch down). Default true. */
    shown?: boolean | undefined;
    testId?: string | undefined;
}
```

#### `TouchCopy` (interface)

Every word the Touch controls group shows, in the game's language.

```ts
interface TouchCopy {
    readonly title: string;
    /** The mode choice's name. */
    readonly mode: string;
    readonly modes: Readonly<Record<ControlsTouchMode, string>>;
}
```

#### `TouchSection` (const)

The Touch controls group of the Settings tab (FloorFifty `SettingsPanel.svelte` at a28dc44): how touch drives play,
on-screen buttons or swipes, as an option group. The game shows it on a coarse pointer when it offers both modes.

```ts
const TouchSection: import("svelte").Component<Props, {}, "">;
type TouchSection = ReturnType<typeof TouchSection>;
```

#### `TouchTarget` (interface)

A button's action and where it is drawn, for `nearestTarget`.

```ts
interface TouchTarget {
    readonly action: string;
    readonly rect: {
        readonly left: number;
        readonly top: number;
        readonly right: number;
        readonly bottom: number;
    };
}
```

#### `trimRows` (function)

The shape cut to the rows the largest group fills, so no page carries a row of empty slots.

```ts
function trimRows<T>(shape: GridShape, groups: readonly PageGroup<T>[]): GridShape;
```

#### `UI_SLOT_NAMES` (const)

The named places an extension may add UI (M1 shared contracts §2; M1.6 spec §3.7).

Closed: an extension cannot add a slot. The screens that render each slot arrive with those
screens (title and pause in M1.5, settings and HUD in M4, the debug overlay in M6).

```ts
const UI_SLOT_NAMES: readonly ["title.actions", "pause.actions", "settings.sections", "hud.overlay", "debug.panels"];
```

#### `UiComponent` (type)

What an extension puts in a slot: a Svelte component that takes no props.

```ts
type UiComponent = Component<Record<string, never>>;
```

#### `UiSlotName` (type)

The name of a place an extension may add UI: one of `UI_SLOT_NAMES`.

```ts
type UiSlotName = (typeof UI_SLOT_NAMES)[number];
```

#### `VibrationCopy` (interface)

Every word the Vibration group shows, in the game's language.

```ts
interface VibrationCopy {
    readonly title: string;
    /** The toggle's name: a pad's rumble and a phone's buzz together. */
    readonly toggle: string;
    readonly on: string;
    readonly off: string;
}
```

#### `VibrationSection` (const)

The Vibration group of the Settings tab (Owner, 2026-10-18; FloorFifty's rumble row in `SettingsPanel.svelte` at
a28dc44): one toggle for a pad's rumble and a phone's buzz (`Haptics`). The game shows it only where the device can
do either (`Haptics.supported`), so it never offers a switch that does nothing.

```ts
const VibrationSection: import("svelte").Component<Props, {}, "">;
type VibrationSection = ReturnType<typeof VibrationSection>;
```

#### `ViewportWindow` (interface)

The parts of `window` the owner reads; a fake from `@mcthaydt/automata-testing` stands in for it in tests.

```ts
interface ViewportWindow {
    readonly innerWidth: number;
    readonly innerHeight: number;
    readonly visualViewport?: {
        readonly height: number;
        readonly offsetTop: number;
        addEventListener: Listen;
        removeEventListener: Listen;
    } | null | undefined;
    /** Read only where the browser needs its bar recognised (`browser/hidden-browser-bar.ts`). */
    readonly screen?: {
        readonly width: number;
        readonly height: number;
    } | undefined;
    readonly navigator?: object | undefined;
    addEventListener: Listen;
    removeEventListener: Listen;
}
```

#### `watchImage` (function)

Probes `src` and, while it fails, hands `onRetry` each retry's URL to draw
instead. Returns the stop.

```ts
function watchImage(src: string, onRetry: (url: string) => void, timers?: RetryTimers): () => void;
```

#### `WheelPager` (class)

A trackpad's horizontal wheel deltas, one page per gesture; `reset` when the gesture goes quiet.

```ts
class WheelPager {
    private travel;
    private spent;
    push(deltaX: number, deltaY: number): -1 | 0 | 1;
    reset(): void;
}
```

#### `withHostName` (function)

Fills the `{host}` slot of a copy string with the host's name. Copy without the slot is returned as is.

```ts
function withHostName(text: string, hostName: string): string;
```

#### `wrapPage` (function)

`index` wrapped into `0..count - 1`, so paging past either end comes round.

```ts
function wrapPage(index: number, count: number): number;
```

### `import { … } from '@mcthaydt/automata-ui/testing'`

#### `byTestId` (function)

The element a test id names; throws when the fixture has none, so a missing part fails loudly.

```ts
function byTestId(id: string): HTMLElement;
```

#### `checkLayout` (function)

The checks every screen shares: the document never scrolls; every control is at least the target
(primaries the primary target) at this scale, on screen unless in a declared scroll region,
never under a reserved area or a touch button and never over the corner row; the corner row's controls and any
`data-way-out` stay reachable (but under a modal dialog or an ErrorPanel that had to rise); no
ActionBar wraps (level 3); no row (`[data-row]`) clips what it holds; and each of `essentials`
is reachable without scrolling.

```ts
function checkLayout(conditions: Conditions, essentials: readonly Element[]): string[];
```

#### `Conditions` (interface)

The conditions a layout test runs under: the geometry published for a size and variant, and the regions
that cover the page (the keyboard, Ruken's strip), which nothing may sit under.

```ts
interface Conditions {
    readonly geometry: Geometry;
    /** What covers the page in this variant: the keyboard, Ruken's strip. Nothing may sit under it. */
    readonly reserved: LayoutRect[];
}
```

#### `errorPanelFloor` (function)

The least height any of an ErrorPanel's layouts needs, measured here rather than read from the
panel, so a panel that misjudges its room cannot excuse itself (spec §3.4, §7). For each layout
(`row`, `stack`, `row-tight`) it lays the panel out, keeps the layout only where its message is
readable there (20 characters or the whole panel, half that in `row-tight`, and clear of the
actions), and takes the panel's chrome, one message line and the actions as laid out. The
panel's own layout is put back after.

```ts
function errorPanelFloor(panel: HTMLElement): number;
```

#### `publishConditions` (function)

Measures and publishes the geometry for `size` under `variant`, as the owner would.

```ts
function publishConditions(root: HTMLElement, size: ReferenceSize, variant: Variant): Conditions;
```

#### `settleLayout` (function)

Waits until a freshly mounted fixture has finished laying out: fonts loaded, then two frames, so
ResizeObserver callbacks (ActionBar's collapse, ScrollList's measure) and the re-layout they
cause have run. A semantic wait, not a sleep.

```ts
function settleLayout(): Promise<void>;
```
