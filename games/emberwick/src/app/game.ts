// Emberwick over the room the content compiler produced; `main.ts` passes it to `startGame`.
import { SIM_CONTENT, SIM_CONTENT_HASH } from '../features/room/emberwick-content.ts'
import { makeEmberwick } from './make-game.ts'

export { input } from './make-game.ts'
export { SIM_CONTENT_HASH }

export const emberwick = makeEmberwick(SIM_CONTENT)
