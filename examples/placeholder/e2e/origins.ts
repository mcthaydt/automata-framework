import { portsFor } from '../../../packages/ship/src/ports/ports-for.ts'

// The game and the fake host are served on different origins, as Ruken serves them: the game on localhost at
// the checkout's preview port, the host page on 127.0.0.1 at its server port (portsFor keeps worktrees apart).
const ports = portsFor(new URL('../../..', import.meta.url).pathname, process.env)

export const gamePort: number = ports.preview
export const hostPort: number = ports.server
export const gameOrigin = `http://localhost:${gamePort}`
export const hostOrigin = `http://127.0.0.1:${hostPort}`
