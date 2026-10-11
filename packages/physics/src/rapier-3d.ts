// The 3D Rapier adapter (M2.1 spec §3.4): the only 3D file that calls Rapier. Loaded with a dynamic import
// from physics-3d.ts, so the wasm loads inside createSim and never at import time.

import RAPIER from '@dimforge/rapier3d-deterministic-compat'
import type { EntityRef } from '@mcthaydt/automata-sim'
import { checkBody, checkCollider, checkDepth, checkUnitQuaternion } from './checks'
import { BodyKind, ShapeKind } from './kinds'
import { Collider3D, RigidBody3D, Transform3D } from './physics-3d.component'
import { CollisionEnded3D, CollisionStarted3D } from './physics-3d.event'
import type { PhysicsAdapter } from './physics-world'

type World = RAPIER.World

// One init per module: the wasm is compiled once per page or process however many sims use it.
let ready: Promise<void> | undefined

// Contacts with fixed geometry are computed for kinematic bodies too (a kinematic player entering a fixed
// sensor zone), but never fixed against fixed: static level geometry touching itself would cost every step.
const COLLISION_TYPES =
  RAPIER.ActiveCollisionTypes.DEFAULT |
  RAPIER.ActiveCollisionTypes.KINEMATIC_FIXED |
  RAPIER.ActiveCollisionTypes.KINEMATIC_KINEMATIC

function colliderDesc(entity: EntityRef): RAPIER.ColliderDesc {
  const c = entity.get(Collider3D)
  const desc =
    c.shape === ShapeKind.ball
      ? RAPIER.ColliderDesc.ball(c.hx)
      : c.shape === ShapeKind.cuboid
        ? RAPIER.ColliderDesc.cuboid(c.hx, c.hy, c.hz)
        : RAPIER.ColliderDesc.capsule(c.hy, c.hx)
  return desc
    .setSensor(c.sensor)
    .setCollisionGroups(c.groups)
    .setFriction(c.friction)
    .setRestitution(c.restitution)
    .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS)
    .setActiveCollisionTypes(COLLISION_TYPES)
}

const samePose = (
  t: { x: number; y: number; z: number; qx: number; qy: number; qz: number; qw: number },
  p: { x: number; y: number; z: number },
  q: { x: number; y: number; z: number; w: number },
): { position: boolean; rotation: boolean } => ({
  position: t.x === p.x && t.y === p.y && t.z === p.z,
  rotation: t.qx === q.x && t.qy === q.y && t.qz === q.z && t.qw === q.w,
})

export async function createRapier3D(setup: {
  gravity: { x: number; y: number; z: number }
  dt: number
}): Promise<PhysicsAdapter<World>> {
  ready ??= RAPIER.init()
  await ready
  const queue = new RAPIER.EventQueue(true)
  const adapter: PhysicsAdapter<World> = {
    Transform: Transform3D,
    RigidBody: RigidBody3D,
    Collider: Collider3D,
    started: CollisionStarted3D,
    ended: CollisionEnded3D,

    createWorld() {
      const world = new RAPIER.World(setup.gravity)
      world.timestep = setup.dt
      return world
    },
    restoreWorld: (bytes) => RAPIER.World.restoreSnapshot(bytes),
    takeSnapshot: (world) => world.takeSnapshot(),
    step(world, onCollision) {
      world.step(queue)
      queue.drainCollisionEvents(onCollision)
    },
    free(world) {
      world.free()
    },
    handles(world) {
      const bodies: number[] = []
      const colliders: number[] = []
      world.bodies.forEach((body) => {
        bodies.push(body.handle)
      })
      world.colliders.forEach((collider) => {
        colliders.push(collider.handle)
      })
      return { bodies, colliders }
    },

    validate(entity) {
      if (entity.has(Transform3D)) {
        const t = entity.get(Transform3D)
        checkUnitQuaternion(entity.sid, 'transform-3d', t.qx * t.qx + t.qy * t.qy + t.qz * t.qz + t.qw * t.qw)
      }
      if (entity.has(RigidBody3D)) checkBody(entity.sid, 'physics3d.rigid-body', entity.get(RigidBody3D).kind)
      if (entity.has(Collider3D)) {
        const c = entity.get(Collider3D)
        checkCollider(entity.sid, 'physics3d.collider', c.shape, c.hx, c.hy)
        if (c.shape === ShapeKind.cuboid) checkDepth(entity.sid, 'physics3d.collider', c.hz)
      }
    },

    createBody(world, entity) {
      const t = entity.get(Transform3D)
      const b = entity.get(RigidBody3D)
      const desc = new RAPIER.RigidBodyDesc(b.kind as RAPIER.RigidBodyType)
        .setTranslation(t.x, t.y, t.z)
        .setRotation({ x: t.qx, y: t.qy, z: t.qz, w: t.qw })
        .setLinvel(b.vx, b.vy, b.vz)
        .setAngvel({ x: b.wx, y: b.wy, z: b.wz })
        .setLinearDamping(b.linearDamping)
        .setAngularDamping(b.angularDamping)
      return world.createRigidBody(desc).handle
    },
    createCollider(world, entity, body) {
      const desc = colliderDesc(entity)
      if (body !== undefined) return world.createCollider(desc, world.getRigidBody(body)).handle
      const t = entity.get(Transform3D)
      desc.setTranslation(t.x, t.y, t.z).setRotation({ x: t.qx, y: t.qy, z: t.qz, w: t.qw })
      return world.createCollider(desc).handle
    },
    removeBody(world, body) {
      world.removeRigidBody(world.getRigidBody(body))
    },
    removeCollider(world, collider) {
      world.removeCollider(world.getCollider(collider), true)
    },

    updateBody(world, handle, entity) {
      const body = world.getRigidBody(handle)
      const t = entity.get(Transform3D)
      const b = entity.get(RigidBody3D)
      if (body.bodyType() !== b.kind) body.setBodyType(b.kind as RAPIER.RigidBodyType, true)
      if (body.linearDamping() !== b.linearDamping) body.setLinearDamping(b.linearDamping)
      if (body.angularDamping() !== b.angularDamping) body.setAngularDamping(b.angularDamping)
      const same = samePose(t, body.translation(), body.rotation())
      // sync-out wrote Rapier's own values, so a difference means game code moved the entity.
      if (b.kind === BodyKind.kinematicPosition) {
        if (!same.position) body.setNextKinematicTranslation({ x: t.x, y: t.y, z: t.z })
        if (!same.rotation) body.setNextKinematicRotation({ x: t.qx, y: t.qy, z: t.qz, w: t.qw })
      } else {
        if (!same.position) body.setTranslation({ x: t.x, y: t.y, z: t.z }, true)
        if (!same.rotation) body.setRotation({ x: t.qx, y: t.qy, z: t.qz, w: t.qw }, true)
      }
      const v = body.linvel()
      if (v.x !== b.vx || v.y !== b.vy || v.z !== b.vz) body.setLinvel({ x: b.vx, y: b.vy, z: b.vz }, true)
      const w = body.angvel()
      if (w.x !== b.wx || w.y !== b.wy || w.z !== b.wz) body.setAngvel({ x: b.wx, y: b.wy, z: b.wz }, true)
    },
    colliderMatches(world, handle, entity) {
      const collider = world.getCollider(handle)
      const c = entity.get(Collider3D)
      if (collider.shapeType() !== (c.shape as number)) return false
      let sizeMatches: boolean
      if (c.shape === ShapeKind.ball) sizeMatches = collider.radius() === c.hx
      else if (c.shape === ShapeKind.cuboid) {
        const h = collider.halfExtents() as RAPIER.Vector
        sizeMatches = h.x === c.hx && h.y === c.hy && h.z === c.hz
      } else sizeMatches = collider.radius() === c.hx && collider.halfHeight() === c.hy
      return (
        sizeMatches &&
        collider.isSensor() === c.sensor &&
        collider.collisionGroups() === c.groups &&
        collider.friction() === c.friction &&
        collider.restitution() === c.restitution
      )
    },
    updateLoneCollider(world, handle, entity) {
      const collider = world.getCollider(handle)
      const t = entity.get(Transform3D)
      const same = samePose(t, collider.translation(), collider.rotation())
      if (!same.position) collider.setTranslation({ x: t.x, y: t.y, z: t.z })
      if (!same.rotation) collider.setRotation({ x: t.qx, y: t.qy, z: t.qz, w: t.qw })
    },
    writeBack(world, handle, entity) {
      const body = world.getRigidBody(handle)
      const p = body.translation()
      const q = body.rotation()
      const v = body.linvel()
      const w = body.angvel()
      // Only write what moved, so a resting body does not appear in every render delta.
      const same = samePose(entity.get(Transform3D), p, q)
      if (!same.position || !same.rotation)
        entity.set(Transform3D, { x: p.x, y: p.y, z: p.z, qx: q.x, qy: q.y, qz: q.z, qw: q.w })
      const b = entity.get(RigidBody3D)
      if (b.vx !== v.x || b.vy !== v.y || b.vz !== v.z || b.wx !== w.x || b.wy !== w.y || b.wz !== w.z)
        entity.set(RigidBody3D, { vx: v.x, vy: v.y, vz: v.z, wx: w.x, wy: w.y, wz: w.z })
    },
    isSensor: (world, handle) => world.getCollider(handle).isSensor(),
  }
  return adapter
}
