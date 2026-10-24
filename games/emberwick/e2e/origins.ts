import { browserSafePort } from '../../../packages/ship/src/ports/browser-safe-port.ts'
import { portsFor } from '../../../packages/ship/src/ports/ports-for.ts'

// The game and the fake host on different origins, as Ruken serves them (games/placeholder/e2e/origins.ts).
// The placeholder's servers use the checkout's port pair and the ui demo sits 100 above the preview port;
// base-2d's sit 300 above the pair (host 4900–4999, game 5000–5099), so one `pnpm test:e2e` runs every
// example's journeys side by side without two servers on one port. Both step past the browsers' bad ports
// (preview 4760 put the game on 5060, SIP).
const ports = portsFor(new URL('../../..', import.meta.url).pathname, process.env)
const OFFSET = 300

export const gamePort: number = browserSafePort(ports.preview + OFFSET)
export const hostPort: number = browserSafePort(ports.server + OFFSET)
export const gameOrigin = `http://localhost:${gamePort}`
export const hostOrigin = `http://127.0.0.1:${hostPort}`

export const gameBuildPath = '/b/202610110000-e2e0b2d/'
export const gameUrl = `${gameOrigin}${gameBuildPath}`
