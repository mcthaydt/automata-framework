// The mixed 3D scene used by the snapshot and parity tests: balls, cuboids, a kinematic
// capsule driven by a command, a sensor zone, lone colliders, and spawns and despawns mid-run, including a
// despawn on the tick before the restore point so the snapshot carries a dead-sid row.
import {
  type Command,
  createSim,
  defineCommand,
  definePlugin,
  defineSystem,
  type PluginDef,
  type Sim,
  type SimContext,
} from '@automata/sim'
import { z } from 'zod'
import {
  BodyKind,
  body3d,
  Collider3D,
  collider3d,
  physics3d,
  RigidBody3D,
  Transform3D,
  transform3d,
} from '../entries/3d'

const Kill = defineCommand('kill', z.object({ sid: z.number().int() }))
const Drop = defineCommand('drop', z.object({ x: z.number(), z: z.number() }))
const Walk = defineCommand('walk', z.object({ x: z.number() }))
const Edit = defineCommand('edit', z.object({ index: z.number().int() }))

/**
 * Component edits a game makes between ticks, applied by index from the `edit` command: each one
 * goes through a different sync-in path (collider rebuild, sensor toggle, velocity, kind, damping, removal
 * and re-adding of a collider, teleport, size and groups).
 */
const EDITS: ReadonlyArray<(ctx: SimContext) => void> = [
  (ctx) => ctx.entity(6)?.set(Collider3D, { friction: 0.1 }),
  (ctx) => ctx.entity(ZONE_SID)?.set(Collider3D, { sensor: false }),
  (ctx) => ctx.entity(8)?.set(RigidBody3D, { vx: 3 }),
  (ctx) => ctx.entity(9)?.set(RigidBody3D, { kind: BodyKind.fixed }),
  (ctx) => ctx.entity(ZONE_SID)?.set(Collider3D, { sensor: true }),
  (ctx) => ctx.entity(10)?.remove(Collider3D),
  (ctx) => ctx.entity(9)?.set(RigidBody3D, { kind: BodyKind.dynamic }),
  (ctx) => ctx.entity(11)?.set(Transform3D, { x: 1, y: 5, z: 0 }),
  (ctx) => ctx.entity(13)?.set(RigidBody3D, { linearDamping: 2 }),
  (ctx) => ctx.entity(10)?.add(Collider3D, (collider3d.ball(0.35) as readonly [unknown, never])[1]),
  (ctx) => ctx.entity(15)?.set(Collider3D, { groups: 0x00010001 }),
  (ctx) => ctx.entity(14)?.set(Collider3D, { hx: 0.5 }),
]
/** The tick each edit runs at, in EDITS order; some fall either side of the restore at tick 150. */
const EDIT_TICKS: readonly number[] = [60, 70, 80, 95, 100, 110, 130, 140, 145, 155, 170, 200]
const ZONE_SID = 4

const scenePlugin = definePlugin({
  name: 'scene',
  commands: [Kill, Drop, Walk, Edit],
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
        for (const c of ctx.commands.of(Edit)) (EDITS[c.payload.index] as (ctx: SimContext) => void)(ctx)
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
  const sim = await createSim({ seed: 2026, plugins: scenePlugins3D() })
  spawnScene3D(sim)
  return sim
}

/** The scene's plugins, for callers that create the sim themselves (the snapshot property test). */
export function scenePlugins3D(): PluginDef[] {
  return [physics3d(), scenePlugin]
}

/** The scene's walker, floor, walls, sensor, two dozen bodies and ramp. */
export function spawnScene3D(sim: Sim): void {
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
  // A tilted lone ramp, whose rotation Rapier stores normalized.
  sim.spawn([transform3d({ x: -6, y: 0.5, qz: 0.2588, qw: 0.9659 }), collider3d.cuboid(1.5, 0.1, 1.5)])
}

/** The commands for tick `t`: a walk every tick for 120 ticks, drops every 25, two despawns and the edits. */
export function sceneCommands(t: number): Command[] {
  const out: Command[] = []
  let seq = 0
  const add = (type: string, payload: unknown) => out.push({ tick: t, source: 0, seq: seq++, type, payload })
  if (t < 120) add('walk', { x: 0.04 })
  if (t % 25 === 10) add('drop', { x: ((t * 3) % 7) - 3, z: ((t * 5) % 7) - 3 })
  if (t === 90) add('kill', { sid: 7 })
  if (t === 149) add('kill', { sid: 12 })
  const edit = EDIT_TICKS.indexOf(t)
  if (edit >= 0) add('edit', { index: edit })
  return out
}
