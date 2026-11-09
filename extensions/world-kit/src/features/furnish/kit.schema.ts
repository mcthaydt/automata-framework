// A purpose kit (the `world-kit` content kind): what a room of that purpose holds. Furniture by slot; the wall fixtures
// (switches with their conduit and a sign over the door, outlets, vents, radiators under windows, art every `artEvery`
// metres, and outdoors the listed presets); clutter on surfaces and on the floor (items per square metre); the ceiling's
// lamps (a pendant every `spacing` metres, `drop` off the ceiling); and the surfaces the kit gives the room.
//
// Ported from EnvironmentBuilder (mcthaydt/EnvironmentBuilder) src/features/world/types.ts (`Kit`, `KitSlot`) and
// library/kits.json at 6d82a52.

import { type KitSurfaces, kitSurfacesSchema } from '@automata/3d/level'
import { z } from 'zod'

/**
 * Where a furniture slot's pieces stand: against a wall, in a corner, under a window, round the middle, or in rows
 * facing the longest wall.
 */
export type SlotRule = 'wall' | 'corner' | 'window' | 'centre' | 'rows'

/**
 * A furniture slot: preset(s) (the seed picks one per piece), its rule, how many per square metre of floor at density
 * 1, bounds on the count, and parameters over the preset's.
 */
export interface KitSlot {
  readonly use: string | readonly string[]
  readonly rule: SlotRule
  readonly per: number
  readonly min?: number | undefined
  readonly max?: number | undefined
  readonly with?: Readonly<Record<string, unknown>> | undefined
}

export interface Kit {
  /** What the kit paints the room it dresses with. */
  readonly surfaces?: KitSurfaces | undefined
  readonly furniture: readonly KitSlot[]
  readonly fixtures: {
    readonly switches?: boolean | undefined
    readonly outlets?: boolean | undefined
    readonly vents?: boolean | undefined
    readonly radiators?: boolean | undefined
    /** The words over a doorway: `true` makes them up, a list picks from it. */
    readonly signs?: boolean | readonly string[] | undefined
    readonly art?: readonly string[] | undefined
    readonly artEvery?: number | undefined
    readonly outdoor?: readonly string[] | undefined
  }
  readonly clutter?: { readonly on: readonly string[]; readonly per: number } | undefined
  readonly floor?: { readonly use: readonly string[]; readonly per: number } | undefined
  readonly ceiling?:
    | {
        readonly use: string
        readonly spacing: number
        readonly skipIfLamp?: boolean | undefined
        readonly drop?: number | undefined
      }
    | undefined
}

const slotSchema: z.ZodType<KitSlot> = z.looseObject({
  use: z.union([z.string(), z.array(z.string()).min(1)]),
  rule: z.enum(['wall', 'corner', 'window', 'centre', 'rows']),
  per: z.number().min(0),
  min: z.number().int().min(0).optional(),
  max: z.number().int().min(0).optional(),
  with: z.record(z.string(), z.unknown()).optional(),
})

export const worldKitSchema: z.ZodType<Kit> = z.looseObject({
  surfaces: kitSurfacesSchema.optional(),
  furniture: z.array(slotSchema),
  fixtures: z.looseObject({
    switches: z.boolean().optional(),
    outlets: z.boolean().optional(),
    vents: z.boolean().optional(),
    radiators: z.boolean().optional(),
    signs: z.union([z.boolean(), z.array(z.string())]).optional(),
    art: z.array(z.string()).optional(),
    artEvery: z.number().positive().optional(),
    outdoor: z.array(z.string()).optional(),
  }),
  clutter: z.looseObject({ on: z.array(z.string()).min(1), per: z.number().min(0) }).optional(),
  floor: z.looseObject({ use: z.array(z.string()).min(1), per: z.number().min(0) }).optional(),
  ceiling: z
    .looseObject({
      use: z.string(),
      spacing: z.number().positive(),
      skipIfLamp: z.boolean().optional(),
      drop: z.number().optional(),
    })
    .optional(),
})
