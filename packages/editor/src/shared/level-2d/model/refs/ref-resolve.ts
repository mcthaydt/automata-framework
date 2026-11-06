import type { FieldDef, FieldValue, RefValue } from '@mcthaydt/automata-content/level-2d'
import type { Project } from '../project-types'

// What a `ref` value points at. A field's `to` says what it may
// point at: `$level` is a level id and any other entry is an entity definition id, whose instances are found by their
// id (ids are unique in a project). A value with a `container` must be in that level. The link checks, the reference
// picker and both canvases read this one rule, so a link the Checks call broken is never drawn.

const LEVEL = '$level'

export const isRefValue = (value: FieldValue | undefined): value is RefValue =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  typeof (value as { target?: unknown }).target === 'string'

interface IndexedInstance {
  readonly id: string
  readonly def: string
  readonly level: string
  readonly x: number
  readonly y: number
}

/** The project's levels and instances by id, built once for many lookups. */
export interface RefIndex {
  readonly levels: ReadonlySet<string>
  readonly instances: ReadonlyMap<string, IndexedInstance>
}

export function refIndex(project: Project): RefIndex {
  const instances = new Map<string, IndexedInstance>()
  for (const level of project.levels)
    for (const layer of level.layers) {
      if (layer.kind !== 'entities') continue
      for (const item of layer.items)
        instances.set(item.id, { id: item.id, def: item.def, level: level.id, x: item.x, y: item.y })
    }
  return { levels: new Set(project.levels.map((level) => level.id)), instances }
}

export type ResolvedRef =
  | {
      readonly ok: true
      readonly level: string
      /** Absent when the target is the level itself. */
      readonly item?: { readonly id: string; readonly def: string; readonly x: number; readonly y: number }
    }
  | { readonly ok: false; readonly code: 'brokenRef' | 'refWrongKind'; readonly message: string }

export function resolveRef(index: RefIndex, field: FieldDef, ref: RefValue): ResolvedRef {
  const allowed = field.to ?? []
  const any = allowed.length === 0
  const { target } = ref
  const instance = index.instances.get(target)
  if (instance === undefined) {
    const isLevel =
      ref.container === undefined && index.levels.has(target) && (any || allowed.includes(LEVEL))
    return isLevel
      ? { ok: true, level: target }
      : { ok: false, code: 'brokenRef', message: `"${target}" does not exist.` }
  }
  if (ref.container !== undefined && instance.level !== ref.container) {
    const gone = index.levels.has(ref.container) ? '' : ', which does not exist'
    return { ok: false, code: 'brokenRef', message: `"${target}" is not in level "${ref.container}"${gone}.` }
  }
  if (!any && !allowed.includes(instance.def)) {
    const kinds = allowed.map((entry) => (entry === LEVEL ? 'a level' : entry)).join(', ')
    return {
      ok: false,
      code: 'refWrongKind',
      message: `"${target}" is a ${instance.def}, but "${field.id}" points at ${kinds}.`,
    }
  }
  const { id, def, x, y } = instance
  return { ok: true, level: instance.level, item: { id, def, x, y } }
}
