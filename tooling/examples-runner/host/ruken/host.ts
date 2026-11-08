// The fake Ruken host every feature demo's smoke test boots under: Ruken's own fake host
// (`@ruken/sdk-host/testing`, real-iframe mode) around the demo named in the query string, served from another
// origin. `?game=<url>&id=<game id>[&saves=<json>][&grant=<a,b>][&offline=1][&source=<url>]`: `saves` seeds the
// player's server saves, `grant` grants exactly those capabilities (empty denies all), `offline` takes the network
// down (the saves server and, the leaderboards are unreachable), `source` frames that page beside the
// game (the examples index's View). `hostedUrl` in ports.ts builds the query. Test and examples only; never part of
// a game build that ships.
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

const readyParam = query.get('ready')
const autoReady = readyParam !== 'never'

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
  autoReady,
})
const offline = query.get('offline') === '1'
host.fakes.saves.offline = offline
host.fakes.leaderboards.offline = offline
iframe.src = game

// `source=<url>` (the examples index's View): the example's source page in a second frame beside the game.
// index.html lays the two out side by side when the page is wider than tall, and stacked otherwise.
const source = query.get('source')
if (source !== null) {
  const sourceFrame = document.createElement('iframe')
  sourceFrame.title = 'source'
  sourceFrame.src = source
  document.body.append(sourceFrame)
  document.body.dataset.view = 'source'
}

// What the smoke tests read and drive.
Object.assign(window, {
  hostTrace: () => host.messages.map((entry) => entry.msg.type),
  hostBridge: host.bridge,
  // What the player's account holds, by key; and a write from another device (the saves journeys).
  hostSlots: () => Object.fromEntries([...host.fakes.server.slots].map(([key, slot]) => [key, slot.value])),
  hostRemoteWrite: (key: string, value: string, deviceLabel: string) =>
    host.fakes.server.remoteWrite(key, value, deviceLabel),
})
