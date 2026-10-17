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

- `BUILD_ID_PATTERN` (const): A build's ID on the dev host: the commit's UTC time to the minute, then its short sha, for example `202610111205-abcdef0` (FloorFifty `deploy/bin/build-tag`).
- `buildIdFor(commit)`
- `checkManifest(toml)`: Checks `ruken.toml` text with Ruken's own parser, so AF accepts exactly what Ruken accepts.
- `checkVersion(version, tag)`: A release's version must be its tag's (FloorFifty `deploy/tools/ruken-pack.ts`): the build Ruken shows as 0.10.2 is the one tagged v0.10.2.
- `defineShipConfig(config)`: Identity function that gives a game's `ship.config.ts` type checking and editor completion.
- `deployDev(input)`
- `DeployDevInput` (interface)
- `DeployFailed` (class): The dev host's deploy step (tar or ssh) failed; `output` is what it printed.
- `EntryMissing` (class): `[game] entry` names a file the build does not have.
- `EnvValue` (interface): One variable read from a game's `.env*` files, whose value the bundle scan looks for in the build.
- `FileError` (class): Reading, writing, listing or removing a file failed.
- `findRootAbsoluteReferences(distDir)`
- `findSecretsInBuild(distDir, envValues)`: Every secret in a built folder.
- `ManifestInvalid` (class): Ruken's parser refused the generated `ruken.toml`.
- `parseEnvFile(file, text)`: The variables of one `.env` file: `KEY=value` lines, with `export`, quotes and `#` comments allowed.
- `portsFor(checkoutPath, env)`: The ports a checkout's test server and preview build listen on (FloorFifty `playwright.config.ts`).
- `prepareBuild(input)`: Makes a built folder ready for `ruken publish` and the dev host (ship spec §3.3): checks the tag, the entry page, root-absolute paths and secrets (QB-b), then writes `ruken.toml` once Ruken's parser accepts it.
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
- `testRemote(input)`
- `TestRemoteFailed` (class)
- `TestRemoteInput` (interface)
- `TestRemoteReason` (type): Why `test-remote` stopped without a green run.
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
- `classifyDevice(input)`
- `classifyFormFactor(width, height)`
- `classifyHeightTier(height)`
- `CollapseLevel` (type)
- `collapseLevel(available, widths)`: The first level whose one-row width fits.
- `COMPACT_MAX_HEIGHT` (const): Below this, compact: what a browser leaves a sideways phone (780 x 270 Chrome on a Galaxy, 667 x 320 Safari on an SE).
- `CornerControls` (const)
- `createGeometryOwner(options)`
- `DeviceClass` (type)
- `Dialog` (const)
- `ErrorAction` (interface): One way forward from a failure (M1.6 spec §3.4).
- `ErrorCode` (type): Ruken's error code.
- `ErrorPanel` (const)
- `FocusNavigator` (class)
- `FormFactor` (type): The four form factors (M1.6 spec §3.1; from FloorFifty `ui/form-factor.ts` at 122a220).
- `FullscreenSupport` (type): Ruken's answer to whether this browser can go fullscreen, and how.
- `GateInputs` (type)
- `Geometry` (interface)
- `GeometryInput` (interface)
- `GeometryOwner` (interface)
- `GeometryOwnerOptions` (interface)
- `GeometryState` (interface): The current geometry as rune state: reading `current` in a component or `$derived` tracks it.
- `HeightTier` (type): The height tiers (M1.6 spec §3.1; from FloorFifty `ui/height-tier.ts` at 122a220).
- `HiddenBrowserBar` (class)
- `HostDisplay` (type): What the host says about the display: the parts of Ruken's `display.metrics` the geometry reads.
- `HostKind` (type): `Hosting['kind']` (shared contracts §1.1), written out until packages/host lands.
- `hostReservedInsets(host)`: Ruken reserves a strip on one edge; its width is the rect's, never negative (FloorFifty `reservedOf`).
- `InputMethod` (type): The input method the player last used, app-wide.
- `InputMethodTracker` (class)
- `Insets` (interface): CSS px on each side, all >= 0.
- `installGlobalErrorHandlers(win, onFatal, onRejection?)`: Installs once per window; a second call is a no-op.
- `isDuckDuckGo(nav)`: DuckDuckGo names itself only in the client-hint brands, not the user agent.
- `landscapeGate(inputs)`
- `LandscapeGateState` (type): Nothing; a tap to go fullscreen; or turn upright / add to the Home Screen.
- `LoaderOverlay` (const)
- `lockOverscroll(node)`: A Svelte action: `<div use:lockOverscroll>`.
- `measureGeometry(input)`
- `NavDirection` (type)
- `PAD_FOCUS` (const): How the navigator focuses: with a ring, and without scrolling the page.
- `padKeyEvents` (const): Keydown events the navigator sent itself.
- `pastEdge(scroller, dy)`: Whether a drag of `dy` (positive = finger moving down) would pass an edge.
- `PHONE_LANDSCAPE_MAX_HEIGHT` (const): A landscape viewport shorter than this is a phone, or a desktop window short enough to need the phone's compact layout.
- `PHONE_PORTRAIT_MAX_WIDTH` (const): A portrait viewport narrower than this is a phone; at or above it, a tablet.
- `probeEnvSafeArea(root)`: Reads `env(safe-area-inset-*)` through a hidden probe, since script cannot read `env()` directly.
- `Rect` (interface)
- `reducedMotion(win?)`: Whether the player has asked for less movement.
- `RETRY_DELAYS_MS` (const): The wait before each retry; when they are spent, the image has failed.
- `RetryTimers` (type): The timers `watchImage` waits with; tests pass fakes.
- `retryUrl(src, attempt)`: The URL a retry asks for; attempt 0 is the first request, as given.
- `ScreenFrame` (const)
- `ScrollList` (const)
- `scrollWithin(element)`: Brings `element` into view by scrolling its nearest scroll box, never the document.
- `SETTLE_DELAYS_MS` (const): When to measure again after a viewport event, in ms.
- `SHORT_MAX_HEIGHT` (const): At or below this many CSS px of layout height, a screen is short.
- `Sleeper` (type): Puts the game's sound to sleep while nobody can see it.
- `sleepWhenHidden(doc, sleeper, win?)`
- `suppressPageGestures(doc)`: Turns off the browser's document gestures over the game.
- `tabbables(root)`: Everything Tab can reach under `root`, in DOM order: not disabled, inert or hidden.
- `Timers` (interface): Injected so tests drive the settle delays with fake timers.
- `UI_SLOT_NAMES` (const): The named places an extension may add UI (M1 shared contracts §2; M1.6 spec §3.7).
- `UiComponent` (type): What an extension puts in a slot: a Svelte component that takes no props.
- `UiSlotName` (type)
- `ViewportWindow` (interface): The parts of `window` the owner reads; a fake from `@mcthaydt/automata-testing` stands in for it in tests.
- `watchImage(src, onRetry, timers?)`: Probes `src` and, while it fails, hands `onRetry` each retry's URL to draw instead.

### `import { … } from '@mcthaydt/automata-ui/testing'`

- `byTestId(id)`: The element a test id names; throws when the fixture has none, so a missing part fails loudly.
- `checkLayout(conditions, essentials)`: The checks every screen shares: the document never scrolls; every control is at least the target (primaries the primary target) at this scale, on screen unless in a declared scroll region, never under a reserved area and never over the corner row; the corner row's controls and any `data-way-out` stay reachable (but under a modal dialog or an ErrorPanel that had to rise); no ActionBar wraps (level 3); no row (`[data-row]`) clips what it holds; and each of `essentials` is reachable without scrolling.
- `Conditions` (interface)
- `errorPanelFloor(panel)`: The least height any of an ErrorPanel's layouts needs, measured here rather than read from the panel, so a panel that misjudges its room cannot excuse itself (spec §3.4, §7).
- `publishConditions(root, size, variant)`: Measures and publishes the geometry for `size` under `variant`, as the owner would.
- `settleLayout()`: Waits until a freshly mounted fixture has finished laying out: fonts loaded, then two frames, so ResizeObserver callbacks (ActionBar's collapse, ScrollList's measure) and the re-layout they cause have run.
