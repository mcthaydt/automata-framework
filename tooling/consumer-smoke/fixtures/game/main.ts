// consumer-smoke's game: the smallest game on the one import, as examples/2d/core/core-basic-window.ts is.
// run.ts builds it twice: for the web target, which it boots in Chromium under Ruken's CSP, and for Ruken, whose
// bundle must hold exactly one Ruken SDK.
import '@automataframework/automata/no-eval'
import { defineGame, startGame } from '@automataframework/automata'

startGame(
  defineGame({
    id: 'consumer-smoke',
    size: { width: 320, height: 180 },
    sim: { plugins: [] },
  }),
)
