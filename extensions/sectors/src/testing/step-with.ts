// The one way the level's tests step a sim: a command without its header, and one step with a list of them, stamped
// for the sim's current tick from source 0. `nav` and `systems` use it for their walking games too.
import type { Command, Sim, StepResult } from '@automata/sim'

/** A command before it is stamped with the tick it runs on. */
export type Order = Pick<Command, 'type' | 'payload'>

/** Steps `sim` once with `orders`, stamped for its current tick from source 0. */
export const stepWith = (sim: Sim, orders: readonly Order[] = []): StepResult =>
  sim.step(orders.map((order, seq) => ({ tick: sim.tick, source: 0, seq, ...order })))
