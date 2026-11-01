// The night's stone, coloured per vertex (art pass step 12: "vertex colour only", no painted texture). Each surface is
// cut into cells (half a metre on the platforms, a quarter on the walls) and each cell takes one entry of Emberwick's
// palette: blue-violet flagstones and brick courses, moss in patches over the platforms, a shade darker toward a
// platform's edges, down its sides and at a wall's foot. The
// light (moonlight, the mushrooms, the embers, the lantern) then falls on those colours as before. Presentation only.
import { type Box3, cellCube, type Vec3 } from '@mcthaydt/automata-render-pixi3d'
import { Mesh3D, PhongMaterial } from '@pixi/3d'
import { ISLAND_DEPTH } from './dressing.ts'
import { colour, type Token } from './palette.ts'

/** A floor's extent in plan: `[x, z]` metres. */
export interface PlanRect {
  readonly min: readonly [number, number]
  readonly max: readonly [number, number]
}

/** A value from 0 to 1 for a lattice point, the same every time. */
function hash(ix: number, iz: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** Smooth value noise from 0 to 1, one lattice cell a unit: soft patches with no seams. */
function noise(x: number, z: number): number {
  const ix = Math.floor(x)
  const iz = Math.floor(z)
  const ease = (t: number) => t * t * (3 - 2 * t)
  const u = ease(x - ix)
  const v = ease(z - iz)
  const top = hash(ix, iz) + (hash(ix + 1, iz) - hash(ix, iz)) * u
  const bottom = hash(ix, iz + 1) + (hash(ix + 1, iz + 1) - hash(ix, iz + 1)) * u
  return top + (bottom - top) * v
}

/** Stone from darkest to lightest, and moss the same way: a surface steps along these, never between them. */
const STONE: readonly Token[] = ['mortarDeep', 'mortar', 'stone', 'stoneLight', 'stoneEdge']
const MOSS: readonly Token[] = ['mossShade', 'mossDeep', 'moss', 'mossMid']

/** The entry `rung` steps up `ladder`, held inside it. */
const step = (ladder: readonly Token[], rung: number): number =>
  colour(ladder[Math.min(ladder.length - 1, Math.max(0, rung))] as Token)

/** A lattice cell's own small nudge, so neighbouring flagstones and bricks differ a little inside a patch. */
const jitter = (x: number, z: number, size: number) => hash(Math.floor(x / size), Math.floor(z / size)) - 0.5

/** Metres from a platform's edge within which its floor steps one shade darker. */
const EDGE = 0.6
/** A wall's brick courses: their height and a brick's length, in metres (every other course offset by half). */
const BRICK = { height: 0.25, length: 0.5 } as const

/**
 * A platform's top at `(x, z)`: moss in patches about 1.7 m across over blue-violet flagstones, one shade darker near
 * the edges. Asked once a cell, so each cell is one flagstone or one tuft of moss.
 */
export function floorColour(x: number, z: number, room: PlanRect): number {
  const edge = Math.min(x - room.min[0], room.max[0] - x, z - room.min[1], room.max[1] - z) < EDGE ? -1 : 0
  const patch = noise(x / 1.7, z / 1.7) * 0.75 + noise(x / 0.6 + 17, z / 0.6) * 0.25
  if (patch > 0.46) {
    const lush = noise(x / 1.1 + 9, z / 1.1 + 3) + jitter(x, z, 0.25) * 0.15
    return step(MOSS, (lush > 0.9 ? 3 : lush > 0.55 ? 2 : 1) + edge)
  }
  const tone = noise(x / 1.3 + 5, z / 1.3) + jitter(x, z, 0.25) * 0.2
  return step(STONE, (tone > 0.6 ? 3 : 2) + edge)
}

/** A platform's side at height `y` (below 0): moss dripping over the lip, then stone in bands darkening to the night. */
export function sideColour(x: number, y: number, z: number): number {
  if (y > -0.3 + (noise(x / 0.5, z / 0.5) - 0.5) * 0.4) return step(MOSS, 1)
  return step(STONE, y > -0.7 ? 2 : y > -0.4 * ISLAND_DEPTH ? 1 : 0)
}

/** A wall, pillar or plinth at `point` facing `normal`: lighter brick courses, mossy on top, mortar-dark at the foot. */
export function wallColour(point: Vec3, normal: Vec3): number {
  if (normal.y > 0.5) return step(MOSS, noise(point.x / 0.8, point.z / 0.8) > 0.5 ? 2 : 1)
  if (point.y < BRICK.height) return step(STONE, 1)
  const along = Math.abs(normal.x) > 0.5 ? point.z : point.x
  const course = Math.floor(point.y / BRICK.height)
  const brick = Math.floor(along / BRICK.length + (course % 2) * 0.5)
  const tone = hash(brick, course)
  return step(STONE, tone < 0.55 ? 3 : tone < 0.85 ? 4 : 2)
}

/** A box of stone filling `bounds`, cut into `cell`-metre cells, each one colour from `colorAt` in world space. */
export function paintedBox(
  bounds: Box3,
  cell: number,
  colorAt: (point: Vec3, normal: Vec3) => number,
): Mesh3D {
  const [min, max] = [bounds.min, bounds.max]
  const size = { x: max[0] - min[0], y: max[1] - min[1], z: max[2] - min[2] }
  const centre = { x: (min[0] + max[0]) / 2, y: (min[1] + max[1]) / 2, z: (min[2] + max[2]) / 2 }
  const geometry = cellCube(
    size,
    cell,
    (p, n) => colorAt({ x: centre.x + p.x, y: centre.y + p.y, z: centre.z + p.z }, n),
    { flat: true },
  )
  const material = new PhongMaterial({ baseColor: 0xffffff, shininess: 4 })
  material.vertexColors = true
  const mesh = new Mesh3D({ geometry, material })
  mesh.scale.set(size.x, size.y, size.z)
  mesh.position.set(centre.x, centre.y, centre.z)
  return mesh
}
