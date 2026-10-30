// A procedural figure as @pixi/3d meshes on joints (spike S7, M3.1a): one Container3D per joint of FigureBuilder's
// skeleton (src/figure/rig.ts), parented like the skeleton, with a box or capsule per bone. A pose writes each
// joint's local rotation and translation; @pixi/3d composes the world transforms. This is the spike's stand-in for
// M3.5's figure view, not its design: no garments, hair or faces, and no per-character lighting tint.

import { CapsuleGeometry, Container3D, CubeGeometry, type Geometry3D, Mesh3D, PhongMaterial } from '@pixi/3d'
import { axisAngle, qmul } from '../figure/math.ts'
import { J, JOINTS, PARENTS, type Pose, type Skeleton } from '../figure/rig.ts'

export interface FigureColors {
  readonly skin: number
  readonly top: number
  readonly legs: number
  readonly shoes: number
}

export interface FigureView {
  readonly root: Container3D
  readonly joints: readonly Container3D[]
  readonly meshes: readonly Mesh3D[]
  applyPose(pose: Pose): void
}

type Segment = {
  readonly joint: number
  readonly geometry: Geometry3D
  readonly color: keyof FigureColors
  readonly at: readonly [number, number, number]
}

/** The parts: each on a joint, in that joint's rest frame (x left, y up the bone, z forward). */
function segments(s: Skeleton): Segment[] {
  const g = s.genes
  const k = g.height / 1.62
  const limb = 0.045 * k * g.build
  const capsule = (length: number, radius: number) =>
    new CapsuleGeometry({ radius, height: Math.max(length, radius * 2 + 0.01) })
  const box = (w: number, h: number, d: number) => new CubeGeometry({ width: w, height: h, depth: d })
  const torsoWidth = g.shoulders * 1.7
  const spineLength = s.offset[J.chest]![1]
  const chestLength = s.offset[J.neck]![1]
  const list: Segment[] = [
    {
      joint: J.pelvis,
      geometry: box(g.hips * 3.2, 0.14 * k, 0.17 * k),
      color: 'legs',
      at: [0, -0.02 * k, 0],
    },
    {
      joint: J.spine,
      geometry: box(torsoWidth * 0.85, spineLength, 0.16 * k),
      color: 'top',
      at: [0, spineLength / 2, 0],
    },
    {
      joint: J.chest,
      geometry: box(torsoWidth, chestLength, 0.19 * k),
      color: 'top',
      at: [0, chestLength / 2, 0],
    },
    { joint: J.neck, geometry: capsule(g.neck + 0.03 * k, 0.04 * k), color: 'skin', at: [0, g.neck / 2, 0] },
    {
      joint: J.head,
      geometry: box(g.head * g.headWidth, g.head, g.head * g.headDepth),
      color: 'skin',
      at: [0, g.head / 2, 0],
    },
  ]
  for (const side of ['L', 'R'] as const) {
    list.push(
      {
        joint: J[`upperArm.${side}`],
        geometry: capsule(s.upperArm, limb),
        color: 'top',
        at: [0, -s.upperArm / 2, 0],
      },
      {
        joint: J[`foreArm.${side}`],
        geometry: capsule(s.foreArm, limb * 0.85),
        color: 'skin',
        at: [0, -s.foreArm / 2, 0],
      },
      {
        joint: J[`hand.${side}`],
        geometry: box(0.05 * k, 0.09 * k, 0.03 * k),
        color: 'skin',
        at: [0, -0.045 * k, 0],
      },
      {
        joint: J[`thigh.${side}`],
        geometry: capsule(s.thigh, limb * 1.4),
        color: 'legs',
        at: [0, -s.thigh / 2, 0],
      },
      {
        joint: J[`shin.${side}`],
        geometry: capsule(s.shin, limb * 1.15),
        color: 'legs',
        at: [0, -s.shin / 2, 0],
      },
      {
        joint: J[`foot.${side}`],
        geometry: box(0.09 * k, 0.07 * k, g.foot),
        color: 'shoes',
        at: [0, -0.035 * k, g.foot * 0.3],
      },
    )
  }
  return list
}

/** Builds the joints and meshes once (the one-off build S7-Q9 times). */
export function buildFigure(s: Skeleton, colors: FigureColors): FigureView {
  const materials = new Map<keyof FigureColors, PhongMaterial>()
  const material = (key: keyof FigureColors) => {
    let made = materials.get(key)
    if (!made) {
      made = new PhongMaterial({ baseColor: colors[key], shininess: 8 })
      materials.set(key, made)
    }
    return made
  }
  const joints: Container3D[] = JOINTS.map((name) => new Container3D({ label: name }))
  for (let i = 0; i < JOINTS.length; i++) {
    const parent = PARENTS[i]!
    if (parent >= 0) joints[parent]!.addChild(joints[i]!)
  }
  const meshes: Mesh3D[] = []
  for (const part of segments(s)) {
    const mesh = new Mesh3D({ geometry: part.geometry, material: material(part.color) })
    mesh.position.set(part.at[0], part.at[1], part.at[2])
    joints[part.joint]!.addChild(mesh)
    meshes.push(mesh)
  }
  const root = joints[J.root]!
  return {
    root,
    joints,
    meshes,
    applyPose(pose: Pose): void {
      for (let i = 0; i < JOINTS.length; i++) {
        const joint = joints[i]!
        const q = pose.rot[i]!
        if (PARENTS[i]! < 0) {
          const turned = qmul(axisAngle([0, 1, 0], pose.yaw), q)
          joint.quaternion.set(turned[0], turned[1], turned[2], turned[3])
          joint.position.set(pose.root[0], pose.root[1], pose.root[2])
        } else {
          const o = s.offset[i]!
          const shift = pose.shift[i]!
          joint.quaternion.set(q[0], q[1], q[2], q[3])
          joint.position.set(o[0] + shift[0], o[1] + shift[1], o[2] + shift[2])
        }
      }
    },
  }
}
