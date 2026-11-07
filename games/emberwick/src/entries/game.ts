// `@af-games/emberwick/game`: the base's whole game as one `defineGame` result, for `startGame`. A separate
// entry from the package root because the game loads Pixi, the runtime and the screens; the root and ./sim
// stay light for Node code. bootPage and the boot failures (for the demos) are in the root.

export { emberwick, input } from '../app/game.ts'
