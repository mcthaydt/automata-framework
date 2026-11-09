// shapes-draw-hud: A score line and a mini-map drawn over bouncing squares
//
// Shows: draw(ctx) paints rects, lines, circles and text over the entity views once a frame. It reads the
//   sim through ctx.sim and never writes it, so the golden is the same with or without it.
// Controls: none
// Packages: @automata/framework
// Difficulty: ★☆☆☆
// Tier: core
// Golden: 120
import { defineComponent, defineGame, definePlugin, defineSystem, rect } from '@automata/framework'

const Ball = defineComponent('ball', { x: 'f32', y: 'f32', vx: 'f32', vy: 'f32' })

// Each square moves by its velocity and turns back at the playfield's edges.
const bounce = defineSystem('bounce', (ctx) => {
  for (const ball of ctx.query(Ball)) {
    const { x, y, vx, vy } = ball.get(Ball)
    const nextVx = x + vx < 4 || x + vx > 316 ? -vx : vx
    const nextVy = y + vy < 20 || y + vy > 176 ? -vy : vy
    ball.set(Ball, { x: x + nextVx, y: y + nextVy, vx: nextVx, vy: nextVy })
  }
})

const balls = definePlugin({ name: 'balls', defs: [Ball, bounce] })

// The mini-map: the whole playfield scaled into a box at the bottom left of the band a wide phone shows (about
// y = 35 to y = 145 of the 180-high field), clear of the Pause button.
const MAP = { x: 8, y: 104, w: 64, h: 36 }

export default defineGame({
  id: 'shapes-draw-hud',
  size: { width: 320, height: 180 },
  sim: {
    plugins: [balls],
    seed: 1,
    setup: (sim) => {
      sim.spawn([[Ball, { x: 40, y: 60, vx: 1.5, vy: 1 }]])
      sim.spawn([[Ball, { x: 160, y: 120, vx: -2, vy: 0.5 }]])
      sim.spawn([[Ball, { x: 280, y: 90, vx: 1, vy: -1.5 }]])
    },
  },
  views: { [Ball.id]: rect({ w: 8, h: 8, color: 0x52d2ff }) },
  draw: (ctx) => {
    const all = ctx.sim.query(Ball)
    ctx.rect(200, 126, 112, 14, 0x31222a)
    ctx.text(`tick ${ctx.sim.tick}   squares ${all.length}`, 204, 129, { color: 0xf5f7fa, size: 8 })

    const { x, y, w, h } = MAP
    ctx.rect(x, y, w, h, 0x3b303c)
    ctx.line(x, y, x + w, y, 0xf5f7fa)
    ctx.line(x, y + h, x + w, y + h, 0xf5f7fa)
    ctx.line(x, y, x, y + h, 0xf5f7fa)
    ctx.line(x + w, y, x + w, y + h, 0xf5f7fa)
    for (const ball of all) {
      const at = ball.get(Ball)
      ctx.circle(x + (at.x / ctx.width) * w, y + (at.y / ctx.height) * h, 1.5, 0xffbc4e)
    }
  },
})
