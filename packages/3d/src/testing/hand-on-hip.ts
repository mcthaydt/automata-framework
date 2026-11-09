// Where a hand rests on the hip in the `hands-on-hips` stand (right hand `{ at: "hip", elbow: 0.8,
// nudge: [0.01, -0.02, -0.12] }`, the left its mirror), for Wick's and the keeper's sliders: the fixture
// `hands-on-hips` pose is checked against these (pose-library.test.ts).
//
// Each value is `(rest[pelvis] + hand) / k` in figure units (k = height / 1.62), the wrist in the pelvis bone's
// rest frame (with the pelvis at rest, the root's frame moved up by the pelvis's rest position), undressed (no
// surface), printed to 6 decimals.

import type { Vec3 } from '../features/figures/motion/targets.ts'

export interface PlacedHands {
  /** The pelvis joint's rest position in figure units, as the skeleton has it. */
  readonly pelvis: Vec3
  readonly handL: Vec3
  readonly handR: Vec3
}

export const HAND_ON_HIP: Readonly<Record<'wick' | 'keeper', PlacedHands>> = {
  wick: {
    pelvis: [0, 0.83745, 0],
    handL: [0.192469, 0.83245, -0.171543],
    handR: [-0.192469, 0.83245, -0.171543],
  },
  keeper: {
    pelvis: [0, 0.914302, 0],
    handL: [0.189087, 0.819302, -0.170765],
    handR: [-0.189087, 0.819302, -0.170765],
  },
}
