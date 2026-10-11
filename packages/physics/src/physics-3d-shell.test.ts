import { createSim } from '@mcthaydt/automata-sim'
import { expect, test } from 'vitest'
import {
  BodyKind,
  body3d,
  Collider3D,
  collider3d,
  physics3d,
  RigidBody3D,
  ShapeKind,
  Transform3D,
  transform3d,
} from './3d'

test('physics3d() is the physics-3d plugin with its four systems in the spec phases', () => {
  const plugin = physics3d()
  expect(plugin.name).toBe('physics-3d')
  expect(plugin.systems.map((s) => [s.name, s.phase])).toEqual([
    ['physics3d.sync-in', 'prePhysics'],
    ['physics3d.step', 'physics'],
    ['physics3d.sync-out', 'postPhysics'],
    ['physics3d.events', 'postPhysics'],
  ])
  expect(plugin.systems[3]?.after).toEqual(['physics3d.sync-out'])
  expect(plugin.components.map((c) => c.id).sort()).toEqual([
    'physics3d.collider',
    'physics3d.rigid-body',
    'transform-3d',
  ])
  expect(plugin.state).toBeDefined()
})

test('spawn helpers give the spec §3.3 defaults', () => {
  expect(transform3d({ y: 2 })).toEqual([Transform3D, { x: 0, y: 2, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 }])
  expect(body3d(BodyKind.kinematicPosition, { vx: 1 })).toEqual([
    RigidBody3D,
    { kind: 2, linearDamping: 0, angularDamping: 0, vx: 1, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0 },
  ])
  const all = { sensor: false, groups: 0xffffffff, friction: 0.5, restitution: 0 }
  expect(collider3d.ball(0.5)).toEqual([Collider3D, { shape: ShapeKind.ball, hx: 0.5, hy: 0, hz: 0, ...all }])
  expect(collider3d.cuboid(1, 2, 3, { sensor: true })).toEqual([
    Collider3D,
    { shape: ShapeKind.cuboid, hx: 1, hy: 2, hz: 3, ...all, sensor: true },
  ])
  expect(collider3d.capsule(0.45, 0.3)).toEqual([
    Collider3D,
    { shape: ShapeKind.capsule, hx: 0.3, hy: 0.45, hz: 0, ...all },
  ])
})

test('a sim with physics3d is created and steps', async () => {
  const sim = await createSim({ seed: 1, plugins: [physics3d()] })
  sim.step([])
  expect(sim.tick).toBe(1)
  sim.dispose()
})
