// The demo's sim half: Rapier bodies in base-2d's room, through @mcthaydt/automata-physics/2d.
//
// Three kinds of body:
// - fixed: the room's solid tiles, one cuboid per run of `#` in a row (fewer bodies than one per tile);
// - kinematic: an invisible box that follows Wick, so Wick shoves bodies around (Wick still moves by the
//   base's own tile collision; physics never moves Wick);
// - dynamic: crates and stones, a few to start and one more per `drop` command.
//
// Units: physics works in metres with y up; the room is in pixels with y down. 16 pixels are a metre, so a tile
// is half a metre and the room 20 × 12 m. Everything here runs inside the sim: no I/O, no clock, no
// randomness, so the same drops give the same pile in every browser.
import { createBaseSim, Player, type RoomSource, tuning } from '@af-examples/base-2d'
import { parseRoom } from '@af-examples/base-2d/room'
import {
  BodyKind,
  body2d,
  collider2d,
  physics2d,
  RigidBody2D,
  Transform2D,
  transform2d,
} from '@mcthaydt/automata-physics/2d'
import {
  defineCommand,
  defineComponent,
  definePlugin,
  defineSystem,
  type PluginDef,
  type Sim,
  type SpawnPart,
} from '@mcthaydt/automata-sim'
import { z } from 'zod'

export const PX_PER_M = 16
/** Stronger than Earth's 9.81, so 8-pixel crates fall as briskly as Wick does. */
const GRAVITY = -40
/** Past this many loose bodies, the oldest is removed to make room for a new drop. */
export const MAX_LOOSE = 40

/** Marks the kinematic box that follows Wick; `player` is the player slot it follows (always 0 here). */
export const Follower = defineComponent('bodies.follower', { player: 'u32' })

/** Drop a body just above Wick: a crate on even ticks, a stone on odd ones. */
export const Drop = defineCommand('bodies.drop', z.object({}))

/** Room pixels to metres, for a point (y flips). */
const metresX = (px: number) => px / PX_PER_M
const metresY = (py: number, roomHeightPx: number) => (roomHeightPx - py) / PX_PER_M

const crate = (x: number, y: number): SpawnPart[] => [
  transform2d({ x, y }),
  body2d(BodyKind.dynamic, { angularDamping: 0.5 }),
  collider2d.cuboid(0.25, 0.25, { friction: 0.8 }),
]
const stone = (x: number, y: number): SpawnPart[] => [
  transform2d({ x, y }),
  body2d(BodyKind.dynamic, { angularDamping: 0.2 }),
  collider2d.ball(0.22, { friction: 0.6, restitution: 0.45 }),
]

/** Where Wick's hitbox centre is, in metres. */
function wickCentre(player: { x: number; y: number }, roomHeightPx: number) {
  const px = player.x / tuning.SUB + tuning.HITBOX_W / 2
  const py = player.y / tuning.SUB + tuning.HITBOX_H / 2
  return { x: metresX(px), y: metresY(py, roomHeightPx) }
}

function bodiesPlugin(roomHeightPx: number): PluginDef {
  return definePlugin({
    name: 'bodies-2d-demo',
    commands: [Drop],
    systems: [
      defineSystem({
        name: 'bodies.drop',
        phase: 'input',
        run(ctx) {
          const [wick] = ctx.query(Player)
          if (wick === undefined) return
          for (const _ of ctx.commands.of(Drop)) {
            const loose = ctx
              .query(RigidBody2D)
              .filter((body) => body.get(RigidBody2D).kind === BodyKind.dynamic)
            // Bodies come back in ascending id order, so the first is the oldest.
            const oldest = loose[0]
            if (loose.length >= MAX_LOOSE && oldest !== undefined) ctx.despawn(oldest.sid)
            const at = wickCentre(wick.get(Player), roomHeightPx)
            const parts = ctx.tick % 2 === 0 ? crate(at.x, at.y + 1.25) : stone(at.x, at.y + 1.25)
            ctx.spawn(...parts)
          }
        },
      }),
      defineSystem({
        // After the base has moved Wick this tick; the physics step picks the new position up next tick.
        name: 'bodies.follow-wick',
        phase: 'postPhysics',
        run(ctx) {
          const [wick] = ctx.query(Player)
          const [follower] = ctx.query(Transform2D, Follower)
          if (wick === undefined || follower === undefined) return
          follower.set(Transform2D, wickCentre(wick.get(Player), roomHeightPx))
        },
      }),
    ],
    components: [Follower],
  })
}

/**
 * Adds the bodies to a fresh base sim: the room's tiles as fixed bodies, the box that follows Wick, and the
 * starting crates and stones. Pass it to `playRoom` as `createSim`.
 */
export async function createBodiesSim(source: RoomSource): Promise<Sim> {
  const room = parseRoom(source)
  const heightPx = room.height * room.tileSize
  const sim = await createBaseSim({
    room: source,
    plugins: [physics2d({ gravity: { x: 0, y: GRAVITY } }), bodiesPlugin(heightPx)],
  })
  const half = room.tileSize / 2 / PX_PER_M
  room.rows.forEach((row, ty) => {
    for (const run of row.matchAll(/#+/g)) {
      const startPx = (run.index ?? 0) * room.tileSize
      const widthPx = run[0].length * room.tileSize
      sim.spawn([
        transform2d({
          x: metresX(startPx + widthPx / 2),
          y: metresY(ty * room.tileSize + room.tileSize / 2, heightPx),
        }),
        collider2d.cuboid(metresX(widthPx / 2), half),
      ])
    }
  })
  const [wick] = sim.query(Player)
  if (wick !== undefined)
    sim.spawn([
      transform2d(wickCentre(wick.get(Player), heightPx)),
      body2d(BodyKind.kinematicPosition),
      collider2d.cuboid(tuning.HITBOX_W / 2 / PX_PER_M, tuning.HITBOX_H / 2 / PX_PER_M),
      Follower,
    ])
  // A stack of crates on the floor right of the start, and stones on the first ledges.
  for (let i = 0; i < 4; i++) sim.spawn(crate(6.5, 0.8 + i * 0.5))
  for (const x of [2.2, 3, 3.8]) sim.spawn(stone(x, 6))
  return sim
}
