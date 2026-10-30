import { tilesetDefSchema } from '../project.schema'
import type { Project, Size, TilesetDef } from '../project-types'
import { tilesetTiles } from '../tileset-grid'
import { checkShape, replaceById, tilesetOf, withDefinitions } from './def-lookup'

// Tileset edits (2D editor spec §5.4). A tileset starts as a placeholder or with an image; importing an image swaps
// `image` and records its size, and keeps every tile index, so a project drawn on placeholders moves to real art in
// one step. Tags name tiles for palettes and rules; a tile in a tag is always one the tileset has.

function replaceTileset(project: Project, next: TilesetDef): Project {
  const tilesets = replaceById(project.defs.tilesets, next.id, next)
  return withDefinitions(
    project,
    tilesets === project.defs.tilesets ? project.defs : { ...project.defs, tilesets },
  )
}

function checkTiles(def: TilesetDef, tiles: readonly number[]): void {
  const { count } = tilesetTiles(def)
  for (const tile of tiles) {
    if (!Number.isInteger(tile) || tile < 0 || tile >= count)
      throw new RangeError(`tileset "${def.id}" has tiles 0 to ${count - 1}, not ${tile}`)
  }
}

export function addTileset(project: Project, def: TilesetDef): Project {
  checkShape(tilesetDefSchema, def, `tileset "${def.id}"`)
  if (project.defs.tilesets.some((candidate) => candidate.id === def.id))
    throw new RangeError(`tileset id "${def.id}" is already used`)
  for (const tag of def.tags) checkTiles(def, tag.tiles)
  return { ...project, defs: { ...project.defs, tilesets: [...project.defs.tilesets, def] } }
}

/**
 * Points the tileset at an image in the workspace and records its size. Tile indices stay as they are; when the new
 * size holds fewer tiles, the Checks report the tiles past the end (`tileOutOfRange`) rather than this dropping them.
 */
export function importTileset(
  project: Project,
  id: string,
  image: { readonly path: string; readonly size: Size },
): Project {
  const def = tilesetOf(project, id)
  if (def.image === image.path && def.imageSize.w === image.size.w && def.imageSize.h === image.size.h)
    return project
  const next: TilesetDef = { ...def, image: image.path, imageSize: image.size }
  checkShape(tilesetDefSchema, next, `tileset "${id}"`)
  return replaceTileset(project, next)
}

function checkTag(tag: string): void {
  if (tag.trim() === '') throw new RangeError('a tag needs a name')
}

/** Adds `tiles` to `tag`, creating the tag at the end of the list when it is new. Tiles stay sorted and unique. */
export function tagTiles(project: Project, tileset: string, tag: string, tiles: readonly number[]): Project {
  const def = tilesetOf(project, tileset)
  checkTag(tag)
  checkTiles(def, tiles)
  const existing = def.tags.find((candidate) => candidate.tag === tag)
  const before = existing?.tiles ?? []
  const merged = [...new Set([...before, ...tiles])].sort((a, b) => a - b)
  if (merged.length === before.length) return project
  const tags =
    existing === undefined
      ? [...def.tags, { tag, tiles: merged }]
      : def.tags.map((candidate) => (candidate === existing ? { tag, tiles: merged } : candidate))
  return replaceTileset(project, { ...def, tags })
}

/** Takes `tiles` out of `tag`; a tag left with no tiles is dropped. A tag the tileset does not have throws `RangeError`. */
export function untagTiles(
  project: Project,
  tileset: string,
  tag: string,
  tiles: readonly number[],
): Project {
  const def = tilesetOf(project, tileset)
  const existing = def.tags.find((candidate) => candidate.tag === tag)
  if (existing === undefined) throw new RangeError(`no tag "${tag}" in tileset "${tileset}"`)
  const removed = new Set(tiles)
  const kept = existing.tiles.filter((tile) => !removed.has(tile))
  if (kept.length === existing.tiles.length) return project
  const tags =
    kept.length === 0
      ? def.tags.filter((candidate) => candidate !== existing)
      : def.tags.map((candidate) => (candidate === existing ? { tag, tiles: kept } : candidate))
  return replaceTileset(project, { ...def, tags })
}
