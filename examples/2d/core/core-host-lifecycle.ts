// core-host-lifecycle: The game stops and pauses while its tab is in the background
//
// Shows: the game package handles the host's lifecycle for a game, so nothing here mentions the host. The page
//   draws nothing until the host says ready; when the host sends the game to the background (its drawer, an ad,
//   a hidden tab) the runtime stops the sim and opens the pause screen, and Resume plays on from the same tick.
//   The HUD counts the sim's ticks and says whether the frame is paused.
// Controls: none; switch to another tab (or open the host's drawer) and come back
// Packages: @mcthaydt/automata
// Difficulty: ★☆☆☆
// Tier: core
import { defineComponent, defineGame, definePlugin, defineSystem, rect } from '@mcthaydt/automata'

const Pacer = defineComponent('pacer', { x: 'f32', y: 'f32', vx: 'f32' })

// A square that paces the field, so a stopped sim is a frozen square as well as a frozen count.
const pace = defineSystem('pace', (ctx) => {
  for (const pacer of ctx.query(Pacer)) {
    const { x, y, vx } = pacer.get(Pacer)
    const next = x + vx < 8 || x + vx > 312 ? -vx : vx
    pacer.set(Pacer, { x: x + next, y, vx: next })
  }
})

const pacing = definePlugin({ name: 'pacing', defs: [Pacer, pace] })

export default defineGame({
  id: 'core-host-lifecycle',
  size: { width: 320, height: 180 },
  sim: {
    plugins: [pacing],
    seed: 1,
    setup: (sim) => void sim.spawn([[Pacer, { x: 8, y: 90, vx: 1.5 }]]),
  },
  views: { [Pacer.id]: rect({ w: 12, h: 12, color: 0x5ee6a8 }) },
  draw: (ctx) => {
    ctx.rect(4, 40, 150, 14, 0x2e222f)
    ctx.text(`tick ${ctx.sim.tick}   ${ctx.frame.paused ? 'paused' : 'running'}`, 8, 43, {
      color: 0xffffff,
      size: 8,
    })
  },
})
