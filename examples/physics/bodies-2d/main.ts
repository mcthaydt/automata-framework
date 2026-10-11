// examples/physics/bodies-2d: Rapier rigid bodies in the 2D room, through the physics extension.
//
// Shows: @mcthaydt/automata-physics/2d inside base-2d's sim. The room's tiles are fixed bodies, an invisible
// kinematic box follows Wick, and crates and stones are dynamic bodies: Wick shoves them, they tumble down the
// ledges and pile up. Drop more and watch the collision events count up. Physics runs inside the sim
// (sim/bodies.plugin.ts), so the pile is the same on every engine; this page only sends the drops and draws
// the bodies.
// Controls: arrows or A/D to move, Space, Z, W or Up to jump, X or C to drop a body above Wick; on-screen
// buttons on touch (▣ drops).
// Base: base-2d (`@af-examples/base-2d`: the room, Wick, input and the loop through `playRoom`).
// Packages: @mcthaydt/automata-physics (Rapier, deterministic build), @mcthaydt/automata-host, pixi.js, effect,
// and the base's own.
import '@af-examples/base-2d/no-eval'
import '@fontsource/pixelify-sans/latin-400.css'
import '@fontsource/pixelify-sans/latin-700.css'
import '@af-examples/base-2d/style.css'
import './bodies-panel.css'
import { endesga, playRoom, ROOM } from '@af-examples/base-2d'
import { makeHosting } from '@mcthaydt/automata-host'
import { BodyKind, Collider2D, RigidBody2D, ShapeKind, Transform2D } from '@mcthaydt/automata-physics/2d'
import type { Command, Sim } from '@mcthaydt/automata-sim'
import { Effect } from 'effect'
import { type Container, Graphics } from 'pixi.js'
import { createBodiesSim, Drop, PX_PER_M } from './sim/bodies.plugin.ts'

/** Must equal `[game] id` in ship.config.ts; the host checks it. */
const GAME_ID = 'demo-physics-bodies-2d'

const found = document.querySelector<HTMLElement>('#game')
if (found === null) throw new Error('index.html has no #game element')
const root: HTMLElement = found

// Drops wait here until the next sim step sends them as commands (input never changes the sim directly).
let dropsWanted = 0
window.addEventListener('keydown', (event) => {
  if ((event.code === 'KeyX' || event.code === 'KeyC') && !event.repeat) dropsWanted++
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

/**
 * Draws every dynamic body from the sim's state, one Graphics per body, in room pixels (y flips). A crate is
 * a wooden box, a stone a glowing pebble, both in Endesga 64 and under the room's lighting.
 */
function createBodyViews(roomHeightPx: number) {
  const views = new Map<number, Graphics>()
  return (layer: Container, sim: Sim) => {
    const seen = new Set<number>()
    for (const body of sim.query(Transform2D, RigidBody2D, Collider2D)) {
      if (body.get(RigidBody2D).kind !== BodyKind.dynamic) continue
      seen.add(body.sid)
      let view = views.get(body.sid)
      if (view === undefined) {
        const collider = body.get(Collider2D)
        const half = collider.hx * PX_PER_M
        view =
          collider.shape === ShapeKind.ball
            ? new Graphics()
                .circle(0, 0, half)
                .fill(endesga(42))
                .stroke({ color: endesga(39), width: 1 })
            : new Graphics()
                .rect(-half, -half, half * 2, half * 2)
                .fill(endesga(20))
                .stroke({ color: endesga(18), width: 1 })
                .moveTo(-half, -half)
                .lineTo(half, half)
                .stroke({ color: endesga(19), width: 1 })
        views.set(body.sid, view)
        layer.addChild(view)
      }
      const at = body.get(Transform2D)
      view.position.set(at.x * PX_PER_M, roomHeightPx - at.y * PX_PER_M)
      // Rapier's angle is counter-clockwise with y up; on screen y points down, so it turns the other way.
      view.rotation = -at.rotation
    }
    for (const [sid, view] of views) {
      if (seen.has(sid)) continue
      view.destroy()
      views.delete(sid)
    }
    root.dataset.bodies = String(seen.size)
  }
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
  const drawBodies = createBodyViews(ROOM.rows.length * ROOM.tileSize)
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
      onDraw: drawBodies,
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
