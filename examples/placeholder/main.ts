// examples/placeholder: the ship lane's proof page.
//
// Shows: a build made by AF's ship pipeline (vite build, `automata-ship prepare`, `ruken publish` or
// `automata-ship deploy-dev`) that completes the Ruken handshake and renders one line only after the host
// says ready. Inside Ruken it greets the player; opened directly, the SDK runs standalone and it just says hello.
// Controls: none.
// Base: none (it comes before the bases; base-2d replaces it as the M1 exit example, M1.8).
// Packages: @ruken/sdk, effect; @mcthaydt/automata-ship for packaging.
import { Effect } from 'effect'
import { boot } from './src/boot.ts'

const root = document.querySelector<HTMLElement>('#game')
if (root === null) throw new Error('index.html has no #game element')

Effect.runPromise(boot({ root })).then(
  () => {
    document.documentElement.dataset.state = 'ready'
  },
  (error: unknown) => {
    root.textContent = "Couldn't connect to Ruken."
    document.documentElement.dataset.state = 'failed'
    console.error(error)
  },
)
