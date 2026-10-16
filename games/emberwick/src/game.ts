// Emberwick as one `defineGame` call (DX.3): the base's sim, the keys that drive it, its own screens over its
// own flow, and its scene drawn through render-pixi's stage hooks. `main.ts` passes it to `startGame`.
import { defineGame, keys } from '@mcthaydt/automata-game'
import type { Sim } from '@mcthaydt/automata-sim'
import { parseRoom, ROOM } from './content/room.ts'
import { EMBERWICK_FLOW } from './flow.ts'
import { sceneRenderer, type WickAt } from './render/scene-renderer.ts'
import { emberwickScreens } from './screens/emberwick-screens.ts'
import { base2dPlugin, Move } from './sim/index.ts'
import { placeWick } from './sim/place-wick.ts'

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

const sim = { plugins: [base2dPlugin], seed: 1, setup: (made: Sim) => placeWick(made, room) }

/** The page's record of where Wick is and how far the sim has run (the browser journeys read it). */
function showWick(at: WickAt): void {
  const root = document.getElementById('game')
  if (root === null) return
  root.dataset.playerX = String(at.x)
  root.dataset.playerY = String(at.y)
  root.dataset.tick = String(at.tick)
}

export const emberwick = defineGame({
  id: 'base-2d',
  title: 'Emberwick',
  size: { width: room.width * room.tileSize, height: room.height * room.tileSize },
  sim,
  input,
  // The flow for the runtime; the room is the sim's content (`sim.content.room`).
  content: { ...EMBERWICK_FLOW, sim: { room } },
  screens: emberwickScreens({ sim: { ...sim, content: { room } }, input }),
  // 'menu' lets the host's "Open game menu" reach the room (its `openMenu`).
  hosting: { wants: ['menu'] },
  renderer: sceneRenderer(room, showWick),
})
