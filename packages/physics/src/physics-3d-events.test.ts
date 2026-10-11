import {
  createSim,
  defineCommand,
  definePlugin,
  defineSystem,
  type Sim,
  type SimEvent,
} from '@mcthaydt/automata-sim'
import { afterEach, expect, test } from 'vitest'
import { z } from 'zod'
import { BodyKind, body3d, Collider3D, collider3d, physics3d, transform3d } from './3d'

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
async function world(): Promise<Sim> {
  const sim = await createSim({ seed: 1, plugins: [physics3d(), killer] })
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

test('within one tick, started events come before ended events, each in sid order', async () => {
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
    const order = tick.map((e) => [e.kind === 'started' ? 0 : 1, e.a, e.b])
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

test('despawning a resting ball reports no event for its removed collider', async () => {
  const sim = await world()
  sim.spawn([transform3d({ y: -0.1 }), collider3d.cuboid(5, 0.1, 5)])
  const ball = sim.spawn([transform3d({ y: 1 }), body3d(BodyKind.dynamic), collider3d.ball(0.5)])
  for (let t = 0; t < 120; t++) sim.step([])
  const after: ReturnType<typeof collisions> = []
  after.push(
    ...collisions(
      sim.step([{ tick: sim.tick, source: 0, seq: 0, type: 'kill', payload: { sid: ball } }]).events,
    ),
  )
  for (let t = 0; t < 5; t++) after.push(...collisions(sim.step([]).events))
  expect(after).toEqual([])
})
