import { defineResource } from '@automata/sim'
import { z } from 'zod'

/** What the story remembers between ticks. Part of the sim, so a saved game and a replay carry it. */
export const Story = defineResource(
  'story',
  z.strictObject({
    /** Whether the story's files have been handed to the extensions (the first tick does it). */
    loaded: z.boolean(),
    /** Whether the player stands at the keeper: a conversation starts when they arrive, not every tick they stay. */
    near: z.boolean(),
  }),
  () => ({ loaded: false, near: false }),
)
