import { emptyLayers, layerCells } from '../level-layers'
import { layerDefSchema, MAX_LAYER_DEFS } from '../project.schema'
import { MAX_LAYER_CELLS } from '../project-codec'
import type { IntGridLayerDef, IntValueDef, LayerDef, LayerInstance, Project } from '../project-types'
import { checkShape, insertItem, layerDefOf, moveItem, replaceLayerDef, tilesetOf } from './def-lookup'
import { checkGroups } from './rule-edits'

// Layer definition edits. Every level holds one instance of every layer definition
// in the definitions' order, so adding or moving a definition does the same to each level in the same step and a
// level is never half-shaped. A definition is checked against the file schema and against the rest of the project
// (its tileset exists, an auto layer reads an IntGrid layer, no level grows past the cell limit), so the editor never
// writes what `decodeProject` or the Checks would refuse.

function intGridOf(project: Project, id: string): IntGridLayerDef {
  const def = layerDefOf(project, id)
  if (def.kind !== 'intgrid')
    throw new RangeError(`layer "${id}" is a ${def.kind} layer, not an IntGrid layer`)
  return def
}

function checkFitsProject(project: Project, def: LayerDef): void {
  if ('tileset' in def) tilesetOf(project, def.tileset)
  if (def.kind === 'auto') {
    const source = project.defs.layers.find((candidate) => candidate.id === def.source)
    if (source?.kind !== 'intgrid')
      throw new RangeError(`an auto layer reads an IntGrid layer, and "${def.source}" is not one`)
    checkGroups(project, def)
  }
  if (def.kind === 'intgrid') {
    const ids = new Set(def.values.map((value) => value.id))
    const numbers = new Set(def.values.map((value) => value.value))
    if (ids.size !== def.values.length || numbers.size !== def.values.length)
      throw new RangeError(`layer "${def.id}" repeats a value or a value id`)
  }
  // Only a layer that holds cells has the codec's cell limit: an entities layer's grid snaps, an objects layer has none.
  if (def.kind === 'objects' || def.kind === 'entities') return
  for (const level of project.levels) {
    const { cols, rows } = layerCells(level.size, def.grid)
    if (cols > MAX_LAYER_CELLS || rows > MAX_LAYER_CELLS)
      throw new RangeError(
        `a ${def.grid} px grid makes "${level.name}" ${cols} × ${rows} cells; a layer is at most ${MAX_LAYER_CELLS} cells on a side`,
      )
  }
}

/**
 * Adds a layer definition at `at` (the end, so the back of the panel's list, when absent) and an empty instance of it
 * at the same place in every level.
 */
export function addLayerDef(project: Project, def: LayerDef, at?: number): Project {
  checkShape(layerDefSchema, def, `layer "${def.id}"`)
  if (project.defs.layers.length >= MAX_LAYER_DEFS)
    throw new RangeError(`a project has at most ${MAX_LAYER_DEFS} layers`)
  if (project.defs.layers.some((candidate) => candidate.id === def.id))
    throw new RangeError(`layer id "${def.id}" is already used`)
  checkFitsProject(project, def)
  const index = at ?? project.defs.layers.length
  const layers = insertItem(project.defs.layers, def, index)
  return {
    ...project,
    defs: { ...project.defs, layers },
    levels: project.levels.map((level) => ({
      ...level,
      layers: insertItem(level.layers, emptyLayers([def], level.size)[0] as LayerInstance, index),
    })),
  }
}

/** Moves the definition at `from` to `to`, and every level's instance of it with it. */
export function reorderLayerDefs(project: Project, from: number, to: number): Project {
  const layers = moveItem(project.defs.layers, from, to)
  if (layers === project.defs.layers) return project
  return {
    ...project,
    defs: { ...project.defs, layers },
    levels: project.levels.map((level) => ({ ...level, layers: moveItem(level.layers, from, to) })),
  }
}

/** Changes what a layer is called and how opaque it draws; neither touches a level. */
export function editLayerDef(
  project: Project,
  id: string,
  patch: { readonly label?: string; readonly opacity?: number },
): Project {
  const def = layerDefOf(project, id)
  const sameLabel = patch.label === undefined || patch.label === def.label
  if (patch.opacity !== undefined && !('opacity' in def))
    throw new RangeError(`a ${def.kind} layer has no opacity`)
  const sameOpacity = patch.opacity === undefined || ('opacity' in def && patch.opacity === def.opacity)
  if (sameLabel && sameOpacity) return project
  const next = { ...def, ...patch } as LayerDef
  checkShape(layerDefSchema, next, `layer "${id}"`)
  return replaceLayerDef(project, id, next)
}

const sameValue = (a: IntValueDef, b: IntValueDef): boolean =>
  a.value === b.value && a.id === b.id && a.label === b.label && a.color === b.color

/**
 * Adds an IntGrid value, or replaces the id, label and colour of the value with the same number. The number is what
 * the cells and the rules hold, so changing it is not an edit of the value but a new one.
 */
export function setIntValue(project: Project, layer: string, value: IntValueDef): Project {
  const def = intGridOf(project, layer)
  if (def.values.some((candidate) => candidate.id === value.id && candidate.value !== value.value))
    throw new RangeError(`value id "${value.id}" is already used in layer "${layer}"`)
  const existing = def.values.find((candidate) => candidate.value === value.value)
  if (existing !== undefined && sameValue(existing, value)) return project
  const values =
    existing === undefined
      ? [...def.values, value]
      : def.values.map((candidate) => (candidate === existing ? value : candidate))
  const next: IntGridLayerDef = { ...def, values }
  checkShape(layerDefSchema, next, `layer "${layer}"`)
  return replaceLayerDef(project, layer, next)
}
