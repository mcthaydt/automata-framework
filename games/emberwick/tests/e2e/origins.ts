import { browserSafePort } from '../../../../packages/tools/src/shared/ship/ports/browser-safe-port.ts'
import { portsFor } from '../../../../packages/tools/src/shared/ship/ports/ports-for.ts'

// The game and the fake host on different origins, as Ruken serves them (host and game ports from the checkout's pair).
// The ui demo sits 100 above the preview port; emberwick's sit 300 above the pair (host 4900–4999, game 5000–5099), so one `pnpm test:e2e` runs every
// example's journeys side by side without two servers on one port. Both step past the browsers' bad ports
// (preview 4760 put the game on 5060, SIP).
const ports = portsFor(new URL('../../..', import.meta.url).pathname, process.env)
const OFFSET = 300

export const gamePort: number = browserSafePort(ports.preview + OFFSET)
export const hostPort: number = browserSafePort(ports.server + OFFSET)
export const gameOrigin = `http://localhost:${gamePort}`
export const hostOrigin = `http://127.0.0.1:${hostPort}`

/** The dev server (`pnpm e2e:dev`), 400 above the pair (5100–5199): the dev journey edits its copy of content/. */
export const devPort: number = browserSafePort(ports.preview + OFFSET + 100)
export const devUrl = `http://localhost:${devPort}/`
/** The copy of the tuning the dev server compiles; the dev journey edits it. */
export const devTuningFile: string = new URL('../../.e2e/content/tuning.toml', import.meta.url).pathname

export const gameBuildPath = '/b/202610110000-e2e0b2d/'
export const gameUrl = `${gameOrigin}${gameBuildPath}`
