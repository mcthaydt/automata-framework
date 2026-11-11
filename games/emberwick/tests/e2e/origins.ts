import { claimPorts } from '../../../../packages/tools/src/shared/ship/ports/free-ports.ts'

// The game and the fake host on different origins, as Ruken serves them, and the dev server beside them, each on a free port
// claimed from the operating system when the config loads (packages/tools free-ports.ts): two jobs on one machine never meet
// on a port, and the workers and the servers the config starts read the same ports from the environment.
const ports = claimPorts(['emberwick-game', 'emberwick-host', 'emberwick-dev'])

export const gamePort: number = ports['emberwick-game']
export const hostPort: number = ports['emberwick-host']
export const gameOrigin = `http://localhost:${gamePort}`
export const hostOrigin = `http://127.0.0.1:${hostPort}`

/** The dev server (`pnpm e2e:dev`): the dev journey edits its copy of content/. */
export const devPort: number = ports['emberwick-dev']
export const devUrl = `http://localhost:${devPort}/`
/** The copy of the tuning the dev server compiles; the dev journey edits it. */
export const devTuningFile: string = new URL('../../.e2e/content/tuning.toml', import.meta.url).pathname

export const gameBuildPath = '/b/202610110000-e2e0b2d/'
export const gameUrl = `${gameOrigin}${gameBuildPath}`
