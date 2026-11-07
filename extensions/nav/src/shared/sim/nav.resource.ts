// Nav's state: the scene's graph, the doors (with a version that counts their changes) and each walker's route.
import { defineResource, type ResourceDef } from '@automata/sim'
import { z } from 'zod'
import { navGraphSchema } from './nav-graph.schema'

/** The scene's walking graph; empty until the game loads one. */
export const NavGraphResource: ResourceDef<typeof navGraphSchema> = defineResource(
  'nav.graph',
  navGraphSchema,
  () => ({
    nodes: {},
    edges: [],
  }),
)

export interface NavDoorState {
  /** Door id → open. A door never set is shut. */
  open: Record<string, boolean>
  /** How many times a door has changed; a route made at an older version is made again. */
  version: number
}
const doorsSchema: z.ZodType<NavDoorState> = z.strictObject({
  open: z.record(z.string(), z.boolean()),
  version: z.number().int().min(0),
})
export const NavDoors: ResourceDef<typeof doorsSchema> = defineResource('nav.doors', doorsSchema, () => ({
  open: {},
  version: 0,
}))

export interface NavRoute {
  to: { x: number; z: number }
  /** The points still to walk to, in order; the last is `to`. */
  points: { x: number; z: number }[]
  /** The doors' version the route was made at. */
  version: number
}
const pointSchema = z.strictObject({ x: z.number(), z: z.number() })
const routesSchema: z.ZodType<Record<string, NavRoute>> = z.record(
  z.string(),
  z.strictObject({ to: pointSchema, points: z.array(pointSchema), version: z.number().int().min(0) }),
)
/** Each walking entity's route, keyed by its StableId. */
export const NavRoutes: ResourceDef<typeof routesSchema> = defineResource(
  'nav.routes',
  routesSchema,
  () => ({}),
)
