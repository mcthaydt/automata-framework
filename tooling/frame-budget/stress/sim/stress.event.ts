import { defineEvent, type EventDef } from '@automataframework/automata-sim'
import { z } from 'zod'

const beatSchema = z.object({ tick: z.number().int() })

/** Every `BEAT_TICKS` ticks, so the UI shows progress through the presentation bus without a per-tick event. */
export const Beat: EventDef<typeof beatSchema> = defineEvent('stress.beat', beatSchema)

export const BEAT_TICKS = 30
