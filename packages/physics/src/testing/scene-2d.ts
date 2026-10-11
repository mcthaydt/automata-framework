// The mixed 2D scene for the snapshot and parity tests (M2.1 spec §7), the 2D twin of scene-3d.ts.
import {
  type Command,
  createSim,
  defineCommand,
  definePlugin,
  defineSystem,
  type Sim,
} from '@mcthaydt/automata-sim'
import { z } from 'zod'
import { BodyKind, body2d, collider2d, physics2d, Transform2D, transform2d } from '../2d'

const Kill = defineCommand('kill', z.object({ sid: z.number().int() }))
const Drop = defineCommand('drop', z.object({ x: z.number() }))
const Walk = defineCommand('walk', z.object({ x: z.number() }))

/** The kinematic capsule is the first entity spawned. */
const WALKER_SID = 1

const scenePlugin = definePlugin({
  name: 'scene',
  commands: [Kill, Drop, Walk],
  systems: [
    defineSystem({
      name: 'scene.input',
      phase: 'input',
      run(ctx) {
        for (const c of ctx.commands.of(Kill)) ctx.despawn(c.payload.sid)
        for (const c of ctx.commands.of(Drop))
          ctx.spawn(
            transform2d({ x: c.payload.x, y: 6, rotation: 0.3 }),
            body2d(BodyKind.dynamic),
            collider2d.cuboid(0.3, 0.2, { restitution: 0.3 }),
          )
        for (const c of ctx.commands.of(Walk)) {
          const walker = ctx.entity(WALKER_SID)
          if (walker) walker.set(Transform2D, { x: walker.get(Transform2D).x + c.payload.x })
        }
      },
    }),
  ],
})

export async function createScene2D(): Promise<Sim> {
  const sim = await createSim({ seed: 2026, plugins: [physics2d(), scenePlugin] })
  sim.spawn([
    transform2d({ x: -3, y: 0.75 }),
    body2d(BodyKind.kinematicPosition),
    collider2d.capsule(0.45, 0.3),
  ])
  sim.spawn([transform2d({ y: -0.1 }), collider2d.cuboid(8, 0.1)])
  sim.spawn([transform2d({ x: 8.1, y: 1 }), collider2d.cuboid(0.1, 1)])
  sim.spawn([transform2d({ y: 1.5 }), collider2d.cuboid(1.5, 0.2, { sensor: true })])
  for (let i = 0; i < 24; i++)
    sim.spawn([
      transform2d({ x: (i % 6) - 2.5, y: 2 + Math.floor(i / 6) * 1.2, rotation: i * 0.1 }),
      body2d(BodyKind.dynamic, { linearDamping: 0.05 }),
      i % 3 === 0 ? collider2d.cuboid(0.3, 0.3) : collider2d.ball(0.35, { friction: 0.7, restitution: 0.4 }),
    ])
  return sim
}

/** The commands for tick `t`: a walk every tick for 120 ticks, drops every 25, and two despawns. */
export function sceneCommands2D(t: number): Command[] {
  const out: Command[] = []
  let seq = 0
  const add = (type: string, payload: unknown) => out.push({ tick: t, source: 0, seq: seq++, type, payload })
  if (t < 120) add('walk', { x: 0.04 })
  if (t % 25 === 10) add('drop', { x: ((t * 3) % 7) - 3 })
  if (t === 90) add('kill', { sid: 7 })
  if (t === 149) add('kill', { sid: 12 })
  return out
}
