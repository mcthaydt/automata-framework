// The `sector-map` resource: the scene's sectors and masses, set once per scene by `loadSectorMap`. It is what a
// snapshot carries; the resolution is derived from it (`resolvedMap`), so it never needs saving.
import { massSchema, pairSchema, surfaceSchema } from '@automata/3d/level'
import { defineResource, type ResourceDef } from '@automata/sim'
import { z } from 'zod'
import type { SectorMap, StoredPlane, StoredSector } from './check-level'

// A plane reads as it was stored, never turned into an object: the stored form is what a snapshot hashes.
const planeSchema: z.ZodType<StoredPlane> = z.union([
  z.number(),
  z.looseObject({
    z: z.number(),
    slope: pairSchema.optional(),
    sky: z.boolean().optional(),
    surface: surfaceSchema.optional(),
  }),
])

// The level was read by `readLevel` and passed `checkLevel` before it got here, so the resource holds the members the
// sim keys on and carries the rest as they came.
const sectorSchema = z.looseObject({
  id: z.string(),
  floor: planeSchema,
  ceiling: planeSchema,
  light: z.number(),
  corners: z.array(z.array(z.unknown())).min(3),
  holes: z.array(z.array(z.array(z.unknown())).min(3)).optional(),
}) as unknown as z.ZodType<StoredSector>

const sectorMapSchema: z.ZodType<SectorMap> = z.looseObject({
  sectors: z.array(sectorSchema),
  masses: z.array(massSchema).optional(),
})

/** The scene's sectors and masses; empty until the game loads a level. */
export const SectorMapResource: ResourceDef<typeof sectorMapSchema> = defineResource(
  'sectors.sector-map',
  sectorMapSchema,
  () => ({ sectors: [] }),
)
