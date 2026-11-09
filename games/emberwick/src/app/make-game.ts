// Emberwick as one `defineGame` call: the base's sim, keys, own screens and flow, and its scene drawn
// through render-pixi's stage hooks. Built from a room and tuning handed in, so a demo with content of its own
// (examples/2d/content/hot-reload) plays the same game; `game.ts` makes the one the base ships.
import { defineGame, keys } from '@automata/framework'
import type { Sim } from '@automata/sim'
import { Move } from '../features/player/move.command.ts'
import { placeWick } from '../features/player/place-wick.ts'
import { sceneRenderer, type WickAt } from '../features/scene/scene-renderer.ts'
import { emberwickScreens } from '../features/screens/emberwick-screens.ts'
import { EMBERWICK_FLOW } from '../features/screens/flow.ts'
import { GAME_ID } from '../shared/game-id.ts'
import type { Room } from '../shared/room.ts'
import type { Tuning } from '../shared/tuning.ts'
import { emberwickPlugin } from './emberwick.plugin.ts'

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

/** What the sim plays in (`sim.content`): a checked room and the tunables. */
export type EmberwickContent = { readonly room: Room; readonly tuning: Tuning }

/** The page's record of where Wick is and how far the sim has run (the browser journeys read it). */
function showWick(at: WickAt): void {
  const root = document.getElementById('game')
  if (root === null) return
  root.dataset.playerX = String(at.x)
  root.dataset.playerY = String(at.y)
  root.dataset.tick = String(at.tick)
}

/** `id` is Ruken's game id, which the host checks against `[game] id` in ship.config.ts (default: `GAME_ID`). */
export function makeEmberwick(content: EmberwickContent, { id = GAME_ID }: { readonly id?: string } = {}) {
  const { room } = content
  const sim = { plugins: [emberwickPlugin], seed: 1, setup: (made: Sim) => placeWick(made, room) }
  return defineGame({
    id,
    title: 'Emberwick',
    size: { width: room.width * room.tileSize, height: room.height * room.tileSize },
    sim,
    input,
    content: { ...EMBERWICK_FLOW, sim: content },
    screens: emberwickScreens({ sim: { ...sim, content }, input }),
    // 'menu' lets the host's "Open game menu" reach the room (its `openMenu`).
    hosting: { wants: ['menu'] },
    renderer: sceneRenderer(room, showWick),
  })
}
