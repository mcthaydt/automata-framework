# Automata cheatsheet

> Every export of every published `@mcthaydt/automata-*` entry point, one line each, grouped by module (package). Generated from the API index by `pnpm cheatsheet` after `pnpm build`; do not edit by hand. `pnpm api-index` fails when this page is stale. Full signatures and doc comments: the API reference (`api.md`).

## `@mcthaydt/automata`

### `import { … } from '@mcthaydt/automata'`

- `AnalogOptions` (interface): The `analog` option of `keys()`.
- `AnalogReading` (interface): The analog input at one fixed step, read once after `Input.poll()`.
- `AutosavePolicy` (interface): When the loaded slot writes itself: on each listed trigger, with `intervalSeconds` for the `interval` timer.
- `AutosaveTrigger` (type): What can make the loaded slot write itself (M5 spec §4.4).
- `Camera2d` (interface): A presentation-only 2D camera over one container: it follows a target, shakes, and writes only that container's transform, never a sim value.
- `Camera2dOptions` (interface): How `createCamera2d` frames the world: the view's size, and optionally a follow, bounds and zoom.
- `CameraRect` (interface): A world-space rectangle, in logical px: `Camera2dOptions.bounds`.
- `ChangedElsewhereCopy` (interface): The words of the choice paused offers once another device has changed the slot being played (M5-D6).
- `Command` (interface): Input to the sim (spec §4.4 rule 4).
- `CommandDef` (interface): A command the sim accepts as input: an id and the Zod schema its payload must match.
- `ComponentDef` (interface): A component: a stable id and a flat record of typed fields.
- `createCamera2d(stage, options, seed?)`: A camera writing `stage`'s transform (usually `PixiStage.world`).
- `defaultContent()`: The default flow `title → play ⇄ paused → title`, with `paused ⇄ settings` (M4.4), and its hash.
- `defaultScreens(game)`: The title, play, paused and settings screens (DX spec §7, M4.4) over the default content's flow (`title → play ⇄ paused → title`, `paused ⇄ settings`).
- `defineCommand(id, schema)`: Defines a command by id and payload schema.
- `defineComponent(id, fields, opts?)`: Defines a component from an id (lower-case words separated by dots or dashes) and its fields by name and type.
- `DefinedGame` (interface): The runtime's `GameDefinition`, plus what the screens and the golden replay read from the spec.
- `defineEvent(id, schema)`: Defines an event by id and payload schema, to emit from a system with `ctx.emit`.
- `defineGame(spec)`: Checks a spec and fills in every default over the runtime, the Pixi renderer, Ruken hosting and the default screens; `startGame` boots the result.
- `definePlugin(spec)`: Defines a plugin from a name, its dependencies and its definitions, given in the keyed lists or in one flat `defs` list sorted by kind.
- `defineResource(id, schema, init)`: Defines a resource by id, schema and starting value.
- `defineSave(def)`: Declares a save.
- `defineSystem(name, run)`, `defineSystem(name, phase, run)`, `defineSystem(spec)`, `defineSystem(nameOrSpec, phaseOrRun?, run?)`: A system: `defineSystem(name, run)` runs in `gameplay`, `defineSystem(name, phase, run)` in that phase, and the object form also takes `before`/`after`.
- `DrawContext` (interface): What `draw` receives each frame.
- `DrawEntity` (interface): One entity, read-only: its components' values are frozen copies.
- `DrawSim` (interface): The sim at this frame, read-only.
- `DrawTextOptions` (interface): Options for `DrawContext.text`: colour and font size.
- `EntityRef` (interface): A live entity, addressed by its StableId.
- `EventDef` (interface): An event a system emits: an id and the Zod schema its payload must match.
- `GameCopy` (type): A game's words: the runtime's boot and failure copy, and the default screens' words (DX.2d).
- `GameSaves` (interface): What a game saves, and how the default screens read it from the sim and put it back (M5.2).
- `GameSpec` (interface): A game in one object (DX spec §3.1): its id, size and sim, and optionally its title, input, views, sounds, scores, saves, content, screens, settings, extensions, draw layer and host and renderer options.
- `GameSpecError` (class): Every invalid field of a spec, by path: `size.width: …`.
- `InputMap` (interface): Held keys, touch buttons and gamepad buttons, turned into one command per tick (DX spec §3.3).
- `inputs(...maps)`: One input map from `maps`, each sending its own command every tick in map order.
- `InputSource` (interface): The input map attached to a window for one play session.
- `KeyBindings` (type): By `KeyboardEvent.code`, so the keys sit in the same place on every keyboard layout.
- `keys(command, bindings, options?)`: An input map sending `command` once per tick with the payload of what is held: keys by `KeyboardEvent.code`, on-screen touch buttons, gamepad buttons, the stick and gestures, merged over the idle payload.
- `KeysOptions` (interface): Options for `keys`: touch buttons, gamepad buttons, gestures and the stick, the idle payload, required keys and the Controls section's labels.
- `PluginDef` (interface): A bundle of definitions the sim registers together: components, commands, events, resources and systems, the plugins it depends on, and optionally per-sim engine state and `config`.
- `postFilter(name, spec)`: Declares a screen-space filter over the whole picture: `renderer: { postFilters: [postFilter('vignette', { glsl, wgsl })] }`.
- `PostFilterDef` (interface): A declared filter, as `postFilter` returns it and `PixiRendererOptions.postFilters` takes it.
- `PostFilterSpec` (interface): What a screen-space filter is made of: the same effect written twice, for WebGL2 (`glsl`) and WebGPU (`wgsl`), so the two renderers stay at parity.
- `rect(options)`: A filled rectangle that follows its component's `x`, `y` and `angle`, interpolated between ticks: `entityViews: { [Body.id]: rect({ w: 8, h: 8, color: 0xf9c22b }) }`.
- `RectViewOptions` (interface): A `rect` view's size, colour and anchor.
- `ResourceDef` (interface): A value the sim keeps once, not on any entity: an id, a Zod schema and the `init` that gives its starting value.
- `SaveDef` (interface): A game's save: one record, or a fixed number of slots, each one Ruken key.
- `ScreensCopy` (interface): Every word the default title, play, paused and settings screens show (DX spec §7, M4 spec §4.8, M5 spec §4.8).
- `ScreensCopyInput` (type): A game's words for the default screens: a part of the record, or a function of the player's locale returning one.
- `ScreensCopyOverrides` (type): A part of `ScreensCopy` with every group optional, down to the words; a word or a function is replaced whole.
- `ScreensGame` (interface): What the default screens need from the game.
- `SettingsScreenCopy` (interface): The Settings screen's own words: its title, Back, the tabs and the overflow count.
- `Sim` (interface): A running simulation, stepped with commands, that can snapshot, restore and hash its state.
- `SimContext` (interface): What a system's `run` receives each tick (spec §4.1).
- `sprite(source, options?)`: A sprite that follows its component's `x`, `y` and `angle`, interpolated between ticks.
- `SpriteFrames` (interface): The texture is a sheet of equal frames, read left to right, top to bottom.
- `SpriteViewOptions` (interface): A `sprite` view's anchor and either its sprite-sheet frames or one frame of a packed atlas.
- `startGame(game)`: Boots a game (DX spec §3.1): `defineGame`'s defaults over the runtime, the Pixi renderer, Ruken hosting and the default screens, then the runtime's boot on the game's root.
- `StepResult` (interface): What one `step` produced: the new tick, the events emitted, the renderer's delta and the commands that were rejected.
- `SystemDef` (interface): A system: a name, the phase it runs in, the systems it must run `before` or `after` within that phase, and its `run`, called once per tick.
- `TouchButton` (interface): One on-screen touch button: every key bound to the same payload shares it.

## `@mcthaydt/automata-content`

### `import { … } from '@mcthaydt/automata-content'`

- `AssetsSource` (interface): What `content/assets.toml` says: for each screen, the files it waits for (`dir/*` names every file in a folder), and the atlases and fonts of the asset build it uses, by their names in `atlases.toml` and `fonts.toml`.
- `buildContent` (const): Compiles, writes every output under the output folder, then removes the outputs it no longer produces.
- `checkTuningLayer(layer, options, { complete })`: Checks one layer of tuning against code-owned declarations.
- `compileContent` (const): Compiles `<root>/content` in memory.
- `CompiledContent` (interface): The result of a compile: the content and its hash, the sim partition, every output file's text, warnings, the languages and each language's message catalog.
- `ContentCompileFailed` (class): The authored content has problems.
- `ContentConfig` (type): The default export of `automata.content.ts`.
- `ContentData` (type): The compiled content as it is written to `content.json` and hashed.
- `ContentGenerator` (interface): A generator: a unique name and a pure `generate` that turns compiled content into extra files.
- `contentHash(data)`: 16 lowercase hex digits.
- `ContentOptions` (interface): What the content compiler is given: the project root, the registered kinds, and optionally tunables, invariants, flow capabilities, generators, an output folder and Paraglide.
- `contentRef(kind)`: The ID of another content item of `kind`.
- `ContentSchemaDef` (interface): A content kind a game registers: its name, the Zod schema each item must match, where its TOML files live, and whether the sim receives it.
- `ContentSchemaOptions` (interface): Options for `defineContentSchema`; `sim: false` keeps the kind out of the sim's content and its hash.
- `ContentSchemaPlace` (type): Where a kind's files are: every TOML file under a folder (a collection), or one file (a document).
- `ContentWriteFailed` (class): An output could not be written.
- `DEFAULT_OUT_DIR` (const): Where outputs go when `outDir` is not set: `content/generated`, relative to the project root.
- `DEFAULT_PALETTE` (const): The palette a game gets when it has no `content/palette.toml`: Endesga 64.
- `defineContentGenerator(name, generate)`: Defines a generator by name and `generate` function.
- `defineContentSchema(kind, schema, place, options?)`: Registers a content kind: a name, its Zod schema, and a folder (every TOML file in it is an item) or one file (a single document).
- `Diagnostic` (interface): One authoring problem: a stable `code`, the file to open, the 1-based line and column, the dotted key inside it and a message that says what to write instead.
- `DiagnosticCode` (type): Stable codes.
- `FlowCapabilities` (interface): What the game's code implements: the screens, and optionally the pairs and destinations each allows.
- `FlowGraph` (interface): The checked screen flow from `flow.toml`: the entry screen, every screen, the terminal screens and every transition, in a fixed order.
- `FlowTransition` (interface): One checked move in the flow: on `event` the game goes `from` one screen `to` another, drawn in the `transition` style (`cut` when unwritten).
- `formatDiagnostic(d)`: `content/tuning.toml:12:1 GRAVITY outOfRange: expected -1200..-100, received -2000`
- `GAME_ID_PATTERN` (const): A game id and a board id: lower-case letters, digits and hyphens, starting with a letter or digit, up to 64.
- `GameConfig` (interface): What every target knows about a game.
- `gameConfigSchema` (const): Checks a game's config.
- `GameSource` (interface): What `content/game.toml` says about the game: its source language, rating, content descriptors, estimated hours, the analytics events it may send, and the screens whose files are preloaded.
- `GeneratorInput` (interface): Everything a generator is given: the compiled content and its hash, the sim partition, the registered schemas, the message catalog and the tuning metadata.
- `GeneratorOutput` (interface): What a generator returns: files to write and diagnostics to report.
- `Input` (type): One input a game can be played with.
- `INPUTS` (const): The inputs a game can be played with.
- `InvalidContentConfig` (class): The game's code registered something unusable (a duplicate kind, a clashing generator).
- `LEADERBOARD_ORDERS` (const): The orders a score board sorts in.
- `LeaderboardConfig` (interface): A score board a game declares.
- `localized()`: Text a player reads, written in the source language.
- `MessageCatalog` (type): One locale's messages: message key to translated text.
- `messageKey(kind, id, path)`: The message key of one text.
- `MessageLocation` (interface): A message's place in its file, 1-based.
- `Orientation` (type): One orientation a game supports.
- `ORIENTATIONS` (const): The orientations a game supports.
- `Palette` (interface): The game's palette: a name and its colors.
- `ParaglideOptions` (interface): Where and which catalogs `ContentOptions.paraglide` compiles with Paraglide on build.
- `PreloadInput` (interface): What `preloadList` reads: the content options (to compile `game.toml` and `assets.toml`, and to find the asset build's outputs below `outDir`) and the built game folder.
- `preloadList` (const): The files Ruken preloads before the game starts, in order, for `[loading] preload`: each `preload_screens` screen's files from `assets.toml` (the flow's entry when none is named), then the pages of the atlases and every language's subset of the fonts it names there, which `automata-content assets` wrote below `outDir` and the build serves in `atlases/` and `fonts/`; without repeats.
- `Rating` (type): One content rating.
- `RATINGS` (const): The content ratings a game declares.
- `Renderer` (type): One renderer a game may ask for.
- `RENDERERS` (const): The renderers a game may ask for.
- `renderTuningTable(meta)`: Every tunable once, sorted by name, with its type, range and value in `content/tuning.toml`.
- `RukenFields` (type): The game config's `content` and `analytics` sections (Ruken's `[content]` and `[analytics]` tables), worked out from `game.toml` and the languages present and written to `ruken-fields.json`.
- `SimPartition` (interface): The part of the compiled content the sim receives (`tuning` and every kind with `sim: true`) and its hash, which gates snapshots and replays.
- `sortDiagnostics(diagnostics)`: Returns the diagnostics in the one fixed order (file, line, column, key, code, message), without changing the input.
- `TunableDeclaration` (interface): A tunable a game declares in code: `int` or `float`, an inclusive range and a default.
- `TunableDeclarations` (type): A game's tunables by name (upper-case words joined by underscores, such as `GRAVITY`).
- `TuningMeta` (type): Every tunable's type, value and range (`min`, `max`, `step`) by name, as written to `tuning-meta.json` for debug sliders.
- `verifyContent` (const): Fails with `staleArtifact` for each committed output that differs from a fresh compile.
- `withTuningTable(guide, meta)`: The guide with its generated section replaced, or undefined when it has no markers.

### `import { … } from '@mcthaydt/automata-content/assets'`

- `ATLAS_EXTRUDE` (const): Pixels of each frame's edge repeated around it, so filtering never samples a neighbour.
- `ATLAS_PADDING` (const): Transparent pixels between cells, and between a cell and the page edge.
- `ATLAS_PAGE_MAX` (const): The largest atlas page side, in pixels: WebGL2's guaranteed `MAX_TEXTURE_SIZE`.
- `AtlasFrameTooLarge` (class): A frame that cannot fit a page even alone.
- `AtlasOutputs` (interface): What `buildAtlases` produces; the caller writes it.
- `buildAtlases` (const): Builds every atlas `<root>/content/atlases.toml` names, or fails with every problem found.
- `buildFonts` (const): Builds every subset `<root>/content/fonts.toml` names, or fails with every problem found.
- `fontCoverage(font)`: Whether a font file (TrueType, OpenType, woff or woff2) has a glyph for each character.
- `FontOutputs` (interface): What `buildFonts` produces; the caller writes it.
- `FontsFile` (interface): `content/fonts.toml`: each source font by name.
- `FontSource` (interface): One source font: its committed file, the sha256 of its bytes, its licence and the languages it serves.
- `FrameSize` (interface): A frame to pack: its name (the PNG's file name without `.png`) and size in pixels.
- `PackedAtlas` (interface): Every frame's placement, and the pages they fill.
- `packFrames(frames)`: Packs `frames` into atlas pages.
- `Placement` (interface): Where a frame's own pixels are: inside its extrusion, on page `page`.
- `subsetWoff2(source, characters)`: The font cut to `characters`, as woff2.

### `import { … } from '@mcthaydt/automata-content/game-config'`

- `GAME_ID_PATTERN` (const): A game id and a board id: lower-case letters, digits and hyphens, starting with a letter or digit, up to 64.
- `GameConfig` (interface): What every target knows about a game.
- `gameConfigSchema` (const): Checks a game's config.
- `Input` (type): One input a game can be played with.
- `INPUTS` (const): The inputs a game can be played with.
- `LEADERBOARD_ORDERS` (const): The orders a score board sorts in.
- `LeaderboardConfig` (interface): A score board a game declares.
- `Orientation` (type): One orientation a game supports.
- `ORIENTATIONS` (const): The orientations a game supports.
- `Rating` (type): One content rating.
- `RATINGS` (const): The content ratings a game declares.
- `Renderer` (type): One renderer a game may ask for.
- `RENDERERS` (const): The renderers a game may ask for.

### `import { … } from '@mcthaydt/automata-content/locale'`

- `ALWAYS_CHARACTERS` (const): Printable ASCII, CJK symbols and punctuation, half- and full-width forms, and the symbols the UI draws.
- `catalogCharacters(catalog)`: Every character the catalog's messages show.
- `ContentText` (type): `text(kind, id, path, authored, inputs?)`: the text in the active locale, or the authored text.
- `ContentTextOptions` (interface): Options for `createContentText`.
- `createContentText(messages, options?)`: A lookup over the messages module Paraglide compiles into `paraglide.outdir` (its `messages.js`, imported whole).
- `endonymOf(tag)`: A language's name in its own language ("日本語" for `ja`), from the browser's `Intl.DisplayNames`.
- `hasRawText(text)`: True when a piece of visible text has English in it that did not come from the xx-long catalog: any ASCII letter outside a ⟦ ⟧ span.
- `localeCharacters(catalog)`: A locale's own characters for its subset font: `ALWAYS_CHARACTERS` and the catalog's characters.
- `MessageCatalog` (type): One locale's messages: message key to translated text.
- `messageKey(kind, id, path)`: The message key of one text.
- `MessageValue` (type): A value in an inlang message file: a message, a list of variants, or a namespace or variant object.
- `PSEUDO_LOCALE` (const): The pseudo-locale's tag.
- `pseudoLocalize(message)`: The xx-long form of one message string.
- `pseudoMessages(file)`: The xx-long form of a whole message file (the inlang message format): nested namespaces are walked, plural variants keep their `declarations` and `selectors` (they are code, not text) and only their `match` texts change.
- `snakeKey(value)`: `snow-shrine` → `snow_shrine`, `fastFall` → `fast_fall`, `melee/sword` → `melee_sword`.

### `import { … } from '@mcthaydt/automata-content/palette'`

- `DEFAULT_PALETTE` (const): The palette a game gets when it has no `content/palette.toml`: Endesga 64.
- `Palette` (interface): The game's palette: a name and its colors.

### `import { … } from '@mcthaydt/automata-content/schema'`

- `contentRef(kind)`: The ID of another content item of `kind`.
- `ContentSchemaDef` (interface): A content kind a game registers: its name, the Zod schema each item must match, where its TOML files live, and whether the sim receives it.
- `ContentSchemaOptions` (interface): Options for `defineContentSchema`; `sim: false` keeps the kind out of the sim's content and its hash.
- `ContentSchemaPlace` (type): Where a kind's files are: every TOML file under a folder (a collection), or one file (a document).
- `defineContentSchema(kind, schema, place, options?)`: Registers a content kind: a name, its Zod schema, and a folder (every TOML file in it is an item) or one file (a single document).
- `localized()`: Text a player reads, written in the source language.

### `import { … } from '@mcthaydt/automata-content/vite'`

- `automataContent(pluginOptions?)`: The Vite plugin that compiles content and serves it as `virtual:automata/content`.
- `AutomataContentOptions` (type): The plugin's options: `ContentOptions`, with `root` defaulting to Vite's root.
- `VIRTUAL_MODULE_ID` (const): The import path of the compiled content: `content`, `contentHash`, `simContent` and `simContentHash`.

## `@mcthaydt/automata-game`

### `import { … } from '@mcthaydt/automata-game'`

- `AnalogOptions` (interface): The `analog` option of `keys()`.
- `AnalogReading` (interface): The analog input at one fixed step, read once after `Input.poll()`.
- `AutosavePolicy` (interface): When the loaded slot writes itself: on each listed trigger, with `intervalSeconds` for the `interval` timer.
- `AutosaveTrigger` (type): What can make the loaded slot write itself (M5 spec §4.4).
- `Camera2d` (interface): A presentation-only 2D camera over one container: it follows a target, shakes, and writes only that container's transform, never a sim value.
- `Camera2dOptions` (interface): How `createCamera2d` frames the world: the view's size, and optionally a follow, bounds and zoom.
- `CameraRect` (interface): A world-space rectangle, in logical px: `Camera2dOptions.bounds`.
- `ChangedElsewhereCopy` (interface): The words of the choice paused offers once another device has changed the slot being played (M5-D6).
- `createCamera2d(stage, options, seed?)`: A camera writing `stage`'s transform (usually `PixiStage.world`).
- `defaultContent()`: The default flow `title → play ⇄ paused → title`, with `paused ⇄ settings` (M4.4), and its hash.
- `defaultScreens(game)`: The title, play, paused and settings screens (DX spec §7, M4.4) over the default content's flow (`title → play ⇄ paused → title`, `paused ⇄ settings`).
- `DefinedGame` (interface): The runtime's `GameDefinition`, plus what the screens and the golden replay read from the spec.
- `defineGame(spec)`: Checks a spec and fills in every default over the runtime, the Pixi renderer, Ruken hosting and the default screens; `startGame` boots the result.
- `defineSave(def)`: Declares a save.
- `DrawContext` (interface): What `draw` receives each frame.
- `DrawEntity` (interface): One entity, read-only: its components' values are frozen copies.
- `DrawSim` (interface): The sim at this frame, read-only.
- `DrawTextOptions` (interface): Options for `DrawContext.text`: colour and font size.
- `GameCopy` (type): A game's words: the runtime's boot and failure copy, and the default screens' words (DX.2d).
- `GameSaves` (interface): What a game saves, and how the default screens read it from the sim and put it back (M5.2).
- `GameSpec` (interface): A game in one object (DX spec §3.1): its id, size and sim, and optionally its title, input, views, sounds, scores, saves, content, screens, settings, extensions, draw layer and host and renderer options.
- `GameSpecError` (class): Every invalid field of a spec, by path: `size.width: …`.
- `InputMap` (interface): Held keys, touch buttons and gamepad buttons, turned into one command per tick (DX spec §3.3).
- `inputs(...maps)`: One input map from `maps`, each sending its own command every tick in map order.
- `InputSource` (interface): The input map attached to a window for one play session.
- `KeyBindings` (type): By `KeyboardEvent.code`, so the keys sit in the same place on every keyboard layout.
- `keys(command, bindings, options?)`: An input map sending `command` once per tick with the payload of what is held: keys by `KeyboardEvent.code`, on-screen touch buttons, gamepad buttons, the stick and gestures, merged over the idle payload.
- `KeysOptions` (interface): Options for `keys`: touch buttons, gamepad buttons, gestures and the stick, the idle payload, required keys and the Controls section's labels.
- `postFilter(name, spec)`: Declares a screen-space filter over the whole picture: `renderer: { postFilters: [postFilter('vignette', { glsl, wgsl })] }`.
- `PostFilterDef` (interface): A declared filter, as `postFilter` returns it and `PixiRendererOptions.postFilters` takes it.
- `PostFilterSpec` (interface): What a screen-space filter is made of: the same effect written twice, for WebGL2 (`glsl`) and WebGPU (`wgsl`), so the two renderers stay at parity.
- `rect(options)`: A filled rectangle that follows its component's `x`, `y` and `angle`, interpolated between ticks: `entityViews: { [Body.id]: rect({ w: 8, h: 8, color: 0xf9c22b }) }`.
- `RectViewOptions` (interface): A `rect` view's size, colour and anchor.
- `SaveDef` (interface): A game's save: one record, or a fixed number of slots, each one Ruken key.
- `ScreensCopy` (interface): Every word the default title, play, paused and settings screens show (DX spec §7, M4 spec §4.8, M5 spec §4.8).
- `ScreensCopyInput` (type): A game's words for the default screens: a part of the record, or a function of the player's locale returning one.
- `ScreensCopyOverrides` (type): A part of `ScreensCopy` with every group optional, down to the words; a word or a function is replaced whole.
- `ScreensGame` (interface): What the default screens need from the game.
- `SettingsScreenCopy` (interface): The Settings screen's own words: its title, Back, the tabs and the overflow count.
- `sprite(source, options?)`: A sprite that follows its component's `x`, `y` and `angle`, interpolated between ticks.
- `SpriteFrames` (interface): The texture is a sheet of equal frames, read left to right, top to bottom.
- `SpriteViewOptions` (interface): A `sprite` view's anchor and either its sprite-sheet frames or one frame of a packed atlas.
- `startGame(game)`: Boots a game (DX spec §3.1): `defineGame`'s defaults over the runtime, the Pixi renderer, Ruken hosting and the default screens, then the runtime's boot on the game's root.
- `TouchButton` (interface): One on-screen touch button: every key bound to the same payload shares it.

### `import { … } from '@mcthaydt/automata-game/tooling'`

- `isDefinedGame(value)`: Whether `value` came from `defineGame`.

## `@mcthaydt/automata-host`

### `import { … } from '@mcthaydt/automata-host'`

- `AnalyticsProps` (type): The properties of one analytics event: flat names to strings, numbers or booleans.
- `AudioChange` (interface): The host's audio state: focus (an ad or overlay may duck or mute the game), the master volume, and the gain.
- `AudioChangeSchema` (const): Checks an audio change.
- `CAPABILITIES` (const): What a game may ask its host for (DIST spec §4.1).
- `Capability` (type): One capability a game may ask for.
- `CapabilitySchema` (const): Checks a capability name.
- `DisplayMetricsPayload` (interface): The game's display: insets the game must keep clear, the area the host reserves for its own controls, and the UI scale hint (1.333 on a TV: enlarge text and targets, never CSS zoom).
- `DisplayMetricsPayloadSchema` (const): Checks display metrics.
- `EntitlementsPayload` (interface): What the player owns: whether ads show, permanent items and subscriptions, and whether this is a dev build.
- `EntitlementsPayloadSchema` (const): Checks entitlements.
- `ERROR_CODES` (const): Why a host call failed (DIST spec §4.1).
- `ErrorCode` (type): One error code.
- `ErrorCodeSchema` (const): Checks an error code.
- `findRukenSdkMarkers(code)`: The markers found in `code` (built JavaScript), each named once; empty means no Ruken SDK code.
- `findTauriMarkers(code)`: The Tauri markers found in `code` (built JavaScript), each named once; empty means no Tauri IPC code.
- `FullscreenRes` (interface): The answer to a fullscreen request: the new state, and how this device can go fullscreen at all.
- `FullscreenResSchema` (const): Checks a fullscreen answer.
- `HOST_EXIT_CAP` (const): How long the game may hold the host's close (Ruken P6 §4 "1 s cap").
- `HostError` (class): Any failure after the handshake.
- `HostHandshakeFailed` (class): The page is inside a frame, but the SDK got no usable welcome and fell back to its standalone session.
- `Hosting` (interface): Everything a game may ask of, or hear from, its host: the `Hosting` contract of the M1 shared contracts spec §1, implemented by the host lane.
- `HostingLeaderboards` (interface): The host's leaderboards (Ruken's `LeaderboardsApi`, PRODUCT spec §2 F1).
- `HostingOptions` (interface): What the game asks of its host.
- `HostingSaves` (interface): The player's saves (shared contracts §1.1).
- `HostingSeams` (interface): Test seams.
- `InputMode` (type): How the player is playing right now.
- `InputModePayload` (interface): The current input mode, and the gamepad when one is in use.
- `InputModePayloadSchema` (const): Checks an input mode change.
- `LeaderboardEntry` (interface): One row of a board.
- `LeaderboardGetRes` (interface): The rows of a board.
- `LeaderboardGetResSchema` (const): Checks a board's rows.
- `LeaderboardQuery` (interface): Which entries to read from a board.
- `LeaderboardQuerySchema` (const): Checks a board query.
- `LeaderboardSubmitMeta` (type): Extra facts sent with a score, passed to the host as they are.
- `LeaderboardSubmitMetaSchema` (const): Checks a score's extra facts.
- `LeaderboardSubmitRes` (interface): The host's answer to a submitted score.
- `LeaderboardSubmitResSchema` (const): Checks a submit answer.
- `LifecyclePayload` (interface): Whether the game is in front, and if not, why.
- `LifecyclePayloadSchema` (const): Checks a lifecycle change.
- `LifecycleReason` (type): Why the game is in the background.
- `PauseBehavior` (type): Whether the game pauses when it goes to the background; fixed for the game's whole life.
- `PauseBehaviorSchema` (const): Checks a pause behavior.
- `RoundOutcome` (type): How a round ended.
- `RoundOutcomeSchema` (const): Checks a round outcome.
- `RUKEN_SDK_MARKERS` (const): String literals only the Ruken SDK contains, which survive minification (PUB spec §3): the SDK's storage probe key (`env-browser.ts`) and its standalone refusal message (`standalone.ts`), at RukenApp d0fa2fe (as at b30d31b).
- `SavesChangedPayload` (interface): Another device's write, or the host's conflict choice, reached this session.
- `SavesChangedPayloadSchema` (const): Checks a saves change.
- `SavesFlushRes` (interface): Where a flush left the saves: the host's outbox, its server, or the device's own storage (`'device'`, the `web`, `itch` and `tauri` targets; DIST-D3).
- `SavesFlushResSchema` (const): Checks a flush answer.
- `SavesStatus` (type): Where the player's saves stand with the host.
- `SavesStatusSchema` (const): Checks a saves status.
- `SubscriptionEntitlement` (interface): One subscription the player holds.
- `TAURI_MARKERS` (const): String literals only Tauri's IPC code contains, which survive minification: the global the webview injects (`@tauri-apps/api/core`) and the process plugin's exit command (`@tauri-apps/plugin-process`).

### `import { … } from '@mcthaydt/automata-host/contract-suite'`

- `describeHostingContract(name, layer, settled)`: Registers the `Hosting` contract's cases as a Vitest `describe` block named after `name`.
- `HostingLayer` (type): An adapter under test: a fresh layer per case, with `saves` granted.
- `Settle` (type): Lets the fake Ruken host answer over its in-memory ports, and forked stream readers subscribe.

### `import { … } from '@mcthaydt/automata-host/testing'`

- `FakeHostClock` (interface): The clock shape `@ruken/sdk-host`'s fake host takes; the game's `SdkEnv.timers` run on it too.
- `FakeHostHandle` (interface): The fake host behind `HostingTest`, for tests that drive the host side.
- `HostingTest(options?)`: `HostingLive` wired to `@ruken/sdk-host`'s fake host over in-memory ports, with the real SDK in between (shared contracts §1.1).
- `HostingTestOptions` (interface): What to change about `HostingTest`'s defaults: the game's hosting options, the fake host, the SDK environment and the game's origin.
- `manualClock(startMs?)`: SDK and fake-host timing (hello retries, the 10 s handshake give-up, request timeouts) runs on this clock, so a test can step past them without waiting (shared contracts §1.4).
- `ManualClock` (interface): A clock that moves only when the test calls `advance`.
- `realClock` (const): Real time, for tests that only need the host to answer.
- `runScoped(program)`: Runs a test program in a fresh scope, closing it (and every layer built inside) at the end.
- `TEST_GAME_ORIGIN` (const): The origin `HostingTest` serves the game from unless `gameOrigin` says otherwise.

## `@mcthaydt/automata-node`

### `import { … } from '@mcthaydt/automata-node'`

- `FileError` (class): Reading, writing, listing or removing a file failed.
- `Files` (interface): The service's tag.
- `FilesLive` (const): `Files` on `node:fs`: synchronous calls wrapped in `Effect.try`, so the first failure surfaces as a `FileError`.
- `FilesService` (interface): The file operations build-time code needs, each as an Effect.
- `ProcessError` (class): A program could not be started (not found, not executable).
- `ProcessRunner` (interface): The service's tag; see `Files` for why it is not a `Context.Tag` class.
- `ProcessRunnerLive` (const): `ProcessRunner` on `node:child_process`: the real programs, with the parent's environment plus `RunOptions.env`.
- `ProcessRunnerService` (interface): Runs a program with arguments and no shell.
- `RunOptions` (interface): How a program is started: its working folder, extra environment, stdin, and whether its output is also echoed.
- `RunResult` (interface): What a finished program left: its exit code (128 when a signal killed it) and everything it wrote to stdout and stderr, decoded as UTF-8.
- `TaggedErrorClass` (type): The class `Data.TaggedError(tag)` returns, written out. isolatedDeclarations cannot infer the type of a call in an `extends` clause, so each error extends a constant annotated with this type instead (the pattern of `content`'s compile errors and `host`'s errors).

## `@mcthaydt/automata-render-pixi`

### `import { … } from '@mcthaydt/automata-render-pixi'`

- `Camera2d` (interface): A presentation-only 2D camera over one container: it follows a target, shakes, and writes only that container's transform, never a sim value.
- `Camera2dOptions` (interface): How `createCamera2d` frames the world: the view's size, and optionally a follow, bounds and zoom.
- `CameraRect` (interface): A world-space rectangle, in logical px: `Camera2dOptions.bounds`.
- `canvasResolutionFor(formFactor, devicePixelRatio, tier?)`: Calculates device pixels per CSS pixel for the canvas.
- `CompositeTarget` (class): The fixed-resolution composite (M4 spec §4.11).
- `createCamera2d(stage, options, seed?)`: A camera writing `stage`'s transform (usually `PixiStage.world`).
- `createPixiRenderer(options?)`: The core 2D renderer (ADR 0002) as a runtime `RendererFactory`: a letterboxed Pixi app on the render target, entity views from each step's render delta, interpolated each frame.
- `createPostFilterSlot(target)`: A post-filter slot writing its composed filters to `target`'s `filters`.
- `DEFAULT_BAR_COLOR` (const): The letterbox bars' default colour (FloorFifty's plum black).
- `DEFAULT_BAR_FRACTION` (const): How much of the playfield's height each letterbox bar crops in a landscape view, by default (5%).
- `DEFAULT_FIELD_COLOR` (const): The default colour behind the playfield, under the world.
- `EntityView` (interface): What an entity view factory returns: the container drawn for one entity, updated with its current and previous component values and the interpolation alpha, and destroyed when the entity goes.
- `EntityViewFactory` (type): Builds the view for one entity, or `undefined` to draw nothing.
- `EntityViewResolver` (type): Which view an entity gets: one factory for every entity, or factories by component id (the first id, in the record's own key order, whose component the entity has wins).
- `FILTER_VERTEX` (const): The GLSL vertex stage every AF filter shares: it passes the texture coordinate and the pixel position (`vPixelCoord`) to the fragment stage.
- `filterPrograms(name, fragmentGlsl, fragmentWgsl)`: Builds a filter's programs from its GLSL and WGSL fragment stages on the shared vertex stages, so WebGL2 stays at parity with WebGPU (AGENTS.md).
- `FilterProgramsResult` (interface): A filter's WebGL2 and WebGPU programs, for a Pixi `Filter`'s `glProgram` and `gpuProgram`.
- `interpolatePose(curr, prev, alpha)`: The pose between the previous tick (`alpha = 0`) and the current one (`alpha = 1`).
- `lerp(a, b, t)`: Linear blend; `t = 1` returns `b` exactly, because `a + (b - a)` can round away from it.
- `lerpAngle(a, b, t)`: Blends two angles (radians) along the shorter arc, so a body turning from just under π to just over -π swings through π instead of spinning the long way round through 0.
- `LetterboxFrame` (class): The containers a letterboxed scene is built from (backdrop, world, ui, mask and bars), laid out for a view size by `layout`.
- `LetterboxGeometry` (interface): Where `LetterboxFrame.layout` put the playfield in the view, in screen px: its scale and rect, the gameplay and scenery areas, and whether the view is portrait.
- `LetterboxOptions` (interface): A letterbox's logical playfield size and its bar and field colours (defaults `DEFAULT_BAR_FRACTION`, `DEFAULT_BAR_COLOR`, `DEFAULT_FIELD_COLOR`).
- `MAX_RESOLUTION` (const): The highest canvas resolution (device pixels per CSS pixel) the renderer uses, at the `high` quality tier.
- `meetsTier(tier, min)`: Whether `tier` is `min` or higher: a pass registered for `medium` runs at `medium` and `high`.
- `PixiRenderer` (interface): The runtime's `GameRenderer`, built on PixiJS, with its stage.
- `PixiRendererOptions` (interface): Options for `createPixiRenderer`; every field has a default.
- `PixiStage` (interface): The Pixi scene the renderer draws, as a game's `setup` sees it: the app, the letterbox's layers, the entity views, the post-filter slot and the quality tier.
- `PixiStageHooks` (interface): What a `setup` may return to hear every step, frame and reset (DX spec §3.4, DX.3 decision E-1).
- `PORTRAIT_FIELD_TOP` (const): The most room above the playfield in a portrait view, in screen px (the HUD's top margin, M1 render-pixi spec): the field sits this far down, or centred when centring leaves less room above it.
- `portraitFieldHeight(viewHeight, scale, band, baseHeight?)`: The playfield's logical height in a portrait view: what fits below `PORTRAIT_FIELD_TOP` and above the `band` of on-screen controls at `scale`, and never less than `baseHeight`.
- `Pose` (interface): Where an entity view draws: position in world pixels and rotation in radians (Pixi `rotation`).
- `poseComponent(components, componentId?)`: The component a view reads its pose from: the one it was registered under, or (for a bare function resolver, which has no id) the first component in row order with numeric `x` and `y`.
- `postFilter(name, spec)`: Declares a screen-space filter over the whole picture: `renderer: { postFilters: [postFilter('vignette', { glsl, wgsl })] }`.
- `PostFilterDef` (interface): A declared filter, as `postFilter` returns it and `PixiRendererOptions.postFilters` takes it.
- `PostFilterOptions` (interface): Options for `PostFilterSlot.set`.
- `PostFilterSlot` (interface): The post-filter slot (PRODUCT spec §2 F1): each owner (an extension, quality tiers, the game) keeps its own filters under its id, and the slot writes all of them to the target, ordered by `order` (lower first), then by id.
- `PostFilterSpec` (interface): What a screen-space filter is made of: the same effect written twice, for WebGL2 (`glsl`) and WebGPU (`wgsl`), so the two renderers stay at parity.
- `PostFilterTarget` (interface): Where the composed filters go: `PixiStage` (its scene's `filters`), or any Pixi container.
- `QualityBuild` (interface): What `rebuildOnQuality` keeps mounted.
- `rebuildOnQuality(settings, read, build, onBuilt?)`: Keeps something built for the player's quality tier (M4 spec §4.11), rebuilding it when the tier changes.
- `rect(options)`: A filled rectangle that follows its component's `x`, `y` and `angle`, interpolated between ticks: `entityViews: { [Body.id]: rect({ w: 8, h: 8, color: 0xf9c22b }) }`.
- `RectViewOptions` (interface): A `rect` view's size, colour and anchor.
- `RenderDeltaConsumer` (class): Keeps one entity view per sim entity in the world from each step's render delta, and interpolates them between ticks.
- `RendererPreference` (type): The renderer backend: `webgl` (WebGL2, the default) or `webgpu` (opt-in).
- `RESOLUTION_CAPS` (const): The canvas resolution each quality tier allows at most (M4 spec §4.11).
- `SceneNode` (interface): What the consumer needs of a scene node: Pixi's `Container`, or another scene graph's node with the same meaning (`@pixi/3d`'s `Container3D`, which is not a Pixi `Container`; M3 spec S7-Q5).
- `SceneParent` (interface): A scene node that holds other nodes: the world the consumer mounts views into.
- `SHAKE_DECAY` (const): Trauma lost per second: a full shake (1) is gone in 2/3 s.
- `SHAKE_MAX_OFFSET` (const): The largest shake offset per axis, in logical px, at trauma 1.
- `sprite(source, options?)`: A sprite that follows its component's `x`, `y` and `angle`, interpolated between ticks.
- `SpriteFrames` (interface): The texture is a sheet of equal frames, read left to right, top to bottom.
- `SpriteViewOptions` (interface): A `sprite` view's anchor and either its sprite-sheet frames or one frame of a packed atlas.
- `ViewAnchor` (type): Where the view's own box sits on its position: 0 = left/top, 0.5 = centre, 1 = right/bottom.
- `WGSL_FILTER_HEADER` (const): The WGSL counterpart of `FILTER_VERTEX`: the filter uniforms and bindings and the vertex stage, which passes the pixel position to the fragment stage.

## `@mcthaydt/automata-runtime`

### `import { … } from '@mcthaydt/automata-runtime'`

- `actionsForGesture(profile, gesture)`: Every action `gesture` drives in `profile` (M4.3); none when it is unbound.
- `actionsForKey(profile, code)`: Every action `code` (a `KeyboardEvent.code`) drives in `profile`; none when it is unbound.
- `actionsForPadButton(profile, index)`: Every action the standard-mapping pad button `index` drives in `profile`; none when it is unbound.
- `ActiveDevice` (interface): The device of the last real input, and the button labels of the active pad (`generic` before any pad).
- `AppLoop` (interface): The frame loop service: `run` steps a sim at its fixed tick rate from display frames, with the commands for each tick, and the renderer draws every frame.
- `applyDocumentLocale(element, locale)`: `<html lang dir>`: the browser picks glyph forms and line breaking from `lang`, and the layout direction from `dir`.
- `applyOverrides(defaults, saved)`: The game's profile with the player's overrides applied (M4 spec §6): an override for an unknown action, one that binds a reserved input, or one with a pad button out of range is dropped and named in `dropped` (sorted), and the defaults stand for it.
- `AssetLoadFailed` (class): An asset download failed with a non-OK HTTP status or network error (status 0).
- `Assets` (interface): The asset loader service: `load` fetches a screen's assets and fonts with progress, failing `AssetLoadFailed` or `LoadStalled`; `get` returns a loaded file by path.
- `Audio` (interface): The audio service (M5 spec §4.6): one-shot sounds and looping music on the audio buses, unlocked by the first gesture after `session.ready`; the game runs silent when no audio context can be built.
- `AUDIO_BUS_NAMES` (const): The core audio buses (PRODUCT spec §2 F1): `master` carries the other four; M5-D3 added `voice` (announcers, dialogue).
- `AUDIO_SETTINGS_DEFAULT` (const): Not muted, every bus at full.
- `AudioBuses` (interface): The audio-bus seam (PRODUCT spec §2 F1).
- `AudioBusGains` (type): The player's gain per bus, 0 (silent) to 1 (full), as a game's settings store it.
- `audioBusGainsSchema` (const): Validates saved bus gains; a bus left out is at full gain.
- `AudioBusName` (type): One of `AUDIO_BUS_NAMES`.
- `AudioContextLike` (type): The part of `AudioContext` the graph uses.
- `AudioDecodeFailed` (class): The browser could not decode a sound's bytes (M5 spec §6): that sound is silent and nothing else stops.
- `AudioDecodeFailedFields` (interface): The fields of `AudioDecodeFailed`.
- `audioLayer` (const): `makeAudio` with its defaults, reading `Hosting`, `Assets` and `PresentationBus` from the runtime.
- `AudioLive` (const): The Audio service with its defaults: the browser's `AudioContext`, `window`, `document` and `fetch`.
- `AudioOptions` (interface): Options for the audio service; each has a browser default, replaced in tests.
- `AudioServices` (interface): What the service reads from the runtime.
- `AudioSettings` (interface): The player's audio choices (M5 spec §7, M5.4), as FloorFifty's `audio` settings: the mute, the mute while another window has focus, and a gain per bus.
- `audioSettingsSchema` (const): A missing field takes its default; a bad record reads as the defaults, as every settings field falls back.
- `AuthoritativeSnapshot` (interface): One authoritative state: the authority sim's `snapshot()` bytes at `tick`, with its `hash()`.
- `AutosavePolicy` (interface): When the loaded slot writes itself: on each listed trigger, with `intervalSeconds` for the `interval` timer.
- `AutosaveTrigger` (type): What can make the loaded slot write itself (M5 spec §4.4).
- `BindingOverride` (interface): What the player changed about one action: its keys, its pad buttons, or both.
- `BoardEntry` (type): One row of a board, as Ruken gives it; `isMe` marks the player.
- `BoardQuery` (type): What `readBoard` asks for: Ruken's `get` options (`scope` `top` or `around-me`, `limit`).
- `BoardState` (type): The state of a board after the game's last submit to it.
- `BoardView` (type): A board read for a screen: its rows, or why there are none.
- `BootDefect` (class): An unexpected defect during boot.
- `BootError` (type): Every way boot can fail; each draws on the runtime's boot failure panel (shared contracts §4).
- `browserHaptics(target)`: The browser's haptics: its pads, its `vibrate`, and whether its pointer is a finger.
- `CAMERA_SETTINGS_DEFAULT` (const): The camera choices a new player starts with: the default turn speed, not inverted.
- `CAMERA_TURN_SPEED` (const): The range of "Camera turn speed" in degrees per dragged pixel (M4 spec §16.3.6, M3 spec §4.2): 0.25° by default, so a 1,440 px sweep is one full turn.
- `CameraDragTracker` (class): Turns pointer samples into camera drags for one `DragSink`: one pointer at a time, its horizontal CSS px per move, from a touch or pen's primary contact or the mouse's secondary button.
- `CameraSettings` (interface): The player's camera choices, `camera` in the core settings: how far a dragged pixel turns the camera, and whether the turn is inverted.
- `cameraSettingsSchema` (const): A missing, malformed or out-of-range field reads as its default, keeping the other; a record that is not an object reads as the defaults, as every settings field falls back.
- `Capture` (type): The input a capture caught: a key by its `KeyboardEvent.code`, or a standard-mapping pad button.
- `CompiledContentData` (interface): The compiled JSON content read by the runtime (spec §3.3).
- `ContentHashMismatch` (class): Content hash does not match expected hash.
- `contentHashOf(data)`: The content hash formula: hex64(xxhash64(utf8(canonicalJson(data)))).
- `CORE_SETTINGS` (const): The `settings` save, version 1: the player's bindings (`input`), graphics quality (`display`), audio (`audio`), vibration (`haptics`) and camera turn (`camera`).
- `CoreSettings` (interface): The settings every game carries: input bindings, display, audio and vibration.
- `createHaptics(options)`: The haptics service over these sources; it starts enabled.
- `createT(messages)`: `t` over a messages module (`import * as m from './paraglide/messages.js'`).
- `DEFAULT_QUALITY` (const): `high` until PRODUCT.7 has measured the phone profiles (M4-D6); no device auto-detection.
- `defineSave(def)`: Declares a save.
- `DeviceStorage` (interface): Where a settings field that belongs to one device is kept (M5 spec §4.5, M5-D4).
- `DisplayCopy` (interface): The words of the display policy: the landscape gate, the rotate hint for each orientation and the rotate toast.
- `DisplaySettings` (interface): The core display settings a game's settings carry as `display`: `{ display: displaySettingsSchema }`.
- `displaySettingsSchema` (const): The schema of `DisplaySettings`: an unknown or missing quality reads as `DEFAULT_QUALITY`.
- `DragPointer` (type): What drove a drag: a finger or pen (`touch`), or the mouse.
- `DragSink` (interface): Where drags go (`Input.drag`): CSS px moved to the right since the previous move, negative to the left.
- `DragStart` (interface): The parts of a `pointerdown` that decide whether it may drag.
- `EventScores` (type): A sim event's type (its `defineEvent` id) → the board it scores on and the score its payload gives.
- `EventSounds` (type): A sim event's type (its `defineEvent` id) → the asset path it plays, or the path with its bus and gain.
- `Flow` (interface): The screen flow service: the current screen, `dispatch` to follow an event's transition from it, `openMenu` for the current screen's menu, and `settled` once no transition is pending.
- `FlowFailure` (type): Why entering a screen failed: an asset load, a stalled download, or the screen's own failure.
- `formatDateTime` (const): A moment as a date and a short time in the reader's convention, in the reader's zone unless `options.timeZone` names one (a test names UTC).
- `formatDuration(locale, milliseconds)`: A clock-style duration from milliseconds, whole seconds: `01:15`, or `1:02:05` once there are hours.
- `formatNumber` (const): A number in `locale`'s convention (Intl.NumberFormat with `options`).
- `formatPercent` (const): A whole percentage of a fraction: 0.5 → `50%` (`50 %` in French).
- `FrameInfo` (interface): One display frame: the interpolation alpha between the last two ticks, the frame's length in ms, and whether time is paused.
- `GameDefinition` (interface): Everything a game provides to the runtime to boot (spec §3.3).
- `GameOrientation` (type): The orientation a game plays in; the ship config writes the same value as `runtime.orientation`.
- `GameRenderer` (interface): What the runtime asks of a renderer: apply each step's result, draw each frame, and reset for a new sim.
- `GESTURE_TUNING` (const): FloorFifty's gesture tuning, the defaults.
- `GestureName` (type): A touch gesture (M4.3 recognises the swipes, flick and tap; M4.12 the camera drag).
- `GestureSink` (interface): Where gestures go: held while a finger steers, pulsed for a flick or a tap.
- `GestureTuning` (interface): Content tuning, in CSS px and ms; FloorFifty's values are the defaults.
- `GlyphFamily` (type): Which labels a pad's buttons carry, read from its id.
- `HapticPulse` (interface): One pulse: a pad's dual-rumble (milliseconds, each motor 0..1), and a phone's buzz in `navigator.vibrate`'s terms.
- `Haptics` (interface): The haptics service: a pad's rumble or a phone's buzz, when the device can and the player's Vibration setting allows.
- `HapticsOptions` (interface): Where the haptics service finds pads, the vibrate call and whether this is a touch screen; replaced in tests.
- `HapticsSettings` (interface): The player's Vibration setting: whether `Haptics` pulses at all.
- `hapticsSettingsSchema` (const): On unless saved off; a bad record reads as on, as every settings field falls back.
- `Input` (interface): The input service (M4 spec §4.2): held actions from keys, pads, touch buttons and gestures under the game's profile and the player's overrides, menu edges, the active device and pads, and rebinding.
- `INPUT_SETTINGS_DEFAULT` (const): Nothing changed: the game's profile as it ships.
- `InputBinding` (interface): What drives one action: keys by `KeyboardEvent.code` (layout independent), pad buttons, an on-screen button.
- `InputContext` (type): Where an action is live: during play, in menus, or both.
- `InputContextNow` (type): What input drives now: `play` (the game's bindings) or `menu` (the menu actions).
- `InputDevice` (type): A kind of input device.
- `InputOptions` (interface): What the input service listens to: the window, the game's profile, the bus, and optionally the settings and the host's input mode.
- `InputProfile` (interface): A named set of bindings, one per game action (PRODUCT spec §2 F1).
- `InputProfileInput` (interface): What `inputProfileSchema` accepts: every binding field may be left out.
- `inputProfileSchema` (const): Validates an input profile, filling left-out binding fields with "unbound".
- `InputSettings` (interface): The player's input settings, kept in the game's settings as `input`: the profile, the per-action overrides and the touch mode.
- `inputSettingsSchema` (const): The `input` field of a game's settings schema: `{ input: inputSettingsSchema }`.
- `Leaderboards` (interface): `Board` is the game's board ids (its ship config's `leaderboards` keys); `string` until a game narrows it.
- `liveDeviceStorage(win, prefix)`: The game frame's own `localStorage` as a device, with `prefix:` before every key so two games on one origin do not meet.
- `Loaded` (interface): A slot loaded for play.
- `LoadMeter` (interface): Watches downloads: `guard` fails a wait with `LoadStalled` after `STALL_MS` without progress, and calls its `onSlow` after `SLOW_MS`.
- `LoadStalled` (class): A resource download had no progress reported for STALL_MS (30 s).
- `Locale` (interface): The locale service (PRODUCT spec §4): the game's locales, the one text is drawn in now, the player's choice and the text direction.
- `LOCALE_SAVE_KEY` (const): The save key of the player's language choice; absent means Automatic (negotiated).
- `LocaleCandidates` (interface): The candidates, best first; each is used only when the game has a matching locale.
- `LocaleDef` (interface): The game's languages.
- `makeAudio` (const): Builds the Audio service, which is also the `AudioBuses` seam.
- `makeInput(options)`: Builds the Input over `target` for the scope's life: closing the scope removes every listener.
- `makeLeaderboards` (const): Builds the leaderboards service over `Hosting`; each submit's state is published as `leaderboard.submitted`.
- `makeSaves(def, options)`: Opens the game's save for boot, with its triggers and its exit flush, for as long as the scope is open.
- `matchLocale(requested, locales)`: The game's locale for a requested tag: the same tag (ignoring case), else the first locale with the same primary language subtag.
- `MAX_FRAME_MS` (const): The Last Light clock.ts 0.1 s clamp: at most 6 steps at 60 Hz, the rest is dropped
- `MAX_TURN_UNITS_PER_STEP` (const): The most one step's `camera-turn` may carry either way: 45°.
- `MenuAction` (type): A fixed menu action: it drives menus and the pause screen, never the sim.
- `MessageFunction` (type): One compiled message: Paraglide passes its inputs as one object.
- `ModelInvalid` (class): A 3D model file could not be read (M3 spec §6): malformed, of an unknown type, not loaded, or a glTF with a skin, which is not supported yet (M3R-D1).
- `MusicOptions` (interface): Options for `Audio.music`: where to begin and which region loops.
- `negotiateLocale(candidates)`: The order is the player's saved choice, Ruken's session locale, the browser's languages, the default (PRODUCT spec §4 item 2, as decided 2026-10-16: a choice made in the game's own picker outranks the platform's, as in FloorFifty, where detection runs only "when the player has not chosen one").
- `NetworkPort` (interface): The networking seam (PRODUCT spec §2 F1): remote commands in, authoritative snapshots out.
- `PadInfo` (interface): A connected pad.
- `ParaglideRuntime` (interface): The parts of a Paraglide-generated `runtime.js` the runtime uses.
- `PauseReason` (type): `input`: the active pad was unplugged during play (M4-D9); Resume on the pause screen clears it.
- `pluralCategory` (const): The CLDR plural (or, with 'ordinal', ordinal) category of a count: one, two, few, many, zero or other.
- `PresentationBus` (interface): The presentation bus: typed facts the runtime publishes for screens, audio and tests to hear.
- `QUALITY_TIERS` (const): Graphics quality (M4 spec §4.11).
- `QualityTier` (type): A graphics quality tier: `high`, `medium` or `low`.
- `qualityTierSchema` (const): A tier; an unknown saved value reads as the default, as every settings field falls back.
- `REBIND_TIMEOUT_MS` (const): How long `capture` waits for a press (M4 spec §4.2, §6).
- `RebindCancelled` (class): The player pressed Escape or pad B while a capture waited: nothing changes.
- `RebindConflict` (class): Refused: the input would leave `with`, a required action, with nothing on that device (M4-D4).
- `RebindError` (type): Why a rebind was refused, with nothing changed.
- `rebindProfile(defaults, current, action, device, capture)`: Binds `capture` to `action` on `device` (M4 spec §4.5, M4-D4): it becomes the action's only input there and leaves every other action live in an overlapping context.
- `RebindReserved` (class): Refused: Escape, Tab, pad 8 or pad 16 (M4-D3), or a pad button the standard mapping does not have.
- `RebindTimedOut` (class): Nothing was pressed for `REBIND_TIMEOUT_MS`: nothing changes.
- `RebindUnknown` (class): Refused: the profile has no such action.
- `Renderer` (const): The game's renderer as a runtime service.
- `RendererFactory` (type): Builds the game's renderer for a target.
- `RendererUnavailable` (class): Neither WebGL2 nor WebGPU could be initialized.
- `RenderTarget` (interface): Where a renderer draws: the host element, the layout geometry, the loaded assets and the presentation bus.
- `RESERVED_KEYS` (const): Keys never bindable in a game's profile: Escape (the one back path) and Tab (focus).
- `RESERVED_PAD_BUTTONS` (const): Never bindable in a game's profile (M4-D3): Ruken's SDK summons the host on pad 8 (View), 16 is Home, Escape is the one back path and Tab moves focus.
- `RotateHintMode` (type): How a game locked to one orientation says so (Owner amendment, 2026-10-18): a blocking cover, or a toast.
- `runGame(game)`: Boots and runs the game in a runtime Scope (spec §4 Failure and Shutdown).
- `RuntimeFacts` (interface): Every fact the runtime publishes on the presentation bus, by name.
- `RuntimeHandle` (interface): Controls the running game: shutdown closes the runtime scope (spec §3.3, planning note 11).
- `RuntimeSeams` (interface): Test seams injected into the runtime boot program (spec §3.3, planning note 10).
- `RuntimeServices` (type): The runtime services a screen's `enter` may use.
- `Save` (interface): A game's save (M5 spec §4.3): its slots' states, load, write and remove, and the progress `touch` keeps for the autosave triggers to write.
- `SaveDef` (interface): A game's save: one record, or a fixed number of slots, each one Ruken key.
- `SaveEnvelope` (interface): What is stored: a self-describing envelope, one Ruken key per slot.
- `SaveFromNewerBuild` (class): A slot was saved by a newer build.
- `SaveFromNewerBuildFields` (interface): The fields of `SaveFromNewerBuild`.
- `SaveMigration` (type): One migration step of a save: version `n` data in, version `n + 1` data out (`SaveDef.migrations`).
- `saveOf(def)`: Returns the booted save when `def.key` matches.
- `SaveRefused` (class): A write AF refuses on its own: over a save from a newer build (M5 spec §4.3).
- `SaveRefusedFields` (interface): The fields of `SaveRefused`.
- `Saves` (interface): The booted game's save as a runtime service (M5 spec §4.3), as `Settings` is for settings: its key and the `Save`, both undefined for a game without saves.
- `saveService(def, options)`: Opens a game's save slots: reads the slot list from the host, then loads, writes and removes slots.
- `SaveServiceOptions` (interface): What the save service stamps on every write and checks on every load.
- `SaveUnreadable` (class): A slot's save cannot be read: a damaged envelope, a missing or throwing migration step, or data its schema refuses (M5 spec §6).
- `SaveUnreadableFields` (interface): The fields of `SaveUnreadable`.
- `SaveWriteOptions` (interface): Options for `Save.write`: the slot's label on the list, and a sim snapshot to keep with the data.
- `ScreenContext` (interface): What a screen's `enter` is given: the layer to mount into, and the screen it came from.
- `ScreenDef` (interface): One screen of the flow: its id, whether it pauses the sim, its kind and fonts, and `enter`, which mounts it in its scope (closing the scope leaves the screen).
- `selectPlural(locale, count, forms)`: The form for a count.
- `Settings` (interface): The booted game's settings as a runtime service: its key and store, both undefined for a game without settings.
- `SettingsDef` (interface): A game's settings: the key it is saved under, its version, schema, defaults and migration steps, and which fields stay on one device.
- `SettingsStore` (interface): A game's settings value: read it, subscribe to changes, and update it (each update is saved).
- `settingsStore(def)`: Returns the booted settings store when def.key matches.
- `SlotMeta` (interface): A slot's header, read without migrating it.
- `SlotState` (type): What a slot holds, as the slot list shows it (M5 spec §4.3, §6).
- `SLOW_MS` (const): After this long, in ms, a download still running is reported slow (the loader says so).
- `SoundOptions` (interface): Options for `Audio.sound`: the bus (default `sfx`), a gain and a playback rate.
- `STALL_MS` (const): A download that makes no progress for this long, in ms, fails `LoadStalled`.
- `STANDARD_PAD_BUTTON_MAX` (const): The highest button index of the W3C Gamepad standard mapping (0 = bottom face button … 16 = home).
- `StickDirection` (type): A stick pushed past its dead zone in one direction (M4.2 reads them).
- `SwipeIndicator` (interface): What a swipe indicator draws: the anchor, the thumb, and whether the thumb is steering.
- `SwipeTracker` (class): Turns pointer samples into held swipes, flicks and taps for a `GestureSink` (M4 spec §4.4); it reads no clock and touches no DOM.
- `textDirection(locale)`: Text direction from the locale's script: the explicit script subtag, else the likely one CLDR adds (`ar` → `Arab`).
- `Time` (interface): The time service: whether the sim is paused, and why; each reason pauses until it is resumed.
- `TouchMode` (type): How touch drives play: the on-screen buttons, or swipes and flicks over the whole screen (M4 spec §4.4).
- `touchModesFor(profile)`: The touch modes a profile offers: `buttons` when an action binds `touch`, `swipe` when one binds a swipe, flick or tap.
- `TouchStickSink` (interface): Where the overlay's move stick goes: a vector clamped to length 1, y positive down, as a pad's axes.
- `Translate` (type): The typed `t` verb: `t('hello', { name })`, checked against the game's compiled messages.
- `TURN_UNITS_PER_TURN` (const): Turn units in a full turn: the heading wraps here.
- `turnUnitsFromPixels(dxPx, degPerPixel, invert)`: `dxPx` dragged at `degPerPixel` as whole turn units: positive for a drag to the right (which way that turns the heading is the game's convention), negated when `invert`, clamped to ±`MAX_TURN_UNITS_PER_STEP`.
- `typedBus(bus)`: Cast a PresentationBus instance to a typed view with game-specific fact types.

### `import { … } from '@mcthaydt/automata-runtime/extension'`

- `defineExtension(def)`: Returns its argument.
- `ExtensionDef` (interface): One opt-in feature of a game (M1 shared contracts §2).
- `ExtensionError` (class): A bad extension list.
- `GameConfig` (type): The parts of the game config an extension may read (content's `GameConfig`, DIST spec §4.4).
- `ResolvedExtensions` (interface): Everything the runtime and the build tools need from a game's extension list, in one fixed order.
- `resolveExtensions(defs)`: Checks the list and puts it in a fixed order.
- `RukenManifestContribution` (type): What an extension may add to ruken.toml in M1: preload files.

### `import { … } from '@mcthaydt/automata-runtime/testing'`

- `FakeAudioContext` (interface): A recording stand-in for an `AudioContext`: what was started, stopped and automated, with a clock tests move by hand.
- `fakeAudioContext(decode?)`: `decode` turns the bytes `decodeAudioData` receives into a buffer, or throws as the browser does for bytes that are not audio; by default the bytes are the alias's UTF-8 text.
- `fakeBuffer` (const): A decoded buffer that remembers the alias it came from, so `started` can name it.
- `fakeFetch(routes, options?)`: Creates an in-memory fetch implementation for deterministic loading tests.
- `FakeFetchOptions` (interface): Options for `fakeFetch`: the fetch that answers urls with no route.
- `FakeFetchResult` (interface): The fake fetch, and the urls it was asked for and saw aborted.
- `FakeGainNode` (interface): A gain node of `fakeAudioContext`, recording its value, its targets and its automation.
- `FakeRoute` (interface): How `fakeFetch` answers one url: a status, the body in chunks, a content length or type, a hang or a network error.
- `ManualFrames` (interface): A frame source a test drives: `advance` moves time on and runs the frame asked for, if any.
- `manualFrames(startMs?)`: A frame source that runs a frame only when a test advances it, starting at `startMs`.
- `nullRenderer(log?, options?)`: A renderer that draws nothing and records each call in `log`, for runtime tests without a GPU.
- `NullRendererEntry` (type): One call `nullRenderer` recorded.
- `NullRendererOptions` (interface): Options for `nullRenderer`: `fail` makes it fail `RendererUnavailable`.
- `RuntimeTest(options?)`: Test harness providing `RuntimeServices | FakeHostHandle` for screen and integration tests (spec §3.1, §8.1).
- `RuntimeTestOptions` (interface): What `RuntimeTest` boots: the fake host, the screens, content, settings and save, and the frames, renderer, fetch and locale it uses.

## `@mcthaydt/automata-ship`

### `import { … } from '@mcthaydt/automata-ship'`

- `BoardName` (interface): A board a source file names, by its name and position (1-based, at the opening quote).
- `boardNamesIn(file, code)`: The boards one source file names, in source order; `undefined` when it does not parse (its typecheck already fails, and a half-read tree could report a board that is not there).
- `BUILD_ID_PATTERN` (const): A build's ID on the dev host: the commit's UTC time to the minute, then its short sha, for example `202610111205-abcdef0` (FloorFifty `deploy/bin/build-tag`).
- `buildIdFor(commit)`: The build ID for a commit: its UTC time to the minute, a dash, then the first seven characters of its sha.
- `ButlerFailed` (class): butler exited non-zero.
- `checkManifest(toml)`: Checks `ruken.toml` text with Ruken's own parser, so AF accepts exactly what Ruken accepts.
- `checkVersion(version, tag)`: A release's version must be its tag's (FloorFifty `deploy/tools/ruken-pack.ts`): the build Ruken shows as 0.10.2 is the one tagged v0.10.2.
- `declaredBoardsIn(code)`: The board ids a `ship.config.ts` declares: the keys of its `leaderboards` object, read from the source as written (`automata check` reads files, it does not run them).
- `DeclaredInputs` (interface): The `runtime.inputs` a `ship.config.ts` declares, with the position of its opening bracket.
- `declaredInputsIn(code)`: The `runtime.inputs` a `ship.config.ts` declares, read from the source as written (`automata check` reads files, it does not run them).
- `declaredOrientationIn(code)`: The `runtime.orientation` a `ship.config.ts` declares, read from the source as written (`automata check` reads files, it does not run them).
- `defineShipConfig(config)`: Identity function that gives a game's `ship.config.ts` type checking and editor completion.
- `deployDev(input)`: Sends a prepared build to the dev host and returns its build ID and the URL it is served at.
- `DeployDevInput` (interface): What `deployDev` sends and where: a prepared build folder, the commit it came from, the dev host's ssh target and URL, and whether the build becomes the one `/` redirects to.
- `DeployFailed` (class): The dev host's deploy step (tar or ssh) failed; `output` is what it printed.
- `EntryMissing` (class): `[game] entry` names a file the build does not have.
- `EnvValue` (interface): One variable read from a game's `.env*` files, whose value the bundle scan looks for in the build.
- `FileError` (class): Reading, writing, listing or removing a file failed.
- `findExecutable(name, pathEnv?, platform?)`: The first `name` on `pathEnv` that is an executable file, or undefined.
- `findInputsProblems(gameDir, inputs)`: Each disagreement between `inputs` (a config's `runtime.inputs`) and what the `keys()` calls in a game's sources bind, in `inputsProblems`' words; empty when they agree or the game has no `keys()` call to compare.
- `findOrientationMismatches(gameDir, declared)`: Every `defineGame` in a game's sources that plays in an orientation other than `declared` (its config's).
- `findPixi3d(distDir)`: Every script in the build that carries
- `findRootAbsoluteReferences(distDir)`: Every root-absolute reference to one of the build's own files in a built folder, walking it in name order.
- `findSecretsInBuild(distDir, envValues)`: Every secret in a built folder.
- `findUndeclaredBoards(gameDir, declared)`: Every board a game's sources name that `declared` (its ship config's `leaderboards` keys) lacks.
- `gameOrientationsIn(file, code)`: The orientations the `defineGame` calls in one source file play in, in source order; `undefined` when the file does not parse (its typecheck already fails, and a half-read tree could name an orientation that is not there).
- `inputsProblems(inputs, bindings)`: Each disagreement between `runtime.inputs` and the bindings, in action order; empty when they agree.
- `isBoardSource` (const): Whether `file` is one of the game's sources the board check reads (`.ts`, `.tsx`, `.mts`, `.js`, `.mjs`).
- `isInputsSource` (const): Whether `file` is one of the game's sources the check reads: not a test, whose fixture games are not shipped.
- `isLocalStack(api)`: Whether `api` is Ruken's local stack: `localhost`, a `.localhost` name, or a loopback address.
- `isOrientationSource` (const): Whether `file` is one of the game's sources the check reads: not a test, whose fixture games are not shipped.
- `ITCH_FIRST_PUSH_CHECKLIST` (const): The one-time page settings butler cannot make (PUB spec §6), printed after a channel's first push.
- `ITCH_LIMITS` (const): itch.io's documented limits for an HTML5 upload; "MB" is read as 10^6 bytes.
- `ITCH_LIMITS_SOURCE` (const): Where itch.io's limits were read, and when.
- `ItchBuildInvalid` (class): The build breaks one of itch.io's rules; each problem names the file and the limit.
- `ItchCheck` (type): The `prepare --target itch` check that failed, in the order they run (PUB spec §4).
- `ItchConfig` (interface): What a game writes in `ship.config.ts`.
- `itchConfigSchema` (const): Checks a game's `itch` section: `project` is `user/game` in lower case, and `channel` defaults to `html5`.
- `ItchDownloadsMissing` (class): `publish --target itch --from tauri` found no desktop bundle of this version; found before any push.
- `ItchSettingMissing` (class): `publish --target itch` lacks the config section, the key or butler; found before anything runs.
- `ItchSettings` (interface): The checked settings, with the channel filled in.
- `keysBindingsIn(file, code)`: What the `keys()` calls in one source file bind, one `<file>:<line>:<col> keys` entry per call (and `pad` and `gestures` entries where it binds them); empty when the file has no call; `undefined` when it does not parse (its typecheck already fails, and a half-read tree could name a device that is not there).
- `ManifestInputsMismatch` (class): `runtime.inputs` disagrees with the game's input bindings (M4 spec §4.13, I-g).
- `ManifestInvalid` (class): Ruken's parser refused the generated `ruken.toml`.
- `OrientationMismatch` (class): The game plays in an orientation its ship config's `runtime.orientation` does not send Ruken (M4.7 follow-up).
- `OrientationMismatchFound` (interface): A game that plays in an orientation its ship config does not declare.
- `parseEnvFile(file, text)`: The variables of one `.env` file: `KEY=value` lines, with `export`, quotes and `#` comments allowed.
- `PIXI3D_EXTRAS_MARKERS` (const): Strings only
- `PIXI3D_MARKERS` (const): Strings only
- `Pixi3dExtrasInBuild` (class): A build contains `@pixi/3d/extras`, whose particle code probes `new Function` at load (M3 spec S7-g).
- `Pixi3dFound` (interface): One script that carries a marker.
- `Pixi3dInPublicBuild` (class): A build for a public target (Ruken's store, itch.io) contains `@pixi/3d`, a closed beta (M3 spec §4.8, X-b).
- `PlayedOrientation` (interface): An orientation a `defineGame` call plays in, at the literal's opening quote (or at the call, when it is left out).
- `portsFor(checkoutPath, env)`: The ports a checkout's test server and preview build listen on (FloorFifty `playwright.config.ts`).
- `prepareBuild(input)`: Makes a built folder ready for `ruken publish` and the dev host (ship spec §3.3): checks the tag, the entry page, root-absolute paths, secrets (QB-b), `@pixi/3d` (X-b, S7-g), the leaderboards the game names (M5.7) and the orientation it plays in (M4.7) and the devices its `keys()` calls bind (M4.1), then writes `ruken.toml` once Ruken's parser accepts it.
- `PrepareInput` (interface): What `prepareBuild` checks and writes into: the built folder, the ship config, and the optional release tag, game folder and input bindings.
- `prepareItch(input)`: Makes a built folder ready for itch.io (PUB spec §4): the tag, root-absolute paths, secrets (QB.2: a page on itch.io is public, so the build is scanned as Ruken's is), `@pixi/3d` (X-b, S7-g), `index.html`, itch.io's limits, reference case and a stray `ruken.toml` are checked in that order, and the first that fails stops prepare before anything is written.
- `PrepareItchInput` (interface): What `prepareItch` checks and zips: the built folder, the ship config and the release tag.
- `prepareTauri(input)`: Builds the desktop bundles for this OS (DIST spec §6.2).
- `PrepareTauriError` (type): Every way `prepareTauri` can fail, each before or instead of writing bundles.
- `PrepareTauriInput` (interface): What `prepareTauri` builds: the web build, the game's folder, its config, and the release tag.
- `PrivatePublishNotLocal` (class): `publish --private` named a Ruken that is not the local stack (M3 spec §4.8): a private build stays local.
- `ProcessError` (class): A program could not be started (not found, not executable).
- `PublishAuth` (class): Exit 3: the token was missing, wrong or lacks the rights.
- `publishBuild(input)`: `ship publish` for Ruken (ship spec §3.4): prepare the build, then hand it to Ruken's own CLI.
- `PublishBuildInput` (interface): What `publishBuild` needs: `publishToRuken`'s input, the game's ship config, the release tag and the audience.
- `PublishDownloadsError` (type): Every way `publishDownloadsToItch` can fail, each stopping the pushes.
- `PublishDownloadsInput` (interface): What `publishDownloadsToItch` needs: the game's folder, its config, the key and where butler is.
- `publishDownloadsToItch(input)`: Pushes this version's bundles from `dist-tauri/`, one per OS, each to its channel (`itch.downloads`, default `linux`, `mac`, `windows`), and answers the channels pushed.
- `PublishFailed` (class): Any other exit code.
- `PublishInput` (interface): What `publishToRuken` needs: the prepared build folder, the game's folder, Ruken's site and token, and whether to activate the build.
- `PublishItchInput` (interface): What `publishToItch` needs: the built folder, the ship config, the tag, the key and where butler is.
- `PublishRejected` (class): Exit 1: Ruken's checks rejected the build.
- `PublishTimeout` (class): Exit 4: Ruken's checks took longer than the CLI waits.
- `publishToItch(input)`: Prepares the build for itch.io (every check of `prepareItch`), then pushes the folder with butler.
- `publishToRuken(input)`: Runs Ruken's own `ruken publish` on a prepared build and returns the URL Ruken says the build is served at (`undefined` when it prints none).
- `PublishUsage` (class): Exit 2: the command line was wrong.
- `readEnvValues(gameDir)`: The variables of every top-level `.env*` file in the game folder; none when the folder does not exist.
- `RootAbsoluteReference` (class): The build names its own files from the origin's root, which 404s under `/b/<buildId>/`.
- `rukenCliPath(moduleUrl?, exists?)`: The `ruken` bin of the vendored `@ruken/cli` package.
- `rukenHeaders(config, target)`: The headers Ruken serves a game's build with (Ruken's CSP, which allows no eval), from the game's config, for a game's `vite preview` or a dev host (DIST spec §5.1: the game imports no `@ruken/*` itself).
- `RukenHeaderTarget` (type): Where the headers are for: Ruken's production site, or a page on the given origins that frames the game.
- `rukenToml(config)`: The text of `ruken.toml` (Ruken manifest schema 1) for a ship config.
- `scanTextForSecrets(file, text, envValues)`: Every secret in one file's text.
- `SecretFound` (interface): A secret the bundle scan found in a built file, located without repeating the secret.
- `SecretInBuild` (class): The build holds a key, an `.env` value or a high-entropy string (QB-b).
- `SHIP_PACKAGE` (const): The name this package is published under.
- `ShipConfig` (interface): What a game tells ship about itself: the game config every target reads (`@mcthaydt/automata-content`'s `GameConfig`, DIST spec §4.4) and each target's own section.
- `ShipInputBindings` (interface): What ship reads of a game's input profile. ship is published and the profile's owner (`runtime`) is private, so this is the read-only subset ship consumes, not a copy of the contract: a profile's `bindings` is assignable to it.
- `TAURI_CLI` (const): The `@tauri-apps/cli` a desktop game installs as a dev dependency, named when it is missing: released 2026-10-14, at least 14 days before it was chosen (2.12.4 was not), and the release the adapter's `@tauri-apps/api` pairs with.
- `TauriBuildFailed` (class): `tauri build` exited with an error; its output was shown as it ran.
- `TauriBuildInvalid` (class): The config or the web build is not ready for a desktop build; each problem says what to change.
- `TauriConfig` (interface): What a game writes in `ship.config.ts` to build for the desktop.
- `tauriConfigSchema` (const): Checks a game's `tauri` section.
- `TauriToolchainMissing` (class): A tool the desktop build needs is not installed; found before anything is written.
- `testRemote(input)`: Pushes the current branch, dispatches CI for it, waits and returns the run's URL and one `<result>\t<job>` line per job when it is green.
- `TestRemoteFailed` (class): `test-remote` stopped without a green run; `reason` says why and `message` says what to do.
- `TestRemoteInput` (interface): What `testRemote` runs and how long it waits.
- `TestRemoteReason` (type): Why `test-remote` stopped without a green run.
- `UndeclaredBoard` (class): The game names a leaderboard its ship config's `leaderboards` does not declare (M5 spec §4.8, L-b).
- `UndeclaredBoardFound` (interface): A board the game's sources name that its ship config does not declare, at the call site.
- `VersionMismatch` (class): A release tag that is not `v<version>`.

## `@mcthaydt/automata-sim`

### `import { … } from '@mcthaydt/automata-sim'`

- `canonicalJson(value)`: Canonical JSON: object keys sorted at every depth, no whitespace.
- `CanonicalJsonError` (class): A value canonical JSON cannot represent exactly; hashing it anyway would let different values collide.
- `Command` (interface): Input to the sim (spec §4.4 rule 4).
- `CommandDef` (interface): A command the sim accepts as input: an id and the Zod schema its payload must match.
- `CommandRecord` (interface): A command as a system reads it this tick: the player slot that sent it (`source`), its per-source `seq` and its parsed `payload`.
- `ComponentDef` (interface): A component: a stable id and a flat record of typed fields.
- `createRng(seed)`: A generator seeded from `seed` (through splitmix32): the same seed gives the same sequence in every engine.
- `createSim(opts)`: Creates a sim from its plugins, seed and content; async, because a plugin may create engine state (a Rapier world).
- `Def` (type): Anything `definePlugin`'s flat `defs` list takes (DX spec §3.2).
- `defineCommand(id, schema)`: Defines a command by id and payload schema.
- `defineComponent(id, fields, opts?)`: Defines a component from an id (lower-case words separated by dots or dashes) and its fields by name and type.
- `defineEvent(id, schema)`: Defines an event by id and payload schema, to emit from a system with `ctx.emit`.
- `definePlugin(spec)`: Defines a plugin from a name, its dependencies and its definitions, given in the keyed lists or in one flat `defs` list sorted by kind.
- `defineResource(id, schema, init)`: Defines a resource by id, schema and starting value.
- `defineSystem(name, run)`, `defineSystem(name, phase, run)`, `defineSystem(spec)`: A system: `defineSystem(name, run)` runs in `gameplay`, `defineSystem(name, phase, run)` in that phase, and the object form also takes `before`/`after`.
- `deriveSeed(rootSeed, name)`: Seed for a named substream: FNV-1a over the name's UTF-16 code units, mixed with the root seed.
- `EntityRef` (interface): A live entity, addressed by its StableId.
- `EventDef` (interface): An event a system emits: an id and the Zod schema its payload must match.
- `FieldRecord` (type): One component's field values on an entity, by field name.
- `FieldSchema` (type): A component's fields, by name.
- `FieldType` (type): A component field's type: `f32`, `f64`, `i32`, `u32`, `bool`, `entity` (a StableId, stored as a `u32`) or `string`.
- `FieldValue` (type): The JavaScript type a field holds: `boolean` for `bool`, `string` for `string`, `number` for every other type.
- `FieldValues` (type): The writable record of values a `FieldSchema` describes.
- `hex64(value)`: 16 lowercase hex digits.
- `Phase` (type): One of the six phases a tick runs through, in `PHASES` order.
- `PHASES` (const): Fixed phase order (spec §4.3).
- `PluginDef` (interface): A bundle of definitions the sim registers together: components, commands, events, resources and systems, the plugins it depends on, and optionally per-sim engine state and `config`.
- `PluginState` (interface): Engine state a plugin keeps outside the ECS, such as a Rapier world (M2.1 spec §3.1).
- `PluginStateSetup` (interface): What a plugin's state may know when it is created.
- `PreparedRestore` (interface): A plugin's parsed restore, held until the sim knows whether the whole snapshot is valid.
- `RejectedCommand` (interface): A command `step` dropped, with the reason.
- `RejectReason` (type): Why `step` dropped a command: `bad-header` (a field is missing or out of range), `unknown-command` (no plugin defines its type), `wrong-tick` (not the sim's current tick), `duplicate-seq` (the same source and seq twice in one step) or `invalid-payload` (it fails the command's schema).
- `RenderDelta` (interface): What changed for the renderer since the last delta (spec §4.7).
- `RenderRow` (interface): One entity's render-flagged components (component id -> field values).
- `ResourceDef` (interface): A value the sim keeps once, not on any entity: an id, a Zod schema and the `init` that gives its starting value.
- `Rng` (interface): A deterministic generator (xoshiro128**, 32-bit integer math only, so it is bit-exact in every engine).
- `RngState` (type): The four 32-bit words of a generator's state, as `Rng.state()` copies them and snapshots store them.
- `Sim` (interface): A running simulation, stepped with commands, that can snapshot, restore and hash its state.
- `SIM_VERSION` (const): The sim package's version, written into replay headers for information only (M2.3 spec §3.2).
- `SimCapacityError` (class): More sims are alive than Koota allows worlds (16 per process).
- `SimContext` (interface): What a system's `run` receives each tick (spec §4.1).
- `SimDisposedError` (class): The sim was disposed; it holds no world any more, so every call that reads or changes state refuses.
- `SimEvent` (interface): An event a system emitted during a step: the event's id as `type`, and its parsed `payload`.
- `SimFaultedError` (class): A system threw during `step`.
- `SimOptions` (interface): What `createSim` takes: the root `seed`, the `plugins`, `tickHz` (an integer from 1 to 1000, default 60) and the `content` the systems read as `ctx.content` (default `{}`).
- `SNAPSHOT_VERSION` (const): The snapshot format version this build reads and writes; a snapshot of another version fails with `SnapshotFormatError`.
- `SnapshotFormatError` (class): Snapshot bytes that are not a valid snapshot of this format version: bad magic, an unsupported version, truncated or malformed sections.
- `SnapshotMismatchError` (class): A valid snapshot that belongs to another sim: `field` names the header value that differs (`schemaHash`, `contentHash` or `tickHz`), with this sim's `expected` value and the snapshot's `actual` one.
- `SnapshotView` (interface): A readable copy of a snapshot, for diffs and reports (M2.3 spec §3.1).
- `sortedEntries(obj)`: Own enumerable [key, value] pairs, sorted by key.
- `sortedKeys(obj)`: Own enumerable string keys, sorted by UTF-16 code unit.
- `SpawnPart` (type): A component to spawn with: the definition alone (defaults) or [definition, initial values].
- `StepResult` (interface): What one `step` produced: the new tick, the events emitted, the renderer's delta and the commands that were rejected.
- `SystemDef` (interface): A system: a name, the phase it runs in, the systems it must run `before` or `after` within that phase, and its `run`, called once per tick.
- `SystemSpec` (interface): The object form of `defineSystem`: a name, a phase, the optional `before`/`after` ordering and the run.
- `xxhash64(data, seed?)`: XXH64 of `data` with an unsigned 64-bit `seed`.

### `import { … } from '@mcthaydt/automata-sim/hash'`

- `canonicalJson(value)`: Canonical JSON: object keys sorted at every depth, no whitespace.
- `hex64(value)`: 16 lowercase hex digits.
- `utf8(s)`: UTF-8 encoding without TextEncoder (the sim's lib has no DOM/Web APIs).
- `xxhash64(data, seed?)`: XXH64 of `data` with an unsigned 64-bit `seed`.

### `import { … } from '@mcthaydt/automata-sim/math'`

- `atan(x0)`: Deterministic arctangent.
- `atan2(y, x)`: Finite inputs only (sim values are finite).
- `cos(x)`: Deterministic cosine, in radians.
- `exp(x)`: Deterministic `e` to the power `x`.
- `hypot(x, y)`: No overflow scaling: inputs must satisfy x*x + y*y < 1.7e308.
- `log(x0)`: Deterministic natural logarithm.
- `pow(x, y)`: Deterministic `x` to the power `y`.
- `sin(x)`: Deterministic sine, in radians.
- `tan(x)`: Deterministic tangent, in radians, as `sin(x) / cos(x)`.

### `import { … } from '@mcthaydt/automata-sim/replay'`

- `createRecorder(sim, options?)`: Starts recording `sim` from its current state, for the recorder's `step` to extend.
- `createReplayStepper(replay, setup)`: Creates a stepper over `replay`: a fresh sim built from the replay's seed and tick rate, restored from its start snapshot.
- `decodeReplay(bytes)`: Decodes `.replay` bytes (already inflated) into a `Replay`.
- `DEFAULT_CHECK_EVERY` (const): How often, in ticks, a recording stores a check hash when `RecorderOptions.checkEvery` is not given.
- `encodeReplay(replay)`: Encodes a replay as `.replay` bytes before deflate.
- `packReplay(replay, compression)`: Encodes a replay and deflates it into `.replay` file bytes.
- `Recorder` (interface): Steps a sim and records the run as a `Replay`.
- `RecorderOptions` (interface): What a recording takes: how often to store a check hash, whether to keep a reference hash and snapshots (goldens), and free-form `meta`.
- `Replay` (interface): A recorded run: its header, the start snapshot, the accepted commands by tick, check hashes along the way and the final tick and hash.
- `REPLAY_FORMAT` (const): The `.replay` format version this build reads and writes.
- `REPLAY_INFLATE_MAX_BYTES` (const): Larger than FloorFifty's 1 MiB because goldens carry reference snapshots; player replays may pass less.
- `REPLAY_MAX_TICKS` (const): The longest run a replay may hold: 2^24 ticks, over 77 hours at 60 Hz.
- `ReplayCheck` (interface): A hash check at a tick: the hash the replay recorded (`expected`) and the hash the re-simulated sim has (`actual`).
- `ReplayCommand` (interface): A command as a replay stores it: the sim's `Command` without its tick, which the replay's `ticks` entry carries.
- `ReplayCompression` (interface): The deflate and inflate a `.replay` file needs.
- `ReplayFormatError` (class): Bytes that are not a valid `.replay` (M2.3 spec §5).
- `ReplayHeader` (interface): The facts a replay needs before it plays: tick rate, seed, the schema and content hashes it was recorded against, where it starts and how often it checks.
- `ReplayRecordError` (class): A recording that cannot be exact: the sim stepped outside the recorder, a payload that is not JSON, and so on.
- `ReplayStepper` (interface): A replay playing back one tick at a time on its own sim.
- `ReplayStepSetup` (interface): What a stepper needs to rebuild the recorded sim: the same `plugins` and `content` the recording sim had.
- `unpackReplay(bytes, compression, options?)`: Inflates `.replay` file bytes and decodes them.

## `@mcthaydt/automata-testing`

### `import { … } from '@mcthaydt/automata-testing'`

- `documentScrolls(doc)`: The document itself never scrolls; screens scroll inside declared regions.
- `FakeResizeObserver` (interface): Controls the fake `ResizeObserver` `installFakeResizeObserver` put in place: report a width to every observer, then restore the original.
- `fakeViewportWindow(size)`: A fake window of the given size.
- `FakeViewportWindow` (interface): A stand-in for the browser window the geometry owner reads: its size, `screen`, `navigator`, visual viewport and `resize` listeners, with methods to rotate, open the keyboard and count live listeners.
- `FakeVisualViewport` (interface): The visual viewport of `FakeViewportWindow`: its height (less the keyboard, if open), an offset, and listeners for `resize`.
- `findClipped(root, selector)`: Each element `selector` names is tall enough for what it holds (a crushed row clips its content).
- `findCutAtSide(root)`: No control is cut at a side of a declared scroll region that clips it (see `clippedBy`).
- `findIntrusions(root, rects)`: No visible control intersects a reserved area (Ruken's strip, a keyboard), in viewport px, by its whole box.
- `findOffscreenControls(root)`: Every visible control is on screen, unless a declared scroll region (`[data-scroll-region]`) clips it (see `clippedBy`): a fixed control, or one positioned outside the region, is judged where it is drawn, since scrolling the region would never bring it into view.
- `findOverlaps(a, b)`: Two elements' boxes do not overlap.
- `findSmallTargets(root, min, minPrimary)`: Every visible control is at least `min` square, and a primary (`data-kind="primary"`) at least `minPrimary` tall.
- `findUnreachable(elements)`: Each element is fully inside the viewport, and the whole of it is in view: a tap at its centre and at the middle of each edge lands on it or inside it, so nothing covers or clips any part.
- `hostDisplay(options?)`: Ruken's display metrics for a hosted game.
- `installFakeResizeObserver()`: Replaces the global `ResizeObserver` with a fake that reports only the widths you give it, for components measured under jsdom, which has no layout.
- `LayoutRect` (interface): Layout assertions as plain DOM functions (M1.6 spec §3.10), from FloorFifty's `tests/e2e/support/layout.ts` at 122a220 (`expectReachable`, `expectControlsFit`, `expectRowsWhole`, `expectApart`, `expectNoDocumentScroll`).
- `MountedFixture` (interface): A mounted Svelte fixture: the element it was mounted into and a way to unmount it.
- `mountFixture(component, props, target?)`: Mounts a Svelte component with the given props and no renderer or host, and flushes effects so the first render is finished.
- `pressedPart(control)`: What a player presses for `control`: a checkbox's or radio's label (the theme draws it as the control, and a press anywhere on it toggles the input), else the control itself.
- `REFERENCE_SIZES` (const): The viewports a layout is checked at: phones in both orientations, tablets, desktops, both sides of every breakpoint and the tightest sizes, each with the classification it should get.
- `ReferenceFormFactor` (type): `@mcthaydt/automata-ui`'s `FormFactor`.
- `ReferenceHeightTier` (type): `@mcthaydt/automata-ui`'s `HeightTier`.
- `ReferenceSize` (interface): One viewport every primitive and screen is checked at: a name, its size, and the form factor and height tier it must classify as.
- `textSnippet(text, tag?, trusted?)`: A Svelte 5 snippet rendering `<tag>text</tag>`, so a test can pass `children`, `body` or an icon to a component without writing a wrapper component (Ruken `packages/ui/src/test-snippets.ts`).
- `TIGHT_SIZES` (const): Sideways phones shorter than 780x270, where an open keyboard leaves the least room (framework audit of #7, 2026-10-11).
- `Variant` (interface): A condition layered over a reference size.
- `VARIANTS` (const): The conditions each size is also checked under: at rest, with the on-screen keyboard open, with Ruken's reserved strip on the right or the left, and at its TV scale.
- `visibleControls(root)`: Controls a player could see and reach: laid out, not hidden, not in an inert subtree.

### `import { … } from '@mcthaydt/automata-testing/e2e'`

- `Direction` (type): A direction on the D-pad or the stick.
- `Engine` (type): The browser engine a matrix cell runs in.
- `FakePad` (class): One standard controller in a real browser, driven through the Gamepad API the game itself reads.
- `FakePadOptions` (interface): How the fake pad reports itself: its mapping and its id (the id picks the prompts' glyphs).
- `flick(scope, from, dy, ms)`: A quick vertical swipe of `dy` pixels within `ms` milliseconds from `from` (M4 spec I-f: 40 px in 180 ms).
- `hold(target, until)`: A finger down on `target`'s centre until `until` resolves true (checked once a frame), then up.
- `INPUT_MATRIX` (const): M4 spec §9.1's cells, in table order: 17 cells, 22 journeys (the desktop cells run under both hosts).
- `InputDevice` (type): The device a matrix cell plays with.
- `MatrixCell` (interface): One cell of the input × form-factor matrix: a form factor, a device and an engine, and the hosts it runs under.
- `MatrixFormFactor` (type): A matrix cell's form factor, each with one viewport (M4 spec §9.1).
- `MatrixHost` (type): Where a journey runs: under the fake Ruken host, or standalone.
- `PAD_BUTTONS` (const): The standard mapping's buttons by name: south (A on an Xbox pad) is 0, Start is 9, the D-pad 12 to 15.
- `PadButton` (type): A standard-mapping button by name.
- `PadMode` (type): Whether a direction is held on the D-pad or the left stick.
- `Point` (interface): A point in the target frame's own CSS pixels.
- `swipe(scope, from, to, ms)`: A finger from `from` to `to` over `ms` milliseconds, one move a frame, on whatever is under it.
- `tap(target)`: A finger down on `target`'s centre and straight up again.

### `import { … } from '@mcthaydt/automata-testing/host'`

- `FakeHostControl` (interface): What a test does to, and reads from, the fake host.
- `fakeHosting(options?)`: A fake host and the control handle that drives it.
- `FakeHosting(options?, hosting?)`: The fake host as a layer: `Hosting` for the game (built from `hosting`, default a game that wants saves) and `FakeHostControl` for the test.
- `FakeHostingOptions` (interface): How the fake host starts.
- `FakeTarget` (type): The four distribution targets a fake host can stand in for (ADR 0006).
- `Submission` (interface): One leaderboard submission the host received.
- `TrackedEvent` (interface): One analytics event the host received.

### `import { … } from '@mcthaydt/automata-testing/input'`

- `fakeGamepads(options?)`: `target` hears `gamepadconnected` and `gamepaddisconnected`, as `window` does in a browser.
- `FakeGamepads` (interface): Four gamepad slots a unit test plugs pads into and presses; `getGamepads` reads them as the browser's would.

### `import { … } from '@mcthaydt/automata-testing/sim'`

- `Difference` (interface): One difference between two snapshot views: its kind, where it is (`entity 4 bounce.ball.vx`), the entity's sid when it is an entity, and both values as printed.
- `diffSnapshotViews(expected, actual)`: Every difference between an expected and an actual snapshot view, field by field, in a fixed order (header, rng, resources, next id, entities, plugin bytes) so a report reads the same in every engine.
- `expectGolden(report)`: Throws with the formatted report unless the golden matched or was just written.
- `formatGoldenReport(report)`: One report as text: a line for most outcomes, and for a divergence the tick and up to 20 differences.
- `GOLDEN_MAX_PACKED_BYTES` (const): A golden that passes this cannot be reviewed or loaded cheaply; lower snapshotEvery's cost instead.
- `goldenCommands(options?)`: The Vitest browser commands that let golden tests read golden files in a browser: register them with `browser: { commands: goldenCommands() }`.
- `GoldenReport` (type): What a golden check found: `pass`, `written`, `missing`, `schema-changed`, `content-changed`, `setup-changed` or `diverged` (with the first differing tick and the fields that differ).
- `nodeCompression` (const): Node only. zlib is imported when first used, so importing this module in a browser costs nothing.
- `replayGolden(options)`: Replays a golden `.replay` against the current sim and reports whether it still matches.
- `ReplayGoldenOptions` (interface): What `replayGolden` checks: the `.replay` file, the plugins and content to replay it with, and how to record it when updating goldens.
- `RoundTripFailure` (interface): One case whose restored run differed from the uninterrupted one: its number, sim seed, length, restore tick, variant and a report of what differed.
- `RoundTripOptions` (interface): What `snapshotRoundTripProperty` runs: the plugins, content and a command script, and how many cases of what length to try.
- `RoundTripVariant` (type): How a case restores: into a `fresh` sim, or into one that has `dirty` (stepped on past the snapshot).
- `simGolden(options)`: Plays a scripted run and compares the sim's hash every `every` ticks with the golden JSON file, reporting the first recorded tick that differs.
- `SimGoldenOptions` (interface): What `simGolden` runs: the plugins, content, seed and scripted commands to play for `ticks` ticks, where the golden JSON lives, and how often to record a hash.
- `snapshotRoundTripProperty(options)`: Checks that snapshot, restore and continue equals an uninterrupted run, over many seeds, run lengths and restore points, alternating fresh and dirty restores.
- `streamCompression` (const): Browsers and Node: CompressionStream / DecompressionStream('deflate-raw').

### `import { … } from '@mcthaydt/automata-testing/sim/commands'`

- `goldenCommands(options?)`: The Vitest browser commands that let golden tests read golden files in a browser: register them with `browser: { commands: goldenCommands() }`.
- `GoldenCommandsOptions` (interface): Options for {@link goldenCommands}.

### `import { … } from '@mcthaydt/automata-testing/sim/property'`

- `RoundTripFailure` (interface): One case whose restored run differed from the uninterrupted one: its number, sim seed, length, restore tick, variant and a report of what differed.
- `RoundTripOptions` (interface): What `snapshotRoundTripProperty` runs: the plugins, content and a command script, and how many cases of what length to try.
- `RoundTripVariant` (type): How a case restores: into a `fresh` sim, or into one that has `dirty` (stepped on past the snapshot).
- `snapshotRoundTripProperty(options)`: Checks that snapshot, restore and continue equals an uninterrupted run, over many seeds, run lengths and restore points, alternating fresh and dirty restores.

## `@mcthaydt/automata-ui`

### `import { … } from '@mcthaydt/automata-ui'`

- `ActionBar` (const): One row of actions that collapses as its container narrows (M1.6 spec §3.4; from FloorFifty `ui/layout/ActionBar.svelte` at 122a220).
- `ActionKind` (type): The action bar's model (M1.6 spec §3.4; from FloorFifty `ui/layout/action-bar.ts` at 122a220).
- `applyGeometry(root, geometry)`: Writes the geometry where CSS reads it (spec §3.2).
- `arrowKeyNav(event)`: The menu direction an arrow key walks, as a d-pad would, or undefined when the key is not a bare arrow or its target keeps that arrow.
- `AUDIO_BUSES` (const): The buses the Audio group offers, in the order it shows them.
- `AudioBus` (type): An audio bus (runtime's `AudioBusName`).
- `AudioCopy` (interface): Every word the Audio group shows, in the game's language.
- `AudioSection` (const): The Audio group of the Settings tab (M5 spec §7, M5.4), laid out as FloorFifty's (`SettingsPanel.svelte` at a28dc44): Mute, Mute in the background, then a slider per bus with its percentage.
- `AudioSectionChange` (type): One change in the Audio group: a toggle's new state, or a bus's new gain.
- `AudioValue` (interface): The player's audio choices (runtime's `AudioSettings`): the mutes, and a gain per bus from 0 to 1.
- `BarAction` (interface): One action in an `ActionBar`: an id, a label and a kind (`primary`, `secondary` or `utility`), what it does when selected, and optionally a short label, an icon, a disabled state and a pressed state.
- `BarSample` (type): One reading of the viewport, as `HiddenBrowserBar.measure` needs it.
- `BOOT_FAILURE_COPY_EN` (const): English defaults in Ruken's tone (quiet, human, no blame); replaced by Paraglide keys in M5.
- `bootDeviceClass(win?)`: The device class at boot, read from the window's pointer and screen; `desktop` when the window cannot answer.
- `BootFailure` (type): The structural view of the runtime's boot error that the UI draws: one of six tagged cases, so ui never imports the runtime.
- `BootFailureAction` (type): Try again, Continue without loading, Back to {host}.
- `BootFailureCopy` (type): The words for every boot failure state and action, by name.
- `BootFailurePanel` (const): The state a boot failure draws (M1 shared contracts §3; M1.6 spec §3.6): an ErrorPanel with the failure's copy and its ways forward.
- `BootFailureState` (type): What a boot failure draws: `start`, `connect`, `progress`, `damaged`, `download`, `download-stalled`, `unsupported` or `model-invalid`.
- `bootFailureView(failure, hostKind, canExit)`: Which state a failure draws and which ways forward it offers.
- `BootFailureViewModel` (interface): What `bootFailureView` decides for a failure: the state to draw and the ways forward, in order.
- `Button` (const): The framework's button (M4 spec §4.12): an `.af-control` of one kind.
- `CameraDragSurface` (const): The camera drag surface (M4 spec §16.3.7, M3 spec §4.2 and §7): the player turns the camera by dragging the scene, a finger anywhere outside the controls or the mouse with its secondary button.
- `CameraDragSurfaceProps` (interface): CameraDragSurface's props.
- `Chip` (const): A short status label (M4 spec §4.12).
- `classifyDevice(input)`: A fine primary pointer is a `desktop`; a coarse one is a `phone` when the screen's shorter side is under 600 px, otherwise a `tablet`.
- `classifyFormFactor(width, height)`: The form factor of a layout viewport: a portrait one narrower than 600 px is `phone-portrait`, any other portrait one `tablet-portrait`; a landscape one shorter than 500 px is `phone-landscape`, otherwise `desktop`.
- `classifyHeightTier(height)`: The height tier of a layout height in CSS px: `compact` below 340, `short` up to 600, otherwise `undefined`.
- `CollapseLevel` (type): How far an action bar has collapsed: 0 every label in full, 1 utilities as icons, 2 secondaries on their short labels, 3 wrapped with the primary on its own row.
- `collapseLevel(available, widths)`: The first level whose one-row width fits.
- `COMPACT_MAX_HEIGHT` (const): Below this, compact: what a browser leaves a sideways phone (780 x 270 Chrome on a Galaxy, 667 x 320 Safari on an SE).
- `ControlsCopy` (interface): Every word the Controls section shows, in the game's language.
- `controlsMessage(state, copy, labelOf)`: The section's status line for `state`, with actions by their labels; empty in the list.
- `ControlsRow` (interface): One game action in the Controls section: its id, its name and its bindings now.
- `ControlsSection` (const): The Controls tab's section (M4 spec §4.5, §7), laid out as FloorFifty's Controls tab (`SettingsPanel.svelte` at a28dc44): one section per device the player can use, the one in their hand first and marked.
- `ControlsState` (type): Where a rebind is: the list; waiting for a press (with the seconds left); refused because it would leave `with` unbound; refused as reserved; timed out; or saved.
- `ControlsTouchMode` (type): How touch drives play (runtime's `TouchMode`).
- `CornerControls` (const): Back at the start, the game's own corner controls (Mute, a language flag) at the end, in the same row on every screen (M1.6 spec §3.4; from FloorFifty `ui/layout/CornerControls.svelte` at 122a220).
- `createGeometryOwner(options)`: Creates the geometry owner of a document, the only writer of its geometry: make one per document.
- `CURSOR_IDLE_MS` (const): How long the pointer must be still before it hides on a gameplay screen.
- `cursorHidden(state)`: Whether the pointer is hidden now: on a gameplay screen, not paused, and the pointer unused or idle.
- `CursorInput` (type): The device the player used last, as the cursor policy sees it.
- `CursorRunner` (class): Applies `cursorHidden` to a target element: `attach` follows pointer moves and key presses, and each `tick` sets the element's `cursor` style.
- `defaultSlot(slots)`: The newest slot that can be continued; else the first slot; else none.
- `DeviceClass` (type): The kind of device the player holds: `phone`, `tablet` or `desktop`, decided once at boot.
- `Dialog` (const): A question that needs an answer before the screen goes on (M1.6 spec §3.4; from Ruken `packages/ui/src/Dialog.svelte` at b30d31b).
- `DISPLAY_QUALITIES` (const): The tiers the Display section offers, best first.
- `DisplayCopy` (interface): Every word the Display section shows, in the game's language.
- `DisplayQuality` (type): A graphics quality tier (runtime's `QualityTier`).
- `DisplaySection` (const): The Display section of Settings (M4 spec §4.8, §7): the graphics quality tier as an option group (a pad's `adjust` cycles it), and reduced motion as the browser reports it.
- `DragTracker` (interface): What a CameraDragSurface drives (M4 spec §16.3.7): runtime's `CameraDragTracker` satisfies it, so ui need not import runtime.
- `endonymOf(tag)`: A language's name in its own language ("日本語" for `ja`), from the browser's `Intl.DisplayNames`.
- `enterFullscreen(doc, screen?)`: Enters element fullscreen, then asks for a landscape lock, which most phones refuse outside an installed app.
- `ErrorAction` (interface): One way forward from a failure (M1.6 spec §3.4).
- `ErrorCode` (type): The host contract's error code (DIST spec §4.1).
- `ErrorPanel` (const): A failure, and what the player can do about it (M1.6 spec §3.4; from FloorFifty `ui/components/ErrorPanel.svelte` at 122a220).
- `fitColumns(shape, groups)`: The shape cut to the columns the largest group fills, at its rows.
- `fitShape(most, box, minTile, gap)`: The most tiles of `minTile` px the box holds, never more than `most`, never below one by one.
- `FocusNavigator` (class): Moves focus the way a d-pad would: `move` walks Tab order, `steer` walks a `[data-focus-grid]` spatially, `page` offers a page turn, and `recover` puts focus back on the first control when a screen change dropped it.
- `FormFactor` (type): The four form factors (M1.6 spec §3.1; from FloorFifty `ui/form-factor.ts` at 122a220).
- `fullscreenSupport(doc, nav)`: Which fullscreen, if any, this browser can give a standalone page.
- `FullscreenSupport` (type): The host's answer to whether this browser can go fullscreen, and how.
- `GateInputs` (type): What `landscapeGate` decides from: the form factor, whether the pointer is coarse, the browser's fullscreen support and state, and whether the page is installed as an app.
- `Geometry` (interface): The geometry every screen lays out against: the layout size, form factor and height tier, the insets, the usable and visible regions, what covers the page's foot, and the host's scale hint.
- `GeometryInput` (interface): What `measureGeometry` reads: the layout viewport, the visual viewport, the safe-area insets, the host's display metrics, a hidden bar's height and the layout before a keyboard shrank it.
- `GeometryOwner` (interface): The one geometry owner of a document: `geometry.current` for components, `onChange` for script, `setHostDisplay`, `remeasure` and `dispose`.
- `GeometryOwnerOptions` (interface): What `createGeometryOwner` needs: the window to read and the root to publish on, and optionally the host's display, timers and a safe-area reader.
- `GeometryState` (interface): The current geometry as rune state: reading `current` in a component or `$derived` tracks it.
- `GridBox` (interface): The measured box a page is fitted into, in CSS px.
- `GridPage` (interface): One page: a group's items, padded with `undefined` to the page's capacity.
- `GridShape` (interface): A page's columns and rows.
- `HeightTier` (type): The height tiers (M1.6 spec §3.1; from FloorFifty `ui/height-tier.ts` at 122a220).
- `HiddenBrowserBar` (class): Recognises a browser bar the browser has stopped reporting (DuckDuckGo for Android's bottom bar) and measures how much of the page's foot it covers.
- `HostDisplay` (type): What the host says about the display: the parts of Ruken's `display.metrics` the geometry reads.
- `HostKind` (type): `Hosting['kind']` (shared contracts §1.1), written out because ui never imports host.
- `hostReservedInsets(host)`: Ruken reserves a strip on one edge; its width is the rect's, never negative (FloorFifty `reservedOf`).
- `IconButton` (const): A button whose face is an icon (M4 spec §4.12).
- `InputMethod` (type): The input method the player last used, app-wide.
- `InputMethodTracker` (class): Tracks the input method the player used last (`keyboard`, `gamepad` or `touch`) as rune state in `method`.
- `Insets` (interface): CSS px on each side, all >= 0.
- `installGlobalErrorHandlers(win, onFatal, onRejection?)`: Installs once per window; a second call is a no-op.
- `interceptBackGesture(win, onBack)`: Holds the game's history entry and turns a back step off it into `onBack`.
- `isDuckDuckGo(nav)`: DuckDuckGo names itself only in the client-hint brands, not the user agent.
- `isFullscreen(doc)`: Whether the page is fullscreen now.
- `isTap(dx, dy)`: Whether a press that moved `dx`, `dy` px is a tap rather than a swipe.
- `keyLabel(code, layout?)`: A key's label: the keyboard layout's own (`navigator.keyboard.getLayoutMap()`, a letter in capitals) when there is one, else its `code` without the `Key` and `Digit` prefixes, an arrow as its arrow.
- `landscapeGate(inputs)`: What a phone held sideways must do: `none`, `fullscreen` (one tap to go fullscreen) or `rotate-or-install` (turn upright or add to the Home Screen).
- `LandscapeGate` (const): The landscape gate's cover (M4 spec §4.9, §7; FloorFifty `ui/components/LandscapeGate.svelte` at `ac72660`): over every screen and every dialog, empty whenever the gate is open (`state` none).
- `LandscapeGateCopy` (interface): The landscape gate's words: one tap to fullscreen, or how to play where a browser cannot hide its bar.
- `LandscapeGateState` (type): Nothing; a tap to go fullscreen; or turn upright / add to the Home Screen.
- `LanguageCopy` (interface): Every word the Language group shows besides the languages' own names, in the game's language.
- `LanguageSection` (const): The Language group of the Settings tab (Owner, 2026-10-18), laid out as FloorFifty's (`LanguagePicker.svelte` at a28dc44): Automatic, then each of the game's languages by its endonym, each in its own `lang` so a screen reader says it in that language.
- `LeaderboardCopy` (interface): Every word the panel shows, in the game's language.
- `LeaderboardEntryView` (interface): One row of a board, as the host gives it; `isMe` marks the player.
- `LeaderboardPanel` (const): A board's rows, or why there are none (M5 spec §7): loading, entries (the player's row marked "you" in words, not only by colour), empty, unavailable and offline.
- `LeaderboardView` (type): What the panel shows: the rows, or why there are none.
- `LoaderOverlay` (const): The loader over a screen while its assets load (M1.6 spec §3.4; from FloorFifty `ui/components/LoaderOverlay.svelte` at 122a220).
- `lockOverscroll(node)`: A Svelte action: `<div use:lockOverscroll>`.
- `measureGeometry(input)`: Turns what the browser and the host report into one `Geometry`.
- `Modal` (const): A panel over the screen with a visible Close (M4 spec §4.12; the rules of FloorFifty `ui/components/Modal.svelte` at ac72660).
- `ModalProps` (interface): The props Modal and Sheet share.
- `NavDirection` (type): A direction a d-pad or an arrow key walks a menu.
- `nearestTarget(x, y, targets, margin?)`: The button a point is on, or else the nearest within the margin, or nothing.
- `onFullscreenChange(doc, listener)`: Hears fullscreen being entered or left, by the page or the player.
- `OptionGroup` (const): A choice of one (M4 spec §4.8; the rules of FloorFifty `ui/layout/OptionGroup.svelte` at `ac72660`): a segmented row whose chosen option is filled and marked, never only underlined or only coloured.
- `PAD_FOCUS` (const): How the navigator focuses: with a ring, and without scrolling the page.
- `padKeyEvents` (const): Keydown events the navigator sent itself.
- `padLabel(button, glyphs, copy)`: A standard-mapping pad button's label on a pad of `glyphs`.
- `PadWord` (type): The pad buttons known by a word, for a pad whose labels are not known.
- `PAGE_SWIPE` (const): Swipe is the pagination on a paged region, on every form factor: a finger, a mouse drag, a trackpad's two-finger sideways swipe.
- `PagedGrid` (const): A grid of items in pages that never scrolls (M4 spec §4.8; the page arithmetic of FloorFifty `ui/tile-pages.ts` at `ac72660`).
- `PagedGridProps` (interface): PagedGrid's props: groups of items, the most columns and rows a page has, and the page its owner shows.
- `PageGroup` (interface): A titled run of items; each group starts its own page.
- `pageOf(pages, id)`: The page holding the item with `id`, or -1 when no page does.
- `PagerDots` (const): Where a paged view is (M4 spec §4.8; from FloorFifty `ui/layout/PagerDots.svelte` at `ac72660`): one row of dots, each a whole touch target, or "3 / 11" once the dots would not fit on one row.
- `pagerMode(count, max?, available?, dotSize?)`: PagerDots' choice (M4 spec §4.8; from FloorFifty `ui/layout/pager.ts` at `ac72660`): dots while they fit on one row, a counter ("3 / 11") once they would not.
- `paginate(groups, capacity, continued?)`: One group per page; a group longer than a page continues under `continued(title, part)`, "Title (2)" by default.
- `pastEdge(scroller, dy)`: Whether a drag of `dy` (positive = finger moving down) would pass an edge.
- `PHONE_LANDSCAPE_MAX_HEIGHT` (const): A landscape viewport shorter than this is a phone, or a desktop window short enough to need the phone's compact layout.
- `PHONE_PORTRAIT_MAX_WIDTH` (const): A portrait viewport narrower than this is a phone; at or above it, a tablet.
- `PointerLatch` (class): Which fingers are down on which action.
- `PointerTracker` (interface): What a SwipeSurface drives: runtime's `SwipeTracker` satisfies it, so ui need not import runtime.
- `probeEnvSafeArea(root)`: Reads `env(safe-area-inset-*)` through a hidden probe, since script cannot read `env()` directly.
- `Prompt` (const): A device prompt (M4 spec §4.6): the label of an action's input on the device in the player's hand, a key, a pad button or the touch label, or "Unbound".
- `PromptBinding` (interface): What drives one action (runtime's `InputBinding`, the fields a prompt reads).
- `PromptCopy` (interface): Every word a prompt shows, in the game's language.
- `PromptDevice` (type): The device a prompt is for (runtime's `InputDevice`).
- `PromptGlyphs` (type): The labels a pad's buttons carry (runtime's `GlyphFamily`).
- `PromptView` (type): What a prompt shows: its kind (`data-prompt`) and its label.
- `promptView(binding, device, glyphs, copy, layout?)`: What a prompt shows for `binding` on `device`: its first input there, or Unbound.
- `readKeyboardLayout(nav)`: The keyboard's layout map where the browser has one (`navigator.keyboard`, Chromium), or undefined: where the browser has none or refuses (a cross-origin frame may), prompts name keys by their `code` (M4 spec §6).
- `RebindDevice` (type): A device a player can rebind (touch buttons and gestures are the game's).
- `Rect` (interface): A rectangle in CSS px: its top-left corner and its size.
- `reducedMotion(win?)`: Whether the player has asked for less movement.
- `releaseStep(dx, dtMs, pageWidth)`: Pages to turn when a drag of `dx` px over `dtMs` is released: a swipe left is +1 (next).
- `RETRY_DELAYS_MS` (const): The wait before each retry; when they are spent, the image has failed.
- `RetryTimers` (type): The timers `watchImage` waits with; tests pass fakes.
- `retryUrl(src, attempt)`: The URL a retry asks for; attempt 0 is the first request, as given.
- `RotateHint` (const): The rotate hint (M4 spec §4.9, §7): over a game locked to one orientation (`GameSpec.orientation`) on a phone held the other way.
- `RotateHintCopy` (interface): The rotate hint's words.
- `RotateToast` (const): The rotate toast (Owner amendment to M4 spec §4.9, 2026-10-18; FloorFifty `RotateHint.svelte` at a28dc44): for a game with `rotateHint: 'toast'`, a small message at the top on a phone held the other way, "Turn your phone for a bigger view", with an OK.
- `RotateToastCopy` (interface): The rotate toast's words (`rotateHint: 'toast'`, FloorFifty's): the advice, and its OK.
- `SAVE_STATUS_TONES` (const): `conflict` points the player at the host's own question (M5 spec §5), so it is a warning, not an error.
- `SaveSlotActivity` (type): A write the caller has started and not finished, or one that failed.
- `SaveSlots` (const): The save slots (M5 spec §6, §7): a row for each slot, and the few things a player does with one.
- `SaveSlotsCopy` (interface): Every word the list shows, in the game's language (each a PRODUCT.L message key).
- `SaveSlotsView` (type): What the list shows: a moment of loading, or the slots.
- `SaveSlotView` (type): One slot, as the list shows it.
- `SaveStatus` (const): The host's save state in words (M5 spec §7): checking, syncing, saved, offline-queued, retry, conflict, recovered, and "no grant" for a game that was not given the saves grant ("Progress won't be kept").
- `SaveStatusCopy` (type): One line per state, in the game's language (each a PRODUCT.L message key).
- `SaveStatusState` (type): What the host says about the player's saves, or that there is no grant.
- `SaveStatusTone` (type): How much a state asks of the player's notice.
- `ScreenFrame` (const): Every screen's frame: the visible region, a corner row, then a hero and a body (M1.6 spec §3.4; from FloorFifty `ui/layout/ScreenFrame.svelte` at 122a220).
- `ScreenKind` (type): A screen's kind (`ScreenDef.kind`): only `gameplay` may hide the pointer.
- `ScrollList` (const): A list that keeps its rows (M1.6 spec §3.4; from FloorFifty `ui/layout/ScrollList.svelte` at 122a220).
- `scrollWithin(element)`: Brings `element` into view by scrolling its nearest scroll box, never the document.
- `sendBack(doc)`: Sends Back as an Escape to wherever a dialog would hear it, and reports whether anything took it.
- `SettingsScreen` (const): The core Settings screen (M4 spec §4.8, M4-D8), laid out and behaving as FloorFifty's settings (`ui/components/SettingsPanel.svelte` in `PauseOverlay.svelte` at a28dc44; Owner 2026-10-18: "match the layout and function, not the style"): a dialog over the dimmed game, the same frame as Paused, so going between them reads as one dialog changing its view.
- `SettingsSection` (type): A section of the Settings screen: the screen's own snippet, or an extension's slot component.
- `SettingsTab` (interface): A tab of the Settings screen (FloorFifty's Settings and Controls): its label and its sections, in order.
- `SETTLE_DELAYS_MS` (const): When to measure again after a viewport event, in ms.
- `Sheet` (const): A Modal on the bottom edge at every form factor (M4 spec §4.12): the same scoping, Close and scroll region, where a thumb reaches the actions.
- `SHORT_MAX_HEIGHT` (const): At or below this many CSS px of layout height, a screen is short.
- `Sleeper` (type): Puts the game's sound to sleep while nobody can see it.
- `sleepWhenHidden(doc, sleeper, win?)`: Puts a game's sound to sleep while its page is hidden and wakes it when the page shows again; a pointer, touch or key gesture also asks sound the system suspended to resume.
- `Slider` (const): A number in a range (M4 spec §4.12): a labelled native `<input type="range">`, so the browser gives the arrow keys and the focus navigator's `adjust` steps it.
- `slotActionsOf(slot)`: What a player may do with a slot (M5 spec §6).
- `Split` (const): Two panes side by side where both fit at `min` px, stacked otherwise (M4 spec §4.8; from FloorFifty `ui/layout/Split.svelte` at `ac72660`).
- `splitMode(available, min, gap)`: Split's choice (M4 spec §4.8; from FloorFifty `ui/layout/split.ts` at `ac72660`): side by side when both columns and the gap between them fit at their minimum, stacked otherwise.
- `STICKY_MARGIN_PX` (const): How far outside a button a thumb still counts for it, in CSS pixels.
- `StickyPointers` (class): Which button each finger is on, over the latch.
- `suppressPageGestures(doc)`: Turns off the browser's document gestures over the game.
- `SwipeIndicatorView` (interface): What a SwipeSurface draws: the thumb, the anchor it trails and whether it is past the dead zone.
- `SwipeSurface` (const): The whole visible screen as one swipe surface (M4 spec §4.4), from FloorFifty `ui/components/SwipeSurface.svelte` at `ac72660`.
- `SwipeSurfaceProps` (interface): SwipeSurface's props.
- `tabbables(root)`: Everything Tab can reach under `root`, in DOM order: not disabled, inert or hidden.
- `tileSide(shape, box, gap, limits)`: A square tile's side for the space a grid is given: the width shared by the columns and the `peek` (a fraction of a tile) of the next page showing at the edge, and the height only when the box has one.
- `Timers` (interface): Injected so tests drive the settle delays with fake timers.
- `Toast` (const): A passing message (M4 spec §4.12): "Pad connected", "Saved", "This controller is not supported".
- `Toggle` (const): An on/off setting (M4 spec §4.12): a native checkbox with the switch role, so the browser gives Space and the focus navigator's `adjust` flips it.
- `TouchButtonSpec` (interface): One on-screen touch button (M4 spec §4.4): the action it holds and what it shows.
- `TouchControls` (const): The on-screen touch buttons (M4 spec §4.4), from FloorFifty `ui/components/TouchControls.svelte` at `ac72660`.
- `TouchControlsProps` (interface): TouchControls' props.
- `TouchCopy` (interface): Every word the Touch controls group shows, in the game's language.
- `TouchSection` (const): The Touch controls group of the Settings tab (FloorFifty `SettingsPanel.svelte` at a28dc44): how touch drives play, on-screen buttons or swipes, as an option group.
- `TouchStickSpec` (interface): The overlay's move stick (M4.12).
- `TouchTarget` (interface): A button's action and where it is drawn, for `nearestTarget`.
- `trimRows(shape, groups)`: The shape cut to the rows the largest group fills, so no page carries a row of empty slots.
- `UI_SLOT_NAMES` (const): The named places an extension may add UI (M1 shared contracts §2; M1.6 spec §3.7).
- `UiComponent` (type): What an extension puts in a slot: a Svelte component that takes no props.
- `UiSlotName` (type): The name of a place an extension may add UI: one of `UI_SLOT_NAMES`.
- `VibrationCopy` (interface): Every word the Vibration group shows, in the game's language.
- `VibrationSection` (const): The Vibration group of the Settings tab (Owner, 2026-10-18; FloorFifty's rumble row in `SettingsPanel.svelte` at a28dc44): one toggle for a pad's rumble and a phone's buzz (`Haptics`).
- `ViewportWindow` (interface): The parts of `window` the owner reads; a fake from `@mcthaydt/automata-testing` stands in for it in tests.
- `watchImage(src, onRetry, timers?)`: Probes `src` and, while it fails, hands `onRetry` each retry's URL to draw instead.
- `WheelPager` (class): A trackpad's horizontal wheel deltas, one page per gesture; `reset` when the gesture goes quiet.
- `withHostName(text, hostName)`: Fills the `{host}` slot of a copy string with the host's name.
- `wrapPage(index, count)`: `index` wrapped into `0..count - 1`, so paging past either end comes round.

### `import { … } from '@mcthaydt/automata-ui/testing'`

- `byTestId(id)`: The element a test id names; throws when the fixture has none, so a missing part fails loudly.
- `checkLayout(conditions, essentials)`: The checks every screen shares: the document never scrolls; every control is at least the target (primaries the primary target) at this scale, on screen unless in a declared scroll region, never under a reserved area or a touch button and never over the corner row; the corner row's controls and any `data-way-out` stay reachable (but under a modal dialog or an ErrorPanel that had to rise); no ActionBar wraps (level 3); no row (`[data-row]`) clips what it holds; no control is cut at the side of the scroll region it scrolls in (`findCutAtSide`: a region declared `data-scroll-region="both"` scrolls sideways too), and no control's words run past its edge; and each of `essentials` is reachable without scrolling.
- `Conditions` (interface): The conditions a layout test runs under: the geometry published for a size and variant, and the regions that cover the page (the keyboard, Ruken's strip), which nothing may sit under.
- `errorPanelFloor(panel)`: The least height any of an ErrorPanel's layouts needs, measured here rather than read from the panel, so a panel that misjudges its room cannot excuse itself (spec §3.4, §7).
- `publishConditions(root, size, variant)`: Measures and publishes the geometry for `size` under `variant`, as the owner would.
- `settleLayout()`: Waits until a freshly mounted fixture has finished laying out: fonts loaded, then two frames, so ResizeObserver callbacks (ActionBar's collapse, ScrollList's measure) and the re-layout they cause have run.
