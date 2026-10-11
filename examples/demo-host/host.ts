// The fake Ruken host every feature demo's smoke test boots under: Ruken's own fake host
// (`@ruken/sdk-host/testing`, real-iframe mode) around the demo named in the query string, served from another
// origin. `?game=<url>&id=<game id>[&saves=<json>][&grant=<a,b>][&offline=1]`: `saves` seeds the player's
// server saves, `grant` grants exactly those capabilities (empty denies all), `offline` makes the saves server
// unreachable. `hostedUrl` in ports.ts builds the query. Test-only; never part of a build that ships.
import { createFakeHost } from '@ruken/sdk-host/testing'

type Capability = NonNullable<Parameters<typeof createFakeHost>[0]['grant']>[number]

const query = new URLSearchParams(window.location.search)
const game = query.get('game')
const gameId = query.get('id')
if (game === null || gameId === null) throw new Error('demo host: pass ?game=<url>&id=<game id>')
const savesParam = query.get('saves')
const saves = savesParam === null ? undefined : (JSON.parse(savesParam) as Record<string, string>)
const grantParam = query.get('grant')
const grant =
  grantParam === null ? undefined : (grantParam.split(',').filter((name) => name !== '') as Capability[])
const iframe = document.querySelector('iframe')
if (iframe === null) throw new Error('demo host: the page has no iframe')

const host = createFakeHost({
  gameOrigin: new URL(game).origin,
  gameId,
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
  saves,
  grant,
})
host.fakes.saves.offline = query.get('offline') === '1'
iframe.src = game

// What the smoke tests read and drive.
Object.assign(window, {
  hostTrace: () => host.messages.map((entry) => entry.msg.type),
  hostBridge: host.bridge,
})
