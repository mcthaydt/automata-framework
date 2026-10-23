// The sector edits (ED3D spec §5.4, ED3D.3 step 5): `sector.add`, `sector.remove`, `sector.duplicate` and the three
// property edits. Each is a value the editor runs, written once over the sectors both formats share; what a format keeps
// to itself (Last Light's zone) is the format's `SectorAccess` to carry. Every number is written to four decimals.
// Moving a sector's corners is `corner-edits.ts`, a wall's members `wall-edits.ts`; splitting and merging is ED3D.6.
import { outlineProblem } from '../geometry/loops'
import type { EditCorner, EditSector, EditWall } from '../profile/sector-access'
import { type Edit, refuse } from './edit'
import {
  buildRefusal,
  heightsProblem,
  holdSectors,
  insertSector,
  lightProblem,
  newIdProblem,
  noSector,
  placed,
  placeOf,
  replaceSector,
  round4,
  sectorOf,
} from './sector-edit-support'

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

export function removeSector<D>(args: { readonly id: string }): Edit<D> {
  return {
    id: 'sector.remove',
    label: `Remove sector ${args.id}`,
    run(profile, level) {
      const sectors = profile.sectors.list(level)
      if (!sectors.some((sector) => sector.id === args.id)) return noSector(args.id)
      const references = profile.sectors.references(level, args.id)
      if (references.length > 0)
        return refuse(`sector ${args.id} is still referenced: ${references.join('; ')}`, placeOf(args.id))
      return holdSectors(
        profile,
        level,
        sectors.filter((sector) => sector.id !== args.id),
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

/** The members of a wall that mean something only while it is a portal: a copy that has no portal has none of them. */
const PORTAL_ONLY = ['next', 'frame', 'mask', 'block', 'maskTop', 'hatch'] as const

/** A wall for a copy: the wall's own members, but not its portal (the copy leads nowhere yet) nor its door's id. */
function copiedWall(wall: string | EditWall | undefined): string | EditWall | undefined {
  // A name is a cutaway group, which a copy may belong to as well as the original.
  if (wall === undefined || typeof wall === 'string') return wall
  const { door, ...rest } = wall
  const kept: Record<string, unknown> = { ...rest }
  if (wall.next !== undefined) for (const member of PORTAL_ONLY) delete kept[member]
  if (door !== undefined) {
    const { id: _id, ...doorWithoutId } = door
    kept.door = doorWithoutId
  }
  return Object.keys(kept).length === 0 ? undefined : (kept as EditWall)
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

const emptyName = (value: string | null | undefined): boolean =>
  typeof value === 'string' && value.trim() === ''

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
      if (emptyName(args.style)) return refuse('a style is a name, not empty')
      if (textures.some(emptyName)) return refuse('a texture is a name, not empty')
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
