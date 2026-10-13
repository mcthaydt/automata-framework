import { defineEvent, type EventDef } from '@mcthaydt/automata-sim'
import { z } from 'zod'

const tickEventSchema = z.object({ tick: z.number().int() })

export const Tick: EventDef<typeof tickEventSchema> = defineEvent('tick', tickEventSchema)
