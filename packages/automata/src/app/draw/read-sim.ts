// The sim as the draw layer sees it: reads only. Law 1 says only the sim
// changes gameplay state, so this view has no write method at all, and every value it hands out is a frozen copy:
// a HUD that assigns to one throws instead of reaching the sim. The copies are made per call, which suits a HUD,
// a debug overlay or a prototype; hot drawing stays in entity views.
import type { ComponentDef, FieldSchema, FieldValues, ResourceDef, Sim } from '@mcthaydt/automata-sim'
import type { z } from 'zod'

/** One entity, read-only: its components' values are frozen copies. */
export interface DrawEntity {
  readonly sid: number
  has(component: ComponentDef): boolean
  get<S extends FieldSchema>(component: ComponentDef<S>): Readonly<FieldValues<S>>
}

/** The sim at this frame, read-only. */
export interface DrawSim {
  readonly tick: number
  query(...components: ComponentDef[]): DrawEntity[]
  entity(sid: number): DrawEntity | undefined
  /** A deep-frozen copy of the resource's value. */
  resource<Z extends z.ZodType>(def: ResourceDef<Z>): z.output<Z>
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const key of Reflect.ownKeys(value)) deepFreeze((value as Record<PropertyKey, unknown>)[key])
  }
  return value
}

function readEntity(entity: NonNullable<ReturnType<Sim['entity']>>): DrawEntity {
  return Object.freeze({
    sid: entity.sid,
    has: (component: ComponentDef) => entity.has(component),
    get: <S extends FieldSchema>(component: ComponentDef<S>) => Object.freeze({ ...entity.get(component) }),
  })
}

/** A read-only view of `sim`; it follows the sim as it steps. */
export function readSim(sim: Sim): DrawSim {
  return Object.freeze({
    get tick() {
      return sim.tick
    },
    query: (...components: ComponentDef[]) => sim.query(...components).map(readEntity),
    entity: (sid: number) => {
      const entity = sim.entity(sid)
      return entity === undefined ? undefined : readEntity(entity)
    },
    resource: <Z extends z.ZodType>(def: ResourceDef<Z>) => deepFreeze(structuredClone(sim.resource(def))),
  })
}
