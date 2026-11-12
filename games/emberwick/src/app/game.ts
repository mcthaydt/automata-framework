// Emberwick over the room the content compiler produced; `main.ts` passes it to `startGame`. It ships in the framework's
// six default languages (messages/ui/<lang>.json), so a first run asks which one.
import { DEFAULT_LOCALES } from '@automata/framework'
import { SIM_CONTENT, SIM_CONTENT_HASH } from '../features/room/emberwick-content.ts'
import { makeEmberwick } from './make-game.ts'

export { input } from './make-game.ts'
export { SIM_CONTENT_HASH }

export const emberwick = makeEmberwick(SIM_CONTENT, {
  locale: { locales: [...DEFAULT_LOCALES], baseLocale: 'en' },
})
