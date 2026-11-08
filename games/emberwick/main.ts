// games/emberwick: AF's 2D base project, a character in a room.
//
// Shows: a complete small game on `startGame`. A pixel-art character runs and jumps through one single-screen
// room to an ember (Wick, a hooded lantern-bearer in mossy ruins at night, Endesga 64, lit by pixel lights),
// through splash → menu → room → pause → end. The runtime completes the Ruken handshake and draws nothing
// before the host says ready; opened directly, it runs standalone.
// Controls: arrows or A/D to move, Space, Z, W or Up to jump, Escape or P to pause; on-screen buttons on touch.
// Base: this is the 2D base. Demos build on it through `@af-games/emberwick`.
// Packages: @mcthaydt/automata (runtime, renderer, host, ui), @mcthaydt/automata-sim, pixi.js,
// @fontsource/pixelify-sans (OFL font); @mcthaydt/automata-tools for packaging.
import '@mcthaydt/automata/no-eval'
import '@fontsource/pixelify-sans/latin-400.css'
import '@fontsource/pixelify-sans/latin-700.css'
import { startGame } from '@mcthaydt/automata'
import { emberwick, SIM_CONTENT_HASH } from './src/app/game.ts'

/**
 * Starts a game and shows which content it plays (`#game[data-content-hash]`, read by the dev journey). `at` is the
 * screen to start on instead of the splash.
 */
const start = (game: typeof emberwick, hash: string, at?: string) => {
  document.getElementById('game')?.setAttribute('data-content-hash', hash)
  return startGame(game, { at })
}
let running = start(emberwick, SIM_CONTENT_HASH)

// In dev, each good content save reaches here as an HMR update through game.ts. A sim keeps its content for life, so
// the game shuts down and a new one starts on the new content, one restart after another, on the same page, back on
// the screen the person was on, so a tuning change is felt without pressing Play again. A round lives in the old
// game's sim, so from paused or the end screen the new game starts a fresh round in the room. Vite finds
// `import.meta.hot.accept` by name: never alias it. A build has no `import.meta.hot`, so this never ships.
const ROUND_SCREENS = new Set(['room', 'paused', 'end'])
let restarts = Promise.resolve()
import.meta.hot?.accept('./src/app/game.ts', (fresh) => {
  if (fresh !== undefined)
    restarts = restarts.then(async () => {
      const at = ROUND_SCREENS.has(running.screen ?? '') ? 'room' : running.screen
      await running.shutdown()
      running = start(fresh.emberwick, fresh.SIM_CONTENT_HASH, at)
    })
})
