import { portsFor } from '../../../packages/ship/src/ports/ports-for.ts'

// Where the feature demos' browser checks listen. The placeholder uses the checkout's port pair, the ui demo sits
// 100 above the preview port and Emberwick 300 above the pair (games/emberwick/e2e/origins.ts). The shared demo
// host sits 500 above the server port (5100–5199), and each demo's build 600 + 100 × its slot above the preview
// port (5300–5399, 5400–5499, …), so one `pnpm test:e2e` runs every example side by side.
const ports = portsFor(new URL('../../..', import.meta.url).pathname, process.env)

export const demoHostPort: number = Number(process.env.AF_E2E_DEMO_HOST_PORT ?? ports.server + 500)
export const demoHostOrigin = `http://127.0.0.1:${demoHostPort}`

/** The preview port of the demo in `slot` (0, 1, 2, …). */
export function demoPort(slot: number): number {
  return ports.preview + 600 + 100 * slot
}

/** The fake host page around the demo served at `gameUrl`, whose ruken.toml says `[game] id = gameId`. */
/** How the fake host treats the demo. Each field left out keeps the fake host's default. */
export interface HostedOptions {
  /** The player's server saves, seeded before the demo boots. */
  readonly saves?: Record<string, string>
  /** Grant exactly these capabilities (`[]` denies all), instead of what the demo asks for. */
  readonly grant?: readonly string[]
  /** The saves server is unreachable: writes queue on the host until it comes back. */
  readonly offline?: boolean
  /** When 'never', the fake host never says ready (autoReady: false) */
  readonly ready?: 'never'
}

export function hostedUrl(gameUrl: string, gameId: string, options: HostedOptions = {}): string {
  const query = new URLSearchParams({ game: gameUrl, id: gameId })
  if (options.saves !== undefined) query.set('saves', JSON.stringify(options.saves))
  if (options.grant !== undefined) query.set('grant', options.grant.join(','))
  if (options.offline === true) query.set('offline', '1')
  if (options.ready === 'never') query.set('ready', 'never')
  return `${demoHostOrigin}/?${query}`
}
