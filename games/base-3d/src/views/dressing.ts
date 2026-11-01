// Where the night's dressing goes (art direction spec §4.2, §4.5–§4.7), worked out once from the room: the mushroom
// clusters and the static lights, grass, vines, moonlight shafts, the ruined side walls' bays, the far wall's arch, and
// the backdrop beyond. Pure and deterministic (no randomness: positions come from the room and fixed tables), so a
// rebuilt scene after a lost context dresses the room the same way. Presentation only; the sim never reads it.
import type { AreaSource } from '../systems/index.ts'
import { type SceneWall, sceneOf } from './index.ts'
import type { Token } from './palette.ts'

/** Point lights the scene may hold at once: tiled lighting takes 32; the spec keeps 8 spare for phones (§4.10). */
export const LIGHT_BUDGET = 24

/** How far below the platforms the lava's surface lies, in metres: high enough to see from the angled view. */
export const LAVA_Y = -0.7

export interface Spot {
  readonly x: number
  readonly y: number
  readonly z: number
}

/** A static point light: where, its colour, reach in metres and strength. */
export interface LightSpot extends Spot {
  readonly kind: 'mushroom' | 'lava'
  readonly colour: Token
  readonly range: number
  readonly intensity: number
}

/** A card standing at a spot, `size` metres across. */
export interface Card extends Spot {
  readonly size: number
}

/** A ruined bay of a side wall: its inside face from `a` to `b` (the room on its left), and its broken height. */
export interface Bay {
  readonly a: { readonly x: number; readonly z: number }
  readonly b: { readonly x: number; readonly z: number }
  readonly height: number
}

export interface Dressing {
  readonly mushrooms: readonly Spot[]
  readonly lights: readonly LightSpot[]
  readonly grass: readonly Card[]
  readonly vines: readonly Card[]
  readonly shafts: readonly Card[]
  readonly bays: readonly Bay[]
  /** The far wall's arch: its opening from `min` to `max` along x, on the wall's face at `z`. */
  readonly arch: { readonly min: number; readonly max: number; readonly z: number; readonly height: number }
  /** Backdrop silhouettes: `x`, `z` and height in metres, standing on `y`. */
  readonly pines: readonly Card[]
  readonly towers: readonly Card[]
  readonly moon: Card
}

/** The bays' broken heights, read round in order: a ruin, never two neighbours alike. */
const BAY_HEIGHTS = [2.6, 1.9, 2.3, 1.6, 2.5, 2.0, 1.7, 2.4, 2.2, 1.8] as const
/** Mushrooms stand this far in from the walls, and keep this far from the spawn, the embers and the goal. */
const MUSHROOM_INSET = 0.45
const MUSHROOM_CLEARANCE = 1.2
/** The arch's opening, metres wide and high. */
const ARCH = { width: 3.2, height: 3 } as const

type Plan = { readonly x: number; readonly z: number }
const far = (spot: Plan, others: readonly Plan[], metres: number): boolean =>
  others.every((other) => Math.hypot(other.x - spot.x, other.z - spot.z) >= metres)

/** A fixed jitter in −0.5…0.5 from a number, so rows of grass and pines do not stand in ranks. */
const jitter = (n: number): number => {
  const s = Math.sin(n * 12.9898) * 43758.5453
  return s - Math.floor(s) - 0.5
}

export function dressingOf(area: AreaSource): Dressing {
  const rooms = area.rooms
  const pits = area.pits ?? []
  const keepClear: Plan[] = [area.spawn, ...area.embers, area.goal]
  const farZ = Math.max(...rooms.map((room) => room.max[1]))

  // Mushrooms: along each room's side walls at its ends and middle, sides alternating, and two flanking the arch.
  const mushrooms: Spot[] = []
  rooms.forEach((room, index) => {
    const [x0, z0] = room.min
    const [x1, z1] = room.max
    const zs = [z0 + 0.8, (z0 + z1) / 2, z1 - 0.8]
    zs.forEach((z, k) => {
      const left = (index + k) % 2 === 0
      const spot = { x: left ? x0 + MUSHROOM_INSET : x1 - MUSHROOM_INSET, y: 0, z }
      if (far(spot, keepClear, MUSHROOM_CLEARANCE)) mushrooms.push(spot)
    })
    if (z1 === farZ)
      for (const side of [-1, 1]) {
        const spot = { x: side * (ARCH.width / 2 + 0.7), y: 0, z: z1 - MUSHROOM_INSET }
        if (far(spot, keepClear, MUSHROOM_CLEARANCE)) mushrooms.push(spot)
      }
  })

  const lights: LightSpot[] = [
    ...mushrooms.map(
      (m): LightSpot => ({
        kind: 'mushroom',
        x: m.x,
        y: 0.4,
        z: m.z,
        colour: 'mushroom',
        range: 3.2,
        intensity: 1.6,
      }),
    ),
    ...pits.flatMap((pit) =>
      [0.25, 0.75].map(
        (share): LightSpot => ({
          kind: 'lava',
          x: pit.min[0] + (pit.max[0] - pit.min[0]) * share,
          y: LAVA_Y + 0.6,
          z: (pit.min[1] + pit.max[1]) / 2,
          colour: 'hot',
          range: 4.5,
          intensity: 2.2,
        }),
      ),
    ),
  ]

  // Grass along every platform edge and wall foot, a tuft every half metre or so.
  const grass: Card[] = []
  for (const room of rooms) {
    const [x0, z0] = room.min
    const [x1, z1] = room.max
    for (let x = x0 + 0.3; x < x1; x += 0.55)
      for (const z of [z0 + 0.12, z1 - 0.12])
        grass.push({ x: x + jitter(x + z) * 0.2, y: 0.14, z, size: 0.3 })
    for (let z = z0 + 0.3; z < z1; z += 0.5)
      for (const x of [x0 + 0.15, x1 - 0.15])
        grass.push({ x, y: 0.16, z: z + jitter(z * 3 + x) * 0.2, size: 0.34 })
  }

  // Vines hanging down both edges of each channel.
  const vines: Card[] = []
  for (const pit of pits)
    for (let x = pit.min[0] + 0.6; x < pit.max[0] - 0.4; x += 1.3)
      for (const z of [pit.min[1] + 0.03, pit.max[1] - 0.03]) vines.push({ x, y: -0.45, z, size: 0.9 })

  // One moonlight shaft over each room, leaning in from alternate sides.
  const shafts = rooms.map((room, index): Card => {
    const midX = (room.min[0] + room.max[0]) / 2
    return { x: midX + (index % 2 === 0 ? -2.5 : 2.5), y: 2.4, z: (room.min[1] + room.max[1]) / 2, size: 5.5 }
  })

  // The ruin: each side wall cut into bays of about 2 m; the far wall keeps its arch.
  const walls = sceneOf(area).walls
  const bays: Bay[] = []
  walls
    .filter((wall) => wall.a.x === wall.b.x)
    .forEach((wall, wallIndex) => {
      const length = wall.b.z - wall.a.z
      const count = Math.max(1, Math.round(Math.abs(length) / 2))
      for (let i = 0; i < count; i++)
        bays.push({
          a: { x: wall.a.x, z: wall.a.z + (length * i) / count },
          b: { x: wall.a.x, z: wall.a.z + (length * (i + 1)) / count },
          height: BAY_HEIGHTS[(wallIndex * 3 + i) % BAY_HEIGHTS.length] as number,
        })
    })
  const farWall = walls.reduce<SceneWall | undefined>(
    (best, wall) => (wall.a.z === wall.b.z && (best === undefined || wall.a.z > best.a.z) ? wall : best),
    undefined,
  )
  const arch = { min: -ARCH.width / 2, max: ARCH.width / 2, z: farWall?.a.z ?? farZ, height: ARCH.height }

  // The backdrop: pines on the plateau outside both side walls, a valley of pines and ruined towers beyond the arch.
  const pines: Card[] = []
  for (const side of [-1, 1])
    for (let z = -2; z < farZ + 16; z += 2.2)
      pines.push({ x: side * (8 + (jitter(z) + 0.5) * 3), y: 0, z, size: 6 + (jitter(z * 7) + 0.5) * 2 })
  for (let x = -16; x <= 16; x += 2.6) pines.push({ x, y: -7, z: farZ + 12 + (jitter(x) + 0.5) * 3, size: 7 })
  const towers: Card[] = []
  for (let i = 0; i < 9; i++)
    towers.push({ x: -26 + i * 6.5 + (i % 2) * 2, y: -9, z: farZ + 24 + (i % 3) * 5, size: 14 + (i % 3) * 4 })
  const moon: Card = { x: 0.6, y: -4.2, z: farZ + 32, size: 8 }

  return { mushrooms, lights, grass, vines, shafts, bays, arch, pines, towers, moon }
}
