// tooling/frame-budget/stress: AF's core stress example, the scene the frame-budget probe measures.
//
// Shows: N entities and M systems in the deterministic sim, an interpolated Pixi entity view per entity and a DOM
// UI over the canvas, all run by the runtime's `runGame` and AppLoop exactly as a game is.
// Controls: Pause / Resume. Size from the query: `?entities=2000&systems=8` (the defaults).
// Base: none. Packages: sim, runtime, render-pixi, ui (public entries only; stress/public-api.test.ts).
import '@mcthaydt/automata/no-eval'
import '@mcthaydt/automata/theme.css'
import { runGame } from '@mcthaydt/automata'
import { stressParams } from './params.ts'
import { stressGame } from './stress-game.ts'

const root = document.querySelector<HTMLElement>('#game')
if (root === null) throw new Error('index.html has no #game element')

runGame(stressGame(stressParams(window.location.search), { root }))
