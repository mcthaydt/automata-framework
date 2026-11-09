// core-basic-window: A game window with a coloured field and a line of text
//
// Shows: defineGame() needs only an id, a size and a sim; startGame() fills in the rest: the host, the
//   renderer, and the title, play and paused screens. draw() paints over the playfield each frame, so the
//   window shows a coloured field and a line of text.
// Controls: none
// Packages: @automata/framework
// Difficulty: ★☆☆☆
// Tier: core
import { defineGame } from '@automata/framework'

export default defineGame({
  id: 'core-basic-window',
  size: { width: 320, height: 180 },
  sim: { plugins: [] },
  // A field the size of the window and one line of text in it: the smallest thing a game can show.
  draw: (ctx) => {
    ctx.rect(0, 0, ctx.width, ctx.height, 0x3b303c)
    ctx.text('Your game runs here.', 76, 82, { color: 0xf5f7fa, size: 16 })
  },
})
