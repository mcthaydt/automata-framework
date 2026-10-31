// Reads an `af-sector/1` level file as an `AreaSource` (GAME-3D.1i, DESIGN.md §17): the game consumes the level the
// editor writes, through core's `@mcthaydt/automata-sector-format` schema, and never a copy of it.
//
// - Each rectangular sector is a room box (its `view` is a camera view of the area's `views`); a sector whose floor is
//   below 0 is a pit (no room box, no floor drawn, Wick falls into it).
// - Each wall edge is a wall box `WALL_THICK` thick, closed at the corners. An edge with a `next` and no `door` is a
//   portal and stays open; one with a `door` leaves just that opening, which the `door` entity fills. A wall two rooms
//   share is written once.
// - Entities: `spawn`, `ember`, `foe` and `area-exit` are the area's own lists; every other one is a dungeon piece
//   (constants/entities.ts) as written.
// - Only axis-aligned rectangles in 1.0: another shape, or a sector with holes, is a load error naming its path (a
//   level-editor gap if the content wants one, EDITOR-GAPS.md). Nothing here runs per tick: it is the load step.
import { type AfSectorEntry, afSectorSchema, WALL_THICK } from '@mcthaydt/automata-sector-format'
import { ENTITY_DEFS } from '../../constants/entities.ts'
import { AreaLoadError, type AreaSource } from '../../systems/index.ts'

type Entities = NonNullable<AreaSource['entities']>
type Box = { min: [number, number]; max: [number, number] }
type Entity = { readonly def: string; readonly id: string; readonly x: number; readonly z: number } & {
  readonly [field: string]: unknown
}

const HALF = WALL_THICK / 2
const PIECES: ReadonlySet<string> = new Set(Object.keys(ENTITY_DEFS))

/** What the converter needs besides the file: its name, for the errors, and the area's camera views. */
export interface SectorAreaOptions {
  readonly file: string
  readonly views: AreaSource['views']
}

const at = (path: string, index: number): string => `${path}[${index}]`

/** A schema issue's path as `sectors[0].corners[1]`. */
const jsonPath = (path: readonly PropertyKey[]): string =>
  path.reduce<string>(
    (text, part) =>
      typeof part === 'number' ? `${text}[${part}]` : text === '' ? String(part) : `${text}.${String(part)}`,
    '',
  )

/** The sector as a box, or nothing when it is not an axis-aligned rectangle. */
function rectangle(sector: AfSectorEntry): Box | undefined {
  const { corners } = sector
  if (corners.length !== 4) return undefined
  // Consecutive corners differ in exactly one coordinate, and together they span two values on each axis.
  for (let i = 0; i < 4; i++) {
    const [x0, z0] = corners[i] as readonly [number, number]
    const [x1, z1] = corners[(i + 1) % 4] as readonly [number, number]
    if ((x0 === x1) === (z0 === z1)) return undefined
  }
  const xs = corners.map((corner) => corner[0])
  const zs = corners.map((corner) => corner[1])
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)]
  const [z0, z1] = [Math.min(...zs), Math.max(...zs)]
  if (x0 === x1 || z0 === z1) return undefined
  return { min: [x0, z0], max: [x1, z1] }
}

/** The wall boxes of one sector's edges. */
function wallsOf(sector: AfSectorEntry): Box[] {
  const boxes: Box[] = []
  for (let i = 0; i < 4; i++) {
    const [x0, z0, wall] = sector.corners[i] as AfSectorEntry['corners'][number]
    const [x1, z1] = sector.corners[(i + 1) % 4] as readonly [number, number]
    const length = Math.abs(x1 - x0) + Math.abs(z1 - z0)
    const ux = Math.sign(x1 - x0)
    const uz = Math.sign(z1 - z0)
    // The spans of the edge left standing, in metres from its start, the ends closing the corners.
    const spans: [number, number][] =
      wall?.door !== undefined
        ? [
            [-HALF, wall.door.at - wall.door.width / 2],
            [wall.door.at + wall.door.width / 2, length + HALF],
          ]
        : wall?.next !== undefined
          ? []
          : [[-HALF, length + HALF]]
    for (const [from, to] of spans) {
      if (to <= from) continue
      const [ax, az] = [x0 + ux * from, z0 + uz * from]
      const [bx, bz] = [x0 + ux * to, z0 + uz * to]
      boxes.push(
        uz === 0
          ? { min: [Math.min(ax, bx), z0 - HALF], max: [Math.max(ax, bx), z0 + HALF] }
          : { min: [x0 - HALF, Math.min(az, bz)], max: [x0 + HALF, Math.max(az, bz)] },
      )
    }
  }
  return boxes
}

/**
 * `json` (a parsed `af-sector/1` file) as an area. Throws `AreaLoadError` naming `options.file` and the JSON path of
 * whatever is wrong.
 */
export function areaFromSector(json: unknown, options: SectorAreaOptions): AreaSource {
  const fail = (path: string, reason: string): never => {
    throw new AreaLoadError(options.file, path, reason)
  }
  const parsed = afSectorSchema.safeParse(json)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return fail(jsonPath(issue?.path ?? []), issue?.message ?? 'not an af-sector/1 file')
  }
  const file = parsed.data
  const viewIds = new Set(options.views.map((view) => view.id))

  const rooms: AreaSource['rooms'] = []
  const pits: Box[] = []
  const walls = new Map<string, Box>()
  for (const [index, sector] of file.sectors.entries()) {
    const path = at('sectors', index)
    if (sector.holes !== undefined && sector.holes.length > 0)
      fail(`${path}.holes`, `sector "${sector.id}" has a hole; 1.0 reads axis-aligned rectangles only`)
    const box =
      rectangle(sector) ??
      fail(path, `sector "${sector.id}" is not an axis-aligned rectangle (1.0 reads those only)`)
    if (sector.floor < 0) pits.push(box)
    else {
      if (sector.view === undefined) fail(`${path}.view`, `sector "${sector.id}" has no camera view`)
      else if (!viewIds.has(sector.view))
        fail(
          `${path}.view`,
          `sector "${sector.id}" names the view "${sector.view}", which the area does not define`,
        )
      rooms.push({ view: sector.view as string, ...box })
    }
    for (const wall of wallsOf(sector)) walls.set(JSON.stringify(wall), wall)
  }

  let spawn: { x: number; z: number } | undefined
  let ember: { x: number; z: number } | undefined
  const foes: NonNullable<AreaSource['foes']> = []
  const exits: NonNullable<AreaSource['exits']> = []
  const pieces: Entity[] = []
  ;(file.entities ?? []).forEach((entity, index) => {
    const path = at('entities', index)
    const own = entity as Entity
    switch (entity.def) {
      case 'spawn':
        if (spawn !== undefined) fail(path, 'a second spawn; an area has one')
        spawn = { x: entity.x, z: entity.z }
        break
      case 'ember':
        if (ember !== undefined) fail(path, 'a second ember; an area has one')
        ember = { x: entity.x, z: entity.z }
        break
      case 'foe':
        if (typeof own.kind !== 'string') fail(`${path}.kind`, 'a foe names its kind')
        foes.push({
          kind: own.kind as string,
          x: entity.x,
          z: entity.z,
          facing: typeof own.facing === 'number' ? own.facing : 0,
        })
        break
      case 'area-exit': {
        const { width, depth, to, entryX, entryZ } = own
        if (typeof to !== 'string') fail(`${path}.to`, 'an exit names the area it leads to')
        if (typeof width !== 'number' || typeof depth !== 'number')
          fail(path, 'an exit has a width and a depth')
        if (typeof entryX !== 'number' || typeof entryZ !== 'number')
          fail(path, 'an exit has an entryX and an entryZ')
        exits.push({
          min: [entity.x - (width as number) / 2, entity.z - (depth as number) / 2],
          max: [entity.x + (width as number) / 2, entity.z + (depth as number) / 2],
          to: to as string,
          entry: { x: entryX as number, z: entryZ as number },
        })
        break
      }
      default:
        if (!PIECES.has(entity.def)) fail(`${path}.def`, `unknown entity "${entity.def}"`)
        pieces.push(own)
    }
  })
  if (spawn === undefined) fail('entities', 'no spawn')
  if (ember === undefined) fail('entities', 'no ember')

  return {
    id: file.name,
    spawn: spawn as { x: number; z: number },
    views: options.views,
    rooms,
    walls: [...walls.values()],
    pits,
    targets: [],
    ember: ember as { x: number; z: number },
    exits,
    foes,
    entities: pieces as Entities,
  }
}
