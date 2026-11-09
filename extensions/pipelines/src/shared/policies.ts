import type { Policy } from '@automata/systems/bots'

/** The bots' policies (`POLICIES` in `@automata/systems/bots`; a test keeps the two equal). */
export const PIPE_POLICIES: readonly Policy[] = ['scripted', 'cautious', 'random', 'greedy']
