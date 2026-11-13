# @mcthaydt/automata-sim

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

- 551a11f: The workspace's source entries of `@automata/content` (and the `@automata/sim` modules they reach) load under plain Node: relative imports name their `.ts` file, and the atlas error's field is no longer a parameter property. `automata check --only no-eval` now passes for a game inside the repository; a published install was never affected.
- 0990eea: `@automata/sim`'s root entry loads under plain Node: the snapshot and replay readers declare their byte field instead of taking it as a parameter property, which Node's type stripping cannot erase. The world kit's `automata-world-textures` command ran into it from the workspace's source; a published install was never affected.

## 0.0.5

### Patch Changes

- de363d9: The packages are MIT licensed: each has `"license": "MIT"` and a `LICENSE` file. Third-party code, fonts and artwork
  keep their own terms; see `LICENSE-SCOPE.md` in the repository.

## 0.0.4

No changes in this release.

## 0.0.3

### Patch Changes

- 00ca723: Add `definePlugin({ name, defs })`, which sorts one flat list of components, commands, events, resources and systems into the keyed lists, and the `defineSystem(name, run)` and `defineSystem(name, phase, run)` short forms (phase defaults to `gameplay`). Additive: existing plugins keep their schema hash.
- 25d5a68: Document `SystemSpec`, the object form of `defineSystem`.
- 0c84109: Document the sim's exports: the definition types and `define*` functions, `createSim` and the `Sim` types, the field and RNG types, the snapshot version and errors, the deterministic math functions, and the replay recorder, stepper and codec.
- 50ec5a9: Depend on `zod` 4.6.6: 4.6.5 and earlier carry GHSA-mrhx-c7xc-m3w5 (a high-severity memory exhaustion while validating oversized constrained collections), which the dependency audit now reports.

## 0.0.2

No changes in this release.

## 0.0.1

### Patch Changes

- c7ae066: First published build (M2.4): every package builds to `dist/` with tsdown (ui with svelte-package), bundles the
  vendored Ruken code it needs, and publishes to GitHub Packages. `check-boundaries` is now
  `@mcthaydt/automata-check-boundaries` with an `automata-check-boundaries` bin.
