import { level2dKinds } from '@mcthaydt/automata-content/level-2d'

// What the content compiler is given: the kinds of content this game has. vite.config.ts hands it to the content
// plugin, and the Automata app reads this one file to compile the game on a phone.
export const contentConfig = { schemas: level2dKinds() }
