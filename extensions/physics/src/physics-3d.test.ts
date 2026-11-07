import {
  createSim,
  defineCommand,
  definePlugin,
  defineSystem,
  type Sim,
  SimFaultedError,
  type SpawnPart,
} from '@automata/sim'
import { afterEach, expect, test } from 'vitest'
import { z } from 'zod'
import {
  BodyKind,
  body3d,
  Collider3D,
  collider3d,
  type Physics3DOptions,
  physics3d,
  RigidBody3D,
  Transform3D,
  transform3d,
} from './3d'

// Despawning goes through a system, as in a game.
const Kill = defineCommand('kill', z.object({ sid: z.number().int() }))
const killer = definePlugin({
  name: 'killer',
  commands: [Kill],
  systems: [
    defineSystem({
      name: 'kill',
      phase: 'input',
      run: (ctx) => {
        for (const c of ctx.commands.of(Kill)) ctx.despawn(c.payload.sid)
      },
    }),
  ],
})

const sims: Sim[] = []
afterEach(() => {
  for (const sim of sims.splice(0)) sim.dispose()
})
async function world(options: Physics3DOptions = {}): Promise<Sim> {
  const sim = await createSim({ seed: 1, plugins: [physics3d(options), killer] })
  sims.push(sim)
  return sim
}
const run = (sim: Sim, ticks: number) => {
  for (let i = 0; i < ticks; i++) sim.step([])
}
const pose = (sim: Sim, sid: number) =>
  sim.entity(sid)?.get(Transform3D) as { x: number; y: number; z: number }
const floor = (sim: Sim, y = 0): number =>
  sim.spawn([transform3d({ y: y - 0.1 }), collider3d.cuboid(5, 0.1, 5)]) // top face at `y`
const ball = (
  sim: Sim,
  at: { x?: number; y?: number; z?: number },
  radius = 0.5,
  extra: SpawnPart[] = [],
): number => sim.spawn([transform3d(at), body3d(BodyKind.dynamic), collider3d.ball(radius), ...extra])

test('a dynamic ball falls onto a lone cuboid collider and comes to rest on it', async () => {
  const sim = await world()
  floor(sim)
  const b = ball(sim, { y: 3 })
  const heights: number[] = []
  for (let t = 0; t < 30; t++) {
    sim.step([])
    heights.push(pose(sim, b).y)
  }
  expect(heights[5]).toBeLessThan(heights[1] as number)
  expect(sim.entity(b)?.get(RigidBody3D).vy).toBeLessThan(0)
  run(sim, 270)
  expect(pose(sim, b).y).toBeCloseTo(0.5, 1)
})

test('moved bodies are in the render delta; a body at rest is not rewritten every tick', async () => {
  const sim = await world()
  floor(sim)
  const b = ball(sim, { y: 3 })
  sim.step([])
  const moving = sim.step([]).render.changed.find((row) => row.sid === b)
  expect(moving?.components['transform-3d']).toBeDefined()
  run(sim, 400) // long enough for Rapier to put the ball to sleep
  expect(sim.step([]).render.changed).toEqual([])
})

test('a kinematic-velocity body with no collider moves by its velocity', async () => {
  const sim = await world()
  const k = sim.spawn([transform3d(), body3d(BodyKind.kinematicVelocity, { vx: 1 })])
  run(sim, 60)
  expect(pose(sim, k).x).toBeCloseTo(1, 4)
})

test('despawning the floor removes its collider, and the ball falls through', async () => {
  const sim = await world()
  const f = floor(sim)
  const b = ball(sim, { y: 1 })
  run(sim, 120)
  expect(pose(sim, b).y).toBeCloseTo(0.5, 1)
  sim.step([{ tick: sim.tick, source: 0, seq: 0, type: 'kill', payload: { sid: f } }])
  run(sim, 60)
  expect(pose(sim, b).y).toBeLessThan(0)
})

test('removing the floor’s collider component removes the collider too', async () => {
  const sim = await world()
  const f = floor(sim)
  const b = ball(sim, { y: 1 })
  run(sim, 120)
  sim.entity(f)?.remove(Collider3D)
  run(sim, 60)
  expect(pose(sim, b).y).toBeLessThan(0)
})

test('a removed collider comes back when the component is added again', async () => {
  const sim = await world()
  const f = floor(sim)
  const b = ball(sim, { y: 1 })
  sim.entity(f)?.remove(Collider3D)
  sim.step([])
  sim.entity(f)?.add(Collider3D, (collider3d.cuboid(5, 0.1, 5) as readonly [unknown, never])[1])
  run(sim, 180)
  expect(pose(sim, b).y).toBeCloseTo(0.5, 1)
})

test('writing Transform3D teleports a dynamic body', async () => {
  const sim = await world({ gravity: { x: 0, y: 0, z: 0 } })
  const b = ball(sim, { y: 0 })
  sim.step([])
  sim.entity(b)?.set(Transform3D, { x: 7, y: 2, z: -3 })
  sim.step([])
  expect(pose(sim, b)).toMatchObject({ x: 7, y: 2, z: -3 })
})

test('a kinematic-position body follows its transform, and Rapier reports the implied velocity', async () => {
  const sim = await world()
  const k = sim.spawn([transform3d(), body3d(BodyKind.kinematicPosition), collider3d.capsule(0.45, 0.3)])
  sim.step([])
  for (let t = 1; t <= 10; t++) {
    sim.entity(k)?.set(Transform3D, { x: t * 0.05 })
    sim.step([])
    expect(pose(sim, k).x).toBe(Math.fround(t * 0.05))
  }
  expect(sim.entity(k)?.get(RigidBody3D).vx).toBeCloseTo(3, 3) // 0.05 m per 1/60 s
})

test('writing a velocity sets it', async () => {
  const sim = await world({ gravity: { x: 0, y: 0, z: 0 } })
  const b = ball(sim, {})
  sim.step([])
  sim.entity(b)?.set(RigidBody3D, { vx: 2 })
  run(sim, 60)
  expect(pose(sim, b).x).toBeCloseTo(2, 3)
})

test('changing kind to fixed stops a body; damping slows one', async () => {
  const sim = await world({ gravity: { x: 0, y: 0, z: 0 } })
  const a = ball(sim, {}, 0.5, [])
  const b = ball(sim, { z: 5 })
  for (const sid of [a, b]) sim.entity(sid)?.set(RigidBody3D, { vx: 1 })
  sim.step([])
  sim.entity(a)?.set(RigidBody3D, { kind: BodyKind.fixed })
  sim.entity(b)?.set(RigidBody3D, { linearDamping: 5 })
  const x = pose(sim, a).x
  run(sim, 60)
  expect(pose(sim, a).x).toBe(x)
  expect(sim.entity(b)?.get(RigidBody3D).vx).toBeLessThan(0.01)
})

test('changing a collider’s size rebuilds it', async () => {
  const sim = await world()
  floor(sim)
  const b = ball(sim, { y: 1 })
  run(sim, 120)
  expect(pose(sim, b).y).toBeCloseTo(0.5, 1)
  sim.entity(b)?.set(Collider3D, { hx: 1 })
  run(sim, 120)
  expect(pose(sim, b).y).toBeCloseTo(1, 1)
})

test('moving a lone collider moves it', async () => {
  const sim = await world()
  const f = floor(sim)
  const b = ball(sim, { y: 1 })
  run(sim, 120)
  sim.entity(f)?.set(Transform3D, { y: -1.1 })
  run(sim, 120)
  expect(pose(sim, b).y).toBeCloseTo(-0.5, 1)
})

test.each([
  ['zero size', [transform3d(), collider3d.ball(0)], 'physics3d.collider.hx'],
  [
    'unknown shape',
    [transform3d(), [Collider3D, { shape: 7, hx: 1, hy: 1, hz: 1 }]],
    'physics3d.collider.shape',
  ],
  ['flat cuboid', [transform3d(), collider3d.cuboid(1, 1, 0)], 'physics3d.collider.hz'],
  ['unknown body kind', [transform3d(), [RigidBody3D, { kind: 9 }]], 'physics3d.rigid-body.kind'],
  ['zero quaternion', [[Transform3D, {}], collider3d.ball(1)], 'transform-3d.qw'],
] as const)('%s: sync-in throws naming the entity and field', async (_, parts, field) => {
  const sim = await world()
  const sid = sim.spawn(parts as unknown as SpawnPart[])
  let caught: unknown
  try {
    sim.step([])
  } catch (err) {
    caught = err
  }
  expect(caught).toBeInstanceOf(SimFaultedError)
  expect(((caught as SimFaultedError).cause as Error).message).toContain(`entity ${sid}: ${field}`)
})
