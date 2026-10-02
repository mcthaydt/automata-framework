import { domEnv } from './dom-env'
import { initRuken } from './sdk-stub'

// Runs inside the iframe on http://localhost:<port>. Reports back only through the protocol itself.
const ruken = await initRuken(
  { gameId: 'blank-game', wants: ['saves'], pauseBehavior: 'pause', onMenuRequest: () => true },
  domEnv(),
)
const t0 = performance.now()
await ruken.ready // a real game starts rendering only after this (R-04)
const report = {
  hosted: ruken.hosted,
  granted: [...ruken.granted],
  waitedMs: Math.round(performance.now() - t0),
}
ruken.saves.storage.setItem('probe', JSON.stringify(report))
await ruken.saves.flush()
