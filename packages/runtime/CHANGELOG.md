# @mcthaydt/automata-runtime

## 0.0.4

### Patch Changes

- 2ff17aa: First publish of the runtime, the Pixi renderer, the game package and the umbrella (DX.2a), so a game, and Automata
  Plus, can install them. Each ships `dist` only, `svelte` and `pixi.js` are caret peers, and every export has a doc
  comment. The runtime's Svelte rune modules stay files of their own (`*.svelte.js`) and it ships Ruken's types, not
  its code; the game package ships its screens as Svelte source under the `svelte` condition and bundles the one Ruken
  value it uses (D-8, listed in its `VENDORED.md`).
- eb734a4: The runtime can run a 3D renderer (M3.4a). `RendererFactory` may fail with `ModelInvalid { file, reason }`, a model file the renderer could not read, which boot shows as the `model-invalid` panel with Try again (`BootError` carries it). `RenderTarget.reportLost` shows the "picture stopped" panel for a graphics context that does not come back, and Try again rebuilds the renderer from the sim's state (M3 spec §5); `RuntimeFacts` gains the context facts. `GameDefinition.preload` and `GameSpec.preload` list files the preload screens fetch before the renderer starts, kept out of the content and its hash. `GameSpec.createRenderer` makes the renderer from the Pixi options `defineGame` built, so an extension's renderer (render-pixi3d) can draw the game; it defaults to core's Pixi renderer.
  
  BREAKING: `RendererFactory`'s error now includes `ModelInvalid`, and `BootError`, `RuntimeFacts`, `RenderTarget`, `GameDefinition` and `GameSpec` gain members, so an exhaustive `switch` over the boot error or the facts must add their cases. A 2D game that does not set the new options is unchanged.
- 79457ff: Inside a Ruken session, the boot-failure panel's Try again reloads the game's frame (the host answers one hello per frame load); standalone keeps the in-place retry. New `RuntimeSeams.reload`.
- Updated dependencies [66fe89d]
- Updated dependencies [2908b30]
- Updated dependencies [7af981d]
- Updated dependencies [263d3e0]
- Updated dependencies [3c965f8]
- Updated dependencies [7f2c27c]
- Updated dependencies [b15b260]
- Updated dependencies [1fa16c8]
- Updated dependencies [bb4e89d]
- Updated dependencies [2687799]
- Updated dependencies [e0fe104]
  - @mcthaydt/automata-ui@0.0.4
  - @mcthaydt/automata-content@0.0.4
  - @mcthaydt/automata-host@0.0.4
  - @mcthaydt/automata-sim@0.0.4
