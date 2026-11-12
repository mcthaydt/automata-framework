import { defineResource, type ResourceDef } from '@automata/sim'
import { z } from 'zod'

/** The night's clocks: the vigil (seconds since the lights went), whether it is over, and the time to the next footstep. */
export interface NightValue {
  vigil: number
  /** Her vigil is over: she goes back into the corridor unless she is after Ada. The puzzle's rules read it as the fact `vigilOver`. */
  over: boolean
  /** Seconds until Ada's next step makes a noise. */
  step: number
  /** The lights have gone and she waits at the far end of the corridor until the cutscene that tells it is over. */
  waking: boolean
}

const nightSchema: z.ZodType<NightValue> = z.strictObject({
  vigil: z.number().min(0),
  over: z.boolean(),
  step: z.number().min(0),
  waking: z.boolean(),
})

export const Night: ResourceDef<typeof nightSchema> = defineResource('night', nightSchema, () => ({
  vigil: 0,
  over: false,
  step: 0,
  waking: false,
}))
