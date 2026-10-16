// shapes-rects: rectangles that move, slide and spin
//
// Shows: rect() draws one view per component id, interpolated between ticks: position, an anchor,
//   and an angle that turns along the shorter arc.
// Controls: none
// Packages: @mcthaydt/automata-game, @mcthaydt/automata-sim
// Difficulty: ★☆☆☆
// Tier: core
// Golden: 120
// Pending: DX.2, DX.2b
import { defineGame, rect } from '@mcthaydt/automata-game'
import { defineComponent, definePlugin, defineSystem } from '@mcthaydt/automata-sim'

const Block = defineComponent('block', { x: 'f32', y: 'f32' })
const Bar = defineComponent('bar', { x: 'f32', y: 'f32' })
const Spinner = defineComponent('spinner', { x: 'f32', y: 'f32', angle: 'f32' })

// Blocks fall and wrap; the bar slides right and wraps; the spinner turns a little each tick.
const move = defineSystem('move', (ctx) => {
  for (const block of ctx.query(Block)) {
    const { y } = block.get(Block)
    block.set(Block, { y: y > 196 ? -16 : y + 1 })
  }
  for (const bar of ctx.query(Bar)) {
    const { x } = bar.get(Bar)
    bar.set(Bar, { x: x > 320 ? -64 : x + 2 })
  }
  for (const spinner of ctx.query(Spinner)) {
    const { angle } = spinner.get(Spinner)
    spinner.set(Spinner, { angle: angle + 0.05 })
  }
})

const shapes = definePlugin({ name: 'shapes', defs: [Block, Bar, Spinner, move] })

export default defineGame({
  id: 'shapes-rects',
  size: { width: 320, height: 180 },
  sim: {
    plugins: [shapes],
    seed: 1,
    setup: (sim) => {
      for (let column = 0; column < 4; column++) sim.spawn([[Block, { x: 40 + column * 32, y: column * 40 }]])
      sim.spawn([[Bar, { x: 0, y: 150 }]])
      sim.spawn([[Spinner, { x: 240, y: 70, angle: 0 }]])
    },
  },
  views: {
    [Block.id]: rect({ w: 16, h: 16, color: 0x00cdf9 }),
    // Anchored at its left edge, so x is where the bar starts.
    [Bar.id]: rect({ w: 64, h: 6, color: 0x5ac54f, anchor: { x: 0, y: 0.5 } }),
    [Spinner.id]: rect({ w: 48, h: 12, color: 0xf5555d }),
  },
})
