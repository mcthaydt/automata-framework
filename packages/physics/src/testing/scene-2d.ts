// The mixed 2D scene for the snapshot and parity tests (M2.1 spec §7), the 2D twin of scene-3d.ts.
import {
  type Command,
  createSim,
  defineCommand,
  definePlugin,
  defineSystem,
  type Sim,
  type SimContext,
} from '@mcthaydt/automata-sim'
import { z } from 'zod'
import {
  BodyKind,
  body2d,
  Collider2D,
  collider2d,
  physics2d,
  RigidBody2D,
  Transform2D,
  transform2d,
} from '../2d'

const Kill = defineCommand('kill', z.object({ sid: z.number().int() }))
const Drop = defineCommand('drop', z.object({ x: z.number() }))
const Walk = defineCommand('walk', z.object({ x: z.number() }))
const Edit = defineCommand('edit', z.object({ index: z.number().int() }))

/** The kinematic capsule is the first entity spawned. */
const WALKER_SID = 1

/**
 * Component edits a game makes between ticks, applied by index from the `edit` command (spec §7): each one
 * goes through a different sync-in path (collider rebuild, sensor toggle, velocity, kind, damping, removal
 * and re-adding of a collider, teleport, size and groups).
 */
const EDITS: ReadonlyArray<(ctx: SimContext) => void> = [
  (ctx) => ctx.entity(6)?.set(Collider2D, { friction: 0.1 }),
  (ctx) => ctx.entity(ZONE_SID)?.set(Collider2D, { sensor: false }),
  (ctx) => ctx.entity(8)?.set(RigidBody2D, { vx: 3 }),
  (ctx) => ctx.entity(9)?.set(RigidBody2D, { kind: BodyKind.fixed }),
  (ctx) => ctx.entity(ZONE_SID)?.set(Collider2D, { sensor: true }),
  (ctx) => ctx.entity(10)?.remove(Collider2D),
  (ctx) => ctx.entity(9)?.set(RigidBody2D, { kind: BodyKind.dynamic }),
  (ctx) => ctx.entity(11)?.set(Transform2D, { x: 1, y: 5 }),
  (ctx) => ctx.entity(13)?.set(RigidBody2D, { linearDamping: 2 }),
  (ctx) => ctx.entity(10)?.add(Collider2D, (collider2d.ball(0.35) as readonly [unknown, never])[1]),
  (ctx) => ctx.entity(15)?.set(Collider2D, { groups: 0x00010001 }),
  (ctx) => ctx.entity(14)?.set(Collider2D, { hx: 0.5 }),
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
            transform2d({ x: c.payload.x, y: 6, rotation: 0.3 }),
            body2d(BodyKind.dynamic),
            collider2d.cuboid(0.3, 0.2, { restitution: 0.3 }),
          )
        for (const c of ctx.commands.of(Edit)) (EDITS[c.payload.index] as (ctx: SimContext) => void)(ctx)
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
  // A tilted lone ramp: its angle reads back from Rapier differently from the authored 0.3 (spec §3.4).
  sim.spawn([transform2d({ x: -6, y: 0.5, rotation: 0.3 }), collider2d.cuboid(1.5, 0.1)])
  return sim
}

/** The commands for tick `t`: a walk every tick for 120 ticks, drops every 25, two despawns and the edits. */
export function sceneCommands2D(t: number): Command[] {
  const out: Command[] = []
  let seq = 0
  const add = (type: string, payload: unknown) => out.push({ tick: t, source: 0, seq: seq++, type, payload })
  if (t < 120) add('walk', { x: 0.04 })
  if (t % 25 === 10) add('drop', { x: ((t * 3) % 7) - 3 })
  if (t === 90) add('kill', { sid: 7 })
  if (t === 149) add('kill', { sid: 12 })
  const edit = EDIT_TICKS.indexOf(t)
  if (edit >= 0) add('edit', { index: edit })
  return out
}
