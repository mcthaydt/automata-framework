// The materials-table edits of an `af-sector/1` level (ED3D spec §4.6, ED3D.13a): `material.add`, `material.set`,
// `material.rename` and `material.remove` over the file's `materials` table, which the picker shows. They are this
// format's own (Last Light's materials are the game's renderer's, not the file's), so they live with the profile and
// the editor core never names them. A material is named by a sector's three textures, a style's three, and a wall's
// `texture` and trim pieces, in the outer loop and the holes; a rename rewrites each, and a removal is refused while
// any is left.

import type { AfCorner, AfMaterial, AfSector, AfSectorEntry, AfWall } from '../../format/af-sector.schema'
import type { Style } from '../../format/blockout.schema'
import { TRIM_PIECES } from '../../format/sector.schema'
import { type Edit, ok, refuse } from '../../model/edit'
import { ID_PATTERN } from '../../model/sector-edit-support'

const SURFACES = ['floorTexture', 'ceilingTexture', 'wallTexture'] as const
const BAD_ID = 'the material id must be an id: a letter, then letters, digits, - or _'
const NO_CATEGORY = 'a material has a category: walls, floors, ceilings or another'

const tableOf = (level: AfSector): Readonly<Record<string, AfMaterial>> => level.materials ?? {}

/** A material as the file writes it: a member set to `undefined` is not written. */
const written = (material: AfMaterial): AfMaterial =>
  Object.fromEntries(Object.entries(material).filter(([, value]) => value !== undefined)) as AfMaterial

/** A material's members are scalars, so two are the same when they have the same members with the same values. */
const sameMaterial = (a: AfMaterial, b: AfMaterial): boolean => {
  const other = new Map<string, unknown>(Object.entries(b))
  const entries = Object.entries(a)
  return (
    entries.length === other.size &&
    entries.every(([key, value]) => other.has(key) && other.get(key) === value)
  )
}

/** The table with `id`'s entry replaced, or with `id` called `to`, each key in its own place. */
function retabled(level: AfSector, id: string, to: string, material: AfMaterial): AfSector {
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

function renamedWall(wall: AfWall, rename: Rename): AfWall {
  const textured = renamedMembers(wall, ['texture'], rename)
  const trim =
    wall.trimTexture === undefined ? undefined : renamedMembers(wall.trimTexture, TRIM_PIECES, rename)
  return trim === wall.trimTexture ? textured : { ...textured, trimTexture: trim }
}

function renamedLoop(loop: readonly AfCorner[], rename: Rename): readonly AfCorner[] {
  let changed = false
  const next = loop.map((corner): AfCorner => {
    const wall = corner[2]
    const renamed = wall === undefined ? undefined : renamedWall(wall, rename)
    if (renamed === wall) return corner
    changed = true
    return [corner[0], corner[1], renamed]
  })
  return changed ? next : loop
}

function renamedSector(sector: AfSectorEntry, rename: Rename): AfSectorEntry {
  const surfaces = renamedMembers(sector, SURFACES, rename)
  const corners = renamedLoop(sector.corners, rename)
  const holes = sector.holes?.map((hole) => renamedLoop(hole, rename))
  const holesChanged = holes?.some((hole, index) => hole !== sector.holes?.[index])
  if (surfaces === sector && corners === sector.corners && holesChanged !== true) return sector
  return { ...surfaces, corners, ...(holesChanged === true ? { holes } : {}) }
}

/** The level with every name of `from` rewritten to `to`; each sector, style and wall that does not name it as it was. */
function renamedUses(level: AfSector, from: string, to: string): AfSector {
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
    ...(stylesChanged ? { styles: nextStyles as Record<string, Style> } : {}),
    sectors: sectors.some((sector, index) => sector !== level.sectors[index]) ? sectors : level.sectors,
  }
}

/** The members of a wall that name `id`, as a sentence each names them. */
function wallUses(wall: AfWall | undefined, id: string): string[] {
  if (wall === undefined) return []
  return [
    ...(wall.texture === id ? ['texture'] : []),
    ...TRIM_PIECES.filter((piece) => wall.trimTexture?.[piece] === id).map((piece) => `trimTexture ${piece}`),
  ]
}

/** Everything that names the material, in file order: styles, then each sector's surfaces, walls and holes. */
function usesOf(level: AfSector, id: string): string[] {
  const uses: string[] = []
  for (const [name, style] of Object.entries(level.styles ?? {}))
    for (const surface of SURFACES) if (style[surface] === id) uses.push(`style ${name}: ${surface}`)
  for (const sector of level.sectors) {
    for (const surface of SURFACES) if (sector[surface] === id) uses.push(`${sector.id}: ${surface}`)
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

export function addMaterial(args: MaterialArgs): Edit<AfSector> {
  const { id } = args
  return {
    id: 'material.add',
    label: `Add material ${id}`,
    run(_profile, level) {
      if (!ID_PATTERN.test(id)) return refuse(BAD_ID)
      if (Object.hasOwn(tableOf(level), id)) return refuse(`there is already a material called ${id}`)
      if (!hasCategory(args.material)) return refuse(NO_CATEGORY)
      return ok({ ...level, materials: { ...tableOf(level), [id]: written(args.material) } })
    },
  }
}

export function setMaterial(args: MaterialArgs): Edit<AfSector> {
  const { id } = args
  return {
    id: 'material.set',
    label: `Set material ${id}`,
    coalesce: `material:${id}`,
    run(_profile, level) {
      if (!Object.hasOwn(tableOf(level), id)) return refuse(`no material ${id}`)
      if (!hasCategory(args.material)) return refuse(NO_CATEGORY)
      const material = written(args.material)
      return sameMaterial(tableOf(level)[id] as AfMaterial, material)
        ? ok(level)
        : ok(retabled(level, id, id, material))
    },
  }
}

export function renameMaterial(args: { readonly id: string; readonly to: string }): Edit<AfSector> {
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

export function removeMaterial(args: { readonly id: string }): Edit<AfSector> {
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
