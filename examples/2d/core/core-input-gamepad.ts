// core-input-gamepad: Move a square with a controller
//
// Shows: keys() binds a standard pad's left stick and D-pad to the same sim command as the arrow keys; the stick
//   reads through a radial deadzone, eight ways; unplugging the pad in use pauses with "Reconnect your controller".
// Controls: the left stick or the D-pad (any standard-mapping controller), or the arrow keys
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

// The sim sees the same command whichever device sent it, so a replay never needs to know.
const move = defineSystem('move', (ctx) => {
  for (const { payload } of ctx.commands.of(Move))
    for (const body of ctx.query(Body)) {
      const { x, y } = body.get(Body)
      body.set(Body, { x: x + payload.x * 2, y: y + payload.y * 2 })
    }
})

const square = definePlugin({ name: 'square', defs: [Body, Move, move] })

export default defineGame({
  id: 'core-input-gamepad',
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
    { ArrowLeft: { x: -1 }, ArrowRight: { x: 1 }, ArrowUp: { y: -1 }, ArrowDown: { y: 1 } },
    {
      pad: { 14: { x: -1 }, 15: { x: 1 }, 12: { y: -1 }, 13: { y: 1 } },
      stick: { 'left-left': { x: -1 }, 'left-right': { x: 1 }, 'left-up': { y: -1 }, 'left-down': { y: 1 } },
    },
  ),
  views: { [Body.id]: rect({ w: 8, h: 8, color: 0x4fc3f7 }) },
})
