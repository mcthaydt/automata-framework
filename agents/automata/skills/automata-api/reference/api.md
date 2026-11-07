# Automata API reference, version 0.0.5

> Every export of every published `@automata/*` entry point at version 0.0.5, generated from the published `.d.ts` files. An export that is not listed here does not exist in this version.

## `@automata/content`

### `import { … } from '@automata/content'`

#### `AssetsSource` (interface)

What `content/assets.toml` says: for each screen, the files it waits for (`dir/*` names every file in a
folder), and the atlases and fonts of the asset build it uses, by their names in `atlases.toml` and
`fonts.toml`. A preloaded screen's atlas pages and font subsets join the preload list.

```ts
interface AssetsSource {
  readonly screens: Readonly<Record<string, {
    readonly files: readonly string[];
    /** Atlases named in `content/atlases.toml`: each page's Spritesheet JSON and image. */
    readonly atlases?: readonly string[] | undefined;
    /** Fonts named in `content/fonts.toml`: the subset of every language `fonts.json` lists. */
    readonly fonts?: readonly string[] | undefined;
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
must name every tunable; false for a partial override (a stage or mode layer).

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
  /** What the sim receives, and the hash that gates snapshots and replays. */
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
   * TOML, a translated one at its key in `messages/<lang>.json`. The glyph gate names a message by these.
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
  /** Compile the catalogs with Paraglide on each build. Absent: no Paraglide output. */
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
   * Whether the sim receives this kind. Default true: content is gameplay unless the game
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
  /** For each screen and event, the destinations that screen is prepared to enter. */
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
  /** Sorted by from, event, then to: declaration order means nothing. */
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

#### `GAME_ID_PATTERN` (const)

A game id and a board id: lower-case letters, digits and hyphens, starting with a letter or digit, up to 64.

```ts
const GAME_ID_PATTERN: RegExp;
```

#### `GameConfig` (interface)

What every target knows about a game.

```ts
interface GameConfig {
  readonly game: {
    readonly id: string;
    readonly title: string;
    readonly version: string;
    /** The entry page in the build. */
    readonly entry: string;
    /** The Ruken SDK's version range; the Ruken target requires it. */
    readonly sdk?: string;
  };
  readonly runtime: {
    readonly renderer: Renderer;
    readonly orientation: Orientation;
    readonly inputs: readonly Input[];
    readonly pause_behavior: "pause" | "continue";
  };
  /** The origins the game connects to; empty means it works offline. */
  readonly network: {
    readonly connect: readonly string[];
  };
  readonly content: {
    readonly languages: readonly string[];
    readonly rating: Rating;
    readonly estimated_hours?: number;
    readonly descriptors: readonly string[];
  };
  /** The analytics events the game may send (`Hosting.track` drops any other). */
  readonly analytics?: {
    readonly custom_events: readonly string[];
  };
  /** Files to load before the game starts, besides those the entry page names (the Ruken target). */
  readonly loading?: {
    readonly preload: readonly string[];
  };
  readonly leaderboards?: Readonly<Record<string, LeaderboardConfig>>;
}
```

#### `gameConfigSchema` (const)

Checks a game's config.

```ts
const gameConfigSchema: z.ZodType<GameConfig>;
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
  /** The sim partition and its hash, so a generator never re-derives it from `schemas`. */
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

#### `Input` (type)

One input a game can be played with.

```ts
type Input = (typeof INPUTS)[number];
```

#### `INPUTS` (const)

The inputs a game can be played with.

```ts
const INPUTS: readonly ["touch", "keyboard", "gamepad"];
```

#### `InvalidContentConfig` (class)

The game's code registered something unusable (a duplicate kind, a clashing generator).

```ts
class InvalidContentConfig extends InvalidConfigBase {}
```

#### `LEADERBOARD_ORDERS` (const)

The orders a score board sorts in.

```ts
const LEADERBOARD_ORDERS: readonly ["asc", "desc"];
```

#### `LeaderboardConfig` (interface)

A score board a game declares.

```ts
interface LeaderboardConfig {
  readonly order: (typeof LEADERBOARD_ORDERS)[number];
  readonly min: number;
  readonly max: number;
  readonly title?: string;
}
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

#### `Orientation` (type)

One orientation a game supports.

```ts
type Orientation = (typeof ORIENTATIONS)[number];
```

#### `ORIENTATIONS` (const)

The orientations a game supports.

```ts
const ORIENTATIONS: readonly ["landscape", "portrait", "any"];
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

What `preloadList` reads: the content options (to compile `game.toml` and `assets.toml`, and to find the asset
build's outputs below `outDir`) and the built game folder.

```ts
interface PreloadInput {
  readonly options: ContentOptions;
  /** The built game folder (Vite's `dist/`). */
  readonly distDir: string;
}
```

#### `preloadList` (const)

The files Ruken preloads before the game starts, in order, for `[loading] preload`: each `preload_screens`
screen's files from `assets.toml` (the flow's entry when none is named), then the pages of the atlases and
every language's subset of the fonts it names there, which `automata-content assets` wrote below `outDir`
and the build serves in `atlases/` and `fonts/`; without repeats. Empty without a `game.toml`. Fails with
`ContentCompileFailed` carrying a diagnostic for every file the build lacks (`missingAsset`), every atlas or
font not declared (`unknownReference`) or not built (`missingAsset`), all at once, or with
`InvalidContentConfig`.

```ts
const preloadList: (input: PreloadInput) => Effect.Effect<string[], ContentCompileFailed | InvalidContentConfig>;
```

#### `Rating` (type)

One content rating.

```ts
type Rating = (typeof RATINGS)[number];
```

#### `RATINGS` (const)

The content ratings a game declares.

```ts
const RATINGS: readonly ["everyone", "teen", "mature"];
```

#### `Renderer` (type)

One renderer a game may ask for.

```ts
type Renderer = (typeof RENDERERS)[number];
```

#### `RENDERERS` (const)

The renderers a game may ask for.

```ts
const RENDERERS: readonly ["webgl2", "webgl", "canvas2d", "wasm-webgl2"];
```

#### `renderTuningTable` (function)

Every tunable once, sorted by name, with its type, range and value in `content/tuning.toml`.

```ts
function renderTuningTable(meta: TuningMeta): string;
```

#### `RukenFields` (type)

The game config's `content` and `analytics` sections (Ruken's `[content]` and `[analytics]` tables), worked out
from `game.toml` and the languages present and written to `ruken-fields.json`.

```ts
type RukenFields = {
  readonly content: GameConfig["content"];
  readonly analytics: NonNullable<GameConfig["analytics"]>;
};
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

### `import { … } from '@automata/content/assets'`

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

### `import { … } from '@automata/content/game-config'`

#### `GAME_ID_PATTERN` (const)

A game id and a board id: lower-case letters, digits and hyphens, starting with a letter or digit, up to 64.

```ts
const GAME_ID_PATTERN: RegExp;
```

#### `GameConfig` (interface)

What every target knows about a game.

```ts
interface GameConfig {
  readonly game: {
    readonly id: string;
    readonly title: string;
    readonly version: string;
    /** The entry page in the build. */
    readonly entry: string;
    /** The Ruken SDK's version range; the Ruken target requires it. */
    readonly sdk?: string;
  };
  readonly runtime: {
    readonly renderer: Renderer;
    readonly orientation: Orientation;
    readonly inputs: readonly Input[];
    readonly pause_behavior: "pause" | "continue";
  };
  /** The origins the game connects to; empty means it works offline. */
  readonly network: {
    readonly connect: readonly string[];
  };
  readonly content: {
    readonly languages: readonly string[];
    readonly rating: Rating;
    readonly estimated_hours?: number;
    readonly descriptors: readonly string[];
  };
  /** The analytics events the game may send (`Hosting.track` drops any other). */
  readonly analytics?: {
    readonly custom_events: readonly string[];
  };
  /** Files to load before the game starts, besides those the entry page names (the Ruken target). */
  readonly loading?: {
    readonly preload: readonly string[];
  };
  readonly leaderboards?: Readonly<Record<string, LeaderboardConfig>>;
}
```

#### `gameConfigSchema` (const)

Checks a game's config.

```ts
const gameConfigSchema: z.ZodType<GameConfig>;
```

#### `Input` (type)

One input a game can be played with.

```ts
type Input = (typeof INPUTS)[number];
```

#### `INPUTS` (const)

The inputs a game can be played with.

```ts
const INPUTS: readonly ["touch", "keyboard", "gamepad"];
```

#### `LEADERBOARD_ORDERS` (const)

The orders a score board sorts in.

```ts
const LEADERBOARD_ORDERS: readonly ["asc", "desc"];
```

#### `LeaderboardConfig` (interface)

A score board a game declares.

```ts
interface LeaderboardConfig {
  readonly order: (typeof LEADERBOARD_ORDERS)[number];
  readonly min: number;
  readonly max: number;
  readonly title?: string;
}
```

#### `Orientation` (type)

One orientation a game supports.

```ts
type Orientation = (typeof ORIENTATIONS)[number];
```

#### `ORIENTATIONS` (const)

The orientations a game supports.

```ts
const ORIENTATIONS: readonly ["landscape", "portrait", "any"];
```

#### `Rating` (type)

One content rating.

```ts
type Rating = (typeof RATINGS)[number];
```

#### `RATINGS` (const)

The content ratings a game declares.

```ts
const RATINGS: readonly ["everyone", "teen", "mature"];
```

#### `Renderer` (type)

One renderer a game may ask for.

```ts
type Renderer = (typeof RENDERERS)[number];
```

#### `RENDERERS` (const)

The renderers a game may ask for.

```ts
const RENDERERS: readonly ["webgl2", "webgl", "canvas2d", "wasm-webgl2"];
```

### `import { … } from '@automata/content/level-2d'`

#### `checkEntityDef` (function)

Problems with an entity definition: its id and color, then each field's problems tagged with the field's id and
index, with a repeated field id reported at its later occurrence.

```ts
function checkEntityDef(def: EntityDef): readonly EntityDefProblem[];
```

#### `checkFieldDef` (function)

Problems with one field definition, in a stable order: id, misplaced properties, bounds, step, options, default.

```ts
function checkFieldDef(def: FieldDef): readonly FieldProblem<FieldDefCode>[];
```

#### `checkFieldValue` (function)

Whether `value` fits the field: `undefined` when it does, else the first problem. It checks the value's shape
and the field's own rules; whether a reference resolves is the editor's check.

```ts
function checkFieldValue(def: FieldDef, value: unknown): FieldValueProblem | undefined;
```

#### `ContentEntityDef` (type)

An entity definition in `project.toml`: a typed-field definition plus how the editor draws and places it.

```ts
type ContentEntityDef = EntityDef & {
  readonly shape: "rect" | "ellipse" | "point" | "tile";
  readonly size: ContentSize;
  readonly pivot: {
    readonly x: number;
    readonly y: number;
  };
  readonly resizable: "none" | "x" | "y" | "xy";
  readonly tile?: {
    readonly tileset: string;
    readonly index: number;
  } | undefined;
  readonly tags: readonly string[];
  readonly min?: {
    readonly per: "level" | "project";
    readonly count: number;
  } | undefined;
};
```

#### `ContentEntityItem` (interface)

One placed entity in a level: its definition, its position (and size when resizable) and its field values.

```ts
interface ContentEntityItem {
  readonly id: string;
  readonly def: string;
  readonly x: number;
  readonly y: number;
  readonly w?: number | undefined;
  readonly h?: number | undefined;
  readonly fields: FieldValues;
}
```

#### `ContentLevel` (interface)

A level as `levels/<id>.toml` holds it, after parsing the TOML.

```ts
interface ContentLevel {
  readonly format: "af2d-content";
  readonly version: 1;
  readonly id: string;
  readonly name: string;
  readonly size: ContentSize;
  readonly background: {
    readonly color: string;
    readonly image?: string | undefined;
    readonly mode: "fit" | "cover" | "repeat" | "repeat-x";
  };
  readonly fields: FieldValues;
  readonly layers: readonly ContentLevelLayer[];
}
```

#### `ContentLevelLayer` (type)

One layer of a level, by kind: tile rows, IntGrid rows, auto-tile stacks, entities or objects.

```ts
type ContentLevelLayer = {
  readonly def: string;
  readonly kind: "tiles";
  readonly rows: readonly string[];
} | {
  readonly def: string;
  readonly kind: "intgrid";
  readonly rows: readonly string[];
} | {
  readonly def: string;
  readonly kind: "auto";
  readonly stack: readonly ContentRows[];
} | {
  readonly def: string;
  readonly kind: "entities";
  readonly items: readonly ContentEntityItem[];
} | {
  readonly def: string;
  readonly kind: "objects";
  readonly items: readonly ContentObjectItem[];
};
```

#### `ContentNeighbours` (interface)

One level's neighbours in `world.toml`, each side ordered by position and then id. The editor computes them.

```ts
interface ContentNeighbours {
  readonly level: string;
  readonly north: readonly string[];
  readonly east: readonly string[];
  readonly south: readonly string[];
  readonly west: readonly string[];
}
```

#### `ContentObjectItem` (interface)

One placed tile object in an objects layer.

```ts
interface ContentObjectItem {
  readonly id: string;
  readonly tile: number;
  readonly x: number;
  readonly y: number;
  readonly flipX: boolean;
  readonly flipY: boolean;
}
```

#### `ContentProject` (interface)

The project as `project.toml` holds it: the layer, tileset and entity definitions every level uses.

```ts
interface ContentProject {
  readonly format: "af2d-content";
  readonly version: 1;
  readonly name: string;
  readonly template: string;
  readonly layers: readonly ContentProjectLayer[];
  readonly tilesets: readonly ContentTileset[];
  readonly entities: readonly ContentEntityDef[];
  readonly levelFields: readonly FieldDef[];
}
```

#### `ContentProjectLayer` (type)

A layer definition in `project.toml`, by kind.

```ts
type ContentProjectLayer = {
  readonly id: string;
  readonly kind: "tiles";
  readonly grid: number;
  readonly tileset: string;
} | {
  readonly id: string;
  readonly kind: "intgrid";
  readonly grid: number;
  readonly values: readonly {
    readonly value: number;
    readonly id: string;
  }[];
} | {
  readonly id: string;
  readonly kind: "auto";
  readonly grid: number;
  readonly source: string;
  readonly tileset: string;
} | {
  readonly id: string;
  readonly kind: "entities";
  readonly grid: number;
  readonly snap: boolean;
} | {
  readonly id: string;
  readonly kind: "objects";
  readonly tileset: string;
  readonly snap: number;
};
```

#### `ContentRows` (interface)

One stack entry of an auto layer: run-length row strings.

```ts
interface ContentRows {
  readonly rows: readonly string[];
}
```

#### `ContentSize` (interface)

A width and height in pixels.

```ts
interface ContentSize {
  readonly w: number;
  readonly h: number;
}
```

#### `ContentTileset` (interface)

A tileset in `project.toml`: its tile size, grid, optional image and tags.

```ts
interface ContentTileset {
  readonly id: string;
  readonly tile: ContentSize;
  readonly columns: number;
  readonly rows: number;
  readonly spacing: number;
  readonly padding: number;
  readonly image?: string | undefined;
  readonly placeholder: boolean;
  readonly tags: readonly {
    readonly tag: string;
    readonly tiles: readonly number[];
  }[];
}
```

#### `ContentWorld` (interface)

The worlds as `world.toml` holds them: layout, level placements and, for a grid world, each level's neighbours.

```ts
interface ContentWorld {
  readonly format: "af2d-content";
  readonly version: 1;
  readonly worlds: readonly {
    readonly id: string;
    readonly layout: "free" | "grid" | "horizontal" | "vertical";
    readonly grid?: ContentSize | undefined;
    readonly placements: readonly {
      readonly level: string;
      readonly x: number;
      readonly y: number;
      readonly depth: number;
    }[];
    /** Only in a `grid` world: for each level, the levels whose edge touches its own along a span of positive length. */
    readonly neighbours?: readonly ContentNeighbours[] | undefined;
  }[];
}
```

#### `defaultFieldValue` (function)

The value an instance gets when it has none: the field's `default`, else the type's zero (moved into a number's
bounds), else `[]` for a list. `undefined` for a required field, which has no stand-in, and for a ref until one
is picked.

```ts
function defaultFieldValue(def: FieldDef): FieldValue | undefined;
```

#### `entitiesOf` (function)

The items of an entities layer, in file order. Throws for a missing or other layer.

```ts
function entitiesOf(level: ContentLevel, layer: string): readonly ContentEntityItem[];
```

#### `ENTITY_ID` (const)

An entity definition id.

```ts
const ENTITY_ID: RegExp;
```

#### `EntityDef` (interface)

A thing a game places: an id, a label and the typed fields its instances carry.

```ts
interface EntityDef {
  readonly id: string;
  readonly label?: string | undefined;
  /** A token name or `#rrggbb`. */
  readonly color?: string | undefined;
  /** At most one instance per scope the editor names (2D: per level; 3D: per map). */
  readonly single?: boolean | undefined;
  readonly fields: readonly FieldDef[];
}
```

#### `EntityDefCode` (type)

The reasons `checkEntityDef` can refuse an entity definition.

```ts
type EntityDefCode = FieldDefCode | "badEntityId" | "badEntityColor" | "duplicateFieldId";
```

#### `EntityDefIssue` (interface)

One problem found in a parsed entity definition, with the path of the field at fault.

```ts
interface EntityDefIssue {
  readonly message: string;
  /** Mutable, so it can be handed to `ctx.addIssue` as it is. */
  readonly path: (string | number)[];
}
```

#### `entityDefIssues` (function)

The entity-level problems of a definition, for `superRefine`: its id and color, and a repeated field id at the later
field's path. A field's own problems are reported by `fieldDefSchema` at the field's path, so they are not repeated.

```ts
function entityDefIssues(def: EntityDef): readonly EntityDefIssue[];
```

#### `EntityDefProblem` (interface)

A problem with a definition; `fieldId` and `fieldIndex` (its place in `fields`) say which field when the problem is in one.

```ts
interface EntityDefProblem extends FieldProblem<EntityDefCode> {
  readonly fieldId?: string;
  readonly fieldIndex?: number;
}
```

#### `entityDefSchema` (const)

The schema of an entity definition: strict shape, then the rules `checkEntityDef` applies.

```ts
const entityDefSchema: z.ZodType<EntityDef>;
```

#### `entityDefShape` (const)

The keys of an entity definition, for an editor to extend (`z.strictObject({ ...entityDefShape, shape: … })`) so
its own entity schema never copies the kit's keys (`EntityDef2D = EntityDef & { shape, size, … }`).

```ts
const entityDefShape: {
  id: z.ZodString;
  label: z.ZodOptional<z.ZodString>;
  color: z.ZodOptional<z.ZodString>;
  single: z.ZodOptional<z.ZodBoolean>;
  fields: z.ZodArray<z.ZodType<FieldDef>>;
};
```

#### `FIELD_ID` (const)

A field id as an inspector shows it and a file stores it.

```ts
const FIELD_ID: RegExp;
```

#### `FIELD_TYPES` (const)

Every field type, in the order a picker lists them.

```ts
const FIELD_TYPES: readonly FieldType[];
```

#### `FieldDef` (interface)

The definition of one typed field: its id, type and the bounds, options or target its type needs.

```ts
interface FieldDef {
  readonly id: string;
  readonly type: FieldType;
  readonly label?: string | undefined;
  /** An ordered array of this type (a patrol path is a list of points). */
  readonly list?: boolean | undefined;
  /** No default stands in: an instance without a value is a `fieldMissing` problem. */
  readonly required?: boolean | undefined;
  readonly default?: FieldValue | undefined;
  /** `int` and `float`: inclusive bounds. */
  readonly min?: number | undefined;
  readonly max?: number | undefined;
  /** `int` and `float`: the stepper's increment (1 for an `int` without one). */
  readonly step?: number | undefined;
  /** `enum`: non-empty and unique. */
  readonly options?: readonly string[] | undefined;
  /** `text`: an editor shows a multi-line box. */
  readonly multiline?: boolean | undefined;
  /** `ref`: what it may point at, as names the editor defines (entity definition ids, `$level`, `$sector`); empty or absent means any. */
  readonly to?: readonly string[] | undefined;
}
```

#### `FieldDefCode` (type)

The reasons `checkFieldDef` can refuse a field definition.

```ts
type FieldDefCode = "badId" | "badBounds" | "badStep" | "noOptions" | "duplicateOption" | "badDefault" | "wrongTypeProperty";
```

#### `fieldDefSchema` (const)

The schema of a field definition: strict shape, then the rules `checkFieldDef` applies.

```ts
const fieldDefSchema: z.ZodType<FieldDef>;
```

#### `FieldProblem` (interface)

A problem with a field, with a stable `code` and a sentence to show.

```ts
interface FieldProblem<Code extends string = string> {
  readonly code: Code;
  readonly message: string;
}
```

#### `FieldType` (type)

The kind of value a field holds: int, float, bool, text, enum, color, angle, ref or point.

```ts
type FieldType = "int" | "float" | "bool" | "text" | "enum" | "color" | "angle" | "ref" | "point";
```

#### `FieldValue` (type)

A value a field can hold: a number, boolean, string, point, reference or a list of those.

```ts
type FieldValue = number | boolean | string | Point | RefValue | readonly FieldValue[];
```

#### `FieldValueCode` (type)

The reasons `checkFieldValue` can refuse a value.

```ts
type FieldValueCode = "wrongType" | "notInteger" | "belowMin" | "aboveMax" | "notAnOption" | "badColor" | "badRef" | "badPoint" | "badListItem";
```

#### `FieldValueProblem` (interface)

`badListItem` carries the index of the first bad item and that item's own problem as `cause`.

```ts
interface FieldValueProblem extends FieldProblem<FieldValueCode> {
  readonly index?: number;
  readonly cause?: FieldValueProblem;
}
```

#### `FieldValues` (type)

The values an instance holds, by field id.

```ts
type FieldValues = Readonly<Record<string, FieldValue>>;
```

#### `fieldValueSchema` (const)

Any well-formed value shape. Whether it fits a definition is `checkValues`, which knows the definition.

```ts
const fieldValueSchema: z.ZodType<FieldValue>;
```

#### `fieldValuesSchema` (const)

The schema of the values an instance holds, by field id.

```ts
const fieldValuesSchema: z.ZodType<FieldValues>;
```

#### `HEX_COLOR` (const)

A field's color value: `#rrggbb`, either case.

```ts
const HEX_COLOR: RegExp;
```

#### `InstanceCode` (type)

The reasons an instance's values can disagree with its definition.

```ts
type InstanceCode = FieldValueCode | "fieldMissing" | "unknownField";
```

#### `InstanceProblem` (interface)

A problem with one value of an instance, found by `checkValues`.

```ts
interface InstanceProblem extends FieldProblem<InstanceCode> {
  readonly fieldId: string;
  readonly index?: number;
  readonly cause?: FieldValueProblem;
}
```

#### `intGridRows` (function)

The cells of an IntGrid layer, one array of numbers per row (0 is empty). Throws for a missing or other layer.

```ts
function intGridRows(level: ContentLevel, layer: string): readonly (readonly number[])[];
```

#### `level2dKinds` (function)

The kinds `levels` (in the sim's content), `project` and `world` (outside it).

```ts
function level2dKinds(options?: Level2dKindsOptions): ContentSchemaDef[];
```

#### `Level2dKindsOptions` (interface)

Options for `level2dKinds`.

```ts
interface Level2dKindsOptions {
  /** Where the exported levels are, under `content/`. Default `levels`. */
  readonly folder?: string | undefined;
}
```

#### `levelContentSchema` (const)

The strict schema of `levels/<id>.toml`.

```ts
const levelContentSchema: z.ZodType<ContentLevel>;
```

#### `Point` (interface)

A position with `x` and `y`.

```ts
interface Point {
  readonly x: number;
  readonly y: number;
}
```

#### `projectContentSchema` (const)

The strict schema of `project.toml`.

```ts
const projectContentSchema: z.ZodType<ContentProject>;
```

#### `RefValue` (interface)

`target` and `container` are opaque to the kit: whether they resolve is the editor's check.

```ts
interface RefValue {
  readonly target: string;
  /** The level or sector that holds the target. */
  readonly container?: string | undefined;
}
```

#### `worldContentSchema` (const)

The strict schema of `world.toml`.

```ts
const worldContentSchema: z.ZodType<ContentWorld>;
```

### `import { … } from '@automata/content/locale'`

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

#### `endonymOf` (function)

A language's name in its own language ("日本語" for `ja`), from the browser's `Intl.DisplayNames`. An engine without
it, or a tag it cannot name, gives the tag back, so the picker never shows nothing.

```ts
function endonymOf(tag: string): string;
```

#### `hasRawText` (function)

True when a piece of visible text has English in it that did not come from the xx-long catalog: any ASCII
letter outside a ⟦ ⟧ span. Data a player typed (a name) is also "raw", so a check lists the data it expects.

```ts
function hasRawText(text: string): boolean;
```

#### `localeCharacters` (function)

A locale's own characters for its subset font: `ALWAYS_CHARACTERS` and the catalog's characters. The font build
also adds every content language's name for the language picker (`endonymOf`).

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

#### `MessageValue` (type)

A value in an inlang message file: a message, a list of variants, or a namespace or variant object.

```ts
type MessageValue = string | readonly MessageValue[] | {
  readonly [key: string]: MessageValue;
};
```

#### `PSEUDO_LOCALE` (const)

The pseudo-locale's tag. `Intl` reads it as the unknown language `xx`, so formatting falls back, never throws.

```ts
const PSEUDO_LOCALE = "xx-long";
```

#### `pseudoLocalize` (function)

The xx-long form of one message string. Placeholders and escaped braces stay as written. The extra length is
spread over the words in proportion to their length, each word's share right after it, so a long message keeps
the places a line can break, as a longer language's would; a message with no words has it at the end.

```ts
function pseudoLocalize(message: string): string;
```

#### `pseudoMessages` (function)

The xx-long form of a whole message file (the inlang message format): nested namespaces are walked, plural
variants keep their `declarations` and `selectors` (they are code, not text) and only their `match` texts
change. `$schema` is copied as is.

```ts
function pseudoMessages(file: {
  readonly [key: string]: MessageValue;
}): Record<string, MessageValue>;
```

#### `snakeKey` (function)

`snow-shrine` → `snow_shrine`, `fastFall` → `fast_fall`, `melee/sword` → `melee_sword`.

```ts
function snakeKey(value: string): string;
```

### `import { … } from '@automata/content/palette'`

#### `DEFAULT_PALETTE` (const)

The palette a game gets when it has no `content/palette.toml`: Endesga 64.

```ts
const DEFAULT_PALETTE: Palette;
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

### `import { … } from '@automata/content/schema'`

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
   * Whether the sim receives this kind. Default true: content is gameplay unless the game
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

#### `defineContentSchema` (function)

Registers a content kind: a name, its Zod schema, and a folder (every TOML file in it is an item) or one
file (a single document). The sim receives the kind unless `{ sim: false }`. A bad registration (a name
that does not start with a lower-case letter followed by lower-case letters, digits and dashes, a built-in
name, a duplicate, or a place two kinds share) is reported when content compiles, as `InvalidContentConfig`.

```ts
function defineContentSchema<const K extends string, S extends z.ZodType>(kind: K, schema: S, place: ContentSchemaPlace, options?: ContentSchemaOptions): ContentSchemaDef<K, S>;
```

#### `localized` (function)

Text a player reads, written in the source language. It gets a message key for translators.

```ts
function localized(): z.ZodType<string, string>;
```

### `import { … } from '@automata/content/vite'`

#### `automataContent` (function)

The Vite plugin that compiles content and serves it as `virtual:automata/content`. It builds when Vite
starts and on every save in dev, with the same build as `automata-content build`. A `vite build` with
content errors fails; a dev server keeps serving the last good content and reports the diagnostics through
Vite's logger and the `automata:content-error` event (`automata:content` after a good save). It also sets
`build.assetsInlineLimit: 0` when the game's config leaves it unset, so no asset becomes a `data:` URL that Ruken's
CSP refuses to fetch.

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

## `@automata/framework`

### `import { … } from '@automata/framework'`

#### `ActionBar` (const)

One row of actions that collapses as its container narrows.

It gives way in a fixed order as its container narrows (`collapseLevel`): utilities to their icon,
then secondaries to their short label, and only then a wrap with the primary on its own row.
Three hidden, inert copies of the row ([data-measure]) report how wide it would be at each level,
so the choice is measured rather than guessed from breakpoints.

```ts
const ActionBar: import("svelte").Component<Props, {}, "">;
type ActionBar = ReturnType<typeof ActionBar>;
```

#### `ActionKind` (type)

The action bar's model.

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

#### `actionsForKey` (function)

Every action `code` (a `KeyboardEvent.code`) drives in `profile`; none when it is unbound.

```ts
function actionsForKey(profile: InputProfile, code: string): string[];
```

#### `actionsForPadButton` (function)

Every action the standard-mapping pad button `index` drives in `profile`; none when it is unbound.

```ts
function actionsForPadButton(profile: InputProfile, index: number): string[];
```

#### `AnalogOptions` (interface)

The `analog` option of `keys()`.

```ts
interface AnalogOptions<Z extends z.ZodType> {
    /**
     * Per tick: what the sticks and the drag add to the held keys' payload, merged over it and parsed by the
     * command's schema. The held payload is passed in so a game can sum a key term and a stick term. When the schema
     * refuses the merge (a `NaN`, a float in an integer field), the held payload is sent alone.
     */
    read(reading: AnalogReading, held: z.output<Z>): Partial<z.input<Z>>;
    /** Bind the `camera-drag` gesture: the play screen mounts the drag surface. */
    readonly drag?: boolean;
    /** Show the touch stick; its vector is `stick('left')`. */
    readonly touchStick?: boolean;
}
```

#### `AnalogReading` (interface)

The analog input at one fixed step, read once after `Input.poll()`.

```ts
interface AnalogReading {
    /** The active pad's stick, or the touch stick, as integers −127..127. */
    stick(side: 'left' | 'right'): {
        readonly x: number;
        readonly y: number;
    };
    /** CSS px dragged to the right since the previous tick; 0 unless the map binds the camera drag. */
    cameraDrag(): number;
    /** The player's camera settings. */
    readonly camera: CameraSettings;
}
```

#### `AnalyticsProps` (type)

The properties of one analytics event: flat names to strings, numbers or booleans.

```ts
type AnalyticsProps = Record<string, string | number | boolean>;
```

#### `AppLoop` (interface)

The frame loop service: `run` steps a sim at its fixed tick rate from display frames, with the commands for each
tick, and the renderer draws every frame. No step runs while `Time` is paused; a throw from a step stops it.

```ts
interface AppLoop {
    run(options: {
        sim: Sim;
        commands: (tick: number) => readonly Command[];
    }): void;
    stop(): void;
    readonly running: boolean;
}
```

#### `Audio` (interface)

The audio service: one-shot sounds and looping music on the audio buses, unlocked by the
first gesture after `session.ready`; the game runs silent when no audio context can be built.

```ts
interface Audio {
    /** False until the first gesture after `session.ready` builds and resumes the graph. */
    readonly unlocked: Subscribable<boolean>;
    /** False once a context could not be built (`audio.unavailable`): the game runs silent, and Settings says so. */
    readonly available: Subscribable<boolean>;
    /** Plays the asset at `alias` once. Fire and forget: silent before the unlock, while asleep, or if it fails. */
    sound(alias: string, options?: SoundOptions): void;
    /**
     * Loops the asset at `alias` on the music bus. Asked for before the unlock, it starts on the unlock (and answers at
     * once). A file that is missing or is not audio is an answer, not a throw: the game plays on without that music.
     */
    music(alias: string, options?: MusicOptions): Promise<Result<void, AudioDecodeFailed | AssetLoadFailed>>;
    /** Fades the music out over `fadeSeconds`, a click-free cut by default. */
    stopMusic(fadeSeconds?: number): void;
    /** Takes `bus` down by `amount` (0..1) for `seconds`; `master` ducks every bus. */
    duck(bus: AudioBusName, amount: number, seconds: number): void;
    /** The player's mute: the master only, so unmuting restores the mix as it was. */
    setMuted(muted: boolean): void;
    /**
     * A short tone on `bus`, as the volume sliders play on release, so the player hears the level
     * they set. The graph makes it: no game asset. Silent before the unlock, as every sound is.
     */
    sample(bus: AudioBusName): void;
    /** The player's "mute when in the background": silences the master while another window has focus. */
    setMuteUnfocused(muteUnfocused: boolean): void;
}
```

#### `AUDIO_BUS_NAMES` (const)

The core audio buses: `master` carries the other four, `voice` is announcers and dialogue. Every change to
the set is an API change.

```ts
const AUDIO_BUS_NAMES: readonly ['master', 'music', 'sfx', 'ui', 'voice'];
```

#### `AudioBuses` (interface)

The audio-bus seam. Core audio implements it over Web Audio (a gain node per bus
into `master`, combined there with `Hosting.audio`'s volume and focus); an extension such as Plus
`audio-stream`, or the game, connects its sources to `input(bus)` and never to the destination directly,
so the player's gains and the host's ducking always apply.

```ts
interface AudioBuses {
    /** The node a source connects to so that it plays on `bus`. */
    input(bus: AudioBusName): AudioNode;
    /** The player's current gain for `bus`, 0..1. */
    gain(bus: AudioBusName): number;
    /** Sets the player's gain for `bus`, 0..1. Persisting it is the game's settings' job. */
    setGain(bus: AudioBusName, gain: number): void;
}
```

#### `audioBusGainsSchema` (const)

Validates saved bus gains; a bus left out is at full gain. A gain outside 0..1 fails the parse rather than
being clamped, so `SettingsDef`'s fallback to defaults (runtime `readSettings`) applies to a bad record.

```ts
const audioBusGainsSchema: z.ZodType<AudioBusGains, Partial<Record<AudioBusName, number | undefined>>>;
```

#### `AudioChange` (interface)

The host's audio state: focus (an ad or overlay may duck or mute the game), the master volume, and the gain.

```ts
interface AudioChange {
    focus: {
        state: 'full' | 'ducked' | 'muted';
        reason: 'ad' | 'hidden' | 'host-overlay' | 'system';
    };
    master: {
        volume: number;
        muted: boolean;
    };
    /** 0..1: multiply the game's own mix by this. */
    gain: number;
}
```

#### `AudioChangeSchema` (const)

Checks an audio change.

```ts
const AudioChangeSchema: z.ZodType<AudioChange>;
```

#### `AutosavePolicy` (interface)

When the loaded slot writes itself: on each listed trigger, with `intervalSeconds` for the `interval`
timer.

```ts
interface AutosavePolicy {
    readonly on: readonly AutosaveTrigger[];
    /** Seconds between timer writes, default 60. Read only when `interval` is in `on`. */
    readonly intervalSeconds?: number;
}
```

#### `AutosaveTrigger` (type)

What can make the loaded slot write itself.

```ts
type AutosaveTrigger = 'screen-exit' | 'round-end' | 'background' | 'interval';
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

#### `BootFailurePanel` (const)

The state a boot failure draws: an ErrorPanel with the
failure's copy and its ways forward. The runtime passes its `BootError` and the handlers; this
component decides nothing beyond `bootFailureView`.

```ts
const BootFailurePanel: import("svelte").Component<Props, {}, "">;
type BootFailurePanel = ReturnType<typeof BootFailurePanel>;
```

#### `Button` (const)

The framework's button: an `.af-control` of one kind. A primary carries
`data-kind="primary"`, which both sizes it to the 48 px primary target and tells the layout check
to hold it to that size. The words are the caller's, in the game's language.

```ts
const Button: import("svelte").Component<Props, {}, "">;
type Button = ReturnType<typeof Button>;
```

#### `Camera2d` (interface)

A presentation-only 2D camera over one container: it follows a target, shakes, and writes only that
container's transform, never a sim value.

```ts
interface Camera2d {
    /** The world point to follow. The first call snaps to it. */
    target(x: number, y: number): void;
    /** Adds trauma, 0..1 (capped at 1); it decays over time. */
    shake(trauma: number): void;
    /** Advances one display frame and writes the transform to the container. */
    update(frameSeconds: number): void;
    readonly transform: {
        readonly x: number;
        readonly y: number;
        readonly scale: number;
    };
}
```

#### `Camera2dOptions` (interface)

How `createCamera2d` frames the world: the view's size, and optionally a follow, bounds and zoom.

```ts
interface Camera2dOptions {
    /** The playfield's logical size: the area the camera shows at zoom 1. */
    readonly view: {
        readonly width: number;
        readonly height: number;
    };
    /** Approach the target at `rate` per second; a dead zone, centred on the view, the target may move in freely. */
    readonly follow?: {
        readonly rate: number;
        readonly deadZone?: {
            readonly width: number;
            readonly height: number;
        };
    };
    /** The world rect the view never shows outside of. */
    readonly bounds?: CameraRect;
    /** Default 1; above 1 shows less of the world. */
    readonly zoom?: number;
    /** Default: the player's `prefers-reduced-motion`, read every frame. */
    readonly reducedMotion?: () => boolean;
}
```

#### `CameraDragSurface` (const)

The camera drag surface: the player turns the camera by dragging the scene,
a finger anywhere outside the controls or the mouse with its secondary button.

All the rules of who drags are the tracker's (runtime `CameraDragTracker`); this forwards pointer events with their
`clientX`. It is a fixed layer drawn under the play screen's controls, so a contact on a touch button, the stick,
the corner controls or an ActionBar never reaches it, and its box stops short of the host's reserved strip and of
what the browser lays over the page's foot, so a drag never starts inside `hostReserved`. Pointer only, never in
the focus order.

```ts
const CameraDragSurface: import("svelte").Component<CameraDragSurfaceProps, {}, "">;
type CameraDragSurface = ReturnType<typeof CameraDragSurface>;
```

#### `CameraRect` (interface)

A world-space rectangle, in logical px: `Camera2dOptions.bounds`.

```ts
interface CameraRect {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}
```

#### `CAPABILITIES` (const)

What a game may ask its host for. The names are Ruken's (`@ruken/protocol` `CAPABILITIES`),
kept where they fit; `ruken/conformance.test.ts` holds them to the vendored SDK. Each target's adapter says
which it grants.

```ts
const CAPABILITIES: readonly ["lifecycle", "input", "display", "audio", "exit", "menu", "saves", "leaderboards", "entitlements", "store", "ads", "telemetry", "analytics.custom", "links"];
```

#### `Capability` (type)

One capability a game may ask for.

```ts
type Capability = (typeof CAPABILITIES)[number];
```

#### `CapabilitySchema` (const)

Checks a capability name.

```ts
const CapabilitySchema: z.ZodType<Capability>;
```

#### `ChangedElsewhereCopy` (interface)

The words of the choice paused offers once another device has changed the slot being played.

```ts
interface ChangedElsewhereCopy {
    readonly message: string;
    readonly loadNewer: string;
    readonly keepPlaying: string;
    /** Load newer was chosen and the other device's progress could not be used; this game goes on as it was. */
    readonly failed: string;
}
```

#### `Chip` (const)

A short status label. Its tone is `data-tone` and an edge colour, and never only
that: every tone but `info` also shows a glyph a sighted player reads and says `toneLabel` to
assistive technology, so the tone survives with every colour removed. A warning or danger chip
without words throws while it mounts.

```ts
const Chip: import("svelte").Component<Props, {}, "">;
type Chip = ReturnType<typeof Chip>;
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

#### `Clock` (interface)

Time as the runtime reads it: `now()` and timeouts. Tests hand over `fakeClock()` and move it by hand.

```ts
interface Clock {
    /** Milliseconds; only differences between two calls mean anything. */
    now(): number;
    setTimeout(callback: () => void, ms: number): TimeoutHandle;
    clearTimeout(handle: TimeoutHandle): void;
}
```

#### `Command` (interface)

Input to the sim, the only way gameplay state changes from outside. `source` is a player slot (u8), `seq` a per-source counter (u32).

```ts
interface Command {
  readonly tick: number
  readonly source: number
  readonly seq: number
  readonly type: string
  readonly payload: unknown
}
```

#### `CommandDef` (interface)

A command the sim accepts as input: an id and the Zod schema its payload must match. Create one with
`defineCommand`.

```ts
interface CommandDef<Z extends z.ZodType = z.ZodType> {
  readonly kind: 'command'
  readonly id: string
  readonly schema: Z
}
```

#### `CompiledContentData` (interface)

The compiled JSON content read by the runtime.

```ts
interface CompiledContentData {
    readonly flow: FlowGraph;
    readonly assets?: AssetsSource | undefined;
    readonly game?: GameSource | undefined;
    readonly [key: string]: unknown;
}
```

#### `ComponentDef` (interface)

A component: a stable id and a flat record of typed fields. Create one with `defineComponent`; game code
addresses entity data through the definition, never through `trait`.

```ts
interface ComponentDef<S extends FieldSchema = FieldSchema> {
  readonly kind: 'component'
  readonly id: string
  readonly fields: S
  /** Field names in sorted order: the order used by snapshots. */
  readonly fieldNames: readonly string[]
  /** Included in RenderDelta rows (default true). */
  readonly render: boolean
  /** Internal Koota storage. Game code never touches it. */
  readonly trait: Trait
}
```

#### `contentHashOf` (function)

The content hash formula: hex64(xxhash64(utf8(canonicalJson(data)))).
Matches `@automata/content`'s contentHash formula, pinned by tests.

```ts
function contentHashOf(data: unknown): string;
```

#### `CORE_SETTINGS` (const)

The `settings` save, version 1: the player's bindings (`input`), graphics quality (`display`), audio (`audio`),
vibration (`haptics`) and camera turn (`camera`).

```ts
const CORE_SETTINGS: SettingsDef<CoreSettings>;
```

#### `CoreSettings` (interface)

The settings every game carries: input bindings, display, audio and vibration.

```ts
interface CoreSettings {
    readonly input: InputSettings;
    readonly display: DisplaySettings;
    /** The Audio group's choices; a record saved before it reads them as the defaults. */
    readonly audio: AudioSettings;
    /** The Vibration group's toggle (Owner, 2026-10-18); a record saved before it reads it as on. */
    readonly haptics: HapticsSettings;
    /** "Camera turn speed" and "Invert camera"; a record saved before them reads them as the defaults. */
    readonly camera: CameraSettings;
}
```

#### `createCamera2d` (function)

A camera writing `stage`'s transform (usually `PixiStage.world`). `seed` fixes the shake's random sequence,
so a shake looks the same in every run and visual test.

```ts
function createCamera2d(stage: Container, options: Camera2dOptions, seed?: number): Camera2d;
```

#### `createGeometryOwner` (function)

Creates the geometry owner of a document, the only writer of its geometry: make one per document. It measures
at once, on every resize of the window or the visual viewport, and again at 100, 400 and 1000 ms as bars and
the keyboard settle, and publishes each measure on the root.

```ts
function createGeometryOwner(options: GeometryOwnerOptions): GeometryOwner;
```

#### `createPixiRenderer` (function)

The core 2D renderer (ADR 0002) as a runtime `RendererFactory`: a letterboxed Pixi app on the render
target, entity views from each step's render delta, interpolated each frame. Answers `RendererUnavailable`
when the renderer cannot start; `dispose` destroys the app and removes its canvas.

```ts
function createPixiRenderer(options?: PixiRendererOptions): (target: RenderTarget) => Promise<Result<PixiRenderer, RendererUnavailable>>;
```

#### `createPostFilterSlot` (function)

A post-filter slot writing its composed filters to `target`'s `filters`.

```ts
function createPostFilterSlot(target: PostFilterTarget): PostFilterSlot;
```

#### `createT` (function)

`t` over a messages module (`import * as m from './paraglide/messages.js'`). Each call reads the current
locale, so a screen that calls `t` again after `'locale.changed'` shows the new language without a remount.
An unknown key throws, naming it: the types already forbid it, so it means the catalog and the code drifted.

```ts
function createT<Messages extends Record<string, unknown>>(messages: Messages): Translate<Messages>;
```

#### `defaultContent` (function)

The default flow `title → play ⇄ paused → title`, with `paused ⇄ settings`, and its hash.

```ts
function defaultContent(): GameContent;
```

#### `defaultScreens` (function)

The title, play, paused and settings screens over the default content's flow
(`title → play ⇄ paused → title`, `paused ⇄ settings`).

The screens share one sim: play creates it on first entry (seed, plugins, content, then `setup`),
paused keeps it, and the title drops it, so Quit to title and Play start again at tick 0. A runtime that shuts
down with the sim alive drops it too, whichever screen is current. Returning
from paused re-sends the whole state to the renderer (G-5): `AppLoop.run` resets the renderer, so
play restores the sim's own snapshot, which makes the next step a resync.

```ts
function defaultScreens(game: ScreensGame): ScreenDef[];
```

#### `defineCommand` (function)

Defines a command by id and payload schema. Throws for an id that is not lower-case words separated by dots
or dashes.

```ts
function defineCommand<Z extends z.ZodType>(id: string, schema: Z): CommandDef<Z> {
  checkId('command', id)
  return { kind: 'command', id, schema }
}
```

#### `defineComponent` (function)

Defines a component from an id (lower-case words separated by dots or dashes) and its fields by name and
type. `render: false` keeps it out of the renderer's deltas. Throws for a bad id, no fields, a bad field
name or an unknown field type.

```ts
function defineComponent<S extends FieldSchema>(
  id: string,
  fields: S,
  opts: { render?: boolean } = {},
): ComponentDef<S> {
  checkId('component', id)
  const fieldNames = sortedKeys(fields)
  if (fieldNames.length === 0) throw new Error(`component "${id}" needs at least one field`)
  const defaults: Record<string, number | boolean | string> = {}
  for (const name of fieldNames) {
    const type = fields[name] as FieldType
    if (!FIELD_RE.test(name)) throw new Error(`component "${id}" has invalid field name "${name}"`)
    if (!FIELD_TYPES.includes(type))
      throw new Error(`component "${id}" field "${name}" has unknown field type "${type}"`)
    defaults[name] = defaultField(type)
  }
  // A factory, not a schema object: Koota builds structure-of-arrays accessors for a schema object with
  // `new Function`, which Ruken's CSP (no 'unsafe-eval') blocks. Each entity holds its own record instead
  // (array-of-structures); the entity store always writes whole records, so nothing else changes.
  const traitDef = trait(() => ({ ...defaults }))
  return { kind: 'component', id, fields, fieldNames, render: opts.render ?? true, trait: traitDef }
}
```

#### `DefinedGame` (interface)

The runtime's `GameDefinition`, plus what the screens and the golden replay read from the spec.

```ts
interface DefinedGame<S = never> extends GameDefinition<S> {
    readonly id: string;
    readonly title: string;
    readonly size: {
        readonly width: number;
        readonly height: number;
    };
    readonly input?: InputMap | undefined;
    readonly sim: {
        readonly plugins: readonly PluginDef[];
        readonly seed: number;
        readonly setup?: ((sim: Sim) => void) | undefined;
        readonly content?: unknown;
    };
}
```

#### `defineEvent` (function)

Defines an event by id and payload schema, to emit from a system with `ctx.emit`. Events come back in
`StepResult.events`; `ctx.emit` throws for a payload that fails the schema.

```ts
function defineEvent<Z extends z.ZodType>(id: string, schema: Z): EventDef<Z> {
  checkId('event', id)
  return { kind: 'event', id, schema }
}
```

#### `defineGame` (function)

Checks a spec and fills in every default over the runtime, the Pixi renderer, Ruken hosting and the default
screens; `startGame` boots the result. Pure: it reads no document, so a game module also loads in Node.
Throws `BootDefect` (its cause a `GameSpecError`) for an invalid spec.

```ts
function defineGame<S = never, D = unknown>(spec: GameSpec<S, D>): DefinedGame<S>;
```

#### `definePlugin` (function)

Defines a plugin from a name, its dependencies and its definitions, given in the keyed lists or in one flat
`defs` list sorted by kind. A plugin written either way registers the same lists and gets the same schema
hash. `config` is copied as canonical, frozen JSON, so anything that cannot hash exactly throws a
`CanonicalJsonError` here.

```ts
function definePlugin(spec: {
  name: string
  dependsOn?: readonly string[]
  /** One flat list, sorted into the keyed lists by `kind`; each entry follows that list's keyed entries. */
  defs?: readonly Def[]
  components?: readonly ComponentDef[]
  commands?: readonly CommandDef[]
  events?: readonly EventDef[]
  resources?: readonly ResourceDef[]
  systems?: readonly SystemDef[]
  state?: (setup: PluginStateSetup) => Promise<PluginState>
  config?: unknown
}): PluginDef {
  checkId('plugin', spec.name)
  // A canonical, frozen copy: it throws CanonicalJsonError for anything that cannot hash exactly, and nobody
  // can change it after it joins the schema hash.
  const config = spec.config === undefined ? undefined : deepFreeze(JSON.parse(canonicalJson(spec.config)))
  // Keyed entries first, then `defs` in order, so a plugin written either way registers the same lists in the
  // same order and gets the same schema hash. Duplicates are left for createSim to reject, as they are today.
  const components = [...(spec.components ?? [])]
  const commands = [...(spec.commands ?? [])]
  const events = [...(spec.events ?? [])]
  const resources = [...(spec.resources ?? [])]
  const systems = [...(spec.systems ?? [])]
  for (const def of spec.defs ?? []) {
    if (def.kind === 'component') components.push(def)
    else if (def.kind === 'command') commands.push(def)
    else if (def.kind === 'event') events.push(def)
    else if (def.kind === 'resource') resources.push(def)
    else if (def.kind === 'system') systems.push(def)
    else
      throw new Error(
        `plugin "${spec.name}" defs has an entry of unknown kind "${(def as { kind: unknown }).kind}"`,
      )
  }
  return {
    kind: 'plugin',
    name: spec.name,
    dependsOn: spec.dependsOn ?? [],
    components,
    commands,
    events,
    resources,
    systems,
    state: spec.state,
    config,
  }
}
```

#### `defineResource` (function)

Defines a resource by id, schema and starting value. `createSim` parses `init()` with the schema, so a bad
start fails there.

```ts
function defineResource<Z extends z.ZodType>(
  id: string,
  schema: Z,
  init: () => z.input<Z>,
): ResourceDef<Z> {
  checkId('resource', id)
  return { kind: 'resource', id, schema, init }
}
```

#### `defineSave` (function)

Declares a save. It checks nothing the SDK checks; it only gives the definition its type.

```ts
function defineSave<S>(def: SaveDef<S>): SaveDef<S>;
```

#### `defineSystem` (function)

A system: `defineSystem(name, run)` runs in `gameplay`, `defineSystem(name, phase, run)` in that phase, and the
object form also takes `before`/`after`. All three build the same SystemDef.

```ts
function defineSystem(name: string, run: (ctx: SimContext) => void): SystemDef
function defineSystem(name: string, phase: Phase, run: (ctx: SimContext) => void): SystemDef
function defineSystem(spec: SystemSpec): SystemDef
function defineSystem(
  nameOrSpec: string | SystemSpec,
  phaseOrRun?: Phase | ((ctx: SimContext) => void),
  run?: (ctx: SimContext) => void,
): SystemDef {
  if (typeof nameOrSpec !== 'string') return defineSystemFrom(nameOrSpec)
  if (typeof phaseOrRun === 'function')
    return defineSystemFrom({ name: nameOrSpec, phase: 'gameplay', run: phaseOrRun })
  return defineSystemFrom({
    name: nameOrSpec,
    phase: phaseOrRun as Phase,
    run: run as (ctx: SimContext) => void,
  })
}
```

#### `Dialog` (const)

A question that needs an answer before the screen goes on. The screen renders it only while it is open
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

#### `DisplayMetricsPayload` (interface)

The game's display: insets the game must keep clear, the area the host reserves for its own controls, and the
UI scale hint (1.333 on a TV: enlarge text and targets, never CSS zoom).

```ts
interface DisplayMetricsPayload {
    safeArea: {
        top: number;
        right: number;
        bottom: number;
        left: number;
    };
    hostReserved: {
        edge: 'right' | 'left';
        rect: {
            x: number;
            y: number;
            w: number;
            h: number;
        };
    };
    orientation: 'portrait' | 'landscape';
    fullscreen: boolean;
    scale: 1 | 1.333;
}
```

#### `DisplayMetricsPayloadSchema` (const)

Checks display metrics.

```ts
const DisplayMetricsPayloadSchema: z.ZodType<DisplayMetricsPayload>;
```

#### `Disposables` (interface)

A list of "undo this" functions, run together once: what a screen, a run or a service holds open.

```ts
interface Disposables {
    /**
     * Runs `undo` at disposal. Added after disposal it runs at once, so a late arrival is never leaked. Returns a
     * function that takes `undo` back out (a listener that was stopped by hand has nothing left to undo).
     */
    add(undo: () => void): () => void;
    /** Runs what was added, last added first, once. Later calls do nothing. */
    dispose(): void;
    readonly disposed: boolean;
}
```

#### `disposables` (function)

Makes an empty `Disposables`.

```ts
function disposables(): Disposables;
```

#### `DrawContext` (interface)

What `draw` receives each frame. Coordinates are logical playfield pixels (plan D-2).

```ts
interface DrawContext {
    /** The sim at this frame, read-only. */
    readonly sim: DrawSim;
    readonly frame: FrameInfo;
    /** The playfield's logical size. */
    readonly width: number;
    readonly height: number;
    rect(x: number, y: number, w: number, h: number, color: number): void;
    circle(x: number, y: number, radius: number, color: number): void;
    line(x1: number, y1: number, x2: number, y2: number, color: number, width?: number): void;
    /** One line of text, its top-left at (x, y). */
    text(value: string, x: number, y: number, options?: DrawTextOptions): void;
}
```

#### `DrawEntity` (interface)

One entity, read-only: its components' values are frozen copies.

```ts
interface DrawEntity {
    readonly sid: number;
    has(component: ComponentDef): boolean;
    get<S extends FieldSchema>(component: ComponentDef<S>): Readonly<FieldValues<S>>;
}
```

#### `DrawSim` (interface)

The sim at this frame, read-only.

```ts
interface DrawSim {
    readonly tick: number;
    query(...components: ComponentDef[]): DrawEntity[];
    entity(sid: number): DrawEntity | undefined;
    /** A deep-frozen copy of the resource's value. */
    resource<Z extends z.ZodType>(def: ResourceDef<Z>): z.output<Z>;
}
```

#### `DrawTextOptions` (interface)

Options for `DrawContext.text`: colour and font size.

```ts
interface DrawTextOptions {
    /** Default 0xffffff. */
    readonly color?: number | undefined;
    /** Font size in logical pixels. Default 8. */
    readonly size?: number | undefined;
}
```

#### `EntitlementsPayload` (interface)

What the player owns: whether ads show, permanent items and subscriptions, and whether this is a dev build.

```ts
interface EntitlementsPayload {
    ads: boolean;
    items: string[];
    subscriptions: SubscriptionEntitlement[];
    devBuild: boolean;
}
```

#### `EntitlementsPayloadSchema` (const)

Checks entitlements.

```ts
const EntitlementsPayloadSchema: z.ZodType<EntitlementsPayload>;
```

#### `EntityRef` (interface)

A live entity, addressed by its StableId. Writes are coerced per field type and mark the entity changed.

```ts
interface EntityRef {
  readonly sid: number
  has(component: ComponentDef): boolean
  get<S extends FieldSchema>(component: ComponentDef<S>): Readonly<FieldValues<S>>
  set<S extends FieldSchema>(component: ComponentDef<S>, values: Partial<FieldValues<S>>): void
  add<S extends FieldSchema>(component: ComponentDef<S>, values?: Partial<FieldValues<S>>): void
  remove(component: ComponentDef): void
}
```

#### `EntityView` (interface)

What an entity view factory returns: the container drawn for one entity, updated with its current and
previous component values and the interpolation alpha, and destroyed when the entity goes.

```ts
interface EntityView<C extends SceneNode = Container> {
    readonly container: C;
    update?(curr: Readonly<Record<string, Readonly<FieldRecord>>>, prev?: Readonly<Record<string, Readonly<FieldRecord>>> | undefined, alpha?: number): void;
    destroy?(): void;
}
```

#### `ERROR_CODES` (const)

Why a host call failed. The codes are Ruken's (`@ruken/protocol` `ERROR_CODES`), kept where they
fit; `ruken/conformance.test.ts` holds them to the vendored SDK.

```ts
const ERROR_CODES: readonly ["UNSUPPORTED", "NOT_READY", "TIMEOUT", "RATE_LIMITED", "QUOTA_EXCEEDED", "INVALID_PAYLOAD", "DENIED", "OFFLINE", "CANCELLED", "INTERNAL"];
```

#### `ErrorCode` (type)

One error code.

```ts
type ErrorCode = (typeof ERROR_CODES)[number];
```

#### `ErrorCodeSchema` (const)

Checks an error code.

```ts
const ErrorCodeSchema: z.ZodType<ErrorCode>;
```

#### `EventDef` (interface)

An event a system emits: an id and the Zod schema its payload must match. Create one with `defineEvent`.

```ts
interface EventDef<Z extends z.ZodType = z.ZodType> {
  readonly kind: 'event'
  readonly id: string
  readonly schema: Z
}
```

#### `filterPrograms` (function)

Builds a filter's programs from its GLSL and WGSL fragment stages on the shared vertex stages, so WebGL2
stays at parity with WebGPU (AGENTS.md).

```ts
function filterPrograms(name: string, fragmentGlsl: string, fragmentWgsl: string): FilterProgramsResult;
```

#### `findRukenSdkMarkers` (function)

The markers found in `code` (built JavaScript), each named once; empty means no Ruken SDK code.

```ts
function findRukenSdkMarkers(code: string): string[];
```

#### `findTauriMarkers` (function)

The Tauri markers found in `code` (built JavaScript), each named once; empty means no Tauri IPC code.

```ts
function findTauriMarkers(code: string): string[];
```

#### `Flow` (interface)

The screen flow service: the current screen, `dispatch` to follow an event's transition from it, `openMenu`
for the current screen's menu, and `settled()` once no transition is pending.

```ts
interface Flow {
    readonly current: string | undefined;
    dispatch(event: string): boolean;
    openMenu(): boolean;
    /** Resolves once no transition is queued or running (at once when the flow is idle). */
    settled(): Promise<void>;
}
```

#### `FormFactor` (type)

The four form factors.

Decided from the layout viewport's size alone. Whether the pointer is coarse is a different
question: it decides which controls mount, not how a screen is laid out. So a tablet with a
keyboard and a desktop with a touch screen both get the layout their shape asks for.

The one place the thresholds live. CSS reads the answer from `data-form-factor`, script from
the geometry owner, and neither re-derives it.

```ts
type FormFactor = 'phone-portrait' | 'phone-landscape' | 'tablet-portrait' | 'desktop';
```

#### `FrameInfo` (interface)

One display frame: the interpolation alpha between the last two ticks, the frame's length in ms, and
whether time is paused.

```ts
interface FrameInfo {
    alpha: number;
    frameMs: number;
    paused: boolean;
}
```

#### `FullscreenRes` (interface)

The answer to a fullscreen request: the new state, and how this device can go fullscreen at all.

```ts
interface FullscreenRes {
    fullscreen: boolean;
    support: 'element' | 'ios-home-screen' | 'none';
}
```

#### `FullscreenResSchema` (const)

Checks a fullscreen answer.

```ts
const FullscreenResSchema: z.ZodType<FullscreenRes>;
```

#### `GameCopy` (type)

A game's words: the runtime's boot and failure copy, and the default screens' words.

```ts
type GameCopy = NonNullable<GameDefinition['copy']> & {
    /** The default screens' words, over their English defaults: a part of `ScreensCopy`, or a function of the locale. */
    readonly screens?: ScreensCopyInput | undefined;
};
```

#### `GameDefinition` (interface)

Everything a game provides to the runtime to boot.

```ts
interface GameDefinition<S = never> {
    readonly root: HTMLElement;
    readonly hosting: Omit<HostingOptions, 'disclosedEvents'>;
    readonly content: {
        readonly data: CompiledContentData;
        readonly hash: string;
    };
    readonly screens: readonly ScreenDef[];
    /**
     * Files fetched with the preload screens' own (byte progress, the 30 s stall rule) before the renderer starts,
     * outside the content: a game without `content/` lists its 3D models here. They are not part of
     * `content.hash`, so a new origin or a rebuilt file never changes the hash saves are stamped with.
     */
    readonly preload?: readonly string[] | undefined;
    readonly renderer: RendererFactory;
    readonly settings?: SettingsDef<S> | undefined;
    /**
     * The game's save: its slots, autosave and migrations. Boot opens it, wires its triggers and flushes it when
     * the host closes the game; a screen reaches it with `saveOf(def)`. Absent, the game has no save and the runtime
     * reads and writes nothing for one.
     */
    readonly saves?: SaveDef<unknown> | undefined;
    /**
     * The orientation the game plays in, as the ship config's `runtime.orientation` says. A `portrait` or
     * `landscape` game on a phone held the other way pauses behind the rotate hint. Default `any`.
     */
    readonly orientation?: GameOrientation | undefined;
    /** How a locked orientation says so on a phone held the other way: `'block'` (the default) or `'toast'`. */
    readonly rotateHint?: RotateHintMode | undefined;
    /**
     * The game's languages: pass its Paraglide `runtime.js` (`import * as runtime from './paraglide/runtime.js'`).
     * Absent, the game has one locale, the content's `source_language`.
     */
    readonly locale?: LocaleDef | undefined;
    readonly extensions?: readonly ExtensionDef[] | undefined;
    /** The sound each sim event plays, by the event's type. */
    readonly sounds?: EventSounds | undefined;
    /** The board and score each sim event submits, by the event's type. Needs the `leaderboards` grant. */
    readonly scores?: EventScores | undefined;
    readonly copy?: Partial<BootFailureCopy> & {
        readonly loading?: string;
        readonly slow?: string;
        /** The panel when the renderer's graphics context is lost for good. */
        readonly contextLost?: string;
    };
    readonly seams?: RuntimeSeams;
}
```

#### `GameRenderer` (interface)

What the runtime asks of a renderer: apply each step's result, draw each frame, and reset for a new sim.

```ts
interface GameRenderer {
    apply(result: StepResult): void;
    draw(frame: FrameInfo): void;
    reset(): void;
}
```

#### `GameSaves` (interface)

What a game saves, and how the default screens read it from the sim and put it back. The title lists the
save's slots; New game writes the starting data, Continue loads a slot, and play keeps it saved while it runs, on
the triggers the `def` declares (autosave).

```ts
interface GameSaves<D> {
    readonly def: SaveDef<D>;
    /**
     * The data to keep, read from the live sim when a trigger writes, and for a new game from the sim at tick 0. It
     * only reads: it must not change the sim.
     */
    capture(sim: Sim): D;
    /** Puts a loaded slot's data into the freshly set-up sim, before tick 0. */
    apply(sim: Sim, data: D): void;
    /** The label a new game gives its slot on the list ("Run 2"). Default: none, and the list says "Slot N". */
    label?(slot: number): string;
}
```

#### `GameSpec` (interface)

A game in one object: its id, size and sim, and optionally its title, input, views, sounds,
scores, saves, content, screens, settings, extensions, draw layer and host and renderer options.
`defineGame` fills in every default.

```ts
interface GameSpec<S = never, D = unknown> {
    /** Ruken's game id (`[game].id`), checked with Ruken's own rule; it is `hosting.gameId`. */
    readonly id: string;
    /** Shown on the title screen. Default: the id. */
    readonly title?: string;
    /** The playfield in logical pixels. */
    readonly size: {
        readonly width: number;
        readonly height: number;
    };
    readonly sim: {
        readonly plugins: readonly PluginDef[];
        /** Default 1. */
        readonly seed?: number;
        /** Spawns the starting entities before tick 0. */
        readonly setup?: (sim: Sim) => void;
    };
    /**
     * The orientation the game plays in, the same as the ship config's `runtime.orientation`. On a phone held
     * the other way a `portrait` or `landscape` game pauses behind the rotate hint. Default `any`.
     */
    readonly orientation?: GameOrientation;
    /** On a phone held the other way: `'block'` (the default) covers and pauses; `'toast'` says so and plays on. */
    readonly rotateHint?: RotateHintMode;
    /** Default: no commands. */
    readonly input?: InputMap;
    /** Component id → view (`rect`, `sprite`). */
    readonly views?: Readonly<Record<string, EntityViewFactory>>;
    /**
     * The sound each sim event plays, by the event's id: `{ [Chime.id]: 'chime.wav' }`, or `{ alias, bus, gain }`.
     * Silent until the player's first gesture (browsers allow no sound before it).
     */
    readonly sounds?: EventSounds;
    /**
     * The board and score each sim event submits, by the event's id:
     * `{ [RunEnded.id]: { board: 'best', score: (payload) => RunEnded.schema.parse(payload).score } }`. The board is a key
     * of the ship config's `leaderboards`; the game then asks the host for `leaderboards`.
     */
    readonly scores?: EventScores;
    /**
     * The game's save: its slots, how the sim is captured into them and put back. The game then asks the host
     * for `saves`. Needs the default screens for the title's slot list; custom `screens` open the save themselves.
     */
    readonly saves?: GameSaves<D>;
    /** A game with `content/` passes the compiler's output; `sim` is the sim's partition of it. */
    readonly content?: {
        readonly data: CompiledContentData;
        readonly hash: string;
        readonly sim?: unknown;
    };
    /** Default: title, play and paused. */
    readonly screens?: readonly ScreenDef[];
    /** Default: `#game`. */
    readonly root?: HTMLElement;
    readonly hosting?: Partial<Omit<HostingOptions, 'gameId' | 'disclosedEvents'>>;
    /**
     * Default: the core settings (`CORE_SETTINGS`, the save `settings`), with the player's bindings and graphics
     * quality. A game's own settings keep those only when its schema has `input: inputSettingsSchema` and
     * `display: displaySettingsSchema`.
     */
    readonly settings?: SettingsDef<S>;
    readonly extensions?: readonly ExtensionDef[];
    /**
     * Immediate-mode HUD, debug and prototype drawing over the entity views, once per display frame while the
     * default screens hold a sim. It reads the sim and never writes it. Needs the default screens.
     */
    readonly draw?: (ctx: DrawContext) => void;
    /** Merged over the defaults (`pixelArt`, the logical size and the views). */
    readonly renderer?: PixiRendererOptions;
    /**
     * Makes the renderer from the Pixi options `defineGame` built (the size, pixel art, the views, `renderer` and
     * the draw layer's and Settings' `setup`): an extension's renderer, such as render-pixi3d's
     * `(options) => createPixi3dRenderer({ ...options, views })`. Default: core's `createPixiRenderer`.
     */
    readonly createRenderer?: (options: PixiRendererOptions) => RendererFactory;
    /**
     * Files the runtime fetches with the preload screens, with byte progress and the 30 s stall rule, before
     * the renderer starts: model files a 3D view draws, for example. They stay out of the content and its hash, so a
     * new origin or a rebuilt file never changes the hash a save is stamped with.
     */
    readonly preload?: readonly string[];
    /**
     * The game's words: the runtime's boot and failure copy, and `screens`, the default screens' words over their
     * English defaults. `screens` may be a function of the locale, run again on each language change, so a
     * Paraglide game passes its messages: `screens: () => ({ title: { play: m.play() } })`.
     */
    readonly copy?: GameCopy;
    /** The game's languages: Settings' Language group offers them. Absent, the content's one language. */
    readonly locale?: GameDefinition['locale'];
    /** Tests only. */
    readonly seams?: RuntimeSeams;
}
```

#### `GameSpecError` (class)

Every invalid field of a spec, by path: `size.width: …`.

```ts
class GameSpecError extends Error {
    readonly problems: readonly string[];
    constructor(problems: readonly string[]);
}
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

#### `GeometryState` (interface)

The current geometry as rune state: reading `current` in a component or `$derived` tracks it.

```ts
interface GeometryState {
    readonly current: Geometry;
}
```

#### `HeightTier` (type)

The height tiers.

The form factor says what shape a screen is; the tier says how much height it has to spend.
Two screens of the same form factor can need different answers: a 1280 x 720 desktop and a
900 x 600 window are both desktop, and only one can afford a hero above the menu.

Written to `<html data-height>` by the geometry owner. Tokens tighten under it, so every
primitive tightens at once. Targets never shrink with the tier; gutters and decoration do.

```ts
type HeightTier = 'short' | 'compact' | undefined;
```

#### `HOST_EXIT_CAP_MS` (const)

How long the game may hold the host's close, in milliseconds (Ruken's own grace is 1.5 s, so we answer first).

```ts
const HOST_EXIT_CAP_MS = 1000;
```

#### `HostHandshakeFailed` (interface)

The page is inside a frame, but the SDK got no usable welcome and fell back to its standalone session. Not fatal:
reported on `Hosting.handshake.fellBack` and logged once.

```ts
interface HostHandshakeFailed {
    /** The Ruken SDK does not say whether it timed out or rejected a welcome. */
    readonly reason: 'no-welcome';
}
```

#### `Hosting` (interface)

Everything a game may ask of, or hear from, its host. Every target's adapter builds one of these.

```ts
interface Hosting {
    /** 'ruken' when Ruken hosts it; 'standalone' for the Ruken adapter's standalone session; 'web'; 'tauri'. */
    readonly kind: 'ruken' | 'standalone' | 'web' | 'tauri';
    /** The host's name for UI: 'Ruken', 'itch.io', 'this page', or the game's title on the desktop. */
    readonly hostName: string;
    /** Set when the page is inside a frame but the SDK fell back to standalone. */
    readonly handshake: {
        readonly fellBack: HostHandshakeFailed | null;
    };
    readonly player: {
        readonly id: string;
        readonly displayName: string;
    };
    readonly locale: string;
    readonly granted: ReadonlySet<Capability>;
    /** Answers on `session.ready` (at once standalone). No gameplay renders before it (R-04). Never rejects. */
    readonly ready: Promise<HostResult<void>>;
    readonly lifecycle: Subscribable<LifecyclePayload>;
    readonly input: Subscribable<InputModePayload>;
    readonly display: Subscribable<DisplayMetricsPayload>;
    readonly audio: Subscribable<AudioChange>;
    readonly entitlements: Subscribable<EntitlementsPayload>;
    readonly savesStatus: Subscribable<SavesStatus>;
    readonly saves: HostingSaves;
    readonly leaderboards: HostingLeaderboards;
    /** `support` in the answer says what the device allows (for example `ios-home-screen`). */
    setFullscreen(on: boolean): Promise<HostResult<FullscreenRes>>;
    readonly round: {
        /** A round began. A second start before an end is dropped. */
        start(): void;
        /** The open round ended. With no round open it is dropped. */
        end(outcome?: RoundOutcome): void;
        /** One event per round that ended, with its outcome, from the moment of subscribing. A dropped end gives none. */
        readonly ended: Listenable<RoundOutcome | undefined>;
    };
    /** A disclosed analytics event. Never fails: undisclosed, unconsented or refused events are dropped. */
    track(event: string, props?: AnalyticsProps): void;
    /** Hands the player back to the host. Standalone it is refused `UNSUPPORTED`. */
    exit(reason?: 'player' | 'completed'): Promise<HostResult<void>>;
    /**
     * Answers the host's "Open game menu": the handler returns true when the game opened its own menu. Returns the
     * function that takes the handler back. With no handler the host keeps its own drawer.
     */
    onMenuRequest(handler: () => boolean): () => void;
    /**
     * Runs `handler` when the host closes the game. The host waits for it, but AF cuts everything off at
     * `HOST_EXIT_CAP_MS`. Handlers run one after another in registration order and the host save flush runs after the
     * last, so a write a handler makes is flushed. Returns the function that takes the handler back.
     */
    onExiting(handler: () => void | Promise<void>): () => void;
    /** Shuts Hosting down: later calls are refused `CANCELLED`, every subscription stops, the session is released. */
    dispose(): void;
}
```

#### `HostingLeaderboards` (interface)

The host's leaderboards. Needs the `leaderboards` grant; without it a call is refused `UNSUPPORTED`.

```ts
interface HostingLeaderboards {
    submit(board: string, score: number, meta?: LeaderboardSubmitMeta): Promise<HostResult<LeaderboardSubmitRes>>;
    get(board: string, query?: LeaderboardQuery): Promise<HostResult<LeaderboardGetRes>>;
}
```

#### `HostingOptions` (interface)

What the game asks of its host. The game passes these by hand; content does not list them yet.

```ts
interface HostingOptions {
    /** The game config's `game.id`; a host that knows the game (Ruken) checks it. */
    readonly gameId: string;
    /** The capabilities the game asks the host for (`wants` in the hello). */
    readonly wants: readonly Capability[];
    /** Fixed for the game's whole life (Ruken's answer 7 in docs/archive/spikes/s6-ruken-stub.md). */
    readonly pauseBehavior: PauseBehavior;
    /**
     * The game config's `analytics.custom_events`. When given, `track` drops every
     * other name before it reaches the SDK.
     */
    readonly disclosedEvents?: readonly string[];
    /**
     * Ruken adapter, test builds only: exact https origins also trusted to send the welcome. Passed to `Ruken.init`
     * as is; other adapters ignore it.
     */
    readonly testHostOrigins?: readonly string[];
}
```

#### `HostingSaves` (interface)

The player's saves. Each call relays the host's answer or refusal; none falls back to other storage.

```ts
interface HostingSaves {
    get(key: string): Promise<HostResult<string | null>>;
    set(key: string, value: string): Promise<HostResult<void>>;
    remove(key: string): Promise<HostResult<void>>;
    flush(): Promise<HostResult<SavesFlushRes>>;
    /** Every key the session holds, sorted by code unit. Refused `CANCELLED` once Hosting is disposed. */
    keys(): Promise<HostResult<readonly string[]>>;
    /** Another device's write, or the host's conflict choice, reached this session. Only changes, no current value. */
    readonly changed: Listenable<SavesChangedPayload>;
}
```

#### `HostingSeams` (interface)

Test seams of a target's adapter. Games pass nothing. `env` is the host SDK's environment (Ruken's `SdkEnv`); the
adapter that reads it gives it that type, so no SDK type reaches the declarations a game installs.

```ts
interface HostingSeams {
    readonly env?: object;
    /** The clock AF's own timing (the exit cap) runs on; a test passes `fakeClock()`. */
    readonly clock?: Clock;
    /**
     * Gives up waiting for the handshake. Inside a frame that is not Ruken's the SDK waits up to 10 s for a welcome;
     * boot may stop sooner. A session that arrives after the abort is disposed at once instead of leaking.
     */
    readonly signal?: AbortSignal;
}
```

#### `HostRefusal` (interface)

Why the host said no to a call: its contract code, whether a retry may succeed, and the call it refused.

```ts
interface HostRefusal {
    /** The contract's code; the Ruken adapter relays Ruken's unchanged. */
    readonly code: ErrorCode;
    /** Whether a retry may succeed (Ruken's flag, relayed unchanged). */
    readonly retryable: boolean;
    /** The protocol request or `Hosting` call that was refused, for example `saves.set`. */
    readonly operation: string;
    readonly cause?: unknown;
}
```

#### `HostResult` (type)

What a host call answers: the value, or the host's refusal.

```ts
type HostResult<T> = Result<T, HostRefusal>;
```

#### `IconButton` (const)

A button whose face is an icon. Its accessible name is `label`, which it cannot
do without: an empty label throws while it mounts, so a nameless icon button fails its first test
instead of reaching a player. The icon is decoration and hidden from assistive technology.

```ts
const IconButton: import("svelte").Component<Props, {}, "">;
type IconButton = ReturnType<typeof IconButton>;
```

#### `Input` (interface)

The input service: held actions from keys, pads, touch buttons and gestures under the game's
profile and the player's overrides, menu edges, the active device and pads, and rebinding.

```ts
interface Input {
    /** The actions held now, the union over devices, in first-press order. Read once per fixed step; never copied. */
    held(): ReadonlySet<string>;
    /** The active pad's stick, each axis an integer in −127..127, centred inside the deadzone. */
    stick(side: 'left' | 'right'): {
        readonly x: number;
        readonly y: number;
    };
    /** Menu and pause edges, never sent to the sim. Returns the unsubscribe. */
    onPress(action: MenuAction, listener: () => void): () => void;
    /**
     * Reads the pads; the loop calls it once per fixed step, before `held()`. `nowMs` (the frame or step time)
     * paces the held-direction repeat in menus.
     */
    poll(nowMs?: number): void;
    /** A touch button held or let go, by action. */
    hold(action: string): void;
    release(action: string): void;
    /**
     * Gestures from a `SwipeTracker`, as touch: a held gesture holds its actions until released, and a pulse
     * (a flick or a tap) holds them for exactly one sample.
     */
    readonly gesture: GestureSink;
    /** The overlay's move stick: while held it is `stick('left')` and drives the `left-*` directions. */
    readonly touchStick: TouchStickSink;
    /** Where a `CameraDragTracker` sends its pixels. */
    readonly drag: DragSink;
    /** CSS px dragged to the right between the previous two `poll()`s; 0 unless a live action binds `camera-drag`. */
    cameraDrag(): number;
    /** `play` during gameplay, `menu` while a screen pauses the sim or a modal is open. Releases what is held. */
    setContext(context: InputContextNow): void;
    readonly device: Subscribable<ActiveDevice>;
    readonly profile: Subscribable<InputProfile>;
    /** The pads connected since this Input started, in connection order. */
    readonly pads: Subscribable<readonly PadInfo[]>;
    /**
     * Binds the captured key or pad button to `action` on `device`, saved in the settings'
     * `input` when the Input has settings; refused, with nothing changed, by `RebindError`.
     */
    rebind(action: string, device: 'keyboard' | 'gamepad', capture: Capture): Result<void, RebindError>;
    /** Every binding back to the game's profile. */
    resetBindings(): void;
    /**
     * The next key (`keyboard`) or pad button (`gamepad`) pressed, for `rebind`. Escape or pad B cancels; nothing
     * for `REBIND_TIMEOUT_MS` on the Input's clock times out. While it waits, every key it sees goes no further, and the
     * pads drive nothing else. A new capture cancels the one waiting; `signal` aborting stops it and rejects.
     */
    capture(device: 'keyboard' | 'gamepad', signal?: AbortSignal): Promise<Result<Capture, RebindCancelled | RebindTimedOut>>;
}
```

#### `InputMap` (interface)

Held keys, touch buttons and gamepad buttons, turned into one command per tick.

```ts
interface InputMap {
    readonly command: CommandDef;
    /** Whether the play screen shows touch buttons when the player uses touch. */
    readonly touch: boolean;
    readonly touchButtons: readonly TouchButton[];
    /** How the play screen takes touch: its buttons, or swipes over the whole screen. */
    readonly touchMode: TouchMode;
    /**
     * The bindings as data: one action per distinct payload, id `<command id>-<n>`, with its keys, its
     * pad buttons and whether it has a touch button. Rebinding swaps the profile and never the command mapping.
     */
    readonly profile: InputProfile;
    /** Each action's name, as the Settings screen's Controls section lists it. */
    readonly labels: Readonly<Record<string, string>>;
    /** Whether the play screen shows the touch stick (the `analog.touchStick` option). */
    readonly touchStick: boolean;
    /**
     * Pure: the one command for the held actions, merged in iteration order (a later action wins per field). With an
     * `analog` option, `reading` adds the sticks and the drag; without one it is ignored.
     */
    toCommand(held: Iterable<string>, tick: number, reading?: AnalogReading): readonly Command[];
    attach(target: Window): InputSource;
}
```

#### `InputMode` (type)

How the player is playing right now.

```ts
type InputMode = 'touch' | 'keyboard-mouse' | 'gamepad';
```

#### `InputModePayload` (interface)

The current input mode, and the gamepad when one is in use.

```ts
interface InputModePayload {
    mode: InputMode;
    gamepad?: {
        layout: 'xbox' | 'other';
        connected: boolean;
    } | undefined;
}
```

#### `InputModePayloadSchema` (const)

Checks an input mode change.

```ts
const InputModePayloadSchema: z.ZodType<InputModePayload>;
```

#### `InputProfile` (interface)

A named set of bindings, one per game action. It is data: a settings screen rebinds a
copy and saves it in the game's `SettingsDef`; the input service reads it. Action ids are the game's own.

```ts
interface InputProfile {
    readonly id: string;
    readonly bindings: Readonly<Record<string, InputBinding>>;
}
```

#### `inputProfileSchema` (const)

Validates an input profile, filling left-out binding fields with "unbound". A reserved key or pad button fails
the parse with the action named: at boot that is a developer error before anything renders.

```ts
const inputProfileSchema: z.ZodType<InputProfile, InputProfileInput>;
```

#### `inputs` (function)

One input map from `maps`, each sending its own command every tick in map order. The commands share source 0, so
each gets its own `seq`: `tick × maps.length + index` (a u32, which at 60 Hz lasts 2³²/60/86,400/n ≈ 828/n days of
play). `command` is the first map's. Throws on no maps, on two maps for one command, and on an action id, a key or
a pad button two maps share.

```ts
function inputs(...maps: readonly InputMap[]): InputMap;
```

#### `InputSource` (interface)

The input map attached to a window for one play session.

```ts
interface InputSource {
    /** This tick's command, if any: one per tick, never an edge. */
    commands(tick: number): readonly Command[];
    /** A touch button pressed or released (its `TouchButton.id`). */
    hold(buttonId: string): void;
    release(buttonId: string): void;
    /** Gestures from a `SwipeTracker`: held swipes and one-tick flicks and taps. */
    readonly gesture: GestureSink;
    dispose(): void;
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

#### `KeyBindings` (type)

By `KeyboardEvent.code`, so the keys sit in the same place on every keyboard layout.

```ts
type KeyBindings<Z extends z.ZodType> = Readonly<Record<string, Payload<Z>>>;
```

#### `keys` (function)

An input map sending `command` once per tick with the payload of what is held: keys by
`KeyboardEvent.code`, on-screen touch buttons, gamepad buttons, the stick and gestures, merged over the
idle payload. Throws when a binding's payload fails the command's schema, and when a key in `options.required` has
no binding.

```ts
function keys<Z extends z.ZodType>(command: CommandDef<Z>, bindings: KeyBindings<Z>, options?: KeysOptions<Z>): InputMap;
```

#### `KeysOptions` (interface)

Options for `keys`: touch buttons, gamepad buttons, gestures and the stick, the idle payload, required keys
and the Controls section's labels.

```ts
interface KeysOptions<Z extends z.ZodType> {
    /** On-screen buttons from the bindings when the player uses touch. Default true. */
    readonly touch?: boolean;
    /** Standard-mapping gamepad button index → payload, polled once per tick. */
    readonly pad?: Readonly<Record<number, Payload<Z>>>;
    /** Touch gesture → payload: a swipe holds while the finger steers, a flick or a tap lasts one tick. */
    readonly gestures?: Readonly<Partial<Record<GestureName, Payload<Z>>>>;
    /** Default `buttons` when the map has touch buttons, else `swipe`. The player's setting overrides it. */
    readonly touchMode?: TouchMode;
    /** A stick pushed past the deadzone in a direction (`left-left`, `right-up`, …) → payload. */
    readonly stick?: Readonly<Partial<Record<StickDirection, Payload<Z>>>>;
    /** The payload with nothing held. Default: the schema's own defaults (`schema.parse({})`), when it has them. */
    readonly idle?: z.input<Z>;
    /**
     * Keys whose actions the game cannot be played without: rebinding never leaves them unbound on a device
     *, and where the touch buttons do not all fit, theirs are the ones that show.
     */
    readonly required?: readonly string[];
    /**
     * Action names for the Controls section, by any of the action's default keys: `{ Space: 'Jump' }`. Default: the
     * command and payload (`move x -1`).
     */
    readonly labels?: Readonly<Record<string, string>>;
    /** The sticks and the camera drag, added to the held keys' payload each tick. */
    readonly analog?: AnalogOptions<Z>;
}
```

#### `LeaderboardEntry` (interface)

One row of a board.

```ts
interface LeaderboardEntry {
    rank: number;
    displayName: string;
    score: number;
    isMe: boolean;
}
```

#### `LeaderboardGetRes` (interface)

The rows of a board.

```ts
interface LeaderboardGetRes {
    entries: LeaderboardEntry[];
}
```

#### `LeaderboardGetResSchema` (const)

Checks a board's rows.

```ts
const LeaderboardGetResSchema: z.ZodType<LeaderboardGetRes>;
```

#### `LeaderboardPanel` (const)

A board's rows, or why there are none: loading, entries (the player's row marked "you"
in words, not only by colour), empty, unavailable and offline. The rows are read, not chosen, so
they are out of the focus order; only the action row (Back, Play again) takes focus. Unavailable
and offline are what the host said: the panel never shows a board kept on the device instead.
The rows sit in a ScrollList, a declared scroll region, so on a short screen they scroll and the
action row stays.

```ts
const LeaderboardPanel: import("svelte").Component<Props, {}, "">;
type LeaderboardPanel = ReturnType<typeof LeaderboardPanel>;
```

#### `LeaderboardQuery` (interface)

Which entries to read from a board.

```ts
interface LeaderboardQuery {
    scope?: 'top' | 'around-me';
    limit?: number;
}
```

#### `LeaderboardQuerySchema` (const)

Checks a board query.

```ts
const LeaderboardQuerySchema: z.ZodType<LeaderboardQuery>;
```

#### `LeaderboardSubmitMeta` (type)

Extra facts sent with a score, passed to the host as they are.

```ts
type LeaderboardSubmitMeta = Record<string, string | number>;
```

#### `LeaderboardSubmitMetaSchema` (const)

Checks a score's extra facts.

```ts
const LeaderboardSubmitMetaSchema: z.ZodType<LeaderboardSubmitMeta>;
```

#### `LeaderboardSubmitRes` (interface)

The host's answer to a submitted score.

```ts
interface LeaderboardSubmitRes {
    accepted: boolean;
    personalBest: number;
    rank?: number | undefined;
}
```

#### `LeaderboardSubmitResSchema` (const)

Checks a submit answer.

```ts
const LeaderboardSubmitResSchema: z.ZodType<LeaderboardSubmitRes>;
```

#### `lerp` (function)

Linear blend; `t = 1` returns `b` exactly, because `a + (b - a)` can round away from it.

```ts
function lerp(a: number, b: number, t: number): number;
```

#### `lerpAngle` (function)

Blends two angles (radians) along the shorter arc, so a body turning from just under π to just over -π
swings through π instead of spinning the long way round through 0. At `t = 1` it returns `b` exactly, so a
view at rest shows the sim's own value rather than an equivalent angle 2π away.

```ts
function lerpAngle(a: number, b: number, t: number): number;
```

#### `LifecyclePayload` (interface)

Whether the game is in front, and if not, why.

```ts
interface LifecyclePayload {
    state: 'active' | 'background';
    reasons: LifecycleReason[];
}
```

#### `LifecyclePayloadSchema` (const)

Checks a lifecycle change.

```ts
const LifecyclePayloadSchema: z.ZodType<LifecyclePayload>;
```

#### `LifecycleReason` (type)

Why the game is in the background.

```ts
type LifecycleReason = 'hidden' | 'blurred' | 'host-overlay' | 'ad' | 'offline-grace';
```

#### `LoaderOverlay` (const)

The loader over a screen while its assets load. It shows real progress when the runtime has it
and an indeterminate bar before the first byte, says what is loading in words, and after the
runtime's slow threshold says quietly that it is slow, not failing. The slow line always holds
its height, so nothing shifts when it appears.

```ts
const LoaderOverlay: import("svelte").Component<Props, {}, "">;
type LoaderOverlay = ReturnType<typeof LoaderOverlay>;
```

#### `Locale` (interface)

The locale service: the game's locales, the one text is drawn in now, the player's choice
and the text direction.

```ts
interface Locale {
    /** The game's locales, in its own order (the picker's order). */
    readonly locales: readonly string[];
    readonly baseLocale: string;
    /** The locale text is drawn in now. */
    readonly current: string;
    /** The player's pick: one of `locales`, or null for Automatic (nothing saved, or a saved locale the game dropped). */
    readonly choice: string | null;
    readonly direction: 'ltr' | 'rtl';
    /** Svelte store contract: called at once with the current locale, then on each change. */
    subscribe(listener: (locale: string) => void): () => void;
    /**
     * The picker's one call: one of `locales`, or null for Automatic. Saved through `Hosting.saves`.
     * A locale the game does not ship throws: the picker only offers `locales`.
     */
    set(choice: string | null): void;
}
```

#### `MAX_TURN_UNITS_PER_STEP` (const)

The most one step's `camera-turn` may carry either way: 45°.

```ts
const MAX_TURN_UNITS_PER_STEP = 8192;
```

#### `measureGeometry` (function)

Turns what the browser and the host report into one `Geometry`. Pure. Each inset is the largest of the
browser's safe area, the host's and (at the sides) the host's reserved strip; the visible region is the
usable one less whatever covers the page's foot.

```ts
function measureGeometry(input: GeometryInput): Geometry;
```

#### `Modal` (const)

A panel over the screen with a visible Close. Where Dialog asks a question that needs an answer,
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

#### `ModelInvalid` (class)

A 3D model file could not be read: malformed, of an unknown type, not loaded, or a glTF with a skin,
which is not supported yet. Boot shows the panel naming the file, with Try again.

```ts
class ModelInvalid extends Error {
    readonly _tag: "ModelInvalid";
    readonly file: string;
    readonly reason: string;
    constructor(fields: ModelInvalidFields);
}
```

#### `OptionGroup` (const)

A choice of one: a
segmented row whose chosen option is filled and marked, never only underlined or only coloured.

Native radios in a fieldset, not `<button role="radio">`: the browser gives the arrow keys,
and the focus navigator's `adjust` cycles a named radio group, so a pad changes it without leaving it.

Controlled: it reports a choice through `onchange` and shows the `value` it is given. A choice the owner does
not take is undone, so what is checked is always the owner's value.

```ts
const OptionGroup: import("svelte").Component<Props, {}, "">;
type OptionGroup = ReturnType<typeof OptionGroup>;
```

#### `OwnedRenderer` (interface)

A renderer the runtime owns: `dispose` destroys it (the canvas, its listeners, its GPU resources).

```ts
interface OwnedRenderer extends GameRenderer {
    dispose(): void;
}
```

#### `PagedGrid` (const)

A grid of items in pages that never scrolls. Each group starts its own page; the shape is `most`, cut to what the measured box holds at
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

#### `PagerDots` (const)

Where a paged view is: one row of
dots, each a whole touch target, or "3 / 11" once the dots would not fit on one row. It never wraps.

```ts
const PagerDots: import("svelte").Component<Props, {}, "">;
type PagerDots = ReturnType<typeof PagerDots>;
```

#### `PauseBehavior` (type)

Whether the game pauses when it goes to the background; fixed for the game's whole life.

```ts
type PauseBehavior = 'pause' | 'continue';
```

#### `PauseBehaviorSchema` (const)

Checks a pause behavior.

```ts
const PauseBehaviorSchema: z.ZodType<PauseBehavior>;
```

#### `PixiRenderer` (interface)

The runtime's `GameRenderer`, built on PixiJS, with its stage.

```ts
interface PixiRenderer extends OwnedRenderer {
    readonly stage: PixiStage;
}
```

#### `PixiRendererOptions` (interface)

Options for `createPixiRenderer`; every field has a default.

```ts
interface PixiRendererOptions {
    /**
     * Preferred backend. Default is 'webgl' (WebGL2).
     * Overridden by URL query param `?renderer=webgl` or `?renderer=webgpu` if present in browser.
     */
    readonly preference?: RendererPreference | undefined;
    /** Logical playfield width in pixels (e.g. 960 or 320). If omitted, renders unletterboxed. */
    readonly logicalWidth?: number | undefined;
    /** Logical playfield height in pixels (e.g. 540 or 192). If omitted, renders unletterboxed. */
    readonly logicalHeight?: number | undefined;
    /** Background clear colour (hex number, e.g. 0x000000). Default is 0x000000. */
    readonly backgroundColor?: number | undefined;
    /** If true, textures default to nearest-neighbour sampling for crisp pixel art. Default is true. */
    readonly pixelArt?: boolean | undefined;
    /** Letterbox cropping fraction for top and bottom bars. Default is 0.05 (5%). */
    readonly barFraction?: number | undefined;
    /** Bar color in hex. Default is 0x2e222f (plum black). */
    readonly barColor?: number | undefined;
    /** The graphics quality tier to start at; `PixiStage.setQuality` changes it. Default `high`. */
    readonly quality?: QualityTier | undefined;
    /**
     * Draws the world and UI at the logical size and resolution 1, then nearest-upscales them into the letterbox
     * (`CompositeTarget`). Needs a letterbox. Default: on when `pixelArt` is on.
     */
    readonly composite?: boolean | undefined;
    /** Optional view factory resolver for entity components. */
    readonly entityViews?: EntityViewResolver | undefined;
    /**
     * Screen-space filters declared with `postFilter`. Each is built when the renderer starts and set in the
     * stage's post-filter slot before `setup` runs, so `setup` sees them and may add more. Names must be unique.
     */
    readonly postFilters?: readonly PostFilterDef[] | undefined;
    /**
     * Optional setup hook called before the first frame to add layers/filters. It may return hooks for a game
     * that draws its own scene: they run after the entity views each step, before Pixi renders each frame, and
     * after the views reset.
     */
    readonly setup?: ((stage: PixiStage) => PixiStageHooks | undefined) | ((stage: PixiStage) => void) | undefined;
}
```

#### `PixiStage` (interface)

The Pixi scene the renderer draws, as a game's `setup` sees it: the app, the letterbox's layers, the entity
views, the post-filter slot and the quality tier.

```ts
interface PixiStage {
    readonly app: Application;
    readonly frame?: LetterboxFrame | undefined;
    /** The world container where entity views and gameplay objects are mounted. */
    readonly world: Container;
    /** The logical screen-space UI layer (masked with the playfield). */
    readonly ui: Container;
    /** The unclipped background scenery container. */
    readonly backdrop: Container;
    /** The delta consumer tracking entity views. */
    readonly consumer: RenderDeltaConsumer;
    /** The fixed-resolution composite the world and UI draw into, when it is on. */
    readonly composite?: CompositeTarget | undefined;
    /** Post-processing filters applied to the root rendered scene. Owned by `postFilters` once it is used. */
    filters: Filter[] | null;
    /** The post-filter slot over `filters`: each owner keeps its own filters by id and order. */
    readonly postFilters: PostFilterSlot;
    /** The graphics quality tier now. */
    readonly quality: QualityTier;
    /** Changes the tier: re-caps the canvas resolution and leaves out post-filter owners registered for a higher one. */
    setQuality(tier: QualityTier): void;
    /**
     * Builds a filter, or returns `undefined` when it cannot be built or compiled: it then warns and publishes
     * `render.filter.dropped` on the render target's bus, and the frame draws without it.
     */
    tryFilter<F extends Filter>(id: string, make: () => F): F | undefined;
}
```

#### `PixiStageHooks` (interface)

What a `setup` may return to hear every step, frame and reset.

```ts
interface PixiStageHooks {
    /** After the entity views took the step's render delta. */
    readonly apply?: ((result: StepResult) => void) | undefined;
    /** Each display frame, after the views interpolated and before Pixi renders. */
    readonly draw?: ((frame: FrameInfo) => void) | undefined;
    /** After the views reset (a new sim or a resync). */
    readonly reset?: (() => void) | undefined;
}
```

#### `PluginDef` (interface)

A bundle of definitions the sim registers together: components, commands, events, resources and systems,
the plugins it depends on, and optionally per-sim engine state and `config`. Create one with
`definePlugin`.

```ts
interface PluginDef {
  readonly kind: 'plugin'
  readonly name: string
  /** Creates this plugin's per-sim engine state; its systems see it as `ctx.pluginState`. */
  readonly state: ((setup: PluginStateSetup) => Promise<PluginState>) | undefined
  readonly dependsOn: readonly string[]
  readonly components: readonly ComponentDef[]
  readonly commands: readonly CommandDef[]
  readonly events: readonly EventDef[]
  readonly resources: readonly ResourceDef[]
  readonly systems: readonly SystemDef[]
  /**
   * Settings that change what the plugin simulates (physics gravity), as plain JSON. Part of the schema hash,
   * so a snapshot never restores into a sim configured differently. Undefined when the plugin has none.
   */
  readonly config: unknown
}
```

#### `Pose` (interface)

Where an entity view draws: position in world pixels and rotation in radians (Pixi `rotation`).

```ts
interface Pose {
    readonly x: number;
    readonly y: number;
    readonly angle: number;
}
```

#### `postFilter` (function)

Declares a screen-space filter over the whole picture: `renderer: { postFilters: [postFilter('vignette', {
glsl, wgsl })] }`. The renderer builds it when it starts and keeps it in the stage's post-filter slot under
`name`. A filter that cannot be built, or whose GLSL does not link, is left out with a warning and the frame
draws without it. Throws when the name or either shader is empty.

```ts
function postFilter(name: string, spec: PostFilterSpec): PostFilterDef;
```

#### `PostFilterDef` (interface)

A declared filter, as `postFilter` returns it and `PixiRendererOptions.postFilters` takes it.

```ts
interface PostFilterDef {
    readonly name: string;
    readonly glsl: string;
    readonly wgsl: string;
    readonly order: number;
    readonly minTier: QualityTier | undefined;
}
```

#### `PostFilterSpec` (interface)

What a screen-space filter is made of: the same effect written twice, for WebGL2 (`glsl`) and WebGPU (`wgsl`),
so the two renderers stay at parity. Both are fragment shaders that `filterPrograms` joins to the shared vertex
stage: GLSL reads `vTextureCoord`, `vPixelCoord` and `uTexture`; WGSL has `mainFragment(input: VSOutput)`.

```ts
interface PostFilterSpec {
    /** The GLSL ES 3.00 fragment shader, run under WebGL2. */
    readonly glsl: string;
    /** The WGSL fragment shader, run under WebGPU; its entry point is `mainFragment`. */
    readonly wgsl: string;
    /** Where it sits among the stage's filters: lower runs first, ties by name. Default 0. */
    readonly order?: number | undefined;
    /** The lowest quality tier it runs at; left out, it runs at every tier. */
    readonly minTier?: QualityTier | undefined;
}
```

#### `PresentationBus` (interface)

The presentation bus: typed facts the runtime publishes for screens, audio and tests to hear. Facts
describe what happened; they never change gameplay state.

```ts
interface PresentationBus<Facts = RuntimeFacts> {
    publish<K extends keyof Facts & string>(name: K, fact: Facts[K]): void;
    subscribe<K extends keyof Facts & string>(name: K, listener: (fact: Facts[K]) => void): () => void;
}
```

#### `QualityTier` (type)

A graphics quality tier: `high`, `medium` or `low`.

```ts
type QualityTier = (typeof QUALITY_TIERS)[number];
```

#### `rect` (function)

A filled rectangle that follows its component's `x`, `y` and `angle`, interpolated between ticks:
`entityViews: { [Body.id]: rect({ w: 8, h: 8, color: 0xf9c22b }) }`.

```ts
function rect(options: RectViewOptions): EntityViewFactory;
```

#### `RectViewOptions` (interface)

A `rect` view's size, colour and anchor.

```ts
interface RectViewOptions {
    /** Width in world pixels. */
    readonly w: number;
    /** Height in world pixels. */
    readonly h: number;
    /** Fill colour, e.g. 0xf9c22b. */
    readonly color: number;
    /** Default 0.5 (centred on the entity's position). */
    readonly anchor?: ViewAnchor | undefined;
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

#### `RenderDeltaConsumer` (class)

Keeps one entity view per sim entity in the world from each step's render delta, and interpolates them between
ticks. `C` is the scene's node type: Pixi's `Container` by default.

```ts
class RenderDeltaConsumer<C extends SceneNode = Container> {
    private readonly world;
    private readonly resolver?;
    private readonly views;
    private readonly cache;
    constructor(world: SceneParent<C>, resolver?: EntityViewResolver<C>);
    private resolveView;
    apply(delta: RenderDelta): void;
    interpolate(alpha: number): void;
    private removeEntity;
    reset(): void;
    destroy(): void;
}
```

#### `RendererFactory` (type)

Builds the game's renderer for a target. It answers `RendererUnavailable` when no backend it accepts starts, and
`ModelInvalid` when a 3D renderer cannot read a model file it was given; a bug throws. The caller disposes what it
gets.

```ts
type RendererFactory = (target: RenderTarget) => Promise<Result<OwnedRenderer, RendererUnavailable | ModelInvalid>>;
```

#### `RendererUnavailable` (class)

Neither WebGL2 nor WebGPU could be initialized.
In Ruken this presents the "unsupported" screen with an exit button.

```ts
class RendererUnavailable extends Error {
    readonly _tag: "RendererUnavailable";
    readonly tried: readonly ('webgl2' | 'webgpu')[];
    constructor(fields: RendererUnavailableFields);
}
```

#### `RenderTarget` (interface)

Where a renderer draws: the host element, the layout geometry, the loaded assets and the presentation bus.

```ts
interface RenderTarget {
    readonly host: HTMLElement;
    readonly geometry: GeometryOwner;
    readonly assets: Pick<Assets, 'get'>;
    /** The runtime's presentation bus, for render facts such as `render.filter.dropped`. Optional for tests and tools. */
    readonly bus?: PresentationBus | undefined;
    /**
     * Shows the "picture stopped" panel with Try again, for a renderer whose graphics context is lost and will not
     * come back by itself: Try again closes the panel and calls `retry`, which rebuilds the renderer from
     * the sim's current state. Returns a function that closes the panel. Optional for tests and tools.
     */
    readonly reportLost?: ((retry: () => void) => () => void) | undefined;
}
```

#### `ResourceDef` (interface)

A value the sim keeps once, not on any entity: an id, a Zod schema and the `init` that gives its starting
value. Create one with `defineResource`.

```ts
interface ResourceDef<Z extends z.ZodType = z.ZodType> {
  readonly kind: 'resource'
  readonly id: string
  readonly schema: Z
  readonly init: () => z.input<Z>
}
```

#### `RoundOutcome` (type)

How a round ended.

```ts
type RoundOutcome = 'complete' | 'fail' | 'quit';
```

#### `RoundOutcomeSchema` (const)

Checks a round outcome.

```ts
const RoundOutcomeSchema: z.ZodType<RoundOutcome>;
```

#### `RUKEN_SDK_MARKERS` (const)

String literals only the Ruken SDK contains, which survive minification: the SDK's storage probe
key (`env-browser.ts`) and its standalone refusal message (`standalone.ts`), at RukenApp d0fa2fe (as at
b30d31b). An `itch` or `web` build must contain neither, because it bundles the web adapter instead of the SDK;
a `ruken` build contains both. The web adapter's own probe key (`WEB_STORAGE_PROBE_KEY`) is deliberately different.

Re-check these after re-vendoring the SDK: `target.build.test.ts` fails if a default build stops containing them.

```ts
const RUKEN_SDK_MARKERS: readonly string[];
```

#### `runGame` (function)

Boots and runs the game: a failure draws the boot failure panel, and `shutdown` closes everything the runtime opened.

Each attempt opens into a fresh `Teardown`. On failure it mounts the boot failure panel and keeps the attempt open,
so Back to {host} can still reach its `Hosting`. Try again and Continue without loading close the failed attempt and
boot again on the same root without reloading the page. Inside a Ruken session, Try again reloads the game's frame
instead: the host answers one hello per frame load, so a second session in this load would never be welcomed.

`shutdown()` stops a boot under way and closes the current attempt, last opened first. `start.at` names the screen
the flow starts on (a restart in development); `screen` is the screen showing now.

```ts
function runGame<S>(game: GameDefinition<S>, start?: StartOptions): RuntimeHandle;
```

#### `RuntimeFacts` (interface)

Every fact the runtime publishes on the presentation bus, by name.

```ts
interface RuntimeFacts {
    readonly 'sim.events': readonly SimEvent[];
    /**
     * The same events with the tick of the step that emitted them (`StepResult.tick`, the tick the sim is at after the step), for
     * a listener that needs to know when an event happened. Published with `sim.events`, only when the step emitted events.
     */
    readonly 'sim.step': {
        readonly tick: number;
        readonly events: readonly SimEvent[];
    };
    readonly 'screen.entered': {
        readonly screen: string;
        readonly from: string | undefined;
    };
    readonly 'time.changed': {
        readonly paused: boolean;
    };
    /** The player's language changed. Screens redraw their text; nothing remounts. */
    readonly 'locale.changed': {
        readonly locale: string;
        readonly previous: string;
    };
    /** The player's last real input came from another device. Prompts and touch controls follow it. */
    readonly 'input.device.changed': {
        readonly device: InputDevice;
        readonly glyphs: GlyphFamily;
        readonly previous: InputDevice;
    };
    /** The first gesture after `session.ready` built and resumed the audio graph. */
    readonly 'audio.unlocked': Readonly<Record<never, never>>;
    /** No audio context could be built or resumed; the game runs silent. */
    readonly 'audio.unavailable': {
        readonly reason: string;
    };
    /** A sound or a track could not be loaded or decoded; it is silent and nothing else stops. */
    readonly 'audio.decode.failed': {
        readonly alias: string;
        readonly reason: string;
    };
    /** A pad was plugged in. `standard: false` means it cannot drive bindings. */
    readonly 'input.pad.connected': PadInfo;
    /** A pad was unplugged; what it held is released. `wasActive`: it was the pad in use. */
    readonly 'input.pad.disconnected': PadInfo & {
        readonly wasActive: boolean;
    };
    /** The player's bindings changed: `action` when one was rebound, none on a reset or a follow. */
    readonly 'input.bindings.changed': {
        readonly action?: string;
    };
    /** A post filter could not be built or compiled and was left out; the frame draws without it. */
    readonly 'render.filter.dropped': {
        readonly id: string;
        readonly reason: string;
    };
    /** The WebGL context was lost; the renderer draws nothing until it is restored. */
    readonly 'render.context.lost': Readonly<Record<never, never>>;
    /**
     * The WebGL context came back: Pixi re-uploads its GPU resources and the renderer draws again; the
     * views and the sim are untouched.
     */
    readonly 'render.context.restored': Readonly<Record<never, never>>;
    /** A slot's save reached the host. `key` is the save's prefix (`SaveDef.key`). */
    readonly 'save.written': {
        readonly key: string;
        readonly slot: number;
    };
    /** The host refused a slot's write; the slot keeps its previous value. */
    readonly 'save.failed': {
        readonly key: string;
        readonly slot: number;
        readonly code: ErrorCode;
    };
    /** A slot was loaded for play. */
    readonly 'save.loaded': {
        readonly key: string;
        readonly slot: number;
    };
    /**
     * Another device changed the slot being played. Nothing was reloaded; the game offers Load
     * newer or Keep playing.
     */
    readonly 'save.changedElsewhere': {
        readonly key: string;
        readonly slot: number;
    };
    /** A submit to `board` changed state: `submitting`, then how the host answered. */
    readonly 'leaderboard.submitted': {
        readonly board: string;
        readonly state: BoardState;
    };
}
```

#### `RuntimeHandle` (interface)

Controls the running game: `shutdown` closes everything the runtime opened, last opened first.

```ts
interface RuntimeHandle {
    /** The screen showing now; `undefined` before the flow starts and after shutdown. */
    readonly screen: string | undefined;
    shutdown(): Promise<void>;
}
```

#### `RuntimeSeams` (interface)

Test seams injected into the runtime boot program.

```ts
interface RuntimeSeams {
    readonly fetch?: typeof fetch;
    readonly frames?: FrameSource;
    readonly fonts?: Pick<FontFaceSet, 'load'>;
    readonly sdkEnv?: () => NonNullable<HostingSeams['env']>;
    /**
     * Builds the game's `Hosting` in place of the build target's adapter (`@automata/framework/target`), for example
     * `fakeHosting(…).open` from `@automata/framework/testing`. It gets boot's clock and the signal that gives up the
     * handshake; boot disposes what it answers. When given, `sdkEnv` is not used.
     */
    readonly hosting?: (options: HostingOptions, seams: {
        readonly clock: Clock;
        readonly signal: AbortSignal;
    }) => Promise<HostResult<Hosting>>;
    /** The clock every runtime timer runs on (the stall rule, fades, toasts, the exit cap); default the real one. */
    readonly clock?: Clock;
    /** The wall clock saves are stamped with, in epoch milliseconds; default `Date.now`. */
    readonly now?: () => number;
    readonly document?: Document;
    /** The browser's languages, best first; defaults to `navigator.languages`. */
    readonly languages?: readonly string[];
    /** Builds the audio context on the unlock; defaults to `new AudioContext()`. */
    readonly createAudioContext?: () => AudioContextLike;
    /** The device's haptics, in place of the browser's (pads, `navigator.vibrate`, a coarse pointer). */
    readonly haptics?: Haptics;
    /** Where settings fields that belong to the device are kept; defaults to the frame's `localStorage`. */
    readonly deviceStorage?: DeviceStorage;
    /**
     * Hears what failed, after the runtime has shown it as usual: a boot failure's `BootError`, why a screen could not
     * load or enter, or what a running sim's step threw. Each Try again can fail again, so it can be called more than
     * once. A throw from it is ignored. The website's playground reports the line in the reader's code
     * from it.
     */
    readonly onFailure?: (cause: unknown) => void;
    /**
     * Reloads the game's frame: what Try again does after a boot failure inside a Ruken session, where the host answers
     * one hello per frame load. Defaults to reloading the document's location.
     */
    readonly reload?: () => void;
}
```

#### `RuntimeServices` (interface)

The runtime services a screen may use, as one plain object: boot builds them in order and hands them over.

```ts
interface RuntimeServices {
    readonly hosting: Hosting;
    readonly bus: PresentationBus;
    /** The runtime's clock: what a screen waits on (a toast's four seconds, a rebind's countdown). */
    readonly clock: Clock;
    readonly time: Time;
    readonly flow: Flow;
    readonly settings: Settings;
    readonly saves: Saves;
    readonly appLoop: AppLoop;
    readonly assets: Assets;
    readonly renderer: GameRenderer;
    readonly locale: Locale;
    /** Sounds and music, and the audio buses' gains (one service). */
    readonly audio: Audio & AudioBuses;
    readonly leaderboards: Leaderboards;
    readonly haptics: Haptics;
}
```

#### `Save` (interface)

A game's save: its slots' states, load, write and remove, and the progress `touch` keeps for
the autosave triggers to write.

```ts
interface Save<S> {
    /** Every slot's state, in slot order. */
    readonly slots: Subscribable<readonly SlotState[]>;
    /** The slot being played: the last one `load` returned. Undefined before the first load. */
    readonly loaded: Subscribable<number | undefined>;
    /**
     * Reads a slot and makes it the one being played. Progress `touch`ed before is dropped: it came from the game this
     * load replaces, and must not be written over what was just read. A slot the save does not have throws.
     */
    load(slot: number): Promise<Result<Loaded<S>, SaveUnreadable | SaveFromNewerBuild | HostRefusal>>;
    write(slot: number, data: S, options?: SaveWriteOptions): Promise<Result<void, SaveRefused | HostRefusal>>;
    remove(slot: number): Promise<Result<void, HostRefusal>>;
    /**
     * Says the loaded slot's progress changed and what it is now. A plain function, safe to call every tick: it only
     * keeps `data`, and the next autosave trigger writes it. With no slot loaded it keeps nothing.
     */
    touch(data: () => S): void;
    /**
     * Writes the progress `touch` has kept for every slot that still has some, now, whatever the autosave policy
     * (an exit must not lose progress because `on` left out a trigger). It still never writes a slot whose state
     * is not `ready` or `empty` (a newer build's, a damaged one, one loaded with other content), nor the slot
     * another device changed while it was played, until the player answers: that progress stays kept (Keep
     * playing releases it; Load newer and any other load drop it). It never rejects, because it runs inside the host's
     * exit; a refused write is the `save.failed` fact, and the progress stays kept for the next flush.
     */
    flushPending(): Promise<void>;
    /**
     * What a trigger calls: `flushPending` if the save's policy lists `trigger`, otherwise nothing. `saveService`
     * already wires every trigger to its source; this is for a game that raises one itself.
     */
    autosave(trigger: AutosaveTrigger): Promise<void>;
    /**
     * True while the loaded slot holds something another device wrote after it was loaded. Nothing is
     * reloaded, and no trigger writes that slot over the other device's until the player answers. Lowered by
     * `keepPlaying`, `loadNewer` or any load.
     */
    readonly changedElsewhere: Subscribable<boolean>;
    /** Loads the loaded slot again, so the game plays what the other device wrote. Throws when nothing is loaded. */
    loadNewer(): Promise<Result<Loaded<S>, SaveUnreadable | SaveFromNewerBuild | HostRefusal>>;
    /** The player chose to carry on: lowers `changedElsewhere`. The next trigger writes the progress kept over the other device's, as any write would. */
    keepPlaying(): void;
}
```

#### `SaveDef` (interface)

A game's save: one record, or a fixed number of slots, each one Ruken key.

```ts
interface SaveDef<S> {
    /** The key prefix. Ruken's key rule is the SDK's, which checks it on write. */
    readonly key: string;
    /** This build's version of the data, an integer from 1. */
    readonly version: number;
    readonly schema: z.ZodType<S>;
    /** What an empty slot loads as. */
    readonly empty: () => S;
    /** `migrations[n]` turns version `n` data into version `n + 1`. */
    readonly migrations: Readonly<Record<number, SaveMigration>>;
    /** Absent: one record, slot 0, stored at `key`. */
    readonly slots?: {
        readonly count: number;
    };
    /** Absent: save on `screen-exit`, `round-end` and `background`, with no timer. `{ on: [] }` turns it off. */
    readonly autosave?: AutosavePolicy;
}
```

#### `Saves` (interface)

The booted game's save as a runtime service, as `Settings` is for settings: its key and the
`Save`, both undefined for a game without saves.

```ts
interface Saves {
    /** The booted save's key prefix; undefined for a game without saves. */
    readonly key: string | undefined;
    readonly save: Save<unknown> | undefined;
}
```

#### `SavesChangedPayload` (interface)

Another device's write, or the host's conflict choice, reached this session. `null` is a removed key.

```ts
interface SavesChangedPayload {
    key: string;
    value: string | null;
    revision: number;
}
```

#### `SavesChangedPayloadSchema` (const)

Checks a saves change.

```ts
const SavesChangedPayloadSchema: z.ZodType<SavesChangedPayload>;
```

#### `SavesFlushRes` (interface)

Where a flush left the saves: the host's outbox, its server, or the device's own storage (`'device'`, the `web`,
`itch` and `tauri` targets).

```ts
interface SavesFlushRes {
    persisted: 'host-outbox' | 'server' | 'device';
}
```

#### `SavesFlushResSchema` (const)

Checks a flush answer.

```ts
const SavesFlushResSchema: z.ZodType<SavesFlushRes>;
```

#### `SavesStatus` (type)

Where the player's saves stand with the host.

```ts
type SavesStatus = 'checking' | 'syncing' | 'saved' | 'offline-queued' | 'retry' | 'conflict' | 'recovered';
```

#### `SavesStatusSchema` (const)

Checks a saves status.

```ts
const SavesStatusSchema: z.ZodType<SavesStatus>;
```

#### `ScreenContext` (interface)

What a screen's `enter` is given: where to mount, where it came from, what to undo, and the runtime's services.

```ts
interface ScreenContext {
    /** The screen's own element in the screen layer. */
    readonly layer: HTMLElement;
    readonly from: string | undefined;
    /**
     * What the screen undoes when it is left: add a function for each listener, mount or timer it starts. The flow
     * disposes it once, last added first, before the next screen enters (and when a failed `enter` is cleaned up).
     */
    readonly screen: Disposables;
    /**
     * What a game keeps across screens, such as the sim the default screens share. Every screen of a run gets the same
     * one. It is disposed once, when the runtime shuts down or a failed boot is tried again: after the current screen
     * and the save's last flush, which may still read what it holds, and before the renderer is destroyed and Hosting
     * closes.
     */
    readonly runtime: Disposables;
    readonly services: RuntimeServices;
}
```

#### `ScreenDef` (interface)

One screen of the flow: its id, whether it pauses the sim, its kind and fonts, and `enter`, which mounts it.
Everything `enter` starts goes in `context.screen`, which the flow disposes when the screen is left.

```ts
interface ScreenDef {
    readonly id: string;
    readonly pausesSim?: boolean;
    /** `gameplay` lets the cursor policy hide an idle pointer; a `menu` (the default) never does. */
    readonly kind?: 'menu' | 'gameplay';
    readonly fonts?: readonly string[];
    /** A throw, or a rejected promise, is the screen's failure: the flow shows the error panel with Try again. */
    enter(context: ScreenContext): void | Promise<void>;
    openMenu?(): boolean;
}
```

#### `ScreenFrame` (const)

Every screen's frame: the visible region, a corner row, then a hero and a body.

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

#### `ScreensCopy` (interface)

Every word the default title, play, paused and settings screens show.

```ts
interface ScreensCopy {
    readonly title: {
        readonly play: string;
    };
    /** The play screen's corner button and the touch stick, read by assistive technology. */
    readonly play: {
        readonly pause: string;
        readonly move: string;
    };
    readonly paused: {
        readonly title: string;
        readonly resume: string;
        /** The dialog's ✕ on the menu: not Resume, so a screen reader hears one Resume button, not two. */
        readonly close: string;
        /** The dialog's ✕ away from the menu (the quit confirm, the changed-elsewhere step). */
        readonly back: string;
        readonly mute: string;
        readonly unmute: string;
        readonly settings: string;
        readonly quit: string;
        readonly quitPrompt: string;
        readonly quitConfirm: string;
        readonly cancel: string;
        /** Why play paused when a controller in use was unplugged. */
        readonly reconnect: string;
    };
    readonly settings: {
        readonly screen: SettingsScreenCopy;
        readonly prompts: PromptCopy;
        readonly controls: ControlsCopy;
        readonly language: LanguageCopy;
        readonly vibration: VibrationCopy;
        readonly audio: AudioCopy;
        readonly touch: TouchCopy;
        readonly display: DisplayCopy;
    };
    readonly saves: {
        readonly slots: SaveSlotsCopy;
        readonly status: SaveStatusCopy;
        readonly changedElsewhere: ChangedElsewhereCopy;
        readonly changedElsewhereToast: string;
    };
    /** The scored board on the paused screen. */
    readonly board: LeaderboardCopy;
    /** Told once when a controller the input does not support is plugged in. */
    readonly padUnsupported: string;
}
```

#### `ScreensCopyInput` (type)

A game's words for the default screens: a part of the record, or a function of the player's locale returning one.
The function runs again on each language change, so a Paraglide game can pass its messages:
`screens: () => ({ title: { play: m.play() } })`.

```ts
type ScreensCopyInput = ScreensCopyOverrides | ((locale: string) => ScreensCopyOverrides);
```

#### `ScreensCopyOverrides` (type)

A part of `ScreensCopy` with every group optional, down to the words; a word or a function is replaced whole.

```ts
type ScreensCopyOverrides<T = ScreensCopy> = {
    readonly [K in keyof T]?: T[K] extends Leaf ? T[K] : ScreensCopyOverrides<T[K]>;
};
```

#### `ScreensGame` (interface)

What the default screens need from the game.

```ts
interface ScreensGame {
    readonly title: string;
    readonly sim: {
        readonly plugins: readonly PluginDef[];
        readonly seed: number;
        readonly setup?: ((sim: Sim) => void) | undefined;
        readonly content?: unknown;
    };
    readonly input?: InputMap | undefined;
    /** Told the sim play runs, and `undefined` when the title drops it: the draw layer reads it. */
    readonly watchSim?: ((sim: Sim | undefined) => void) | undefined;
    /** The board paused shows: the game's first scored board. None: paused shows no board. */
    readonly board?: string | undefined;
    /** Applies the player's graphics quality to the stage: the saved one at the title, then each choice. */
    readonly setQuality?: ((tier: QualityTier) => void) | undefined;
    /** The game's save: the title lists its slots and play keeps the loaded one saved. None: no slot list. */
    readonly saves?: GameSaves<unknown> | undefined;
    /** The game's extensions: play draws their `hud.overlay` components, Settings shows their `settings.sections`. */
    readonly extensions?: readonly ExtensionDef[] | undefined;
    /** The game's words for these screens (`GameSpec.copy.screens`), over the English defaults. */
    readonly copy?: ScreensCopyInput | undefined;
}
```

#### `ScrollList` (const)

A list that keeps its rows.

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

#### `Settings` (interface)

The booted game's settings as a runtime service: its key and store, both undefined for a game without
settings.

```ts
interface Settings {
    readonly key: string | undefined;
    readonly store: SettingsStore<unknown> | undefined;
}
```

#### `SettingsDef` (interface)

A game's settings: the key it is saved under, its version, schema, defaults and migration steps, and which
fields stay on one device.

```ts
interface SettingsDef<S> {
    readonly key: string;
    readonly version: number;
    readonly schema: z.ZodType<S>;
    readonly defaults: S;
    readonly migrations?: Readonly<Record<number, (record: Record<string, unknown>) => Record<string, unknown>>>;
    /**
     * Fields that belong to one device: kept in its `DeviceStorage`, never in the player's saves, and the saves'
     * copy is never read. The rest of the record is the player's, as for any settings. Names, not
     * `keyof S`, so a `SettingsDef<S>` stays assignable where `SettingsDef<unknown>` is wanted; `createSettings`
     * refuses a name the defaults do not have.
     */
    readonly deviceFields?: readonly string[];
}
```

#### `SettingsScreenCopy` (interface)

The Settings screen's own words: its title, Back, the tabs and the overflow count.

```ts
interface SettingsScreenCopy {
    readonly title: string;
    readonly back: string;
    readonly tabs: string;
    readonly settingsTab: string;
    readonly controlsTab: string;
    readonly more: (count: number) => string;
}
```

#### `settingsStore` (function)

The booted store for `def`. Throws when `def` is not the game's settings: asking for another key is the game's
mistake, and a store made up on the spot would save under a key nothing reads.

```ts
function settingsStore<S>(settings: Settings, def: SettingsDef<S>): SettingsStore<S>;
```

#### `Sheet` (const)

A Modal on the bottom edge at every form factor: the same scoping, Close and
scroll region, where a thumb reaches the actions. Settings' sub-pages and a "more" menu use it.

```ts
const Sheet: import("svelte").Component<ModalProps, {}, "">;
type Sheet = ReturnType<typeof Sheet>;
```

#### `Sim` (interface)

A running simulation, stepped with commands, that can snapshot, restore and hash its state. `step` is the
only way gameplay state changes. Create one with `createSim`, and `dispose` it when done.

```ts
interface Sim {
  readonly seed: number
  readonly tickHz: number
  readonly tick: number
  /** XXH64 of the canonical content this sim was created with, 16 hex digits; the snapshot header's value. */
  readonly contentHash: string
  step(commands: readonly Command[]): StepResult
  /** Setup and inspection outside `step` (tests, scene setup). Runtime changes go through commands. */
  spawn(parts: readonly SpawnPart[]): number
  entity(sid: number): EntityRef | undefined
  query(...components: ComponentDef[]): EntityRef[]
  resource<Z extends z.ZodType>(def: ResourceDef<Z>): z.output<Z>
  /** Canonical snapshot v1 bytes. */
  snapshot(): Uint8Array
  /** Replaces the whole state. Throws SnapshotFormatError / SnapshotMismatchError and leaves the sim unchanged. */
  restore(bytes: Uint8Array): void
  /**
   * A readable view of `bytes`, or of the current state when none are given. Decodes and checks
   * the header as `restore` does (SnapshotFormatError / SnapshotMismatchError) but not restore's later
   * cross-checks, and changes nothing.
   */
  describeSnapshot(bytes?: Uint8Array): SnapshotView
  /** xxhash64 of the snapshot, 16 hex digits. */
  hash(): string
  /** Frees the Koota world and every plugin's engine. Idempotent; any later call throws SimDisposedError. */
  dispose(): void
}
```

#### `SimContext` (interface)

What a system's `run` receives each tick.

```ts
interface SimContext {
  readonly tick: number
  /** Fixed step, 1 / tickHz. */
  readonly dt: number
  /** This system's own RNG substream. */
  readonly rng: Rng
  /** Compiled content, deep-frozen. */
  readonly content: unknown
  /** Live entities that have every listed component, in ascending StableId order. */
  query(...components: ComponentDef[]): EntityRef[]
  entity(sid: number): EntityRef | undefined
  /** Spawns immediately; returns the new StableId. */
  spawn(...parts: SpawnPart[]): number
  /** Despawn is deferred to the end of the tick (built-in `entities.flush`). */
  despawn(sid: number): void
  readonly commands: {
    of<Z extends z.ZodType>(def: CommandDef<Z>): ReadonlyArray<CommandRecord<z.output<Z>>>
  }
  emit<Z extends z.ZodType>(def: EventDef<Z>, payload: z.input<Z>): void
  resource<Z extends z.ZodType>(def: ResourceDef<Z>): z.output<Z>
  /** The per-sim state of the plugin that registered this system (`definePlugin({ state })`), else undefined. */
  readonly pluginState: unknown
}
```

#### `Slider` (const)

A number in a range: a labelled native `<input type="range">`, so the browser
gives the arrow keys and the focus navigator's `adjust` steps it. `valueText` gives the value its
words for assistive technology (`aria-valuetext`), and the same words show beside the track. The
thumb is a 44 px target, checked by the layout contract.

```ts
const Slider: import("svelte").Component<Props, {}, "">;
type Slider = ReturnType<typeof Slider>;
```

#### `Split` (const)

Two panes side by side where both fit at `min` px, stacked otherwise. Measured, because a container query cannot read a prop; stacked
until the first measurement, so a pane never starts squeezed.

```ts
const Split: import("svelte").Component<Props, {}, "">;
type Split = ReturnType<typeof Split>;
```

#### `sprite` (function)

A sprite that follows its component's `x`, `y` and `angle`, interpolated between ticks. `source` is a
texture or a url: a url the runtime already loaded (it is in `Assets.cache`) shows at once; otherwise the
sprite is empty until `Assets.load` resolves. A url that fails to load is reported with `reportError`
and the sprite stays empty. The frame textures are sliced once per factory and shared by its sprites.
With `frame`, the url is an atlas page's Spritesheet and the sprite shows that frame; a name the atlas lacks
is reported the same way.

```ts
function sprite(source: Texture | string, options?: SpriteViewOptions): EntityViewFactory;
```

#### `SpriteFrames` (interface)

The texture is a sheet of equal frames, read left to right, top to bottom. The pose component's numeric
`frame` field picks one (floored, wrapped by the frame count); with no `frame` field the first is shown.
Frames switch on ticks; they are not interpolated.

```ts
interface SpriteFrames {
    readonly width: number;
    readonly height: number;
    /** Default: every whole frame that fits in the texture. */
    readonly count?: number | undefined;
}
```

#### `SpriteViewOptions` (interface)

A `sprite` view's anchor and either its sprite-sheet frames or one frame of a packed atlas.

```ts
interface SpriteViewOptions {
    /** Default 0.5 (centred on the entity's position). */
    readonly anchor?: ViewAnchor | undefined;
    readonly frames?: SpriteFrames | undefined;
    /**
     * A frame of a packed atlas: `source` is the url of an atlas page's Spritesheet JSON, which
     * `automata-content assets` writes, and `frame` names one of its frames. Not with `frames`.
     */
    readonly frame?: string | undefined;
}
```

#### `startGame` (function)

Boots a game: `defineGame`'s defaults over the runtime, the Pixi renderer, Ruken hosting
and the default screens, then the runtime's boot on the game's root. Takes a spec or a game `defineGame`
already returned. Throws `BootDefect` before anything mounts when the spec is invalid or there is no
root (`spec.root`, else `#game`); a failure after that shows on the runtime's boot failure panel. `start.at` starts on
another screen than the flow's entry, for a restart in development (`StartOptions`).

```ts
function startGame<S = never>(game: GameSpec<S> | DefinedGame<S>, start?: StartOptions): RuntimeHandle;
```

#### `StartOptions` (interface)

How a game starts.

```ts
interface StartOptions {
    /**
     * The screen to start on instead of the flow's entry, for a restart in development that brings the person back
     * where they were (a tuning change restarts the game on new content). A screen the flow does not have starts at
     * the entry. The start screen's assets load as it enters, as any screen's do after boot.
     */
    readonly at?: string | undefined;
}
```

#### `StepResult` (interface)

What one `step` produced: the new tick, the events emitted, the renderer's delta and the commands that were
rejected.

```ts
interface StepResult {
  /** The tick the sim is at after this step. */
  readonly tick: number
  readonly events: readonly SimEvent[]
  readonly render: RenderDelta
  /** Invalid commands, in input order. The sim has no I/O, so it reports instead of logging. */
  readonly rejected: readonly RejectedCommand[]
}
```

#### `STICKY_MARGIN_PX` (const)

How far outside a button a thumb still counts for it, in CSS pixels.

```ts
const STICKY_MARGIN_PX = 24;
```

#### `SubscriptionEntitlement` (interface)

One subscription the player holds. The host computes `active`.

```ts
interface SubscriptionEntitlement {
    sku: string;
    plan: 'monthly' | 'season';
    active: boolean;
    seasonId?: string | undefined;
    /** ISO 8601 UTC instant. */
    endsAt?: string | undefined;
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

#### `SystemDef` (interface)

A system: a name, the phase it runs in, the systems it must run `before` or `after` within that phase, and
its `run`, called once per tick. Create one with `defineSystem`.

```ts
interface SystemDef {
  readonly kind: 'system'
  readonly name: string
  readonly phase: Phase
  readonly before: readonly string[]
  readonly after: readonly string[]
  readonly run: (ctx: SimContext) => void
}
```

#### `TAURI_MARKERS` (const)

String literals only Tauri's IPC code contains, which survive minification: the global the webview injects
(`@tauri-apps/api/core`) and the process plugin's exit command (`@tauri-apps/plugin-process`). A `tauri` build holds
both; a `web`, `itch` or `ruken` build holds neither. Re-check them after a Tauri upgrade:
`target.build.test.ts` fails if a `tauri` build stops containing them.

```ts
const TAURI_MARKERS: readonly string[];
```

#### `Time` (interface)

The time service: whether the sim is paused, and why; each reason pauses until it is resumed.

```ts
interface Time {
    readonly paused: boolean;
    readonly reasons: ReadonlySet<PauseReason>;
    pause(reason: PauseReason): void;
    resume(reason: PauseReason): void;
}
```

#### `Toast` (const)

A passing message: "Pad connected", "Saved", "This controller is not supported".
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

An on/off setting: a native checkbox with the switch role, so the browser gives
Space and the focus navigator's `adjust` flips it. The state shows in words (`onLabel`,
`offLabel`) beside the track, never in colour alone.

Controlled, as OptionGroup is: a click reports the new state through `onchange`, and the box
shows the `checked` it is given.

```ts
const Toggle: import("svelte").Component<Props, {}, "">;
type Toggle = ReturnType<typeof Toggle>;
```

#### `TouchButton` (interface)

One on-screen touch button: every key bound to the same payload shares it.

```ts
interface TouchButton {
    readonly id: string;
    readonly label: string;
    readonly keys: readonly string[];
    /** Which lower corner's group it sits in. Default `start`; a game moves buttons to `end` itself. */
    readonly side?: 'start' | 'end' | undefined;
    /** The game cannot be played without it: where the touch buttons do not all fit, only these show. */
    readonly required?: boolean | undefined;
}
```

#### `TouchControls` (const)

The on-screen touch buttons.

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

#### `Translate` (type)

The typed `t` verb: `t('hello', { name })`, checked against the game's compiled messages.

```ts
type Translate<Messages> = <K extends keyof Messages & string>(key: K, ...inputs: InputsOf<Messages[K]>) => string;
```

#### `turnUnitsFromPixels` (function)

`dxPx` dragged at `degPerPixel` as whole turn units: positive for a drag to the right (which way that turns the
heading is the game's convention), negated when `invert`, clamped to ±`MAX_TURN_UNITS_PER_STEP`. Halves round away
from zero, so a drag left and the same drag right are the same size. A non-finite input or a `degPerPixel` that is
not positive gives 0, and the result is never −0.

```ts
function turnUnitsFromPixels(dxPx: number, degPerPixel: number, invert: boolean): number;
```

#### `typedBus` (function)

Cast a PresentationBus instance to a typed view with game-specific fact types.
Safe because PresentationBus stores facts dynamically by string key.

```ts
function typedBus<GameFacts>(bus: PresentationBus<object>): PresentationBus<GameFacts>;
```

#### `ViewportWindow` (interface)

The parts of `window` the owner reads; a fake from `@automata/framework/testing` stands in for it in tests.

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

### `import { … } from '@automata/framework/extension'`

#### `defineExtension` (function)

Returns its argument. It exists so the name keeps its literal type and `pnpm style` can find extensions.

```ts
function defineExtension<const N extends string>(def: ExtensionDef<N>): ExtensionDef<N>;
```

#### `ExtensionDef` (interface)

One opt-in feature of a game. Build it with `defineExtension`.

```ts
interface ExtensionDef<Name extends string = string> {
    /** Kebab-case and unique. */
    readonly name: Name;
    /** Names of other extensions that must come first. */
    readonly requires?: readonly string[];
    /** `definePlugin` results; they pass the determinism checker. */
    readonly sim?: readonly PluginDef[];
    /** `defineContentSchema` results. */
    readonly content?: readonly ContentSchemaDef[];
    /** Components for the named ui slots. An extension fills the slots it wants, and cannot add a slot. */
    readonly ui?: {
        readonly slots?: Readonly<Partial<Record<UiSlotName, UiComponent>>>;
    };
    /** Called at build time with the game's manifest facts. */
    readonly manifest?: (config: GameConfig) => RukenManifestContribution;
}
```

#### `ExtensionError` (class)

A bad extension list. Thrown, not returned, so a game's Vite build fails with `message`.

```ts
class ExtensionError extends Error {
    readonly _tag: "ExtensionError";
    readonly reason: ExtensionErrorFields['reason'];
    readonly names: readonly string[];
    constructor(fields: ExtensionErrorFields);
}
```

#### `GameConfig` (type)

The parts of the game config an extension may read (content's `GameConfig`).

```ts
type GameConfig = Pick<FullGameConfig, 'game' | 'runtime' | 'content'>;
```

#### `ResolvedExtensions` (interface)

Everything the runtime and the build tools need from a game's extension list, in one fixed order.

```ts
interface ResolvedExtensions {
    /** Extension names: `requires` first, ties by name. */
    readonly order: readonly string[];
    /** In extension order; the game passes them to `createSim`. */
    readonly simPlugins: readonly PluginDef[];
    /** For the content Vite plugin's `schemas`. */
    readonly contentSchemas: readonly ContentSchemaDef[];
    /** Every extension's component for that slot, in order. */
    slots(name: UiSlotName): readonly UiComponent[];
    /** The contributions merged: preload lists concatenated, a repeated path keeps its first place. */
    manifest(config: GameConfig): RukenManifestContribution;
}
```

#### `resolveExtensions` (function)

Checks the list and puts it in a fixed order. Throws `ExtensionError`, synchronously, so a game's
Vite config fails the build with the message. At run time the build has already resolved the same
list, so a throw there is a defect.

```ts
function resolveExtensions(defs: readonly ExtensionDef[]): ResolvedExtensions;
```

#### `RukenManifestContribution` (type)

What an extension may add to ruken.toml: preload files. `wants` is not a manifest field.

```ts
type RukenManifestContribution = {
    readonly loading?: {
        readonly preload?: readonly string[];
    };
};
```

### `import { … } from '@automata/framework/testing'`

#### `BAR_ACTIONS` (const)

The selector for the controls a player presses in a bar: the buttons, links, tabs and menu items inside a region a
screen or an editor declares with `data-region` (`topbar`, `rail`, `panel`, `dock`, `tools`). `findCutByBar` and
`findCovered` take it as their `selector`, and `checkLayout` runs both with it.

```ts
const BAR_ACTIONS: string;
```

#### `byTestId` (function)

The element a test id names; throws when the fixture has none, so a missing part fails loudly.

```ts
function byTestId(id: string): HTMLElement;
```

#### `checkLayout` (function)

The checks every screen shares: the document never scrolls; every control is at least the conditions' target
(primaries the primary target) at this scale, on screen unless in a declared scroll region,
never under a reserved area or a touch button and never over the corner row; the corner row's controls and any
`data-way-out` stay reachable (but under a modal dialog or an ErrorPanel that had to rise); no
ActionBar wraps (level 3); no row (`[data-row]`) clips what it holds; no control is cut at the side of the scroll
region it scrolls in (`findCutAtSide`: a region declared `data-scroll-region="both"` scrolls sideways too), no
action in a bar is cut by it (`findCutByBar`) or covered (`findCovered`), and no control's words run past its edge; and each of `essentials` is reachable without scrolling.

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
    /** The sizes every control is held to (`TOUCH_TARGETS` unless the screen is held with a mouse). */
    readonly targets: Targets;
}
```

#### `describeHostingContract` (function)

Registers the `Hosting` contract's cases as a Vitest `describe` block named after `name`. `create` builds a fresh
`Hosting` for each case, with `saves` granted; `settled` lets the host answer (for example one macrotask). Every
target's adapter and `FakeHosting` pass these cases. Each case disposes its `Hosting`.

```ts
function describeHostingContract(name: string, create: HostingFactory, settled: Settle): void;
```

#### `documentScrolls` (function)

The document itself never scrolls; screens scroll inside declared regions.

```ts
function documentScrolls(doc: Document): string[];
```

#### `errorPanelFloor` (function)

The least height any of an ErrorPanel's layouts needs, measured here rather than read from the
panel, so a panel that misjudges its room cannot excuse itself. For each layout
(`row`, `stack`, `row-tight`) it lays the panel out, keeps the layout only where its message is
readable there (20 characters or the whole panel, half that in `row-tight`, and clear of the
actions), and takes the panel's chrome, one message line and the actions as laid out. The
panel's own layout is put back after.

```ts
function errorPanelFloor(panel: HTMLElement): number;
```

#### `FakeAudioContext` (interface)

A recording stand-in for an `AudioContext`: what was started, stopped and automated, with a clock tests
move by hand.

```ts
interface FakeAudioContext extends AudioContextLike {
    state: AudioContextLike['state'];
    currentTime: number;
    readonly gains: FakeGainNode[];
    readonly started: Started[];
    readonly stopped: Array<{
        readonly alias: string;
        readonly when: number;
    }>;
    readonly resumed: number;
    readonly closed: boolean;
    /** Moves the clock on, ending every source whose stop time it passes. */
    advance(seconds: number): void;
    /** As the system does for a phone call or Siri. */
    interrupt(): void;
    /** Ends a source as if it played out. */
    end(alias: string): void;
}
```

#### `fakeAudioContext` (function)

`decode` turns the bytes `decodeAudioData` receives into a buffer, or throws as the browser does for bytes that
are not audio; by default the bytes are the alias's UTF-8 text.

```ts
function fakeAudioContext(decode?: (bytes: ArrayBuffer) => AudioBuffer): FakeAudioContext;
```

#### `fakeBuffer` (const)

A decoded buffer that remembers the alias it came from, so `started` can name it.

```ts
const fakeBuffer: (alias: string, duration?: number) => AudioBuffer;
```

#### `fakeFetch` (function)

Creates an in-memory fetch implementation for deterministic loading tests.

```ts
function fakeFetch(routes: Readonly<Record<string, FakeRoute>>, options?: FakeFetchOptions): FakeFetchResult;
```

#### `FakeFetchOptions` (interface)

Options for `fakeFetch`: the fetch that answers urls with no route.

```ts
interface FakeFetchOptions {
    readonly fallback?: typeof fetch;
}
```

#### `FakeFetchResult` (interface)

The fake fetch, and the urls it was asked for and saw aborted.

```ts
interface FakeFetchResult {
    readonly fetch: typeof fetch;
    readonly requests: string[];
    readonly aborted: string[];
}
```

#### `FakeGainNode` (interface)

A gain node of `fakeAudioContext`, recording its value, its targets and its automation.

```ts
interface FakeGainNode {
    readonly targets: unknown[];
    readonly automation: Array<{
        readonly method: string;
        readonly value?: number;
        readonly at: number;
    }>;
    readonly gain: {
        value: number;
    };
}
```

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
        readonly mapping?: '' | 'standard';
        readonly id?: string;
    }): void;
    unplug(index?: number): void;
    press(button: number, value?: number, index?: number): void;
    release(button: number, index?: number): void;
    /** The left stick. */
    stick(x: number, y: number, index?: number): void;
}
```

#### `FakeHostControl` (interface)

What a test does to, and reads from, the fake host.

```ts
interface FakeHostControl {
    /** Makes `ready` resolve (with `deferReady`). */
    welcome(): void;
    /** Makes `ready` fail with `code` (with `deferReady`). */
    failReady(code: ErrorCode): void;
    /** Sends the game a host change. Each payload is checked by its contract schema, so a bad fixture throws here. */
    readonly push: {
        lifecycle(payload: LifecyclePayload): void;
        input(payload: InputModePayload): void;
        display(payload: DisplayMetricsPayload): void;
        audio(payload: AudioChange): void;
        entitlements(payload: EntitlementsPayload): void;
        savesStatus(status: SavesStatus): void;
        /** Another device's write: the host's saves change and `saves.changed` carries it. */
        savesChanged(payload: SavesChangedPayload): void;
    };
    /** The host's saves now. */
    readonly saved: ReadonlyMap<string, string>;
    /** Makes the next call named `operation` (for example `saves.set`) fail with `code`. */
    failNext(operation: string, code: ErrorCode): void;
    /** Holds every call named `operation` unanswered until `release(operation)`, so a test can time it out. */
    hold(operation: string): void;
    release(operation: string): void;
    readonly tracked: readonly TrackedEvent[];
    readonly exits: readonly ('player' | 'completed')[];
    /** Every fullscreen request, in order. */
    readonly fullscreen: readonly boolean[];
    /** Every round start and end the host received (after the contract's guard), in order. */
    readonly rounds: readonly ({
        readonly start: true;
    } | {
        readonly end: RoundOutcome | undefined;
    })[];
    readonly submits: readonly Submission[];
    /** The host's "Open game menu": the latest handler's answer, or false before `ready` or with none. */
    requestMenu(): boolean;
    /** The host closes the game: the exiting handlers in order, then the save flush, all within `HOST_EXIT_CAP_MS`. */
    close(): Promise<void>;
}
```

#### `fakeHosting` (function)

A fake host and the control handle that drives it. `create` builds the game's `Hosting`; `dispose()` shuts it down
(later calls are refused `CANCELLED`, every subscription stops). `clock` times the exit cap.

```ts
function fakeHosting(options?: FakeHostingOptions): {
    readonly control: FakeHostControl;
    create(hosting: HostingOptions, clock?: Clock): Hosting;
    /** `create` in the shape of the runtime's `seams.hosting`: boot's clock times the exit cap; never refused. */
    make(hosting: HostingOptions, seams?: {
        readonly clock?: Clock;
    }): Promise<HostResult<Hosting>>;
};
```

#### `FakeHostingOptions` (interface)

How the fake host starts. Every field has a default, so `fakeHosting()` is a web page with saves.

```ts
interface FakeHostingOptions {
    /** The target to stand in for: its `kind`, `hostName`, grants and error codes. Default `web`. */
    readonly target?: FakeTarget;
    /** The capabilities granted, in place of the target's default ones. */
    readonly granted?: readonly Capability[];
    /** When true, `ready` waits for `control.welcome()` (or `control.failReady`); otherwise it is ready at once. */
    readonly deferReady?: boolean;
    readonly player?: {
        readonly id: string;
        readonly displayName: string;
    };
    readonly locale?: string;
    /** The game's title, which the desktop target uses as its `hostName`. Default `Game`. */
    readonly title?: string;
    /** Saves already on the host when the session starts. */
    readonly saves?: Readonly<Record<string, string>>;
    /** Whether the player consented to analytics. Default true; false drops every `track`. */
    readonly consent?: boolean;
    readonly lifecycle?: LifecyclePayload;
    readonly input?: InputModePayload;
    readonly display?: DisplayMetricsPayload;
    readonly audio?: AudioChange;
    readonly entitlements?: EntitlementsPayload;
    readonly savesStatus?: SavesStatus;
}
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

#### `FakeRoute` (interface)

How `fakeFetch` answers one url: a status, the body in chunks, a content length or type, a hang or a
network error.

```ts
interface FakeRoute {
    readonly status?: number;
    readonly chunks?: readonly Uint8Array[];
    readonly contentLength?: number;
    readonly hang?: boolean;
    readonly networkError?: boolean;
    readonly type?: string;
}
```

#### `FakeTarget` (type)

The four distribution targets a fake host can stand in for (ADR 0006).

```ts
type FakeTarget = 'web' | 'itch' | 'ruken' | 'tauri';
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

#### `findCovered` (function)

Each visible control `selector` names is on top at its centre: what is drawn there is the control or inside it. A
modal dialog may cover it (the page behind a modal is inert), and so may anything `excused` says may: an ErrorPanel
that had to rise over the bar, for one. The same rule `findCoveredCorners` holds the corner row to.

```ts
function findCovered(root: ParentNode, selector: string, excused?: (cover: Element) => boolean): string[];
```

#### `findCutAtSide` (function)

No control is cut at a side of a declared scroll region that clips it (see `clippedBy`). A region scrolls up and
down, so a control past its side is cut where a player would not think to scroll, as a long language's options
were in a Settings list; `findOffscreenControls` passes whatever a region clips, so this is what catches a control
cut across. A region that scrolls sideways on purpose (an editor's strip of scenes) declares
`data-scroll-region="both"`: a control past its side is reached by scrolling it, and the walk out through the
regions around it stops there. A checkbox or radio is judged by its label (`pressedPart`).

```ts
function findCutAtSide(root: ParentNode): string[];
```

#### `findCutByBar` (function)

Each visible control `selector` names is whole inside every ancestor that clips its overflow. `findClipped` measures
a node's own vertical overflow, so a button that its bar cuts across (a phone's top bar hid Publish) is never seen
by it. An ancestor that is a declared scroll region (`data-scroll-region`) may hold a control past its side: the
player scrolls to it, and `findCutAtSide` judges the region.

```ts
function findCutByBar(root: ParentNode, selector: string): string[];
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
    edge?: 'left' | 'right';
    width?: number;
    scale?: DisplayMetricsPayload['scale'];
    safeArea?: DisplayMetricsPayload['safeArea'];
}): DisplayMetricsPayload;
```

#### `HostingFactory` (type)

An adapter under test: a fresh `Hosting` per case, with `saves` granted.

```ts
type HostingFactory = () => Hosting | Promise<Hosting>;
```

#### `installFakeResizeObserver` (function)

Replaces the global `ResizeObserver` with a fake that reports only the widths you give it, for components
measured under jsdom, which has no layout. Call `restore` when the test ends.

```ts
function installFakeResizeObserver(): FakeResizeObserver;
```

#### `LayoutRect` (interface)

Layout assertions as plain DOM functions (`expectReachable`, `expectControlsFit`, `expectRowsWhole`,
`expectApart`, `expectNoDocumentScroll`).

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

#### `ManualFrames` (interface)

A frame source a test drives: `advance` moves time on and runs the frame asked for, if any.

```ts
interface ManualFrames extends FrameSource {
    advance(ms: number): void;
    readonly pending: boolean;
}
```

#### `manualFrames` (function)

A frame source that runs a frame only when a test advances it, starting at `startMs`.

```ts
function manualFrames(startMs?: number): ManualFrames;
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

#### `nullRenderer` (function)

A renderer that draws nothing and records each call in `log`, for runtime tests without a GPU.

```ts
function nullRenderer(log?: NullRendererEntry[], options?: NullRendererOptions): RendererFactory;
```

#### `NullRendererEntry` (type)

One call `nullRenderer` recorded.

```ts
type NullRendererEntry = {
    readonly type: 'apply';
    readonly tick: number;
} | {
    readonly type: 'draw';
    readonly alpha: number;
} | {
    readonly type: 'reset';
} | {
    readonly type: 'destroy';
};
```

#### `NullRendererOptions` (interface)

Options for `nullRenderer`: `fail` makes it fail `RendererUnavailable`.

```ts
interface NullRendererOptions {
    readonly fail?: boolean;
}
```

#### `openRuntimeTest` (function)

Boots the runtime for screen and integration tests, as `runGame` does but without the loader or failure panel:
`openHostingTest` behind the scenes, page layers and geometry, the settings, the save, the services, and the flow
started when there are screens. A host refusal throws the `HostError` boot would show; a refused renderer throws its
reason. Whatever opened before a throw is closed.

```ts
function openRuntimeTest(options?: RuntimeTestOptions): Promise<RuntimeTestSession>;
```

#### `pressedPart` (function)

What a player presses for `control`: a checkbox's or radio's label (the theme draws it as the control, and a
press anywhere on it toggles the input), else the control itself.

```ts
function pressedPart(control: HTMLElement): HTMLElement;
```

#### `publishConditions` (function)

Measures and publishes the geometry for `size` under `variant`, as the owner would; `targets` are the control sizes the checks hold.

```ts
function publishConditions(root: HTMLElement, size: ReferenceSize, variant: Variant, targets?: Targets): Conditions;
```

#### `REFERENCE_SIZES` (const)

The viewports a layout is checked at: phones in both orientations, tablets, desktops, both sides of every
breakpoint and the tightest sizes, each with the classification it should get.

```ts
const REFERENCE_SIZES: readonly ReferenceSize[];
```

#### `ReferenceFormFactor` (type)

The geometry owner's `FormFactor`.

```ts
type ReferenceFormFactor = 'phone-portrait' | 'phone-landscape' | 'tablet-portrait' | 'desktop';
```

#### `ReferenceHeightTier` (type)

The geometry owner's `HeightTier`.

```ts
type ReferenceHeightTier = 'short' | 'compact' | undefined;
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
    readonly group: 'phone' | 'tablet' | 'desktop' | 'boundary' | 'tight';
}
```

#### `RuntimeTestOptions` (interface)

What `openRuntimeTest` boots: the fake host, the screens, content, settings and save, and the frames, renderer,
fetch and locale it uses.

```ts
interface RuntimeTestOptions {
    readonly hosting?: HostingTestOptions | Partial<Omit<FakeHostOptions, 'gameOrigin' | 'gameId'>>;
    readonly screens?: readonly ScreenDef[];
    readonly content?: CompiledContentData;
    readonly settings?: SettingsDef<unknown>;
    /** The game's save, opened as boot opens it: its triggers and exit flush run, and `saveOf(def)` finds it. */
    readonly saves?: SaveDef<unknown>;
    /** Where settings fields kept on the device go; default a fresh in-memory one, so a test never meets the browser's. */
    readonly deviceStorage?: DeviceStorage;
    readonly frames?: ManualFrames | FrameSource;
    readonly renderer?: GameRenderer | RendererFactory;
    readonly fetch?: typeof fetch;
    /** The game's languages (a Paraglide `runtime.js`); absent, the content's source language alone. */
    readonly locale?: LocaleDef;
    /** The browser's languages, best first; default none. */
    readonly languages?: readonly string[];
    /** Builds the audio context on the first gesture; defaults to `fakeAudioContext()`. */
    readonly createAudioContext?: () => AudioContextLike;
    /** The clock the runtime's timers run on (the stall rule, fades, toasts, the exit cap); default the real one. */
    readonly clock?: Clock;
    /** The wall clock saves are stamped with; default `Date.now`. */
    readonly now?: () => number;
}
```

#### `RuntimeTestSession` (interface)

A booted runtime over the fake Ruken host: every service a screen reads, the host's handle and the page layers.

```ts
interface RuntimeTestSession {
    readonly services: RuntimeServices;
    readonly handle: FakeHostHandle;
    readonly layers: PageLayers;
    /** Closes everything the session opened, last opened first: the screen, the save, the renderer, then the host. */
    dispose(): Promise<void>;
}
```

#### `Settle` (type)

Lets the fake Ruken host answer over its in-memory ports (for example one macrotask).

```ts
type Settle = () => Promise<void>;
```

#### `settleLayout` (function)

Waits until a freshly mounted fixture has finished laying out: fonts loaded, then two frames, so
ResizeObserver callbacks (ActionBar's collapse, ScrollList's measure) and the re-layout they
cause have run. A semantic wait, not a sleep.

```ts
function settleLayout(): Promise<void>;
```

#### `Submission` (interface)

One leaderboard submission the host received.

```ts
interface Submission {
    readonly board: string;
    readonly score: number;
    readonly meta?: LeaderboardSubmitMeta | undefined;
}
```

#### `Targets` (interface)

The smallest a control may be drawn, in CSS px before the display's scale: `hit` for any control, `primary` for one marked `data-primary`.

```ts
interface Targets {
    readonly hit: number;
    readonly primary: number;
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

#### `TOUCH_TARGETS` (const)

The touch rule, every game screen's default: a control is at least 44 px, a primary 48. Only a screen held with a
mouse (an editor on a desktop) may pass smaller targets, and then it proves the touch rule again with touch.

```ts
const TOUCH_TARGETS: Targets;
```

#### `TrackedEvent` (interface)

One analytics event the host received.

```ts
interface TrackedEvent {
    readonly event: string;
    readonly props?: AnalyticsProps | undefined;
}
```

#### `Variant` (interface)

A condition layered over a reference size. Each field that is set applies; the caller turns them
into the geometry owner's inputs (a covered visual viewport, Ruken's display metrics).

```ts
interface Variant {
    readonly name: 'rest' | 'keyboard' | 'host-reserved-right' | 'host-reserved-left' | 'tv-scale';
    /** Px of the height the on-screen keyboard covers at this size. */
    readonly keyboard?: (size: ReferenceSize) => number;
    /** Ruken's reserved strip (its fixture is 48 px wide). */
    readonly hostReserved?: {
        readonly edge: 'left' | 'right';
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

#### `withRuntimeTest` (function)

Runs `program` on an open runtime and always closes it.

```ts
function withRuntimeTest<A>(program: (session: RuntimeTestSession) => Promise<A> | A, options?: RuntimeTestOptions): Promise<A>;
```

### `import { … } from '@automata/framework/tooling'`

#### `isDefinedGame` (function)

Whether `value` came from `defineGame`.

```ts
function isDefinedGame<S>(value: GameSpec<S> | DefinedGame<S>): value is DefinedGame<S>;
```

## `@automata/sim`

### `import { … } from '@automata/sim'`

#### `canonicalJson` (function)

Canonical JSON: object keys sorted at every depth, no whitespace. Numbers use the ECMAScript
Number-to-string algorithm, which every engine implements identically, except that -0 is written as -0.
Throws CanonicalJsonError for anything JSON can't represent exactly: NaN, Infinity, undefined, bigint,
functions, symbols, and non-plain objects (a Date, Map, Set, typed array or class instance would otherwise
serialize as {} and hash the same as every other one).

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

Input to the sim, the only way gameplay state changes from outside. `source` is a player slot (u8), `seq` a per-source counter (u32).

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

Anything `definePlugin`'s flat `defs` list takes.

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
object form also takes `before`/`after`. All three build the same SystemDef.

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

Fixed phase order.

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

Engine state a plugin keeps outside the ECS, such as a Rapier world. `createSim` creates
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

What changed for the renderer since the last delta. `changed` rows carry the entity's full
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
  /** Canonical snapshot v1 bytes. */
  snapshot(): Uint8Array;
  /** Replaces the whole state. Throws SnapshotFormatError / SnapshotMismatchError and leaves the sim unchanged. */
  restore(bytes: Uint8Array): void;
  /**
   * A readable view of `bytes`, or of the current state when none are given. Decodes and checks
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

The sim package's version, written into replay headers for information only. A constant
rather than a build-time define, so workspace tests and un-built replays carry the real version; the release's
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

What a system's `run` receives each tick.

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
`hash` until a successful `restore`. Failing closed is cheaper than rolling back every tick.

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

A readable copy of a snapshot, for diffs and reports. Plugin bytes are opaque engine state,
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

### `import { … } from '@automata/sim/hash'`

#### `canonicalJson` (function)

Canonical JSON: object keys sorted at every depth, no whitespace. Numbers use the ECMAScript
Number-to-string algorithm, which every engine implements identically, except that -0 is written as -0.
Throws CanonicalJsonError for anything JSON can't represent exactly: NaN, Infinity, undefined, bigint,
functions, symbols, and non-plain objects (a Date, Map, Set, typed array or class instance would otherwise
serialize as {} and hash the same as every other one).

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

### `import { … } from '@automata/sim/math'`

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

### `import { … } from '@automata/sim/replay'`

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

Larger than 1 MiB because goldens carry reference snapshots; player replays may pass less.

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

Bytes that are not a valid `.replay`. `offset` is the byte where reading failed, when known.

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

### `import { … } from '@automata/sim/testing'`

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

### `import { … } from '@automata/sim/testing/commands'`

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

### `import { … } from '@automata/sim/testing/property'`

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

## `@automata/tools`

### `import { … } from '@automata/tools'`

#### `defineShipConfig` (function)

Identity function that gives a game's `ship.config.ts` type checking and editor completion.

```ts
function defineShipConfig(config: ShipConfig): ShipConfig;
```

#### `ItchConfig` (interface)

What a game writes in `ship.config.ts`.

```ts
interface ItchConfig {
  /** The itch.io project as butler names it: `user/game`, lower case. */
  readonly project: string;
  /** The butler channel. Defaults to `html5`. */
  readonly channel?: string | undefined;
  /**
   * The butler channel of each desktop bundle (`publish --target itch --from tauri`). Each defaults to
   * its OS's name: `linux`, `mac`, `windows`.
   */
  readonly downloads?: {
    readonly linux?: string | undefined;
    readonly mac?: string | undefined;
    readonly windows?: string | undefined;
  } | undefined;
}
```

#### `ItchSettings` (interface)

The checked settings, with the channel filled in.

```ts
interface ItchSettings {
  readonly project: string;
  readonly channel: string;
  readonly downloads: {
    readonly linux: string;
    readonly mac: string;
    readonly windows: string;
  };
}
```

#### `ShipConfig` (interface)

What a game tells ship about itself: the game config every target reads (`@automata/content`'s
`GameConfig`) and each target's own section. Keys keep Ruken's manifest names and snake_case, so
the config reads like the `ruken.toml` the Ruken target writes from it (ship fills in `schema` and `allow_eval`,
always false); `prepare --target ruken` checks the whole of it with Ruken's own parser.

```ts
interface ShipConfig extends GameConfig {
  /**
   * Where `automata ship publish --target itch` pushes. Not a Ruken field: it is never written to
   * `ruken.toml`, and a Ruken build ignores it.
   */
  readonly itch?: ItchConfig | undefined;
  /**
   * The desktop build's settings (`automata ship prepare --target tauri`). Not a Ruken field: it is
   * never written to `ruken.toml`.
   */
  readonly tauri?: TauriConfig | undefined;
  /**
   * Who the game's builds are for. `private` is a game that carries `@pixi/3d`, a closed beta (D-1), until Pixi 3D's
   * public release: `automata ship prepare` then checks the build as private and writes no `ruken.toml`, and only
   * `publish --private` ships it. Not a Ruken field. Left out, a game is `public`.
   */
  readonly audience?: "public" | "private" | undefined;
}
```

#### `TauriConfig` (interface)

What a game writes in `ship.config.ts` to build for the desktop.

```ts
interface TauriConfig {
  /**
   * The app's reverse-DNS identifier, unique to the game (`dev.mcthaydt.emberwick`): letters, digits and hyphens in
   * two or more dot-separated parts, the first starting with a letter, and not ending in `.app`
   * (https://v2.tauri.app/reference/config/#identifier).
   */
  readonly identifier: string;
  /** A square PNG of at least 512 px for the app's icon, relative to the game's folder. Left out, ship draws one. */
  readonly icon?: string | undefined;
}
```
