// A room of an `af-sector/2` file as the editor's edits see it, and back (Levels 3D spec §5). The edits speak one
// vocabulary: a room has a floor and a ceiling *height* and a wall has a *texture* name. The file says a plane (a
// number, or an object with a slope and a surface of its own) and a wall's `surface` (a name, or a name with its
// placement). The view is the one place that knows both: it hands the edits their vocabulary, carries every value as
// the file wrote it, and writes the edits back into the file's own members, so nothing an edit did not touch changes
// and a number stays a number.
//
// Everything the edits do not know (a room's zone, door, grime and dressing; a wall's decor, bands and window grid)
// is an ordinary member of the view, which any edit that spreads a room or a wall keeps. What cannot be a member
// because an edit would misread it (a plane as written, the room's first corner, a trim that is a surface) rides under
// a symbol: object spread copies it, JSON and the patch never see it.
import {
  type AfCorner2,
  type AfSectorEntry2File,
  type AfWall2,
  planeZ,
  type Surface,
  type WrittenPlane,
  withPlaneZ,
} from '@automata/3d/level'
import type { EditCorner, EditSector, EditWall } from '../sector-access'

const WRITTEN = Symbol('written')

/** What a room was when it was read. */
interface WrittenRoom {
  /** Its members in the order the file wrote them, so an edited room keeps them there. */
  readonly order: readonly string[]
  readonly floor: WrittenPlane
  readonly ceiling: WrittenPlane
  /** Its first corner: a sloped plane's slope runs from it. */
  readonly first: readonly [number, number] | undefined
}

interface WrittenWall {
  /** Its members in the order the file wrote them. */
  readonly order: readonly string[]
  /** The surface as written: the edits see only its swatch's name, as `texture`. */
  readonly surface?: Surface
  /** A trim written as a surface, not as heights. */
  readonly trim?: Surface
}

type RoomView = EditSector & { [WRITTEN]?: WrittenRoom }
type WallView = EditWall & { [WRITTEN]?: WrittenWall }

/** The views already made, and the file's own objects they stand for, so the same room is the same object. */
const ROOM_VIEWS = new WeakMap<AfSectorEntry2File, RoomView>()
const ROOM_ORIGINS = new WeakMap<object, AfSectorEntry2File>()
const WALL_VIEWS = new WeakMap<AfWall2, WallView>()
const WALL_ORIGINS = new WeakMap<object, AfWall2>()

/** The members in the order the file wrote them, then any the edits added. */
function inOrder<T extends object>(out: T, order: readonly string[] | undefined): T {
  if (order === undefined) return out
  const members = out as Record<string, unknown>
  const sorted: Record<string, unknown> = {}
  for (const key of order) if (Object.hasOwn(members, key)) sorted[key] = members[key]
  for (const key of Object.keys(members)) if (!Object.hasOwn(sorted, key)) sorted[key] = members[key]
  return sorted as T
}

/** A surface is a name or a swatch with its placement; a trim's heights are neither. */
const isSurface = (value: unknown): value is Surface =>
  typeof value === 'string' ||
  (typeof value === 'object' && value !== null && typeof (value as { tile?: unknown }).tile === 'string')

/** The swatch a surface names. */
export const surfaceName = (surface: Surface | undefined): string | undefined =>
  surface === undefined ? undefined : typeof surface === 'string' ? surface : surface.tile

/** The surface with another swatch: a name stays a name, a placed surface keeps its placement. */
const withSurfaceName = (surface: Surface | undefined, name: string): Surface =>
  surface === undefined || typeof surface === 'string' ? name : { ...surface, tile: name }

function wallView(wall: AfWall2): WallView {
  const cached = WALL_VIEWS.get(wall)
  if (cached !== undefined) return cached
  // `surface` is not a member of the view: the edits say `texture`, and a wall with nothing else is then a bare wall.
  const { surface, trim, ...rest } = wall
  const surfaceTrim = trim !== undefined && isSurface(trim)
  const view: Record<string | symbol, unknown> = { ...rest }
  const texture = surfaceName(surface)
  if (texture !== undefined) view.texture = texture
  if (trim !== undefined && !surfaceTrim) view.trim = trim
  if (surface !== undefined || surfaceTrim)
    view[WRITTEN] = {
      order: Object.keys(wall),
      ...(surface === undefined ? {} : { surface }),
      ...(surfaceTrim ? { trim } : {}),
    } satisfies WrittenWall
  WALL_VIEWS.set(wall, view as WallView)
  WALL_ORIGINS.set(view, wall)
  return view as WallView
}

function writeWall(view: WallView): AfWall2 {
  const origin = WALL_ORIGINS.get(view)
  if (origin !== undefined) return origin
  const { texture, trim, ...rest } = view as WallView & Record<string, unknown>
  const out: Record<string, unknown> = { ...rest }
  // Object rest copies a symbol-keyed member; the file never holds it.
  delete (out as { [WRITTEN]?: unknown })[WRITTEN]
  const written = view[WRITTEN]
  // A wall whose texture the edits left alone keeps its surface exactly as written.
  if (texture === surfaceName(written?.surface)) {
    if (written?.surface !== undefined) out.surface = written.surface
  } else if (texture !== undefined) out.surface = withSurfaceName(written?.surface, texture as string)
  if (trim !== undefined) out.trim = trim
  else if (written?.trim !== undefined) out.trim = written.trim
  return inOrder(out, written?.order) as AfWall2
}

const cornerView = (corner: AfCorner2): EditCorner =>
  corner[2] === undefined ? [corner[0], corner[1]] : [corner[0], corner[1], wallView(corner[2])]

function writeCorner(corner: EditCorner): AfCorner2 {
  const [x, z, wall] = corner
  if (typeof wall === 'string')
    throw new RangeError(
      `a wall written as a name (${JSON.stringify(wall)}) cannot be held by an af-sector level`,
    )
  if (wall === undefined) return [x, z]
  const written = writeWall(wall as WallView)
  // A wall whose last member went (a texture taken off the only surface it had) is a bare corner.
  return Object.keys(written).length === 0 ? [x, z] : [x, z, written]
}

/** The room as the edits see it. The same object for the same room. */
export function roomView(entry: AfSectorEntry2File): EditSector {
  const cached = ROOM_VIEWS.get(entry)
  if (cached !== undefined) return cached
  const { floor, ceiling, corners, holes, ...rest } = entry
  const first = corners[0]
  const view: RoomView = {
    ...rest,
    floor: planeZ(floor),
    ceiling: planeZ(ceiling),
    corners: corners.map(cornerView),
    ...(holes === undefined ? {} : { holes: holes.map((hole) => hole.map(cornerView)) }),
    [WRITTEN]: {
      order: Object.keys(entry),
      floor,
      ceiling,
      first: first === undefined ? undefined : [first[0], first[1]],
    },
  }
  ROOM_VIEWS.set(entry, view)
  ROOM_ORIGINS.set(view, entry)
  return view
}

const round6 = (value: number): number => Math.round(value * 1e6) / 1e6

/**
 * A plane written back. A height the edits changed is written into the plane as it was written; a height they left
 * alone is the plane as it was, unless the room's first corner moved: the slope runs from that corner, so `z` moves by
 * the slope times the shift and the surface stays where it was.
 */
function writePlane(
  written: WrittenPlane | undefined,
  height: number,
  shift: readonly [number, number],
): WrittenPlane {
  if (written === undefined) return height
  if (height !== planeZ(written)) return withPlaneZ(written, height)
  if (typeof written === 'number' || written.slope === undefined) return written
  const rise = written.slope[0] * shift[0] + written.slope[1] * shift[1]
  return rise === 0 ? written : withPlaneZ(written, round6(written.z + rise))
}

/** The room written into the file's own members. The file's own object when it is a room's untouched view. */
export function writeRoom(view: EditSector): AfSectorEntry2File {
  const origin = ROOM_ORIGINS.get(view)
  if (origin !== undefined) return origin
  const written = (view as RoomView)[WRITTEN]
  const { floor, ceiling, corners, holes, ...rest } = view
  const first = corners[0]
  const shift: readonly [number, number] =
    written?.first === undefined || first === undefined
      ? [0, 0]
      : [first[0] - written.first[0], first[1] - written.first[1]]
  const out = {
    ...rest,
    floor: writePlane(written?.floor, floor, shift),
    ceiling: writePlane(written?.ceiling, ceiling, shift),
    corners: corners.map(writeCorner),
    ...(holes === undefined ? {} : { holes: holes.map((hole) => hole.map(writeCorner)) }),
  }
  delete (out as { [WRITTEN]?: unknown })[WRITTEN]
  return inOrder(out, written?.order) as AfSectorEntry2File
}
