// core-input-keys: Move a square with the keyboard, a controller or touch
//
// Shows: keys() turns what is held on the keyboard, a standard pad's D-pad or the touch buttons into one sim
//   command per tick, the same command from each device; rect() draws an entity, interpolated.
// Controls: arrows or WASD, the D-pad, or the touch buttons
// Packages: @automata/framework, zod
// Difficulty: ★☆☆☆
// Tier: core
// Golden: 120
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
const step = z.number().int().min(-1).max(1).default(0)
const Move = defineCommand('move', z.object({ x: step, y: step }))

// The sim only sees commands: the same commands replay to the same positions.
const move = defineSystem('move', (ctx) => {
  for (const { payload } of ctx.commands.of(Move))
    for (const body of ctx.query(Body)) {
      const { x, y } = body.get(Body)
      body.set(Body, { x: x + payload.x * 2, y: y + payload.y * 2 })
    }
})

const square = definePlugin({ name: 'square', defs: [Body, Move, move] })

export default defineGame({
  id: 'core-input-keys',
  size: { width: 320, height: 180 },
  sim: {
    plugins: [square],
    seed: 1,
    setup: (sim) => {
      sim.spawn([[Body, { x: 160, y: 90 }]])
    },
  },
  input: keys(
    Move,
    {
      ArrowLeft: { x: -1 },
      KeyA: { x: -1 },
      ArrowRight: { x: 1 },
      KeyD: { x: 1 },
      ArrowUp: { y: -1 },
      KeyW: { y: -1 },
      ArrowDown: { y: 1 },
      KeyS: { y: 1 },
    },
    { pad: { 14: { x: -1 }, 15: { x: 1 }, 12: { y: -1 }, 13: { y: 1 } } },
  ),
  views: { [Body.id]: rect({ w: 8, h: 8, color: 0xffcf05 }) },
})
