---
'@automataframework/framework': patch
'@automataframework/feel': patch
'@automataframework/audio-synth': patch
---
A game can play its own audio: `defineGame({ audio })` hands it the game's `Audio` and presentation bus, and `@automataframework/audio-synth/stage` plays the event map's sounds and the music its rules pick from imported tracks. `mergeStageHooks` is exported from `@automataframework/framework/game`, and the render consumer can hold a view still (`hold`, `viewOf`). Feel's stage now plays hit-stop, squash and words, shakes through the world's pivot so a camera that places the world is left alone, and reports each drawn frame (`onFrame`).
