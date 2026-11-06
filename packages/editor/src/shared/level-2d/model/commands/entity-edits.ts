import { checkFieldValue } from '../../../kit/fields/check-field-value.ts'
import type { FieldValue } from '../../../kit/fields/field-types.ts'
import { valuesWithDefaults } from '../../../kit/fields/field-values.ts'
import type { Point } from '../../tiles/footprint'
import type {
  EntitiesLayerInstance,
  EntityDef2D,
  EntityInstance,
  LayerDef,
  LayerInstance,
  Project,
} from '../project-types'
import { findLayer, idInUse, type LayerTarget, updateLayer } from './layer-target'
import { wholePixels } from './pixels'

// The entity tools' edits on a project. An instance is placed, moved, resized,
// given field values, copied and deleted here; where it sits on screen is `entity-geometry.ts`. A missing level,
// layer, instance or definition is a programmer error and throws `RangeError`; a value a person typed that the
// definition rejects throws one too, carrying the kit's message, so the inspector can show it and keep the old value.

function entitiesOf(layer: LayerInstance, def: LayerDef): EntitiesLayerInstance {
  if (layer.kind !== 'entities') throw new RangeError(`layer "${def.id}" has no entities`)
  return layer
}

function definitionOf(project: Project, id: string): EntityDef2D {
  const found = project.defs.entities.find((candidate) => candidate.id === id)
  if (found === undefined) throw new RangeError(`no entity definition "${id}"`)
  return found
}

/** Applies `change` to one instance of an entities layer; the layer is untouched when `change` returns the same one. */
function editInstance(
  project: Project,
  target: LayerTarget,
  id: string,
  change: (item: EntityInstance, def: EntityDef2D) => EntityInstance,
): Project {
  return updateLayer(project, target, (layer, layerDef) => {
    const entities = entitiesOf(layer, layerDef)
    const index = entities.items.findIndex((candidate) => candidate.id === id)
    const item = entities.items[index]
    if (item === undefined) throw new RangeError(`no entity "${id}" in layer "${layerDef.id}"`)
    const next = change(item, definitionOf(project, item.def))
    if (next === item) return layer
    return { ...entities, items: entities.items.map((candidate, i) => (i === index ? next : candidate)) }
  })
}

/**
 * Appends an instance of definition `input.def` with the definition's default field values; a resizable definition
 * starts at its own size. A `single` definition is never placed twice: when the level already has one (on any entities
 * layer) that instance moves to the new position instead, so the tool never has to refuse and explain.
 */
export function placeEntity(
  project: Project,
  target: LayerTarget,
  input: { readonly id: string; readonly def: string; readonly x: number; readonly y: number },
): Project {
  const { level, layer, def } = findLayer(project, target)
  entitiesOf(layer, def)
  const definition = definitionOf(project, input.def)
  if (definition.single === true) {
    for (const candidate of level.layers) {
      const existing =
        candidate.kind === 'entities' ? candidate.items.find((item) => item.def === input.def) : undefined
      if (existing !== undefined)
        return moveEntity(project, { level: level.id, layer: candidate.def }, existing.id, input.x, input.y)
    }
  }
  if (idInUse(project, input.id)) throw new RangeError(`entity id "${input.id}" is already used`)
  const size = definition.resizable === 'none' ? {} : { w: definition.size.w, h: definition.size.h }
  const instance: EntityInstance = {
    id: input.id,
    def: input.def,
    x: wholePixels(input.x),
    y: wholePixels(input.y),
    ...size,
    fields: valuesWithDefaults(definition.fields, {}),
  }
  return updateLayer(project, target, (current) => {
    const entities = entitiesOf(current, def)
    return { ...entities, items: [...entities.items, instance] }
  })
}

/** Moves an instance to a position in level pixels. Snapping is the tool's business, not the command's. */
export function moveEntity(project: Project, target: LayerTarget, id: string, x: number, y: number): Project {
  const nextX = wholePixels(x)
  const nextY = wholePixels(y)
  return editInstance(project, target, id, (item) =>
    item.x === nextX && item.y === nextY ? item : { ...item, x: nextX, y: nextY },
  )
}

/** Sets an instance's size. A definition resizable in one direction keeps the other side as it is. */
export function resizeEntity(
  project: Project,
  target: LayerTarget,
  id: string,
  w: number,
  h: number,
): Project {
  const nextW = wholePixels(w)
  const nextH = wholePixels(h)
  if (nextW < 1 || nextH < 1) throw new RangeError(`a size of ${nextW} × ${nextH} is smaller than one pixel`)
  return editInstance(project, target, id, (item, def) => {
    const currentW = item.w ?? def.size.w
    const currentH = item.h ?? def.size.h
    if (def.resizable === 'none') throw new RangeError(`"${def.id}" cannot be resized`)
    if ((def.resizable === 'x' && nextH !== currentH) || (def.resizable === 'y' && nextW !== currentW))
      throw new RangeError(`"${def.id}" can only be resized in ${def.resizable}`)
    return nextW === currentW && nextH === currentH ? item : { ...item, w: nextW, h: nextH }
  })
}

/**
 * Stores a value in one field of an instance after the field's own rules (the kit's `checkFieldValue`) have accepted
 * it. A rejected value throws with the problem's message and nothing changes.
 */
export function setEntityField(
  project: Project,
  target: LayerTarget,
  id: string,
  field: string,
  value: FieldValue,
): Project {
  return editInstance(project, target, id, (item, def) => {
    const fieldDef = def.fields.find((candidate) => candidate.id === field)
    if (fieldDef === undefined) throw new RangeError(`"${def.id}" has no field "${field}"`)
    const problem = checkFieldValue(fieldDef, value)
    if (problem !== undefined) throw new RangeError(problem.message)
    if (JSON.stringify(item.fields[field]) === JSON.stringify(value)) return item
    return { ...item, fields: { ...item.fields, [field]: value } }
  })
}

export function deleteEntity(project: Project, target: LayerTarget, id: string): Project {
  return updateLayer(project, target, (layer, layerDef) => {
    const entities = entitiesOf(layer, layerDef)
    if (!entities.items.some((candidate) => candidate.id === id))
      throw new RangeError(`no entity "${id}" in layer "${layerDef.id}"`)
    return { ...entities, items: entities.items.filter((candidate) => candidate.id !== id) }
  })
}

/** A copy of an instance under `copyId`, moved by `offset` and placed on top. A `single` definition cannot be copied. */
export function duplicateEntity(
  project: Project,
  target: LayerTarget,
  id: string,
  copyId: string,
  offset: Point,
): Project {
  return updateLayer(project, target, (layer, layerDef) => {
    const entities = entitiesOf(layer, layerDef)
    const original = entities.items.find((candidate) => candidate.id === id)
    if (original === undefined) throw new RangeError(`no entity "${id}" in layer "${layerDef.id}"`)
    if (definitionOf(project, original.def).single === true)
      throw new RangeError(`"${original.def}" is single, so it cannot be duplicated`)
    if (idInUse(project, copyId)) throw new RangeError(`entity id "${copyId}" is already used`)
    const copy: EntityInstance = {
      ...original,
      id: copyId,
      x: wholePixels(original.x + offset.x),
      y: wholePixels(original.y + offset.y),
    }
    return { ...entities, items: [...entities.items, copy] }
  })
}
