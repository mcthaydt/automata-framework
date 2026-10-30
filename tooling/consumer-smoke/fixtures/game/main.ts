// consumer-smoke's game (DX.2a): the smallest game on the one import, as examples/core/core-basic-window.ts is.
// run.ts builds it twice: for the web target, which it boots in Chromium under Ruken's CSP, and for Ruken, whose
// bundle must hold exactly one Ruken SDK.
import '@mcthaydt/automata/no-eval'
import { defineGame, startGame } from '@mcthaydt/automata'

startGame(
  defineGame({
    id: 'consumer-smoke',
    size: { width: 320, height: 180 },
    sim: { plugins: [] },
  }),
)
