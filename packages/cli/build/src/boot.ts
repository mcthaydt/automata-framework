import { makeHosting } from '@mcthaydt/automata-host/target'
import { Effect, Exit, Scope } from 'effect'
import { createGameApp } from './game.ts'

// The host session lives as long as the page. Which host answers is the build's choice: `vite build --mode <target>`
// bundles that target's adapter (web, itch.io, Ruken or the desktop) and no other.
export async function boot(container: HTMLElement): Promise<void> {
  const session = Effect.runSync(Scope.make())
  const hosting = await Effect.runPromise(
    Scope.extend(makeHosting({ gameId: 'build', wants: [], pauseBehavior: 'pause' }), session),
  )
  await Effect.runPromise(hosting.ready)
  const app = createGameApp(container, hosting.hostName)
  await app.start()
  window.addEventListener('pagehide', () => {
    void app.stop().then(() => Effect.runPromise(Scope.close(session, Exit.void)))
  })
}
