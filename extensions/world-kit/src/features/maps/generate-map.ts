// A generated map as an `af-sector/2` level: the plan a generator makes, converted. Maps are a generator plus data, as
// figures are: the same seed gives the same level in every engine, and every name in it is a library name.
import type { AfSector2 } from '@automata/3d/level'
import { apartment } from './apartment.ts'
import { block } from './block.ts'
import { convertBuilderMap } from './convert-builder-map.ts'
import type { MapPlan } from './map-plan.ts'

const GENERATORS: Readonly<Record<'apartment' | 'block', (seed: number) => MapPlan>> = { apartment, block }

/** The maps this kit can generate. */
export const MAP_NAMES = ['apartment', 'block'] as const
export type MapName = (typeof MAP_NAMES)[number]

/** The level `name` makes for `seed`, called `<name>@<seed>`. Its rooms ask to be dressed: run `dressLevel` over it. */
export function generateMap(name: MapName, seed = 1): AfSector2 {
  const generator = GENERATORS[name]
  if (generator === undefined)
    throw new Error(`There is no map generator called "${String(name)}" (${MAP_NAMES.join(', ')}).`)
  const plan = generator(seed)
  return convertBuilderMap(plan)
}
