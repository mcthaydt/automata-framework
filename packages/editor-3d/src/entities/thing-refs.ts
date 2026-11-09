// What a thing's ref fields point at (ED3D spec §4.7): shared by the ref check, which asks where each one leads, and by
// the edits, which ask what still leads to a thing they are about to take away.
import type { FieldDef } from '@automataframework/automata-editor/kit/fields'
import type { Thing } from './things'

/** The target of a ref value, or `undefined` for anything else (the reader has refused a ref with no target). */
export function targetOf(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const { target } = value as { target?: unknown }
  return typeof target === 'string' ? target : undefined
}

/** One ref of a thing: the field and, for a list field, the item it is, what it points at and what the field allows. */
export interface ThingRef {
  readonly field: string
  /** `field`, or `field item <n>` for a list field: how a sentence names it. */
  readonly which: string
  readonly target: string
  /** The field's `to`: the definitions (and `$sector`) it may point at; empty is anything. */
  readonly to: readonly string[]
}

/** The refs of one thing that point at something, fields in definition order, list items in order. */
export function refsOf(thing: Thing, fields: readonly FieldDef[]): ThingRef[] {
  const refs: ThingRef[] = []
  for (const field of fields) {
    if (field.type !== 'ref') continue
    const value = thing.values[field.id]
    const items = field.list ? (Array.isArray(value) ? value : []) : [value]
    items.forEach((item, index) => {
      const target = targetOf(item)
      if (target !== undefined)
        refs.push({
          field: field.id,
          which: field.list ? `${field.id} item ${index}` : field.id,
          target,
          to: field.to ?? [],
        })
    })
  }
  return refs
}
