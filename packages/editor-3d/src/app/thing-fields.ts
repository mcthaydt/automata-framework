// The field rows of a thing's inspector card (ED3D.7d-b; ED3D spec §4.7): the kit's `fieldRow` over the definition's
// fields and the thing's values (a field the thing lacks shows its default), and for a `ref` row what it is called and
// what it may point at: the level's things, grouped by definition, and its rooms when the field allows `$sector`.
import {
  type FieldDef,
  type FieldRow,
  fieldRow,
  type RefChoice,
  type RefTargetGroup,
  valuesWithDefaults,
} from '@mcthaydt/automata-editor-kit/fields'
import type { ThingDef } from '../entities/thing-def.schema'
import { targetOf } from '../entities/thing-refs'
import type { Thing } from '../entities/things'

const SECTOR = '$sector'

interface Level {
  readonly definitions: readonly ThingDef[]
  readonly things: readonly Thing[]
  readonly sectorIds: readonly string[]
}

/** What `field` may point at, other than `holder` itself, in definition order and then the rooms. */
function targetsFor(field: FieldDef, holder: Thing, level: Level): readonly RefTargetGroup[] {
  const allowed = field.to ?? []
  const any = allowed.length === 0
  const groups: RefTargetGroup[] = []
  for (const definition of level.definitions) {
    if (!any && !allowed.includes(definition.id)) continue
    const choices: RefChoice[] = level.things
      .filter((thing) => thing.def === definition.id && thing !== holder)
      .map((thing) => ({ label: thing.id, value: { target: thing.id } }))
    if (choices.length > 0)
      groups.push({ id: definition.id, name: definition.label ?? definition.id, choices })
  }
  if ((any || allowed.includes(SECTOR)) && level.sectorIds.length > 0)
    groups.push({
      id: SECTOR,
      name: 'Rooms',
      choices: level.sectorIds.map((id) => ({ label: id, value: { target: id } })),
    })
  return groups
}

/** What a ref value is called: the target's id, or `undefined` when nothing is set or it points at nothing in the level. */
function nameOf(value: unknown, targets: readonly RefTargetGroup[]): string | undefined {
  const target = targetOf(value)
  if (target === undefined) return undefined
  return targets.flatMap((group) => group.choices).find((choice) => choice.value.target === target)?.label
}

export function thingFieldRows(thing: Thing, definition: ThingDef, level: Level): readonly FieldRow[] {
  const values = valuesWithDefaults(definition.fields, thing.values)
  return definition.fields.map((field) => {
    const row = fieldRow(field, values[field.id])
    if (row.widget !== 'ref') return row
    const targets = targetsFor(field, thing, level)
    return { ...row, ref: { name: nameOf(row.value, targets), targets } }
  })
}
