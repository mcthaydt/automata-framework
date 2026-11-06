# Automata cheatsheet

> Every export of every published `@mcthaydt/automata-*` entry point, one line each, grouped by module (package). Generated from the API index by `pnpm cheatsheet` after `pnpm build`; do not edit by hand. `pnpm api-index` fails when this page is stale. Full signatures and doc comments: the API reference (`api.md`).

## `@mcthaydt/automata`

### `import { … } from '@mcthaydt/automata'`

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
- `ErrorCode` (type): One error code.
- `ErrorCodeSchema` (const): Checks an error code.
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
- `HostingSeams` (interface): Test seams.
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
- `runGame(game)`: Boots and runs the game: a failure draws the boot failure panel, and `shutdown` closes everything the runtime opened.
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
- `SettingsScreenCopy` (interface): The Settings screen's own words: its title, Back, the tabs and the overflow count.
- `settingsStore(settings, def)`: The booted store for `def`.
- `Sheet` (const): A Modal on the bottom edge at every form factor: the same scoping, Close and scroll region, where a thumb reaches the actions.
- `Sim` (interface): A running simulation, stepped with commands, that can snapshot, restore and hash its state.
- `SimContext` (interface): What a system's `run` receives each tick.
- `Slider` (const): A number in a range: a labelled native `<input type="range">`, so the browser gives the arrow keys and the focus navigator's `adjust` steps it.
- `Split` (const): Two panes side by side where both fit at `min` px, stacked otherwise.
- `sprite(source, options?)`: A sprite that follows its component's `x`, `y` and `angle`, interpolated between ticks.
- `SpriteFrames` (interface): The texture is a sheet of equal frames, read left to right, top to bottom.
- `SpriteViewOptions` (interface): A `sprite` view's anchor and either its sprite-sheet frames or one frame of a packed atlas.
- `startGame(game)`: Boots a game: `defineGame`'s defaults over the runtime, the Pixi renderer, Ruken hosting and the default screens, then the runtime's boot on the game's root.
- `StepResult` (interface): What one `step` produced: the new tick, the events emitted, the renderer's delta and the commands that were rejected.
- `STICKY_MARGIN_PX` (const): How far outside a button a thumb still counts for it, in CSS pixels.
- `SubscriptionEntitlement` (interface): One subscription the player holds.
- `suppressPageGestures(doc)`: Turns off the browser's document gestures over the game.
- `SystemDef` (interface): A system: a name, the phase it runs in, the systems it must run `before` or `after` within that phase, and its `run`, called once per tick.
- `TAURI_MARKERS` (const): String literals only Tauri's IPC code contains, which survive minification: the global the webview injects (`@tauri-apps/api/core`) and the process plugin's exit command (`@tauri-apps/plugin-process`).
- `Time` (interface): The time service: whether the sim is paused, and why; each reason pauses until it is resumed.
- `Toast` (const): A passing message: "Pad connected", "Saved", "This controller is not supported".
- `Toggle` (const): An on/off setting: a native checkbox with the switch role, so the browser gives Space and the focus navigator's `adjust` flips it.
- `TouchButton` (interface): One on-screen touch button: every key bound to the same payload shares it.
- `TouchControls` (const): The on-screen touch buttons, from FloorFifty `ui/components/TouchControls.svelte` at `ac72660`.
- `Translate` (type): The typed `t` verb: `t('hello', { name })`, checked against the game's compiled messages.
- `turnUnitsFromPixels(dxPx, degPerPixel, invert)`: `dxPx` dragged at `degPerPixel` as whole turn units: positive for a drag to the right (which way that turns the heading is the game's convention), negated when `invert`, clamped to ±`MAX_TURN_UNITS_PER_STEP`.
- `typedBus(bus)`: Cast a PresentationBus instance to a typed view with game-specific fact types.
- `ViewportWindow` (interface): The parts of `window` the owner reads; a fake from `@mcthaydt/automata/testing` stands in for it in tests.

### `import { … } from '@mcthaydt/automata/extension'`

- `defineExtension(def)`: Returns its argument.
- `ExtensionDef` (interface): One opt-in feature of a game.
- `ExtensionError` (class): A bad extension list.
- `GameConfig` (type): The parts of the game config an extension may read (content's `GameConfig`).
- `ResolvedExtensions` (interface): Everything the runtime and the build tools need from a game's extension list, in one fixed order.
- `resolveExtensions(defs)`: Checks the list and puts it in a fixed order.
- `RukenManifestContribution` (type): What an extension may add to ruken.toml: preload files.

### `import { … } from '@mcthaydt/automata/testing'`

- `byTestId(id)`: The element a test id names; throws when the fixture has none, so a missing part fails loudly.
- `checkLayout(conditions, essentials)`: The checks every screen shares: the document never scrolls; every control is at least the target (primaries the primary target) at this scale, on screen unless in a declared scroll region, never under a reserved area or a touch button and never over the corner row; the corner row's controls and any `data-way-out` stay reachable (but under a modal dialog or an ErrorPanel that had to rise); no ActionBar wraps (level 3); no row (`[data-row]`) clips what it holds; no control is cut at the side of the scroll region it scrolls in (`findCutAtSide`: a region declared `data-scroll-region="both"` scrolls sideways too), and no control's words run past its edge; and each of `essentials` is reachable without scrolling.
- `Conditions` (interface): The conditions a layout test runs under: the geometry published for a size and variant, and the regions that cover the page (the keyboard, Ruken's strip), which nothing may sit under.
- `describeHostingContract(name, create, settled)`: Registers the `Hosting` contract's cases as a Vitest `describe` block named after `name`.
- `documentScrolls(doc)`: The document itself never scrolls; screens scroll inside declared regions.
- `errorPanelFloor(panel)`: The least height any of an ErrorPanel's layouts needs, measured here rather than read from the panel, so a panel that misjudges its room cannot excuse itself (spec §3.4, §7).
- `FakeAudioContext` (interface): A recording stand-in for an `AudioContext`: what was started, stopped and automated, with a clock tests move by hand.
- `fakeAudioContext(decode?)`: `decode` turns the bytes `decodeAudioData` receives into a buffer, or throws as the browser does for bytes that are not audio; by default the bytes are the alias's UTF-8 text.
- `fakeBuffer` (const): A decoded buffer that remembers the alias it came from, so `started` can name it.
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
- `findCutAtSide(root)`: No control is cut at a side of a declared scroll region that clips it (see `clippedBy`).
- `findIntrusions(root, rects)`: No visible control intersects a reserved area (Ruken's strip, a keyboard), in viewport px, by its whole box.
- `findOffscreenControls(root)`: Every visible control is on screen, unless a declared scroll region (`[data-scroll-region]`) clips it (see `clippedBy`): a fixed control, or one positioned outside the region, is judged where it is drawn, since scrolling the region would never bring it into view.
- `findOverlaps(a, b)`: Two elements' boxes do not overlap.
- `findSmallTargets(root, min, minPrimary)`: Every visible control is at least `min` square, and a primary (`data-kind="primary"`) at least `minPrimary` tall.
- `findUnreachable(elements)`: Each element is fully inside the viewport, and the whole of it is in view: a tap at its centre and at the middle of each edge lands on it or inside it, so nothing covers or clips any part.
- `hostDisplay(options?)`: Ruken's display metrics for a hosted game.
- `HostingFactory` (type): An adapter under test: a fresh `Hosting` per case, with `saves` granted.
- `installFakeResizeObserver()`: Replaces the global `ResizeObserver` with a fake that reports only the widths you give it, for components measured under jsdom, which has no layout.
- `LayoutRect` (interface): Layout assertions as plain DOM functions (M1.6 spec §3.10), from FloorFifty's `tests/e2e/support/layout.ts` at 122a220 (`expectReachable`, `expectControlsFit`, `expectRowsWhole`, `expectApart`, `expectNoDocumentScroll`).
- `ManualFrames` (interface): A frame source a test drives: `advance` moves time on and runs the frame asked for, if any.
- `manualFrames(startMs?)`: A frame source that runs a frame only when a test advances it, starting at `startMs`.
- `MountedFixture` (interface): A mounted Svelte fixture: the element it was mounted into and a way to unmount it.
- `mountFixture(component, props, target?)`: Mounts a Svelte component with the given props and no renderer or host, and flushes effects so the first render is finished.
- `nullRenderer(log?, options?)`: A renderer that draws nothing and records each call in `log`, for runtime tests without a GPU.
- `NullRendererEntry` (type): One call `nullRenderer` recorded.
- `NullRendererOptions` (interface): Options for `nullRenderer`: `fail` makes it fail `RendererUnavailable`.
- `openRuntimeTest(options?)`: Boots the runtime for screen and integration tests, as `runGame` does but without the loader or failure panel: `openHostingTest` behind the scenes, page layers and geometry, the settings, the save, the services, and the flow started when there are screens.
- `pressedPart(control)`: What a player presses for `control`: a checkbox's or radio's label (the theme draws it as the control, and a press anywhere on it toggles the input), else the control itself.
- `publishConditions(root, size, variant)`: Measures and publishes the geometry for `size` under `variant`, as the owner would.
- `REFERENCE_SIZES` (const): The viewports a layout is checked at: phones in both orientations, tablets, desktops, both sides of every breakpoint and the tightest sizes, each with the classification it should get.
- `ReferenceFormFactor` (type): The geometry owner's `FormFactor`.
- `ReferenceHeightTier` (type): The geometry owner's `HeightTier`.
- `ReferenceSize` (interface): One viewport every primitive and screen is checked at: a name, its size, and the form factor and height tier it must classify as.
- `RuntimeTestOptions` (interface): What `openRuntimeTest` boots: the fake host, the screens, content, settings and save, and the frames, renderer, fetch and locale it uses.
- `RuntimeTestSession` (interface): A booted runtime over the fake Ruken host: every service a screen reads, the host's handle and the page layers.
- `Settle` (type): Lets the fake Ruken host answer over its in-memory ports (for example one macrotask).
- `settleLayout()`: Waits until a freshly mounted fixture has finished laying out: fonts loaded, then two frames, so ResizeObserver callbacks (ActionBar's collapse, ScrollList's measure) and the re-layout they cause have run.
- `Submission` (interface): One leaderboard submission the host received.
- `textSnippet(text, tag?, trusted?)`: A Svelte 5 snippet rendering `<tag>text</tag>`, so a test can pass `children`, `body` or an icon to a component without writing a wrapper component (Ruken `packages/ui/src/test-snippets.ts`).
- `TIGHT_SIZES` (const): Sideways phones shorter than 780x270, where an open keyboard leaves the least room (framework audit of #7, 2026-10-11).
- `TrackedEvent` (interface): One analytics event the host received.
- `Variant` (interface): A condition layered over a reference size.
- `VARIANTS` (const): The conditions each size is also checked under: at rest, with the on-screen keyboard open, with Ruken's reserved strip on the right or the left, and at its TV scale.
- `visibleControls(root)`: Controls a player could see and reach: laid out, not hidden, not in an inert subtree.
- `withRuntimeTest(program, options?)`: Runs `program` on an open runtime and always closes it.

### `import { … } from '@mcthaydt/automata/tooling'`

- `isDefinedGame(value)`: Whether `value` came from `defineGame`.

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

## `@mcthaydt/automata-sim`

### `import { … } from '@mcthaydt/automata-sim'`

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
- `ReplayFormatError` (class): Bytes that are not a valid `.replay`.
- `ReplayHeader` (interface): The facts a replay needs before it plays: tick rate, seed, the schema and content hashes it was recorded against, where it starts and how often it checks.
- `ReplayRecordError` (class): A recording that cannot be exact: the sim stepped outside the recorder, a payload that is not JSON, and so on.
- `ReplayStepper` (interface): A replay playing back one tick at a time on its own sim.
- `ReplayStepSetup` (interface): What a stepper needs to rebuild the recorded sim: the same `plugins` and `content` the recording sim had.
- `unpackReplay(bytes, compression, options?)`: Inflates `.replay` file bytes and decodes them.

### `import { … } from '@mcthaydt/automata-sim/testing'`

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

### `import { … } from '@mcthaydt/automata-sim/testing/commands'`

- `goldenCommands(options?)`: The Vitest browser commands that let golden tests read golden files in a browser: register them with `browser: { commands: goldenCommands() }`.
- `GoldenCommandsOptions` (interface): Options for {@link goldenCommands}.

### `import { … } from '@mcthaydt/automata-sim/testing/property'`

- `RoundTripFailure` (interface): One case whose restored run differed from the uninterrupted one: its number, sim seed, length, restore tick, variant and a report of what differed.
- `RoundTripOptions` (interface): What `snapshotRoundTripProperty` runs: the plugins, content and a command script, and how many cases of what length to try.
- `RoundTripVariant` (type): How a case restores: into a `fresh` sim, or into one that has `dirty` (stepped on past the snapshot).
- `snapshotRoundTripProperty(options)`: Checks that snapshot, restore and continue equals an uninterrupted run, over many seeds, run lengths and restore points, alternating fresh and dirty restores.

## `@mcthaydt/automata-tools`

### `import { … } from '@mcthaydt/automata-tools'`

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
- `Files` (interface): The service's tag.
- `FilesLive` (const): `Files` on `node:fs`: synchronous calls wrapped in `Effect.try`, so the first failure surfaces as a `FileError`.
- `FilesService` (interface): The file operations build-time code needs, each as an Effect.
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
- `ITCH_FIRST_PUSH_CHECKLIST` (const): The one-time page settings butler cannot make, printed after a channel's first push.
- `ITCH_LIMITS` (const): itch.io's documented limits for an HTML5 upload; "MB" is read as 10^6 bytes.
- `ITCH_LIMITS_SOURCE` (const): Where itch.io's limits were read, and when.
- `ItchBuildInvalid` (class): The build breaks one of itch.io's rules; each problem names the file and the limit.
- `ItchCheck` (type): The `prepare --target itch` check that failed, in the order they run.
- `ItchConfig` (interface): What a game writes in `ship.config.ts`.
- `itchConfigSchema` (const): Checks a game's `itch` section: `project` is `user/game` in lower case, and `channel` defaults to `html5`.
- `ItchDownloadsMissing` (class): `publish --target itch --from tauri` found no desktop bundle of this version; found before any push.
- `ItchSettingMissing` (class): `publish --target itch` lacks the config section, the key or butler; found before anything runs.
- `ItchSettings` (interface): The checked settings, with the channel filled in.
- `keysBindingsIn(file, code)`: What the `keys()` calls in one source file bind, one `<file>:<line>:<col> keys` entry per call (and `pad` and `gestures` entries where it binds them); empty when the file has no call; `undefined` when it does not parse (its typecheck already fails, and a half-read tree could name a device that is not there).
- `ManifestInputsMismatch` (class): `runtime.inputs` disagrees with the game's input bindings.
- `ManifestInvalid` (class): Ruken's parser refused the generated `ruken.toml`.
- `OrientationMismatch` (class): The game plays in an orientation its ship config's `runtime.orientation` does not send Ruken.
- `OrientationMismatchFound` (interface): A game that plays in an orientation its ship config does not declare.
- `parseEnvFile(file, text)`: The variables of one `.env` file: `KEY=value` lines, with `export`, quotes and `#` comments allowed.
- `PIXI3D_EXTRAS_MARKERS` (const): Strings only
- `PIXI3D_MARKERS` (const): Strings only
- `Pixi3dExtrasInBuild` (class): A build contains `@pixi/3d/extras`, whose particle code probes `new Function` at load, which a no-eval CSP refuses.
- `Pixi3dFound` (interface): One script that carries a marker.
- `Pixi3dInPublicBuild` (class): A build for a public target (Ruken's store, itch.io) contains `@pixi/3d`, a closed beta.
- `PlayedOrientation` (interface): An orientation a `defineGame` call plays in, at the literal's opening quote (or at the call, when it is left out).
- `portsFor(checkoutPath, env)`: The ports a checkout's test server and preview build listen on (FloorFifty `playwright.config.ts`).
- `prepareBuild(input)`: Makes a built folder ready for `ruken publish` and the dev host: checks the tag, the entry page, root-absolute paths, secrets, `@pixi/3d`, the leaderboards the game names and the orientation it plays in and the devices its `keys()` calls bind, then writes `ruken.toml` once Ruken's parser accepts it.
- `PrepareInput` (interface): What `prepareBuild` checks and writes into: the built folder, the ship config, and the optional release tag, game folder and input bindings.
- `prepareItch(input)`: Makes a built folder ready for itch.io: the tag, root-absolute paths, secrets (a page on itch.io is public, so the build is scanned as Ruken's is), `@pixi/3d`, `index.html`, itch.io's limits, reference case and a stray `ruken.toml` are checked in that order, and the first that fails stops prepare before anything is written.
- `PrepareItchInput` (interface): What `prepareItch` checks and zips: the built folder, the ship config and the release tag.
- `prepareTauri(input)`: Builds the desktop bundles for this OS.
- `PrepareTauriError` (type): Every way `prepareTauri` can fail, each before or instead of writing bundles.
- `PrepareTauriInput` (interface): What `prepareTauri` builds: the web build, the game's folder, its config, and the release tag.
- `PrivatePublishNotLocal` (class): `publish --private` named a Ruken that is not the local stack: a private build stays local.
- `ProcessError` (class): A program could not be started (not found, not executable).
- `ProcessRunner` (interface): The service's tag; see `Files` for why it is not a `Context.Tag` class.
- `ProcessRunnerLive` (const): `ProcessRunner` on `node:child_process`: the real programs, with the parent's environment plus `RunOptions.env`.
- `ProcessRunnerService` (interface): Runs a program with arguments and no shell.
- `PublishAuth` (class): Exit 3: the token was missing, wrong or lacks the rights.
- `publishBuild(input)`: `ship publish` for Ruken: prepare the build, then hand it to Ruken's own CLI.
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
- `rukenHeaders(config, target)`: The headers Ruken serves a game's build with (Ruken's CSP, which allows no eval), from the game's config, for a game's `vite preview` or a dev host (the game imports no `@ruken/*` itself).
- `RukenHeaderTarget` (type): Where the headers are for: Ruken's production site, or a page on the given origins that frames the game.
- `rukenToml(config)`: The text of `ruken.toml` (Ruken manifest schema 1) for a ship config.
- `RunOptions` (interface): How a program is started: its working folder, extra environment, stdin, and whether its output is also echoed.
- `RunResult` (interface): What a finished program left: its exit code (128 when a signal killed it) and everything it wrote to stdout and stderr, decoded as UTF-8.
- `scanTextForSecrets(file, text, envValues)`: Every secret in one file's text.
- `SecretFound` (interface): A secret the bundle scan found in a built file, located without repeating the secret.
- `SecretInBuild` (class): The build holds a key, an `.env` value or a high-entropy string.
- `SHIP_PACKAGE` (const): The name this package is published under.
- `ShipConfig` (interface): What a game tells ship about itself: the game config every target reads (`@mcthaydt/automata-content`'s `GameConfig`) and each target's own section.
- `ShipInputBindings` (interface): What ship reads of a game's input profile. ship is published and the profile's owner (`runtime`) is private, so this is the read-only subset ship consumes, not a copy of the contract: a profile's `bindings` is assignable to it.
- `TaggedErrorClass` (type): The class `Data.TaggedError(tag)` returns, written out. isolatedDeclarations cannot infer the type of a call in an `extends` clause, so each error extends a constant annotated with this type instead (the pattern of `content`'s compile errors and `host`'s errors).
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
- `UndeclaredBoard` (class): The game names a leaderboard its ship config's `leaderboards` does not declare.
- `UndeclaredBoardFound` (interface): A board the game's sources name that its ship config does not declare, at the call site.
- `VersionMismatch` (class): A release tag that is not `v<version>`.

### `import { … } from '@mcthaydt/automata-tools/e2e'`

- `Direction` (type): A direction on the D-pad or the stick.
- `Engine` (type): The browser engine a matrix cell runs in.
- `FakePad` (class): One standard controller in a real browser, driven through the Gamepad API the game itself reads.
- `FakePadOptions` (interface): How the fake pad reports itself: its mapping and its id (the id picks the prompts' glyphs).
- `flick(scope, from, dy, ms)`: A quick vertical swipe of `dy` pixels within `ms` milliseconds from `from` (the gesture tests use 40 px in 180 ms).
- `hold(target, until)`: A finger down on `target`'s centre until `until` resolves true (checked once a frame), then up.
- `INPUT_MATRIX` (const): The matrix's cells, in table order: 17 cells, 22 journeys (the desktop cells run under both hosts).
- `InputDevice` (type): The device a matrix cell plays with.
- `MatrixCell` (interface): One cell of the input × form-factor matrix: a form factor, a device and an engine, and the hosts it runs under.
- `MatrixFormFactor` (type): A matrix cell's form factor, each with one viewport.
- `MatrixHost` (type): Where a journey runs: under the fake Ruken host, or standalone.
- `PAD_BUTTONS` (const): The standard mapping's buttons by name: south (A on an Xbox pad) is 0, Start is 9, the D-pad 12 to 15.
- `PadButton` (type): A standard-mapping button by name.
- `PadMode` (type): Whether a direction is held on the D-pad or the left stick.
- `Point` (interface): A point in the target frame's own CSS pixels.
- `swipe(scope, from, to, ms)`: A finger from `from` to `to` over `ms` milliseconds, one move a frame, on whatever is under it.
- `tap(target)`: A finger down on `target`'s centre and straight up again.
