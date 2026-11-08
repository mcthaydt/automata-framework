// render-interpolation: A square that moves smoothly between the game's steps
//
// Shows: a view draws the blend of the last two ticks by the frame's alpha (0 is the previous tick, 1 the
//   current one), so motion stays smooth when display frames and sim ticks do not line up. The pink line is the
//   sim's own position, which only moves a whole tick at a time; the HUD prints the frame's alpha.
// Controls: I turns the blend on and off
// Packages: @automata/framework
// Difficulty: ★★☆☆
// Tier: core
import { defineComponent, defineGame, definePlugin, defineSystem, rect } from '@automata/framework'

const Runner = defineComponent('runner', { x: 'f32', y: 'f32', vx: 'f32' })

// 5 px a tick is a step the eye can see, so the blend's smoothing shows. The runner turns at either edge.
const run = defineSystem('run', (ctx) => {
  for (const runner of ctx.query(Runner)) {
    const { x, y, vx } = runner.get(Runner)
    const next = x + vx < 8 || x + vx > 312 ? -vx : vx
    runner.set(Runner, { x: x + next, y, vx: next })
  }
})

const track = definePlugin({ name: 'track', defs: [Runner, run] })

// Presentation only: whether the view blends between ticks. It never reaches the sim.
let blend = true
const square = rect({ w: 12, h: 12, color: 0xf9c22b })

// The view's own `update` gets the frame's alpha; asking for 1 shows the current tick as it is.
const blended: typeof square = (row, componentId) => {
  const view = square(row, componentId)
  if (view?.update === undefined) return view
  const place = view.update.bind(view)
  return { ...view, update: (curr, prev, alpha) => place(curr, prev, blend ? alpha : 1) }
}

export default defineGame({
  id: 'render-interpolation',
  size: { width: 320, height: 180 },
  sim: {
    plugins: [track],
    seed: 1,
    setup: (sim) => void sim.spawn([[Runner, { x: 8, y: 90, vx: 5 }]]),
  },
  views: { [Runner.id]: blended },
  renderer: {
    setup: (stage) => {
      const toggle = (event: KeyboardEvent): void => {
        // Pixi drops the renderer when the game is torn down; the listener then removes itself.
        if (!stage.app.renderer) window.removeEventListener('keydown', toggle)
        else if (event.code === 'KeyI') blend = !blend
      }
      window.addEventListener('keydown', toggle)
    },
  },
  draw: (ctx) => {
    for (const runner of ctx.sim.query(Runner)) {
      const { x, y } = runner.get(Runner)
      ctx.line(x, y - 14, x, y + 14, 0xff5d8f, 1)
    }
    const box = ctx.text(`blend ${blend ? 'on' : 'off'}   alpha ${ctx.frame.alpha.toFixed(2)}`, 8, 43, {
      color: 0xffffff,
      size: 8,
    })
    ctx.rect(4, 40, box.width + 8, box.height + 6, 0x2e222f)
  },
})
