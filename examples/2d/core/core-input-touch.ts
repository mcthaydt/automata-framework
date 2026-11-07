// core-input-touch: Steer a square by swiping, and flick down to drop it
//
// Shows: keys() gestures: a swipe holds a direction while the finger steers past a 12 px dead zone, a flick down
//   (40 px within 180 ms) lasts exactly one tick; with no touch buttons, the play screen takes touch as a swipe
//   surface. The arrows drive the same command.
// Controls: on a touch screen, swipe left or right and flick down; or the arrows to steer
// Packages: @automata/framework, zod
// Difficulty: ★★☆☆
// Tier: core
import {
  defineCommand,
  defineComponent,
  defineGame,
  definePlugin,
  defineSystem,
  keys,
  rect,
} from '@automata/framework'
import { z } from 'zod'

const Body = defineComponent('body', { x: 'f32', y: 'f32' })
const Steer = defineCommand(
  'steer',
  z.object({ x: z.number().int().min(-1).max(1).default(0), drop: z.boolean().default(false) }),
)

// A flick is one tick long, so `drop` moves the square one step down per flick.
const steer = defineSystem('steer', (ctx) => {
  for (const { payload } of ctx.commands.of(Steer))
    for (const body of ctx.query(Body)) {
      const { x, y } = body.get(Body)
      body.set(Body, { x: x + payload.x * 2, y: payload.drop ? (y + 20) % 180 : y })
    }
})

const square = definePlugin({ name: 'square', defs: [Body, Steer, steer] })

export default defineGame({
  id: 'core-input-touch',
  size: { width: 320, height: 180 },
  sim: {
    plugins: [square],
    seed: 1,
    setup: (sim) => {
      sim.spawn([[Body, { x: 160, y: 30 }]])
    },
  },
  input: keys(
    Steer,
    { ArrowLeft: { x: -1 }, ArrowRight: { x: 1 } },
    {
      touch: false,
      gestures: { 'swipe-left': { x: -1 }, 'swipe-right': { x: 1 }, 'flick-down': { drop: true } },
    },
  ),
  views: { [Body.id]: rect({ w: 8, h: 8, color: 0x0cf1ff }) },
})
