import { portsFor } from '../../../packages/ship/src/ports/ports-for.ts'

// The game and the fake host on different origins, as Ruken serves them (examples/placeholder/e2e/origins.ts).
// The placeholder's servers use the checkout's port pair; base-2d's sit 200 above it, so one `pnpm test:e2e`
// can run both examples' journeys side by side.
const ports = portsFor(new URL('../../..', import.meta.url).pathname, process.env)
const OFFSET = 200

export const gamePort: number = ports.preview + OFFSET
export const hostPort: number = ports.server + OFFSET
export const gameOrigin = `http://localhost:${gamePort}`
export const hostOrigin = `http://127.0.0.1:${hostPort}`

export const gameBuildPath = '/b/202610110000-e2e0b2d/'
export const gameUrl = `${gameOrigin}${gameBuildPath}`
