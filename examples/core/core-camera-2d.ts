// core-camera-2d: a camera that follows a square around a world bigger than the screen
//
// Shows: createCamera2d() follows a target with a dead zone, stays inside the world's bounds and shakes on a bump;
//   it moves the world container only, so the sim's positions are untouched.
// Controls: arrows or WASD
// Packages: @mcthaydt/automata-game, @mcthaydt/automata-sim, zod
// Difficulty: ★★☆☆
// Tier: core
import { createCamera2d, defineGame, keys, rect } from '@mcthaydt/automata-game'
import { defineCommand, defineComponent, definePlugin, defineSystem } from '@mcthaydt/automata-sim'
import { z } from 'zod'

const VIEW = { width: 320, height: 180 }
const WORLD = { x: 0, y: 0, width: 960, height: 540 }
const HALF = 4

const Body = defineComponent('body', { x: 'f32', y: 'f32' })
const Marker = defineComponent('marker', { x: 'f32', y: 'f32' })
const step = z.number().int().min(-1).max(1).default(0)
const Move = defineCommand('move', z.object({ x: step, y: step }))

// The sim keeps the square inside the world; the camera only decides which part of the world is on screen.
const move = defineSystem('move', (ctx) => {
  for (const { payload } of ctx.commands.of(Move))
    for (const body of ctx.query(Body)) {
      const { x, y } = body.get(Body)
      body.set(Body, {
        x: Math.min(Math.max(x + payload.x * 3, HALF), WORLD.width - HALF),
        y: Math.min(Math.max(y + payload.y * 3, HALF), WORLD.height - HALF),
      })
    }
})

const world = definePlugin({ name: 'world', defs: [Body, Marker, Move, move] })

// The camera follows what is drawn, so it reads the square's interpolated view rather than the sim.
let squareView: { readonly position: { readonly x: number; readonly y: number } } | undefined
const drawSquare = rect({ w: HALF * 2, h: HALF * 2, color: 0xffc825 })
const trackSquare: typeof drawSquare = (row, componentId) => {
  const view = drawSquare(row, componentId)
  squareView = view?.container
  return view
}

const atEdge = (x: number, y: number): boolean =>
  x <= HALF || y <= HALF || x >= WORLD.width - HALF || y >= WORLD.height - HALF

export default defineGame({
  id: 'core-camera-2d',
  size: VIEW,
  sim: {
    plugins: [world],
    seed: 1,
    setup: (sim) => {
      // A grid of floor markers, so the camera's movement shows.
      for (let x = 40; x < WORLD.width; x += 80)
        for (let y = 45; y < WORLD.height; y += 90) sim.spawn([[Marker, { x, y }]])
      sim.spawn([[Body, { x: 480, y: 270 }]])
    },
  },
  input: keys(Move, {
    ArrowLeft: { x: -1 },
    KeyA: { x: -1 },
    ArrowRight: { x: 1 },
    KeyD: { x: 1 },
    ArrowUp: { y: -1 },
    KeyW: { y: -1 },
    ArrowDown: { y: 1 },
    KeyS: { y: 1 },
  }),
  views: { [Marker.id]: rect({ w: 6, h: 6, color: 0x3e3546 }), [Body.id]: trackSquare },
  renderer: {
    setup: (stage) => {
      const camera = createCamera2d(stage.world, {
        view: VIEW,
        follow: { rate: 8, deadZone: { width: 64, height: 36 } },
        bounds: WORLD,
      })
      let wasAtEdge = false
      return {
        draw: (frame) => {
          if (squareView === undefined) return
          const { x, y } = squareView.position
          // A small bump each time the square reaches the world's edge.
          if (atEdge(x, y) && !wasAtEdge) camera.shake(0.6)
          wasAtEdge = atEdge(x, y)
          camera.target(x, y)
          camera.update(frame.frameMs / 1000)
        },
      }
    },
  },
})
