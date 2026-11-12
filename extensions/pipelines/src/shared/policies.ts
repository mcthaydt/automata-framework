import type { Policy } from '@automataframework/systems/bots'

/** The bots' policies (`POLICIES` in `@automataframework/systems/bots`; a test keeps the two equal). */
export const PIPE_POLICIES: readonly Policy[] = ['scripted', 'cautious', 'random', 'greedy']
