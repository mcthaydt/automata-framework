// The mixed 3D scene used by the snapshot and parity tests (M2.1 spec §7): balls, cuboids, a kinematic
// capsule driven by a command, a sensor zone, lone colliders, and spawns and despawns mid-run, including a
// despawn on the tick before the restore point so the snapshot carries a dead-sid row.
import {
  type Command,
  createSim,
  defineCommand,
  definePlugin,
  defineSystem,
  type Sim,
} from '@mcthaydt/automata-sim'
import { z } from 'zod'
import { BodyKind, body3d, collider3d, physics3d, Transform3D, transform3d } from '../3d'

const Kill = defineCommand('kill', z.object({ sid: z.number().int() }))
const Drop = defineCommand('drop', z.object({ x: z.number(), z: z.number() }))
const Walk = defineCommand('walk', z.object({ x: z.number() }))

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
            transform3d({ x: c.payload.x, y: 6, z: c.payload.z }),
            body3d(BodyKind.dynamic),
            collider3d.cuboid(0.3, 0.2, 0.4, { restitution: 0.3 }),
          )
        for (const c of ctx.commands.of(Walk)) {
          const walker = ctx.entity(WALKER_SID)
          if (walker) walker.set(Transform3D, { x: walker.get(Transform3D).x + c.payload.x })
        }
      },
    }),
  ],
})

/** The kinematic capsule is the first entity spawned. */
const WALKER_SID = 1

export async function createScene3D(): Promise<Sim> {
  const sim = await createSim({ seed: 2026, plugins: [physics3d(), scenePlugin] })
  sim.spawn([
    transform3d({ x: -3, y: 0.75 }),
    body3d(BodyKind.kinematicPosition),
    collider3d.capsule(0.45, 0.3),
  ])
  sim.spawn([transform3d({ y: -0.1 }), collider3d.cuboid(8, 0.1, 8)])
  sim.spawn([transform3d({ x: 8.1, y: 1 }), collider3d.cuboid(0.1, 1, 8)])
  sim.spawn([transform3d({ y: 1.5 }), collider3d.cuboid(1.5, 0.2, 1.5, { sensor: true })])
  for (let i = 0; i < 24; i++)
    sim.spawn([
      transform3d({
        x: (i % 6) - 2.5,
        y: 2 + Math.floor(i / 6) * 1.2,
        z: ((i * 7) % 5) - 2,
        qx: 0,
        qy: 0.6,
        qz: 0,
        qw: 0.8,
      }),
      body3d(BodyKind.dynamic, { linearDamping: 0.05 }),
      i % 3 === 0
        ? collider3d.cuboid(0.3, 0.3, 0.3)
        : collider3d.ball(0.35, { friction: 0.7, restitution: 0.4 }),
    ])
  return sim
}

/** The commands for tick `t`: a walk every tick for 120 ticks, drops every 25, and two despawns. */
export function sceneCommands(t: number): Command[] {
  const out: Command[] = []
  let seq = 0
  const add = (type: string, payload: unknown) => out.push({ tick: t, source: 0, seq: seq++, type, payload })
  if (t < 120) add('walk', { x: 0.04 })
  if (t % 25 === 10) add('drop', { x: ((t * 3) % 7) - 3, z: ((t * 5) % 7) - 3 })
  if (t === 90) add('kill', { sid: 7 })
  if (t === 149) add('kill', { sid: 12 })
  return out
}
