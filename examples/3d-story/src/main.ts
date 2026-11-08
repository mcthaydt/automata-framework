// The page's entry: starts the game. `no-eval` comes first, because the web targets allow no eval.
import '@automata/3d/no-eval'
import { startGame } from '@automata/framework'
import { game } from './app/game.ts'

let running = startGame(game)

// While `pnpm dev` runs, saving a room in the editor (or a setting in the Tuner) brings new content here
// through app/game.ts. The game starts over on it, on the same page and on the screen you were on: the old one shuts
// down first, one restart after another. A build has no `import.meta.hot`, so this never ships. Keep
// `import.meta.hot.accept` as written: Vite looks for it by name.
if (import.meta.hot) {
  let restarts = Promise.resolve()
  import.meta.hot.accept('./app/game.ts', (fresh) => {
    if (fresh === undefined) return
    restarts = restarts.then(async () => {
      const at = running.screen
      await running.shutdown()
      running = startGame(fresh.game, { at })
    })
  })
}
