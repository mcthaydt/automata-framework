// The e2e host page: Ruken's own fake host (`@ruken/sdk-host/testing`, real-iframe mode) around emberwick,
// which is served on another origin. Test-only; never part of a build that ships.
import { createFakeHost } from '@ruken/sdk-host/testing'
import { GAME_ID } from '#src/game-id.ts'

const gameOrigin = import.meta.env.VITE_GAME_ORIGIN
const gamePath = import.meta.env.VITE_GAME_PATH
if (typeof gameOrigin !== 'string' || gameOrigin === '') throw new Error('VITE_GAME_ORIGIN is not set')
if (typeof gamePath !== 'string' || !gamePath.startsWith('/b/'))
  throw new Error('VITE_GAME_PATH is not /b/<id>/')
const iframe = document.querySelector('iframe')
if (iframe === null) throw new Error('the host page has no iframe')

const host = createFakeHost({
  gameOrigin,
  gameId: GAME_ID,
  clock: {
    epochMs: () => Date.now(),
    setTimeout: (fn: () => void, ms: number) => window.setTimeout(fn, ms),
    clearTimeout: (handle: unknown) => window.clearTimeout(handle as number),
  },
  iframe,
  window,
  document,
  hostOrigin: window.location.origin,
  player: { id: 'p-1', displayName: 'Ada' },
})
iframe.src = `${gameOrigin}${gamePath}`

// The protocol trace the e2e spec reads.
;(window as unknown as { hostTrace: () => string[] }).hostTrace = () =>
  host.messages.map((entry) => entry.msg.type)
