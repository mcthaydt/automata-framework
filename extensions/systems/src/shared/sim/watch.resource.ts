// The watcher's state: whether the watched condition held at the end of the last step.
import { defineResource, type ResourceDef } from '@automata/sim'
import { z } from 'zod'

const watchSchema: z.ZodType<{ held: boolean }> = z.strictObject({ held: z.boolean() })
/** Whether the watched condition held at the end of the last step. */
export const SystemsWatch: ResourceDef<typeof watchSchema> = defineResource(
  'systems.watch',
  watchSchema,
  () => ({
    held: false,
  }),
)
