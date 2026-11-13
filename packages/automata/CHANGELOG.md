# @mcthaydt/automata

## 0.1.0

### Minor Changes

- 12bda87: The first public release: the four packages are on npmjs.org, free to install with no sign-in. `npx @automata/tools create-game my-game` makes a small game that runs, with a level you can open in the editor, a test and its own release workflow.
  
  BREAKING: this release replaces everything published before it under `@mcthaydt/*`. The packages are now `@automata/framework`, `@automata/content`, `@automata/sim` and `@automata/tools`; the browser packages (host, runtime, render, ui, game, testing) are one package, and the build tools (ship, cli, node) are one package, `@automata/tools`. The browser runtime no longer uses Effect, `NetworkPort` and `AuthoritativeSnapshot` are gone, and the root entry of `@automata/framework` is smaller (600 names became 274). Change your imports and your `package.json` to the new names.
  
  - `automata editor` opens the 2D level editor and the Tuner, which shows your game beside its settings, with nothing else installed; it names the game it opened in plain words.
  - `automata check` runs the determinism and layout checker, and a `levels` step that fails when a level project and the game files saved from it disagree; `--only <step>` runs one step.
  - `automata ship prepare` and `publish` take `--target web|itch|tauri|ruken` and check a web build for secrets, inlined assets, `eval` and root-absolute paths.
  - `@automata/content` has `level-2d`, the 2D level format the editor writes and games read, two browser-safe entries (`schema`, `palette`), and tunables that may carry a `label`, `feel`, `unit` and `scale`. In dev, a content save updates the running game in place.
  - `@automata/framework` has plainer default screens and messages, `startGame(game, { at })`, and `checkLayout` targets for editors.
  - The messages and `--help` of every command say what to do next in plain words.

### Patch Changes

- 0676026: Doc comments that named the three 3D packages (the renderer, the figures and the sector format) now say they are one, `@automata/3d`. No behaviour changes.
- 5386c34: `@automata/framework/testing` now exports `fakeClock`, and `@automata/framework` exports `systemClock`, so a renderer can time a wait without Effect. `@automata/content` adds `compileContentResult` and `@automata/tools` adds `manifestOf` and `rukenHeadersOf`, plain-value forms of what the Effect API did.
- 1b83c1b: The layout checks that every screen's `checkLayout` runs now also fail a button that its bar cuts off (`findCutByBar`) and a bar button that something else covers (`findCovered`), judged for the controls inside `[data-region=topbar|rail|panel|dock|tools]` (`BAR_ACTIONS`). A modal dialog may cover a bar, and so may anything the caller excuses. `testing/fixtures` exports all three.
- 30e8765: The comments in the generated API reference say what each name does and why, not which project the code first came from.
- 4b4328b: A game's default controls can be data: `content/controls.toml` (the `controls` kind in `@automata/content/controls`) and `controlsFrom(command, file)` in the framework build the same input map `keys()` does.
- 4374fdd: A new game keeps its default controls in `content/controls.toml`, which the Tuner edits, and `@automata/framework` exports `keyLabel`, `padLabel` and `PROMPT_COPY` for showing key and button names.
- 7312642: `defineGame({ level: levelScene({ project, levels, images, start, live }) })` draws a 2D level the editor made (tiles, auto tiles, objects and placed characters) under the entity views. A tile with no picture shows as the editor's flat colour, and a missing picture or a tile past the set is reported in words that name the level.
- ceb2a01: The check mark, cross and turning arrow the default screens show (the dialog's close button, the chosen option, status chips, toasts and the rotate prompts, and the PlayStation cross prompt) are drawn as inline SVG instead of typed as text, so no game's font has to hold an icon.
- 4835238: The default screens (title, paused, settings, saves, scores), the boot and failure panels, the loading lines and the rotate and fullscreen prompts now speak English, Japanese, Korean, Latin American Spanish, Brazilian Portuguese and Simplified Chinese with no work from the game: the words are message catalogs (`@automata/framework/words/<language>.json`), chosen by the player's language, and a game's own `copy` still wins. All six catalogs ship in the bundle so a language switch is instant and works offline; the site playground's runtime grew by 13,090 bytes gzipped (404,364 to 417,454; budget 460,000).
- dac7515: On the desktop (`tauri`), a save that cannot be written to disk (a full disk, a read-only data folder) is no longer
  reported as saved: `savesStatus` turns `retry`, the write is tried again half a second later, and `saved` returns once
  one lands. A `flush` that fails is still refused `INTERNAL`, and says `retry` too.
- c078373: On the desktop (`tauri`), a save now reaches the disk half a second after the game's last change to it, one
  write per burst of changes, instead of only on Quit or a window close: an app that crashes or is killed keeps what the
  player did up to that moment.
- deb1360: On the desktop (`tauri`), the default title screen has a Quit button after Play (or after the save slots), as tall as
  Play, in every language the screens ship (`title_quit`). It quits the app through `Hosting.exit`, so the game's exit
  handlers and the save flush run first. The web, itch.io and Ruken titles are unchanged: there the browser or the host
  owns leaving.
  
  BREAKING: `ScreensCopy['title']` gains `quit` (the desktop title's Quit). A game that writes the whole `ScreensCopy`
  type by hand adds it; a game that passes partial `screens` words (the usual way) needs nothing.
- f863ad0: `PROMPT_COPY`, `STICK_DIRECTIONS` and `Picture` have doc comments: what each holds and where a game uses it, so the API index and the cheatsheet describe them.
- 030110a: Export the UI names an extension builds on: `UiComponent` and `UiSlotName` from `@automata/framework/extension`, and `ErrorPanel`, `ErrorAction`, `SettingsScreen` and `SettingsTab` from `@automata/framework`.
- f82f756: A game can play its own audio: `defineGame({ audio })` hands it the game's `Audio` and presentation bus, and `@automata/audio-synth/stage` plays the event map's sounds and the music its rules pick from imported tracks. `mergeStageHooks` is exported from `@automata/framework/game`, and the render consumer can hold a view still (`hold`, `viewOf`). Feel's stage now plays hit-stop, squash and words, shakes through the world's pivot so a camera that places the world is left alone, and reports each drawn frame (`onFrame`).
- 6c0ccee: The first run asks which language to use: a game that ships more than one language shows one screen before its title, every language in its own script with the one the device suggested focused, and one press goes on. It is skipped under a host that supplies the language (Ruken), when the player has already chosen, and once it has been shown on the device; `defineGame({ firstRunLanguage: false })` never shows it. The words are in `ScreensCopy.firstRun`, in all six languages.
- b0f31b6: Fixes to the shared polish: the Settings "+N more" badge no longer covers a row's words; the photosensitivity warning says the hazards the game declares (`photosensitivity: { effects }`); a `Modal` asks for the `open` and `close` interface sounds and the error panel for `error`; the warning's switches are headed "Make it gentler" (six languages); and a web page's `openLink` answers `opened: false` when the browser blocks the new tab, while cutting the tab's hold on the game at once.
- 7dc3e29: `Hosting` gains `openLink(url)`: a game opens a web page the way its host wants it done. Ruken asks the player first (the game adds `'links'` to `hosting.wants`), the web and itch targets open a new tab, and the desktop opens the player's own browser. Only `https:` addresses are opened, a host or player that says no is an answer (`opened: false`) and not an error, and the game is never navigated away. The web, itch and desktop targets grant `links` themselves. `@automata/framework/testing`'s `describeHostingContract` takes an optional `LinksProbe` to run the same link cases on an adapter, and `fakeHosting` records links and answers them. The generated desktop project registers Tauri's opener plugin and allows `https:` addresses only; `@tauri-apps/plugin-opener` is a new optional peer of `@automata/framework`, and `create-game` adds it for a game that builds for `tauri`.
- f68d822: Every control can sound without wiring: `defineGame({ uiSounds })` takes the interface's sounds by name (`press`, `back`, `focus`, `open`, `close`, `error`, or the game's own), as a map to assets or one function, and one listener on the game's root plays them on the interface bus, under its volume and mute. A control says otherwise with `data-sfx="back"` or `data-sfx="none"`, and a component with no press behind it asks with `requestUiSound`. Moving focus ticks softly (never faster than every 90 ms, never on top of a press, a scroll or a touch). Core marks its own Back, Close and Cancel buttons as leaving and its Mute and the touch buttons as silent. A game that maps nothing stays silent. `Toggle` takes an `sfx` name.
- 1f423dd: The layout contract's own browser test plants its sticky-badge overlap in a row that sets its line height, so the test no longer depends on the platform font's line height. `checkLayout` is unchanged.
- 3565abc: The letterbox takes an opt-in `scale` option (`renderer: { scale: 'whole' }`, also read by `createPixi3dRenderer`): the field is drawn at a whole number of device pixels per field pixel, centred and clipped to its own rectangle, so no pixel is drawn wider than another. The default, `'fit'`, is today's fractional scale to the view's width and changes no frame.
- 77e5702: `@automata/framework` exports the locale pieces a game with its own words needs: `bindWords` (keeps `data-word` and `data-word-label` elements of a plain-DOM panel in the player's language, and fills them again when it changes), `matchLocale` (the rule the runtime chooses a language by), `formatNumber` and `DEFAULT_LOCALES`. `@automata/ui-screens` and `@automata/net-ui` use `matchLocale` instead of their own copy of the rule.
- dd38dc7: A game can run an opening before its first screen: `defineGame({ opening: [step] })` takes steps that run in order after the host is ready, with the sim held, each in its own layer over the game (`OpeningStep`, `OpeningContext`). A step that throws is skipped, so an opening never blocks play, and the host's "Open game menu" does nothing until the first screen has entered. The first-run language, the warning and a studio splash are steps of it. Whether a first-run screen has been shown is kept once per device (`SeenFlags`).
- 9953006: The packed default Play screen found its play-context module again: the component imported it with `.svelte.ts` written out, which `svelte-package` leaves as it is, so a game's build from the packed package failed with an unresolved import. It is now imported without the extension, like the other `.svelte.ts` modules.
- 2b7c322: The locale tests compile their Paraglide fixture outside `src/`, so the package build no longer reads it while a test run is deleting it.
- d2e9d7f: A game that flashes can warn about it: `defineGame({ photosensitivity: true })` shows a flashing-lights warning on a device's first run, after the language screen and before anything plays, once per device. An object adds the game's own effect settings as switches (`WarningSwitch`: a game with `@automata/feel` passes its `reduceFlashing` and `intensity`), each applied the moment it is flipped; the device's reduced-motion setting is stated. Continue, Close and Escape all go on. The words are in `ScreensCopy.firstRun.warning`, in all six languages. `Toggle` is now positioned, so its hidden checkbox scrolls and clips with its label inside a scrolling region.
- 5e86d02: A character with an animation plays it: `pictureView` takes `clip` (the clip's name, read from the entity each frame) and a placed character in `levelScene` plays its first clip. A clip the character lacks keeps the one playing and is reported once.
- 4310b78: `pictureView(project, 'player-start', images)` draws an entity as its character looks in the editor: the tile Characters gave it, else its colour as its shape.
- 076ae04: The runtime's own words follow the language in force: the flow's (a slow load, a failed download), the display policy's (the landscape gate, the rotate hint and toast) and the lost-picture and boot-failure panels are chosen from the saved choice, the first-run pick or the host's language, then the browser's, and change when the language changes, where they were fixed at boot from the browser alone. `defineGame`'s `copy` may be a function of the locale, so a game can reword the runtime's words in each language.
- acbd16e: A component in the `hud.overlay` slot can call `usePlay()` (from `@automata/framework`) to read the running game, read-only, and to `send` it a command. A sent command joins the commands from the input map for the next tick, so a recording of that stream has it. `@automata/framework/testing` gains `mountInPlay` to mount a slot component in the real play screen in a test.
- 30667aa: A component in the published package that imports a `.svelte.ts` module now points at the `.svelte.js` file in `dist/`, so a game's bundler finds it (the play screen did not resolve in a packed install).
- 5ee493d: A screen's first control now gets focus on WebKit. WebKit drops `focus()` on a control that was added a moment ago, so the title screen could open with nothing focused and a keyboard or gamepad player could not press Play. The flow asks again on each display frame, for about half a second, until the control has focus or focus goes elsewhere.
- Updated dependencies [5386c34]
- Updated dependencies [474d2f9]
- Updated dependencies [30e8765]
- Updated dependencies [856e7eb]
- Updated dependencies [ee474b0]
- Updated dependencies [3357672]
- Updated dependencies [4b4328b]
- Updated dependencies [b0f31b6]
- Updated dependencies [0500f40]
- Updated dependencies [f863ad0]
- Updated dependencies [fa85558]
- Updated dependencies [551a11f]
- Updated dependencies [12bda87]
- Updated dependencies [156126a]
- Updated dependencies [ceb2a01]
- Updated dependencies [a66b4e0]
- Updated dependencies [3aef585]
- Updated dependencies [0990eea]
  - @automata/content@0.1.0
  - @automata/sim@0.1.0

## 0.0.5

### Patch Changes

- e6c5c3e: `keys()` takes an `analog` option (the sticks and the camera drag added to the held keys' payload), `InputMap` gains `touchStick` and `toCommand`'s optional third parameter, `TouchButton` an optional `side`, and the default play screen draws the camera-drag surface and the touch stick when the map asks for them.
  
  BREAKING: `InputMap` gains the required `touchStick` (only `keys()` and `inputs()` build one), `KeysOptions` gains the optional `analog`, `TouchButton` the optional `side`, and `ScreensCopy.play` gains the required `move` (the stick's accessible name; `DEFAULT_SCREENS_COPY` has it, a game that spells out the whole `play` object adds it).
- de363d9: The packages are MIT licensed: each has `"license": "MIT"` and a `LICENSE` file. Third-party code, fonts and artwork
  keep their own terms; see `LICENSE-SCOPE.md` in the repository.
- Updated dependencies [6d60a91]
- Updated dependencies [e6c5c3e]
- Updated dependencies [3abd0e6]
- Updated dependencies [de363d9]
  - @mcthaydt/automata-game@0.0.5
  - @mcthaydt/automata-sim@0.0.5

## 0.0.4

### Patch Changes

- 2ff17aa: First publish of the runtime, the Pixi renderer, the game package and the umbrella (DX.2a), so a game, and Automata
  Plus, can install them. Each ships `dist` only, `svelte` and `pixi.js` are caret peers, and every export has a doc
  comment. The runtime's Svelte rune modules stay files of their own (`*.svelte.js`) and it ships Ruken's types, not
  its code; the game package ships its screens as Svelte source under the `svelte` condition and bundles the one Ruken
  value it uses (D-8, listed in its `VENDORED.md`).
- 66fe89d: The default screens' words come from the game (DX.2d). `GameSpec.copy.screens` takes a part of the new `ScreensCopy`
  record, or a function of the locale that returns one, over the English defaults: Play, Pause, the paused menu and its
  quit confirm, every Settings group, the save slots and status, the board, and the unsupported-controller notice. The
  screens read it in the player's language and again on each change, without remounting. `TouchControls` now wraps a
  side whose labels do not fit on one row, and breaks a long label inside its button, so a longer language never pushes
  the touch row off screen.
- eb734a4: The runtime can run a 3D renderer (M3.4a). `RendererFactory` may fail with `ModelInvalid { file, reason }`, a model file the renderer could not read, which boot shows as the `model-invalid` panel with Try again (`BootError` carries it). `RenderTarget.reportLost` shows the "picture stopped" panel for a graphics context that does not come back, and Try again rebuilds the renderer from the sim's state (M3 spec §5); `RuntimeFacts` gains the context facts. `GameDefinition.preload` and `GameSpec.preload` list files the preload screens fetch before the renderer starts, kept out of the content and its hash. `GameSpec.createRenderer` makes the renderer from the Pixi options `defineGame` built, so an extension's renderer (render-pixi3d) can draw the game; it defaults to core's Pixi renderer.
  
  BREAKING: `RendererFactory`'s error now includes `ModelInvalid`, and `BootError`, `RuntimeFacts`, `RenderTarget`, `GameDefinition` and `GameSpec` gain members, so an exhaustive `switch` over the boot error or the facts must add their cases. A 2D game that does not set the new options is unchanged.
- 0670bfe: `inputs(...maps)` joins several `keys()` maps into one input map: each map sends its own command every tick, read from one Input over the merged bindings, with one set of touch buttons and one Controls section (a 3D game sends its move, lock and action buttons as separate commands). It throws on no maps, on two maps for one command, and on an action id, a key or a pad button two maps share.
- Updated dependencies [2ff17aa]
- Updated dependencies [66fe89d]
- Updated dependencies [eb734a4]
- Updated dependencies [0670bfe]
  - @mcthaydt/automata-game@0.0.4
  - @mcthaydt/automata-sim@0.0.4
