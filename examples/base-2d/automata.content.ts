// The content compiler's options for base-2d (`automata-content build`, `check --verify-artifact`).
import type { ContentConfig } from '@mcthaydt/automata-content'
import { rooms } from './src/content/rooms.content.ts'

export default { schemas: [rooms] } satisfies ContentConfig
