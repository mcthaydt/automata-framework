// `@af-examples/base-2d/game`: the base's whole game, for a demo that runs it with its own plugins, content
// and layers (startGame's options). A separate entry from the package root because the game loads Pixi, the
// screens and input; the root and ./sim stay light for Node code. bootPage and the boot failures are in the root.

export { type GameOptions, startGame } from './game.ts'
