// A test server whose port is written down, or worked out from the checkout, a runner offset or another server's port, has
// that port in every job on the machine, so two jobs both start it there and the second fails with
// "http://localhost:4800/ is already used". A port is claimed from the operating system instead (packages/tools
// free-ports.ts). This finds the lines that name one, and the lines that let a CI job reuse a server it did not start.

export interface PortFinding {
  readonly file: string
  /** 1-based. */
  readonly line: number
  /** The line, trimmed. */
  readonly text: string
}

/** A port is written as digits; `0` (any free port) and a variable are fine. */
const PORT = '[1-9]\\d{1,4}\\b'

/** What puts a port in a line: a flag, a listen call, an option, an env fallback or entry, an origin, or a sum on another port. */
const NAMES_A_PORT: readonly RegExp[] = [
  new RegExp(`--port[\\s=]+['"]?${PORT}`),
  new RegExp(`\\.listen\\(\\s*${PORT}`),
  // `port: 4800`, `devPort = 4800`, `AF_E2E_DEMO_PORT=4800` (not `PORTRAIT_FIELD_TOP = 60`).
  new RegExp(`(?:\\bport|[a-z]Port|_PORT)\\s*[=:]\\s*['"]?${PORT}`),
  // `process.env.AF_E2E_DEMO_PORT ?? 4800`.
  new RegExp(`process\\.env\\.\\w*PORT\\w*\\s*\\?\\?\\s*${PORT}`),
  // Ruken's dev port (5173) is the other project's server, which a game names as the host that may frame it.
  new RegExp(`(?:localhost|127\\.0\\.0\\.1|0\\.0\\.0\\.0|\\[::1\\]):(?!5173\\b)${PORT}`),
  // A port worked out from another: `ports.preview + 1100`, `demoPort + 200`. Every job on the machine works out the same one.
  /\.(?:preview|server)\s*\+\s*\d/,
  /(?:\bport|[a-z]Port)\s*\+\s*\d/,
  // The checkout-derived ports the helper replaced: the same in every job of a runner copy.
  /\bbrowserSafePort\(/,
  /\bportsFor\([^)]*(?:process\.env|import\.meta)/,
  /(?:ports-for|browser-safe-port)(?:\.ts)?['"]/,
  // Playwright's webServer reuses whatever answers on the port, which on a shared runner is another job's server.
  /\breuseExistingServer:\s*true\b/,
]

/** The file that defines the ports: it is where the browsers' bad ports are written down. */
const DEFINES_PORTS: ReadonlySet<string> = new Set(['packages/tools/src/shared/ship/ports/free-ports.ts'])

/**
 * Where a literal port is not a server: a fake origin no server listens on (the host test page's game), checked by the file,
 * since the same text in a config would be a server.
 */
const NO_SERVER: ReadonlySet<string> = new Set([
  'packages/automata/src/testing/host/page/ruken/hosting-test.ts',
])

/**
 * Where a literal port is the default of a server that ships, not of a test server: a deployed game's server listens on
 * `PORT`, else on this, and a checkout-derived slot would be wrong there. Checked by the file.
 */
const SHIPPED_DEFAULT: ReadonlySet<string> = new Set(['extensions/net-server/src/app/server-process.ts'])

const SCANNED = /\.(?:ts|mts|cts|js|mjs|cjs|json|ya?ml|sh|svelte|html)$/
const SKIPPED =
  /(?:^|\/)(?:node_modules|dist|docs|agents|vendor|reference|paraglide|\.core)\/|\.test\.|\.api\.md$|pnpm-lock/

/** Whether `file` (a repository path) can start or name a server. Unit tests, generated reports and documents cannot. */
export function isPortScanned(file: string): boolean {
  return (
    SCANNED.test(file) &&
    !SKIPPED.test(file) &&
    !DEFINES_PORTS.has(file) &&
    !NO_SERVER.has(file) &&
    !SHIPPED_DEFAULT.has(file)
  )
}

/** A line that only comments: its ports are prose. */
function isComment(line: string): boolean {
  return /^(?:\/\/|\*|\/\*|#)/.test(line)
}

/** Each line of `text`, the file at `file`, that writes a port down or works one out instead of claiming it, or reuses a server on CI. */
export function hardCodedPorts(file: string, text: string): PortFinding[] {
  const found: PortFinding[] = []
  text.split('\n').forEach((raw, index) => {
    const line = raw.trim()
    if (!isComment(line) && NAMES_A_PORT.some((pattern) => pattern.test(line)))
      found.push({ file, line: index + 1, text: line })
  })
  return found
}
