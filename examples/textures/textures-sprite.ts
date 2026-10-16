// textures-sprite: an animated sprite from a sprite sheet
//
// Shows: sprite() draws a texture by url, interpolated like rect(); `frames` slices a sheet into
//   equal frames and the component's `frame` field picks one each tick.
// Controls: none
// Packages: @mcthaydt/automata-game, @mcthaydt/automata-sim
// Difficulty: ★★☆☆
// Tier: core
// Golden: 120
// Pending: DX.2, DX.2b
import { defineGame, sprite } from '@mcthaydt/automata-game'
import { defineComponent, definePlugin, defineSystem } from '@mcthaydt/automata-sim'

// Two 16 × 16 frames of Wick running (resources/sprites/PROVENANCE.md).
const sheet = new URL('../resources/sprites/wick-run.png', import.meta.url).href

const Runner = defineComponent('runner', { x: 'f32', y: 'f32', frame: 'i32' })

// Run right one pixel a tick, wrap at the edge, and switch frames every 8 ticks.
const run = defineSystem('run', (ctx) => {
  for (const runner of ctx.query(Runner)) {
    const { x } = runner.get(Runner)
    runner.set(Runner, { x: x > 328 ? -8 : x + 1, frame: Math.floor(ctx.tick / 8) })
  }
})

const runners = definePlugin({ name: 'runners', defs: [Runner, run] })

export default defineGame({
  id: 'textures-sprite',
  size: { width: 320, height: 180 },
  sim: {
    plugins: [runners],
    seed: 1,
    setup: (sim) => {
      sim.spawn([[Runner, { x: 160, y: 90, frame: 0 }]])
    },
  },
  views: { [Runner.id]: sprite(sheet, { frames: { width: 16, height: 16 } }) },
})
