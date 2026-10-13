// examples/runtime/boot-and-flow: runtime boot program, veil overlay, error panels and Flow transitions.
//
// Shows: the runtime boot pipeline under fake host or standalone, veil fade, fail-mode recovery panels, and Flow screen transitions.
// Controls: on-screen buttons to navigate screens (Splash -> Title -> Room -> Pause).
// Base: none.
// Packages: @mcthaydt/automata-runtime, effect.
import './src/no-eval.ts'
import { runGame } from '@mcthaydt/automata-runtime'
import { failMode } from './src/fail-mode.ts'
import { demoGame } from './src/game.ts'

const mode = failMode()
const game = demoGame(mode)

export const handle = runGame(game)
