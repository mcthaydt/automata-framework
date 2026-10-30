import type { z } from 'zod'
import type { AutoLayerDef, Definitions, LayerDef, Project, TilesetDef } from '../project-types'

// What the definition commands share (2D editor spec §5.8): finding a definition by id, replacing one so that an edit
// that changes nothing gives back the same project, checking a shape with the file schema's own rules, and moving one
// item of a list. A missing id is a programmer error and throws `RangeError`, as in the level edits.

/** Something a delete or a retype would remove or break, for the refusal dialog to list and link. */
export interface DefinitionUse {
  /** Where it is, spelled as the Checks spell a path (`levels[level-1].layers[entities].items[slime-1]`). */
  readonly path: string
  readonly message: string
}

/** A change that refuses with its uses unless it is told to go ahead anyway ("Delete anyway"). */
export type GuardedEdit =
  | { readonly ok: true; readonly project: Project }
  | { readonly ok: false; readonly uses: readonly DefinitionUse[] }

export function layerDefOf(project: Project, id: string): LayerDef {
  const found = project.defs.layers.find((candidate) => candidate.id === id)
  if (found === undefined) throw new RangeError(`no layer definition "${id}"`)
  return found
}

export function autoLayerOf(project: Project, id: string): AutoLayerDef {
  const found = layerDefOf(project, id)
  if (found.kind !== 'auto') throw new RangeError(`layer "${id}" is a ${found.kind} layer, not an auto layer`)
  return found
}

export function tilesetOf(project: Project, id: string): TilesetDef {
  const found = project.defs.tilesets.find((candidate) => candidate.id === id)
  if (found === undefined) throw new RangeError(`no tileset "${id}"`)
  return found
}

/** The project with `defs` replaced, or the same project when the definitions are the same object. */
export function withDefinitions(project: Project, defs: Definitions): Project {
  return defs === project.defs ? project : { ...project, defs }
}

/** Replaces the item whose id is `id`; the same list (and so the same project upstream) when `next` is that item. */
export function replaceById<T extends { readonly id: string }>(
  list: readonly T[],
  id: string,
  next: T,
): readonly T[] {
  if (list.find((item) => item.id === id) === next) return list
  return list.map((item) => (item.id === id ? next : item))
}

export function replaceLayerDef(project: Project, id: string, next: LayerDef): Project {
  if (next === layerDefOf(project, id)) return project
  return withDefinitions(project, { ...project.defs, layers: replaceById(project.defs.layers, id, next) })
}

/** Throws `RangeError` with the first issue the schema finds, prefixed by `what` and the issue's path. */
export function checkShape(schema: z.ZodType, value: unknown, what: string): void {
  const result = schema.safeParse(value)
  const issue = result.error?.issues[0]
  if (issue === undefined) return
  const where = issue.path.length === 0 ? '' : ` ${issue.path.join('.')}`
  throw new RangeError(`${what}${where}: ${issue.message}`)
}

export function checkIndex(index: number, length: number): void {
  if (!Number.isInteger(index) || index < 0 || index >= length)
    throw new RangeError(`index ${index} is outside a list of ${length}`)
}

/** `list` with the item at `from` moved to `to`; the same list when they are equal. */
export function moveItem<T>(list: readonly T[], from: number, to: number): readonly T[] {
  checkIndex(from, list.length)
  checkIndex(to, list.length)
  if (from === to) return list
  const moved = list.filter((_, i) => i !== from)
  moved.splice(to, 0, list[from] as T)
  return moved
}

/** `list` with `item` inserted at `at` (0 to the length, the end when absent). */
export function insertItem<T>(list: readonly T[], item: T, at: number = list.length): readonly T[] {
  checkIndex(at, list.length + 1)
  return [...list.slice(0, at), item, ...list.slice(at)]
}
