# @mcthaydt/automata-render-pixi

## 0.0.5

### Patch Changes

- de363d9: The packages are MIT licensed: each has `"license": "MIT"` and a `LICENSE` file. Third-party code, fonts and artwork
  keep their own terms; see `LICENSE-SCOPE.md` in the repository.
- Updated dependencies [6d60a91]
- Updated dependencies [b112a01]
- Updated dependencies [bb98b8b]
- Updated dependencies
- Updated dependencies [de363d9]
- Updated dependencies [ad11ae6]
- Updated dependencies [94d3212]
  - @mcthaydt/automata-ui@0.0.5
  - @mcthaydt/automata-runtime@0.0.5
  - @mcthaydt/automata-sim@0.0.5

## 0.0.4

### Patch Changes

- 2ff17aa: First publish of the runtime, the Pixi renderer, the game package and the umbrella (DX.2a), so a game, and Automata
  Plus, can install them. Each ships `dist` only, `svelte` and `pixi.js` are caret peers, and every export has a doc
  comment. The runtime's Svelte rune modules stay files of their own (`*.svelte.js`) and it ships Ruken's types, not
  its code; the game package ships its screens as Svelte source under the `svelte` condition and bundles the one Ruken
  value it uses (D-8, listed in its `VENDORED.md`).
- 992b7f5: BREAKING: `@mcthaydt/automata-render-pixi` no longer exports `VERSION` (it said `0.0.1` and nothing read it); the
  package's version is its `package.json`'s.
- Updated dependencies [2ff17aa]
- Updated dependencies [66fe89d]
- Updated dependencies [7af981d]
- Updated dependencies [eb734a4]
- Updated dependencies [263d3e0]
- Updated dependencies [3c965f8]
- Updated dependencies [7f2c27c]
- Updated dependencies [1fa16c8]
- Updated dependencies [2687799]
- Updated dependencies [79457ff]
- Updated dependencies [e0fe104]
  - @mcthaydt/automata-runtime@0.0.4
  - @mcthaydt/automata-ui@0.0.4
  - @mcthaydt/automata-sim@0.0.4
