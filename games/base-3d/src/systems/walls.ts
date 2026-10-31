// What stands in the way (DESIGN.md §10): the area's walls and its closed doors, which block Wick, foes, pellets,
// the chain and line of sight alike. Every system that asks about walls asks here. Sim code.
import type { SimContext } from '@mcthaydt/automata-sim'
import { Door } from '../components.ts'
import { Location } from '../resources.ts'
import { areaIn, type PlanBox } from './area.ts'

/** The area's walls, then each closed door's box in sid order. */
export function wallsOf(ctx: SimContext): readonly PlanBox[] {
  const { walls } = areaIn(ctx.content, ctx.resource(Location))
  const closed = ctx
    .query(Door)
    .map((entity) => entity.get(Door))
    .filter((door) => !door.open)
  return closed.length === 0 ? walls : [...walls, ...closed]
}
