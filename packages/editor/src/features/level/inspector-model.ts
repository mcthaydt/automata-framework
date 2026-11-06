import { type FieldRow, fieldRow } from '../../shared/kit/fields/field-row.ts'
import type { FieldDef, FieldValues } from '../../shared/kit/fields/field-types.ts'
import { valuesWithDefaults } from '../../shared/kit/fields/field-values.ts'
import type { EntityDef2D, EntityInstance, Project, Size } from '../../shared/level-2d/model/project-types'
import { refName, refTargets } from '../../shared/level-2d/model/refs/ref-links'
import { isRefValue } from '../../shared/level-2d/model/refs/ref-resolve'
import { findLevel } from '../../shared/level-2d/model/world/level-edits'
import type { Diagnostic, Severity } from '../../shared/level-2d/profiles/profile'

// What the Level view's inspector shows: one row per typed
// field, naming the kit control that edits it, for the selected instance (Entity tab) and the level (Level tab). The
// model holds no Svelte, so the field-to-widget map and the none/one/many rule are tested in Node.

/** The project's side of a `ref` row: what the value is called and what it may point at instead. */
function withRef(row: FieldRow, def: FieldDef, project: Project, holder: string | undefined): FieldRow {
  if (row.widget !== 'ref') return row
  const name = isRefValue(row.value) ? refName(project, def, row.value) : undefined
  return { ...row, ref: { name, targets: refTargets(project, def, holder) } }
}

/**
 * A field's stored value, or its stand-in (the kit's default) when the holder stores none. `holder` is the instance the
 * fields belong to (never its own target), `undefined` for a level's.
 */
function rowsOf(
  fields: readonly FieldDef[],
  values: FieldValues,
  project: Project,
  holder: string | undefined,
): readonly FieldRow[] {
  const shown = valuesWithDefaults(fields, values)
  return fields.map((field) => withRef(fieldRow(field, shown[field.id]), field, project, holder))
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
    fields: rowsOf(def.fields, instance.fields, project, instance.id),
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
    fields: rowsOf(project.defs.levelFields, found.fields, project, undefined),
  }
}

export interface CheckRow {
  readonly severity: Severity
  readonly message: string
  readonly path: string
  /** The instance the finding is about, which tapping the row selects. */
  readonly item: string | undefined
}

const ITEM = /\.items\[([^\]]+)\]/

/** The profile's findings about `level` (its path is `levels[<id>]` or under it), in the profile's order. */
export function levelChecks(found: readonly Diagnostic[], level: string): readonly CheckRow[] {
  const prefix = `levels[${level}]`
  return found
    .filter((each) => each.path === prefix || each.path.startsWith(`${prefix}.`))
    .map((each) => ({
      severity: each.severity,
      message: each.message,
      path: each.path,
      item: ITEM.exec(each.path)?.[1],
    }))
}
