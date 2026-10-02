import { createWorld, type Entity, type World } from 'koota'
import type { EntityRef, SpawnPart } from '../define/context'
import type { ComponentDef } from '../define/definitions'
import { coerceField, type FieldType } from '../define/fields'
import { sortedKeys } from '../util/sorted'

export type FieldRecord = Record<string, number | boolean | string>

/** One entity's render-flagged components (component id -> field values). */
export interface RenderRow {
  readonly sid: number
  readonly components: Readonly<Record<string, Readonly<FieldRecord>>>
}

/**
 * What changed for the renderer since the last delta (spec §4.7). `changed` rows carry the entity's full
 * render state, so a removed component shows up as its absence. `resync` deltas list every live render
 * entity as added; the renderer drops everything it had first.
 */
export interface RenderDelta {
  readonly resync: boolean
  readonly added: readonly RenderRow[]
  readonly changed: readonly RenderRow[]
  readonly removed: readonly number[]
}

/**
 * Entities behind the facade: Koota stores the data; this class owns StableIds (monotonic, never reused),
 * iteration order (ascending StableId), field coercion and render dirty-tracking. Koota ids never escape.
 */
export class EntityStore {
  private readonly world: World = createWorld()
  private readonly registered: Map<string, ComponentDef>
  private readonly entities = new Map<number, Entity>()
  private readonly live: number[] = [] // ascending: StableIds are monotonic, so spawn appends
  private readonly addedThisTick = new Set<number>()
  private readonly changedThisTick = new Set<number>()
  private readonly removedThisTick = new Set<number>()
  nextId = 1

  constructor(components: readonly ComponentDef[]) {
    this.registered = new Map(components.map((c) => [c.id, c]))
  }

  private check(def: ComponentDef): ComponentDef {
    if (this.registered.get(def.id) !== def)
      throw new Error(`unknown component "${def.id}": register it in a plugin`)
    return def
  }

  private coerce(
    def: ComponentDef,
    values: Readonly<Record<string, unknown>>,
    base: FieldRecord,
  ): FieldRecord {
    const out: FieldRecord = { ...base }
    for (const name of sortedKeys(values)) {
      const type = def.fields[name] as FieldType | undefined
      if (!type) throw new Error(`component "${def.id}" has no field: unknown field "${name}"`)
      out[name] = coerceField(type, values[name])
    }
    return out
  }

  private defaults(def: ComponentDef): FieldRecord {
    return this.coerce(def, {}, def.trait.schema as FieldRecord)
  }

  private read(e: Entity, def: ComponentDef): FieldRecord {
    const raw = e.get(def.trait) as FieldRecord
    const out: FieldRecord = {}
    for (const name of def.fieldNames) out[name] = raw[name] as number | boolean | string
    return out
  }

  private markChanged(sid: number, def: ComponentDef): void {
    if (def.render && !this.addedThisTick.has(sid)) this.changedThisTick.add(sid)
  }

  private alive(sid: number): Entity {
    const e = this.entities.get(sid)
    if (!e) throw new Error(`entity ${sid} is not alive`)
    return e
  }

  /** Spawns with a fresh StableId. */
  spawn(parts: readonly SpawnPart[]): number {
    return this.spawnWithId(this.nextId++, parts)
  }

  /** Spawns with a given StableId (restore only; ids must arrive in ascending order). */
  spawnWithId(sid: number, parts: readonly SpawnPart[]): number {
    const e = this.world.spawn()
    for (const part of parts) {
      const [def, values] = Array.isArray(part) ? part : [part as ComponentDef, {}]
      this.check(def)
      if (e.has(def.trait)) throw new Error(`entity ${sid} already has "${def.id}"`)
      e.add(def.trait(this.coerce(def, values, this.defaults(def))))
    }
    this.entities.set(sid, e)
    this.live.push(sid)
    this.addedThisTick.add(sid)
    return sid
  }

  despawn(sid: number): void {
    const e = this.alive(sid)
    const hadRender = this.renderComponents(e).length > 0
    e.destroy()
    this.entities.delete(sid)
    this.live.splice(this.live.indexOf(sid), 1)
    this.changedThisTick.delete(sid)
    if (this.addedThisTick.has(sid)) this.addedThisTick.delete(sid)
    else if (hadRender) this.removedThisTick.add(sid)
  }

  liveSids(): readonly number[] {
    return this.live
  }

  componentsOf(sid: number): ComponentDef[] {
    const e = this.alive(sid)
    return [...this.registered.values()].filter((c) => e.has(c.trait))
  }

  query(components: readonly ComponentDef[]): EntityRef[] {
    for (const c of components) this.check(c)
    const out: EntityRef[] = []
    for (const sid of this.live) {
      const e = this.entities.get(sid) as Entity
      if (components.every((c) => e.has(c.trait))) out.push(this.makeRef(sid))
    }
    return out
  }

  ref(sid: number): EntityRef | undefined {
    return this.entities.has(sid) ? this.makeRef(sid) : undefined
  }

  private makeRef(sid: number): EntityRef {
    // biome-ignore lint/complexity/noUselessThisAlias: methods below are plain object members
    const store = this
    return {
      sid,
      has: (def) => store.alive(sid).has(store.check(def).trait),
      get: (def) => {
        const e = store.alive(sid)
        if (!e.has(store.check(def).trait)) throw new Error(`entity ${sid} does not have "${def.id}"`)
        return Object.freeze(store.read(e, def)) as never // a copy: mutating it must throw, not silently do nothing
      },
      set: (def, values) => {
        const e = store.alive(sid)
        if (!e.has(store.check(def).trait)) throw new Error(`entity ${sid} does not have "${def.id}"`)
        e.set(def.trait, store.coerce(def, values as Record<string, unknown>, store.read(e, def)))
        store.markChanged(sid, def)
      },
      add: (def, values = {}) => {
        const e = store.alive(sid)
        if (e.has(store.check(def).trait)) throw new Error(`entity ${sid} already has "${def.id}"`)
        e.add(def.trait(store.coerce(def, values as Record<string, unknown>, store.defaults(def))))
        store.markChanged(sid, def)
      },
      remove: (def) => {
        const e = store.alive(sid)
        if (!e.has(store.check(def).trait)) return
        e.remove(def.trait)
        store.markChanged(sid, def)
      },
    }
  }

  private renderComponents(e: Entity): ComponentDef[] {
    return [...this.registered.values()]
      .filter((c) => c.render && e.has(c.trait))
      .sort((a, b) => (a.id < b.id ? -1 : 1))
  }

  private row(sid: number): RenderRow | null {
    const e = this.entities.get(sid) as Entity
    const comps = this.renderComponents(e)
    if (comps.length === 0) return null
    const components: Record<string, FieldRecord> = {}
    for (const c of comps) components[c.id] = this.read(e, c)
    return { sid, components }
  }

  private rows(sids: Iterable<number>): RenderRow[] {
    const out: RenderRow[] = []
    for (const sid of [...sids].sort((a, b) => a - b)) {
      const r = this.entities.has(sid) ? this.row(sid) : null
      if (r) out.push(r)
    }
    return out
  }

  /** Render changes since the last call, then clears the tracking (built-in `render.collect`). */
  takeDelta(resync: boolean): RenderDelta {
    const delta: RenderDelta = resync
      ? { resync: true, added: this.rows(this.live), changed: [], removed: [] }
      : {
          resync: false,
          added: this.rows(this.addedThisTick),
          changed: this.rows([...this.changedThisTick].filter((sid) => !this.addedThisTick.has(sid))),
          removed: [...this.removedThisTick].sort((a, b) => a - b),
        }
    this.addedThisTick.clear()
    this.changedThisTick.clear()
    this.removedThisTick.clear()
    return delta
  }

  dispose(): void {
    this.world.destroy()
  }
}
