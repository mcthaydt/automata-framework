import { browserSafePort } from '../../../packages/ship/src/ports/browser-safe-port.ts'
import { portsFor } from '../../../packages/ship/src/ports/ports-for.ts'

// Where the feature demos' browser checks listen. The placeholder uses the checkout's port pair, the ui demo sits
// 100 above the preview port and Emberwick 300 above the pair (games/emberwick/e2e/origins.ts). The shared demo
// host sits 500 above the server port (5100–5199), and each demo's build 600 + 100 × its slot above the preview
// port (5300–5399, 5400–5499, …), so one `pnpm test:e2e` runs every example side by side. Each derived port
// steps past the browsers' bad ports (CI's fixed pair put the runner's fixtures on 6000).
const ports = portsFor(new URL('../../..', import.meta.url).pathname, process.env)

export const demoHostPort: number = Number(
  process.env.AF_E2E_DEMO_HOST_PORT ?? browserSafePort(ports.server + 500),
)
export const demoHostOrigin = `http://127.0.0.1:${demoHostPort}`

/** The preview port of the demo in `slot` (0, 1, 2, …). */
export function demoPort(slot: number): number {
  return browserSafePort(ports.preview + 600 + 100 * slot)
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
  /** A page showing the game's source, framed beside the game (the examples index's View, EX.5). */
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

/** The examples package's preview build (EX spec §5), in the slot after the six feature demos. */
export const examplesPort: number = demoPort(6)
/** The runner's own fixture build (the stub example), in the next slot. */
export const runnerFixturesPort: number = demoPort(7)
/** The playground feasibility server (website playground spec, WEB.PLAY.1), in the slot after the fixtures. */
export const playgroundPort: number = demoPort(8)
export const playgroundOrigin = `http://127.0.0.1:${playgroundPort}`
/** The playground frame's test server (WEB.PLAY.2): the runtime build, the frame pages and the examples' files. */
export const playgroundFramePort: number = demoPort(9)
export const playgroundFrameOrigin = `http://127.0.0.1:${playgroundFramePort}`
/** The base 3D game's preview build (games/base-3d/e2e, M3.7b part 4), framed by the same fake host. */
export const base3dPort: number = demoPort(10)
/** base-3d's Vite dev server (games/base-3d/e2e-dev): the page as `pnpm dev` serves it, unbundled, in the next slot. */
export const base3dDevPort: number = demoPort(11)
