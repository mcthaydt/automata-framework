import type { FieldDef, FieldValues } from '../../../../kit/fields/field-types.ts'
import { checkValues } from '../../../../kit/fields/field-values.ts'
import type { EntityDef2D, Project } from '../../../model/project-types'
import type { Diagnostic } from '../../profile'
import { diagnostic, itemPath, levelPath } from './diagnostics'

// Checks of what entities say about themselves (2D editor spec §9, "Entities"): their typed fields, how many of a
// definition a level may hold, and how many a level or the project must hold. Limits are data on the definition
// (`single`, `min`), so a template's rules need no template code. What a `ref` field points at is `links.ts`.

/** The kit's problems with `values` as diagnostics at `<path>.fields.<field>`. */
function fieldDiagnostics(fields: readonly FieldDef[], values: FieldValues, path: string): Diagnostic[] {
  return checkValues(fields, values).map((problem) =>
    diagnostic(
      'error',
      problem.code === 'fieldMissing' ? 'fieldMissing' : 'fieldInvalid',
      `${path}.fields.${problem.fieldId}`,
      problem.message,
    ),
  )
}

const label = (def: EntityDef2D): string => def.label ?? def.id

function countText(count: number): string {
  return count === 0 ? 'none' : `${count}`
}

export function entityChecks(project: Project): Diagnostic[] {
  const found: Diagnostic[] = []
  const defs = new Map(project.defs.entities.map((def) => [def.id, def]))
  const inProject = new Map<string, number>()
  const perLevel: { levelId: string; levelName: string; counts: Map<string, number> }[] = []

  for (const level of project.levels) {
    found.push(...fieldDiagnostics(project.defs.levelFields, level.fields, levelPath(level.id)))
    const counts = new Map<string, number>()
    for (const layer of level.layers) {
      if (layer.kind !== 'entities') continue
      for (const item of layer.items) {
        const def = defs.get(item.def)
        if (def === undefined) continue // `unknownEntityDef` reports it
        const path = itemPath(level.id, layer.def, item.id)
        found.push(...fieldDiagnostics(def.fields, item.fields, path))
        const seen = (counts.get(def.id) ?? 0) + 1
        counts.set(def.id, seen)
        inProject.set(def.id, (inProject.get(def.id) ?? 0) + 1)
        if (def.single && seen > 1) {
          found.push(
            diagnostic(
              'error',
              'singleExceeded',
              path,
              `A level holds at most one "${label(def)}"; this is number ${seen} in "${level.name}".`,
            ),
          )
        }
      }
    }
    perLevel.push({ levelId: level.id, levelName: level.name, counts })
  }

  for (const def of project.defs.entities) {
    if (def.min === undefined) continue
    if (def.min.per === 'project') {
      const have = inProject.get(def.id) ?? 0
      if (have < def.min.count) {
        found.push(
          diagnostic(
            'error',
            'minNotMet',
            `defs.entities[${def.id}]`,
            `The project needs at least ${def.min.count} "${label(def)}" and has ${countText(have)}.`,
          ),
        )
      }
      continue
    }
    for (const level of perLevel) {
      const have = level.counts.get(def.id) ?? 0
      if (have < def.min.count) {
        found.push(
          diagnostic(
            'error',
            'minNotMet',
            levelPath(level.levelId),
            `Level "${level.levelName}" needs at least ${def.min.count} "${label(def)}" and has ${have}.`,
          ),
        )
      }
    }
  }
  return found
}
