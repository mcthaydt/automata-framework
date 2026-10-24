// core-basic-window: open a game window
//
// Shows: defineGame() needs only an id, a size and a sim; startGame() fills in the rest: the host, the
//   renderer, and the title, play and paused screens.
// Controls: none
// Packages: @mcthaydt/automata
// Difficulty: ★☆☆☆
// Tier: core
import { defineGame } from '@mcthaydt/automata'

export default defineGame({
  id: 'core-basic-window',
  size: { width: 320, height: 180 },
  sim: { plugins: [] },
})
