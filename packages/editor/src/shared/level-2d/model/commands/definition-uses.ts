// Finds where a layer, entity or tileset definition is used, so deleting one can say what it would break first;
// deleting then removes it along with what depended on it.

import { defaultFieldValue } from '../../../kit/fields/check-field-def.ts'
import type { FieldValues } from '../../../kit/fields/field-types.ts'
import { hasValue } from '../../../kit/fields/field-values.ts'
import type { LayerInstance, Project } from '../project-types'
import { type DefinitionUse, type GuardedEdit, layerDefOf } from './def-lookup'
import {
  entityDefOf,
  type FieldOwner,
  fieldsOf,
  itemPath,
  levelPath,
  mapValues,
  valueHolders,
  withFields,
} from './field-owner'

// Deleting a definition that is in use. `definitionUses` lists what
// the delete would take with it, so the refusal dialog names the exact instances; `deleteDefinition` refuses with
// that list, and with `anyway` ("Delete anyway") removes the definition and its uses in one returned project, which
// the app applies as one `History` step. A definition nothing uses is deleted without asking.
//
// A ref that pointed at a removed instance is not a use: it is a value of another instance, and the Checks report it
// (`brokenRef`) and link it. A ref field's `to` that names a removed entity definition is kept, since dropping the
// last name would widen the field to "any".

export type DefinitionRef =
  | { readonly kind: 'layer'; readonly id: string }
  | { readonly kind: 'entity'; readonly id: string }
  | { readonly kind: 'field'; readonly owner: FieldOwner; readonly id: string }

/** How much a level's instance of a layer holds; 0 is an empty layer, which deleting loses nothing from. */
function contentOf(layer: LayerInstance): number {
  switch (layer.kind) {
    case 'tiles':
    case 'intgrid':
      return layer.cells.chunkCount
    case 'auto':
      return layer.overrides.chunkCount
    case 'entities':
    case 'objects':
      return layer.items.length
  }
}

/** The layer and the auto layers that read it: what deleting it removes. */
function layersRemovedWith(project: Project, id: string): ReadonlySet<string> {
  layerDefOf(project, id)
  const removed = new Set([id])
  for (const def of project.defs.layers) if (def.kind === 'auto' && def.source === id) removed.add(def.id)
  return removed
}

function layerUses(project: Project, id: string): DefinitionUse[] {
  const def = layerDefOf(project, id)
  const uses: DefinitionUse[] = []
  for (const level of project.levels) {
    const layer = level.layers.find((candidate) => candidate.def === id)
    if (layer !== undefined && contentOf(layer) > 0)
      uses.push({
        path: `${levelPath(level.id)}.layers[${id}]`,
        message: `"${level.name}" has content on layer "${def.label}".`,
      })
  }
  for (const reader of project.defs.layers) {
    if (reader.kind === 'auto' && reader.source === id)
      uses.push({
        path: `defs.layers[${reader.id}]`,
        message: `Auto layer "${reader.label}" draws from "${def.label}" and goes with it.`,
      })
  }
  return uses
}

function entityUses(project: Project, id: string): DefinitionUse[] {
  const def = entityDefOf(project, id)
  const uses: DefinitionUse[] = []
  for (const level of project.levels) {
    for (const layer of level.layers) {
      if (layer.kind !== 'entities') continue
      for (const item of layer.items) {
        if (item.def === id)
          uses.push({
            path: itemPath(level.id, layer.def, item.id),
            message: `${def.label ?? def.id} ${item.id} in "${level.name}".`,
          })
      }
    }
  }
  return uses
}

/**
 * The holders whose value for the field someone chose. A value equal to the field's stand-in (`defaultFieldValue`) is
 * what every instance gets on placement without anyone choosing it, so deleting it loses nothing and is not listed.
 */
function fieldUses(project: Project, owner: FieldOwner, id: string): DefinitionUse[] {
  const field = fieldsOf(project, owner).find((candidate) => candidate.id === id)
  if (field === undefined) throw new RangeError(`no field "${id}"`)
  const standIn = defaultFieldValue(field)
  const chosen = (values: FieldValues): boolean =>
    hasValue(values, id) && (standIn === undefined || JSON.stringify(values[id]) !== JSON.stringify(standIn))
  return valueHolders(project, owner)
    .filter((holder) => chosen(holder.values))
    .map((holder) => ({
      path: `${holder.path}.fields.${id}`,
      message: `${holder.id} holds a value for "${id}".`,
    }))
}

/** What deleting the definition would remove, in level order; empty when nothing uses it. */
export function definitionUses(project: Project, ref: DefinitionRef): readonly DefinitionUse[] {
  switch (ref.kind) {
    case 'layer':
      return layerUses(project, ref.id)
    case 'entity':
      return entityUses(project, ref.id)
    case 'field':
      return fieldUses(project, ref.owner, ref.id)
  }
}

function removeLayers(project: Project, id: string): Project {
  const removed = layersRemovedWith(project, id)
  return {
    ...project,
    defs: { ...project.defs, layers: project.defs.layers.filter((def) => !removed.has(def.id)) },
    levels: project.levels.map((level) => ({
      ...level,
      layers: level.layers.filter((layer) => !removed.has(layer.def)),
    })),
  }
}

function removeEntityDef(project: Project, id: string): Project {
  const def = entityDefOf(project, id)
  const used = entityUses(project, id).length > 0
  return {
    ...project,
    defs: { ...project.defs, entities: project.defs.entities.filter((candidate) => candidate !== def) },
    levels: !used
      ? project.levels
      : project.levels.map((level) => ({
          ...level,
          layers: level.layers.map((layer) =>
            layer.kind === 'entities'
              ? { ...layer, items: layer.items.filter((item) => item.def !== id) }
              : layer,
          ),
        })),
  }
}

function removeField(project: Project, owner: FieldOwner, id: string): Project {
  const kept = fieldsOf(project, owner).filter((field) => field.id !== id)
  return mapValues(withFields(project, owner, kept), owner, (values) => {
    if (!Object.hasOwn(values, id)) return values
    const { [id]: _removed, ...rest } = values
    return rest
  })
}

/**
 * Deletes a definition. In use, it refuses with `definitionUses` unless `anyway`, which removes the uses too: an
 * entity definition's instances, a field's values, a layer's instances and the auto layers that read it.
 */
export function deleteDefinition(
  project: Project,
  ref: DefinitionRef,
  options: { readonly anyway?: boolean } = {},
): GuardedEdit {
  const uses = definitionUses(project, ref)
  if (uses.length > 0 && options.anyway !== true) return { ok: false, uses }
  switch (ref.kind) {
    case 'layer':
      return { ok: true, project: removeLayers(project, ref.id) }
    case 'entity':
      return { ok: true, project: removeEntityDef(project, ref.id) }
    case 'field':
      return { ok: true, project: removeField(project, ref.owner, ref.id) }
  }
}
