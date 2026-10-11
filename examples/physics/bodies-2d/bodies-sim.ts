// Makes the demo's sim: base-2d's sim with the physics extension and the demo's plugin, and the room's bodies.
import { createBaseSim, Player, parseRoom, type RoomSource, tuning } from '@af-examples/base-2d'
import { BodyKind, body2d, collider2d, physics2d, transform2d } from '@mcthaydt/automata-physics/2d'
import type { Sim } from '@mcthaydt/automata-sim'
import {
  bodiesPlugin,
  crate,
  Follower,
  GRAVITY,
  metresX,
  metresY,
  PX_PER_M,
  stone,
  wickCentre,
} from './sim/bodies.plugin.ts'

/**
 * Adds the bodies to a fresh base sim: the room's tiles as fixed bodies, the box that follows Wick, and the
 * starting crates and stones. Pass it to `playRoom` as `createSim`. This is setup, run once before the first
 * step, so it lives outside the sim folder; everything that runs each step is in sim/bodies.plugin.ts.
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
