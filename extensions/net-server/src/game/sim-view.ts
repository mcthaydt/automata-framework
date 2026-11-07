/**
 * A read-only view over the room's sim, for a `BotPolicy` (M7 spec §4.3: "Reads the sim; never writes it").
 *
 * AF's sim exports no `SimView`, so server defines this narrow one over the public `Sim` rather than changing core:
 * the tick, the hash, entity and resource reads, and nothing that steps, spawns, restores or sets. An entity read
 * through it carries `has` and `get` only. The view is live: it reads the sim as it is when called, so one view
 * serves a room for its whole life.
 */

import type { ComponentDef, FieldSchema, FieldValues, ResourceDef, Sim } from '@automata/sim'
import type { z } from 'zod'

/** An entity as a view reads it: its id and its components' values, never a setter. */
export interface ReadonlyEntity {
  readonly sid: number
  has(component: ComponentDef): boolean
  get<S extends FieldSchema>(component: ComponentDef<S>): Readonly<FieldValues<S>>
}

export interface SimView {
  /** The tick the sim steps next. */
  readonly tick: number
  readonly tickHz: number
  readonly contentHash: string
  entity(sid: number): ReadonlyEntity | undefined
  /** Entities with every listed component, in id order (the sim's `query`). */
  query(...components: ComponentDef[]): ReadonlyEntity[]
  resource<Z extends z.ZodType>(def: ResourceDef<Z>): Readonly<z.output<Z>>
  hash(): string
}

const readonlyEntity = (entity: ReadonlyEntity): ReadonlyEntity => ({
  sid: entity.sid,
  has: (component) => entity.has(component),
  get: (component) => entity.get(component),
})

export function simViewOf(sim: Sim): SimView {
  return {
    get tick() {
      return sim.tick
    },
    tickHz: sim.tickHz,
    contentHash: sim.contentHash,
    entity(sid) {
      const entity = sim.entity(sid)
      return entity === undefined ? undefined : readonlyEntity(entity)
    },
    query: (...components) => sim.query(...components).map(readonlyEntity),
    resource: (def) => sim.resource(def),
    hash: () => sim.hash(),
  }
}
