# @automata/debug

## 0.1.0

### Patch Changes

- 183414a: `forwardEvents` lets an editor that frames the game hear its sim events (Schematic's Watch shows which mode each character is in). The game posts only the events the editor's address names, only to the origin it names, and only when framed; the overlay turns it on when the game gave `installDebug` a bus. `installDebug` takes an optional `tickHz` for the times it posts.
- b6ebb01: The free extensions publish with the framework and share its version: physics, feel, audio-synth, debug, puzzle, net, net-ui, net-server and ui-screens. A game adds the ones it wants as `@automata/<name>`; none of them is imported by the framework itself.
- Updated dependencies [0676026]
- Updated dependencies [5386c34]
- Updated dependencies [019a89f]
- Updated dependencies [e6bf38e]
- Updated dependencies [1b83c1b]
- Updated dependencies [30e8765]
- Updated dependencies [4b4328b]
- Updated dependencies [4374fdd]
- Updated dependencies [7312642]
- Updated dependencies [ceb2a01]
- Updated dependencies [4835238]
- Updated dependencies [dac7515]
- Updated dependencies [c078373]
- Updated dependencies [deb1360]
- Updated dependencies [f863ad0]
- Updated dependencies [6933104]
- Updated dependencies [551a11f]
- Updated dependencies [030110a]
- Updated dependencies [b6ebb01]
- Updated dependencies [f82f756]
- Updated dependencies [b859238]
- Updated dependencies [12bda87]
- Updated dependencies [6c0ccee]
- Updated dependencies [b0f31b6]
- Updated dependencies [7dc3e29]
- Updated dependencies [f68d822]
- Updated dependencies [1f423dd]
- Updated dependencies [3565abc]
- Updated dependencies [77e5702]
- Updated dependencies [dd38dc7]
- Updated dependencies [9953006]
- Updated dependencies [2b7c322]
- Updated dependencies [d2e9d7f]
- Updated dependencies [5e86d02]
- Updated dependencies [4310b78]
- Updated dependencies [076ae04]
- Updated dependencies [0990eea]
- Updated dependencies [acbd16e]
- Updated dependencies [30667aa]
- Updated dependencies [5ee493d]
  - @automata/framework@0.1.0
  - @automata/audio-synth@0.1.0
  - @automata/feel@0.1.0
  - @automata/sim@0.1.0
