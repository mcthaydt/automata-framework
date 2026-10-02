import R2 from '@dimforge/rapier2d-deterministic-compat'
import R3 from '@dimforge/rapier3d-deterministic-compat'
import { mulberry32 } from '../shared/prng'

let ready: Promise<void> | undefined
export function initRapier(): Promise<void> {
  ready ??= Promise.all([R3.init(), R2.init()]).then(() => undefined)
  return ready
}

/** state: per body [handle, translation, rotation, linvel, angvel]; snapshot: Rapier's own bytes at the end. */
export type RunOut = { bodies: number; state: number[]; snapshot: Uint8Array; roundTripSnapshot: Uint8Array }

/** 40 balls + 20 cuboids + a 6-link revolute-joint chain, falling onto a ground slab. */
export function run3d(ticks: number, restoreAt?: number): RunOut {
  let world = new R3.World({ x: 0, y: -9.81, z: 0 })
  world.createCollider(R3.ColliderDesc.cuboid(50, 0.5, 50).setFriction(0.7))
  const rand = mulberry32(3)
  for (let i = 0; i < 60; i++) {
    const body = world.createRigidBody(
      R3.RigidBodyDesc.dynamic().setTranslation(rand() * 10 - 5, 2 + i * 0.6, rand() * 10 - 5),
    )
    const desc =
      i < 40
        ? R3.ColliderDesc.ball(0.3 + rand() * 0.2)
        : R3.ColliderDesc.cuboid(0.2 + rand() * 0.3, 0.2 + rand() * 0.3, 0.2 + rand() * 0.3)
    world.createCollider(desc.setRestitution(0.4).setFriction(0.5), body)
  }
  let prev = world.createRigidBody(R3.RigidBodyDesc.fixed().setTranslation(0, 12, 0))
  for (let i = 0; i < 6; i++) {
    const link = world.createRigidBody(R3.RigidBodyDesc.dynamic().setTranslation(0.8 * (i + 1), 12, 0))
    world.createCollider(R3.ColliderDesc.cuboid(0.35, 0.1, 0.1), link)
    world.createImpulseJoint(
      R3.JointData.revolute({ x: 0.4, y: 0, z: 0 }, { x: -0.4, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }),
      prev,
      link,
      true,
    )
    prev = link
  }
  for (let t = 0; t < ticks; t++) {
    if (t === restoreAt) world = R3.World.restoreSnapshot(world.takeSnapshot())
    world.step()
  }
  const state: number[] = []
  world.forEachRigidBody((b) => {
    const p = b.translation()
    const q = b.rotation()
    const v = b.linvel()
    const w = b.angvel()
    state.push(b.handle, p.x, p.y, p.z, q.x, q.y, q.z, q.w, v.x, v.y, v.z, w.x, w.y, w.z)
  })
  const snapshot = world.takeSnapshot()
  const roundTripSnapshot = R3.World.restoreSnapshot(snapshot).takeSnapshot()
  return { bodies: state.length / 14, state, snapshot, roundTripSnapshot }
}

export function run2d(ticks: number, restoreAt?: number): RunOut {
  let world = new R2.World({ x: 0, y: -9.81 })
  world.createCollider(R2.ColliderDesc.cuboid(50, 0.5).setFriction(0.7))
  const rand = mulberry32(4)
  for (let i = 0; i < 60; i++) {
    const body = world.createRigidBody(
      R2.RigidBodyDesc.dynamic().setTranslation(rand() * 10 - 5, 2 + i * 0.6),
    )
    const desc =
      i < 40
        ? R2.ColliderDesc.ball(0.3 + rand() * 0.2)
        : R2.ColliderDesc.cuboid(0.2 + rand() * 0.3, 0.2 + rand() * 0.3)
    world.createCollider(desc.setRestitution(0.4).setFriction(0.5), body)
  }
  let prev = world.createRigidBody(R2.RigidBodyDesc.fixed().setTranslation(0, 12))
  for (let i = 0; i < 6; i++) {
    const link = world.createRigidBody(R2.RigidBodyDesc.dynamic().setTranslation(0.8 * (i + 1), 12))
    world.createCollider(R2.ColliderDesc.cuboid(0.35, 0.1), link)
    world.createImpulseJoint(R2.JointData.revolute({ x: 0.4, y: 0 }, { x: -0.4, y: 0 }), prev, link, true)
    prev = link
  }
  for (let t = 0; t < ticks; t++) {
    if (t === restoreAt) world = R2.World.restoreSnapshot(world.takeSnapshot())
    world.step()
  }
  const state: number[] = []
  world.forEachRigidBody((b) => {
    const p = b.translation()
    const v = b.linvel()
    state.push(b.handle, p.x, p.y, b.rotation(), v.x, v.y, b.angvel())
  })
  const snapshot = world.takeSnapshot()
  const roundTripSnapshot = R2.World.restoreSnapshot(snapshot).takeSnapshot()
  return { bodies: state.length / 7, state, snapshot, roundTripSnapshot }
}
