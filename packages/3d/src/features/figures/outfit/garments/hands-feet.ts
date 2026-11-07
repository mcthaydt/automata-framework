// The hands as they hang (a loose fist with a thumb) and the feet as shoes on their soles.

import { limb } from '../../../../shared/math/limb.ts'
import { axisAngle } from '../../../../shared/math/math.ts'
import { type Part, placed } from '../../body/mesh.ts'
import { box } from './locks.ts'

/** The thumbs are surfaces of their own, so each reads against its palm. */
const THUMB = { L: 3005, R: 3006 } as const

/**
 * A hand as it hangs: the palm turned to the thigh, the fingers curled into it, the thumb standing off its
 * front, so it reads as a loose fist with a thumb (not a mitten) from the side and as a slim hand from the
 * front. Its breadth is the wrist's it hangs from (`w`, the wrist's radii across and front to back): the palm
 * about 1.4 times the wrist across at the knuckles and a little flatter than it; its length is the hands
 * slider's (`u`, metres per unit). `x` the side (+1 left).
 */
export function hands(
  bone: number,
  material: string,
  group: number,
  x: number,
  u: number,
  w: [number, number],
): Part[] {
  // Turned a little so the back of the hand faces forward of the thigh, as a relaxed arm hangs.
  const turn = axisAngle([0, 1, 0], -x * 0.22)
  const [wx, wz] = w
  // The knuckles' half-breadth and the hand's half-thickness, from the wrist's.
  const B = 1.45 * wz
  const T = 0.9 * wx
  return [
    // The back of the hand and the palm, flaring from the wrist's breadth (its top) to the knuckles' (its
    // foot).
    box(bone, material, group, {
      at: [x * 0.12 * wx, -0.036 * u, -0.06 * wz],
      r: [T, 0.036 * u, B],
      e: [0.45, 0.6],
      taper: [1, 0.68],
    }),
    // The fingers, curled in toward the palm, narrower than the knuckles and set back from the palm's front.
    box(bone, material, group, {
      at: [-x * 0.2 * wx, -0.085 * u, -0.25 * wz],
      r: [0.8 * T, 0.027 * u, 0.86 * B],
      e: [0.7, 0.75],
      turn: axisAngle([0, 0, 1], -x * 0.4),
    }),
    // The thumb: off the heel of the hand, standing proud of the palm's front with its tip turned forward.
    box(
      bone,
      material,
      group,
      {
        at: [-x * 0.35 * wx, -0.045 * u, B + 0.2 * wz],
        r: [0.55 * wx, 0.03 * u, 0.5 * wz],
        e: [0.8, 0.8],
        seg: 8,
        rings: 5,
        turn: axisAngle([1, 0, 0], -0.35),
      },
      { seam: THUMB[x > 0 ? 'L' : 'R'] },
    ),
  ].map((p) => ({ ...p, mesh: placed(p.mesh, [0, 0, 0], turn) }))
}

/** A shoe on the foot bone: one profile from the heel along to the toe (heights off the floor `ankle` below
 * the joint), and its sole. `fw` the build's foot factor, `foot` its length. */
export function shoe(
  bone: number,
  upper: string,
  sole: string,
  group: number,
  k: number,
  fw: number,
  foot: number,
  ankle: number,
): Part[] {
  const floor = -ankle
  const base = floor + 0.016 * k * fw
  // Authored along y (heel to toe) with z as minus the height, then turned so y runs forward and z up.
  const key = (z: number, high: number, wide: number) => ({
    y: z * foot,
    rx: wide * k * fw,
    rz: high * k * fw,
    dz: -(base + high * k * fw),
  })
  const mesh = limb({
    seg: 12,
    caps: [0.05 * foot, 0.035 * foot],
    e: 0.85,
    rings: [
      key(0.72, 0.022, 0.04),
      key(0.56, 0.027, 0.047),
      key(0.3, 0.042, 0.046),
      key(0.02, 0.058, 0.04),
      key(-0.17, 0.044, 0.034),
    ],
  })
  return [
    { bone, material: upper, group, mesh: placed(mesh, [0, 0, 0], axisAngle([1, 0, 0], Math.PI / 2)) },
    box(bone, sole, group, {
      at: [0, floor + 0.008 * k * fw, foot * 0.27],
      r: [0.05 * k * fw, 0.009 * k * fw, foot * 0.52],
      e: [0.3, 0.45],
      taper: [1, 0.96],
    }),
  ]
}
