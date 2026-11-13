# @automata/feel

## 0.1.0

### Patch Changes

- 6933104: `@automata/feel` now asks for `pixi.js` with a caret (`^8.22.0`), as the other packages do. A game made with `create-game` now plays Feel and Audio: it comes with a starter feel and sound for the square bumping a wall, and its Feel and Audio editors change what it plays.
- b6ebb01: The free extensions publish with the framework and share its version: physics, feel, audio-synth, debug, puzzle, net, net-ui, net-server and ui-screens. A game adds the ones it wants as `@automata/<name>`; none of them is imported by the framework itself.
- f82f756: A game can play its own audio: `defineGame({ audio })` hands it the game's `Audio` and presentation bus, and `@automata/audio-synth/stage` plays the event map's sounds and the music its rules pick from imported tracks. `mergeStageHooks` is exported from `@automata/framework/game`, and the render consumer can hold a view still (`hold`, `viewOf`). Feel's stage now plays hit-stop, squash and words, shakes through the world's pivot so a camera that places the world is left alone, and reports each drawn frame (`onFrame`).
- b859238: New entry `@automata/feel/stage`: `feelStage` plays the feel table on a game's Pixi stage (shake, flash and tint, with the cues and rumbles handed to the game's own ports).
- Updated dependencies [0676026]
- Updated dependencies [5386c34]
- Updated dependencies [474d2f9]
- Updated dependencies [1b83c1b]
- Updated dependencies [30e8765]
- Updated dependencies [856e7eb]
- Updated dependencies [ee474b0]
- Updated dependencies [3357672]
- Updated dependencies [4b4328b]
- Updated dependencies [4374fdd]
- Updated dependencies [7312642]
- Updated dependencies [ceb2a01]
- Updated dependencies [b0f31b6]
- Updated dependencies [0500f40]
- Updated dependencies [4835238]
- Updated dependencies [dac7515]
- Updated dependencies [c078373]
- Updated dependencies [deb1360]
- Updated dependencies [f863ad0]
- Updated dependencies [fa85558]
- Updated dependencies [551a11f]
- Updated dependencies [030110a]
- Updated dependencies [f82f756]
- Updated dependencies [12bda87]
- Updated dependencies [6c0ccee]
- Updated dependencies [156126a]
- Updated dependencies [ceb2a01]
- Updated dependencies [b0f31b6]
- Updated dependencies [a66b4e0]
- Updated dependencies [7dc3e29]
- Updated dependencies [f68d822]
- Updated dependencies [3aef585]
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
  - @automata/content@0.1.0
  - @automata/sim@0.1.0
