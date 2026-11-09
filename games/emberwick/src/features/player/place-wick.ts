// Puts Wick in the room before the first step: the game's `sim.setup` and the demos' `createBaseSim` both call it.
import type { Sim } from '@automataframework/automata-sim'
import { Player, PlayerControl } from '../../shared/player.component.ts'
import type { Room } from '../../shared/room.ts'
import { HITBOX_H, SUB } from '../../shared/tuning.ts'

/** Spawns Wick at the room's start (P), standing on the tile below it: feet on that tile's top edge. */
export function placeWick(sim: Sim, room: Room): void {
  const x = room.start.tx * room.tileSize * SUB
  const y = ((room.start.ty + 1) * room.tileSize - HITBOX_H) * SUB
  sim.spawn([[Player, { x, y, facing: 1 }], PlayerControl])
}
