import { level2dKinds } from '@automataframework/content/level-2d'

// What `automata-content` compiles `content/` with: the kinds vite.config.ts hands the content plugin. The font build
// (`automata-content assets`) is one of its commands.
export default { schemas: level2dKinds() }
