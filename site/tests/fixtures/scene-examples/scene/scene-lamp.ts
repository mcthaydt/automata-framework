// scene-lamp: a fixture scene example that imports only public names
//
// Shows: the site's 3D example page on a fixture. A coloured field and one line of text stand in for the set's
//   room, so the page's words, its Play button and its frame can be proved without a 3D build.
// Controls: Tap or press any key; Escape leaves the frame.
// Packages: @automata/framework
// Difficulty: ★☆☆☆
// Tier: core
import { defineGame } from '@automata/framework'

export default defineGame({
  id: 'scene-lamp',
  size: { width: 320, height: 180 },
  sim: { plugins: [] },
  draw: (ctx) => {
    ctx.rect(0, 0, ctx.width, ctx.height, 0x3b303c)
    ctx.text('A fixture room.', 100, 82, { color: 0xf5f7fa, size: 16 })
  },
})
