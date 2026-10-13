import './src/no-eval.ts'
import { runGame } from '@mcthaydt/automata-runtime'
import { failMode } from './src/fail-mode.ts'
import { demoGame } from './src/game.ts'

const mode = failMode()
const game = demoGame(mode)

export const handle = runGame(game)
