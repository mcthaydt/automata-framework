// examples/physics/bodies-2d: Rapier rigid bodies in the 2D room, through the physics extension.
//
// Shows: @mcthaydt/automata-physics/2d inside base-2d's sim. The room's tiles are fixed bodies, an invisible
// kinematic box follows Wick, and crates and stones are dynamic bodies: Wick shoves them, they tumble down the
// ledges and pile up. Drop more and watch the collision events count up. Physics runs inside the sim
// (sim/bodies.plugin.ts), so the pile is the same on every engine (golden.parity.test.ts); this page only
// sends the drops and draws the bodies.
// Files: bodies-sim.ts makes the sim and places the bodies (walls from sim/room-colliders.ts); sim/ is what runs
// each step; layer.ts draws the bodies from the sim's RenderDelta with the 8 × 8 sprites in art/.
// Controls: arrows or A/D to move, Space, Z, W or Up to jump, B, X or C to drop a body above Wick; on-screen
// buttons on touch (▣ drops).
// Base: base-2d (`@af-examples/base-2d`: the room, Wick, input and the loop through `playRoom`).
// Packages: @mcthaydt/automata-physics (Rapier, deterministic build), @mcthaydt/automata-host, pixi.js, effect,
// and the base's own.
import '@af-examples/base-2d/no-eval'
import '@fontsource/pixelify-sans/latin-400.css'
import '@fontsource/pixelify-sans/latin-700.css'
import '@af-examples/base-2d/style.css'
import './bodies-panel.css'
import { ROOM } from '@af-examples/base-2d'
import { playRoom } from '@af-examples/base-2d/play'
import { textureFromPixels } from '@af-examples/base-2d/render'
import { makeHosting } from '@mcthaydt/automata-host'
import type { Command, Sim } from '@mcthaydt/automata-sim'
import { Effect } from 'effect'
import { CRATE, STONE } from './art/sprites.ts'
import { createBodiesSim } from './bodies-sim.ts'
import { bodiesLayer } from './layer.ts'
import { Drop } from './sim/bodies.plugin.ts'

/** Must equal `[game] id` in ship.config.ts; the host checks it. */
const GAME_ID = 'demo-physics-bodies-2d'

const found = document.querySelector<HTMLElement>('#game')
if (found === null) throw new Error('index.html has no #game element')
const root: HTMLElement = found

// Drops wait here until the next sim step sends them as commands (input never changes the sim directly).
let dropsWanted = 0
const DROP_KEYS = new Set(['KeyB', 'KeyX', 'KeyC'])
window.addEventListener('keydown', (event) => {
  if (DROP_KEYS.has(event.code) && !event.repeat) dropsWanted++
})

/**
 * At most one drop per step; any more wait for the next. The base's `move` takes `seq = tick` for player 0, so
 * a drop takes a number from the top half of the u32 range, where `move` will not reach for over a year of play.
 */
function dropCommands(sim: Sim): Command[] {
  if (dropsWanted === 0) return []
  dropsWanted--
  return [{ tick: sim.tick, source: 0, seq: 0x80000000 + sim.tick, type: Drop.id, payload: {} }]
}

const program = Effect.gen(function* () {
  const hosting = yield* makeHosting({ gameId: GAME_ID, wants: [], pauseBehavior: 'pause' })
  yield* hosting.ready
  // Nothing was drawn before this line: the page stays empty until the host says ready.
  let bumps = 0
  const counter = document.createElement('aside')
  counter.className = 'bodies-panel'
  const showBumps = () => {
    counter.textContent = `Collisions: ${bumps}`
    root.dataset.bumps = String(bumps)
  }
  const bodies = bodiesLayer(
    ROOM.rows.length * ROOM.tileSize,
    { crate: textureFromPixels(CRATE), stone: textureFromPixels(STONE) },
    (count) => {
      root.dataset.bodies = String(count)
    },
  )
  const play = yield* Effect.promise(() =>
    playRoom(root, {
      createSim: createBodiesSim,
      commands: dropCommands,
      onStep: (result) => {
        const started = result.events.filter((event) => event.type === 'physics2d.collision-started').length
        if (started > 0) {
          bumps += started
          showBumps()
        }
      },
      layers: [bodies],
    }),
  )
  // A touch button for drops, beside the base's move and jump buttons.
  const dropButton = document.createElement('button')
  dropButton.type = 'button'
  dropButton.className = 'drop'
  dropButton.textContent = '▣'
  dropButton.setAttribute('aria-label', 'Drop a body')
  dropButton.addEventListener('pointerdown', (event) => {
    event.preventDefault()
    dropsWanted++
  })
  root.querySelector('.touch .jump')?.before(dropButton)
  root.append(counter)
  showBumps()
  play.start()
  document.documentElement.dataset.state = 'ready'
  yield* Effect.never
})

Effect.runPromise(Effect.scoped(program)).catch((error: unknown) => {
  root.textContent = "Couldn't start the demo."
  document.documentElement.dataset.state = 'failed'
  console.error(error)
})
