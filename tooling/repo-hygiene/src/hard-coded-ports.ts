// A test server that names its own port ignores AF_RUNNER_PORT_OFFSET, so two runner copies on one machine both start it
// on that port and the second fails with "http://localhost:4800/ is already used". This finds the lines that do it.

export interface PortFinding {
  readonly file: string
  /** 1-based. */
  readonly line: number
  /** The line, trimmed. */
  readonly text: string
}

/** A port is written as digits; `0` (any free port) and a variable are fine. */
const PORT = '[1-9]\\d{1,4}\\b'

/** What puts a port in a line: a flag, a listen call, an option, an env fallback or entry, or an origin. */
const NAMES_A_PORT: readonly RegExp[] = [
  new RegExp(`--port[\\s=]+['"]?${PORT}`),
  new RegExp(`\\.listen\\(\\s*${PORT}`),
  // `port: 4800`, `devPort = 4800`, `AF_E2E_DEMO_PORT=4800` (not `PORTRAIT_FIELD_TOP = 60`).
  new RegExp(`(?:\\bport|[a-z]Port|_PORT)\\s*[=:]\\s*['"]?${PORT}`),
  // `process.env.AF_E2E_DEMO_PORT ?? 4800`.
  new RegExp(`process\\.env\\.\\w*PORT\\w*\\s*\\?\\?\\s*${PORT}`),
  // Ruken's dev port (5173) is the other project's server, which a game names as the host that may frame it.
  new RegExp(`(?:localhost|127\\.0\\.0\\.1|0\\.0\\.0\\.0|\\[::1\\]):(?!5173\\b)${PORT}`),
]

/** The files that define the ports: they are where a number may be written down. */
const DEFINES_PORTS: ReadonlySet<string> = new Set([
  'packages/tools/src/shared/ship/ports/ports-for.ts',
  'packages/tools/src/shared/ship/ports/browser-safe-port.ts',
])

/**
 * Where a literal port is not a server: a fake origin no server listens on (the host test page's game), checked by the file,
 * since the same text in a config would be a server.
 */
const NO_SERVER: ReadonlySet<string> = new Set([
  'packages/automata/src/testing/host/page/ruken/hosting-test.ts',
])

const SCANNED = /\.(?:ts|mts|cts|js|mjs|cjs|json|ya?ml|sh|svelte|html)$/
const SKIPPED =
  /(?:^|\/)(?:node_modules|dist|docs|agents|vendor|reference|paraglide|\.core)\/|\.test\.|\.api\.md$|pnpm-lock/

/** Whether `file` (a repository path) can start or name a server. Unit tests, generated reports and documents cannot. */
export function isPortScanned(file: string): boolean {
  return SCANNED.test(file) && !SKIPPED.test(file) && !DEFINES_PORTS.has(file) && !NO_SERVER.has(file)
}

/** A line that only comments: its ports are prose. */
function isComment(line: string): boolean {
  return /^(?:\/\/|\*|\/\*|#)/.test(line)
}

/** Each line of `text`, the file at `file`, that writes a port down instead of taking it from `portsFor`. */
export function hardCodedPorts(file: string, text: string): PortFinding[] {
  const found: PortFinding[] = []
  text.split('\n').forEach((raw, index) => {
    const line = raw.trim()
    if (!isComment(line) && NAMES_A_PORT.some((pattern) => pattern.test(line)))
      found.push({ file, line: index + 1, text: line })
  })
  return found
}
