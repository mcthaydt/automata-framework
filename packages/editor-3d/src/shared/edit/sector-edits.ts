// The sector edits (ED3D spec §5.4, ED3D.3 step 5): `sector.add`, `sector.remove`, `sector.duplicate` and the three
// property edits. Each is a value the editor runs, written once over the sectors both formats share; what a format keeps
// to itself (Last Light's zone) is the format's `SectorAccess` to carry. Every number is written to four decimals.
// Moving a sector's corners is `corner-edits.ts`, a wall's members `wall-edits.ts`; splitting and merging is ED3D.6.
import { outlineProblem } from '../geometry/loops'
import type { EditCorner, EditSector, EditWall } from '../level-session/sector-access'
import { type Edit, ok, refuse } from './edit'
import {
  buildRefusal,
  heightsProblem,
  holdSectors,
  insertSector,
  isEmptyName,
  lightProblem,
  newIdProblem,
  noSector,
  placed,
  placeOf,
  replaceSector,
  round4,
  sectorOf,
} from './sector-edit-support'
import { isBareWall, PORTAL_MEMBERS } from './wall-geometry'

/** What a sector has when the level has none to take it from. */
const DEFAULT_FLOOR = 0
const DEFAULT_CEILING = 4
const DEFAULT_LIGHT = 1

export interface AddSectorArgs {
  readonly id: string
  /** The outline as drawn, either way round. */
  readonly corners: readonly (readonly [number, number])[]
  /** The id of the sector this one is drawn like: its heights and light are the defaults, its materials are shared. */
  readonly like?: string | undefined
  /** Heights and light default to those of `like`, else of the last sector, else 0, 4 and 1. */
  readonly floor?: number | undefined
  readonly ceiling?: number | undefined
  readonly light?: number | undefined
  readonly open?: boolean | undefined
}

export function addSector<D>(args: AddSectorArgs): Edit<D> {
  return {
    id: 'sector.add',
    label: `Add sector ${args.id}`,
    run(profile, level) {
      const idProblem = newIdProblem(profile, level, args.id)
      if (idProblem !== undefined) return refuse(idProblem)
      const like = args.like === undefined ? undefined : sectorOf(profile, level, args.like)
      if (args.like !== undefined && like === undefined) return noSector(args.like)
      const corners = args.corners.map(([x, z]) => [round4(x), round4(z)] as const)
      const outline = outlineProblem(corners)
      if (outline !== undefined) return refuse(outline)
      const basis = like ?? profile.sectors.list(level).at(-1)
      const floor = round4(args.floor ?? basis?.floor ?? DEFAULT_FLOOR)
      const ceiling = round4(args.ceiling ?? basis?.ceiling ?? DEFAULT_CEILING)
      const light = round4(args.light ?? basis?.light ?? DEFAULT_LIGHT)
      const problem = heightsProblem(floor, ceiling) ?? lightProblem(light)
      if (problem !== undefined) return refuse(problem)
      const made = profile.sectors.create(level, { id: args.id, corners, floor, ceiling, light, like })
      return insertSector(profile, level, args.open === true ? { ...made, open: true } : made)
    },
  }
}

export const removeSector = <D>(args: { readonly id: string }): Edit<D> => removeSectors({ ids: [args.id] })

/**
 * Removes sectors together, as one edit. What the others in the set lead into or name goes with them (two rooms joined
 * by a portal pair), but a sector that stays and still points at one keeps it, as it would for a single sector: the
 * references are read from the level without the other sectors that go. The first sector in `ids` that cannot go
 * refuses the lot.
 */
export function removeSectors<D>(args: { readonly ids: readonly string[] }): Edit<D> {
  const ids = [...new Set(args.ids)]
  return {
    id: 'sector.remove',
    label: ids.length === 1 ? `Remove sector ${ids[0]}` : `Remove ${ids.length} sectors`,
    run(profile, level) {
      const sectors = profile.sectors.list(level)
      for (const id of ids) if (!sectors.some((sector) => sector.id === id)) return noSector(id)
      const going = new Set(ids)
      for (const id of ids) {
        const held = holdSectors(
          profile,
          level,
          sectors.filter((sector) => sector.id === id || !going.has(sector.id)),
        )
        if (!held.ok) return held
        const references = profile.sectors.references(held.level, id)
        if (references.length > 0)
          return refuse(`sector ${id} is still referenced: ${references.join('; ')}`, placeOf(id))
      }
      return holdSectors(
        profile,
        level,
        sectors.filter((sector) => !going.has(sector.id)),
      )
    },
  }
}

export interface DuplicateSectorArgs {
  readonly id: string
  /** How far the copy stands from the original, in metres. */
  readonly offset: { readonly x: number; readonly z: number }
  /** The copy's id; the original's with the next free number after it (`dock2`) when it is not given. */
  readonly newId?: string | undefined
}

/** A wall for a copy: the wall's own members, but not its portal (the copy leads nowhere yet) nor its door's id. */
function copiedWall(wall: string | EditWall | undefined): string | EditWall | undefined {
  // A name is a cutaway group, which a copy may belong to as well as the original.
  if (wall === undefined || typeof wall === 'string') return wall
  const { door, ...rest } = wall
  const kept: Record<string, unknown> = { ...rest }
  if (wall.next !== undefined) for (const member of PORTAL_MEMBERS) delete kept[member]
  if (door !== undefined) {
    const { id: _id, ...doorWithoutId } = door
    kept.door = doorWithoutId
  }
  return isBareWall(kept as EditWall) ? undefined : (kept as EditWall)
}

/** A corner moved by the offset, with its wall copied; a corner with no wall left is `[x, z]`. */
const copiedCorner = ([x, z, wall]: EditCorner, dx: number, dz: number): EditCorner =>
  placed(round4(x + dx), round4(z + dz), copiedWall(wall))

function freeIdAfter(id: string, taken: readonly string[]): string {
  for (let n = 2; ; n++) if (!taken.includes(`${id}${n}`)) return `${id}${n}`
}

export function duplicateSector<D>(args: DuplicateSectorArgs): Edit<D> {
  return {
    id: 'sector.duplicate',
    label: `Duplicate sector ${args.id}`,
    run(profile, level) {
      const source = sectorOf(profile, level, args.id)
      if (source === undefined) return noSector(args.id)
      const { x: dx, z: dz } = args.offset
      if (!Number.isFinite(dx) || !Number.isFinite(dz)) return refuse('the offset must be two numbers')
      const id = args.newId ?? freeIdAfter(args.id, profile.sectors.takenIds(level))
      const idProblem = newIdProblem(profile, level, id)
      if (idProblem !== undefined) return refuse(idProblem)
      const { holes, ...rest } = source
      const copy: EditSector = {
        ...rest,
        id,
        corners: source.corners.map((corner) => copiedCorner(corner, dx, dz)),
        ...(holes === undefined
          ? {}
          : { holes: holes.map((hole) => hole.map((corner) => copiedCorner(corner, dx, dz))) }),
      }
      return insertSector(profile, level, copy)
    },
  }
}

export interface SetHeightsArgs {
  readonly id: string
  readonly floor?: number | undefined
  readonly ceiling?: number | undefined
}

export function setHeights<D>(args: SetHeightsArgs): Edit<D> {
  return {
    id: 'sector.setHeights',
    label: `Set the heights of ${args.id}`,
    coalesce: `heights:${args.id}`,
    run(profile, level) {
      const sector = sectorOf(profile, level, args.id)
      if (sector === undefined) return noSector(args.id)
      if (args.floor === undefined && args.ceiling === undefined) return refuse('give a floor or a ceiling')
      const floor = args.floor === undefined ? sector.floor : round4(args.floor)
      const ceiling = args.ceiling === undefined ? sector.ceiling : round4(args.ceiling)
      const problem = heightsProblem(floor, ceiling)
      if (problem !== undefined) return refuse(problem)
      const same = floor === sector.floor && ceiling === sector.ceiling
      return replaceSector(profile, level, args.id, same ? sector : { ...sector, floor, ceiling })
    },
  }
}

export function setLight<D>(args: { readonly id: string; readonly light: number }): Edit<D> {
  return {
    id: 'sector.setLight',
    label: `Set the light of ${args.id}`,
    coalesce: `light:${args.id}`,
    run(profile, level) {
      const sector = sectorOf(profile, level, args.id)
      if (sector === undefined) return noSector(args.id)
      const light = round4(args.light)
      const problem = lightProblem(light)
      if (problem !== undefined) return refuse(problem)
      return replaceSector(profile, level, args.id, light === sector.light ? sector : { ...sector, light })
    },
  }
}

/**
 * The camera view the game takes while the player is in the sector (the 3D direction spec §4.2), by the id of a
 * `camera-view` of the game's content: the editor holds the id, and the content check of the game says whether there is
 * one. `null` takes it off. A Last Light room has none to hold, and the profile says so when the sector is written.
 */
export function setView<D>(args: { readonly id: string; readonly view: string | null }): Edit<D> {
  return {
    id: 'sector.setView',
    label: `Set the view of ${args.id}`,
    coalesce: `view:${args.id}`,
    run(profile, level) {
      const sector = sectorOf(profile, level, args.id)
      if (sector === undefined) return noSector(args.id)
      if (isEmptyName(args.view)) return refuse('a view is an id, not empty')
      if (sector.view === (args.view ?? undefined)) return ok(level)
      if (args.view !== null) return replaceSector(profile, level, args.id, { ...sector, view: args.view })
      const { view: _cleared, ...rest } = sector
      return replaceSector(profile, level, args.id, rest)
    },
  }
}

/** A material member of a sector: `null` clears it, a name sets it, and leaving it out leaves it as it is. */
export interface SetMaterialsArgs {
  readonly id: string
  readonly style?: string | null | undefined
  readonly floorTexture?: string | null | undefined
  readonly ceilingTexture?: string | null | undefined
  readonly wallTexture?: string | null | undefined
}

type MaterialMember = 'style' | 'floorTexture' | 'ceilingTexture' | 'wallTexture'

/** The sector with one material member set or cleared; the sector itself when it already is so. */
function withMaterial(
  sector: EditSector,
  member: MaterialMember,
  value: string | null | undefined,
): EditSector {
  if (value === undefined || sector[member] === (value ?? undefined)) return sector
  if (value !== null) return { ...sector, [member]: value }
  const { [member]: _cleared, ...rest } = sector
  return rest
}

export function setMaterials<D>(args: SetMaterialsArgs): Edit<D> {
  return {
    id: 'sector.setMaterials',
    label: `Set the materials of ${args.id}`,
    run(profile, level) {
      const sector = sectorOf(profile, level, args.id)
      if (sector === undefined) return noSector(args.id)
      const textures = [args.floorTexture, args.ceilingTexture, args.wallTexture]
      if ([args.style, ...textures].every((member) => member === undefined))
        return refuse('give a style or a texture')
      if (isEmptyName(args.style)) return refuse('a style is a name, not empty')
      if (textures.some(isEmptyName)) return refuse('a texture is a name, not empty')
      let next = withMaterial(sector, 'style', args.style)
      next = withMaterial(next, 'floorTexture', args.floorTexture)
      next = withMaterial(next, 'ceilingTexture', args.ceilingTexture)
      next = withMaterial(next, 'wallTexture', args.wallTexture)
      const held = replaceSector(profile, level, args.id, next)
      // A style the level does not have is the engine's to say, so a level with a new style is built before it is answered.
      if (!held.ok || next === sector || typeof args.style !== 'string') return held
      return buildRefusal(profile, held.level) ?? held
    },
  }
}
