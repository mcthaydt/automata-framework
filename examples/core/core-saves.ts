// core-saves: three save slots on the title, and progress kept while you play
//
// Shows: `saves` gives the game slots: the title lists them, New game writes the starting data to a slot, Continue
//   loads one and `apply`s it, and the game keeps the slot saved as you walk (leaving play, going to the background,
//   and when the host closes the game). Paused says what the host did with your progress, and offers Load newer or
//   Keep playing if another device changed this slot. Standalone, there is nothing to sync and nothing is said.
// Controls: arrows or WASD to walk; Escape or P to pause
// Packages: @mcthaydt/automata, zod
// Difficulty: ★★★☆
// Tier: core
// Golden: 120
import {
  defineCommand,
  defineComponent,
  defineGame,
  definePlugin,
  defineSave,
  defineSystem,
  type GameSaves,
  keys,
  rect,
  type Sim,
} from '@mcthaydt/automata'
import { z } from 'zod'

const Walker = defineComponent('walker', { x: 'f32', y: 'f32' })
const step = z.number().int().min(-1).max(1).default(0)
const Move = defineCommand('move', z.object({ x: step, y: step }))

const move = defineSystem('move', (ctx) => {
  for (const { payload } of ctx.commands.of(Move))
    for (const walker of ctx.query(Walker)) {
      const { x, y } = walker.get(Walker)
      walker.set(Walker, { x: x + payload.x * 2, y: y + payload.y * 2 })
    }
})

const walking = definePlugin({ name: 'walking', defs: [Walker, Move, move] })

// What a slot holds is plain data, never the sim: where the walker stands. A change to its shape is a new `version`
// with a migration that turns the old data into the new.
const Progress = z.object({ x: z.number(), y: z.number() })
type Progress = z.infer<typeof Progress>
const START: Progress = { x: 160, y: 90 }

const saves: GameSaves<Progress> = {
  def: defineSave({
    key: 'walk',
    version: 1,
    schema: Progress,
    empty: () => START,
    migrations: {},
    slots: { count: 3 },
  }),
  // Read from the live sim whenever a trigger writes; apply puts a loaded slot back before tick 0.
  capture: (sim: Sim) => {
    const walker = sim.query(Walker)[0]
    return walker === undefined ? START : walker.get(Walker)
  },
  apply: (sim: Sim, data: Progress) => {
    sim.query(Walker)[0]?.set(Walker, data)
  },
  label: (slot: number) => `Walk ${slot + 1}`,
}

export default defineGame({
  id: 'core-saves',
  size: { width: 320, height: 180 },
  sim: {
    plugins: [walking],
    seed: 1,
    setup: (sim) => {
      sim.spawn([[Walker, START]])
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
  views: { [Walker.id]: rect({ w: 8, h: 8, color: 0xffc825 }) },
  saves,
})
