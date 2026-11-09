// The dresser: a level's rooms filled from purpose kits. A room (or the level, for every room without its own) carries
// `dress: { as: "office", seed: 3 }`; `dressLevel` gives back the level with the props such a room holds appended and
// the room painted with the kit's surfaces, so a level is still only data: props with ids, from library presets.
//
// The layers, in order, each placed round what is already there (the occupied list):
//   1. furniture: the kit's slots, by rule (against a wall, in a corner, under a window, round the middle, in rows);
//   2. wall fixtures: switches with their conduit (and a sign) by the doors, outlets, vents, radiators under windows,
//      art, and outdoors the kit's list;
//   3. clutter on every surface a prop offers, 4. clutter on the floor (by the room's grime), 5. the ceiling's lamps.
// Nothing overlaps, nothing blocks a doorway or a path, and what was placed by hand keeps its place. It is deterministic
// by seed. Every piece has an id `<room>:<layer>:<n>`, so an edit can name it: `remove` takes pieces out, `pin` moves
// or changes them, and the rest stay where they were.
//
// Ported from EnvironmentBuilder (mcthaydt/EnvironmentBuilder) src/features/world/dress.ts at 6d82a52.

import type {
  AfCorner2,
  AfSector2,
  AfSectorEntry2,
  AfWall2,
  Dress,
  KitSurfaces,
  LevelProblem,
  PropPlace,
} from '@automata/3d/level'
import type { WorldLibrary } from '@automata/3d/props-kit'
import { heightAt, ringsOf, segments, signedArea, type V2 } from '@automata/3d/props-kit'
import { createRng } from '@automata/sim'
import { ceilingFixtures, floorClutter, surfaceClutter } from './clutter.ts'
import { type Ctx, reserve } from './context.ts'
import { fixtures } from './fixtures.ts'
import { furniture } from './furniture.ts'
import { type Kit, worldKitSchema } from './kit.schema.ts'

/**
 * The room with its kit's surfaces: the floor, the ceiling (unless it is a sky), and the wall parts on every edge that
 * is not open (an edge's own decor, windows, trim and `none` stay). `dress.surfaces` overrides the kit part by part;
 * `false`, or a kit with none, keeps the room's own.
 */
export function surfaced(sector: AfSectorEntry2, kit: Kit, dress: Dress): AfSectorEntry2 {
  if (dress.surfaces === false || (kit.surfaces === undefined && dress.surfaces === undefined)) return sector
  const s: KitSurfaces = { ...kit.surfaces, ...(dress.surfaces || {}) }
  const wall: AfWall2 = {
    ...(s.wall === undefined ? {} : { surface: s.wall }),
    ...(s.dado === undefined ? {} : { dado: s.dado }),
    ...(s.rail === undefined ? {} : { rail: s.rail }),
    ...(s.skirting === undefined ? {} : { skirting: s.skirting }),
    ...(s.cornice === undefined ? {} : { cornice: s.cornice }),
  }
  const walled = (corner: AfCorner2): AfCorner2 =>
    corner[2]?.none === true ? corner : [corner[0], corner[1], { ...(corner[2] ?? {}), ...wall }]
  return {
    ...sector,
    floor: s.floor === undefined ? sector.floor : { ...sector.floor, surface: s.floor },
    ceiling:
      s.ceiling === undefined || sector.ceiling.sky === true
        ? sector.ceiling
        : { ...sector.ceiling, surface: s.ceiling },
    corners: sector.corners.map(walled),
    ...(sector.holes === undefined ? {} : { holes: sector.holes.map((hole) => hole.map(walled)) }),
  }
}

/** The edits: props taken out, and props moved or changed, by id (the room's and the level's). */
function edited(made: readonly PropPlace[], dresses: readonly (Dress | undefined)[]): PropPlace[] {
  const gone = new Set(dresses.flatMap((d) => d?.remove ?? []))
  const pins: NonNullable<Dress['pin']> = Object.assign({}, ...dresses.map((d) => d?.pin ?? {}))
  return made
    .filter((p) => !gone.has(p.id))
    .map((p) => {
      const pin = pins[p.id]
      if (pin === undefined) return p
      return {
        ...p,
        ...(pin.use === undefined ? {} : { use: pin.use }),
        ...(pin.at === undefined ? {} : { at: pin.at }),
        ...(pin.angle === undefined ? {} : { angle: pin.angle }),
        ...(pin.with === undefined ? {} : { with: { ...p.with, ...pin.with } }),
      }
    })
}

/** What the dresser needs of a library's kit; one the schema refuses is no kit. */
function kitOf(library: WorldLibrary, name: string): Kit | undefined {
  const found = library.kits?.[name]
  const parsed = found === undefined ? undefined : worldKitSchema.safeParse(found)
  return parsed?.success === true ? parsed.data : undefined
}

/**
 * The props one room holds, dressed from `kit` by `dress` (its seed, density and grime): deterministic by seed, every
 * prop with a stable id `<room>:<layer>:<n>`. Hand-placed props and paths of `level` are kept clear.
 */
export function dressSector(
  level: AfSector2,
  si: number,
  kit: Kit,
  dress: Dress,
  library: WorldLibrary,
): PropPlace[] {
  const sector = level.sectors[si] as AfSectorEntry2
  const poly = ringsOf(sector)[0] as V2[]
  const rng = createRng((dress.seed ?? 1) * 7919 + si * 131)
  const c: Ctx = {
    level,
    library,
    si,
    sector,
    kit,
    dress,
    next: () => rng.next(),
    density: dress.density ?? 1,
    poly,
    area: Math.abs(signedArea(poly)),
    floor: heightAt(sector.floor, poly[0] as V2, (poly[0] as V2)[0], (poly[0] as V2)[1]),
    segs: segments(level).filter((g) => g.sector === si),
    occupied: [],
    out: [],
    counts: {},
    hung: [],
  }
  reserve(c)
  furniture(c)
  fixtures(c)
  surfaceClutter(c)
  floorClutter(c)
  ceilingFixtures(c)
  return c.out
}

export interface Dressed {
  /** The level with its rooms painted by their kits and the dressing appended to its props, ready for core to draw. */
  readonly level: AfSector2
  readonly problems: LevelProblem[]
}

/** A room without its `dress`: the dressing is in `props` now, and core draws what is there. */
const undressed = (sector: AfSectorEntry2): AfSectorEntry2 => {
  const { dress: _gone, ...bare } = sector
  return bare
}

/** The level without its `dress`, its rooms as given and its props as given when there are any. */
const withRooms = (
  level: AfSector2,
  sectors: readonly AfSectorEntry2[],
  props?: readonly PropPlace[],
): AfSector2 => {
  const { dress: _gone, ...rest } = level
  return { ...rest, sectors: [...sectors], ...(props === undefined ? {} : { props: [...props] }) }
}

/**
 * The level with every dressed room's props appended (ids `<room>:<layer>:<n>`), deterministic by seed, each dressed
 * room painted by its kit, and `dress` taken off what was dressed, so core draws the result with no extension. A room
 * whose kit the library lacks is left bare and keeps its `dress` (core then says it still wants an extension), and the
 * problem names it.
 */
export function dressLevel(level: AfSector2, library: WorldLibrary): Dressed {
  if (level.dress?.keep === false)
    return { level: withRooms(level, level.sectors.map(undressed), level.props), problems: [] }
  const problems: LevelProblem[] = []
  const made: PropPlace[] = []
  const used: (Dress | undefined)[] = [level.dress]
  const sectors = [...level.sectors]
  const bare = new Set<number>()
  level.sectors.forEach((sector, si) => {
    const dress = sector.dress ?? level.dress
    if (dress === undefined || ringsOf(sector)[0] === undefined || (ringsOf(sector)[0] as V2[]).length < 3)
      return
    const kit = kitOf(library, dress.as)
    if (kit === undefined) {
      bare.add(si)
      problems.push({
        path: sector.dress === undefined ? ['dress'] : ['sectors', si, 'dress'],
        code: 'unknown-kit',
        message: `room "${sector.id}" is dressed as "${dress.as}", which the library has no kit for (${Object.keys(library.kits ?? {}).join(', ')})`,
        where: sector.id,
        name: dress.as,
      })
      return
    }
    sectors[si] = surfaced(sector, kit, dress)
    made.push(...dressSector(level, si, kit, dress, library))
    used.push(sector.dress)
  })
  const props = [...(level.props ?? []), ...edited(made, used)]
  const rooms = sectors.map((sector, si) =>
    bare.has(si) ? (level.sectors[si] as AfSectorEntry2) : undressed(sector),
  )
  // A room left bare keeps its own `dress` (and the level's, while one does), so core still says it wants an extension.
  if (bare.size > 0)
    return { level: { ...level, sectors: rooms, ...(props.length === 0 ? {} : { props }) }, problems }
  return { level: withRooms(level, rooms, props.length === 0 ? level.props : props), problems }
}
