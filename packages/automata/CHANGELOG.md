# @mcthaydt/automata

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
