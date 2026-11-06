// Emberwick over the room the content compiler produced; `main.ts` passes it to `startGame`.
import { SIM_CONTENT } from './content/emberwick-content.ts'
import { makeEmberwick } from './make-game.ts'

export { input } from './make-game.ts'

export const emberwick = makeEmberwick(SIM_CONTENT)
