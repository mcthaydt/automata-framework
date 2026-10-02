import { type Trait, trait } from 'koota'
import type { z } from 'zod'
import { sortedKeys } from '../util/sorted'
import type { SimContext } from './context'
import { defaultField, FIELD_TYPES, type FieldSchema, type FieldType } from './fields'

/** Fixed phase order (spec §4.3). */
export const PHASES = ['input', 'prePhysics', 'physics', 'postPhysics', 'gameplay', 'cleanup'] as const
export type Phase = (typeof PHASES)[number]

// Stable ids key the snapshot, network and save formats: lower-case, dot- or dash-separated words.
const ID_RE = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/
const FIELD_RE = /^[A-Za-z_][A-Za-z0-9_]*$/

function checkId(what: string, id: string): void {
  if (!ID_RE.test(id)) throw new Error(`${what} id "${id}" must match ${ID_RE}`)
}

export interface ComponentDef<S extends FieldSchema = FieldSchema> {
  readonly kind: 'component'
  readonly id: string
  readonly fields: S
  /** Field names in sorted order: the order used by snapshots. */
  readonly fieldNames: readonly string[]
  /** Included in RenderDelta rows (default true). */
  readonly render: boolean
  /** Internal Koota storage. Game code never touches it. */
  readonly trait: Trait
}

export function defineComponent<S extends FieldSchema>(
  id: string,
  fields: S,
  opts: { render?: boolean } = {},
): ComponentDef<S> {
  checkId('component', id)
  const fieldNames = sortedKeys(fields)
  if (fieldNames.length === 0) throw new Error(`component "${id}" needs at least one field`)
  const defaults: Record<string, number | boolean | string> = {}
  for (const name of fieldNames) {
    const type = fields[name] as FieldType
    if (!FIELD_RE.test(name)) throw new Error(`component "${id}" has invalid field name "${name}"`)
    if (!FIELD_TYPES.includes(type))
      throw new Error(`component "${id}" field "${name}" has unknown field type "${type}"`)
    defaults[name] = defaultField(type)
  }
  return { kind: 'component', id, fields, fieldNames, render: opts.render ?? true, trait: trait(defaults) }
}

export interface CommandDef<Z extends z.ZodType = z.ZodType> {
  readonly kind: 'command'
  readonly id: string
  readonly schema: Z
}

export function defineCommand<Z extends z.ZodType>(id: string, schema: Z): CommandDef<Z> {
  checkId('command', id)
  return { kind: 'command', id, schema }
}

export interface EventDef<Z extends z.ZodType = z.ZodType> {
  readonly kind: 'event'
  readonly id: string
  readonly schema: Z
}

export function defineEvent<Z extends z.ZodType>(id: string, schema: Z): EventDef<Z> {
  checkId('event', id)
  return { kind: 'event', id, schema }
}

export interface ResourceDef<Z extends z.ZodType = z.ZodType> {
  readonly kind: 'resource'
  readonly id: string
  readonly schema: Z
  readonly init: () => z.input<Z>
}

export function defineResource<Z extends z.ZodType>(
  id: string,
  schema: Z,
  init: () => z.input<Z>,
): ResourceDef<Z> {
  checkId('resource', id)
  return { kind: 'resource', id, schema, init }
}

export interface SystemDef {
  readonly kind: 'system'
  readonly name: string
  readonly phase: Phase
  readonly before: readonly string[]
  readonly after: readonly string[]
  readonly run: (ctx: SimContext) => void
}

export function defineSystem(spec: {
  name: string
  phase: Phase
  before?: readonly string[]
  after?: readonly string[]
  run: (ctx: SimContext) => void
}): SystemDef {
  checkId('system', spec.name)
  if (!PHASES.includes(spec.phase)) throw new Error(`system "${spec.name}" has unknown phase "${spec.phase}"`)
  return {
    kind: 'system',
    name: spec.name,
    phase: spec.phase,
    before: spec.before ?? [],
    after: spec.after ?? [],
    run: spec.run,
  }
}

export interface PluginDef {
  readonly kind: 'plugin'
  readonly name: string
  readonly dependsOn: readonly string[]
  readonly components: readonly ComponentDef[]
  readonly commands: readonly CommandDef[]
  readonly events: readonly EventDef[]
  readonly resources: readonly ResourceDef[]
  readonly systems: readonly SystemDef[]
}

export function definePlugin(spec: {
  name: string
  dependsOn?: readonly string[]
  components?: readonly ComponentDef[]
  commands?: readonly CommandDef[]
  events?: readonly EventDef[]
  resources?: readonly ResourceDef[]
  systems?: readonly SystemDef[]
}): PluginDef {
  checkId('plugin', spec.name)
  return {
    kind: 'plugin',
    name: spec.name,
    dependsOn: spec.dependsOn ?? [],
    components: spec.components ?? [],
    commands: spec.commands ?? [],
    events: spec.events ?? [],
    resources: spec.resources ?? [],
    systems: spec.systems ?? [],
  }
}
