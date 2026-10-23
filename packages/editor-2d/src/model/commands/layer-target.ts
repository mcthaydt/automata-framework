import type { LayerDef, LayerInstance, Project } from '../project-types'

// Where a level edit lands (2D editor spec §5.8): a level and one of its layers, by id. Every command in this folder
// goes through `updateLayer`, so there is one lookup, one error and one way to rebuild the path to the layer.

export interface LayerTarget {
  /** The level's `id`. */
  readonly level: string
  /** The layer definition's `id`. */
  readonly layer: string
}

/**
 * The project with one layer replaced by `edit`'s result. Everything the edit did not touch is the same object, and
 * an edit that returns the layer it was given gives back the project it was given, so a stroke that changes nothing
 * records no undo step. A level or layer that does not exist is a programmer error, not a state a person can reach.
 */
export function updateLayer(
  project: Project,
  target: LayerTarget,
  edit: (layer: LayerInstance, def: LayerDef) => LayerInstance,
): Project {
  const level = project.levels.find((candidate) => candidate.id === target.level)
  if (level === undefined) throw new RangeError(`no level "${target.level}"`)
  const index = level.layers.findIndex((candidate) => candidate.def === target.layer)
  const layer = level.layers[index]
  const def = project.defs.layers.find((candidate) => candidate.id === target.layer)
  if (layer === undefined || def === undefined)
    throw new RangeError(`no layer "${target.layer}" in level "${target.level}"`)
  const next = edit(layer, def)
  if (next === layer) return project
  const layers = level.layers.map((candidate, i) => (i === index ? next : candidate))
  return {
    ...project,
    levels: project.levels.map((candidate) => (candidate === level ? { ...level, layers } : candidate)),
  }
}
