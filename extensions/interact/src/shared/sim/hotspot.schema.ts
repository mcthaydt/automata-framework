// A hotspot: a place in the level a person can use, how near they must stand, what it is called and when it is usable.
// Its name is a message key, so the words come from the game's catalogs like every other line.
import { type Cond, condSchema } from '@automataframework/puzzle/sim'
import { z } from 'zod'

export interface Hotspot {
  readonly id: string
  readonly x: number
  readonly z: number
  /** How near the walker must be to use it, in metres. */
  readonly reach: number
  /** A message key. */
  readonly name: string
  /** A hiding place: using it with nothing held hides the walker instead of sending a verb. */
  readonly hide?: boolean | undefined
  /** Usable only while every condition holds. */
  readonly when?: readonly Cond[] | undefined
}

export const hotspotSchema: z.ZodType<Hotspot> = z.strictObject({
  id: z.string().min(1),
  x: z.number(),
  z: z.number(),
  reach: z.number().positive(),
  name: z.string(),
  hide: z.boolean().optional(),
  when: z.array(condSchema).optional(),
})
