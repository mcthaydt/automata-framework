// examples/placeholder: the ship lane's proof page.
//
// Shows: a build made by AF's ship pipeline that boots through `Hosting` and renders only after the host says
// ready. A Ruken build (`pnpm build`) completes the Ruken handshake and greets the player inside Ruken; an itch
// build (`pnpm build:itch`) runs on the web adapter with no Ruken SDK in it. Either way it counts the player's
// visits in their saves, says so when the browser blocks saving, and offers fullscreen.
// Controls: the Fullscreen button.
// Base: none (it comes before the bases; base-2d replaces it as the M1 exit example, M1.8).
// Packages: @mcthaydt/automata-host, effect; @mcthaydt/automata-ship for packaging.
import type { Hosting } from '@mcthaydt/automata-host'
import { Effect, Scope } from 'effect'
import { boot } from './src/boot.ts'

function element<T extends HTMLElement>(selector: string): T {
  const found = document.querySelector<T>(selector)
  if (found === null) throw new Error(`index.html has no ${selector} element`)
  return found
}

const root = element<HTMLElement>('#game')
const saves = element<HTMLElement>('#saves')
const fullscreen = element<HTMLButtonElement>('#fullscreen')

/**
 * Fullscreen through the host (Ruken's frame, or the browser's on the web), offered only once the game is ready
 * and only where it works. Asking to leave fullscreen while not in it changes nothing, and the answer's
 * `support` says whether entering can work: a phone browser without the Fullscreen API answers 'none'.
 */
function offerFullscreen(hosting: Hosting): void {
  const label = () => (document.fullscreenElement === null ? 'Fullscreen' : 'Leave fullscreen')
  Effect.runPromise(hosting.setFullscreen(false)).then(
    (result) => {
      if (result.support === 'none') return
      fullscreen.hidden = false
      fullscreen.addEventListener('click', () => {
        Effect.runPromise(hosting.setFullscreen(document.fullscreenElement === null)).then(
          () => {
            fullscreen.textContent = label()
          },
          (error: unknown) => console.warn('fullscreen refused', error),
        )
      })
      document.addEventListener('fullscreenchange', () => {
        fullscreen.textContent = label()
      })
    },
    // Not granted, or the host cannot say: no button.
    () => undefined,
  )
}

// `Hosting` lives as long as the page, so its scope is never closed.
const page = Effect.runSync(Scope.make())
Effect.runPromise(Scope.extend(boot({ root, saves }), page)).then(
  (hosting) => {
    offerFullscreen(hosting)
    document.documentElement.dataset.state = 'ready'
  },
  (error: unknown) => {
    root.textContent = "Couldn't connect to Ruken."
    document.documentElement.dataset.state = 'failed'
    console.error(error)
  },
)
