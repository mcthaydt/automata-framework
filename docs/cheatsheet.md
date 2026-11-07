# Automata cheatsheet

> Every export of every published `@automata/*` entry point, one line each, grouped by module (package). Generated from the API index by `pnpm api-index --write` after `pnpm build`; do not edit by hand. `pnpm api-index` fails when this page is stale. Full signatures and doc comments: the API reference (`api.md`).

## `@automata/audio-synth`

### `import { … } from '@automata/audio-synth'`

- `audioContent` (const): The `audio` content kind: `content/audio/*.toml` holds a game's cues, beds, event map, ducking and music.
- `AudioContent` (interface): A game's whole `audio` content: master gain, cues, beds, the map from sim events to cues, the ducking rules, and the music slots and rules.
- `audioSchema` (const): The Zod schema of the `audio` content.
- `AudioSynth` (interface): The audio runtime.
- `audioSynthExtension` (const): The audio-synth extension a game opts into.
- `AudioSynthOptions` (interface): What `createAudioSynth` needs: the audio table (read at each event, so a reload shows), the port into the game's buses, an optional seed and how many ticks behind the picture an event is still answered.
- `Bed` (interface): A looping bed: steady drones, optional filtered noise and an optional slow pulse.
- `BUSES` (const): Every audio bus, in order.
- `BusId` (type): One of the four audio buses: music, sfx, ui and voice.
- `Candidate` (interface): A file that would play for a slot, with its final level.
- `Condition` (type): What a music rule asks of one key of the game's state: an exact value, one of a list, or within `atLeast` and `atMost`.
- `coverage(content, wanted)`: Every event the game declares, with where it comes from, against the event map: cued, silent with a reason, or missing.
- `Coverage` (interface): Whether every event a game can produce is answered: `missing` lists events with no row, and `silent` lists events that are silent on purpose, with the reason.
- `createAudioSynth(options)`: Starts the audio runtime.
- `createMixer({ port, ducks })`: Makes a mixer that plays into the buses the game already has.
- `createMusicDirector(options)`: Turns the rows' answer into the slot to play.
- `Cue` (interface): A short sound as a recipe of voices, played on a bus.
- `cueLength(cue)`: Seconds from a cue's start to its last voice's end (a tone rings 0.05 s past its ramp).
- `dbToGain` (const): Turns decibels into a gain multiplier: -6 dB is about half.
- `DISTANCE` (const): Distance model: full level within `ref` metres, then ref / (ref + rolloff · (d − ref)).
- `DuckRule` (interface): While a cue on `bus` plays, each bus in `duck` drops by `db`, then recovers.
- `EventRow` (interface): A sim event id or a `*` pattern, and the cue it plays or the reason it plays none.
- `Fallback` (interface): A music file standing in for a slot: `volume` multiplies the slot's, `filter` colours it.
- `FilterId` (type): The colour a music file can be given.
- `FILTERS` (const): The cut-off frequencies of each filter: `radio` removes everything below 450 Hz and above 3000 Hz.
- `holds(want, value)`: Whether `value` satisfies `want`: equal, one of a list, or within `atLeast`/`atMost`.
- `Listener` (interface): Where the ears are: the camera's ground position and yaw (0 looks toward −z, right is +x).
- `Mixer` (interface): Plays cues on their buses with ducking and, for world cues, panning and distance.
- `MixerOptions` (interface): What `createMixer` needs: the port into the game's audio buses and the ducking rules.
- `MixerPort` (interface): What the mixer needs of core: a node to connect a source to for a bus, and a duck.
- `MusicDirector` (interface): Chooses which music slot plays as the game's state changes.
- `MusicDirectorOptions` (interface): The slots and rules a music director chooses from.
- `MusicRule` (interface): Picks a music slot when every key in `when` holds.
- `MusicState` (type): What the rules read: a flat record.
- `noiseBuffer(ctx, seconds)`: Seeded white noise (the Park–Miller generator, seed 7): every hiss is the same noise.
- `PAN_WIDTH` (const): How far a sound fully to one side pans (1 would silence the other ear).
- `playCue(ctx, out, cue, when?, random?)`: Plays a cue's voices at `when`.
- `PlayOptions` (interface): How to play one cue: where it sounds, when to start it in audio-context seconds, a random source and how long it holds a duck.
- `playVoice(ctx, out, voice, when, random?)`: Schedules one voice at `when` (context seconds) into `out`.
- `resolveSlot(slot, available)`: What plays for `slot`, best first: its own file, then each fallback that exists.
- `rowFor` (const): The first row of the event map that matches `event`.
- `Slot` (interface): One piece of music the game can switch to.
- `slotFor(rules, state)`: The slot `state` calls for: the first row that matches wins, so the order is the priority.
- `slotsFor(rules, slots, key, value)`: The loops the rows play when `state[key]` is `value`, best first: for loading ahead of the scene.
- `Spatial` (interface): How a world sound reaches the listener: a pan from -0.8 (left) to 0.8 (right) and a gain that falls with distance.
- `spatial(listener, at)`: Pan and distance gain of a world sound at `at` for `listener`.
- `startBed(ctx, out, bed)`: Starts a bed into `out`; returns its stop function.
- `StateValue` (type): A value a music rule can test: text, a number or a yes-or-no.
- `Voice` (interface): A tone (`tone`, `from`, `to`) or a hiss (`hiss`, `q`), `at` seconds in, `length` long, at `volume`.
- `Wave` (type): The shape of a tone: sine, square, sawtooth or triangle.
- `WAVES` (const): Every tone shape.

### `import { … } from '@automata/audio-synth/browser'`

- `Renderers` (interface): The offline renderers the page offers the audio pipeline: a cue, a bed, a mix and the ducking demonstration, each answering plain number arrays.

### `import { … } from '@automata/audio-synth/measure'`

- `ClickOptions` (interface): How strict the click check is: the smallest second difference that counts (`floor`) and how far it must stand out from its neighbours (`ratio`).
- `clicks(x, rate, { floor, ratio }?)`: Clicks: a second difference that stands out of everything around it.
- `decay(x, from, rate)`: RT60 measured from a decaying tail starting at `from`: the level in 10 ms windows, a straight line fitted to it from 5 dB below its start to 25 dB below (a T20), extended to 60 dB.
- `decodeWav(bytes)`: Decodes a 16-bit PCM WAV.
- `encodeWav(channels, sampleRate)`: Encodes `channels` (equal length, -1..1; anything outside is clamped) as a 16-bit PCM WAV.
- `integratedLoudness(channels, rate)`: Integrated loudness in LUFS (gated), `null` when the signal is shorter than one 400 ms block, `-Infinity` when all is gated out.
- `rms(x, from, to)`: The root mean square of `x[from..to)`.
- `truePeak(channels)`: True peak in dBTP: the sample peak of a 4x windowed-sinc upsampling.
- `Wav` (interface): A decoded WAV file: its sample rate and one array of samples between -1 and 1 for each channel.

### `import { … } from '@automata/audio-synth/render'`

- `CueRenderOptions` (interface): How to render one cue: how many seconds, and optionally where it sounds and where the listener is, for a world cue.
- `DuckRenderOptions` (interface): How to render the ducking demonstration: its length, when the line starts, which cue is the line and which bed to listen on.
- `MixSpec` (interface): A mix to render: its length in seconds, the bed under it and the cues to play at which times.
- `OfflineLike` (interface): The part of `OfflineAudioContext` a render needs.
- `OfflinePort` (interface): A mixer port for an offline render.
- `offlinePort(ctx, { release }?)`: Core's buses for an offline render: a gain per bus into the destination, and ducks as gain automation.
- `OfflinePortOptions` (interface): How long a duck takes to let go after its hold, in seconds.
- `renderBed(env, content, id, seconds)`: A bed for `seconds`.
- `renderCue(env, content, id, options)`: One cue through the mixer, alone.
- `renderDuck(env, content, options)`: A bed, with `line` played at `at`: the ducking demonstration.
- `RenderEnv` (interface): What an offline render needs from the page: a function that makes an offline audio context, and optionally a sample rate.
- `renderMix(env, content, mix)`: A sequence of cues over a bed: the bus and gameplay mix the loudness targets apply to.
- `SAMPLE_RATE` (const): The sample rate offline renders use: 48000 Hz.
- `seeded(seed?)`: A seeded random (mulberry32), so a crackle renders the same every time.

## `@automata/content`

### `import { … } from '@automata/content'`

- `AssetsSource` (interface): What `content/assets.toml` says: for each screen, the files it waits for (`dir/*` names every file in a folder), and the atlases and fonts of the asset build it uses, by their names in `atlases.toml` and `fonts.toml`.
- `buildContent` (const): Compiles, writes every output under the output folder, then removes the outputs it no longer produces.
- `checkTuningLayer(layer, options, { complete })`: Checks one layer of tuning against code-owned declarations.
- `compileContent` (const): Compiles `<root>/content` in memory.
- `CompileContentResult` (type): What `compileContentResult` answers: the content, or the error `compileContent` failed with.
- `compileContentResult` (const): `compileContent` for a caller outside Effect (a package's tests, a script): runs it and answers with a plain value, so the caller imports no `effect`.
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
- `DEFAULT_PALETTE` (const): The palette a game gets when it has no `content/palette.toml`: DUEL, its ramps row-major (colour `r * 8 + s`).
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

### `import { … } from '@automata/content/assets'`

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

### `import { … } from '@automata/content/game-config'`

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

### `import { … } from '@automata/content/level-2d'`

- `checkEntityDef(def)`: Problems with an entity definition: its id and color, then each field's problems tagged with the field's id and index, with a repeated field id reported at its later occurrence.
- `checkFieldDef(def)`: Problems with one field definition, in a stable order: id, misplaced properties, bounds, step, options, default.
- `checkFieldValue(def, value)`: Whether `value` fits the field: `undefined` when it does, else the first problem.
- `ContentEntityDef` (type): An entity definition in `project.toml`: a typed-field definition plus how the editor draws and places it.
- `ContentEntityItem` (interface): One placed entity in a level: its definition, its position (and size when resizable) and its field values.
- `ContentLevel` (interface): A level as `levels/<id>.toml` holds it, after parsing the TOML.
- `ContentLevelLayer` (type): One layer of a level, by kind: tile rows, IntGrid rows, auto-tile stacks, entities or objects.
- `ContentNeighbours` (interface): One level's neighbours in `world.toml`, each side ordered by position and then id.
- `ContentObjectItem` (interface): One placed tile object in an objects layer.
- `ContentProject` (interface): The project as `project.toml` holds it: the layer, tileset and entity definitions every level uses.
- `ContentProjectLayer` (type): A layer definition in `project.toml`, by kind.
- `ContentRows` (interface): One stack entry of an auto layer: run-length row strings.
- `ContentSize` (interface): A width and height in pixels.
- `ContentTileset` (interface): A tileset in `project.toml`: its tile size, grid, optional image and tags.
- `ContentWorld` (interface): The worlds as `world.toml` holds them: layout, level placements and, for a grid world, each level's neighbours.
- `defaultFieldValue(def)`: The value an instance gets when it has none: the field's `default`, else the type's zero (moved into a number's bounds), else `[]` for a list.
- `entitiesOf(level, layer)`: The items of an entities layer, in file order.
- `ENTITY_ID` (const): An entity definition id.
- `EntityDef` (interface): A thing a game places: an id, a label and the typed fields its instances carry.
- `EntityDefCode` (type): The reasons `checkEntityDef` can refuse an entity definition.
- `EntityDefIssue` (interface): One problem found in a parsed entity definition, with the path of the field at fault.
- `entityDefIssues(def)`: The entity-level problems of a definition, for `superRefine`: its id and color, and a repeated field id at the later field's path.
- `EntityDefProblem` (interface): A problem with a definition; `fieldId` and `fieldIndex` (its place in `fields`) say which field when the problem is in one.
- `entityDefSchema` (const): The schema of an entity definition: strict shape, then the rules `checkEntityDef` applies.
- `entityDefShape` (const): The keys of an entity definition, for an editor to extend (`z.strictObject({ ...entityDefShape, shape: … })`) so its own entity schema never copies the kit's keys (`EntityDef2D = EntityDef & { shape, size, … }`).
- `FIELD_ID` (const): A field id as an inspector shows it and a file stores it.
- `FIELD_TYPES` (const): Every field type, in the order a picker lists them.
- `FieldDef` (interface): The definition of one typed field: its id, type and the bounds, options or target its type needs.
- `FieldDefCode` (type): The reasons `checkFieldDef` can refuse a field definition.
- `fieldDefSchema` (const): The schema of a field definition: strict shape, then the rules `checkFieldDef` applies.
- `FieldProblem` (interface): A problem with a field, with a stable `code` and a sentence to show.
- `FieldType` (type): The kind of value a field holds: int, float, bool, text, enum, color, angle, ref or point.
- `FieldValue` (type): A value a field can hold: a number, boolean, string, point, reference or a list of those.
- `FieldValueCode` (type): The reasons `checkFieldValue` can refuse a value.
- `FieldValueProblem` (interface): `badListItem` carries the index of the first bad item and that item's own problem as `cause`.
- `FieldValues` (type): The values an instance holds, by field id.
- `fieldValueSchema` (const): Any well-formed value shape.
- `fieldValuesSchema` (const): The schema of the values an instance holds, by field id.
- `HEX_COLOR` (const): A field's color value: `#rrggbb`, either case.
- `InstanceCode` (type): The reasons an instance's values can disagree with its definition.
- `InstanceProblem` (interface): A problem with one value of an instance, found by `checkValues`.
- `intGridRows(level, layer)`: The cells of an IntGrid layer, one array of numbers per row (0 is empty).
- `level2dKinds(options?)`: The kinds `levels` (in the sim's content), `project` and `world` (outside it).
- `Level2dKindsOptions` (interface): Options for `level2dKinds`.
- `levelContentSchema` (const): The strict schema of `levels/<id>.toml`.
- `Point` (interface): A position with `x` and `y`.
- `projectContentSchema` (const): The strict schema of `project.toml`.
- `RefValue` (interface): `target` and `container` are opaque to the kit: whether they resolve is the editor's check.
- `worldContentSchema` (const): The strict schema of `world.toml`.

### `import { … } from '@automata/content/locale'`

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

### `import { … } from '@automata/content/palette'`

- `DEFAULT_PALETTE` (const): The palette a game gets when it has no `content/palette.toml`: DUEL, its ramps row-major (colour `r * 8 + s`).
- `DUEL_RAMP_NAMES` (const): One lowercase word for each ramp, in ramp order, so a swatch can say `{ ramp = "skin", step = 5 }` instead of a bare number.
- `DUEL_RAMPS` (const): DUEL's 32 ramps of 8 `#rrggbb` colours, dark to light: colour `r * 8 + s` is ramp `r`, step `s`.
- `duelIndex(name, at)`: The palette index (0 to 255) of step `at` (0 dark to 7 light) on the ramp called `name`.
- `DuelRampName` (type): A ramp's name.
- `nearestDuel(hex)`: The palette index of the DUEL colour nearest `hex` (`#rrggbb`) in OKLab; the first wins a tie.
- `Palette` (interface): The game's palette: a name and its colors.
- `rampOf(index)`: The ramp (0 to 31) a palette index is on.
- `step(index, by)`: `index` moved `by` steps along its own ramp (negative is darker), stopping at the ramp's ends.

### `import { … } from '@automata/content/schema'`

- `contentRef(kind)`: The ID of another content item of `kind`.
- `ContentSchemaDef` (interface): A content kind a game registers: its name, the Zod schema each item must match, where its TOML files live, and whether the sim receives it.
- `ContentSchemaOptions` (interface): Options for `defineContentSchema`; `sim: false` keeps the kind out of the sim's content and its hash.
- `ContentSchemaPlace` (type): Where a kind's files are: every TOML file under a folder (a collection), or one file (a document).
- `defineContentSchema(kind, schema, place, options?)`: Registers a content kind: a name, its Zod schema, and a folder (every TOML file in it is an item) or one file (a single document).
- `localized()`: Text a player reads, written in the source language.

### `import { … } from '@automata/content/vite'`

- `automataContent(pluginOptions?)`: The Vite plugin that compiles content and serves it as `virtual:automata/content`.
- `AutomataContentOptions` (type): The plugin's options: `ContentOptions`, with `root` defaulting to Vite's root.
- `VIRTUAL_MODULE_ID` (const): The import path of the compiled content: `content`, `contentHash`, `simContent` and `simContentHash`.

## `@automata/debug`

### `import { … } from '@automata/debug'`

- `audioBoard(content, controls)`: Builds the audio board for the debug overlay from the game's audio content and its controls.
- `AudioBoardBed` (interface): One looping bed on the audio board: its id, its bus, a line about it and whether it is still a draft.
- `AudioBoardCue` (interface): One cue on the audio board: its bus, its line, and the sim events that play it.
- `AudioBoardPort` (interface): The audio board: every cue and bed, and a way to play them through the mixer the game installed.
- `AudioControls` (interface): What the audio board needs from the game's mixer and synth: play a cue, start or stop a bed and say which beds are playing.
- `BusPort` (interface): The presentation bus, as far as the debug panels need it.
- `createOverlay(options)`: Makes the overlay's state.
- `debugExtension` (const): The debug extension a game opts into in dev and `--debug` builds only.
- `DebugHost` (interface): Everything the debug panels can read, handed over by the game with `installDebug`.
- `DebugOverlay` (const): The debug overlay.
- `DebugPanelDef` (interface): One tab of the debug overlay: a kebab-case id that is not used twice, a title (debug words are not translated) and the component that draws it.
- `debugPanels(...panels)`: Checks the panels and returns them in the order given.
- `FactEntry` (interface): One fact heard on the presentation bus: its name and one line of text.
- `FactLog` (interface): The bus panel's record of the last facts heard.
- `feelBoard(content, feel, tick)`: Builds the feel board for the debug overlay: every event the feel content reacts to, and a way to fire one.
- `FeelBoardPort` (interface): The feel board: every event the content reacts to, and a way to fire one.
- `installDebug(host)`: Makes `host` the one the overlay shows, and its driver (if any) `window.__automataDebug`, with `panels()` added.
- `NetDiagnosticsPort` (interface): The net diagnostics: a summary object (`NetDiagnostics.summary()`), read as rows.
- `Overlay` (interface): The overlay's state and its dev-input rules, apart from any view: toggle, close, pick a tab, pause, and handle a key or a touch count.
- `OverlayOptions` (interface): What the overlay starts with: its panels, and the function that pauses the game when the pause toggle is used.
- `OverlayState` (interface): Whether the overlay is open, which tab it shows and whether the game is paused from it.
- `recordFacts(bus, names, limit?)`: Starts listening for the named facts on the bus and keeps the last `limit` of them (50 by default).
- `RUNTIME_FACTS` (const): The facts the runtime publishes (core's `RuntimeFacts`), for a host that does not name its own.
- `shippedPanels` (const): The panels debug comes with: Sim, Bus, Feel, Audio and Net.
- `SimProbe` (interface): What the sim panel shows, read each time the panel refreshes.
- `summaryPanel(id, title)`: A panel for an extension's summary: it lists `host.summaries[id].summary()` as rows.
- `SummaryPort` (interface): An extension's debug summary (DBG-D4): a plain object the extension builds from its own state, shown as rows by `summaryPanel`.
- `SummaryRow` (interface): One row of a diagnostics summary: a dotted name and its value as text.
- `summaryRows(summary, prefix?)`: Turns a diagnostics summary into rows: nested objects get dotted names, a distribution (count, last, min, p50, p95, max) takes one row and long fractions are rounded.

### `import { … } from '@automata/debug/vite'`

- `debugBuild(debug)`: A Vite plugin that sets `__AUTOMATA_DEBUG__`.

## `@automata/feel`

### `import { … } from '@automata/feel'`

- `AudioRow` (interface): An audio cue to play, named by its id.
- `Beat` (interface): A sim event with the tick that produced it.
- `Beats` (class): Events held until the drawn picture reaches them, each answered once even when a batch is delivered twice.
- `BeatsOptions` (interface): How late an event may still be answered, in ticks behind the picture.
- `CameraRow` (interface): A camera shake an entry causes.
- `createFeel(options)`: Starts the feel runtime.
- `DEFAULT_LIMITS` (const): The limits used when `feel.toml` sets none.
- `DEFAULT_SETTINGS` (const): The settings a new player starts with: flashing on, rumble on, full strength.
- `EntityRef` (type): A view the sim names, by its stable id.
- `Feel` (interface): The feel runtime.
- `feelContent` (const): The `feel` content kind: `content/feel.toml` is the game's feel table.
- `FeelContent` (interface): The whole `feel.toml`: the limits, the squash spring and the entries that answer sim events.
- `FeelEntry` (interface): How one sim event feels.
- `feelExtension` (const): The feel extension a game opts into.
- `FeelFrame` (interface): Everything to draw for one frame as plain data: the camera offset, the views held by a hit-stop, the flash and tint, the squashes, the words, and the rumbles and audio cues that fire on this frame once.
- `FeelOptions` (interface): What `createFeel` needs: the feel table, the player's settings, the reduced-motion preference, an optional seed and the presentation clock.
- `feelSchema` (const): The Zod schema of `feel.toml`.
- `FeelSettings` (interface): What the player can switch: no flashing, rumble on or off, and how strong the camera and pose effects are.
- `HapticRow` (interface): A rumble for a game pad (strong and weak motors, in milliseconds) and, optionally, a single buzz for a phone.
- `hash(...n)`: A steady pseudo-random number from 0 up to but not including 1, made from whole numbers with no stored state, so a replay shakes the same.
- `Limits` (interface): The hard limits on the effects: the most shake in pixels, the longest hit-stop in milliseconds, and the most flash frames and flash opacity.
- `limitWarnings(feel)`: Each value above a limit, named by entry; the runtime clamps it anyway.
- `matches` (const): `*` matches any run of characters.
- `PoseRow` (interface): A hit-stop: the view's pose is held for this many milliseconds, and `target: 'subject'` holds only the view the event is about.
- `Pulse` (interface): One rumble for the haptics port to play.
- `resolveLimits` (const): The limits a file sets over the defaults.
- `SpringTuning` (interface): How the squash spring moves: its speed in hertz, how much it wobbles and how it starts.
- `VisualRow` (interface): One of a flash (`flash`, `frames`, `alpha`), a tint (`tint`, `ms`, `alpha`) or a squash (`squash`).
- `WordPop` (interface): A word on screen: its locale key, the view it belongs to, its age in seconds and whether it holds still for reduced motion.
- `WordRow` (interface): A word that pops up, as a locale key, never as text.

## `@automata/framework`

### `import { … } from '@automata/framework'`

- `ActionBar` (const): One row of actions that collapses as its container narrows.
- `ActionKind` (type): The action bar's model.
- `actionsForKey(profile, code)`: Every action `code` (a `KeyboardEvent.code`) drives in `profile`; none when it is unbound.
- `actionsForPadButton(profile, index)`: Every action the standard-mapping pad button `index` drives in `profile`; none when it is unbound.
- `AnalogOptions` (interface): The `analog` option of `keys()`.
- `AnalogReading` (interface): The analog input at one fixed step, read once after `Input.poll()`.
- `AnalyticsProps` (type): The properties of one analytics event: flat names to strings, numbers or booleans.
- `AppLoop` (interface): The frame loop service: `run` steps a sim at its fixed tick rate from display frames, with the commands for each tick, and the renderer draws every frame.
- `Audio` (interface): The audio service: one-shot sounds and looping music on the audio buses, unlocked by the first gesture after `session.ready`; the game runs silent when no audio context can be built.
- `AUDIO_BUS_NAMES` (const): The core audio buses: `master` carries the other four, `voice` is announcers and dialogue.
- `AudioBuses` (interface): The audio-bus seam.
- `audioBusGainsSchema` (const): Validates saved bus gains; a bus left out is at full gain.
- `AudioChange` (interface): The host's audio state: focus (an ad or overlay may duck or mute the game), the master volume, and the gain.
- `AudioChangeSchema` (const): Checks an audio change.
- `AutosavePolicy` (interface): When the loaded slot writes itself: on each listed trigger, with `intervalSeconds` for the `interval` timer.
- `AutosaveTrigger` (type): What can make the loaded slot write itself.
- `BarAction` (interface): One action in an `ActionBar`: an id, a label and a kind (`primary`, `secondary` or `utility`), what it does when selected, and optionally a short label, an icon, a disabled state and a pressed state.
- `BootFailurePanel` (const): The state a boot failure draws: an ErrorPanel with the failure's copy and its ways forward.
- `Button` (const): The framework's button: an `.af-control` of one kind.
- `Camera2d` (interface): A presentation-only 2D camera over one container: it follows a target, shakes, and writes only that container's transform, never a sim value.
- `Camera2dOptions` (interface): How `createCamera2d` frames the world: the view's size, and optionally a follow, bounds and zoom.
- `CameraDragSurface` (const): The camera drag surface: the player turns the camera by dragging the scene, a finger anywhere outside the controls or the mouse with its secondary button.
- `CameraRect` (interface): A world-space rectangle, in logical px: `Camera2dOptions.bounds`.
- `CAPABILITIES` (const): What a game may ask its host for.
- `Capability` (type): One capability a game may ask for.
- `CapabilitySchema` (const): Checks a capability name.
- `ChangedElsewhereCopy` (interface): The words of the choice paused offers once another device has changed the slot being played.
- `Chip` (const): A short status label.
- `classifyFormFactor(width, height)`: The form factor of a layout viewport: a portrait one narrower than 600 px is `phone-portrait`, any other portrait one `tablet-portrait`; a landscape one shorter than 500 px is `phone-landscape`, otherwise `desktop`.
- `classifyHeightTier(height)`: The height tier of a layout height in CSS px: `compact` below 340, `short` up to 600, otherwise `undefined`.
- `Clock` (interface): Time as the runtime reads it: `now()` and timeouts.
- `Command` (interface): Input to the sim, the only way gameplay state changes from outside.
- `CommandDef` (interface): A command the sim accepts as input: an id and the Zod schema its payload must match.
- `CompiledContentData` (interface): The compiled JSON content read by the runtime.
- `ComponentDef` (interface): A component: a stable id and a flat record of typed fields.
- `contentHashOf(data)`: The content hash formula: hex64(xxhash64(utf8(canonicalJson(data)))).
- `CORE_SETTINGS` (const): The `settings` save, version 1: the player's bindings (`input`), graphics quality (`display`), audio (`audio`), vibration (`haptics`) and camera turn (`camera`).
- `CoreSettings` (interface): The settings every game carries: input bindings, display, audio and vibration.
- `createCamera2d(stage, options, seed?)`: A camera writing `stage`'s transform (usually `PixiStage.world`).
- `createGeometryOwner(options)`: Creates the geometry owner of a document, the only writer of its geometry: make one per document.
- `createPixiRenderer(options?)`: The core 2D renderer (ADR 0002) as a runtime `RendererFactory`: a letterboxed Pixi app on the render target, entity views from each step's render delta, interpolated each frame.
- `createPostFilterSlot(target)`: A post-filter slot writing its composed filters to `target`'s `filters`.
- `createT(messages)`: `t` over a messages module (`import * as m from './paraglide/messages.js'`).
- `defaultContent()`: The default flow `title → play ⇄ paused → title`, with `paused ⇄ settings`, and its hash.
- `defaultScreens(game)`: The title, play, paused and settings screens over the default content's flow (`title → play ⇄ paused → title`, `paused ⇄ settings`).
- `defineCommand(id, schema)`: Defines a command by id and payload schema.
- `defineComponent(id, fields, opts?)`: Defines a component from an id (lower-case words separated by dots or dashes) and its fields by name and type.
- `DefinedGame` (interface): The runtime's `GameDefinition`, plus what the screens and the golden replay read from the spec.
- `defineEvent(id, schema)`: Defines an event by id and payload schema, to emit from a system with `ctx.emit`.
- `defineGame(spec)`: Checks a spec and fills in every default over the runtime, the Pixi renderer, Ruken hosting and the default screens; `startGame` boots the result.
- `definePlugin(spec)`: Defines a plugin from a name, its dependencies and its definitions, given in the keyed lists or in one flat `defs` list sorted by kind.
- `defineResource(id, schema, init)`: Defines a resource by id, schema and starting value.
- `defineSave(def)`: Declares a save.
- `defineSystem(name, run)`, `defineSystem(name, phase, run)`, `defineSystem(spec)`, `defineSystem(nameOrSpec, phaseOrRun?, run?)`: A system: `defineSystem(name, run)` runs in `gameplay`, `defineSystem(name, phase, run)` in that phase, and the object form also takes `before`/`after`.
- `Dialog` (const): A question that needs an answer before the screen goes on.
- `DisplayMetricsPayload` (interface): The game's display: insets the game must keep clear, the area the host reserves for its own controls, and the UI scale hint (1.333 on a TV: enlarge text and targets, never CSS zoom).
- `DisplayMetricsPayloadSchema` (const): Checks display metrics.
- `Disposables` (interface): A list of "undo this" functions, run together once: what a screen, a run or a service holds open.
- `disposables()`: Makes an empty `Disposables`.
- `DrawContext` (interface): What `draw` receives each frame.
- `DrawEntity` (interface): One entity, read-only: its components' values are frozen copies.
- `DrawSim` (interface): The sim at this frame, read-only.
- `DrawTextOptions` (interface): Options for `DrawContext.text`: colour and font size.
- `EntitlementsPayload` (interface): What the player owns: whether ads show, permanent items and subscriptions, and whether this is a dev build.
- `EntitlementsPayloadSchema` (const): Checks entitlements.
- `EntityRef` (interface): A live entity, addressed by its StableId.
- `EntityView` (interface): What an entity view factory returns: the container drawn for one entity, updated with its current and previous component values and the interpolation alpha, and destroyed when the entity goes.
- `ERROR_CODES` (const): Why a host call failed.
- `ErrorAction` (interface): One way forward from a failure.
- `ErrorCode` (type): One error code.
- `ErrorCodeSchema` (const): Checks an error code.
- `ErrorPanel` (const): A failure, and what the player can do about it.
- `EventDef` (interface): An event a system emits: an id and the Zod schema its payload must match.
- `filterPrograms(name, fragmentGlsl, fragmentWgsl)`: Builds a filter's programs from its GLSL and WGSL fragment stages on the shared vertex stages, so WebGL2 stays at parity with WebGPU (AGENTS.md).
- `findRukenSdkMarkers(code)`: The markers found in `code` (built JavaScript), each named once; empty means no Ruken SDK code.
- `findTauriMarkers(code)`: The Tauri markers found in `code` (built JavaScript), each named once; empty means no Tauri IPC code.
- `Flow` (interface): The screen flow service: the current screen, `dispatch` to follow an event's transition from it, `openMenu` for the current screen's menu, and `settled()` once no transition is pending.
- `FormFactor` (type): The four form factors.
- `FrameInfo` (interface): One display frame: the interpolation alpha between the last two ticks, the frame's length in ms, and whether time is paused.
- `FullscreenRes` (interface): The answer to a fullscreen request: the new state, and how this device can go fullscreen at all.
- `FullscreenResSchema` (const): Checks a fullscreen answer.
- `GameCopy` (type): A game's words: the runtime's boot and failure copy, and the default screens' words.
- `GameDefinition` (interface): Everything a game provides to the runtime to boot.
- `GameRenderer` (interface): What the runtime asks of a renderer: apply each step's result, draw each frame, and reset for a new sim.
- `GameSaves` (interface): What a game saves, and how the default screens read it from the sim and put it back.
- `GameSpec` (interface): A game in one object: its id, size and sim, and optionally its title, input, views, sounds, scores, saves, content, screens, settings, extensions, draw layer and host and renderer options.
- `GameSpecError` (class): Every invalid field of a spec, by path: `size.width: …`.
- `Geometry` (interface): The geometry every screen lays out against: the layout size, form factor and height tier, the insets, the usable and visible regions, what covers the page's foot, and the host's scale hint.
- `GeometryState` (interface): The current geometry as rune state: reading `current` in a component or `$derived` tracks it.
- `HeightTier` (type): The height tiers.
- `HOST_EXIT_CAP_MS` (const): How long the game may hold the host's close, in milliseconds (Ruken's own grace is 1.5 s, so we answer first).
- `HostHandshakeFailed` (interface): The page is inside a frame, but the SDK got no usable welcome and fell back to its standalone session.
- `Hosting` (interface): Everything a game may ask of, or hear from, its host.
- `HostingLeaderboards` (interface): The host's leaderboards.
- `HostingOptions` (interface): What the game asks of its host.
- `HostingSaves` (interface): The player's saves.
- `HostingSeams` (interface): Test seams of a target's adapter.
- `HostRefusal` (interface): Why the host said no to a call: its contract code, whether a retry may succeed, and the call it refused.
- `HostResult` (type): What a host call answers: the value, or the host's refusal.
- `IconButton` (const): A button whose face is an icon.
- `Input` (interface): The input service: held actions from keys, pads, touch buttons and gestures under the game's profile and the player's overrides, menu edges, the active device and pads, and rebinding.
- `InputMap` (interface): Held keys, touch buttons and gamepad buttons, turned into one command per tick.
- `InputMode` (type): How the player is playing right now.
- `InputModePayload` (interface): The current input mode, and the gamepad when one is in use.
- `InputModePayloadSchema` (const): Checks an input mode change.
- `InputProfile` (interface): A named set of bindings, one per game action.
- `inputProfileSchema` (const): Validates an input profile, filling left-out binding fields with "unbound".
- `inputs(...maps)`: One input map from `maps`, each sending its own command every tick in map order.
- `InputSource` (interface): The input map attached to a window for one play session.
- `installGlobalErrorHandlers(win, onFatal, onRejection?)`: Installs once per window; a second call is a no-op.
- `KeyBindings` (type): By `KeyboardEvent.code`, so the keys sit in the same place on every keyboard layout.
- `keys(command, bindings, options?)`: An input map sending `command` once per tick with the payload of what is held: keys by `KeyboardEvent.code`, on-screen touch buttons, gamepad buttons, the stick and gestures, merged over the idle payload.
- `KeysOptions` (interface): Options for `keys`: touch buttons, gamepad buttons, gestures and the stick, the idle payload, required keys and the Controls section's labels.
- `LeaderboardEntry` (interface): One row of a board.
- `LeaderboardGetRes` (interface): The rows of a board.
- `LeaderboardGetResSchema` (const): Checks a board's rows.
- `LeaderboardPanel` (const): A board's rows, or why there are none: loading, entries (the player's row marked "you" in words, not only by colour), empty, unavailable and offline.
- `LeaderboardQuery` (interface): Which entries to read from a board.
- `LeaderboardQuerySchema` (const): Checks a board query.
- `LeaderboardSubmitMeta` (type): Extra facts sent with a score, passed to the host as they are.
- `LeaderboardSubmitMetaSchema` (const): Checks a score's extra facts.
- `LeaderboardSubmitRes` (interface): The host's answer to a submitted score.
- `LeaderboardSubmitResSchema` (const): Checks a submit answer.
- `lerp(a, b, t)`: Linear blend; `t = 1` returns `b` exactly, because `a + (b - a)` can round away from it.
- `lerpAngle(a, b, t)`: Blends two angles (radians) along the shorter arc, so a body turning from just under π to just over -π swings through π instead of spinning the long way round through 0.
- `LifecyclePayload` (interface): Whether the game is in front, and if not, why.
- `LifecyclePayloadSchema` (const): Checks a lifecycle change.
- `LifecycleReason` (type): Why the game is in the background.
- `LoaderOverlay` (const): The loader over a screen while its assets load.
- `Locale` (interface): The locale service: the game's locales, the one text is drawn in now, the player's choice and the text direction.
- `MAX_TURN_UNITS_PER_STEP` (const): The most one step's `camera-turn` may carry either way: 45°.
- `measureGeometry(input)`: Turns what the browser and the host report into one `Geometry`.
- `Modal` (const): A panel over the screen with a visible Close.
- `ModelInvalid` (class): A 3D model file could not be read: malformed, of an unknown type, not loaded, or a glTF with a skin, which is not supported yet.
- `OptionGroup` (const): A choice of one: a segmented row whose chosen option is filled and marked, never only underlined or only coloured.
- `OwnedRenderer` (interface): A renderer the runtime owns: `dispose` destroys it (the canvas, its listeners, its GPU resources).
- `PagedGrid` (const): A grid of items in pages that never scrolls.
- `PagerDots` (const): Where a paged view is: one row of dots, each a whole touch target, or "3 / 11" once the dots would not fit on one row.
- `PauseBehavior` (type): Whether the game pauses when it goes to the background; fixed for the game's whole life.
- `PauseBehaviorSchema` (const): Checks a pause behavior.
- `PixiRenderer` (interface): The runtime's `GameRenderer`, built on PixiJS, with its stage.
- `PixiRendererOptions` (interface): Options for `createPixiRenderer`; every field has a default.
- `PixiStage` (interface): The Pixi scene the renderer draws, as a game's `setup` sees it: the app, the letterbox's layers, the entity views, the post-filter slot and the quality tier.
- `PixiStageHooks` (interface): What a `setup` may return to hear every step, frame and reset.
- `PluginDef` (interface): A bundle of definitions the sim registers together: components, commands, events, resources and systems, the plugins it depends on, and optionally per-sim engine state and `config`.
- `Pose` (interface): Where an entity view draws: position in world pixels and rotation in radians (Pixi `rotation`).
- `postFilter(name, spec)`: Declares a screen-space filter over the whole picture: `renderer: { postFilters: [postFilter('vignette', { glsl, wgsl })] }`.
- `PostFilterDef` (interface): A declared filter, as `postFilter` returns it and `PixiRendererOptions.postFilters` takes it.
- `PostFilterSpec` (interface): What a screen-space filter is made of: the same effect written twice, for WebGL2 (`glsl`) and WebGPU (`wgsl`), so the two renderers stay at parity.
- `PresentationBus` (interface): The presentation bus: typed facts the runtime publishes for screens, audio and tests to hear.
- `QualityTier` (type): A graphics quality tier: `high`, `medium` or `low`.
- `rect(options)`: A filled rectangle that follows its component's `x`, `y` and `angle`, interpolated between ticks: `entityViews: { [Body.id]: rect({ w: 8, h: 8, color: 0xf9c22b }) }`.
- `RectViewOptions` (interface): A `rect` view's size, colour and anchor.
- `reducedMotion(win?)`: Whether the player has asked for less movement.
- `RenderDeltaConsumer` (class): Keeps one entity view per sim entity in the world from each step's render delta, and interpolates them between ticks.
- `RendererFactory` (type): Builds the game's renderer for a target.
- `RendererUnavailable` (class): Neither WebGL2 nor WebGPU could be initialized.
- `RenderTarget` (interface): Where a renderer draws: the host element, the layout geometry, the loaded assets and the presentation bus.
- `ResourceDef` (interface): A value the sim keeps once, not on any entity: an id, a Zod schema and the `init` that gives its starting value.
- `RoundOutcome` (type): How a round ended.
- `RoundOutcomeSchema` (const): Checks a round outcome.
- `RUKEN_SDK_MARKERS` (const): String literals only the Ruken SDK contains, which survive minification: the SDK's storage probe key (`env-browser.ts`) and its standalone refusal message (`standalone.ts`), at RukenApp d0fa2fe (as at b30d31b).
- `runGame(game, start?)`: Boots and runs the game: a failure draws the boot failure panel, and `shutdown` closes everything the runtime opened.
- `RuntimeFacts` (interface): Every fact the runtime publishes on the presentation bus, by name.
- `RuntimeHandle` (interface): Controls the running game: `shutdown` closes everything the runtime opened, last opened first.
- `RuntimeSeams` (interface): Test seams injected into the runtime boot program.
- `RuntimeServices` (interface): The runtime services a screen may use, as one plain object: boot builds them in order and hands them over.
- `Save` (interface): A game's save: its slots' states, load, write and remove, and the progress `touch` keeps for the autosave triggers to write.
- `SaveDef` (interface): A game's save: one record, or a fixed number of slots, each one Ruken key.
- `Saves` (interface): The booted game's save as a runtime service, as `Settings` is for settings: its key and the `Save`, both undefined for a game without saves.
- `SavesChangedPayload` (interface): Another device's write, or the host's conflict choice, reached this session.
- `SavesChangedPayloadSchema` (const): Checks a saves change.
- `SavesFlushRes` (interface): Where a flush left the saves: the host's outbox, its server, or the device's own storage (`'device'`, the `web`, `itch` and `tauri` targets).
- `SavesFlushResSchema` (const): Checks a flush answer.
- `SavesStatus` (type): Where the player's saves stand with the host.
- `SavesStatusSchema` (const): Checks a saves status.
- `ScreenContext` (interface): What a screen's `enter` is given: where to mount, where it came from, what to undo, and the runtime's services.
- `ScreenDef` (interface): One screen of the flow: its id, whether it pauses the sim, its kind and fonts, and `enter`, which mounts it.
- `ScreenFrame` (const): Every screen's frame: the visible region, a corner row, then a hero and a body.
- `ScreensCopy` (interface): Every word the default title, play, paused and settings screens show.
- `ScreensCopyInput` (type): A game's words for the default screens: a part of the record, or a function of the player's locale returning one.
- `ScreensCopyOverrides` (type): A part of `ScreensCopy` with every group optional, down to the words; a word or a function is replaced whole.
- `ScreensGame` (interface): What the default screens need from the game.
- `ScrollList` (const): A list that keeps its rows.
- `Settings` (interface): The booted game's settings as a runtime service: its key and store, both undefined for a game without settings.
- `SettingsDef` (interface): A game's settings: the key it is saved under, its version, schema, defaults and migration steps, and which fields stay on one device.
- `SettingsScreen` (const): The core Settings screen: a dialog over the dimmed game, the same frame as Paused, so going between them reads as one dialog changing its view.
- `SettingsScreenCopy` (interface): The Settings screen's own words: its title, Back, the tabs and the overflow count.
- `settingsStore(settings, def)`: The booted store for `def`.
- `SettingsTab` (interface): A tab of the Settings screen (Settings and Controls): its label and its sections, in order.
- `Sheet` (const): A Modal on the bottom edge at every form factor: the same scoping, Close and scroll region, where a thumb reaches the actions.
- `Sim` (interface): A running simulation, stepped with commands, that can snapshot, restore and hash its state.
- `SimContext` (interface): What a system's `run` receives each tick.
- `Slider` (const): A number in a range: a labelled native `<input type="range">`, so the browser gives the arrow keys and the focus navigator's `adjust` steps it.
- `Split` (const): Two panes side by side where both fit at `min` px, stacked otherwise.
- `sprite(source, options?)`: A sprite that follows its component's `x`, `y` and `angle`, interpolated between ticks.
- `SpriteFrames` (interface): The texture is a sheet of equal frames, read left to right, top to bottom.
- `SpriteViewOptions` (interface): A `sprite` view's anchor and either its sprite-sheet frames or one frame of a packed atlas.
- `startGame(game, start?)`: Boots a game: `defineGame`'s defaults over the runtime, the Pixi renderer, Ruken hosting and the default screens, then the runtime's boot on the game's root.
- `StartOptions` (interface): How a game starts.
- `StepResult` (interface): What one `step` produced: the new tick, the events emitted, the renderer's delta and the commands that were rejected.
- `STICKY_MARGIN_PX` (const): How far outside a button a thumb still counts for it, in CSS pixels.
- `SubscriptionEntitlement` (interface): One subscription the player holds.
- `suppressPageGestures(doc)`: Turns off the browser's document gestures over the game.
- `systemClock` (const): The real clock.
- `SystemDef` (interface): A system: a name, the phase it runs in, the systems it must run `before` or `after` within that phase, and its `run`, called once per tick.
- `TAURI_MARKERS` (const): String literals only Tauri's IPC code contains, which survive minification: the global the webview injects (`@tauri-apps/api/core`) and the process plugin's exit command (`@tauri-apps/plugin-process`).
- `Time` (interface): The time service: whether the sim is paused, and why; each reason pauses until it is resumed.
- `TimeoutHandle` (type): What a timeout is called back with: opaque, only ever handed back to `clearTimeout`.
- `Toast` (const): A passing message: "Pad connected", "Saved", "This controller is not supported".
- `Toggle` (const): An on/off setting: a native checkbox with the switch role, so the browser gives Space and the focus navigator's `adjust` flips it.
- `TouchButton` (interface): One on-screen touch button: every key bound to the same payload shares it.
- `TouchControls` (const): The on-screen touch buttons.
- `Translate` (type): The typed `t` verb: `t('hello', { name })`, checked against the game's compiled messages.
- `turnUnitsFromPixels(dxPx, degPerPixel, invert)`: `dxPx` dragged at `degPerPixel` as whole turn units: positive for a drag to the right (which way that turns the heading is the game's convention), negated when `invert`, clamped to ±`MAX_TURN_UNITS_PER_STEP`.
- `typedBus(bus)`: Cast a PresentationBus instance to a typed view with game-specific fact types.
- `ViewportWindow` (interface): The parts of `window` the owner reads; a fake from `@automata/framework/testing` stands in for it in tests.

### `import { … } from '@automata/framework/extension'`

- `defineExtension(def)`: Returns its argument.
- `ExtensionDef` (interface): One opt-in feature of a game.
- `ExtensionError` (class): A bad extension list.
- `GameConfig` (type): The parts of the game config an extension may read (content's `GameConfig`).
- `ResolvedExtensions` (interface): Everything the runtime and the build tools need from a game's extension list, in one fixed order.
- `resolveExtensions(defs)`: Checks the list and puts it in a fixed order.
- `RukenManifestContribution` (type): What an extension may add to ruken.toml: preload files.
- `UiComponent` (type): What an extension puts in a slot: a Svelte component that takes no props.
- `UiSlotName` (type): The name of a place an extension may add UI: one of `UI_SLOT_NAMES`.

### `import { … } from '@automata/framework/testing'`

- `BAR_ACTIONS` (const): The selector for the controls a player presses in a bar: the buttons, links, tabs and menu items inside a region a screen or an editor declares with `data-region` (`topbar`, `rail`, `panel`, `dock`, `tools`).
- `byTestId(id)`: The element a test id names; throws when the fixture has none, so a missing part fails loudly.
- `checkLayout(conditions, essentials)`: The checks every screen shares: the document never scrolls; every control is at least the conditions' target (primaries the primary target) at this scale, on screen unless in a declared scroll region, never under a reserved area or a touch button and never over the corner row; the corner row's controls and any `data-way-out` stay reachable (but under a modal dialog or an ErrorPanel that had to rise); no ActionBar wraps (level 3); no row (`[data-row]`) clips what it holds; no control is cut at the side of the scroll region it scrolls in (`findCutAtSide`: a region declared `data-scroll-region="both"` scrolls sideways too), no action in a bar is cut by it (`findCutByBar`) or covered (`findCovered`), and no control's words run past its edge; and each of `essentials` is reachable without scrolling.
- `Conditions` (interface): The conditions a layout test runs under: the geometry published for a size and variant, and the regions that cover the page (the keyboard, Ruken's strip), which nothing may sit under.
- `describeHostingContract(name, create, settled)`: Registers the `Hosting` contract's cases as a Vitest `describe` block named after `name`.
- `documentScrolls(doc)`: The document itself never scrolls; screens scroll inside declared regions.
- `errorPanelFloor(panel)`: The least height any of an ErrorPanel's layouts needs, measured here rather than read from the panel, so a panel that misjudges its room cannot excuse itself.
- `FakeAudioContext` (interface): A recording stand-in for an `AudioContext`: what was started, stopped and automated, with a clock tests move by hand.
- `fakeAudioContext(decode?)`: `decode` turns the bytes `decodeAudioData` receives into a buffer, or throws as the browser does for bytes that are not audio; by default the bytes are the alias's UTF-8 text.
- `fakeBuffer` (const): A decoded buffer that remembers the alias it came from, so `started` can name it.
- `FakeClock` (interface): A `Clock` whose time a test moves by hand: nothing fires until `advance`.
- `fakeClock()`: Makes a `FakeClock` at time 0 with no timeouts waiting.
- `fakeFetch(routes, options?)`: Creates an in-memory fetch implementation for deterministic loading tests.
- `FakeFetchOptions` (interface): Options for `fakeFetch`: the fetch that answers urls with no route.
- `FakeFetchResult` (interface): The fake fetch, and the urls it was asked for and saw aborted.
- `FakeGainNode` (interface): A gain node of `fakeAudioContext`, recording its value, its targets and its automation.
- `fakeGamepads(options?)`: `target` hears `gamepadconnected` and `gamepaddisconnected`, as `window` does in a browser.
- `FakeGamepads` (interface): Four gamepad slots a unit test plugs pads into and presses; `getGamepads` reads them as the browser's would.
- `FakeHostControl` (interface): What a test does to, and reads from, the fake host.
- `fakeHosting(options?)`: A fake host and the control handle that drives it.
- `FakeHostingOptions` (interface): How the fake host starts.
- `FakeResizeObserver` (interface): Controls the fake `ResizeObserver` `installFakeResizeObserver` put in place: report a width to every observer, then restore the original.
- `FakeRoute` (interface): How `fakeFetch` answers one url: a status, the body in chunks, a content length or type, a hang or a network error.
- `FakeTarget` (type): The four distribution targets a fake host can stand in for (ADR 0006).
- `FakeViewportWindow` (interface): A stand-in for the browser window the geometry owner reads: its size, `screen`, `navigator`, visual viewport and `resize` listeners, with methods to rotate, open the keyboard and count live listeners.
- `fakeViewportWindow(size)`: A fake window of the given size.
- `FakeVisualViewport` (interface): The visual viewport of `FakeViewportWindow`: its height (less the keyboard, if open), an offset, and listeners for `resize`.
- `findClipped(root, selector)`: Each element `selector` names is tall enough for what it holds (a crushed row clips its content).
- `findCovered(root, selector, excused?)`: Each visible control `selector` names is on top at its centre: what is drawn there is the control or inside it.
- `findCutAtSide(root)`: No control is cut at a side of a declared scroll region that clips it (see `clippedBy`).
- `findCutByBar(root, selector)`: Each visible control `selector` names is whole inside every ancestor that clips its overflow.
- `findIntrusions(root, rects)`: No visible control intersects a reserved area (Ruken's strip, a keyboard), in viewport px, by its whole box.
- `findOffscreenControls(root)`: Every visible control is on screen, unless a declared scroll region (`[data-scroll-region]`) clips it (see `clippedBy`): a fixed control, or one positioned outside the region, is judged where it is drawn, since scrolling the region would never bring it into view.
- `findOverlaps(a, b)`: Two elements' boxes do not overlap.
- `findSmallTargets(root, min, minPrimary)`: Every visible control is at least `min` square, and a primary (`data-kind="primary"`) at least `minPrimary` tall.
- `findUnreachable(elements)`: Each element is fully inside the viewport, and the whole of it is in view: a tap at its centre and at the middle of each edge lands on it or inside it, so nothing covers or clips any part.
- `hostDisplay(options?)`: Ruken's display metrics for a hosted game.
- `HostingFactory` (type): An adapter under test: a fresh `Hosting` per case, with `saves` granted.
- `installFakeResizeObserver()`: Replaces the global `ResizeObserver` with a fake that reports only the widths you give it, for components measured under jsdom, which has no layout.
- `LayoutRect` (interface): Layout assertions as plain DOM functions (`expectReachable`, `expectControlsFit`, `expectRowsWhole`, `expectApart`, `expectNoDocumentScroll`).
- `ManualFrames` (interface): A frame source a test drives: `advance` moves time on and runs the frame asked for, if any.
- `manualFrames(startMs?)`: A frame source that runs a frame only when a test advances it, starting at `startMs`.
- `MountedFixture` (interface): A mounted Svelte fixture: the element it was mounted into and a way to unmount it.
- `mountFixture(component, props, target?)`: Mounts a Svelte component with the given props and no renderer or host, and flushes effects so the first render is finished.
- `nullRenderer(log?, options?)`: A renderer that draws nothing and records each call in `log`, for runtime tests without a GPU.
- `NullRendererEntry` (type): One call `nullRenderer` recorded.
- `NullRendererOptions` (interface): Options for `nullRenderer`: `fail` makes it fail `RendererUnavailable`.
- `openRuntimeTest(options?)`: Boots the runtime for screen and integration tests, as `runGame` does but without the loader or failure panel: `openHostingTest` behind the scenes, page layers and geometry, the settings, the save, the services, and the flow started when there are screens.
- `pressedPart(control)`: What a player presses for `control`: a checkbox's or radio's label (the theme draws it as the control, and a press anywhere on it toggles the input), else the control itself.
- `publishConditions(root, size, variant, targets?)`: Measures and publishes the geometry for `size` under `variant`, as the owner would; `targets` are the control sizes the checks hold.
- `REFERENCE_SIZES` (const): The viewports a layout is checked at: phones in both orientations, tablets, desktops, both sides of every breakpoint and the tightest sizes, each with the classification it should get.
- `ReferenceFormFactor` (type): The geometry owner's `FormFactor`.
- `ReferenceHeightTier` (type): The geometry owner's `HeightTier`.
- `ReferenceSize` (interface): One viewport every primitive and screen is checked at: a name, its size, and the form factor and height tier it must classify as.
- `RuntimeTestOptions` (interface): What `openRuntimeTest` boots: the fake host, the screens, content, settings and save, and the frames, renderer, fetch and locale it uses.
- `RuntimeTestSession` (interface): A booted runtime over the fake Ruken host: every service a screen reads, the host's handle and the page layers.
- `Settle` (type): Lets the fake Ruken host answer over its in-memory ports (for example one macrotask).
- `settleLayout()`: Waits until a freshly mounted fixture has finished laying out: fonts loaded, then two frames, so ResizeObserver callbacks (ActionBar's collapse, ScrollList's measure) and the re-layout they cause have run.
- `Submission` (interface): One leaderboard submission the host received.
- `Targets` (interface): The smallest a control may be drawn, in CSS px before the display's scale: `hit` for any control, `primary` for one marked `data-primary`.
- `textSnippet(text, tag?, trusted?)`: A Svelte 5 snippet rendering `<tag>text</tag>`, so a test can pass `children`, `body` or an icon to a component without writing a wrapper component (Ruken `packages/ui/src/test-snippets.ts`).
- `TIGHT_SIZES` (const): Sideways phones shorter than 780x270, where an open keyboard leaves the least room (framework audit of #7, 2026-10-11).
- `TOUCH_TARGETS` (const): The touch rule, every game screen's default: a control is at least 44 px, a primary 48.
- `TrackedEvent` (interface): One analytics event the host received.
- `Variant` (interface): A condition layered over a reference size.
- `VARIANTS` (const): The conditions each size is also checked under: at rest, with the on-screen keyboard open, with Ruken's reserved strip on the right or the left, and at its TV scale.
- `visibleControls(root)`: Controls a player could see and reach: laid out, not hidden, not in an inert subtree.
- `withRuntimeTest(program, options?)`: Runs `program` on an open runtime and always closes it.

### `import { … } from '@automata/framework/tooling'`

- `isDefinedGame(value)`: Whether `value` came from `defineGame`.

## `@automata/net`

### `import { … } from '@automata/net'`

- `ClientMessage` (type): Everything a client may send the room: a command, a clock probe, ready or not, add or remove a bot, and leave.
- `clientMessageSchema` (const): The Zod schema of a client message.
- `ClientNetworkPort` (interface): The sim's link to the room on a client: it sends the player's commands and never hears remote ones or publishes a snapshot, because the room is the authority.
- `colyseusClient(url)`: The real SDK client for a server at `url` (net.toml's `url`).
- `COMMAND_TYPE_MAX_LENGTH` (const): The longest sim command type a client may name.
- `commandTypeSchema` (const): A sim command id, in the sim's own id form (lower-case words separated by dots or dashes).
- `ConnectionState` (type): Where the connection to the room is: offline, connecting, connected, reconnecting after a drop, or degraded (up, but slow or silent).
- `createNetRoom(options)`: Makes the player's side of a room.
- `createNetSession(options)`: Joins a room's port to a client sim: it predicts the player's own commands, follows the room's snapshots and measures the link.
- `CreateNetSessionOptions` (interface): What `createNetSession` needs: the room, the client sim, the game's clock, the largest lead in ticks and how to draw the other players.
- `createRoomStore(room)`: Mirrors a room's info and connection.
- `createWatchable(initial)`: Makes a value that tells its listeners when it changes.
- `DEFAULT_DEGRADED` (const): The usual thresholds: a second of round trip or a second of silence.
- `DegradedThresholds` (interface): How slow or silent the link may be before it counts as degraded: the round trip and the gap between snapshots, in milliseconds.
- `DESYNC_WINDOW_MS` (const): Two hash mismatches this close together end the session.
- `Distribution` (class): The last `capacity` values, summarised on demand.
- `DistributionSummary` (interface): What this client's netcode is doing, measured.
- `hex16Schema` (const): A sim hash on the wire: 16 lower-case hex characters, as `Sim.hash()` writes it.
- `INITIAL_LEAD_TICKS` (const): A lead a typical home connection needs, until the first pong says otherwise.
- `InputLead` (class): How many ticks ahead of the room the client stamps its commands, worked out from recent round trips so a command arrives on time.
- `InputLeadOptions` (interface): The sim's tick rate and the largest lead, in ticks.
- `IntentOptions` (interface): What an intent that opens a room takes besides the player's name.
- `JoinOptions` (interface): What a client presents when it joins; `name` is trimmed by the schema.
- `joinOptionsSchema` (const): The Zod schema of what a client sends to join: the protocol version, the two hashes, a name and an optional session token.
- `leadForRoundTrip(roundTripMs, options?)`: The lead a known round trip needs, before any slack has been measured.
- `LOBBY_PHASES` (const): Where a room is: `RoomInfo.phase`.
- `LobbyPhase` (type): Where a room is: in the lobby, counting down, playing or ended.
- `LocalCommand` (interface): One command a game samples: a sim command without the header the session stamps.
- `MAX_CATCH_UP_TICKS` (const): The most ticks one frame may sample.
- `MAX_LEAD_TICKS` (const): The cap at net's default `maxLeadTicks` (60, one second at 60 Hz): half of it.
- `MAX_MESSAGE_BYTES` (const): The size cap: a message past it is dropped before it is parsed.
- `MAX_PENDING_COMMANDS` (const): A backstop on unacked commands, past which a sample is dropped, neither applied nor sent.
- `MAX_SEATS` (const): Seats are 0 to MAX_SEATS - 1.
- `nameSchema` (const): The only player-authored string on the wire: letters, digits, spaces, hyphens and underscores, so no later consumer (nameplate, roster, results row) needs an escaping rule of its own.
- `NET_BYTES_CHANNEL` (const): The channel the binary that follows a `snap` or `replay` header travels on: snapshot or packed replay bytes.
- `NET_CHANNEL` (const): The channel every wire message travels on as JSON text, both ways: a `ClientMessage` from a client and a `ServerMessage` from the room.
- `NET_ERROR_CODES` (const): The codes a room answers a refused request with.
- `NetConfig` (interface): `content/net.toml` after parsing: every field present.
- `NetConfigInput` (interface): `content/net.toml` as written: everything but `url` may be left to its default.
- `netConfigSchema` (const): `content/net.toml`.
- `NetDiagnostics` (class): Measures the link as it is used and says when it is degraded.
- `NetDiagnosticsOptions` (interface): What the diagnostics need: a millisecond clock, optional thresholds and a function to call when the link becomes degraded or recovers.
- `NetError` (class): A `NetRoom` call that failed: net's code, and which call it was (`create`, `join`, `setReady`, ...).
- `NetErrorCode` (type): Why a room refused a request: refused, the game versions differ, no such room, the room is full, the server is busy or updating, too many requests, not verified, or offline.
- `NetFrame` (interface): One frame's answer: where authority is and the tick the predicted sim has stepped.
- `NetRoom` (interface): The player's side of an online room.
- `NetRoomOptions` (interface): What `createNetRoom` needs: the server url, the client sim's hashes for the join check, the reconnect grace, the game's clock and optionally the session token, the SDK client and where the seat token is stored.
- `NetSdkClient` (interface): The part of the Colyseus SDK's client that `net` uses: create, join by code, join or create, and reconnect with a token.
- `NetSdkRoom` (interface): The part of the Colyseus SDK's room that `net` uses.
- `NetSession` (class): The client's game loop in an online room.
- `NetSessionHandle` (interface): A running session: the session to call once per frame, its measured diagnostics, why it ended and a way to close it.
- `NetSessionOptions` (interface): What a session needs: the client sim it steps and restores, how to send a command and a probe, the first round trip, the largest lead, how to draw the others and the diagnostics.
- `NetSnapshot` (interface): One authoritative snapshot as it arrived: core's `AuthoritativeSnapshot` (`tick`, `bytes`, `hash`), plus the per-seat acks that ride beside it on net's wire (the last `seq` the room applied for each seat).
- `NetSummary` (interface): What the diagnostics measured: snapshots, their spacing and reordering, round trips, corrections and whether the link is degraded.
- `parseClientMessage` (const): Reads a raw message from a client.
- `ParseResult` (type): The result of reading a raw message: the message, or why it was refused (too large, not JSON, or not a valid message).
- `parseServerMessage` (const): Reads a raw message from the room, the same way.
- `PING_EVERY_MS` (const): How often the clock is probed.
- `PLAYER_NAME_MAX_LENGTH` (const): The longest a player's name may be.
- `Pong` (interface): The answer to a clock probe: its id, how many ticks early (positive) or late (negative) the probe arrived, and the round trip in milliseconds.
- `PROTOCOL_VERSION` (const): Bumped when a message shape changes; a room refuses a join on another version.
- `RECONNECT_BASE_MS` (const): The first wait after a drop.
- `RECONNECT_CEILING_MS` (const): The longest wait between two attempts.
- `reconnectDelay(attempt, random)`: The wait before reconnect attempt `attempt` (from 0): 250 ms doubling to a 2 s ceiling.
- `refusalCode(error)`: Turns whatever a failed join or create threw into one of the error codes, so a screen can say what went wrong.
- `RemoteSource` (interface): How the game draws the others: which entities are remote, read from each authoritative state, and how to blend.
- `reqIdSchema` (const): A client-chosen correlation id: printable ASCII, bounded.
- `REQUEST_ID_MAX_LENGTH` (const): The longest a request id may be.
- `ResumeOutcome` (type): What happened when a page tried to take its old seat back after a reload: it resumed, there was nothing to resume, or the seat had expired.
- `ROOM_CODE_ALPHABET` (const): Characters a player can read off a screen and type without ambiguity: `I`, `O`, `0` and `1` are omitted.
- `ROOM_CODE_LENGTH` (const): Six characters.
- `ROOM_NAME` (const): The Colyseus room type a client creates, joins and finds (`create`, `joinById`, `joinOrCreate`).
- `RoomEnd` (interface): Why the room went without the player choosing to leave.
- `RoomInfo` (interface): A room as a screen shows it: the six-character code, the phase, the seats, your own seat and the host's seat.
- `RoomStore` (interface): The room and the connection as plain values with one subscription, for a screen to read.
- `Sampler` (type): The game's input for one predicted tick: the commands to apply and send on it, often none.
- `SEAT_TOKEN_KEY` (const): The `sessionStorage` key's prefix; the server's url follows it (`seatTokenKey`).
- `SeatInfo` (interface): One seat in a room: its number, the name, whether the player is ready and connected, and whether it is a bot.
- `seatSchema` (const): A seat index, 0 to MAX_SEATS - 1.
- `SeatStorage` (interface): The slice of the Web Storage API the store uses.
- `seatTokenKey` (const): The key a server's seat is stored under.
- `ServerMessage` (type): Everything the room may send a client: a snapshot header, the seat you were given, a probe's answer, the answer to a request (with an error code if it was refused) and a replay header.
- `serverMessageSchema` (const): The Zod schema of a server message.
- `SESSION_MAX_LENGTH` (const): A reconnection session token, opaque to the client.
- `SessionEnd` (interface): Why the session stopped: a second snapshot hash mismatch within `DESYNC_WINDOW_MS`, at this snapshot tick.
- `SessionRoomState` (interface): What the room says about this player: their seat, and whether it takes input now.
- `uintSchema` (const): A whole number from 0.
- `Watchable` (interface): What a reader gets: the value now, and a way to hear it change.
- `WatchableSource` (interface): The owner's end of a `Watchable`: it can also set the value.

### `import { … } from '@automata/net/sim'`

- `NetOwner` (const): The seat an entity belongs to.
- `netPlugin` (const): `net`'s sim side: the same plugin runs in the room and in every client.
- `ROOM_SOURCE` (const): The sim `source` of the room's own commands (seat.join, seat.leave and a game's room commands): the highest source the sim accepts, never a seat.
- `SeatEntity` (interface): The seat and the id of its seat entity.
- `SeatJoin` (const): Sent by the room when a seat is taken (a player or a bot).
- `SeatJoined` (const): A player took a seat: its number and the id of the sim entity it owns.
- `SeatLeave` (const): Sent by the room when a seat is given up (a leave, or a drop past the reconnect grace).
- `SeatLeft` (const): A player left a seat: its number and the id of the sim entity it owned.
- `SeatPayload` (interface): Which seat.

### `import { … } from '@automata/net/testing'`

- `createLink(options, clock)`: A deterministic in-memory link: every delay, loss, duplicate and reorder is drawn from `seed`, one stream per direction, and delivery waits on `clock`, so under a fake clock a failure replays exactly.
- `fakeColyseus()`: Makes a fake SDK client for tests, so `createNetRoom` runs without a network.
- `FakeColyseus` (interface): A stand-in for the SDK client.
- `FakeOutcome` (type): What a fake matchmaking call answers: a room, an error, or a promise of a room.
- `FakeRoom` (interface): A stand-in for the SDK's room.
- `FakeSocket` (interface): A socket stand-in the client may count bytes from, as it does the SDK's WebSocket.
- `linkClient(transport, options)`: Makes the client's end of a test link over a transport.
- `LinkClient` (interface): The client's end of a test link: its port, its seat, and ways to attach to another link (a reconnect) or drop the link.
- `LinkOptions` (interface): How bad a test link is: a seed, the base delay, the jitter, and the chances a message is lost, arrives twice or is held back so later ones overtake it.
- `linkRoomClient(transport)`: The room's end of a link, in the shape of `server`'s `RoomClient`.
- `LinkRoomClient` (interface): The room's end of a test link, shaped like the server's room client: send a message or bytes, close, and whether it is closed.
- `Transport` (interface): One end of a link: what `net`'s transport and the test server talk through.
- `WireData` (type): One message as it travels: text (JSON) or binary (a snapshot, a packed replay).

## `@automata/net-server`

### `import { … } from '@automata/net-server'`

- `acceptsInput(lobby)`: Whether the room takes commands for the sim: from the countdown on, so a player holding a direction through GO moves on the first tick of play exactly as they would locally; never in the lobby, and never once the game ended.
- `addBot(lobby, by, rules, botsAllowed)`: The host's tap on an open seat, in the lobby only.
- `ANOMALY_COOLDOWN_MS` (const): One line per anomaly kind per room (and per seat for late inputs), at most this often.
- `anonymousVerifier` (const): Accepts every join and names nobody: the only verifier production has until a host gives its own.
- `answerProbe(request, response, state)`: Answers one of the server's own routes and returns true, or returns false for every other path.
- `AutomataRoom` (class): The Colyseus room behind every game.
- `botCount` (const): How many of the lobby's seats are bots.
- `BotPolicy` (interface): The bot-seat hook (PD-5): no AI ships.
- `botSeed` (const): The seed of a bot seat's RNG (`deriveSeed(roomSeed, seat)`; the sim's `deriveSeed` names its stream with a string).
- `Bucket` (interface): A token bucket: up to `burst` at once, refilled at `perSecond`.
- `bucketOptions(bucket)`: A config bucket as `TokenBuckets` reads it.
- `claimRoomCode(store, randomInt)`: Claims a free code.
- `clientIp(request)`: The address a request's limits are counted against.
- `CODE_ATTEMPTS` (const): Bounded so a failing random source cannot spin forever.
- `colyseusLogger(log)`: Colyseus logs to the console by default, and its text can hold a room id (the room code) or what a client sent.
- `ColyseusLogger` (interface): The logger Colyseus is given (`new Server({ logger })`).
- `COMMAND_HISTORY` (const): Answers remembered per session.
- `CommandIntent` (interface): A command without its header: the room stamps `tick`, `source` and `seq`.
- `CommandLedger` (class): Remembers the answer given to each request, per session, so a resent request gets the same answer and never acts twice.
- `CommandResult` (type): The answer to one request.
- `countdownElapsed(lobby)`: Whether a running countdown has reached zero on this tick.
- `CrashTarget` (interface): Where crashes are heard: `process` in production, an emitter in a test.
- `createAnomalyLimiter(now, cooldownMs?)`: Whether an event may be written now.
- `createLobby()`: A new, empty lobby, before anyone has sat down.
- `createLogWriter(options)`: The server's `log`: each event becomes one validated JSON line.
- `createMatchmakeGate(options)`: Builds the gate every matchmaking request passes before Colyseus sees it: origin, draining, per-address limits, body size and game version.
- `createServerRuntime(def, config)`: Builds a server inside the caller's scope: checks the config, binds the listener, installs the gates and probes, and defines the room.
- `createSocketGate(limits)`: Builds the count of open sockets, per address and in all.
- `createUpgradeGate(options)`: Builds the gate every WebSocket upgrade passes: the origin must be listed and the address must have a socket to spare.
- `defineServer(def)`: Checks a game's server once, so a room never meets a bad one.
- `DRAIN_MAX_MS` (const): The longest a drain waits for rooms to close: five minutes.
- `DrainableRoom` (interface): The slice of a room the drain needs; kept narrow so this file imports no room.
- `DrainResult` (type): `empty` when the last room closed; `cap` when the wait ran out first.
- `endGame(lobby)`: The game says it is over.
- `EnvConfigResult` (type): The server's config read from its environment, or the name of every variable that was missing or not valid.
- `EnvServerBase` (interface): What a game gives its server beside the environment's limits.
- `evaluateReadiness(lobby, rules)`: Under `all-ready`, starts the countdown once every connected player is ready and the game's minimum of seats is taken.
- `FreedSeat` (interface): A seat freed by `keepOnly`, so the room can forget what else it held.
- `GameVersion` (interface): What two builds must share to play in one room: the net protocol, the sim's schema hash and the content hash.
- `gameVersionOf(def)`: The game's version, read from a sim of it (seed 0: neither hash depends on the seed), then disposed.
- `GateOptions` (interface): The gates `installGates` puts in front of Colyseus: the origin list, the matchmaking gate and the upgrade gate.
- `generateRoomCode(randomInt)`: A room code drawn from net's alphabet with the given random source.
- `InputMeter` (class): Each seat's command budget, a token bucket counted in room ticks.
- `InputMeterOptions` (interface): Each seat's command budget: a token bucket on the room clock.
- `InputQueue` (class): Holds the commands each seat has sent until the tick they are due.
- `InputQueueOptions` (interface): How far ahead a command may be stamped, and how far its sequence may jump past the last accepted one.
- `installCrashHandlers(target, log, exit)`: Makes an error nothing caught write one fatal log line, naming the error's class only, and end the process with code 1 so the supervisor restarts it.
- `installGates(http, options)`: Puts Colyseus's listeners behind the gates; the returned function puts them back.
- `installProbes(http, state)`: Puts the probes in front of the listener's own request handlers.
- `isPreGame(lobby)`: Before the game: the lobby, and only the lobby.
- `isTestVerifier(verifier)`: Whether a verifier is a test switch, which a production server refuses (`process-safety.ts`).
- `LedgerAnswer` (interface): The answer to one request, and whether it came from history.
- `levelOf(event)`: A crash or a refusal to start is fatal; a refusal, a slow or late tick and a room's error warn; the rest inform.
- `LiveRooms` (class): Every room a server process holds.
- `LobbyRules` (interface): A game's lobby.
- `LobbySeat` (interface): One taken seat.
- `LobbyState` (interface): The room's lobby: its phase, the host, who is seated and ready, and the countdown's end.
- `LogLevel` (type): How serious a log line is: information, a warning, or a fatal error.
- `LogWriterOptions` (interface): Where a finished log line is written and the clock that stamps it.
- `MatchmakeGate` (type): Answers the request when it is refused, and says whether it did.
- `MatchmakeGateOptions` (interface): What the matchmaking gate checks a request against: the origin list, whether the server is draining, the per-address limits, the body cap, the game's version and the clock.
- `MAX_QUEUED_COMMANDS` (const): Commands one seat may have waiting.
- `nextHost(lobby)`: Who hosts next, from the seated players in seating order: the longest-seated player who is still connected, because a host who has dropped would block everyone who is there; when nobody is connected, the longest-seated player, so a room always has a host to hand on.
- `openSeat(lobby, rules)`: The lowest seat number nobody holds, or undefined when the room is full.
- `originPolicy(list)`: Builds the origin list from exact origins.
- `OriginPolicy` (interface): Which pages may use this server.
- `originsFromGameOrigin(origin)`: The seam for Ruken's `gameOrigin(publicId, env, channel)` (`@ruken/manifest`).
- `PROBE_HEADERS` (const): The probes' answers are never cached and never sniffed.
- `ProbeState` (interface): What the server's own routes report: whether it is ready, and the contact for `security.txt` if it has one.
- `QueuedInput` (type): What a client sends for the sim: a command without `source`, which the seat supplies.
- `RandomInt` (type): An integer in `[0, max)`.
- `RATE_BUCKET_MAX_KEYS` (const): The most addresses a bucket remembers.
- `readCappedBody(request, limit)`: Reads a request body up to a size cap.
- `Readiness` (type): `starting` until the content has loaded, `ready` while rooms may open, `full` at the room cap (every new room is refused `SERVER_BUSY`), `draining` once SIGTERM came.
- `ReadonlyEntity` (interface): An entity as a view reads it: its id and its components' values, never a setter.
- `REFUSAL_WORDS` (const): What a player is told, by code.
- `refuseTooLarge(request, response, headers?)`: Answers 413 and closes the connection once the answer is out, so a body that never ends cannot hold the server.
- `releaseRoomCode(store, code)`: Gives a room code back to the shared set when its room closes.
- `removeBot(lobby, by, seat)`: The host's tap on a bot's seat: frees it.
- `removeSeat(lobby, seat, rules)`: Frees a seat for good: a leave, or a drop past the grace.
- `requestIdOf(message)`: The request id (`req`) a raw message carries, if any.
- `ROOM_CODE_CHANNEL` (const): The shared set holding every live room code.
- `ROOM_SOURCE` (const): The sim `source` of the room's own commands (seat.join, seat.leave and a game's room commands): the highest source the sim accepts, never a seat.
- `RoomCodeStore` (interface): The set operations a code claim needs: Colyseus Presence's `sismember`, `sadd` and `srem`.
- `RoomCommandError` (class): A refusal the client is expected to show the player, as opposed to a crash.
- `RoomLogEvent` (interface): One event worth a log line.
- `runServerProcess(def, options)`: Runs a game's server as a production process and never returns.
- `SeatClient` (interface): The one thing the registry does with a client: tell it where it sits.
- `seatPlayer(lobby, rules)`: Seats a joining player in the lowest open seat; the first player to sit down hosts.
- `SeatRegistry` (class): Which session sits in which seat, which clients have yet to be told their seat and which dropped seats are being held for a return.
- `SecurityTxt` (interface): RFC 9116's two required fields: a `mailto:` or `https:` contact, and an ISO 8601 expiry.
- `securityTxtBody(security)`: The text of `/.well-known/security.txt` for a contact and an expiry.
- `ServerConfig` (interface): Everything a server process is given: its port, limits, net settings, log, verifier and the test switches a production server refuses.
- `serverConfigFromEnv(env, base)`: The server's config from its environment, or the name of each variable that is missing or not valid.
- `ServerDef` (interface): A game's server after `defineServer` has checked it: the game, its seat range, its lobby and a way to find the commands a client may send.
- `ServerError` (interface): What a player is told about a failure: a code from net's list and a sentence.
- `ServerGameDef` (interface): What a game gives its server: the sim's plugins and content, how many seats, and optionally the lobby rules, how a new seat gets its avatar, how a bot plays and when the game is over.
- `ServerLimits` (interface): Every limit the server enforces: rooms, allowed origins, message size, sockets and matchmaking per address, and each seat's command budget.
- `serverLogLine` (const): The strict schema every log line is parsed with before it is written.
- `ServerLogLine` (interface): One line of the server's log.
- `ServerProcessOptions` (interface): What `runServerProcess` takes beyond the game's own limits.
- `ServerRuntime` (interface): A running server: its port and address, its rooms, whether it is draining, what `/ready` says, and the `drain` that ends it gracefully.
- `ServerStartError` (class): The server could not start: a config no server can run with, or a listener that could not bind.
- `SessionRejected` (class): The verifier refused the token; the room refuses the join `UNVERIFIED`.
- `SessionRejectReason` (type): Why a token was refused: none was given, it was never issued, or it has expired.
- `SessionVerifier` (interface): The port that says who a joining player is.
- `setConnected(lobby, seat, connected, rules)`: A player's drop (false) or return (true).
- `setReady(lobby, seat, ready, rules)`: A player's Ready toggle, in the lobby only.
- `SignalSource` (interface): Where SIGTERM comes from: the process in production, an emitter in a test.
- `SimView` (interface): A read-only look at the room's sim, for a bot: the tick, the hash, entities and resources, and nothing that changes them.
- `simViewOf(sim)`: Wraps a sim as a read-only `SimView`.
- `slowStepMs(tickHz)`: A step that took more than half its tick: two back to back would miss a tick.
- `SOCKET_HEADROOM` (const): Sockets beyond one per seat that the server holds for joins in flight.
- `SocketGate` (interface): Open WebSockets, per address and overall.
- `socketTotal(maxRooms, seatsPerRoom)`: The most sockets the server holds at once: one per seat of `maxRooms` rooms, plus the headroom.
- `startCountdown(lobby, by, rules)`: The host's Start, under `host`.
- `startGame(lobby)`: Play begins on this tick; every seat keeps its connection and readiness.
- `startOver(lobby)`: Play again: a fresh lobby after an ended game, keeping every seat, the host and the room's clock (`tick` is kept, so a dropped seat's grace deadline stays meaningful).
- `startServer(def, config)`: Starts the server and keeps it: listens, then drains on the first SIGTERM and exits (0 drained, 1 failed).
- `startTickScheduler(options)`: Starts ticking at fixed deadlines, one tick length apart, so ticks do not bunch up.
- `SubmitResult` (type): `tick` is when the command will take effect.
- `testSwitchesSet(config, ...envs)`: Each test switch set, or a production limit missing, when any of `envs` says production; empty otherwise.
- `TickClock` (interface): The time source and timer the scheduler runs on.
- `tickClockFrom(clock)`: The room's tick clock on Effect's `Clock`: time is the clock's (TestClock in a test), and the wake-up is a Node timer, which the clock does not own.
- `TickScheduler` (interface): A running metronome.
- `TickSchedulerOptions` (interface): How often to tick and what runs: the tick length, the clock, the tick itself and optional hooks for a slow wake-up, an error and the most ticks to catch up.
- `TokenBucketOptions` (interface): How a set of buckets behaves: the burst a quiet key may take, how long one token takes to come back, how many keys to remember and the clock.
- `TokenBuckets` (class): A token bucket for each key, usually an address, held in memory and capped at a number of keys.
- `toLogLine(event, ts)`: The line an event becomes, with only the schema's fields copied.
- `toServerError(error)`: Translates any thrown failure into something a client can render.
- `UpgradeGate` (type): Admits an upgrade, or answers it and says it did not.
- `UpgradeGateOptions` (interface): What the upgrade gate checks a socket against: the origin list and the socket counts, and where refusals are reported.
- `VerifiedSession` (interface): Who a token belongs to.
- `versionVerdict(options, version)`: `same`, `mismatch`, or `unread` for options this gate cannot read, which are the room's to refuse (its strict schema answers `REFUSED`).

### `import { … } from '@automata/net-server/testing'`

- `CLOCK_NAMES` (const): The clocks a test may ask a room to hold.
- `ClockName` (type): A clock a room can be asked to hold.
- `createFakeVerifier()`: Verifies only the tokens it issued: any other is `forged`, an empty one `missing`, and one at or past its expiry `expired`.
- `createRoomDriver(room)`: Builds a driver for a room.
- `DrivableRoom` (interface): What the driver needs of a room: its engine, its clock and one tick (`AutomataRoom` has all three).
- `FakeVerifier` (interface): A verifier for tests: it hands out tokens and accepts only those.
- `HELD_GRACE_SECONDS` (const): How long Colyseus keeps a seat that dropped while the room was held, in wall seconds.
- `holdAllowed(env)`: Whether a hold may be taken in this environment: never in production.
- `isClockName(value)`: Whether a value names a clock a room can hold.
- `MAX_DRIVEN_TICKS` (const): The most ticks one `step` call drives: five minutes at 60 Hz.
- `RoomDriver` (interface): Drives a room in a test: stop its clock, step it tick by tick, submit a seat's command, read its state and hold its clocks.
- `RoomReading` (interface): The room as it decided, read from the room itself and never from a client's copy.

## `@automata/net-ui`

### `import { … } from '@automata/net-ui'`

- `BadgeState` (type): What the connection badge shows: nothing, connecting, connected, reconnecting (with seconds left) or a poor connection.
- `CONNECTED_SHOWN_MS` (const): How long the badge says the connection is up before it hides again, in milliseconds.
- `copyOf` (const): The words for `host`: its own catalog, or the English one when it gave none.
- `createNetStatus(options)`: Starts a status machine.
- `currentNetUi` (const): The host that is installed now, or nothing when the game has not installed one.
- `installNetUi(host)`: Makes `host` the one the badge and overlay read.
- `NET_COPY_EN` (const): The English words for the badge, the overlay and every connection error.
- `NetBadge` (const): The small connection badge for the game's overlay layer.
- `NetCopyKey` (type): A key into the connection words, always starting with `net.`.
- `netCopyKeys` (const): Every key, sorted: what a locale file must supply.
- `netErrorKey` (const): The key for a `NetError` code's message.
- `NetHud` (const): What the net extension puts in the game's overlay layer: the connection badge and the reconnect overlay.
- `NetStatus` (interface): The connection badge and the reconnect overlay as one state machine, fed the connection state and the time.
- `NetStatusView` (interface): What to draw for one moment: the badge, the overlay and the seconds of grace left while reconnecting.
- `netText(key, params?, catalog?)`: The text for `key`, with `{name}` placeholders filled from `params`; one with no value is left as written, so a gap shows.
- `NetUiHost` (interface): What the badge and overlay need from the game: the connection, the grace, a way to leave and the words.
- `OverlayState` (type): What the reconnect overlay shows: nothing, a countdown while the game reconnects, or the words for giving up once the grace has passed.
- `ReconnectOverlay` (const): The banner shown while the game reconnects: it counts down the grace, then says it could not reconnect.
- `watchStatus(host, onView)`: Calls `onView` with what to draw now, and again whenever the connection changes or time passes.

## `@automata/physics`

### `import { … } from '@automata/physics/2d'`

- `body2d(kind, opts?)`: The spawn part that gives an entity a rigid body of a `BodyKind`.
- `BodyKind` (const): The codes a rigid body's `kind` field holds: `dynamic` (moved by gravity and contacts), `fixed` (never moves), `kinematicPosition` (moved by writing its transform) and `kinematicVelocity` (moved by its velocity).
- `Collider2D` (const): One collider.
- `collider2d` (const): The spawn parts that give an entity a collider: `ball(radius)`, `cuboid(hx, hy)` with half extents, and `capsule(halfHeight, radius)`.
- `ColliderOptions` (interface): Options every collider helper takes.
- `CollisionEnded2D` (const): Two colliders stopped touching, or one was removed.
- `CollisionStarted2D` (const): Two colliders began touching (or, with a sensor, overlapping).
- `physics2d(options?)`: The 2D physics plugin.
- `Physics2DOptions` (interface): The options of `physics2d`.
- `RigidBody2D` (const): A Rapier rigid body: its kind (`BodyKind`), damping, and linear (m/s) and angular (rad/s) velocity.
- `ShapeKind` (const): The codes a collider's `shape` field holds: `ball`, `cuboid` and `capsule`.
- `transform2d(at?)`: The spawn part that places an entity: `x` and `y` in metres and `rotation` in radians, each 0 unless given.
- `Transform2D` (const): Position in metres and rotation in radians.

### `import { … } from '@automata/physics/3d'`

- `body3d(kind, opts?)`: The spawn part that gives an entity a rigid body of a `BodyKind`.
- `BodyKind` (const): The codes a rigid body's `kind` field holds: `dynamic` (moved by gravity and contacts), `fixed` (never moves), `kinematicPosition` (moved by writing its transform) and `kinematicVelocity` (moved by its velocity).
- `Collider3D` (const): One collider.
- `collider3d` (const): The spawn parts that give an entity a collider: `ball(radius)`, `cuboid(hx, hy, hz)` with half extents, and `capsule(halfHeight, radius)`.
- `ColliderOptions` (interface): Options every collider helper takes.
- `CollisionEnded3D` (const): Two colliders stopped touching, or one was removed.
- `CollisionStarted3D` (const): Two colliders began touching (or, with a sensor, overlapping).
- `physics3d(options?)`: The 3D physics plugin.
- `Physics3DOptions` (interface): The options of `physics3d`.
- `RigidBody3D` (const): A Rapier rigid body: its kind (`BodyKind`), damping, and linear (m/s) and angular (rad/s) velocity.
- `ShapeKind` (const): The codes a collider's `shape` field holds: `ball`, `cuboid` and `capsule`.
- `transform3d(at?)`: The spawn part that places an entity: `x`, `y` and `z` in metres and a rotation quaternion (`qx`, `qy`, `qz`, `qw`).
- `Transform3D` (const): Position in metres and rotation as a unit quaternion.

## `@automata/puzzle`

### `import { … } from '@automata/puzzle'`

- `Action` (interface): One thing the player can do at a hotspot: where it is aimed (`at`), the item or pair of items it uses, the conditions that must hold, its effects, the line said and how many seconds it takes.
- `Cond` (type): A condition on the puzzle's state.
- `condSchema` (const): The Zod schema of a condition.
- `createPuzzlePlugin(options?)`: Makes the puzzle plugin with the game's options: its functions for `call` effects, where facts live, and what hears noises, dialogues and cutscenes.
- `Effect` (type): What an action does when it is taken: set or add to a fact, give or take an item, make a noise, start a cutscene or a dialogue, mark a checkpoint, open the keypad, leave through an exit, or call a function the game supplied.
- `effectSchema` (const): The Zod schema of an effect.
- `Entry` (interface): A way into the scene: its name, the items the player arrives with and any facts it sets.
- `fallbackLine(def, verb)`: The fallback line for a verb that matched nothing: per hotspot, then per verb kind, then `*` (codes have no `*`).
- `holds(reader, verb, c)`: Whether a condition holds for this reader and verb.
- `Lethal` (interface): A way to fail, with its rule and the hints that warn the player.
- `loadPuzzle(ctx, def, entryName?)`: Loads a scene's puzzle into the sim and starts the play state, at the named entry or the first one.
- `match` (const): The first action, in content order, aimed where the verb is, using what it holds, whose conditions all hold.
- `Point` (interface): A spot on the floor.
- `PuzzleCall` (interface): What a `{ call }` effect hands the game's function: the action and what the verb held or pointed at.
- `PuzzleCheckOptions` (interface): What the content checks need to know about the game: the `call` names it declares and the extensions it registers.
- `PuzzleCheckpoint` (const): An action marks a checkpoint.
- `puzzleContent` (const): The `puzzle` content kind: `content/puzzles/*.toml`, one puzzle per scene.
- `PuzzleCutscene` (const): An action asks for a cutscene, by id.
- `PuzzleDebugSummary` (interface): What the debug summary shows: whether the goal is reached, the items carried, how many actions were seen and the facts.
- `puzzleDebugSummary(state)`: Turns the puzzle's play state into a summary for the debug overlay.
- `PuzzleDef` (interface): One scene's puzzle: its facts and items, where its hotspots are, the ways in, the actions, the systemic solutions and lethal rules, the goal and the fallback lines for verbs that match nothing.
- `puzzleDefShape` (const): The Zod schema of a puzzle's shape, without the cross-checks that `puzzleSchema` adds.
- `PuzzleDialogue` (const): An action asks for a dialogue, by id.
- `PuzzleExit` (const): An action leaves the scene for another, with the cutscene to play on the way.
- `puzzleExtension` (const): The puzzle extension a game opts into.
- `PuzzleExtensionOptions` (interface): The puzzle's options plus the names of the extensions the game registers, so an effect that needs a missing one fails when content compiles.
- `PuzzleGave` (const): The player was given an item.
- `PuzzleGoal` (const): The puzzle's goal now holds.
- `PuzzleKeypad` (const): An action opens the keypad.
- `PuzzleNoise` (const): An action made a noise at a place, with its loudness and kind.
- `PuzzleOptions` (interface): How a game wires the puzzle to the rest of itself: the functions `call` effects run, where it keeps its own facts, and what hears noises, dialogues and cutscenes.
- `puzzlePlugin` (const): The puzzle plugin with no options.
- `PuzzleSaid` (const): A verb was answered: the action applied (null for a fallback line), where, the line key and the items gained.
- `PuzzleSceneResource` (const): The scene's puzzle as content gives it.
- `puzzleSchema` (const): The Zod schema of a puzzle with all its cross-checks: every item, fact, call and extension an action names must exist.
- `PuzzleState` (const): Facts, carried items (sorted), the ids of actions applied so far, and whether `puzzle.goal` was emitted.
- `Reader` (interface): What a condition reads: a fact by name and whether an item is carried.
- `Systemic` (interface): A way of solving the puzzle that no single action shows, with a note, the conditions it enables, the actions that lead to it and any risk (`lethal` or `chase`).
- `uses(action, verb)`: A pair matches in either order; a single `use` is the first of a pair, or the held item.
- `Value` (type): A fact's value: a yes-or-no, a number or text.
- `valueSchema` (const): The Zod schema of a fact's value.
- `Verb` (interface): What the player did, as the interpreter reads it: where it is aimed, the item held, a pair of items, a typed code or a floor point.
- `VerbCommand` (const): A verb: what the player did, sent by the game once its walker is in reach.
- `VerbReport` (interface): What happened to one verb: where it was aimed, the item held, the action taken (null for none), whether a line was said and whether the action turned away to a cutscene, dialogue, keypad or exit.

### `import { … } from '@automata/puzzle/sim'`

- `Action` (interface): One thing the player can do at a hotspot: where it is aimed (`at`), the item or pair of items it uses, the conditions that must hold, its effects, the line said and how many seconds it takes.
- `Cond` (type): A condition on the puzzle's state.
- `condSchema` (const): The Zod schema of a condition.
- `createPuzzlePlugin(options?)`: Makes the puzzle plugin with the game's options: its functions for `call` effects, where facts live, and what hears noises, dialogues and cutscenes.
- `Effect` (type): What an action does when it is taken: set or add to a fact, give or take an item, make a noise, start a cutscene or a dialogue, mark a checkpoint, open the keypad, leave through an exit, or call a function the game supplied.
- `effectSchema` (const): The Zod schema of an effect.
- `Entry` (interface): A way into the scene: its name, the items the player arrives with and any facts it sets.
- `fallbackLine(def, verb)`: The fallback line for a verb that matched nothing: per hotspot, then per verb kind, then `*` (codes have no `*`).
- `holds(reader, verb, c)`: Whether a condition holds for this reader and verb.
- `Lethal` (interface): A way to fail, with its rule and the hints that warn the player.
- `loadPuzzle(ctx, def, entryName?)`: Loads a scene's puzzle into the sim and starts the play state, at the named entry or the first one.
- `match` (const): The first action, in content order, aimed where the verb is, using what it holds, whose conditions all hold.
- `Point` (interface): A spot on the floor.
- `PuzzleCall` (interface): What a `{ call }` effect hands the game's function: the action and what the verb held or pointed at.
- `PuzzleCheckpoint` (const): An action marks a checkpoint.
- `PuzzleCutscene` (const): An action asks for a cutscene, by id.
- `PuzzleDebugSummary` (interface): What the debug summary shows: whether the goal is reached, the items carried, how many actions were seen and the facts.
- `puzzleDebugSummary(state)`: Turns the puzzle's play state into a summary for the debug overlay.
- `PuzzleDef` (interface): One scene's puzzle: its facts and items, where its hotspots are, the ways in, the actions, the systemic solutions and lethal rules, the goal and the fallback lines for verbs that match nothing.
- `puzzleDefShape` (const): The Zod schema of a puzzle's shape, without the cross-checks that `puzzleSchema` adds.
- `PuzzleDialogue` (const): An action asks for a dialogue, by id.
- `PuzzleExit` (const): An action leaves the scene for another, with the cutscene to play on the way.
- `PuzzleGave` (const): The player was given an item.
- `PuzzleGoal` (const): The puzzle's goal now holds.
- `PuzzleKeypad` (const): An action opens the keypad.
- `PuzzleNoise` (const): An action made a noise at a place, with its loudness and kind.
- `PuzzleOptions` (interface): How a game wires the puzzle to the rest of itself: the functions `call` effects run, where it keeps its own facts, and what hears noises, dialogues and cutscenes.
- `puzzlePlugin` (const): The puzzle plugin with no options.
- `PuzzleSaid` (const): A verb was answered: the action applied (null for a fallback line), where, the line key and the items gained.
- `PuzzleSceneResource` (const): The scene's puzzle as content gives it.
- `PuzzleState` (const): Facts, carried items (sorted), the ids of actions applied so far, and whether `puzzle.goal` was emitted.
- `Reader` (interface): What a condition reads: a fact by name and whether an item is carried.
- `Systemic` (interface): A way of solving the puzzle that no single action shows, with a note, the conditions it enables, the actions that lead to it and any risk (`lethal` or `chase`).
- `uses(action, verb)`: A pair matches in either order; a single `use` is the first of a pair, or the held item.
- `Value` (type): A fact's value: a yes-or-no, a number or text.
- `valueSchema` (const): The Zod schema of a fact's value.
- `Verb` (interface): What the player did, as the interpreter reads it: where it is aimed, the item held, a pair of items, a typed code or a floor point.
- `VerbCommand` (const): A verb: what the player did, sent by the game once its walker is in reach.
- `VerbReport` (interface): What happened to one verb: where it was aimed, the item held, the action taken (null for none), whether a line was said and whether the action turned away to a cutscene, dialogue, keypad or exit.

### `import { … } from '@automata/puzzle/solver'`

- `analyse(p, opts?)`: Solves a scene and checks its softlocks, hints and key-sets.
- `Analysis` (interface): Everything the tools learn about one scene: the solve, its routes, the softlocks, the hint checks and the key-sets.
- `applyEffect(s, e)`: Applies plain effects (set, add, give, take); everything else is presentation or handled by the model.
- `budget(solution, walk, speed?, keypad?)`: Seconds for a solution: action time plus walking between hotspots at `speed` m/s; a code is typed at `keypad`.
- `Budget` (interface): The time a solution takes: the seconds of actions, the seconds of walking and the total.
- `condFacts` (const): The names of the facts a condition reads.
- `condItems` (const): The names of the items a condition asks about.
- `createSolver(def, model?)`: Makes a solver for a puzzle and the model of what its `call` effects do.
- `describe(p, step)`: What the player does for a step, in words.
- `DOC` (const): The name of the generated doc file, `puzzle.md`.
- `Finding` (interface): One problem the checks found: an error or a warning, the rule it breaks, what it is about and the detail.
- `GOAL` (const): The name of the lock graph's last node, the goal.
- `HintResult` (interface): Whether the hints on one lethal rule hold: its id, whether they do and what failed.
- `holds` (const): Whether a condition holds in a solver state, with the item held and the code typed.
- `KeyDecl` (interface): A key-set the design asks for: the shortest solution with the actions in `ban` banned must take every action in `uses` to open `lock` with `key`, optionally from one entry.
- `keypadOf` (const): The hotspot a code is typed at: the one whose action opens the keypad.
- `KeyResult` (interface): A key-set check: the declaration, the shortest solution found with its actions banned, whether it used every action asked for, and which it missed.
- `keySet` (const): A solution's distinct action ids, sorted and joined, to tell routes apart.
- `LockEdge` (interface): One arrow of the lock graph: from one lock or item to another, with the action that gets there.
- `lockGraph(p, routes)`: Draws which things unlock which for a scene's routes, as nodes and labelled edges.
- `matrix(def)`: Builds the item by hotspot table of a puzzle.
- `Matrix` (interface): The item by hotspot table of a puzzle: for each item and hotspot, its own actions, a response whatever is held, or the fallback line, plus the item pairs that combine.
- `PuzzleModel` (interface): What data cannot say about a scene, for the solver: what each `call` effect does, extra facts, solver-only effects and conditions, what time does after a step, which hotspots exist in which state, the key-sets the design asks for and how many states a search expands before it stops.
- `PuzzleScene` (interface): How a game plugs into the solver's tools: its puzzle, its solver model, the names for the generated doc, where the player spawns, the game's text, its cutscene ids, how far apart its hotspots are and the files the doc depends on.
- `renderDoc(p, x)`: Writes a scene's puzzle doc as Markdown from its analysis: the hotspots, the item table, the routes with their times, the softlocks and the lock graph.
- `Route` (interface): One way through the puzzle: a name, the action banned to find it (null for the shortest) and its solution.
- `routesOf(result)`: The shortest solution, then one per distinct key-set among the alternatives, in the solver's order.
- `showCond(c)`: A condition in words, for the generated doc.
- `showEffect(e)`: An effect in words, for the generated doc.
- `Softlocks` (interface): The states from which the goal can no longer be reached, with the trail to each, and the actions that change something but are never taken in any reachable state.
- `Solution` (interface): A route through the puzzle: the entry it starts from, the steps in order and the seconds they take.
- `Solver` (interface): Searches a puzzle's states: pick the action a verb resolves to, list the verbs, step, test for the goal, find the shortest solution, look for softlocks and check hints.
- `SolveResult` (interface): What solving found: whether the puzzle can be solved, how many states were searched, whether the search was capped, the shortest solution, one alternative for each action of it banned in turn, and the distinct sets of actions used.
- `stamp` (const): The line that records which source files the generated doc was made from, with their hashes.
- `State` (interface): The puzzle's facts, the player's items (a multiset) and which systemic set-ups have happened.
- `Step` (interface): A verb as the player makes it: a hotspot with a held item (or a bare hand), a floor use, a combine, a typed code.
- `timing` (const): The seconds a solution takes: its actions plus walking between hotspots.
- `used` (const): The items an action uses: none, one, or both of a pair.
- `validate(p)`: Checks a scene's puzzle for mistakes the schema cannot see, such as a line with no text or an item nothing gives.
- `Verb` (interface): A verb the player can make in a state, with the action it resolves to.
- `Walk` (type): Metres walked between two hotspots (null: from the spawn).

## `@automata/sim`

### `import { … } from '@automata/sim'`

- `canonicalJson(value)`: Canonical JSON: object keys sorted at every depth, no whitespace.
- `CanonicalJsonError` (class): A value canonical JSON cannot represent exactly; hashing it anyway would let different values collide.
- `Command` (interface): Input to the sim, the only way gameplay state changes from outside.
- `CommandDef` (interface): A command the sim accepts as input: an id and the Zod schema its payload must match.
- `CommandRecord` (interface): A command as a system reads it this tick: the player slot that sent it (`source`), its per-source `seq` and its parsed `payload`.
- `ComponentDef` (interface): A component: a stable id and a flat record of typed fields.
- `createRng(seed)`: A generator seeded from `seed` (through splitmix32): the same seed gives the same sequence in every engine.
- `createSim(opts)`: Creates a sim from its plugins, seed and content; async, because a plugin may create engine state (a Rapier world).
- `Def` (type): Anything `definePlugin`'s flat `defs` list takes.
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
- `PHASES` (const): Fixed phase order.
- `PluginDef` (interface): A bundle of definitions the sim registers together: components, commands, events, resources and systems, the plugins it depends on, and optionally per-sim engine state and `config`.
- `PluginState` (interface): Engine state a plugin keeps outside the ECS, such as a Rapier world.
- `PluginStateSetup` (interface): What a plugin's state may know when it is created.
- `PreparedRestore` (interface): A plugin's parsed restore, held until the sim knows whether the whole snapshot is valid.
- `RejectedCommand` (interface): A command `step` dropped, with the reason.
- `RejectReason` (type): Why `step` dropped a command: `bad-header` (a field is missing or out of range), `unknown-command` (no plugin defines its type), `wrong-tick` (not the sim's current tick), `duplicate-seq` (the same source and seq twice in one step) or `invalid-payload` (it fails the command's schema).
- `RenderDelta` (interface): What changed for the renderer since the last delta.
- `RenderRow` (interface): One entity's render-flagged components (component id -> field values).
- `ResourceDef` (interface): A value the sim keeps once, not on any entity: an id, a Zod schema and the `init` that gives its starting value.
- `Rng` (interface): A deterministic generator (xoshiro128**, 32-bit integer math only, so it is bit-exact in every engine).
- `RngState` (type): The four 32-bit words of a generator's state, as `Rng.state()` copies them and snapshots store them.
- `Sim` (interface): A running simulation, stepped with commands, that can snapshot, restore and hash its state.
- `SIM_VERSION` (const): The sim package's version, written into replay headers for information only.
- `SimCapacityError` (class): More sims are alive than Koota allows worlds (16 per process).
- `SimContext` (interface): What a system's `run` receives each tick.
- `SimDisposedError` (class): The sim was disposed; it holds no world any more, so every call that reads or changes state refuses.
- `SimEvent` (interface): An event a system emitted during a step: the event's id as `type`, and its parsed `payload`.
- `SimFaultedError` (class): A system threw during `step`.
- `SimOptions` (interface): What `createSim` takes: the root `seed`, the `plugins`, `tickHz` (an integer from 1 to 1000, default 60) and the `content` the systems read as `ctx.content` (default `{}`).
- `SNAPSHOT_VERSION` (const): The snapshot format version this build reads and writes; a snapshot of another version fails with `SnapshotFormatError`.
- `SnapshotFormatError` (class): Snapshot bytes that are not a valid snapshot of this format version: bad magic, an unsupported version, truncated or malformed sections.
- `SnapshotMismatchError` (class): A valid snapshot that belongs to another sim: `field` names the header value that differs (`schemaHash`, `contentHash` or `tickHz`), with this sim's `expected` value and the snapshot's `actual` one.
- `SnapshotView` (interface): A readable copy of a snapshot, for diffs and reports.
- `sortedEntries(obj)`: Own enumerable [key, value] pairs, sorted by key.
- `sortedKeys(obj)`: Own enumerable string keys, sorted by UTF-16 code unit.
- `SpawnPart` (type): A component to spawn with: the definition alone (defaults) or [definition, initial values].
- `StepResult` (interface): What one `step` produced: the new tick, the events emitted, the renderer's delta and the commands that were rejected.
- `SystemDef` (interface): A system: a name, the phase it runs in, the systems it must run `before` or `after` within that phase, and its `run`, called once per tick.
- `SystemSpec` (interface): The object form of `defineSystem`: a name, a phase, the optional `before`/`after` ordering and the run.
- `xxhash64(data, seed?)`: XXH64 of `data` with an unsigned 64-bit `seed`.

### `import { … } from '@automata/sim/hash'`

- `canonicalJson(value)`: Canonical JSON: object keys sorted at every depth, no whitespace.
- `hex64(value)`: 16 lowercase hex digits.
- `utf8(s)`: UTF-8 encoding without TextEncoder (the sim's lib has no DOM/Web APIs).
- `xxhash64(data, seed?)`: XXH64 of `data` with an unsigned 64-bit `seed`.

### `import { … } from '@automata/sim/math'`

- `atan(x0)`: Deterministic arctangent.
- `atan2(y, x)`: Finite inputs only (sim values are finite).
- `cos(x)`: Deterministic cosine, in radians.
- `exp(x)`: Deterministic `e` to the power `x`.
- `hypot(x, y)`: No overflow scaling: inputs must satisfy x*x + y*y < 1.7e308.
- `log(x0)`: Deterministic natural logarithm.
- `pow(x, y)`: Deterministic `x` to the power `y`.
- `sin(x)`: Deterministic sine, in radians.
- `tan(x)`: Deterministic tangent, in radians, as `sin(x) / cos(x)`.

### `import { … } from '@automata/sim/replay'`

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
- `REPLAY_INFLATE_MAX_BYTES` (const): Larger than 1 MiB because goldens carry reference snapshots; player replays may pass less.
- `REPLAY_MAX_TICKS` (const): The longest run a replay may hold: 2^24 ticks, over 77 hours at 60 Hz.
- `ReplayCheck` (interface): A hash check at a tick: the hash the replay recorded (`expected`) and the hash the re-simulated sim has (`actual`).
- `ReplayCommand` (interface): A command as a replay stores it: the sim's `Command` without its tick, which the replay's `ticks` entry carries.
- `ReplayCompression` (interface): The deflate and inflate a `.replay` file needs.
- `ReplayFormatError` (class): Bytes that are not a valid `.replay`.
- `ReplayHeader` (interface): The facts a replay needs before it plays: tick rate, seed, the schema and content hashes it was recorded against, where it starts and how often it checks.
- `ReplayRecordError` (class): A recording that cannot be exact: the sim stepped outside the recorder, a payload that is not JSON, and so on.
- `ReplayStepper` (interface): A replay playing back one tick at a time on its own sim.
- `ReplayStepSetup` (interface): What a stepper needs to rebuild the recorded sim: the same `plugins` and `content` the recording sim had.
- `unpackReplay(bytes, compression, options?)`: Inflates `.replay` file bytes and decodes them.

### `import { … } from '@automata/sim/testing'`

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

### `import { … } from '@automata/sim/testing/commands'`

- `goldenCommands(options?)`: The Vitest browser commands that let golden tests read golden files in a browser: register them with `browser: { commands: goldenCommands() }`.
- `GoldenCommandsOptions` (interface): Options for {@link goldenCommands}.

### `import { … } from '@automata/sim/testing/property'`

- `RoundTripFailure` (interface): One case whose restored run differed from the uninterrupted one: its number, sim seed, length, restore tick, variant and a report of what differed.
- `RoundTripOptions` (interface): What `snapshotRoundTripProperty` runs: the plugins, content and a command script, and how many cases of what length to try.
- `RoundTripVariant` (type): How a case restores: into a `fresh` sim, or into one that has `dirty` (stepped on past the snapshot).
- `snapshotRoundTripProperty(options)`: Checks that snapshot, restore and continue equals an uninterrupted run, over many seeds, run lengths and restore points, alternating fresh and dirty restores.

## `@automata/tools`

### `import { … } from '@automata/tools'`

- `defineShipConfig(config)`: Identity function that gives a game's `ship.config.ts` type checking and editor completion.
- `ItchConfig` (interface): What a game writes in `ship.config.ts`.
- `ItchSettings` (interface): The checked settings, with the channel filled in.
- `ShipConfig` (interface): What a game tells ship about itself: the game config every target reads (`@automata/content`'s `GameConfig`) and each target's own section.
- `TauriConfig` (interface): What a game writes in `ship.config.ts` to build for the desktop.

## `@automata/ui-screens`

### `import { … } from '@automata/ui-screens'`

- `ErrorScreen` (const): The error screen: core's ErrorPanel on core's ScreenFrame (the frame gives Back its place).
- `LoadingScreen` (const): The loading screen: the game's title on core's ScreenFrame with core's LoaderOverlay over it.
- `PauseCopy` (interface): Core's `ScreensCopy['paused']`, the part this screen reads.
- `PauseScreen` (const): The pause screen: a dialog over the dimmed game with Resume (primary, focused), Mute, Settings and Quit.
- `ResultsAction` (interface): A button on the results screen's action bar.
- `ResultsCopy` (interface): The words this screen adds to the game's own: the rows' region name, the empty line and the "+N more" label.
- `ResultsRow` (interface): One line of the results list: a label and its value, with an optional detail line under it.
- `ResultsScreen` (const): The results screen: a title, the rows a game wants to show and one to three actions, on core's ScreenFrame.
- `SettingsCopy` (interface): Core's `ScreensCopy['settings']['screen']`.
- `SettingsScreen` (const): The settings screen: core's SettingsScreen with the game's own tabs, its words taken from core's `ScreensCopy['settings']['screen']`.
- `TitleAction` (interface): An extra button on the title screen beside Play, such as Settings or Credits.
- `TitleScreen` (const): The title screen: the game's name, one primary Play and any further actions the game adds (Settings, Credits), on core's ScreenFrame and ActionBar.

### `import { … } from '@automata/ui-screens/error'`

- `ErrorScreen` (const): The error screen: core's ErrorPanel on core's ScreenFrame (the frame gives Back its place).

### `import { … } from '@automata/ui-screens/loading'`

- `LoadingScreen` (const): The loading screen: the game's title on core's ScreenFrame with core's LoaderOverlay over it.

### `import { … } from '@automata/ui-screens/pause'`

- `PauseCopy` (interface): Core's `ScreensCopy['paused']`, the part this screen reads.
- `PauseScreen` (const): The pause screen: a dialog over the dimmed game with Resume (primary, focused), Mute, Settings and Quit.

### `import { … } from '@automata/ui-screens/results'`

- `ResultsAction` (interface): A button on the results screen's action bar.
- `ResultsCopy` (interface): The words this screen adds to the game's own: the rows' region name, the empty line and the "+N more" label.
- `ResultsRow` (interface): One line of the results list: a label and its value, with an optional detail line under it.
- `ResultsScreen` (const): The results screen: a title, the rows a game wants to show and one to three actions, on core's ScreenFrame.

### `import { … } from '@automata/ui-screens/settings'`

- `SettingsCopy` (interface): Core's `ScreensCopy['settings']['screen']`.
- `SettingsScreen` (const): The settings screen: core's SettingsScreen with the game's own tabs, its words taken from core's `ScreensCopy['settings']['screen']`.

### `import { … } from '@automata/ui-screens/title'`

- `TitleAction` (interface): An extra button on the title screen beside Play, such as Settings or Credits.
- `TitleScreen` (const): The title screen: the game's name, one primary Play and any further actions the game adds (Settings, Credits), on core's ScreenFrame and ActionBar.
