// The materials-table edits of an `af-sector/2` level (ED3D spec §4.6, ED3D.13a): `material.add`, `material.set`,
// `material.rename` and `material.remove` over the file's `materials` table, which the picker shows. They are this
// format's own, so they live with the profile and the editor core never names them. A material is named by a sector's three textures, a style's three, and a wall's
// `surface` (and a placed surface's tile), `upper`, `lower`, bands, trim pieces, and a plane's surface, in the outer loop and the holes; a rename rewrites each, and a removal is refused while
// any is left.

import type {
  AfCorner2,
  AfMaterial,
  AfSector2File,
  AfSectorEntry2File,
  AfWall2,
  Band,
  Surface,
  SurfaceTex,
  WrittenPlane,
} from '@automata/3d/level'
import { TRIM_PIECES } from '@automata/3d/level'
import { type Edit, ok, refuse } from '../../edit/edit'
import { sameJson, withoutUndefined } from '../../edit/json-values'
import { ID_PATTERN } from '../../edit/sector-edit-support'
import { surfaceName } from './room-views'

const SURFACES = ['floorTexture', 'ceilingTexture', 'wallTexture'] as const
const BAD_ID = 'the material id must be an id: a letter, then letters, digits, - or _'
const NO_CATEGORY = 'a material has a category: walls, floors, ceilings or another'

const tableOf = (level: AfSector2File): Readonly<Record<string, AfMaterial>> => level.materials ?? {}

/** The table with `id`'s entry replaced, or with `id` called `to`, each key in its own place. */
function retabled(level: AfSector2File, id: string, to: string, material: AfMaterial): AfSector2File {
  const materials = Object.fromEntries(
    Object.entries(tableOf(level)).map(([key, value]) => (key === id ? [to, material] : [key, value])),
  )
  return { ...level, materials }
}

/** What a material's names are rewritten with: `from` becomes `to`, anything else stays. */
type Rename = (name: string | undefined) => string | undefined

/** The members of `object` named in `keys` renamed; the very object when none names the material. */
function renamedMembers<T extends object>(object: T, keys: readonly string[], rename: Rename): T {
  const record = object as Record<string, unknown>
  const changes = keys.filter((key) => {
    const value = record[key]
    return typeof value === 'string' && rename(value) !== value
  })
  if (changes.length === 0) return object
  return { ...object, ...Object.fromEntries(changes.map((key) => [key, rename(record[key] as string)])) }
}

/** A surface renamed: a name is replaced, a placed surface keeps its placement and changes its tile. */
function renamedSurface<S extends Surface | undefined>(surface: S, rename: Rename): S {
  if (surface === undefined) return surface
  if (typeof surface === 'string') return (rename(surface) ?? surface) as S
  const placed = surface as SurfaceTex
  const tile = rename(placed.tile)
  return tile === placed.tile || tile === undefined ? surface : ({ ...placed, tile } as S)
}

/** A plane written as an object renames its own surface; a number has none. */
function renamedPlane(plane: WrittenPlane, rename: Rename): WrittenPlane {
  if (typeof plane === 'number' || plane.surface === undefined) return plane
  const surface = renamedSurface(plane.surface, rename)
  return surface === plane.surface ? plane : { ...plane, surface }
}

function renamedBand(band: Band | undefined, rename: Rename): Band | undefined {
  if (band === undefined) return band
  const surface = renamedSurface(band.surface, rename)
  return surface === band.surface ? band : { ...band, surface }
}

/** The wall members that hold a surface, besides the surface itself. */
const WALL_SURFACES = ['surface', 'upper', 'lower'] as const

function renamedWall(wall: AfWall2, rename: Rename): AfWall2 {
  const changes: Record<string, unknown> = {}
  for (const key of WALL_SURFACES) {
    const next = renamedSurface(wall[key], rename)
    if (next !== wall[key]) changes[key] = next
  }
  // A trim written as a surface is one; trim heights name nothing.
  if (wall.trim !== undefined && (typeof wall.trim === 'string' || 'tile' in wall.trim)) {
    const next = renamedSurface(wall.trim as Surface, rename)
    if (next !== wall.trim) changes.trim = next
  }
  for (const key of ['dado', 'cornice'] as const) {
    const next = renamedBand(wall[key], rename)
    if (next !== wall[key]) changes[key] = next
  }
  const trimTexture =
    wall.trimTexture === undefined ? undefined : renamedMembers(wall.trimTexture, TRIM_PIECES, rename)
  if (trimTexture !== wall.trimTexture) changes.trimTexture = trimTexture
  return Object.keys(changes).length === 0 ? wall : { ...wall, ...changes }
}

function renamedLoop(loop: readonly AfCorner2[], rename: Rename): readonly AfCorner2[] {
  let changed = false
  const next = loop.map((corner): AfCorner2 => {
    const wall = corner[2]
    const renamed = wall === undefined ? undefined : renamedWall(wall, rename)
    if (renamed === wall) return corner
    changed = true
    return [corner[0], corner[1], renamed]
  })
  return changed ? next : loop
}

function renamedSector(sector: AfSectorEntry2File, rename: Rename): AfSectorEntry2File {
  const surfaces = renamedMembers(sector, SURFACES, rename)
  const floor = renamedPlane(sector.floor, rename)
  const ceiling = renamedPlane(sector.ceiling, rename)
  const corners = renamedLoop(sector.corners, rename)
  const holes = sector.holes?.map((hole) => renamedLoop(hole, rename))
  const holesChanged = holes?.some((hole, index) => hole !== sector.holes?.[index])
  if (
    surfaces === sector &&
    floor === sector.floor &&
    ceiling === sector.ceiling &&
    corners === sector.corners &&
    holesChanged !== true
  )
    return sector
  return { ...surfaces, floor, ceiling, corners, ...(holesChanged === true ? { holes } : {}) }
}

/** The level with every name of `from` rewritten to `to`; each sector, style and wall that does not name it as it was. */
function renamedUses(level: AfSector2File, from: string, to: string): AfSector2File {
  const rename: Rename = (name) => (name === from ? to : name)
  const styles = level.styles
  const nextStyles =
    styles === undefined
      ? undefined
      : Object.fromEntries(
          Object.entries(styles).map(([key, style]) => [key, renamedMembers(style, SURFACES, rename)]),
        )
  const stylesChanged =
    styles !== undefined && Object.entries(styles).some(([key, style]) => nextStyles?.[key] !== style)
  const sectors = level.sectors.map((sector) => renamedSector(sector, rename))
  return {
    ...level,
    ...(stylesChanged ? { styles: nextStyles as NonNullable<AfSector2File['styles']> } : {}),
    sectors: sectors.some((sector, index) => sector !== level.sectors[index]) ? sectors : level.sectors,
  }
}

const surfaceUses = (surface: Surface | undefined, id: string): boolean => surfaceName(surface) === id

/** The members of a wall that name `id`, as a sentence each names them. */
function wallUses(wall: AfWall2 | undefined, id: string): string[] {
  if (wall === undefined) return []
  const trim =
    wall.trim !== undefined && (typeof wall.trim === 'string' || 'tile' in wall.trim) ? wall.trim : undefined
  return [
    ...WALL_SURFACES.filter((key) => surfaceUses(wall[key], id)),
    ...(surfaceUses(trim as Surface | undefined, id) ? ['trim'] : []),
    ...(['dado', 'cornice'] as const).filter((key) => surfaceUses(wall[key]?.surface, id)),
    ...TRIM_PIECES.filter((piece) => wall.trimTexture?.[piece] === id).map((piece) => `trimTexture ${piece}`),
  ]
}

/** Everything that names the material, in file order: styles, then each sector's surfaces, walls and holes. */
function usesOf(level: AfSector2File, id: string): string[] {
  const uses: string[] = []
  for (const [name, style] of Object.entries(level.styles ?? {}))
    for (const surface of SURFACES) if (style[surface] === id) uses.push(`style ${name}: ${surface}`)
  for (const sector of level.sectors) {
    for (const surface of SURFACES) if (sector[surface] === id) uses.push(`${sector.id}: ${surface}`)
    for (const plane of ['floor', 'ceiling'] as const) {
      const written = sector[plane]
      if (typeof written !== 'number' && surfaceUses(written.surface, id))
        uses.push(`${sector.id}: ${plane} surface`)
    }
    sector.corners.forEach((corner, index) => {
      for (const use of wallUses(corner[2], id)) uses.push(`${sector.id}: wall ${index} ${use}`)
    })
    sector.holes?.forEach((hole, holeIndex) => {
      hole.forEach((corner, index) => {
        for (const use of wallUses(corner[2], id))
          uses.push(`${sector.id}: hole ${holeIndex} wall ${index} ${use}`)
      })
    })
  }
  return uses
}

const hasCategory = (material: AfMaterial): boolean => material.category.trim() !== ''

export interface MaterialArgs {
  readonly id: string
  readonly material: AfMaterial
}

export function addMaterial(args: MaterialArgs): Edit<AfSector2File> {
  const { id } = args
  return {
    id: 'material.add',
    label: `Add material ${id}`,
    run(_profile, level) {
      if (!ID_PATTERN.test(id)) return refuse(BAD_ID)
      if (Object.hasOwn(tableOf(level), id)) return refuse(`there is already a material called ${id}`)
      if (!hasCategory(args.material)) return refuse(NO_CATEGORY)
      return ok({ ...level, materials: { ...tableOf(level), [id]: withoutUndefined(args.material) } })
    },
  }
}

export function setMaterial(args: MaterialArgs): Edit<AfSector2File> {
  const { id } = args
  return {
    id: 'material.set',
    label: `Set material ${id}`,
    coalesce: `material:${id}`,
    run(_profile, level) {
      if (!Object.hasOwn(tableOf(level), id)) return refuse(`no material ${id}`)
      if (!hasCategory(args.material)) return refuse(NO_CATEGORY)
      const material = withoutUndefined(args.material)
      return sameJson(tableOf(level)[id], material) ? ok(level) : ok(retabled(level, id, id, material))
    },
  }
}

export function renameMaterial(args: { readonly id: string; readonly to: string }): Edit<AfSector2File> {
  const { id, to } = args
  return {
    id: 'material.rename',
    label: `Rename material ${id} to ${to}`,
    run(_profile, level) {
      if (!Object.hasOwn(tableOf(level), id)) return refuse(`no material ${id}`)
      if (to === id) return ok(level)
      if (!ID_PATTERN.test(to)) return refuse(BAD_ID)
      if (Object.hasOwn(tableOf(level), to)) return refuse(`there is already a material called ${to}`)
      return ok(renamedUses(retabled(level, id, to, tableOf(level)[id] as AfMaterial), id, to))
    },
  }
}

export function removeMaterial(args: { readonly id: string }): Edit<AfSector2File> {
  const { id } = args
  return {
    id: 'material.remove',
    label: `Remove material ${id}`,
    run(_profile, level) {
      if (!Object.hasOwn(tableOf(level), id)) return refuse(`no material ${id}`)
      const uses = usesOf(level, id)
      if (uses.length > 0) return refuse(`${id} is still used: ${uses.join('; ')}`)
      return ok({
        ...level,
        materials: Object.fromEntries(Object.entries(tableOf(level)).filter(([key]) => key !== id)),
      })
    },
  }
}
