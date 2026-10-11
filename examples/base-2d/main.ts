// examples/base-2d: AF's 2D base project, a character in a room.
//
// Shows: the smallest complete game on AF. A pixel-art character runs and jumps through one single-screen room
// to an ember (Wick, a hooded lantern-bearer in mossy ruins at night, Endesga 64, lit by pixel lights),
// through splash → menu → room → pause → end. It completes the Ruken handshake and renders nothing before the
// host says ready; opened directly, it runs standalone.
// Controls: arrows or A/D to move, Space, Z, W or Up to jump, Escape or P to pause; on-screen buttons on touch.
// Base: this is the 2D base. Demos build on it through `@af-examples/base-2d`.
// Packages: @mcthaydt/automata-sim, @ruken/sdk, effect, pixi.js, @fontsource/pixelify-sans (OFL font);
// @mcthaydt/automata-ship for packaging.
import './src/no-eval.ts'
import '@fontsource/pixelify-sans/latin-400.css'
import '@fontsource/pixelify-sans/latin-700.css'
import { Effect } from 'effect'
import { startGame } from './src/game.ts'

const root = document.querySelector<HTMLElement>('#game')
if (root === null) throw new Error('index.html has no #game element')

Effect.runPromise(startGame(root)).then(
  () => {
    document.documentElement.dataset.state = 'ready'
  },
  (error: unknown) => {
    const tag = (error as { _tag?: string } | null)?._tag
    root.textContent =
      tag === 'RendererFailed' ? "This device can't run the game." : "Couldn't connect to Ruken."
    document.documentElement.dataset.state = 'failed'
    console.error(error)
  },
)
