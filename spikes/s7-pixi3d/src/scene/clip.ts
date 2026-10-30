// A keyed clip (spike S7): keys of local joint rotations as pitch/yaw/roll in radians, sampled with slerp and
// looped. The stand-in for M3.6's `figure-clip`, enough to animate two figures in the S7 scene.

import { euler, type Q } from '../figure/math.ts'
import { J, type Joint, type Pose } from '../figure/rig.ts'

type Angles = readonly [number, number, number]
export interface ClipKey {
  readonly t: number
  readonly joints: Readonly<Partial<Record<Joint, Angles>>>
}
export interface Clip {
  readonly id: string
  readonly length: number
  readonly keys: readonly ClipKey[]
}

function slerp(a: Q, b: Q, k: number): Q {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]
  const sign = d < 0 ? -1 : 1
  d *= sign
  if (d > 0.9995) {
    const out: Q = [0, 0, 0, 0]
    for (let i = 0; i < 4; i++) out[i] = a[i]! + (b[i]! * sign - a[i]!) * k
    const l = Math.hypot(out[0], out[1], out[2], out[3])
    return [out[0] / l, out[1] / l, out[2] / l, out[3] / l]
  }
  const theta = Math.acos(d)
  const s = Math.sin(theta)
  const wa = Math.sin((1 - k) * theta) / s
  const wb = (Math.sin(k * theta) / s) * sign
  return [a[0] * wa + b[0] * wb, a[1] * wa + b[1] * wb, a[2] * wa + b[2] * wb, a[3] * wa + b[3] * wb]
}

const toQ = (angles: Angles | undefined): Q =>
  angles ? euler(angles[0], angles[1], angles[2]) : [0, 0, 0, 1]

/** Writes the clip's joints into `pose` at `time` seconds (looped). Joints the clip does not key are left alone. */
export function sampleClip(clip: Clip, time: number, pose: Pose): void {
  const t = ((time % clip.length) + clip.length) % clip.length
  let next = clip.keys.findIndex((key) => key.t > t)
  if (next < 0) next = 0
  const prev = (next - 1 + clip.keys.length) % clip.keys.length
  const a = clip.keys[prev]!
  const b = clip.keys[next]!
  const span = (b.t - a.t + clip.length) % clip.length || clip.length
  const k = ((t - a.t + clip.length) % clip.length) / span
  const names = new Set([...Object.keys(a.joints), ...Object.keys(b.joints)] as Joint[])
  for (const name of names) {
    pose.rot[J[name]] = slerp(toQ(a.joints[name]), toQ(b.joints[name]), k)
  }
}

/** A wave with the right arm (the arm lifts sideways, the forearm swings). */
export const WAVE: Clip = {
  id: 'wave',
  length: 1.2,
  keys: [
    { t: 0, joints: { 'upperArm.R': [0, 0, -2.5], 'foreArm.R': [0, 0, 0.5], head: [0, -0.2, 0] } },
    { t: 0.6, joints: { 'upperArm.R': [0, 0, -2.6], 'foreArm.R': [0, 0, -0.5], head: [0, -0.1, 0] } },
  ],
}

/** A march: arms and legs swing in opposition. */
export const MARCH: Clip = {
  id: 'march',
  length: 1,
  keys: [
    {
      t: 0,
      joints: {
        'thigh.L': [-0.5, 0, 0],
        'shin.L': [0.6, 0, 0],
        'thigh.R': [0.3, 0, 0],
        'shin.R': [0.1, 0, 0],
        'upperArm.L': [0.4, 0, 0],
        'upperArm.R': [-0.4, 0, 0],
      },
    },
    {
      t: 0.5,
      joints: {
        'thigh.L': [0.3, 0, 0],
        'shin.L': [0.1, 0, 0],
        'thigh.R': [-0.5, 0, 0],
        'shin.R': [0.6, 0, 0],
        'upperArm.L': [-0.4, 0, 0],
        'upperArm.R': [0.4, 0, 0],
      },
    },
  ],
}
