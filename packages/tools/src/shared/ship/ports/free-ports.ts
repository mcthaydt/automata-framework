import { execFileSync } from 'node:child_process'

/**
 * The Fetch standard's bad ports from 1024 up (https://fetch.spec.whatwg.org/#port-blocking). Chromium, WebKit and
 * Firefox all refuse them (`net::ERR_UNSAFE_PORT`), so a journey whose server sits on one fails before its page loads.
 */
const BAD_PORTS: ReadonlySet<number> = new Set([
  1719, 1720, 1723, 2049, 3659, 4045, 4190, 5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669, 6679, 6697,
  10080,
])

/**
 * Ports a Mac holds that no browser blocks: the AirPlay Receiver (macOS 12 and later, on by default) listens on 5000
 * and 7000. A journey server there is "already used" (Playwright answers from AirPlay, not from the game).
 */
const MAC_AIRPLAY_PORTS: ReadonlySet<number> = new Set([5000, 7000])

/** Whether the browsers load a page from `port` and the test machines leave it alone. */
export function isBrowserSafePort(port: number): boolean {
  return !BAD_PORTS.has(port) && !MAC_AIRPLAY_PORTS.has(port)
}

/** The environment variable that carries a run's ports from the process that picked them to every process it starts. */
export const CLAIMED_PORTS_ENV = 'AF_E2E_CLAIMED_PORTS'

type Env = Record<string, string | undefined>

/**
 * Binds `count` ports at once and prints them as JSON. All of them are held open until the last is chosen, so the
 * operating system cannot hand the same one out twice. A port in `skip` (already claimed, or one a browser refuses)
 * is held too and not counted, for the same reason.
 */
const PICK = `
const net = require('node:net')
const [count, skipJson] = process.argv.slice(1)
const skip = new Set(JSON.parse(skipJson))
const open = []
const chosen = []
const next = () => {
  if (chosen.length === Number(count)) {
    console.log(JSON.stringify(chosen))
    for (const server of open) server.close()
    return
  }
  if (open.length > 500) throw new Error('no free port')
  const server = net.createServer()
  server.once('error', (error) => { throw error })
  server.listen(0, '127.0.0.1', () => {
    open.push(server)
    const { port } = server.address()
    if (!skip.has(port)) chosen.push(port)
    next()
  })
}
next()
`

/** `count` ports that nothing listens on, none in `skip`, each one a port the browsers load. */
function pickFreePorts(count: number, skip: readonly number[]): number[] {
  const refused = [...skip, ...BAD_PORTS, ...MAC_AIRPLAY_PORTS]
  const out = execFileSync(process.execPath, ['-e', PICK, String(count), JSON.stringify(refused)], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  const ports: unknown = JSON.parse(out)
  if (!Array.isArray(ports) || ports.length !== count || !ports.every((port) => Number.isInteger(port)))
    throw new Error(`Could not pick ${count} free ports: ${out}`)
  return ports as number[]
}

function readClaims(env: Env): Record<string, number> {
  const raw = env[CLAIMED_PORTS_ENV]
  if (raw === undefined || raw === '') return {}
  let claims: unknown
  try {
    claims = JSON.parse(raw)
  } catch {
    throw new Error(`${CLAIMED_PORTS_ENV} is not JSON: ${raw}`)
  }
  const isPorts =
    typeof claims === 'object' &&
    claims !== null &&
    !Array.isArray(claims) &&
    Object.values(claims).every((port) => Number.isInteger(port))
  if (!isPorts) throw new Error(`${CLAIMED_PORTS_ENV} is not a map of names to ports: ${raw}`)
  return claims as Record<string, number>
}

/**
 * One free port for each of `names`, the same ones for as long as `env` carries them.
 *
 * A test server used to write its port down, or take one from the checkout path, so two jobs on one machine met on it and
 * Playwright's webServer refused to start ("http://127.0.0.1:5100/ is already used"). The first process to ask (the
 * Playwright config) takes the ports from the operating system and writes them into `env` (`process.env` by default),
 * which the workers and the servers the config starts inherit: everything that names a server agrees on its port and no
 * other job has it.
 *
 * Servers that must know each other's URL (a game and its editor, `--game-url`) are claimed in one call, before either
 * starts. Names are per run, so give each server a name no other config uses.
 */
export function claimPorts<Name extends string>(
  names: readonly Name[],
  env: Env = process.env,
): Record<Name, number> {
  const claims = readClaims(env)
  const missing = [...new Set(names)].filter((name) => claims[name] === undefined)
  if (missing.length > 0) {
    const picked = pickFreePorts(missing.length, Object.values(claims))
    missing.forEach((name, index) => {
      claims[name] = picked[index] as number
    })
    env[CLAIMED_PORTS_ENV] = JSON.stringify(claims)
  }
  return Object.fromEntries(names.map((name) => [name, claims[name] as number])) as Record<Name, number>
}

/** The port of the one server `name`: {@link claimPorts} for a server that needs no neighbour's. */
export function claimPort(name: string, env: Env = process.env): number {
  return claimPorts([name], env)[name] as number
}
