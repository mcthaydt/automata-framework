// What a field form shows for one typed field: the kit control that edits it, with its bounds and its
// options. Both editors' forms use it (moved from editor-2d's Level inspector, plan "field form and journeys" A1); a `ref`
// row also carries what the value is called and what it may point at, which the editor that knows its level fills in.
import type { FieldDef, FieldType, FieldValue, RefValue } from '@automata/content/level-2d'

/** The kit control a field is edited with. `list` is a list of anything but points: shown, not yet edited. */
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

/** One thing a `ref` may point at, under its group's heading. */
export interface RefChoice {
  readonly label: string
  readonly value: RefValue
}

/** A heading in the ref picker (a level, a sector) and what under it the field may point at. */
export interface RefTargetGroup {
  readonly id: string
  readonly name: string
  readonly choices: readonly RefChoice[]
}

export interface FieldRow {
  readonly id: string
  readonly label: string
  readonly type: FieldType
  /** The stored value; `undefined` when the holder has none (a required field not yet set). */
  readonly value: FieldValue | undefined
  readonly widget: FieldWidget
  /** `stepper` only. */
  readonly bounds?: { readonly min?: number; readonly max?: number; readonly step: number }
  /** `segmented` and `picker` only. */
  readonly options?: readonly string[]
  /** `ref` only, where the editor knows the level: the target's name (`undefined` when not set or broken) and the picker's groups. */
  readonly ref?: { readonly name: string | undefined; readonly targets: readonly RefTargetGroup[] }
}

/** What a form gets back when it commits a value: the model's refusal is a message shown under the field. */
export type FieldCommit = { readonly ok: true } | { readonly ok: false; readonly message: string }

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
