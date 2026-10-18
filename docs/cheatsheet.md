# Automata cheatsheet

> Every export of every published `@mcthaydt/automata-*` entry point, one line each, grouped by module (package). Generated from the API index by `pnpm cheatsheet` after `pnpm build`; do not edit by hand. `pnpm api-index` fails when this page is stale. Full signatures and doc comments: the API reference (`api.md`).

## `@mcthaydt/automata-content`

### `import { … } from '@mcthaydt/automata-content'`

- `AssetsSource` (interface)
- `buildContent` (const): Compiles, writes every output under the output folder, then removes the outputs it no longer produces.
- `checkTuningLayer(layer, options, { complete })`: Checks one layer of tuning against code-owned declarations.
- `compileContent` (const): Compiles `<root>/content` in memory.
- `CompiledContent` (interface)
- `ContentCompileFailed` (class): The authored content has problems.
- `ContentConfig` (type): The default export of `automata.content.ts`.
- `ContentData` (type): The compiled content as it is written to `content.json` and hashed.
- `ContentGenerator` (interface)
- `contentHash(data)`: 16 lowercase hex digits.
- `ContentOptions` (interface)
- `contentRef(kind)`: The ID of another content item of `kind`.
- `ContentSchemaDef` (interface)
- `ContentSchemaOptions` (interface)
- `ContentSchemaPlace` (type): Where a kind's files are: every TOML file under a folder (a collection), or one file (a document).
- `ContentWriteFailed` (class): An output could not be written.
- `DEFAULT_OUT_DIR` (const)
- `DEFAULT_PALETTE` (const)
- `defineContentGenerator(name, generate)`
- `defineContentSchema(kind, schema, place, options?)`
- `Diagnostic` (interface)
- `DiagnosticCode` (type): Stable codes.
- `FlowCapabilities` (interface): What the game's code implements: the screens, and optionally the pairs and destinations each allows.
- `FlowGraph` (interface)
- `FlowTransition` (interface)
- `formatDiagnostic(d)`: `content/tuning.toml:12:1 GRAVITY outOfRange: expected -1200..-100, received -2000`
- `GameSource` (interface)
- `GeneratorInput` (interface)
- `GeneratorOutput` (interface)
- `InvalidContentConfig` (class): The game's code registered something unusable (a duplicate kind, a clashing generator).
- `localized()`: Text a player reads, written in the source language.
- `MessageCatalog` (type): One locale's messages: message key to translated text.
- `messageKey(kind, id, path)`: The message key of one text.
- `MessageLocation` (interface): A message's place in its file, 1-based.
- `Palette` (interface)
- `ParaglideOptions` (interface): Where and which catalogs `ContentOptions.paraglide` compiles with Paraglide on build.
- `PreloadInput` (interface)
- `preloadList` (const)
- `renderTuningTable(meta)`: Every tunable once, sorted by name, with its type, range and value in `content/tuning.toml`.
- `RukenFields` (type)
- `SimPartition` (interface)
- `sortDiagnostics(diagnostics)`
- `TunableDeclaration` (interface)
- `TunableDeclarations` (type)
- `TuningMeta` (type)
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

### `import { … } from '@mcthaydt/automata-content/locale'`

- `ALWAYS_CHARACTERS` (const): Printable ASCII, CJK symbols and punctuation, half- and full-width forms, and the symbols the UI draws.
- `catalogCharacters(catalog)`: Every character the catalog's messages show.
- `ContentText` (type): `text(kind, id, path, authored, inputs?)`: the text in the active locale, or the authored text.
- `ContentTextOptions` (interface): Options for `createContentText`.
- `createContentText(messages, options?)`: A lookup over the messages module Paraglide compiles into `paraglide.outdir` (its `messages.js`, imported whole).
- `localeCharacters(catalog)`: What a locale's subset font is cut to: `ALWAYS_CHARACTERS` and the catalog's characters.
- `MessageCatalog` (type): One locale's messages: message key to translated text.
- `messageKey(kind, id, path)`: The message key of one text.
- `snakeKey(value)`: `snow-shrine` → `snow_shrine`, `fastFall` → `fast_fall`, `melee/sword` → `melee_sword`.

### `import { … } from '@mcthaydt/automata-content/vite'`

- `automataContent(pluginOptions?)`
- `AutomataContentOptions` (type): The plugin's options: `ContentOptions`, with `root` defaulting to Vite's root.
- `VIRTUAL_MODULE_ID` (const)

## `@mcthaydt/automata-host`

### `import { … } from '@mcthaydt/automata-host'`

- `AnalyticsProps` (type)
- `ErrorCode` (type): Ruken's error codes (`@ruken/protocol` `ERROR_CODES`), as the SDK's `RukenError` carries them.
- `HOST_EXIT_CAP` (const): How long the game may hold the host's close (FloorFifty `ruken/exit.ts`, Ruken P6 §4 "1 s cap").
- `HostError` (class): Any failure after the handshake.
- `HostHandshakeFailed` (class): The page is inside a frame, but the SDK got no usable welcome and fell back to its standalone session.
- `Hosting` (interface): Everything a game may ask of, or hear from, its host: the `Hosting` contract of the M1 shared contracts spec §1, implemented by the host lane.
- `HostingLeaderboards` (interface): The host's leaderboards (Ruken's `LeaderboardsApi`, PRODUCT spec §2 F1).
- `HostingLive(options, seams?)`: The single `Hosting` layer for games (shared contracts §1.1).
- `HostingOptions` (interface): What the game asks of its host.
- `HostingSaves` (interface): The player's saves (shared contracts §1.1).
- `HostingSeams` (interface): Test seams.
- `makeHosting(options, seams?)`: Builds `Hosting` over `Ruken.init`.
- `toHostError(operation, cause)`: Turns whatever the SDK threw or rejected with into a `HostError`.

### `import { … } from '@mcthaydt/automata-host/testing'`

- `FakeHostClock` (interface): The clock shape `@ruken/sdk-host`'s fake host takes; the game's `SdkEnv.timers` run on it too.
- `FakeHostHandle` (interface): The fake host behind `HostingTest`, for tests that drive the host side.
- `HostingTest(options?)`: `HostingLive` wired to `@ruken/sdk-host`'s fake host over in-memory ports, with the real SDK in between (shared contracts §1.1).
- `HostingTestOptions` (interface)
- `manualClock(startMs?)`: SDK and fake-host timing (hello retries, the 10 s handshake give-up, request timeouts) runs on this clock, so a test can step past them without waiting (shared contracts §1.4).
- `ManualClock` (interface): A clock that moves only when the test calls `advance`.
- `realClock` (const): Real time, for tests that only need the host to answer.
- `runScoped(program)`: Runs a test program in a fresh scope, closing it (and every layer built inside) at the end.
- `TEST_GAME_ORIGIN` (const)

## `@mcthaydt/automata-node`

### `import { … } from '@mcthaydt/automata-node'`

- `FileError` (class): Reading, writing, listing or removing a file failed.
- `Files` (interface): The service's tag.
- `FilesLive` (const)
- `FilesService` (interface)
- `ProcessError` (class): A program could not be started (not found, not executable).
- `ProcessRunner` (interface): The service's tag; see `Files` for why it is not a `Context.Tag` class.
- `ProcessRunnerLive` (const)
- `ProcessRunnerService` (interface)
- `RunOptions` (interface)
- `RunResult` (interface)
- `TaggedErrorClass` (type): The class `Data.TaggedError(tag)` returns, written out. isolatedDeclarations cannot infer the type of a call in an `extends` clause, so each error extends a constant annotated with this type instead (the pattern of `content`'s compile errors and `host`'s errors).

## `@mcthaydt/automata-physics`

### `import { … } from '@mcthaydt/automata-physics/2d'`

- `body2d(kind, opts?)`
- `BodyKind` (const)
- `Collider2D` (const): One collider.
- `collider2d` (const)
- `ColliderOptions` (interface): Options every collider helper takes.
- `CollisionEnded2D` (const)
- `CollisionStarted2D` (const)
- `physics2d(options?)`: The 2D physics plugin (M2.1 spec §3.5).
- `Physics2DOptions` (interface)
- `RigidBody2D` (const): A Rapier rigid body: its kind (`BodyKind`), damping, and linear (m/s) and angular (rad/s) velocity.
- `ShapeKind` (const)
- `transform2d(at?)`
- `Transform2D` (const): Position in metres and rotation in radians.

### `import { … } from '@mcthaydt/automata-physics/3d'`

- `body3d(kind, opts?)`
- `BodyKind` (const)
- `Collider3D` (const): One collider.
- `collider3d` (const)
- `ColliderOptions` (interface): Options every collider helper takes.
- `CollisionEnded3D` (const)
- `CollisionStarted3D` (const)
- `physics3d(options?)`: The 3D physics plugin (M2.1 spec §3.5).
- `Physics3DOptions` (interface)
- `RigidBody3D` (const): A Rapier rigid body: its kind (`BodyKind`), damping, and linear (m/s) and angular (rad/s) velocity.
- `ShapeKind` (const)
- `transform3d(at?)`
- `Transform3D` (const): Position in metres and rotation as a unit quaternion.

## `@mcthaydt/automata-ship`

### `import { … } from '@mcthaydt/automata-ship'`

- `BoardName` (interface): A board a source file names, by its name and position (1-based, at the opening quote).
- `boardNamesIn(file, code)`: The boards one source file names, in source order; `undefined` when it does not parse (its typecheck already fails, and a half-read tree could report a board that is not there).
- `BUILD_ID_PATTERN` (const): A build's ID on the dev host: the commit's UTC time to the minute, then its short sha, for example `202610111205-abcdef0` (FloorFifty `deploy/bin/build-tag`).
- `buildIdFor(commit)`
- `checkManifest(toml)`: Checks `ruken.toml` text with Ruken's own parser, so AF accepts exactly what Ruken accepts.
- `checkVersion(version, tag)`: A release's version must be its tag's (FloorFifty `deploy/tools/ruken-pack.ts`): the build Ruken shows as 0.10.2 is the one tagged v0.10.2.
- `declaredBoardsIn(code)`: The board ids a `ship.config.ts` declares: the keys of its `leaderboards` object, read from the source as written (`automata check` reads files, it does not run them).
- `defineShipConfig(config)`: Identity function that gives a game's `ship.config.ts` type checking and editor completion.
- `deployDev(input)`
- `DeployDevInput` (interface)
- `DeployFailed` (class): The dev host's deploy step (tar or ssh) failed; `output` is what it printed.
- `EntryMissing` (class): `[game] entry` names a file the build does not have.
- `EnvValue` (interface): One variable read from a game's `.env*` files, whose value the bundle scan looks for in the build.
- `FileError` (class): Reading, writing, listing or removing a file failed.
- `findRootAbsoluteReferences(distDir)`
- `findSecretsInBuild(distDir, envValues)`: Every secret in a built folder.
- `findUndeclaredBoards(gameDir, declared)`: Every board a game's sources name that `declared` (its ship config's `leaderboards` keys) lacks.
- `inputsProblems(inputs, bindings)`: Each disagreement between `runtime.inputs` and the bindings, in action order; empty when they agree.
- `isBoardSource` (const): Whether `file` is one of the game's sources the board check reads (`.ts`, `.tsx`, `.mts`, `.js`, `.mjs`).
- `ManifestInputsMismatch` (class): `runtime.inputs` disagrees with the game's input bindings (M4 spec §4.13, I-g).
- `ManifestInvalid` (class): Ruken's parser refused the generated `ruken.toml`.
- `parseEnvFile(file, text)`: The variables of one `.env` file: `KEY=value` lines, with `export`, quotes and `#` comments allowed.
- `portsFor(checkoutPath, env)`: The ports a checkout's test server and preview build listen on (FloorFifty `playwright.config.ts`).
- `prepareBuild(input)`: Makes a built folder ready for `ruken publish` and the dev host (ship spec §3.3): checks the tag, the entry page, root-absolute paths, secrets (QB-b) and the leaderboards the game names (M5.7), then writes `ruken.toml` once Ruken's parser accepts it.
- `PrepareInput` (interface)
- `ProcessError` (class): A program could not be started (not found, not executable).
- `PublishAuth` (class): Exit 3: the token was missing, wrong or lacks the rights.
- `PublishFailed` (class): Any other exit code.
- `PublishInput` (interface)
- `PublishRejected` (class): Exit 1: Ruken's checks rejected the build.
- `PublishTimeout` (class): Exit 4: Ruken's checks took longer than the CLI waits.
- `publishToRuken(input)`
- `PublishUsage` (class): Exit 2: the command line was wrong.
- `readEnvValues(gameDir)`: The variables of every top-level `.env*` file in the game folder; none when the folder does not exist.
- `RootAbsoluteReference` (class): The build names its own files from the origin's root, which 404s under `/b/<buildId>/`.
- `rukenCliPath(moduleUrl?, exists?)`: The `ruken` bin of the vendored `@ruken/cli` package.
- `rukenToml(config)`
- `scanTextForSecrets(file, text, envValues)`: Every secret in one file's text.
- `SecretFound` (interface): A secret the bundle scan found in a built file, located without repeating the secret.
- `SecretInBuild` (class): The build holds a key, an `.env` value or a high-entropy string (QB-b).
- `SHIP_PACKAGE` (const)
- `ShipConfig` (interface): What a game tells ship about itself, in Ruken's own manifest shape (`@ruken/manifest`'s `Manifest`).
- `ShipInputBindings` (interface): What ship reads of a game's input profile. ship is published and the profile's owner (`runtime`) is private, so this is the read-only subset ship consumes, not a copy of the contract: a profile's `bindings` is assignable to it.
- `testRemote(input)`
- `TestRemoteFailed` (class)
- `TestRemoteInput` (interface)
- `TestRemoteReason` (type): Why `test-remote` stopped without a green run.
- `UndeclaredBoard` (class): The game names a leaderboard its ship config's `leaderboards` does not declare (M5 spec §4.8, L-b).
- `UndeclaredBoardFound` (interface): A board the game's sources name that its ship config does not declare, at the call site.
- `VersionMismatch` (class): A release tag that is not `v<version>`.

## `@mcthaydt/automata-sim`

### `import { … } from '@mcthaydt/automata-sim'`

- `canonicalJson(value)`: Canonical JSON: object keys sorted at every depth, no whitespace.
- `CanonicalJsonError` (class): A value canonical JSON cannot represent exactly; hashing it anyway would let different values collide.
- `Command` (interface): Input to the sim (spec §4.4 rule 4).
- `CommandDef` (interface)
- `CommandRecord` (interface)
- `ComponentDef` (interface)
- `createRng(seed)`
- `createSim(opts)`
- `Def` (type): Anything `definePlugin`'s flat `defs` list takes (DX spec §3.2).
- `defineCommand(id, schema)`
- `defineComponent(id, fields, opts?)`
- `defineEvent(id, schema)`
- `definePlugin(spec)`
- `defineResource(id, schema, init)`
- `defineSystem(name, run)`, `defineSystem(name, phase, run)`, `defineSystem(spec)`: A system: `defineSystem(name, run)` runs in `gameplay`, `defineSystem(name, phase, run)` in that phase, and the object form also takes `before`/`after`.
- `deriveSeed(rootSeed, name)`: Seed for a named substream: FNV-1a over the name's UTF-16 code units, mixed with the root seed.
- `EntityRef` (interface): A live entity, addressed by its StableId.
- `EventDef` (interface)
- `FieldRecord` (type)
- `FieldSchema` (type)
- `FieldType` (type)
- `FieldValue` (type)
- `FieldValues` (type)
- `hex64(value)`: 16 lowercase hex digits.
- `Phase` (type)
- `PHASES` (const): Fixed phase order (spec §4.3).
- `PluginDef` (interface)
- `PluginState` (interface): Engine state a plugin keeps outside the ECS, such as a Rapier world (M2.1 spec §3.1).
- `PluginStateSetup` (interface): What a plugin's state may know when it is created.
- `PreparedRestore` (interface): A plugin's parsed restore, held until the sim knows whether the whole snapshot is valid.
- `RejectedCommand` (interface)
- `RejectReason` (type)
- `RenderDelta` (interface): What changed for the renderer since the last delta (spec §4.7).
- `RenderRow` (interface): One entity's render-flagged components (component id -> field values).
- `ResourceDef` (interface)
- `Rng` (interface)
- `RngState` (type)
- `Sim` (interface)
- `SIM_VERSION` (const): The sim package's version, written into replay headers for information only (M2.3 spec §3.2).
- `SimCapacityError` (class): More sims are alive than Koota allows worlds (16 per process).
- `SimContext` (interface): What a system's `run` receives each tick (spec §4.1).
- `SimDisposedError` (class): The sim was disposed; it holds no world any more, so every call that reads or changes state refuses.
- `SimEvent` (interface)
- `SimFaultedError` (class): A system threw during `step`.
- `SimOptions` (interface)
- `SNAPSHOT_VERSION` (const)
- `SnapshotFormatError` (class)
- `SnapshotMismatchError` (class)
- `SnapshotView` (interface): A readable copy of a snapshot, for diffs and reports (M2.3 spec §3.1).
- `sortedEntries(obj)`: Own enumerable [key, value] pairs, sorted by key.
- `sortedKeys(obj)`: Own enumerable string keys, sorted by UTF-16 code unit.
- `SpawnPart` (type): A component to spawn with: the definition alone (defaults) or [definition, initial values].
- `StepResult` (interface)
- `SystemDef` (interface)
- `SystemSpec` (interface): The object form of `defineSystem`: a name, a phase, the optional `before`/`after` ordering and the run.
- `xxhash64(data, seed?)`: XXH64 of `data` with an unsigned 64-bit `seed`.

### `import { … } from '@mcthaydt/automata-sim/hash'`

- `canonicalJson(value)`: Canonical JSON: object keys sorted at every depth, no whitespace.
- `hex64(value)`: 16 lowercase hex digits.
- `utf8(s)`: UTF-8 encoding without TextEncoder (the sim's lib has no DOM/Web APIs).
- `xxhash64(data, seed?)`: XXH64 of `data` with an unsigned 64-bit `seed`.

### `import { … } from '@mcthaydt/automata-sim/math'`

- `atan(x0)`
- `atan2(y, x)`: Finite inputs only (sim values are finite).
- `cos(x)`
- `exp(x)`
- `hypot(x, y)`: No overflow scaling: inputs must satisfy x*x + y*y < 1.7e308.
- `log(x0)`
- `pow(x, y)`
- `sin(x)`
- `tan(x)`

### `import { … } from '@mcthaydt/automata-sim/replay'`

- `createRecorder(sim, options?)`
- `createReplayStepper(replay, setup)`
- `decodeReplay(bytes)`
- `DEFAULT_CHECK_EVERY` (const)
- `encodeReplay(replay)`
- `packReplay(replay, compression)`
- `Recorder` (interface)
- `RecorderOptions` (interface)
- `Replay` (interface)
- `REPLAY_FORMAT` (const)
- `REPLAY_INFLATE_MAX_BYTES` (const): Larger than FloorFifty's 1 MiB because goldens carry reference snapshots; player replays may pass less.
- `REPLAY_MAX_TICKS` (const): The longest run a replay may hold: 2^24 ticks, over 77 hours at 60 Hz.
- `ReplayCheck` (interface)
- `ReplayCommand` (interface)
- `ReplayCompression` (interface)
- `ReplayFormatError` (class): Bytes that are not a valid `.replay` (M2.3 spec §5).
- `ReplayHeader` (interface)
- `ReplayRecordError` (class): A recording that cannot be exact: the sim stepped outside the recorder, a payload that is not JSON, and so on.
- `ReplayStepper` (interface)
- `ReplayStepSetup` (interface)
- `unpackReplay(bytes, compression, options?)`

## `@mcthaydt/automata-testing`

### `import { … } from '@mcthaydt/automata-testing'`

- `documentScrolls(doc)`: The document itself never scrolls; screens scroll inside declared regions.
- `FakeResizeObserver` (interface)
- `fakeViewportWindow(size)`
- `FakeViewportWindow` (interface)
- `FakeVisualViewport` (interface)
- `findClipped(root, selector)`: Each element `selector` names is tall enough for what it holds (a crushed row clips its content).
- `findIntrusions(root, rects)`: No visible control intersects a reserved area (Ruken's strip, a keyboard), in viewport px, by its whole box.
- `findOffscreenControls(root)`: Every visible control is on screen, unless a declared scroll region (`[data-scroll-region]`) clips it (see `clippedBy`): a fixed control, or one positioned outside the region, is judged where it is drawn, since scrolling the region would never bring it into view.
- `findOverlaps(a, b)`: Two elements' boxes do not overlap.
- `findSmallTargets(root, min, minPrimary)`: Every visible control is at least `min` square, and a primary (`data-kind="primary"`) at least `minPrimary` tall.
- `findUnreachable(elements)`: Each element is fully inside the viewport, and the whole of it is in view: a tap at its centre and at the middle of each edge lands on it or inside it, so nothing covers or clips any part.
- `hostDisplay(options?)`: Ruken's display metrics for a hosted game.
- `installFakeResizeObserver()`
- `LayoutRect` (interface): Layout assertions as plain DOM functions (M1.6 spec §3.10), from FloorFifty's `tests/e2e/support/layout.ts` at 122a220 (`expectReachable`, `expectControlsFit`, `expectRowsWhole`, `expectApart`, `expectNoDocumentScroll`).
- `MountedFixture` (interface)
- `mountFixture(component, props, target?)`
- `REFERENCE_SIZES` (const)
- `ReferenceFormFactor` (type): `@mcthaydt/automata-ui`'s `FormFactor`.
- `ReferenceHeightTier` (type): `@mcthaydt/automata-ui`'s `HeightTier`.
- `ReferenceSize` (interface)
- `textSnippet(text, tag?, trusted?)`: A Svelte 5 snippet rendering `<tag>text</tag>`, so a test can pass `children`, `body` or an icon to a component without writing a wrapper component (Ruken `packages/ui/src/test-snippets.ts`).
- `TIGHT_SIZES` (const): Sideways phones shorter than 780x270, where an open keyboard leaves the least room (framework audit of #7, 2026-10-11).
- `Variant` (interface): A condition layered over a reference size.
- `VARIANTS` (const)
- `visibleControls(root)`: Controls a player could see and reach: laid out, not hidden, not in an inert subtree.

### `import { … } from '@mcthaydt/automata-testing/sim'`

- `Difference` (interface)
- `diffSnapshotViews(expected, actual)`
- `expectGolden(report)`: Throws with the formatted report unless the golden matched or was just written.
- `formatGoldenReport(report)`
- `GOLDEN_MAX_PACKED_BYTES` (const): A golden that passes this cannot be reviewed or loaded cheaply; lower snapshotEvery's cost instead.
- `goldenCommands(options?)`
- `GoldenReport` (type)
- `nodeCompression` (const): Node only. zlib is imported when first used, so importing this module in a browser costs nothing.
- `replayGolden(options)`
- `ReplayGoldenOptions` (interface)
- `RoundTripFailure` (interface)
- `RoundTripOptions` (interface)
- `RoundTripVariant` (type)
- `simGolden(options)`
- `SimGoldenOptions` (interface)
- `snapshotRoundTripProperty(options)`
- `streamCompression` (const): Browsers and Node: CompressionStream / DecompressionStream('deflate-raw').

### `import { … } from '@mcthaydt/automata-testing/sim/commands'`

- `goldenCommands(options?)`
- `GoldenCommandsOptions` (interface): Options for {@link goldenCommands}.

### `import { … } from '@mcthaydt/automata-testing/sim/property'`

- `RoundTripFailure` (interface)
- `RoundTripOptions` (interface)
- `RoundTripVariant` (type)
- `snapshotRoundTripProperty(options)`

## `@mcthaydt/automata-ui`

### `import { … } from '@mcthaydt/automata-ui'`

- `ActionBar` (const)
- `ActionKind` (type): The action bar's model (M1.6 spec §3.4; from FloorFifty `ui/layout/action-bar.ts` at 122a220).
- `applyGeometry(root, geometry)`: Writes the geometry where CSS reads it (spec §3.2).
- `arrowKeyNav(event)`: The menu direction an arrow key walks, as a d-pad would, or undefined when the key is not a bare arrow or its target keeps that arrow.
- `BarAction` (interface)
- `BarSample` (type): One reading of the viewport, as `HiddenBrowserBar.measure` needs it.
- `BOOT_FAILURE_COPY_EN` (const): English defaults in Ruken's tone (quiet, human, no blame); replaced by Paraglide keys in M5.
- `bootDeviceClass(win?)`
- `BootFailure` (type)
- `BootFailureAction` (type): Try again, Continue without loading, Back to Ruken.
- `BootFailureCopy` (type)
- `BootFailurePanel` (const)
- `BootFailureState` (type)
- `bootFailureView(failure, hostKind)`: Which state a failure draws and which ways forward it offers.
- `BootFailureViewModel` (interface)
- `Button` (const): The framework's button (M4 spec §4.12): an `.af-control` of one kind.
- `Chip` (const): A short status label (M4 spec §4.12).
- `classifyDevice(input)`
- `classifyFormFactor(width, height)`
- `classifyHeightTier(height)`
- `CollapseLevel` (type)
- `collapseLevel(available, widths)`: The first level whose one-row width fits.
- `COMPACT_MAX_HEIGHT` (const): Below this, compact: what a browser leaves a sideways phone (780 x 270 Chrome on a Galaxy, 667 x 320 Safari on an SE).
- `ControlsCopy` (interface): Every word the Controls section shows, in the game's language.
- `controlsMessage(state, copy, labelOf)`: The section's status line for `state`, with actions by their labels; empty in the list.
- `ControlsRow` (interface): One game action in the Controls section: its id, its name and its bindings now.
- `ControlsSection` (const): The Controls tab's section (M4 spec §4.5, §7), laid out as FloorFifty's Controls tab (`SettingsPanel.svelte` at a28dc44): one section per device the player can use, the one in their hand first and marked.
- `ControlsState` (type): Where a rebind is: the list; waiting for a press (with the seconds left); refused because it would leave `with` unbound; refused as reserved; timed out; or saved.
- `ControlsTouchMode` (type): How touch drives play (runtime's `TouchMode`).
- `CornerControls` (const)
- `createGeometryOwner(options)`
- `CURSOR_IDLE_MS` (const): How long the pointer must be still before it hides on a gameplay screen.
- `cursorHidden(state)`: Whether the pointer is hidden now: on a gameplay screen, not paused, and the pointer unused or idle.
- `CursorInput` (type): The device the player used last, as the cursor policy sees it.
- `CursorRunner` (class): Applies `cursorHidden` to a target element: `attach` follows pointer moves and key presses, and each `tick` sets the element's `cursor` style.
- `DeviceClass` (type)
- `Dialog` (const)
- `DISPLAY_QUALITIES` (const): The tiers the Display section offers, best first.
- `DisplayCopy` (interface): Every word the Display section shows, in the game's language.
- `DisplayQuality` (type): A graphics quality tier (runtime's `QualityTier`).
- `DisplaySection` (const): The Display section of Settings (M4 spec §4.8, §7): the graphics quality tier as an option group (a pad's `adjust` cycles it), and reduced motion as the browser reports it.
- `enterFullscreen(doc, screen?)`: Enters element fullscreen, then asks for a landscape lock, which most phones refuse outside an installed app.
- `ErrorAction` (interface): One way forward from a failure (M1.6 spec §3.4).
- `ErrorCode` (type): Ruken's error code.
- `ErrorPanel` (const)
- `fitColumns(shape, groups)`: The shape cut to the columns the largest group fills, at its rows.
- `fitShape(most, box, minTile, gap)`: The most tiles of `minTile` px the box holds, never more than `most`, never below one by one.
- `FocusNavigator` (class)
- `FormFactor` (type): The four form factors (M1.6 spec §3.1; from FloorFifty `ui/form-factor.ts` at 122a220).
- `fullscreenSupport(doc, nav)`: Which fullscreen, if any, this browser can give a standalone page.
- `FullscreenSupport` (type): Ruken's answer to whether this browser can go fullscreen, and how.
- `GateInputs` (type)
- `Geometry` (interface)
- `GeometryInput` (interface)
- `GeometryOwner` (interface)
- `GeometryOwnerOptions` (interface)
- `GeometryState` (interface): The current geometry as rune state: reading `current` in a component or `$derived` tracks it.
- `GridBox` (interface): The measured box a page is fitted into, in CSS px.
- `GridPage` (interface): One page: a group's items, padded with `undefined` to the page's capacity.
- `GridShape` (interface): A page's columns and rows.
- `HeightTier` (type): The height tiers (M1.6 spec §3.1; from FloorFifty `ui/height-tier.ts` at 122a220).
- `HiddenBrowserBar` (class)
- `HostDisplay` (type): What the host says about the display: the parts of Ruken's `display.metrics` the geometry reads.
- `HostKind` (type): `Hosting['kind']` (shared contracts §1.1), written out until packages/host lands.
- `hostReservedInsets(host)`: Ruken reserves a strip on one edge; its width is the rect's, never negative (FloorFifty `reservedOf`).
- `IconButton` (const): A button whose face is an icon (M4 spec §4.12).
- `InputMethod` (type): The input method the player last used, app-wide.
- `InputMethodTracker` (class)
- `Insets` (interface): CSS px on each side, all >= 0.
- `installGlobalErrorHandlers(win, onFatal, onRejection?)`: Installs once per window; a second call is a no-op.
- `interceptBackGesture(win, onBack)`: Holds the game's history entry and turns a back step off it into `onBack`.
- `isDuckDuckGo(nav)`: DuckDuckGo names itself only in the client-hint brands, not the user agent.
- `isFullscreen(doc)`: Whether the page is fullscreen now.
- `isTap(dx, dy)`: Whether a press that moved `dx`, `dy` px is a tap rather than a swipe.
- `keyLabel(code, layout?)`: A key's label: the keyboard layout's own (`navigator.keyboard.getLayoutMap()`, a letter in capitals) when there is one, else its `code` without the `Key` and `Digit` prefixes, an arrow as its arrow.
- `landscapeGate(inputs)`
- `LandscapeGate` (const): The landscape gate's cover (M4 spec §4.9, §7; FloorFifty `ui/components/LandscapeGate.svelte` at `ac72660`): over every screen and every dialog, empty whenever the gate is open (`state` none).
- `LandscapeGateCopy` (interface): The landscape gate's words: one tap to fullscreen, or how to play where a browser cannot hide its bar.
- `LandscapeGateState` (type): Nothing; a tap to go fullscreen; or turn upright / add to the Home Screen.
- `LeaderboardCopy` (interface): Every word the panel shows, in the game's language.
- `LeaderboardEntryView` (interface): One row of a board, as the host gives it; `isMe` marks the player.
- `LeaderboardPanel` (const): A board's rows, or why there are none (M5 spec §7): loading, entries (the player's row marked "you" in words, not only by colour), empty, unavailable and offline.
- `LeaderboardView` (type): What the panel shows: the rows, or why there are none.
- `LoaderOverlay` (const)
- `lockOverscroll(node)`: A Svelte action: `<div use:lockOverscroll>`.
- `measureGeometry(input)`
- `Modal` (const): A panel over the screen with a visible Close (M4 spec §4.12; the rules of FloorFifty `ui/components/Modal.svelte` at ac72660).
- `ModalProps` (interface): The props Modal and Sheet share.
- `NavDirection` (type)
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
- `Rect` (interface)
- `reducedMotion(win?)`: Whether the player has asked for less movement.
- `releaseStep(dx, dtMs, pageWidth)`: Pages to turn when a drag of `dx` px over `dtMs` is released: a swipe left is +1 (next).
- `RETRY_DELAYS_MS` (const): The wait before each retry; when they are spent, the image has failed.
- `RetryTimers` (type): The timers `watchImage` waits with; tests pass fakes.
- `retryUrl(src, attempt)`: The URL a retry asks for; attempt 0 is the first request, as given.
- `RotateHint` (const): The rotate hint (M4 spec §4.9, §7): over a game locked to one orientation (`GameSpec.orientation`) on a phone held the other way.
- `RotateHintCopy` (interface): The rotate hint's words.
- `ScreenFrame` (const)
- `ScreenKind` (type): A screen's kind (`ScreenDef.kind`): only `gameplay` may hide the pointer.
- `ScrollList` (const)
- `scrollWithin(element)`: Brings `element` into view by scrolling its nearest scroll box, never the document.
- `sendBack(doc)`: Sends Back as an Escape to wherever a dialog would hear it, and reports whether anything took it.
- `SettingsScreen` (const): The core Settings screen (M4 spec §4.8, M4-D8), laid out and behaving as FloorFifty's settings (`ui/components/SettingsPanel.svelte` in `PauseOverlay.svelte` at a28dc44; Owner 2026-10-18: "match the layout and function, not the style"): a dialog over the dimmed game, the same frame as Paused, so going between them reads as one dialog changing its view.
- `SettingsSection` (type): A section of the Settings screen: the screen's own snippet, or an extension's slot component.
- `SettingsTab` (interface): A tab of the Settings screen (FloorFifty's Settings and Controls): its label and its sections, in order.
- `SETTLE_DELAYS_MS` (const): When to measure again after a viewport event, in ms.
- `Sheet` (const): A Modal on the bottom edge at every form factor (M4 spec §4.12): the same scoping, Close and scroll region, where a thumb reaches the actions.
- `SHORT_MAX_HEIGHT` (const): At or below this many CSS px of layout height, a screen is short.
- `Sleeper` (type): Puts the game's sound to sleep while nobody can see it.
- `sleepWhenHidden(doc, sleeper, win?)`
- `Slider` (const): A number in a range (M4 spec §4.12): a labelled native `<input type="range">`, so the browser gives the arrow keys and the focus navigator's `adjust` steps it.
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
- `TouchTarget` (interface): A button's action and where it is drawn, for `nearestTarget`.
- `trimRows(shape, groups)`: The shape cut to the rows the largest group fills, so no page carries a row of empty slots.
- `UI_SLOT_NAMES` (const): The named places an extension may add UI (M1 shared contracts §2; M1.6 spec §3.7).
- `UiComponent` (type): What an extension puts in a slot: a Svelte component that takes no props.
- `UiSlotName` (type)
- `ViewportWindow` (interface): The parts of `window` the owner reads; a fake from `@mcthaydt/automata-testing` stands in for it in tests.
- `watchImage(src, onRetry, timers?)`: Probes `src` and, while it fails, hands `onRetry` each retry's URL to draw instead.
- `WheelPager` (class): A trackpad's horizontal wheel deltas, one page per gesture; `reset` when the gesture goes quiet.
- `wrapPage(index, count)`: `index` wrapped into `0..count - 1`, so paging past either end comes round.

### `import { … } from '@mcthaydt/automata-ui/testing'`

- `byTestId(id)`: The element a test id names; throws when the fixture has none, so a missing part fails loudly.
- `checkLayout(conditions, essentials)`: The checks every screen shares: the document never scrolls; every control is at least the target (primaries the primary target) at this scale, on screen unless in a declared scroll region, never under a reserved area or a touch button and never over the corner row; the corner row's controls and any `data-way-out` stay reachable (but under a modal dialog or an ErrorPanel that had to rise); no ActionBar wraps (level 3); no row (`[data-row]`) clips what it holds; and each of `essentials` is reachable without scrolling.
- `Conditions` (interface)
- `errorPanelFloor(panel)`: The least height any of an ErrorPanel's layouts needs, measured here rather than read from the panel, so a panel that misjudges its room cannot excuse itself (spec §3.4, §7).
- `publishConditions(root, size, variant)`: Measures and publishes the geometry for `size` under `variant`, as the owner would.
- `settleLayout()`: Waits until a freshly mounted fixture has finished laying out: fonts loaded, then two frames, so ResizeObserver callbacks (ActionBar's collapse, ScrollList's measure) and the re-layout they cause have run.
