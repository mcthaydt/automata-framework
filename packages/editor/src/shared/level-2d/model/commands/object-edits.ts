import type { LayerDef, LayerInstance, ObjectInstance, ObjectsLayerInstance, Project } from '../project-types'
import { tilesetTiles } from '../tileset-grid'
import { findLayer, idInUse, type LayerTarget, updateLayer } from './layer-target'
import { wholePixels } from './pixels'

// The edits of an objects layer (2D editor spec §5.1): free-placed tiles such as trees, props and decoration, with a
// flip on each axis. Same rules as `entity-edits.ts`: a missing target is a `RangeError`, an edit that changes nothing
// returns the same project, and positions are whole pixels (snapping is the tool's business).

function objectsOf(layer: LayerInstance, def: LayerDef): ObjectsLayerInstance {
  if (layer.kind !== 'objects') throw new RangeError(`layer "${def.id}" has no objects`)
  return layer
}

function editObject(
  project: Project,
  target: LayerTarget,
  id: string,
  change: (object: ObjectInstance) => ObjectInstance,
): Project {
  return updateLayer(project, target, (layer, def) => {
    const objects = objectsOf(layer, def)
    const index = objects.items.findIndex((candidate) => candidate.id === id)
    const object = objects.items[index]
    if (object === undefined) throw new RangeError(`no object "${id}" in layer "${def.id}"`)
    const next = change(object)
    if (next === object) return layer
    return { ...objects, items: objects.items.map((candidate, i) => (i === index ? next : candidate)) }
  })
}

/** Appends an object. Its tile has to exist in the layer's tileset, so the Checks never see `tileOutOfRange` from here. */
export function placeObject(
  project: Project,
  target: LayerTarget,
  input: {
    readonly id: string
    readonly tile: number
    readonly x: number
    readonly y: number
    readonly flipX?: boolean
    readonly flipY?: boolean
  },
): Project {
  const { layer, def } = findLayer(project, target)
  if (layer.kind !== 'objects' || def.kind !== 'objects')
    throw new RangeError(`layer "${def.id}" has no objects`)
  const tileset = project.defs.tilesets.find((candidate) => candidate.id === def.tileset)
  if (tileset === undefined)
    throw new RangeError(`layer "${def.id}" uses tileset "${def.tileset}", which is missing`)
  const count = tilesetTiles(tileset).count
  if (!Number.isInteger(input.tile) || input.tile < 0 || input.tile >= count)
    throw new RangeError(`tile ${input.tile} is beyond tileset "${tileset.id}", which has ${count} tiles`)
  if (idInUse(project, input.id)) throw new RangeError(`object id "${input.id}" is already used`)
  const object: ObjectInstance = {
    id: input.id,
    tile: input.tile,
    x: wholePixels(input.x),
    y: wholePixels(input.y),
    flipX: input.flipX ?? false,
    flipY: input.flipY ?? false,
  }
  return updateLayer(project, target, () => ({ ...layer, items: [...layer.items, object] }))
}

export function moveObject(project: Project, target: LayerTarget, id: string, x: number, y: number): Project {
  const nextX = wholePixels(x)
  const nextY = wholePixels(y)
  return editObject(project, target, id, (object) =>
    object.x === nextX && object.y === nextY ? object : { ...object, x: nextX, y: nextY },
  )
}

export function flipObject(project: Project, target: LayerTarget, id: string, axis: 'x' | 'y'): Project {
  return editObject(project, target, id, (object) =>
    axis === 'x' ? { ...object, flipX: !object.flipX } : { ...object, flipY: !object.flipY },
  )
}

export function deleteObject(project: Project, target: LayerTarget, id: string): Project {
  return updateLayer(project, target, (layer, def) => {
    const objects = objectsOf(layer, def)
    if (!objects.items.some((candidate) => candidate.id === id))
      throw new RangeError(`no object "${id}" in layer "${def.id}"`)
    return { ...objects, items: objects.items.filter((candidate) => candidate.id !== id) }
  })
}
