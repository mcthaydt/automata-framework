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

/** Fullscreen through the host (Ruken's frame, or the browser's on the web), shown only once the game is ready. */
function offerFullscreen(hosting: Hosting): void {
  fullscreen.hidden = false
  fullscreen.addEventListener('click', () => {
    const on = document.fullscreenElement === null
    Effect.runPromise(hosting.setFullscreen(on)).then(
      (result) => {
        fullscreen.textContent = result.fullscreen ? 'Leave fullscreen' : 'Fullscreen'
      },
      (error: unknown) => console.warn('fullscreen refused', error),
    )
  })
  document.addEventListener('fullscreenchange', () => {
    fullscreen.textContent = document.fullscreenElement === null ? 'Fullscreen' : 'Leave fullscreen'
  })
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
