// Reads an `af-sector` level file (either format) as an `AreaSource` (GAME-3D.1i, DESIGN.md §17): the game consumes the
// level the editor writes, through the `sectors` extension's reader and resolver, and never a copy of it. The sim's own
// systems keep colliding with these boxes; the sectors plugin and its Rapier colliders are not wired in.
//
// - Each rectangular sector is a room box (its `view` is a camera view of the file's `views`); a sector flagged
//   `pit: true` is a pit (no room box, no floor drawn, Wick falls into it).
// - Each wall edge is a wall box `WALL_THICK` thick, closed at the corners. An edge with a `next` and no `door` is a
//   portal and stays open; one with a `door` leaves just that opening, which the `door` entity fills. A wall two rooms
//   share is written once.
// - Entities: `spawn`, `ember` and `goal` are the area's own; any other is a load error.
// - Only axis-aligned rectangles in 1.0: another shape, or a sector with holes, is a load error naming its path (a
//   level-editor gap if the content wants one, EDITOR-GAPS.md). Nothing here runs per tick: it is the load step.
import { pathText, WALL_THICK } from '@automata/3d/level'
import { readSectorMap, resolveLevel, type Sector } from '@automata/sectors/sim'
import type { AreaSource } from '../../systems/index.ts'

type Box = { min: [number, number]; max: [number, number] }

const HALF = WALL_THICK / 2

/** What the converter needs besides the file: its name, for the errors. The camera views are the file's. */
export interface SectorAreaOptions {
  readonly file: string
}

/**
 * A level file that cannot be read: the file, the JSON path of the field at fault (`sectors[1].corners`) and why,
 * as the level editor's locator finds them.
 */
export class AreaLoadError extends Error {
  readonly area: string
  readonly path: string
  constructor(area: string, path: string, reason: string) {
    super(`base-3d area "${area}": ${path}: ${reason}`)
    this.name = 'AreaLoadError'
    this.area = area
    this.path = path
  }
}

const at = (path: string, index: number): string => `${path}[${index}]`

/** The sector as a box, or nothing when it is not an axis-aligned rectangle. */
function rectangle(sector: Sector): Box | undefined {
  const corners = sector.points[0] ?? []
  if (corners.length !== 4) return undefined
  // Consecutive corners differ in exactly one coordinate, and together they span two values on each axis.
  for (let i = 0; i < 4; i++) {
    const a = corners[i] as { x: number; z: number }
    const b = corners[(i + 1) % 4] as { x: number; z: number }
    if ((a.x === b.x) === (a.z === b.z)) return undefined
  }
  const xs = corners.map((corner) => corner.x)
  const zs = corners.map((corner) => corner.z)
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)]
  const [z0, z1] = [Math.min(...zs), Math.max(...zs)]
  if (x0 === x1 || z0 === z1) return undefined
  return { min: [x0, z0], max: [x1, z1] }
}

/**
 * The wall boxes of one rectangular sector's edges, in the order the file wrote them. The resolver winds a loop to put
 * the room on its left, so a loop written the other way comes back reversed; a door's `at` is measured from the file's
 * start of the wall, which on such an edge is `b`.
 */
function wallsOf(sector: Sector): Box[] {
  const loop = sector.loops[0] ?? []
  const inFileOrder = loop[0]?.reversed === true ? [...loop].reverse() : loop
  const boxes: Box[] = []
  for (const edge of inFileOrder) {
    const [start, end] = edge.reversed ? [edge.b, edge.a] : [edge.a, edge.b]
    const length = Math.abs(end.x - start.x) + Math.abs(end.z - start.z)
    const ux = Math.sign(end.x - start.x)
    const uz = Math.sign(end.z - start.z)
    const { door } = edge.wall
    const { next } = edge
    // The spans of the edge left standing, in metres from its start, the ends closing the corners.
    const spans: [number, number][] =
      door !== undefined
        ? [
            [-HALF, door.at - door.width / 2],
            [door.at + door.width / 2, length + HALF],
          ]
        : next !== undefined
          ? []
          : [[-HALF, length + HALF]]
    for (const [from, to] of spans) {
      if (to <= from) continue
      const [ax, az] = [start.x + ux * from, start.z + uz * from]
      const [bx, bz] = [start.x + ux * to, start.z + uz * to]
      boxes.push(
        uz === 0
          ? { min: [Math.min(ax, bx), start.z - HALF], max: [Math.max(ax, bx), start.z + HALF] }
          : { min: [start.x - HALF, Math.min(az, bz)], max: [start.x + HALF, Math.max(az, bz)] },
      )
    }
  }
  return boxes
}

/**
 * `json` (a parsed `af-sector` file) as an area. Throws `AreaLoadError` naming `options.file` and the JSON path of
 * whatever is wrong.
 */
export function areaFromSector(json: unknown, options: SectorAreaOptions): AreaSource {
  const fail = (path: string, reason: string): never => {
    throw new AreaLoadError(options.file, path, reason)
  }
  const { level: file, problems } = readSectorMap(json)
  const problem = problems[0]
  if (problem !== undefined) return fail(pathText(problem.path), problem.message)
  // A view is a name in the file's `views`; the sim reads them as a list.
  const views = Object.entries(file.views ?? {}).map(([id, view]) => ({ id, ...view }))
  const viewIds = new Set(views.map((view) => view.id))

  const rooms: AreaSource['rooms'] = []
  const pits: Box[] = []
  const walls = new Map<string, Box>()
  // The sectors, edges and pits are the resolver's; the views and entities are the file's own.
  const resolved = resolveLevel(file)
  for (const [index, sector] of resolved.sectors.entries()) {
    const path = at('sectors', index)
    if (sector.points.length > 1)
      fail(`${path}.holes`, `sector "${sector.id}" has a hole; 1.0 reads axis-aligned rectangles only`)
    const box =
      rectangle(sector) ??
      fail(path, `sector "${sector.id}" is not an axis-aligned rectangle (1.0 reads those only)`)
    if (sector.pit) pits.push(box)
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
  let goal: { x: number; z: number } | undefined
  const embers: { x: number; z: number }[] = []
  for (const [index, entity] of (file.entities ?? []).entries()) {
    const path = at('entities', index)
    switch (entity.def) {
      case 'spawn':
        if (spawn !== undefined) fail(path, 'a second spawn; an area has one')
        spawn = { x: entity.x, z: entity.z }
        break
      case 'goal':
        if (goal !== undefined) fail(path, 'a second goal; an area has one')
        goal = { x: entity.x, z: entity.z }
        break
      case 'ember':
        embers.push({ x: entity.x, z: entity.z })
        break
      default:
        fail(`${path}.def`, `unknown entity "${entity.def}"`)
    }
  }
  if (spawn === undefined) fail('entities', 'no spawn')
  if (goal === undefined) fail('entities', 'no goal')

  return {
    id: file.name,
    spawn: spawn as { x: number; z: number },
    views,
    rooms,
    walls: [...walls.values()],
    pits,
    embers,
    goal: goal as { x: number; z: number },
  }
}
