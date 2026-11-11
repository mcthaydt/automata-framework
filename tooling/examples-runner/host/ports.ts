import { claimPort, claimPorts } from '../../../packages/tools/src/shared/ship/ports/free-ports.ts'

// Where the feature demos' browser checks listen: the shared demo host, one port for each demo slot, and the other
// servers that share the host's fake page (the examples index, the runner's fixtures, the playground, base-3d). Each
// is claimed from the operating system when the config loads (packages/tools free-ports.ts), so two jobs on one machine
// never meet on a port, and carried in the environment to the workers and to the servers the config starts, which agree
// on the same ports because they inherit it.
const SLOTS = 13
claimPorts(['demo-host', ...Array.from({ length: SLOTS }, (_, slot) => `demo-slot-${slot}`)])

export const demoHostPort: number = claimPort('demo-host')
export const demoHostOrigin = `http://127.0.0.1:${demoHostPort}`

/** The port of the demo in `slot` (0, 1, 2, …). */
export function demoPort(slot: number): number {
  return claimPort(`demo-slot-${slot}`)
}

/** The fake host page around the demo served at `gameUrl`, whose ruken.toml says `[game] id = gameId`. */
/** How the fake host treats the demo. Each field left out keeps the fake host's default. */
export interface HostedOptions {
  /** The player's server saves, seeded before the demo boots. */
  readonly saves?: Record<string, string>
  /** Grant exactly these capabilities (`[]` denies all), instead of what the demo asks for. */
  readonly grant?: readonly string[]
  /** The network is down: the saves server (writes queue on the host until it comes back) and the leaderboards. */
  readonly offline?: boolean
  /** When 'never', the fake host never says ready (autoReady: false) */
  readonly ready?: 'never'
  /** A page showing the game's source, framed beside the game (the examples index's View). */
  readonly source?: string
}

export function hostedUrl(gameUrl: string, gameId: string, options: HostedOptions = {}): string {
  return `${demoHostOrigin}/?${hostedQuery(gameUrl, gameId, options)}`
}

/** The fake host's query string for the game at `gameUrl` (see host.ts). */
export function hostedQuery(gameUrl: string, gameId: string, options: HostedOptions = {}): URLSearchParams {
  const query = new URLSearchParams({ game: gameUrl, id: gameId })
  if (options.saves !== undefined) query.set('saves', JSON.stringify(options.saves))
  if (options.grant !== undefined) query.set('grant', options.grant.join(','))
  if (options.offline === true) query.set('offline', '1')
  if (options.ready === 'never') query.set('ready', 'never')
  if (options.source !== undefined) query.set('source', options.source)
  return query
}

/** The 2D examples package's preview build, in the slot after the six feature demos. */
export const examplesPort: number = demoPort(6)
/** The runner's own fixture build (the stub example), in the next slot. */
export const runnerFixturesPort: number = demoPort(7)
/** The playground feasibility server, in the slot after the fixtures. */
export const playgroundPort: number = demoPort(8)
export const playgroundOrigin = `http://127.0.0.1:${playgroundPort}`
/** The playground frame's test server: the runtime build, the frame pages and the examples' files. */
export const playgroundFramePort: number = demoPort(9)
export const playgroundFrameOrigin = `http://127.0.0.1:${playgroundFramePort}`
/** The base 3D game's preview build (games/base-3d/e2e), framed by the same fake host. */
export const base3dPort: number = demoPort(10)
/** base-3d's Vite dev server (games/base-3d/tests/e2e-dev): the page as `pnpm dev` serves it, unbundled, in the next slot. */
export const base3dDevPort: number = demoPort(11)
/** The 3D examples package's preview build (examples/3d), apart from the 2D one so both can run side by side. */
export const examples3dPort: number = demoPort(12)
