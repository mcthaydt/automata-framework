// The blockout the 3D views draw (ED3D.4 step 6, ED3D spec §5.4): a level's sectors as flat surfaces, from the geometry
// layers alone (ED3D spec §4.3), so the views, the plan and the checks can never disagree. Positions are `[x, y, z]` with
// `z` the plan's `z` and `y` up. Each surface lies in one plane, has one unit normal and one selection id (a surface of a
// sector that only the geometry has, such as an opening's connector, has none, and still hides what is behind it), and
// its triangles wind counter-clockwise seen from the side the normal points to, so a renderer may cull back faces.
//
// This is a blockout, not Last Light's dressed room: no trim, wall tops, masses, casings or panes. A wall has openings
// where a door or a window is, a closed `door` panel fills the door's, and a portal leaves only the strips its neighbour
// does not open (`pieces`). A door or a window on a portal wall is not drawn: a portal is an opening already.
import type { Occlude, Point } from '@automata/3d/level'
import { triangulate } from '@automata/3d/level'
import type { SelectionOf } from '../edit/selection-of'
import type { GeometryLayer } from '../level-session/level-profile'
import { type Edge, pieces, type Sector } from './sectors'

export type Vec3 = readonly [number, number, number]

/** What a surface is: `lower` and `upper` are the strips of a portal wall above a higher floor and under a lower ceiling. */
export type SurfaceRole = 'floor' | 'ceiling' | 'wall' | 'lower' | 'upper' | 'door'

export interface Surface {
  readonly role: SurfaceRole
  /** The sector whose room the surface faces into. */
  readonly sector: string
  /** What the app selects when the surface is touched; nothing for a surface of a connector sector. */
  readonly selection: string | undefined
  readonly normal: Vec3
  /**
   * How the angled camera treats it (`mesh-pick`'s `surfaceVisibility`): a wall says it (`cut` when it says nothing), a
   * floor never goes, a ceiling is cut away like the near walls.
   */
  readonly occlude: Occlude
  /** 0 to 1: how bright the surface is drawn, from its light and the way it faces. */
  readonly shade: number
  /** `x, y, z` for each point. */
  readonly positions: readonly number[]
  /** Three to a triangle, into the points of `positions`. */
  readonly indices: readonly number[]
}

export interface Box3 {
  readonly min: Vec3
  readonly max: Vec3
}

export interface SectorMesh {
  readonly surfaces: readonly Surface[]
  /** The box round every surface, or `EMPTY_BOUNDS` for a level that has none. */
  readonly bounds: Box3
}

/** What a level with no sectors is framed on: ten metres across and a storey high. */
export const EMPTY_BOUNDS: Box3 = { min: [-5, 0, -5], max: [5, 3, 5] }

/** The way the blockout's one light is, as a unit vector from a surface toward it: mostly overhead, a little from +x and +z. */
const TOWARD_LIGHT: Vec3 = (() => {
  const length = Math.hypot(0.4, 0.8, 0.45)
  return [0.4 / length, 0.8 / length, 0.45 / length]
})()

/** What a face that looks away from the light keeps, and what a sector with no light keeps of its faces' brightness. */
const UNLIT_FACE = 0.55
const DARKEST_SECTOR = 0.35

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value))

/**
 * How bright a face is drawn: the face's lean toward the light, scaled by the sector's `light` (0 to 1, held to that).
 * A dark sector is dim and never black, so the editor can still show what is in it. Never above 1.
 */
export function faceShade(normal: Vec3, light: number): number {
  const toward = normal[0] * TOWARD_LIGHT[0] + normal[1] * TOWARD_LIGHT[1] + normal[2] * TOWARD_LIGHT[2]
  const face = UNLIT_FACE + (1 - UNLIT_FACE) * clamp(toward, 0, 1)
  return face * (DARKEST_SECTOR + (1 - DARKEST_SECTOR) * clamp(light, 0, 1))
}

/** A rectangle of a wall: metres along it from its start, and heights. */
type Rect = readonly [s0: number, s1: number, y0: number, y1: number]

/** A door or a window as a rectangle of a wall, held inside it. */
interface Opening {
  readonly s0: number
  readonly s1: number
  readonly y0: number
  readonly y1: number
}

/**
 * The opening `at` metres from the wall's start (its centre) and `width` wide, between two heights above the floor, held
 * inside the wall. Nothing when what is left has no width or no height.
 */
function openingIn(edge: Edge, at: number, width: number, low: number, high: number): Opening | undefined {
  const { floor, ceiling } = edge.sector
  const tall = ceiling - floor
  const opening = {
    s0: Math.max(0, at - width / 2),
    s1: Math.min(edge.length, at + width / 2),
    y0: floor + clamp(low, 0, tall),
    y1: floor + clamp(high, 0, tall),
  }
  return opening.s1 > opening.s0 && opening.y1 > opening.y0 ? opening : undefined
}

/**
 * The parts of the height from `low` to `high` that no opening covers, bottom to top. `covering` is lowest first, which
 * the door and the window of a wall are: the door starts at the floor.
 */
function freeSpans(low: number, high: number, covering: readonly Opening[]): [number, number][] {
  const spans: [number, number][] = []
  let cursor = low
  for (const opening of covering) {
    if (opening.y0 > cursor) spans.push([cursor, opening.y0])
    cursor = Math.max(cursor, opening.y1)
  }
  if (cursor < high) spans.push([cursor, high])
  return spans
}

const sameSpans = (a: readonly (readonly number[])[], b: readonly (readonly number[])[]): boolean =>
  a.length === b.length && a.every((span, k) => span[0] === b[k]?.[0] && span[1] === b[k]?.[1])

/**
 * The rectangles that make up a face of a wall between two heights, with the openings cut out: the wall is cut at every
 * edge of an opening, and each column keeps what none of the openings in it cover, so openings that overlap are cut once.
 * Neighbouring columns with the same free height are one rectangle.
 */
function faceRects(length: number, low: number, high: number, openings: readonly Opening[]): Rect[] {
  const cuts = [...new Set([0, length, ...openings.flatMap((opening) => [opening.s0, opening.s1])])].sort(
    (a, b) => a - b,
  )
  const columns: { s0: number; s1: number; spans: [number, number][] }[] = []
  for (let k = 0; k + 1 < cuts.length; k++) {
    const [s0, s1] = [cuts[k] as number, cuts[k + 1] as number]
    const middle = (s0 + s1) / 2
    const spans = freeSpans(
      low,
      high,
      openings.filter((opening) => opening.s0 <= middle && middle <= opening.s1),
    )
    const last = columns.at(-1)
    if (last !== undefined && sameSpans(last.spans, spans)) last.s1 = s1
    else columns.push({ s0, s1, spans })
  }
  return columns.flatMap((column) => column.spans.map(([y0, y1]): Rect => [column.s0, column.s1, y0, y1]))
}

/** The point `along` metres from the start of a wall; the far end is the corner itself, not a sum that may miss it. */
const pointAlong = (edge: Edge, along: number): Point =>
  along >= edge.length ? edge.b : { x: edge.a.x + edge.dir.x * along, z: edge.a.z + edge.dir.z * along }

/** What a wall asks of the angled camera: `cut` unless it says `fade` or `never` (a value the format does not know is `cut`). */
const occludeOf = (edge: Edge): Occlude => {
  const { occlude } = edge.wall
  return occlude === 'fade' || occlude === 'never' ? occlude : 'cut'
}

function wallSurface(role: SurfaceRole, edge: Edge, rects: readonly Rect[], select: SelectionOf): Surface {
  const positions: number[] = []
  const indices: number[] = []
  rects.forEach(([s0, s1, y0, y1], k) => {
    const [a, b] = [pointAlong(edge, s0), pointAlong(edge, s1)]
    // Wound the way the room's normal points: along the wall, then up.
    positions.push(a.x, y0, a.z, b.x, y0, b.z, b.x, y1, b.z, a.x, y1, a.z)
    indices.push(4 * k, 4 * k + 1, 4 * k + 2, 4 * k, 4 * k + 2, 4 * k + 3)
  })
  // `+ 0` turns a -0 into 0.
  const normal: Vec3 = [edge.normal.x + 0, 0, edge.normal.z + 0]
  return {
    role,
    sector: edge.sector.id,
    selection: select.edge(edge),
    normal,
    occlude: occludeOf(edge),
    shade: faceShade(normal, edge.sector.light),
    positions,
    indices,
  }
}

/**
 * What an edge builds: the strips `pieces` says, a solid wall's with its door and window cut out, and the door panel. A
 * portal wall has neither door nor window here. The door comes first in `openings` because it starts at the floor.
 */
function wallSurfaces(edge: Edge, select: SelectionOf): Surface[] {
  if (!(edge.length > 0)) return []
  const solid = edge.next === undefined
  const [door, glass] = [edge.wall.door, edge.wall.window]
  const doorway =
    solid && door !== undefined ? openingIn(edge, door.at, door.width, 0, door.height) : undefined
  const glazing =
    solid && glass !== undefined ? openingIn(edge, glass.at, glass.width, glass.y0, glass.y1) : undefined
  const openings = [doorway, glazing].filter((opening) => opening !== undefined)
  const surfaces: Surface[] = []
  for (const piece of pieces(edge)) {
    if (!(piece.y1 > piece.y0)) continue
    surfaces.push(wallSurface(piece.kind, edge, faceRects(edge.length, piece.y0, piece.y1, openings), select))
  }
  if (doorway !== undefined)
    surfaces.push(wallSurface('door', edge, [[doorway.s0, doorway.s1, doorway.y0, doorway.y1]], select))
  return surfaces
}

/** A sector's floor, facing up, and its ceiling, facing down, cut from its outline less its holes. */
function flatSurfaces(sector: Sector, select: SelectionOf): Surface[] {
  const [outline = [], ...holes] = sector.points
  const { points, triangles } = triangulate(outline, holes)
  if (triangles.length === 0) return []
  const selection = select.sector(sector.id)
  const flat = (role: 'floor' | 'ceiling', y: number, normal: Vec3, indices: number[]): Surface => ({
    role,
    sector: sector.id,
    selection,
    normal,
    occlude: role === 'floor' ? 'never' : 'cut',
    shade: faceShade(normal, sector.light),
    positions: points.flatMap((p) => [p.x, y, p.z]),
    indices,
  })
  // A triangle turns the way the outline does, which is down by the right-hand rule in these axes: the ceiling keeps it
  // and the floor is wound the other way.
  return [
    flat(
      'floor',
      sector.floor,
      [0, 1, 0],
      triangles.flatMap(([a, b, c]) => [a, c, b]),
    ),
    flat('ceiling', sector.ceiling, [0, -1, 0], triangles.flat()),
  ]
}

function boundsOf(surfaces: readonly Surface[]): Box3 {
  if (surfaces.length === 0) return EMPTY_BOUNDS
  const min: [number, number, number] = [Infinity, Infinity, Infinity]
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (const surface of surfaces)
    surface.positions.forEach((value, k) => {
      const axis = k % 3
      min[axis] = Math.min(min[axis] as number, value)
      max[axis] = Math.max(max[axis] as number, value)
    })
  return { min, max }
}

/** The surfaces of every sector of every layer, sector by sector: its floor, its ceiling, then its walls loop by loop. */
export function buildSectorMesh(layers: readonly GeometryLayer[], select: SelectionOf): SectorMesh {
  const surfaces = layers.flatMap((layer) =>
    layer.map.sectors.flatMap((sector) => [
      ...flatSurfaces(sector, select),
      ...sector.loops.flat().flatMap((edge) => wallSurfaces(edge, select)),
    ]),
  )
  return { surfaces, bounds: boundsOf(surfaces) }
}
