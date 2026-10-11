// The 2D Rapier adapter (M2.1 spec §3.4): the only 2D file that calls Rapier. Loaded with a dynamic import
// from physics-2d.ts, so the wasm loads inside createSim and never at import time. It mirrors rapier-3d.ts
// with 2D vectors and a scalar rotation.

import RAPIER from '@dimforge/rapier2d-deterministic-compat'
import type { EntityRef } from '@mcthaydt/automata-sim'
import { checkBody, checkCollider } from './checks'
import { BodyKind, ShapeKind } from './kinds'
import { Collider2D, RigidBody2D, Transform2D } from './physics-2d.component'
import { CollisionEnded2D, CollisionStarted2D } from './physics-2d.event'
import type { PhysicsAdapter } from './physics-world'

type World = RAPIER.World

// One init per module: the wasm is compiled once per page or process however many sims use it.
let ready: Promise<void> | undefined

// As in 3D: kinematic bodies get contacts with fixed and kinematic colliders; fixed against fixed never.
const COLLISION_TYPES =
  RAPIER.ActiveCollisionTypes.DEFAULT |
  RAPIER.ActiveCollisionTypes.KINEMATIC_FIXED |
  RAPIER.ActiveCollisionTypes.KINEMATIC_KINEMATIC

function colliderDesc(entity: EntityRef): RAPIER.ColliderDesc {
  const c = entity.get(Collider2D)
  const desc =
    c.shape === ShapeKind.ball
      ? RAPIER.ColliderDesc.ball(c.hx)
      : c.shape === ShapeKind.cuboid
        ? RAPIER.ColliderDesc.cuboid(c.hx, c.hy)
        : RAPIER.ColliderDesc.capsule(c.hy, c.hx)
  return desc
    .setSensor(c.sensor)
    .setCollisionGroups(c.groups)
    .setFriction(c.friction)
    .setRestitution(c.restitution)
    .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS)
    .setActiveCollisionTypes(COLLISION_TYPES)
}

export async function createRapier2D(setup: {
  gravity: { x: number; y: number }
  dt: number
}): Promise<PhysicsAdapter<World>> {
  ready ??= RAPIER.init()
  await ready
  const queue = new RAPIER.EventQueue(true)
  const adapter: PhysicsAdapter<World> = {
    Transform: Transform2D,
    RigidBody: RigidBody2D,
    Collider: Collider2D,
    started: CollisionStarted2D,
    ended: CollisionEnded2D,

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
    close() {
      queue.free()
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
      if (entity.has(RigidBody2D)) checkBody(entity.sid, 'physics2d.rigid-body', entity.get(RigidBody2D).kind)
      if (entity.has(Collider2D)) {
        const c = entity.get(Collider2D)
        checkCollider(entity.sid, 'physics2d.collider', c.shape, c.hx, c.hy)
      }
    },

    createBody(world, entity) {
      const t = entity.get(Transform2D)
      const b = entity.get(RigidBody2D)
      const desc = new RAPIER.RigidBodyDesc(b.kind as RAPIER.RigidBodyType)
        .setTranslation(t.x, t.y)
        .setRotation(t.rotation)
        .setLinvel(b.vx, b.vy)
        .setAngvel(b.angvel)
        .setLinearDamping(b.linearDamping)
        .setAngularDamping(b.angularDamping)
      return world.createRigidBody(desc).handle
    },
    createCollider(world, entity, body) {
      const desc = colliderDesc(entity)
      if (body !== undefined) return world.createCollider(desc, world.getRigidBody(body)).handle
      const t = entity.get(Transform2D)
      desc.setTranslation(t.x, t.y).setRotation(t.rotation)
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
      const t = entity.get(Transform2D)
      const b = entity.get(RigidBody2D)
      if (body.bodyType() !== b.kind) {
        checkBody(entity.sid, 'physics2d.rigid-body', b.kind)
        body.setBodyType(b.kind as RAPIER.RigidBodyType, true)
      }
      if (body.linearDamping() !== b.linearDamping) body.setLinearDamping(b.linearDamping)
      if (body.angularDamping() !== b.angularDamping) body.setAngularDamping(b.angularDamping)
      const p = body.translation()
      const samePosition = t.x === p.x && t.y === p.y
      const sameRotation = t.rotation === body.rotation()
      // sync-out wrote Rapier's own values, so a difference means game code moved the entity.
      if (b.kind === BodyKind.kinematicPosition) {
        if (!samePosition) body.setNextKinematicTranslation({ x: t.x, y: t.y })
        if (!sameRotation) body.setNextKinematicRotation(t.rotation)
      } else {
        if (!samePosition) body.setTranslation({ x: t.x, y: t.y }, true)
        if (!sameRotation) body.setRotation(t.rotation, true)
      }
      const v = body.linvel()
      if (v.x !== b.vx || v.y !== b.vy) body.setLinvel({ x: b.vx, y: b.vy }, true)
      if (body.angvel() !== b.angvel) body.setAngvel(b.angvel, true)
    },
    colliderMatches(world, handle, entity) {
      const collider = world.getCollider(handle)
      const c = entity.get(Collider2D)
      if (collider.shapeType() !== (c.shape as number)) return false
      let sizeMatches: boolean
      if (c.shape === ShapeKind.ball) sizeMatches = collider.radius() === c.hx
      else if (c.shape === ShapeKind.cuboid) {
        const h = collider.halfExtents() as RAPIER.Vector
        sizeMatches = h.x === c.hx && h.y === c.hy
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
      const t = entity.get(Transform2D)
      const p = collider.translation()
      if (t.x !== p.x || t.y !== p.y) collider.setTranslation({ x: t.x, y: t.y })
      if (t.rotation !== collider.rotation()) collider.setRotation(t.rotation)
    },
    writeBack(world, handle, entity, wasAsleep) {
      const body = world.getRigidBody(handle)
      const asleep = body.isSleeping()
      // Rapier zeroes a body's velocity as it falls asleep, so that tick is still written; after it, nothing moves.
      if (asleep && wasAsleep) return true
      const p = body.translation()
      const rotation = body.rotation()
      const v = body.linvel()
      const angvel = body.angvel()
      // Only write what moved, so a resting body does not appear in every render delta.
      const t = entity.get(Transform2D)
      if (t.x !== p.x || t.y !== p.y || t.rotation !== rotation)
        entity.set(Transform2D, { x: p.x, y: p.y, rotation })
      const b = entity.get(RigidBody2D)
      if (b.vx !== v.x || b.vy !== v.y || b.angvel !== angvel)
        entity.set(RigidBody2D, { vx: v.x, vy: v.y, angvel })
      return asleep
    },
    isSensor: (world, handle) => world.getCollider(handle).isSensor(),
    // Rapier's `Collider.parent()` is a JS-side cache that a restored world fills by looking up the raw parent,
    // and for a lone collider that lookup returns a body; the raw set reports the true parent handle.
    colliderParent: (world, handle) => world.colliders.raw.coParent(handle),
  }
  return adapter
}
