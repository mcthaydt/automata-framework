// Emberwick as one `defineGame` call (DX.3): the base's sim, the keys that drive it, its own screens over its
// own flow, and its scene drawn through render-pixi's stage hooks. `main.ts` passes it to `startGame`.
import { defineGame, keys } from '@mcthaydt/automata-game'
import { placeWick } from './base-sim.ts'
import { parseRoom, ROOM } from './content/room.ts'
import { EMBERWICK_FLOW } from './flow.ts'
import { base2dPlugin, Move } from './sim/index.ts'

const room = parseRoom(ROOM)

/** By `KeyboardEvent.code`; nothing held is "stand still" (`idle`), sent every tick as the sim expects. */
export const input = keys(
  Move,
  {
    ArrowLeft: { x: -1 },
    KeyA: { x: -1 },
    ArrowRight: { x: 1 },
    KeyD: { x: 1 },
    Space: { jump: true },
    KeyZ: { jump: true },
    KeyW: { jump: true },
    ArrowUp: { jump: true },
  },
  { idle: { x: 0, jump: false } },
)

export const emberwick = defineGame({
  id: 'base-2d',
  title: 'Emberwick',
  size: { width: room.width * room.tileSize, height: room.height * room.tileSize },
  sim: { plugins: [base2dPlugin], seed: 1, setup: (sim) => placeWick(sim, room) },
  input,
  // The flow for the runtime; the room is the sim's content (`sim.content.room`).
  content: { ...EMBERWICK_FLOW, sim: { room } },
})
