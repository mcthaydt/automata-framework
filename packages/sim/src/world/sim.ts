import type { z } from 'zod'
import type { CommandRecord, EntityRef, SimContext, SpawnPart } from '../define/context'
import {
  type CommandDef,
  type ComponentDef,
  defineSystem,
  type EventDef,
  type PluginDef,
  type ResourceDef,
  type SystemDef,
} from '../define/definitions'
import { canonicalJson, utf8 } from '../hash/canonical'
import { hex64, xxhash64 } from '../hash/xxhash64'
import { createRng, deriveSeed, type Rng, rngFromState } from '../rng/rng'
import { orderPlugins, orderSystems } from '../schedule/schedule'
import { sortedKeys } from '../util/sorted'
import { EntityStore, type FieldRecord, type RenderDelta } from './entity-store'
import {
  decodeSnapshot,
  encodeSnapshot,
  type SnapshotData,
  SnapshotFormatError,
  SnapshotMismatchError,
} from './snapshot'

/** Input to the sim (spec §4.4 rule 4). `source` is a player slot (u8), `seq` a per-source counter (u32). */
export interface Command {
  readonly tick: number
  readonly source: number
  readonly seq: number
  readonly type: string
  readonly payload: unknown
}

export type RejectReason =
  | 'bad-header'
  | 'unknown-command'
  | 'wrong-tick'
  | 'duplicate-seq'
  | 'invalid-payload'

export interface RejectedCommand {
  readonly command: Command
  readonly reason: RejectReason
}

export interface SimEvent {
  readonly type: string
  readonly payload: unknown
}

export interface StepResult {
  /** The tick the sim is at after this step. */
  readonly tick: number
  readonly events: readonly SimEvent[]
  readonly render: RenderDelta
  /** Invalid commands, in input order. The sim has no I/O, so it reports instead of logging. */
  readonly rejected: readonly RejectedCommand[]
}

export interface SimOptions {
  readonly seed: number
  readonly tickHz?: number
  readonly content?: unknown
  readonly plugins: readonly PluginDef[]
}

export interface Sim {
  readonly seed: number
  readonly tickHz: number
  readonly tick: number
  step(commands: readonly Command[]): StepResult
  /** Setup and inspection outside `step` (tests, scene setup). Runtime changes go through commands. */
  spawn(parts: readonly SpawnPart[]): number
  entity(sid: number): EntityRef | undefined
  query(...components: ComponentDef[]): EntityRef[]
  resource<Z extends z.ZodType>(def: ResourceDef<Z>): z.output<Z>
  /** Canonical snapshot v1 bytes (spec §4.6). */
  snapshot(): Uint8Array
  /** Replaces the whole state. Throws SnapshotFormatError / SnapshotMismatchError and leaves the sim unchanged. */
  restore(bytes: Uint8Array): void
  /** xxhash64 of the snapshot, 16 hex digits. */
  hash(): string
  dispose(): void
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const k of sortedKeys(value as object)) deepFreeze((value as Record<string, unknown>)[k])
  }
  return value
}

function register<T extends { id: string }>(what: string, map: Map<string, T>, items: readonly T[]): void {
  for (const item of items) {
    if (map.has(item.id)) throw new Error(`duplicate ${what} "${item.id}"`)
    map.set(item.id, item)
  }
}

const isU = (n: unknown, max: number): boolean =>
  typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= max

export async function createSim(opts: SimOptions): Promise<Sim> {
  const tickHz = opts.tickHz ?? 60
  if (!Number.isInteger(tickHz) || tickHz < 1 || tickHz > 1000)
    throw new Error(`tickHz must be an integer 1..1000`)
  const dt = 1 / tickHz
  const plugins = orderPlugins(opts.plugins)

  const components = new Map<string, ComponentDef>()
  const commandDefs = new Map<string, CommandDef>()
  const eventDefs = new Map<string, EventDef>()
  const resourceDefs = new Map<string, ResourceDef>()
  for (const p of plugins) {
    register('component', components, p.components)
    register('command', commandDefs, p.commands)
    register('event', eventDefs, p.events)
    register('resource', resourceDefs, p.resources)
  }

  // Content: an independent, canonical, deep-frozen copy (spec §4.4 rule 6).
  const contentJson = canonicalJson(opts.content === undefined ? {} : opts.content)
  const content = deepFreeze(JSON.parse(contentJson))
  const contentHash = xxhash64(utf8(contentJson))
  const componentList = [...components.values()]
  let store = new EntityStore(componentList)
  const resources = new Map<string, unknown>()
  for (const def of resourceDefs.values()) resources.set(def.id, def.schema.parse(def.init()))

  let tick = 0
  let fullResync = true // a renderer starts empty, so the first delta is a resync
  let events: SimEvent[] = []
  let pendingDespawn = new Set<number>()
  let stagedCommands = new Map<string, Array<CommandRecord<unknown>>>()
  let commandsByType = new Map<string, Array<CommandRecord<unknown>>>()
  let lastDelta: RenderDelta = { resync: false, added: [], changed: [], removed: [] }

  // Built-ins. Every input system runs after commands.apply; every cleanup system before entities.flush.
  const builtins: SystemDef[] = [
    defineSystem({
      name: 'commands.apply',
      phase: 'input',
      run: () => {
        commandsByType = stagedCommands
      },
    }),
    defineSystem({
      name: 'entities.flush',
      phase: 'cleanup',
      run: () => {
        for (const sid of [...pendingDespawn].sort((a, b) => a - b)) store.despawn(sid)
        pendingDespawn = new Set()
      },
    }),
    defineSystem({
      name: 'render.collect',
      phase: 'cleanup',
      after: ['entities.flush'],
      run: () => {
        lastDelta = store.takeDelta(fullResync)
        fullResync = false
      },
    }),
  ]
  const builtinNames = new Set(builtins.map((s) => s.name))
  const userSystems = plugins.flatMap((p) => p.systems)
  for (const s of userSystems)
    if (builtinNames.has(s.name)) throw new Error(`system name "${s.name}" is reserved`)
  const wired = userSystems.map((s) => {
    if (s.phase === 'input' && !s.after.includes('commands.apply'))
      return { ...s, after: [...s.after, 'commands.apply'] }
    if (s.phase === 'cleanup' && !s.before.includes('entities.flush'))
      return { ...s, before: [...s.before, 'entities.flush'] }
    return s
  })
  const systems = orderSystems([...builtins, ...wired])
  const rngs = new Map<string, Rng>(systems.map((s) => [s.name, createRng(deriveSeed(opts.seed, s.name))]))

  // Everything that must match for a snapshot to be restorable here.
  const sortedIds = (m: Map<string, unknown>) => [...m.keys()].sort()
  const schemaHash = xxhash64(
    utf8(
      canonicalJson({
        plugins: plugins.map((p) => p.name),
        components: componentList
          .map((c) => ({ id: c.id, fields: c.fields, render: c.render }))
          .sort((a, b) => (a.id < b.id ? -1 : 1)),
        commands: sortedIds(commandDefs),
        events: sortedIds(eventDefs),
        resources: sortedIds(resourceDefs),
        systems: systems.map((s) => `${s.phase}:${s.name}`),
      }),
    ),
  )

  const resourceOf = <Z extends z.ZodType>(def: ResourceDef<Z>): z.output<Z> => {
    if (resourceDefs.get(def.id) !== def)
      throw new Error(`unknown resource "${def.id}": register it in a plugin`)
    return resources.get(def.id) as z.output<Z>
  }

  const contexts = systems.map((system) => {
    const ctx: SimContext = {
      get tick() {
        return tick
      },
      dt,
      get rng() {
        return rngs.get(system.name) as Rng
      },
      content,
      query: (...cs) => store.query(cs),
      entity: (sid) => store.ref(sid),
      spawn: (...parts) => store.spawn(parts),
      despawn: (sid) => {
        if (!store.ref(sid)) throw new Error(`despawn: entity ${sid} is not alive`)
        pendingDespawn.add(sid)
      },
      commands: {
        of: <Z extends z.ZodType>(def: CommandDef<Z>) => {
          if (commandDefs.get(def.id) !== def)
            throw new Error(`unknown command "${def.id}": register it in a plugin`)
          return (commandsByType.get(def.id) ?? []) as ReadonlyArray<CommandRecord<z.output<Z>>>
        },
      },
      emit: (def, payload) => {
        if (eventDefs.get(def.id) !== def)
          throw new Error(`unknown event "${def.id}": register it in a plugin`)
        const parsed = def.schema.safeParse(payload)
        if (!parsed.success) throw new Error(`event "${def.id}" payload invalid: ${parsed.error.message}`)
        events.push({ type: def.id, payload: parsed.data })
      },
      resource: resourceOf,
    }
    return { system, ctx }
  })

  function intake(commands: readonly Command[]): RejectedCommand[] {
    const rejected: RejectedCommand[] = []
    const accepted: Array<Command & { parsed: unknown }> = []
    const seen = new Set<string>()
    for (const c of commands) {
      if (
        !isU(c.tick, 4294967295) ||
        !isU(c.source, 255) ||
        !isU(c.seq, 4294967295) ||
        typeof c.type !== 'string'
      ) {
        rejected.push({ command: c, reason: 'bad-header' })
        continue
      }
      const def = commandDefs.get(c.type)
      if (!def) {
        rejected.push({ command: c, reason: 'unknown-command' })
        continue
      }
      if (c.tick !== tick) {
        rejected.push({ command: c, reason: 'wrong-tick' })
        continue
      }
      const key = `${c.source}:${c.seq}`
      if (seen.has(key)) {
        rejected.push({ command: c, reason: 'duplicate-seq' })
        continue
      }
      const parsed = def.schema.safeParse(c.payload)
      if (!parsed.success) {
        rejected.push({ command: c, reason: 'invalid-payload' })
        continue
      }
      seen.add(key)
      accepted.push({ ...c, parsed: parsed.data })
    }
    accepted.sort((a, b) => a.source - b.source || a.seq - b.seq)
    stagedCommands = new Map()
    for (const c of accepted) {
      const list = stagedCommands.get(c.type) ?? []
      list.push({ source: c.source, seq: c.seq, payload: c.parsed })
      stagedCommands.set(c.type, list)
    }
    return rejected
  }

  const sim: Sim = {
    seed: opts.seed,
    tickHz,
    get tick() {
      return tick
    },
    step(commands) {
      const rejected = intake(commands)
      events = []
      for (const { system, ctx } of contexts) system.run(ctx)
      tick += 1
      commandsByType = new Map()
      stagedCommands = new Map()
      return { tick, events, render: lastDelta, rejected }
    },
    spawn: (parts) => store.spawn(parts),
    entity: (sid) => store.ref(sid),
    query: (...cs) => store.query(cs),
    resource: resourceOf,
    snapshot() {
      const entities = store.liveSids().map((sid) => {
        const ref = store.ref(sid) as EntityRef
        const map = new Map<string, FieldRecord>()
        for (const c of store.componentsOf(sid)) map.set(c.id, ref.get(c) as FieldRecord)
        return { sid, components: map }
      })
      const resourceRows = sortedIds(resourceDefs).map((id) => {
        const def = resourceDefs.get(id) as ResourceDef
        const checked = def.schema.safeParse(resources.get(id))
        if (!checked.success)
          throw new Error(`resource "${id}" no longer matches its schema: ${checked.error.message}`)
        const json = canonicalJson(checked.data)
        const again = def.schema.safeParse(JSON.parse(json))
        if (!again.success || canonicalJson(again.data) !== json)
          throw new Error(`resource "${id}" does not round-trip through JSON`)
        // Zod strips unknown keys, so the checked copy would hide state that restore cannot reproduce.
        if (canonicalJson(resources.get(id)) !== json)
          throw new Error(`resource "${id}" has values outside its schema`)
        return { id, json }
      })
      return encodeSnapshot(
        {
          schemaHash,
          contentHash,
          tick,
          tickHz,
          rng: systems.map((s) => ({ name: s.name, state: (rngs.get(s.name) as Rng).state() })),
          resources: resourceRows,
          nextId: store.nextId,
          entities,
        },
        componentList,
      )
    },
    restore(bytes) {
      let data: SnapshotData
      try {
        data = decodeSnapshot(bytes, componentList)
      } catch (err) {
        if (err instanceof SnapshotFormatError) throw err
        // e.g. RangeError from an invalid UTF-8 code point: the contract is one error type for bad bytes.
        throw new SnapshotFormatError(err instanceof Error ? err.message : String(err), { cause: err })
      }
      if (data.schemaHash !== schemaHash)
        throw new SnapshotMismatchError('schemaHash', hex64(schemaHash), hex64(data.schemaHash))
      if (data.contentHash !== contentHash) {
        throw new SnapshotMismatchError('contentHash', hex64(contentHash), hex64(data.contentHash))
      }
      if (data.tickHz !== tickHz)
        throw new SnapshotMismatchError('tickHz', String(tickHz), String(data.tickHz))
      // Build everything first; swap only when it all validated, so a bad snapshot leaves this sim untouched.
      const next = new EntityStore(componentList)
      try {
        for (const e of data.entities) {
          next.spawnWithId(
            e.sid,
            [...e.components].map(([id, values]) => [components.get(id) as ComponentDef, values] as const),
          )
        }
        next.nextId = data.nextId
        next.takeDelta(false)
        const expectedIds = sortedIds(resourceDefs)
        if (
          data.resources.length !== expectedIds.length ||
          data.resources.some((row, i) => row.id !== expectedIds[i])
        )
          throw new SnapshotFormatError('resource rows do not match the registered resources')
        const nextResources = new Map<string, unknown>()
        for (const { id, json } of data.resources) {
          const def = resourceDefs.get(id)
          if (!def) throw new SnapshotFormatError(`unknown resource "${id}"`)
          nextResources.set(id, def.schema.parse(JSON.parse(json)))
        }
        const nextRngs = new Map<string, Rng>(data.rng.map((r) => [r.name, rngFromState(r.state)]))
        if (nextRngs.size !== rngs.size || systems.some((s) => !nextRngs.has(s.name))) {
          throw new SnapshotFormatError('rng streams do not match the systems')
        }
        store.dispose()
        store = next
        for (const [id, v] of nextResources) resources.set(id, v)
        for (const [name, r] of nextRngs) rngs.set(name, r)
      } catch (err) {
        if (store !== next) next.dispose()
        throw err instanceof SnapshotFormatError ? err : new SnapshotFormatError(String(err))
      }
      tick = data.tick
      fullResync = true
      pendingDespawn = new Set()
      events = []
    },
    hash() {
      return hex64(xxhash64(sim.snapshot()))
    },
    dispose: () => store.dispose(),
  }
  return sim
}
