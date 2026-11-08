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
  views: { [Ball.id]: rect({ w: 8, h: 8, color: 0x00cdf9 }) },
  draw: (ctx) => {
    const all = ctx.sim.query(Ball)
    // The text sizes its own panel: on a phone it is drawn larger than 8 so it stays readable, and it is anchored to
    // the field's right edge so it never runs off it.
    const box = ctx.text(`tick ${ctx.sim.tick}   squares ${all.length}`, ctx.width - 8, 129, {
      color: 0xffffff,
      size: 8,
      anchor: { x: 1, y: 0 },
    })
    ctx.rect(ctx.width - 8 - box.width - 4, 126, box.width + 8, box.height + 6, 0x2e222f)

    const { x, y, w, h } = MAP
    ctx.rect(x, y, w, h, 0x3e3546)
    ctx.line(x, y, x + w, y, 0xffffff)
    ctx.line(x, y + h, x + w, y + h, 0xffffff)
    ctx.line(x, y, x, y + h, 0xffffff)
    ctx.line(x + w, y, x + w, y + h, 0xffffff)
    for (const ball of all) {
      const at = ball.get(Ball)
      ctx.circle(x + (at.x / ctx.width) * w, y + (at.y / ctx.height) * h, 1.5, 0xf9c22b)
    }
  },
})
