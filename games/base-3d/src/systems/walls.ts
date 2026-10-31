// What stands in the way (DESIGN.md §10): the area's walls, its closed doors and gates, its blocks, shown chests, pots
// and cracked walls, which block Wick, foes, pellets, the chain and line of sight alike. Every system that asks about
// walls asks here. Sim code.
import type { SimContext } from '@mcthaydt/automata-sim'
import { Block, Breakable, Chest, Door, Gate } from '../components.ts'
import { BLOCK_CELL } from '../constants/index.ts'
import { Location } from '../resources.ts'
import { areaIn, type PlanBox } from './area.ts'

/** A block's box from its centre: a 1 m cell. */
export const blockBox = (x: number, z: number): PlanBox => {
  const half = Math.trunc(BLOCK_CELL / 2)
  return { minX: x - half, minZ: z - half, maxX: x + half, maxZ: z + half }
}

/**
 * The area's walls, then each closed door's box, each block's, each shown chest's, each standing pot's and cracked
 * wall's, and each closed gate's, in sid order.
 */
export function wallsOf(ctx: SimContext): readonly PlanBox[] {
  const { walls } = areaIn(ctx.content, ctx.resource(Location))
  const pieces: PlanBox[] = [
    ...ctx
      .query(Door)
      .map((entity) => entity.get(Door))
      .filter((door) => !door.open),
    ...ctx.query(Block).map((entity) => blockBox(entity.get(Block).x, entity.get(Block).z)),
    ...ctx
      .query(Chest)
      .map((entity) => entity.get(Chest))
      .filter((chest) => chest.shown),
    ...ctx.query(Breakable).map((entity) => entity.get(Breakable)),
    ...ctx
      .query(Gate)
      .map((entity) => entity.get(Gate))
      .filter((gate) => !gate.open),
  ]
  return pieces.length === 0 ? walls : [...walls, ...pieces]
}
