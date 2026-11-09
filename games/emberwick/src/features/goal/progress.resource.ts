import { defineResource, type ResourceDef } from '@automataframework/automata-sim'
import { z } from 'zod'

const progressSchema = z.object({ reached: z.boolean(), tick: z.number().int() })

/** Whether the goal has been reached, and on which tick. */
export const Progress: ResourceDef<typeof progressSchema> = defineResource(
  'progress',
  progressSchema,
  () => ({
    reached: false,
    tick: 0,
  }),
)
