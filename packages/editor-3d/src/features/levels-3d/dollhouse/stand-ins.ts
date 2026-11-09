// The level's things as solids the 3D view and Walk can draw: a person on the spawn point and for each of the cast, a
// glowing spark for an ember, a taller one for the goal, a post for any other thing, a small lamp. They stand in for the
// game's own figures and effects (the editor does not run the game's figure builder), as simple boxes in colours of their
// own, so the editor shows where each thing is and how big, and the game's look (the DUEL snap, the stepped light) is
// what makes them read as part of the room.
import type { WorldPiece } from '@automata/3d'

type Vec3 = readonly [number, number, number]

/** Positions, normals and triangles as plain arrays, which is what the world's pieces are made of. */
type Mesh = WorldPiece['mesh']

export type StandInKind = 'person' | 'ember' | 'goal' | 'post' | 'lamp'

/** One thing to stand in the room: where its base is (x, up, z), which way it faces and what it is. */
export interface StandIn {
  readonly id: string
  readonly kind: StandInKind
  readonly at: Vec3
  /** Degrees clockwise from east, as the file writes a turn. */
  readonly angle: number
}

/** The colours the stand-ins are drawn in: DUEL colours, named the way a surface is, with a `$` the game's swatches lack. */
export const STAND_IN_COLOURS: Readonly<Record<string, number>> = {
  $person: 0xc9633a,
  $head: 0xf2c9a0,
  $ember: 0xffb108,
  $goal: 0xff5a3c,
  $post: 0x9aa1ae,
  $lamp: 0xfff3d6,
}

interface Part {
  readonly name: string
  readonly surface: string
  /** The base's centre, relative to the thing's. */
  readonly from: Vec3
  readonly size: Vec3
  /** Turned by this many degrees more than the thing. */
  readonly turn?: number
}

const PARTS: Readonly<Record<StandInKind, readonly Part[]>> = {
  // A person is about 1.5 m: a body and a head.
  person: [
    { name: 'body', surface: '$person', from: [0, 0, 0], size: [0.46, 1.15, 0.3] },
    { name: 'head', surface: '$head', from: [0, 1.15, 0], size: [0.3, 0.3, 0.3] },
  ],
  // An ember hovers at about knee height, turned a half-square so it reads as a spark and not as a crate.
  ember: [{ name: 'spark', surface: '$ember', from: [0, 0.5, 0], size: [0.26, 0.26, 0.26], turn: 45 }],
  goal: [{ name: 'spark', surface: '$goal', from: [0, 0.65, 0], size: [0.5, 0.5, 0.5], turn: 45 }],
  post: [{ name: 'post', surface: '$post', from: [0, 0, 0], size: [0.12, 1, 0.12] }],
  lamp: [{ name: 'bulb', surface: '$lamp', from: [0, 0, 0], size: [0.2, 0.2, 0.2] }],
}

const DEGREES = Math.PI / 180

/** A box standing on `base`, turned `yaw` radians about y, with one normal for each face. */
function boxMesh(base: Vec3, size: Vec3, yaw: number): Mesh {
  const [w, h, d] = size
  const [sin, cos] = [Math.sin(yaw), Math.cos(yaw)]
  const turn = (x: number, z: number): [number, number] => [x * cos + z * sin, -x * sin + z * cos]
  // Each face: its outward normal, then its four corners (counter-clockwise from outside).
  const faces: readonly (readonly [Vec3, readonly Vec3[]])[] = [
    [
      [0, 0, 1],
      [
        [-w / 2, 0, d / 2],
        [w / 2, 0, d / 2],
        [w / 2, h, d / 2],
        [-w / 2, h, d / 2],
      ],
    ],
    [
      [0, 0, -1],
      [
        [w / 2, 0, -d / 2],
        [-w / 2, 0, -d / 2],
        [-w / 2, h, -d / 2],
        [w / 2, h, -d / 2],
      ],
    ],
    [
      [1, 0, 0],
      [
        [w / 2, 0, d / 2],
        [w / 2, 0, -d / 2],
        [w / 2, h, -d / 2],
        [w / 2, h, d / 2],
      ],
    ],
    [
      [-1, 0, 0],
      [
        [-w / 2, 0, -d / 2],
        [-w / 2, 0, d / 2],
        [-w / 2, h, d / 2],
        [-w / 2, h, -d / 2],
      ],
    ],
    [
      [0, 1, 0],
      [
        [-w / 2, h, d / 2],
        [w / 2, h, d / 2],
        [w / 2, h, -d / 2],
        [-w / 2, h, -d / 2],
      ],
    ],
    [
      [0, -1, 0],
      [
        [-w / 2, 0, -d / 2],
        [w / 2, 0, -d / 2],
        [w / 2, 0, d / 2],
        [-w / 2, 0, d / 2],
      ],
    ],
  ]
  const mesh: Mesh = { positions: [], normals: [], indices: [] }
  for (const [normal, corners] of faces) {
    const first = mesh.positions.length / 3
    const [nx, nz] = turn(normal[0], normal[2])
    for (const [x, y, z] of corners) {
      const [tx, tz] = turn(x, z)
      mesh.positions.push(base[0] + tx, base[1] + y, base[2] + tz)
      mesh.normals.push(nx, normal[1], nz)
    }
    mesh.indices.push(first, first + 1, first + 2, first, first + 2, first + 3)
  }
  return mesh
}

/** The pieces that stand `thing` in the room: one for each of its parts, named `stand:<id>:<part>`. */
export function standInPieces(thing: StandIn): WorldPiece[] {
  return PARTS[thing.kind].map((part) => ({
    id: `stand:${thing.id}:${part.name}`,
    sector: '',
    part: 'prop' as const,
    surface: part.surface,
    mesh: boxMesh(
      [thing.at[0] + part.from[0], thing.at[1] + part.from[1], thing.at[2] + part.from[2]],
      part.size,
      (thing.angle + (part.turn ?? 0)) * DEGREES,
    ),
  }))
}
