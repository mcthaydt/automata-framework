import { defineEvent, type EventDef } from '@automata/sim'
import { z } from 'zod'

// Where something happened, in whole pixels (the hitbox's top-left corner). The renderer uses these for
// squash and stretch and dust; the page uses goal.reached to end the round.
const at = z.object({ x: z.number().int(), y: z.number().int() })

export const Jumped: EventDef<typeof at> = defineEvent('player.jumped', at)
export const Landed: EventDef<typeof at> = defineEvent('player.landed', at)
export const GoalReached: EventDef<typeof at> = defineEvent('goal.reached', at)
