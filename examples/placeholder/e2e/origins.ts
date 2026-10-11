import { portsFor } from '../../../packages/ship/src/ports/ports-for.ts'

// The game and the fake host are served on different origins, as Ruken serves them: the game on localhost at
// the checkout's preview port, the host page on 127.0.0.1 at its server port (portsFor keeps worktrees apart).
const ports = portsFor(new URL('../../..', import.meta.url).pathname, process.env)

export const gamePort: number = ports.preview
export const hostPort: number = ports.server
export const gameOrigin = `http://localhost:${gamePort}`
export const hostOrigin = `http://127.0.0.1:${hostPort}`

// Ruken serves a build from /b/<buildId>/ on the game origin, never from its root, so the journeys load the game
// from there too: a root-absolute URL in the build is then a 404 here, as it would be inside Ruken.
export const gameBuildPath = '/b/202610110000-e2e0000/'
export const gameUrl = `${gameOrigin}${gameBuildPath}`
