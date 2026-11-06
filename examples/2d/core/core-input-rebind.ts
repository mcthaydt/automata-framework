// core-input-rebind: rebind a control in Settings, and keep it next time
//
// Shows: keys() names each action with labels, so the default Settings screen (pause, then the gear) lists them;
//   rebinding one saves it through the host and play reads it at once; a key taken from another action leaves
//   that one "Not set"; Escape cancels a capture. A reload keeps the player's keys.
// Controls: the arrows move, Space jumps, F fires; Escape or P to pause, then the gear for Settings
// Packages: @mcthaydt/automata, zod
// Difficulty: ★★☆☆
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
} from '@mcthaydt/automata'
import { z } from 'zod'

const Runner = defineComponent('runner', { x: 'f32', y: 'f32', flash: 'f32' })
const step = z.number().int().min(-1).max(1).default(0)
const Act = defineCommand(
  'act',
  z.object({ x: step, jump: z.boolean().default(false), fire: z.boolean().default(false) }),
)

// Held, never pressed: the sim sees the same command whichever key the player bound to it.
const act = defineSystem('act', (ctx) => {
  for (const { payload } of ctx.commands.of(Act))
    for (const runner of ctx.query(Runner)) {
      const { x, y, flash } = runner.get(Runner)
      runner.set(Runner, {
        x: x + payload.x * 2,
        y: payload.jump ? Math.max(30, y - 3) : Math.min(140, y + 3),
        flash: payload.fire ? 1 : Math.max(0, flash - 0.125),
      })
    }
})

const runners = definePlugin({ name: 'runners', defs: [Runner, Act, act] })

export default defineGame({
  id: 'core-input-rebind',
  size: { width: 320, height: 180 },
  sim: {
    plugins: [runners],
    seed: 1,
    setup: (sim) => {
      sim.spawn([[Runner, { x: 160, y: 140, flash: 0 }]])
    },
  },
  input: keys(
    Act,
    { ArrowLeft: { x: -1 }, ArrowRight: { x: 1 }, Space: { jump: true }, KeyF: { fire: true } },
    {
      pad: { 14: { x: -1 }, 15: { x: 1 }, 0: { jump: true }, 2: { fire: true } },
      labels: { ArrowLeft: 'Move left', ArrowRight: 'Move right', Space: 'Jump', KeyF: 'Fire' },
    },
  ),
  views: { [Runner.id]: rect({ w: 10, h: 10, color: 0x5ac54f, anchor: { x: 0.5, y: 0.5 } }) },
})
