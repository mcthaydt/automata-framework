// core-leaderboard: a run's score goes to the host's leaderboard, and paused shows the board
//
// Shows: `scores` maps a sim event to a board and a score: the score comes from the event's payload, so it is computed
//   from sim state and never typed by anyone. The game asks the host for leaderboards; pause to see the board the
//   host holds, with your row marked. Offline or standalone, paused says so and shows no board kept here.
// Controls: Escape or P to pause and see the board
// Packages: @automataframework/automata, zod
// Difficulty: ★★☆☆
// Tier: core
// Golden: 240
import {
  defineComponent,
  defineEvent,
  defineGame,
  definePlugin,
  defineSystem,
  rect,
} from '@automataframework/automata'
import { z } from 'zod'

const Runner = defineComponent('runner', { x: 'f32', y: 'f32', laps: 'f32' })
const RunEnded = defineEvent('run-ended', z.object({ score: z.number().int() }))

// A run lasts 120 ticks (two seconds). The runner crosses the field and wraps; each wrap is a lap, and a run's score
// is the laps it made times 100, plus the distance into the current lap.
const run = defineSystem('run', (ctx) => {
  for (const runner of ctx.query(Runner)) {
    const { x, y, laps } = runner.get(Runner)
    const next = x + 7
    const wrapped = next >= 320
    const nextLaps = wrapped ? laps + 1 : laps
    runner.set(Runner, { x: wrapped ? next - 320 : next, y, laps: nextLaps })
    if (ctx.tick % 120 === 119) {
      ctx.emit(RunEnded, { score: Math.floor(nextLaps * 100 + next / 4) })
      runner.set(Runner, { x: 0, y, laps: 0 })
    }
  }
})

const running = definePlugin({ name: 'running', defs: [Runner, RunEnded, run] })

export default defineGame({
  id: 'core-leaderboard',
  size: { width: 320, height: 180 },
  sim: {
    plugins: [running],
    seed: 1,
    setup: (sim) => {
      sim.spawn([[Runner, { x: 0, y: 90, laps: 0 }]])
    },
  },
  views: { [Runner.id]: rect({ w: 16, h: 16, color: 0x5ac54f, anchor: { x: 0.5, y: 0.5 } }) },
  scores: { [RunEnded.id]: { board: 'best', score: (payload) => RunEnded.schema.parse(payload).score } },
})
