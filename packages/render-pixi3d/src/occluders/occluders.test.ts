// The occluder rule on `@pixi/3d` objects (M3 spec §4.2): `occluders.wall` builds a wall whose inside face lies on
// `a → b` and its floor trim, each with its own material; each frame the pass hides a cut wall and shows its trim,
// blends while fading and is opaque when shown; a ceiling is never drawn in the angled view; a prop's material alpha
// follows the rule. `occluderHooks` feeds the pass from the rig's pose each frame.
import { Camera3D, Container3D, CubeGeometry, Mesh3D, PhongMaterial } from '@pixi/3d'
import { describe, expect, it } from 'vitest'
import { angledCamera } from '../camera/angled-camera.js'
import { eyeOf, type Vec3 } from '../camera/camera-pose.js'
import { cameraView } from '../sim/camera-view.schema.js'
import { createOccluders, occluderHooks } from './occluders.js'

const LOOK: Vec3 = { x: 2, y: 1, z: 2 }
const frameAt = (headingDeg: number, seconds: number, reduced = false) => ({
  eye: eyeOf(LOOK, headingDeg, 25, 5),
  look: LOOK,
  feet: { x: 2, y: 0, z: 2 },
  head: { x: 2, y: 1.62, z: 2 },
  seconds,
  reduced,
})

/** `point` through the mesh's local transform (its parent is at the origin). */
function placed(mesh: Mesh3D, point: Vec3): Vec3 {
  mesh.updateLocalTransform()
  const m = (mesh.localTransform as unknown as { elements: ArrayLike<number> }).elements
  const e = (i: number) => m[i] ?? 0
  return {
    x: e(0) * point.x + e(4) * point.y + e(8) * point.z + e(12),
    y: e(1) * point.x + e(5) * point.y + e(9) * point.z + e(13),
    z: e(2) * point.x + e(6) * point.y + e(10) * point.z + e(14),
  }
}

const meshesOf = (node: Container3D) => node.children as Mesh3D[]

describe('occluders.wall', () => {
  it('puts the inside face on a → b, the solid outward, and gives the wall and its trim their own materials', () => {
    const root = new Container3D()
    const occluders = createOccluders(root)
    const node = occluders.wall({ a: { x: 1, z: 5 }, b: { x: 1, z: 1 }, height: 2.5, color: 0x6d758d })
    expect(node.parent).toBe(root)
    const [wall, trim] = meshesOf(node)
    if (wall === undefined || trim === undefined) throw new Error('no meshes')
    // The cube is 4 m along, 2.5 m up and 0.2 m deep about its centre; its +z face is the inside.
    const near = (p: Vec3, q: Vec3) => {
      // The transform is float32.
      for (const axis of ['x', 'y', 'z'] as const) expect(p[axis]).toBeCloseTo(q[axis], 6)
    }
    near(placed(wall, { x: -2, y: -1.25, z: 0.1 }), { x: 1, y: 0, z: 5 })
    near(placed(wall, { x: 2, y: 1.25, z: 0.1 }), { x: 1, y: 2.5, z: 1 })
    // Outward (the room is on the left of a → b, here +x) the solid reaches x 0.8.
    near(placed(wall, { x: 2, y: -1.25, z: -0.1 }), { x: 0.8, y: 0, z: 1 })
    near(placed(trim, { x: -2, y: -0.06, z: 0.1 }), { x: 1, y: 0, z: 5 })
    expect(wall.material).not.toBe(trim.material)
    const other = meshesOf(
      occluders.wall({ a: { x: 0, z: 0 }, b: { x: 1, z: 0 }, height: 2, color: 0x6d758d }),
    )
    expect(other[0]?.material).not.toBe(wall.material)
    expect(wall.visible).toBe(true)
    expect(trim.visible).toBe(false)
  })
})

describe('occluders.box', () => {
  it('builds a lit box filling `bounds` under the root, with its own material and no rule of its own', () => {
    const root = new Container3D()
    const occluders = createOccluders(root)
    const bounds = { min: [1, 0, 2], max: [1.4, 2.4, 2.6] } as const
    const pillar = occluders.box(bounds, 0xc0cbdc)
    const other = occluders.box(bounds, 0xc0cbdc)
    expect(pillar.parent).toBe(root)
    expect(pillar.material).not.toBe(other.material)
    const corner = placed(pillar, { x: 0.5, y: 0.5, z: 0.5 })
    const opposite = placed(pillar, { x: -0.5, y: -0.5, z: -0.5 })
    expect([corner.x, corner.y, corner.z].map((v) => Number(v.toFixed(6)))).toEqual([1.4, 2.4, 2.6])
    expect([opposite.x, opposite.y, opposite.z].map((v) => Number(v.toFixed(6)))).toEqual([1, 0, 2])
    occluders.update(frameAt(0, 0, true))
    expect(pillar.visible).toBe(true)
  })
})

describe('occluders.update', () => {
  it('fades a cut wall out with its trim shown, blending while it fades, and back in to opaque', () => {
    const occluders = createOccluders(new Container3D())
    const [wall, trim] = meshesOf(
      occluders.wall({ a: { x: 0, z: 0 }, b: { x: 4, z: 0 }, height: 2.5, color: 1 }),
    )
    if (wall === undefined || trim === undefined) throw new Error('no meshes')
    occluders.update(frameAt(0, 0.075))
    expect(wall.material.alpha).toBeCloseTo(0.5, 9)
    expect(wall.material.alphaMode).toBe('blend')
    expect([wall.visible, trim.visible]).toEqual([true, true])
    occluders.update(frameAt(0, 0.075))
    expect(wall.visible).toBe(false)
    occluders.update(frameAt(180, 0.15))
    expect([wall.visible, trim.visible, wall.material.alpha]).toEqual([true, false, 1])
    expect(wall.material.alphaMode).toBe('opaque')
  })

  it('hides a ceiling and sets a prop’s material alpha, at once under reduced motion', () => {
    const occluders = createOccluders(new Container3D())
    const ceiling = new Container3D()
    occluders.ceiling(ceiling)
    const pillar = new Mesh3D({ geometry: new CubeGeometry(), material: new PhongMaterial() })
    occluders.prop(pillar, { bounds: { min: [1.8, 0, 0.8], max: [2.2, 2.4, 1.2] } })
    occluders.update(frameAt(0, 0, true))
    expect(ceiling.visible).toBe(false)
    expect(pillar.material.alpha).toBe(0.25)
    expect(pillar.material.alphaMode).toBe('blend')
    occluders.update(frameAt(90, 0, true))
    expect(pillar.material.alpha).toBe(1)
    expect(pillar.material.alphaMode).toBe('opaque')
  })
})

describe('occluderHooks', () => {
  it('feeds the pass from the rig’s pose and the player’s height each frame, and nothing before the first follow', () => {
    const rig = angledCamera({
      camera: new Camera3D(),
      views: [cameraView('hall')],
      initial: 'hall',
      reducedMotion: () => true,
    })
    const occluders = createOccluders(new Container3D())
    const ceiling = new Container3D()
    occluders.ceiling(ceiling)
    const [wall] = meshesOf(occluders.wall({ a: { x: 0, z: 0 }, b: { x: 4, z: 0 }, height: 2.5, color: 1 }))
    const hooks = occluderHooks(rig, occluders, { height: 1.62, reducedMotion: () => true })
    rig.update(1 / 60)
    hooks.draw?.({ alpha: 1, frameMs: 16, paused: false })
    expect(ceiling.visible).toBe(true)
    // The player 2 m into the room, the camera looking +z from outside the wall at z 0.
    rig.follow(2, 0, 2)
    rig.update(1 / 60)
    hooks.draw?.({ alpha: 1, frameMs: 16, paused: false })
    expect(ceiling.visible).toBe(false)
    expect(wall?.visible).toBe(false)
  })
})
