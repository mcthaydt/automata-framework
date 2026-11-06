import type { LayerDef, LayerInstance, Level, Project } from '../project-types'

// Where a level edit lands: a level and one of its layers, by id. Every command in this folder
// goes through `updateLayer`, so there is one lookup, one error and one way to rebuild the path to the layer.

export interface LayerTarget {
  /** The level's `id`. */
  readonly level: string
  /** The layer definition's `id`. */
  readonly layer: string
}

/** A layer instance with its definition and the level it is in; throws `RangeError` when any of the three is missing. */
export function findLayer(
  project: Project,
  target: LayerTarget,
): { readonly level: Level; readonly index: number; readonly layer: LayerInstance; readonly def: LayerDef } {
  const level = project.levels.find((candidate) => candidate.id === target.level)
  if (level === undefined) throw new RangeError(`no level "${target.level}"`)
  const index = level.layers.findIndex((candidate) => candidate.def === target.layer)
  const layer = level.layers[index]
  const def = project.defs.layers.find((candidate) => candidate.id === target.layer)
  if (layer === undefined || def === undefined)
    throw new RangeError(`no layer "${target.layer}" in level "${target.level}"`)
  return { level, index, layer, def }
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
  const { level, index, layer, def } = findLayer(project, target)
  const next = edit(layer, def)
  if (next === layer) return project
  const layers = level.layers.map((candidate, i) => (i === index ? next : candidate))
  return {
    ...project,
    levels: project.levels.map((candidate) => (candidate === level ? { ...level, layers } : candidate)),
  }
}

/** Instance ids are unique in a project (`decodeProject` rejects a duplicate), whatever the level or layer. */
export function idInUse(project: Project, id: string): boolean {
  return project.levels.some((level) =>
    level.layers.some(
      (layer) =>
        (layer.kind === 'entities' || layer.kind === 'objects') && layer.items.some((item) => item.id === id),
    ),
  )
}
