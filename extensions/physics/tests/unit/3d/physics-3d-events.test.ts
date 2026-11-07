import { createSim, defineCommand, definePlugin, defineSystem, type Sim, type SimEvent } from '@automata/sim'
import { afterEach, expect, test } from 'vitest'
import { z } from 'zod'
import {
  BodyKind,
  body3d,
  Collider3D,
  collider3d,
  type Physics3DOptions,
  physics3d,
  transform3d,
} from '#src/entries/3d.ts'
import { createScene3D, sceneCommands } from '#src/testing/scene-3d.ts'

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
type Pair = { a: number; b: number; sensor: boolean }
const collisions = (events: readonly SimEvent[]) =>
  events
    .filter((e) => e.type.startsWith('physics3d.collision-'))
    .map((e) => ({ kind: e.type.slice('physics3d.collision-'.length), ...(e.payload as Pair) }))

test('balls landing in the same tick report started events sorted by sid, a < b', async () => {
  const sim = await world()
  const floor = sim.spawn([transform3d({ y: -0.1 }), collider3d.cuboid(5, 0.1, 5)])
  const balls = [-2, 0, 2].map((x) =>
    sim.spawn([transform3d({ x, y: 1 }), body3d(BodyKind.dynamic), collider3d.ball(0.5)]),
  )
  sim.step([])
  // Rebuild the floor's collider: its Rapier handle is now newer than the balls' while its sid stays lowest,
  // so `a < b` has to come from the sids, not from Rapier's pair order.
  sim.entity(floor)?.set(Collider3D, { friction: 0.6 })
  let landed: ReturnType<typeof collisions> = []
  for (let t = 0; t < 120 && landed.length === 0; t++) landed = collisions(sim.step([]).events)
  expect(landed).toEqual(balls.map((b) => ({ kind: 'started', a: floor, b, sensor: false })))
})

test('a ball falling through a sensor reports started then ended with sensor: true, then lands', async () => {
  const sim = await world()
  const floor = sim.spawn([transform3d({ y: -0.1 }), collider3d.cuboid(5, 0.1, 5)])
  const zone = sim.spawn([transform3d({ y: 2 }), collider3d.cuboid(2, 0.1, 2, { sensor: true })])
  const ball = sim.spawn([transform3d({ y: 4 }), body3d(BodyKind.dynamic), collider3d.ball(0.5)])
  const seen: ReturnType<typeof collisions> = []
  for (let t = 0; t < 180; t++) seen.push(...collisions(sim.step([]).events))
  expect(seen.slice(0, 3)).toEqual([
    { kind: 'started', a: zone, b: ball, sensor: true },
    { kind: 'ended', a: zone, b: ball, sensor: true },
    { kind: 'started', a: floor, b: ball, sensor: false },
  ])
})

test('within one tick, ended events come before started events, each in sid order', async () => {
  const sim = await world()
  sim.spawn([transform3d({ y: -0.1 }), collider3d.cuboid(20, 0.1, 20)])
  for (let i = 0; i < 12; i++)
    sim.spawn([
      transform3d({ x: (i % 4) * 1.1, y: 1 + i * 0.7, z: Math.floor(i / 4) * 1.1 }),
      body3d(BodyKind.dynamic),
      collider3d.ball(0.5, { restitution: 0.6 }),
    ])
  let busiest = 0
  for (let t = 0; t < 300; t++) {
    const tick = collisions(sim.step([]).events)
    busiest = Math.max(busiest, tick.length)
    const order = tick.map((e) => [e.kind === 'ended' ? 0 : 1, e.a, e.b])
    const sorted = [...order].sort(
      (x, y) =>
        (x[0] as number) - (y[0] as number) ||
        (x[1] as number) - (y[1] as number) ||
        (x[2] as number) - (y[2] as number),
    )
    expect(order).toEqual(sorted)
    for (const e of tick) expect(e.a).toBeLessThan(e.b)
  }
  expect(busiest).toBeGreaterThan(1) // not vacuous
})

/**
 * Despawns `sid` and returns the next tick's events. The despawn lands in the cleanup phase, after that
 * tick's physics, so the collider leaves Rapier, and its contacts end, at the next tick's sync-in.
 */
const kill = (sim: Sim, sid: number) => {
  const sameTick = collisions(
    sim.step([{ tick: sim.tick, source: 0, seq: 0, type: 'kill', payload: { sid } }]).events,
  )
  expect(sameTick).toEqual([])
  return sim.step([]).events
}

/** A floor with one ball resting on it, after the started event. */
async function restingBall(sim: Sim, at = { y: 1 }) {
  const floor = sim.spawn([transform3d({ y: -0.1 }), collider3d.cuboid(5, 0.1, 5)])
  const ball = sim.spawn([transform3d(at), body3d(BodyKind.dynamic), collider3d.ball(0.5)])
  const seen: ReturnType<typeof collisions> = []
  for (let t = 0; t < 120; t++) seen.push(...collisions(sim.step([]).events))
  expect(seen).toEqual([{ kind: 'started', a: floor, b: ball, sensor: false }])
  return { floor, ball }
}

test('despawning a resting ball reports ended for its contact at the next tick', async () => {
  const sim = await world()
  const { floor, ball } = await restingBall(sim)
  expect(collisions(kill(sim, ball))).toEqual([{ kind: 'ended', a: floor, b: ball, sensor: false }])
  for (let t = 0; t < 5; t++) expect(collisions(sim.step([]).events)).toEqual([])
})

test('removing a resting ball’s Collider3D reports ended', async () => {
  const sim = await world()
  const { floor, ball } = await restingBall(sim)
  sim.entity(ball)?.remove(Collider3D)
  expect(collisions(sim.step([]).events)).toEqual([{ kind: 'ended', a: floor, b: ball, sensor: false }])
})

test('rebuilding a touching collider reports ended then started in the same tick, never a lone started', async () => {
  const sim = await world()
  const { floor, ball } = await restingBall(sim)
  sim.entity(ball)?.set(Collider3D, { friction: 0.9 })
  expect(collisions(sim.step([]).events)).toEqual([
    { kind: 'ended', a: floor, b: ball, sensor: false },
    { kind: 'started', a: floor, b: ball, sensor: false },
  ])
  for (let t = 0; t < 5; t++) expect(collisions(sim.step([]).events)).toEqual([])
})

test('making a touching collider a sensor ends the solid contact and starts a sensor one', async () => {
  const sim = await world({ gravity: { x: 0, y: 0, z: 0 } })
  const floor = sim.spawn([transform3d({ y: -0.1 }), collider3d.cuboid(5, 0.1, 5)])
  const ball = sim.spawn([transform3d({ y: 0.45 }), body3d(BodyKind.dynamic), collider3d.ball(0.5)])
  expect(collisions(sim.step([]).events)).toEqual([{ kind: 'started', a: floor, b: ball, sensor: false }])
  sim.entity(floor)?.set(Collider3D, { sensor: true })
  expect(collisions(sim.step([]).events)).toEqual([
    { kind: 'ended', a: floor, b: ball, sensor: false },
    { kind: 'started', a: floor, b: ball, sensor: true },
  ])
})

test('a ball despawned inside a sensor zone reports the sensor contact ended', async () => {
  const sim = await world({ gravity: { x: 0, y: 0, z: 0 } })
  const zone = sim.spawn([transform3d(), collider3d.cuboid(2, 2, 2, { sensor: true })])
  const ball = sim.spawn([transform3d(), body3d(BodyKind.dynamic), collider3d.ball(0.5)])
  expect(collisions(sim.step([]).events)).toEqual([{ kind: 'started', a: zone, b: ball, sensor: true }])
  expect(collisions(kill(sim, ball))).toEqual([{ kind: 'ended', a: zone, b: ball, sensor: true }])
})

test('a contact that began before a snapshot still reports ended after a restore', async () => {
  const sim = await world()
  const { floor, ball } = await restingBall(sim)
  const restored = await world()
  restored.restore(sim.snapshot())
  expect(collisions(kill(restored, ball))).toEqual([{ kind: 'ended', a: floor, b: ball, sensor: false }])
})

/** Fails on a started for a pair already touching, or an ended for a pair that is not. */
function expectBalanced(events: ReturnType<typeof collisions>): number {
  const touching = new Set<string>()
  for (const e of events) {
    const key = `${e.a}:${e.b}`
    if (e.kind === 'started') {
      expect(touching.has(key), `started twice: ${key}`).toBe(false)
      touching.add(key)
    } else {
      expect(touching.has(key), `ended without started: ${key}`).toBe(true)
      touching.delete(key)
    }
  }
  return events.length
}

test('the mixed scene, with its spawns, despawns and component edits, reports balanced pairs', async () => {
  const sim = await createScene3D()
  sims.push(sim)
  const all: ReturnType<typeof collisions> = []
  for (let t = 0; t < 300; t++) all.push(...collisions(sim.step(sceneCommands(t)).events))
  expect(expectBalanced(all)).toBeGreaterThan(20)
  expect(all.some((e) => e.kind === 'ended' && !e.sensor)).toBe(true) // not vacuous
})
