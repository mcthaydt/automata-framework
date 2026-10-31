// Spike S8 only: the placeholder's boot without Effect, so the measurement can tell Effect's cost apart
// from the SDK's. Same handshake and the same line of text as main.ts; never shipped.
import { Ruken } from '@ruken/sdk'
import { GAME_ID } from '../../src/ruken/boot.ts'

const root = document.querySelector<HTMLElement>('#game')
if (root === null) throw new Error('no-effect.html has no #game element')

Ruken.init({ gameId: GAME_ID, wants: [], pauseBehavior: 'pause' })
  .then(async (session) => {
    await session.ready
    root.textContent = `Ready. Hello, ${session.player.displayName}.`
    document.documentElement.dataset.state = 'ready'
  })
  .catch((error: unknown) => {
    root.textContent = "Couldn't connect to Ruken."
    document.documentElement.dataset.state = 'failed'
    console.error(error)
  })
