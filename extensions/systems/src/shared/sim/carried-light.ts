// A game's refill of a carried light. Which item does it, and how much a bottle is, are the game's; the sim only keeps the
// fuel.
import type { SimContext } from '@automata/sim'
import { CarriedLight } from './carried-light.component'

/** Adds `ticks` of fuel to the carried light on `entity`, never past `cap`. Does nothing for an entity with no light. */
export function refuel(ctx: SimContext, entity: number, ticks: number, cap: number): void {
  const carrier = ctx.entity(entity)
  if (carrier === undefined || !carrier.has(CarriedLight)) return
  carrier.set(CarriedLight, { fuelTicks: Math.min(cap, carrier.get(CarriedLight).fuelTicks + ticks) })
}
