import type { FieldValue, FieldValues } from '@mcthaydt/automata-content/level-2d'
import { checkFieldValue } from '@mcthaydt/automata-content/level-2d'
import { valuesWithDefaults } from '../../../kit/fields/field-values.ts'
import { idInUse } from '../commands/layer-target'
import { DEF_ID, type IdSource } from '../ids'
import { emptyLayers, layerCells } from '../level-layers'
import { MAX_LEVEL_SIDE, MAX_LEVELS } from '../project.schema'
import { MAX_LAYER_CELLS } from '../project-codec'
import type { Background, LayerInstance, Level, Project, Size } from '../project-types'
import { placeLevel, setLevelDepth } from './level-placement'
import { arrangeWorld } from './world-layout'

// Adding, removing and copying levels, and their typed fields. A level always has an
// instance of every layer definition and is placed in a world as it is made, so a new level passes the Checks. A missing
// level or world, an id a person typed that the model refuses, or a size past the guard rails throws `RangeError`.

export interface NewLevel {
  readonly id: string
  readonly name: string
  /** The world that places it, at `x`, `y` as its layout allows. */
  readonly world: string
  readonly x: number
  readonly y: number
  /** px. */
  readonly size: Size
  /** Black and `fit` when absent. */
  readonly background?: Background | undefined
}

const DEFAULT_BACKGROUND: Background = { color: '#000000', mode: 'fit' }

export function findLevel(project: Project, id: string): Level {
  const level = project.levels.find((candidate) => candidate.id === id)
  if (level === undefined) throw new RangeError(`no level "${id}"`)
  return level
}

/** The project with one level replaced; the same project when `next` is that level. */
function replaceLevel(project: Project, level: Level, next: Level): Project {
  if (next === level) return project
  return { ...project, levels: project.levels.map((candidate) => (candidate === level ? next : candidate)) }
}

/** The guard rails a level's size must stay inside: whole pixels, a side limit and a cell limit per layer. */
export function checkLevelSize(project: Project, size: Size): void {
  const fits = (n: number): boolean => Number.isInteger(n) && n >= 1 && n <= MAX_LEVEL_SIDE
  if (!fits(size.w) || !fits(size.h))
    throw new RangeError(
      `a level of ${size.w} × ${size.h} px is not whole pixels from 1 to ${MAX_LEVEL_SIDE}`,
    )
  for (const def of project.defs.layers) {
    if (def.kind === 'objects') continue
    const { cols, rows } = layerCells(size, def.grid)
    if (cols > MAX_LAYER_CELLS || rows > MAX_LAYER_CELLS)
      throw new RangeError(
        `layer "${def.id}" would be ${cols} × ${rows} cells; a layer is at most ${MAX_LAYER_CELLS} cells on a side`,
      )
  }
}

function checkNewId(project: Project, id: string): void {
  if (!DEF_ID.test(id)) throw new RangeError(`level id "${id}" is not kebab-case starting with a letter`)
  if (project.levels.some((level) => level.id === id))
    throw new RangeError(`level id "${id}" is already used`)
  if (project.levels.length >= MAX_LEVELS)
    throw new RangeError(`a project holds at most ${MAX_LEVELS} levels`)
}

/** Adds an empty level with the level fields' default values and places it in `input.world`. */
export function addLevel(project: Project, input: NewLevel): Project {
  checkNewId(project, input.id)
  checkLevelSize(project, input.size)
  const level: Level = {
    id: input.id,
    name: input.name,
    size: { w: input.size.w, h: input.size.h },
    background: input.background ?? DEFAULT_BACKGROUND,
    fields: valuesWithDefaults(project.defs.levelFields, {}),
    layers: emptyLayers(project.defs.layers, input.size),
  }
  return placeLevel({ ...project, levels: [...project.levels, level] }, level.id, input.world, input)
}

/**
 * Removes a level and every placement of it; a sequence it was in closes the gap. References to its instances from
 * other levels are left as they are, and the Checks report them broken (`brokenRef`).
 */
export function removeLevel(project: Project, id: string): Project {
  const level = findLevel(project, id)
  const levels = project.levels.filter((candidate) => candidate !== level)
  const shrunk = { ...project, levels }
  const worlds = project.worlds.map((world) =>
    world.placements.some((placement) => placement.level === id)
      ? arrangeWorld(shrunk, { ...world, placements: world.placements.filter((p) => p.level !== id) })
      : world,
  )
  return { ...shrunk, worlds }
}

const isRef = (value: FieldValue): value is { readonly target: string; readonly container?: string } =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && 'target' in value

/** Field values with each ref into the original level pointed at the copy (`renamed` maps instance ids). */
function remapRefs(
  values: FieldValues,
  renamed: ReadonlyMap<string, string>,
  from: string,
  to: string,
): FieldValues {
  const remap = (value: FieldValue): FieldValue => {
    if (Array.isArray(value)) return value.map(remap)
    if (!isRef(value)) return value
    return {
      ...value,
      target: renamed.get(value.target) ?? value.target,
      ...(value.container === from ? { container: to } : {}),
    }
  }
  const remapped: Record<string, FieldValue> = {}
  for (const [key, value] of Object.entries(values)) remapped[key] = remap(value)
  return remapped
}

/** A fresh instance id from `ids` that nothing in the project, nor an id already taken for the copy, uses. */
function freshId(project: Project, ids: IdSource, taken: Set<string>): string {
  for (;;) {
    const id = ids.next()
    if (!taken.has(id) && !idInUse(project, id)) {
      taken.add(id)
      return id
    }
  }
}

/**
 * A copy of a level under `copy.id`: the same cells (grids are shared, being immutable), fields and items, each item
 * under a fresh id from `ids`. A reference in the copy to an instance of the original points at that instance's
 * copy, and a `container` naming the original names the copy. The copy goes right after the original in its world, at its depth: to its right
 * in a free or grid world, next in a sequence. A level no world places gives a copy no world places.
 */
export function duplicateLevel(
  project: Project,
  id: string,
  copy: { readonly id: string; readonly name: string },
  ids: IdSource,
): Project {
  const original = findLevel(project, id)
  checkNewId(project, copy.id)
  const taken = new Set<string>()
  const renamed = new Map<string, string>()
  for (const layer of original.layers) {
    if (layer.kind === 'entities' || layer.kind === 'objects')
      for (const item of layer.items) renamed.set(item.id, freshId(project, ids, taken))
  }
  const layers = original.layers.map((layer): LayerInstance => {
    if (layer.kind === 'objects')
      return {
        ...layer,
        items: layer.items.map((item) => ({ ...item, id: renamed.get(item.id) ?? item.id })),
      }
    if (layer.kind === 'entities')
      return {
        ...layer,
        items: layer.items.map((item) => ({
          ...item,
          id: renamed.get(item.id) ?? item.id,
          fields: remapRefs(item.fields, renamed, original.id, copy.id),
        })),
      }
    return layer
  })
  const level: Level = {
    ...original,
    id: copy.id,
    name: copy.name,
    fields: remapRefs(original.fields, renamed, original.id, copy.id),
    layers,
  }
  const added = { ...project, levels: [...project.levels, level] }
  const world = project.worlds.find((candidate) => candidate.placements.some((p) => p.level === id))
  const placement = world?.placements.find((p) => p.level === id)
  if (world === undefined || placement === undefined) return added
  // Half a level along a sequence's axis puts the copy's centre at the original's far edge: after the original, before
  // the next. In a free world, one level's width to the right; in a grid world, the first grid column at or past that
  // edge (rounding up, so a level narrower than half a step never lands back on the original).
  const right = placement.x + original.size.w
  const at =
    world.layout === 'horizontal'
      ? { x: placement.x + original.size.w / 2, y: placement.y }
      : world.layout === 'vertical'
        ? { x: placement.x, y: placement.y + original.size.h / 2 }
        : {
            x: world.grid === undefined ? right : Math.ceil(right / world.grid.w) * world.grid.w,
            y: placement.y,
          }
  return setLevelDepth(placeLevel(added, copy.id, world.id, at), copy.id, placement.depth)
}

/** Stores a value in one of a level's typed fields once the field's own rules (the kit's) accept it. */
export function setLevelField(project: Project, id: string, field: string, value: FieldValue): Project {
  const level = findLevel(project, id)
  const def = project.defs.levelFields.find((candidate) => candidate.id === field)
  if (def === undefined) throw new RangeError(`no level field "${field}"`)
  const problem = checkFieldValue(def, value)
  if (problem !== undefined) throw new RangeError(problem.message)
  if (JSON.stringify(level.fields[field]) === JSON.stringify(value)) return project
  return replaceLevel(project, level, { ...level, fields: { ...level.fields, [field]: value } })
}

/** Gives a level a new name, trimmed; a level needs one, so an empty name is refused. */
export function renameLevel(project: Project, id: string, name: string): Project {
  const level = findLevel(project, id)
  const trimmed = name.trim()
  if (trimmed === '') throw new RangeError('A level needs a name.')
  if (trimmed === level.name) return project
  return replaceLevel(project, level, { ...level, name: trimmed })
}
