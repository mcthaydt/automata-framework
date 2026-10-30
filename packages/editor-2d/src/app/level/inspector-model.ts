import {
  type FieldDef,
  type FieldType,
  type FieldValue,
  type FieldValues,
  valuesWithDefaults,
} from '@mcthaydt/automata-editor-kit/fields'
import type { EntityDef2D, EntityInstance, Project, Size } from '../../model/project-types'
import { findLevel } from '../../model/world/level-edits'

// What the Level view's inspector shows (2D editor spec §8, the Level row; plan ED2D.4c4b step 2): one row per typed
// field, naming the kit control that edits it, for the selected instance (Entity tab) and the level (Level tab). The
// model holds no Svelte, so the field-to-widget map and the none/one/many rule are tested in Node.

/** The kit control a field is edited with. `list` is a list of anything but points: shown, edited in a later task. */
export type FieldWidget =
  | 'stepper'
  | 'toggle'
  | 'segmented'
  | 'picker'
  | 'color'
  | 'text'
  | 'multiline'
  | 'point'
  | 'points'
  | 'ref'
  | 'list'

export interface FieldRow {
  readonly id: string
  readonly label: string
  readonly type: FieldType
  /** The stored value; `undefined` when the instance has none (a required field not yet set). */
  readonly value: FieldValue | undefined
  readonly widget: FieldWidget
  /** `stepper` only. */
  readonly bounds?: { readonly min?: number; readonly max?: number; readonly step: number }
  /** `segmented` and `picker` only. */
  readonly options?: readonly string[]
}

/** Past this many options an enum is a picker, so a segmented control never wraps at phone width. */
const SEGMENTED_LIMIT = 5

function widgetOf(def: FieldDef): FieldWidget {
  if (def.list === true) return def.type === 'point' ? 'points' : 'list'
  switch (def.type) {
    case 'int':
    case 'float':
    case 'angle':
      return 'stepper'
    case 'bool':
      return 'toggle'
    case 'enum':
      return (def.options?.length ?? 0) > SEGMENTED_LIMIT ? 'picker' : 'segmented'
    case 'color':
      return 'color'
    case 'text':
      return def.multiline === true ? 'multiline' : 'text'
    case 'point':
      return 'point'
    case 'ref':
      return 'ref'
  }
}

function boundsOf(def: FieldDef): NonNullable<FieldRow['bounds']> {
  return {
    ...(def.min === undefined ? {} : { min: def.min }),
    ...(def.max === undefined ? {} : { max: def.max }),
    step: def.step ?? 1,
  }
}

export function fieldRow(def: FieldDef, value: FieldValue | undefined): FieldRow {
  const widget = widgetOf(def)
  return {
    id: def.id,
    label: def.label ?? def.id,
    type: def.type,
    value,
    widget,
    ...(widget === 'stepper' ? { bounds: boundsOf(def) } : {}),
    ...(widget === 'segmented' || widget === 'picker' ? { options: def.options ?? [] } : {}),
  }
}

/** A field's stored value, or its stand-in (the kit's default) when the holder stores none. */
function rowsOf(fields: readonly FieldDef[], values: FieldValues): readonly FieldRow[] {
  const shown = valuesWithDefaults(fields, values)
  return fields.map((field) => fieldRow(field, shown[field.id]))
}

export type EntityInspector =
  | { readonly kind: 'none'; readonly reason: string }
  | { readonly kind: 'many'; readonly count: number }
  | {
      readonly kind: 'one'
      /** The entities layer's definition id the instance is on. */
      readonly layer: string
      readonly instance: EntityInstance
      readonly def: EntityDef2D
      readonly fields: readonly FieldRow[]
      readonly position: { readonly x: number; readonly y: number }
      /** Only when the definition is resizable. */
      readonly size: Size | undefined
    }

const NOTHING_SELECTED = 'Select a thing on the canvas to see its fields'

/** The selected instances of `level` (ids it no longer has are skipped) as the Entity tab shows them. */
export function entityInspector(
  project: Project,
  level: string,
  selected: readonly string[],
): EntityInspector {
  const wanted = new Set(selected)
  const found: { layer: string; instance: EntityInstance }[] = []
  for (const layer of findLevel(project, level).layers) {
    if (layer.kind !== 'entities') continue
    for (const instance of layer.items)
      if (wanted.has(instance.id)) found.push({ layer: layer.def, instance })
  }
  const [first] = found
  if (first === undefined) return { kind: 'none', reason: NOTHING_SELECTED }
  if (found.length > 1) return { kind: 'many', count: found.length }
  const { instance } = first
  const def = project.defs.entities.find((candidate) => candidate.id === instance.def)
  if (def === undefined) throw new RangeError(`no entity definition "${instance.def}"`)
  return {
    kind: 'one',
    layer: first.layer,
    instance,
    def,
    fields: rowsOf(def.fields, instance.fields),
    position: { x: instance.x, y: instance.y },
    size: def.resizable === 'none' ? undefined : { w: instance.w ?? def.size.w, h: instance.h ?? def.size.h },
  }
}

export interface LevelInspector {
  readonly id: string
  readonly name: string
  readonly size: Size
  readonly fields: readonly FieldRow[]
}

export function levelInspector(project: Project, level: string): LevelInspector {
  const found = findLevel(project, level)
  return {
    id: found.id,
    name: found.name,
    size: found.size,
    fields: rowsOf(project.defs.levelFields, found.fields),
  }
}
