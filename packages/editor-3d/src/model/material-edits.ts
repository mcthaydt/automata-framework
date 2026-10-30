// Retexture (ED3D spec §5.3 flow 5, ED3D.8a step 2): the material sheet applies a material to this wall, to the room, or to
// every wall made of what the target is made of now, as one edit and so one undo step. A floor or a ceiling is a target
// too. After an apply every surface in its scope is made of the material, whichever way the file said what it was made of
// before: a wall's own `texture`, its preset's (Last Light), the sector's `wallTexture`, or the sector's style.
//
// Which member is written follows what a person would write by hand. A wall that takes its material from its sector
// leaves it to the sector: the sector gets the material. A wall that names its material itself (or through a preset) gets
// its own `texture`. Presets and styles are shared definitions, edited only through an explicit Styles action (§5.1), so
// they are never rewritten; a member of the wall's or the sector's own wins over them.
import { wallSelection } from '../checks/check'
import type { Edge, Sector } from '../geometry/sectors'
import { GeometryError, type LevelProfile } from '../profile/level-profile'
import type { Material } from '../profile/materials'
import type { EditCorner, EditSector } from '../profile/sector-access'
import { selectionOf } from '../view/selection-of'
import { type Edit, type EditResult, ok, refuse } from './edit'
import { noSector, replaceSectors, sectorOf } from './sector-edit-support'
import type { WallRef } from './wall-edits'
import { withWall } from './wall-edits'
import { loopsOf, membersOf } from './wall-geometry'

/** What the sheet was opened on: one wall, or a sector's floor, its ceiling or its walls as a whole. */
export type MaterialTarget =
  | { readonly wall: WallRef }
  | { readonly sector: string; readonly surface: 'floor' | 'ceiling' | 'walls' }

/** This wall (or this floor or ceiling), the room the target is in, or every surface made of what the target is made of. */
export type MaterialScope = 'wall' | 'room' | 'matching'

export interface ApplyMaterialArgs {
  readonly target: MaterialTarget
  readonly scope: MaterialScope
  readonly material: Material
}

/** The sector member a floor, a ceiling or a sector's walls are written in. */
const MEMBER = { floor: 'floorTexture', ceiling: 'ceilingTexture', walls: 'wallTexture' } as const
type SurfaceMember = (typeof MEMBER)[keyof typeof MEMBER]

/** How the resolved geometry says the level's sectors and outline walls are made: what a file does not spell out. */
interface Resolved {
  readonly sectors: ReadonlyMap<string, Sector>
  /** The first resolved edge of each outline wall, by its selection id (an opening splits a wall into two edges). */
  readonly walls: ReadonlyMap<string, Edge>
}

/** The resolved level, or nothing in it when the engine cannot build it: the file's own members are then all there is. */
function resolve<D>(profile: LevelProfile<D>, level: D): Resolved {
  const sectors = new Map<string, Sector>()
  const walls = new Map<string, Edge>()
  let layers: ReturnType<LevelProfile<D>['geometry']>['layers'] = []
  try {
    layers = profile.geometry(level).layers
  } catch (error) {
    if (!(error instanceof GeometryError)) throw error
  }
  const select = selectionOf(profile, level)
  for (const layer of layers) {
    for (const sector of layer.map.sectors) if (!sectors.has(sector.id)) sectors.set(sector.id, sector)
    for (const edge of layer.map.edges) {
      const id = select.edge(edge)
      if (id?.startsWith('wall:') && !walls.has(id)) walls.set(id, edge)
    }
  }
  return { sectors, walls }
}

/** What the sector's floor, ceiling or walls are made of: its own member, else its style's. */
const surfaceOf = (resolved: Resolved, sector: EditSector, member: SurfaceMember): string | undefined =>
  resolved.sectors.get(sector.id)?.[member] ?? sector[member]

/**
 * What a wall names itself as made of, without its sector: its own `texture`, else its preset's. A preset is read through
 * the resolved edge, so only an outline wall's preset is seen; a hole's wall is read as written.
 */
function namedBy(resolved: Resolved, sector: EditSector, loop: number, corner: number): string | undefined {
  const own = membersOf(loopsOf(sector)[loop]?.[corner]?.[2]).texture
  if (own !== undefined || loop !== 0) return own
  return resolved.walls.get(wallSelection(sector.id, corner))?.wall.texture
}

/** What the target is made of now; nothing for a target that is not there or is made of nothing in particular. */
export function materialOf<D>(
  profile: LevelProfile<D>,
  level: D,
  target: MaterialTarget,
): string | undefined {
  const id = 'wall' in target ? target.wall.sector : target.sector
  const sector = sectorOf(profile, level, id)
  if (sector === undefined) return undefined
  const resolved = resolve(profile, level)
  if (!('wall' in target)) return surfaceOf(resolved, sector, MEMBER[target.surface])
  return namedBy(resolved, sector, 0, target.wall.corner) ?? surfaceOf(resolved, sector, 'wallTexture')
}

/** The sector with one surface member set; the sector itself when it says so already. */
const withSurface = (sector: EditSector, member: SurfaceMember, value: string): EditSector =>
  sector[member] === value ? sector : { ...sector, [member]: value }

/** The sector with the wall at a corner of a loop given its own `texture` (or with it taken off, for `null`). */
function withOwnTexture(sector: EditSector, loop: number, corner: number, value: string | null): EditSector {
  const members = membersOf(loopsOf(sector)[loop]?.[corner]?.[2])
  if ((members.texture ?? null) === value) return sector
  const { texture: _old, ...rest } = members
  return withWall(sector, loop, corner, value === null ? rest : { ...rest, texture: value })
}

/** Every wall of a sector, outline and holes, as a loop index and a corner. */
const wallsOf = (sector: EditSector): [loop: number, corner: number][] =>
  loopsOf(sector).flatMap((loop: readonly EditCorner[], index) =>
    loop.map((_, corner): [number, number] => [index, corner]),
  )

/**
 * The level with the room's walls made of the material: the sector says it, and no wall says anything else. A wall whose
 * preset names another material (Last Light) shows only once its own member is off, so the level is resolved again and
 * such a wall gets a member of its own.
 */
function roomWalls<D>(
  profile: LevelProfile<D>,
  level: D,
  sector: EditSector,
  material: string,
): EditResult<D> {
  let cleared = withSurface(sector, 'wallTexture', material)
  for (const [loop, corner] of wallsOf(sector)) cleared = withOwnTexture(cleared, loop, corner, null)
  const held = replaceSectors(profile, level, new Map([[sector.id, cleared]]))
  if (!held.ok) return held
  const resolved = resolve(profile, held.level)
  let next = cleared
  cleared.corners.forEach((_, corner) => {
    const named = namedBy(resolved, cleared, 0, corner)
    if (named !== undefined && named !== material) next = withOwnTexture(next, 0, corner, material)
  })
  return next === cleared ? held : replaceSectors(profile, level, new Map([[sector.id, next]]))
}

/** Every wall made of `made` made of the material: through its sector when it takes its material from it, else itself. */
function matchingWalls(
  resolved: Resolved,
  sectors: readonly EditSector[],
  made: string | undefined,
  material: string,
): Map<string, EditSector> {
  const changes = new Map<string, EditSector>()
  for (const sector of sectors) {
    let next = sector
    for (const [loop, corner] of wallsOf(sector)) {
      const named = namedBy(resolved, sector, loop, corner)
      if (named === undefined) {
        if (surfaceOf(resolved, sector, 'wallTexture') === made)
          next = withSurface(next, 'wallTexture', material)
      } else if (named === made) next = withOwnTexture(next, loop, corner, material)
    }
    if (next !== sector) changes.set(sector.id, next)
  }
  return changes
}

function labelOf(args: ApplyMaterialArgs): string {
  const { target, scope, material } = args
  const what = `Apply ${material.id} to`
  if ('wall' in target) {
    const { sector, corner } = target.wall
    if (scope === 'wall') return `${what} wall ${corner} of ${sector}`
    if (scope === 'room') return `${what} the walls of ${sector}`
    return `${what} the walls that match wall ${corner} of ${sector}`
  }
  const surface = target.surface === 'walls' ? 'wall' : target.surface
  if (scope === 'matching') return `${what} the ${surface}s that match ${target.sector}`
  return target.surface === 'walls'
    ? `${what} the walls of ${target.sector}`
    : `${what} the ${surface} of ${target.sector}`
}

export function applyMaterial<D>(args: ApplyMaterialArgs): Edit<D> {
  return {
    id: 'material.apply',
    label: labelOf(args),
    run(profile, level) {
      const { target, scope, material } = args
      const id = 'wall' in target ? target.wall.sector : target.sector
      const sector = sectorOf(profile, level, id)
      if (sector === undefined) return noSector(id)
      if ('wall' in target) {
        const { corner } = target.wall
        if (!Number.isInteger(corner) || corner < 0 || corner >= sector.corners.length)
          return refuse(`sector ${id} has no wall ${corner}`)
      } else if (target.surface !== 'walls' && material.wallOnly === true)
        return refuse(`${material.id} is for walls only`)
      // A sector's walls as a whole, for This wall or Room, and one wall's room are the room's walls.
      const ofWalls = 'wall' in target || target.surface === 'walls'
      if (ofWalls && scope !== 'matching' && !('wall' in target && scope === 'wall'))
        return roomWalls(profile, level, sector, material.id)
      const resolved = resolve(profile, level)
      const changes = new Map<string, EditSector>()
      if (scope === 'matching') {
        const made = materialOf(profile, level, target)
        const sectors = profile.sectors.list(level)
        if (!('wall' in target) && target.surface !== 'walls') {
          const member = MEMBER[target.surface]
          for (const each of sectors)
            if (surfaceOf(resolved, each, member) === made)
              changes.set(each.id, withSurface(each, member, material.id))
        } else
          for (const [key, next] of matchingWalls(resolved, sectors, made, material.id))
            changes.set(key, next)
      } else if ('wall' in target) changes.set(id, withOwnTexture(sector, 0, target.wall.corner, material.id))
      else changes.set(id, withSurface(sector, MEMBER[target.surface], material.id))
      const held = replaceSectors(profile, level, changes)
      return held.ok ? ok(held.level) : held
    },
  }
}
