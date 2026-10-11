// Makes the demo's sim: base-2d's sim with the physics extension and the demo's plugin, and the room's bodies.
import {
  base2dPlugin,
  createBaseSim,
  Player,
  parseRoom,
  ROOM,
  type RoomSource,
  tuning,
} from '@af-examples/base-2d'
import { BodyKind, body2d, collider2d, physics2d, transform2d } from '@mcthaydt/automata-physics/2d'
import type { PluginDef, Sim } from '@mcthaydt/automata-sim'
import { bodiesPlugin, crate, Follower, GRAVITY, PX_PER_M, stone, wickCentre } from './sim/bodies.plugin.ts'
import { roomColliders } from './sim/room-colliders.ts'

/**
 * Adds the bodies to a fresh base sim: the room's tiles as fixed bodies, the box that follows Wick, and the
 * starting crates and stones. Pass it to `playRoom` as `createSim`. This is setup, run once before the first
 * step, so it lives outside the sim folder; everything that runs each step is in sim/bodies.plugin.ts.
 */
export async function createBodiesSim(source: RoomSource): Promise<Sim> {
  const room = parseRoom(source)
  const heightPx = room.height * room.tileSize
  const sim = await createBaseSim({ room: source, plugins: demoPlugins(room) })
  for (const wall of roomColliders(room))
    sim.spawn([transform2d({ x: wall.x, y: wall.y }), collider2d.cuboid(wall.hx, wall.hy)])
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

/** The plugins the demo adds to base-2d's. */
function demoPlugins(room: ReturnType<typeof parseRoom>): PluginDef[] {
  return [physics2d({ gravity: { x: 0, y: GRAVITY } }), bodiesPlugin(room)]
}

/**
 * What a replay of the demo's sim needs to rebuild it: every plugin in createBaseSim's order and the same
 * content, so the schema and content hashes match the recording, and `create` to record one.
 */
export function bodiesSimSetup(source: RoomSource = ROOM) {
  const room = parseRoom(source)
  return {
    plugins: [base2dPlugin, ...demoPlugins(room)],
    content: { room },
    create: () => createBodiesSim(source),
  }
}
