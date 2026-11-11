import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { hardCodedPorts, isPortScanned } from '#src/hard-coded-ports.ts'

// Jobs share one machine (two jobs of one runner copy, or two copies), and a port that is written down, or worked out from
// the checkout or a runner offset, is the same in every one of them: the second job's Playwright webServer dies with
// "http://localhost:4800/ is already used". These tests hold every server in the repository to a port it claims from the
// operating system when the config loads (packages/tools claimPorts).

const root = fileURLToPath(new URL('../../../..', import.meta.url))

const find = (text: string, file = 'games/x/playwright.config.ts'): string[] =>
  hardCodedPorts(file, text).map((finding) => finding.text)

describe('a literal port in a server command or origin', () => {
  it.each([
    ['a vite --port flag', 'vite preview --strictPort --host localhost --port 4800'],
    ['a --port=… flag', 'vite --port=5100'],
    ['a webServer command', 'command: `pnpm exec vite --strictPort --port 6200`,'],
    ['a port option', "server: { port: 4800, strictPort: true, host: '127.0.0.1' },"],
    ['a listen call', "server.listen(5100, '127.0.0.1')"],
    ['an env fallback', 'const port = Number(process.env.AF_E2E_DEMO_PORT ?? 4800)'],
    ['a port env assignment', 'AF_E2E_EXAMPLES_PORT=5300 pnpm e2e:examples'],
    ['a port env entry', "env: { AF_E2E_DEMO_PORT: '4800' },"],
    ['a localhost origin', "const url = 'http://localhost:4800/'"],
    ['a loopback origin', 'http://127.0.0.1:5100/'],
  ])('is found in %s', (_name, line) => {
    expect(find(line)).toEqual([line.trim()])
  })

  it.each([
    ['a port taken from a variable', 'vite preview --port $AF_E2E_DEMO_PORT'],
    ['a port taken from an expression', 'url: `http://localhost:${examplesPort}/`,'],
    ['the free port', "server.listen(0, '127.0.0.1', () => {"],
    ['a comment line', '// The demo sits on http://localhost:4800/ in the old layout'],
    ['a doc comment line', ' * e.g. `http://localhost:4800` for a local stack'],
    ['a yaml comment', '# the host listens on --port 4800'],
    ['a year or a size', 'const FLIP_Y = 0x80000000; const size = 4096'],
    [
      'Ruken’s own dev port as a client origin',
      "hostOrigins: [process.env.AF_E2E_HOST_ORIGIN ?? 'http://localhost:5173']",
    ],
  ])('is not found in %s', (_name, line) => {
    expect(find(line)).toEqual([])
  })

  it('names the file and line of each finding', () => {
    const found = hardCodedPorts('a/b.ts', 'ok\nvite --port 4800\nok')
    expect(found).toEqual([{ file: 'a/b.ts', line: 2, text: 'vite --port 4800' }])
  })

  it('leaves alone the file that defines the ports, and unit tests', () => {
    expect(isPortScanned('packages/tools/src/shared/ship/ports/free-ports.ts')).toBe(false)
    expect(isPortScanned('packages/tools/tests/unit/editor/editor-args.test.ts')).toBe(false)
    expect(isPortScanned('extensions/net-server/src/app/server-process.ts')).toBe(false)
    expect(isPortScanned('games/emberwick/playwright.config.ts')).toBe(true)
    expect(isPortScanned('examples/ui/primitives/package.json')).toBe(true)
    expect(isPortScanned('.github/workflows/ci.yml')).toBe(true)
  })
})

describe('a port worked out instead of claimed', () => {
  it.each([
    ['a derived port', 'export const gamePort: number = browserSafePort(ports.preview + 1100)'],
    [
      'an offset from the server port',
      'export const SITE_PORT = Number(process.env.QB_SITE_PORT ?? ports.server + 50)',
    ],
    [
      'the checkout’s pair',
      "const ports = portsFor(new URL('../..', import.meta.url).pathname, process.env)",
    ],
    ['a port next to the demo port', 'const port = demoPort + 200'],
    ['a slot above the preview port', 'export const stressPort: number = ports.preview + 200'],
    [
      'the helper import',
      "import { portsFor } from '../../packages/tools/src/shared/ship/ports/ports-for.ts'",
    ],
    ['the bad-port step', "import { browserSafePort } from './browser-safe-port.ts'"],
  ])('is found in %s', (_name, line) => {
    expect(find(line)).toEqual([line.trim()])
  })

  it.each([
    ['a claimed port', "const { game, editor } = claimPorts(['game', 'editor'])"],
    ['one claimed port', "const port = claimPort('editors-sample')"],
    ['an index', 'const next = ports.length + 1'],
    ['a plain sum', 'const total = width + 100'],
  ])('is not found in %s', (_name, line) => {
    expect(find(line)).toEqual([])
  })
})

describe('a server reused on CI', () => {
  it('is found when reuseExistingServer is always on', () => {
    expect(find('      reuseExistingServer: true,')).toEqual(['reuseExistingServer: true,'])
  })

  it.each([
    ['off', 'reuseExistingServer: false,'],
    ['on for a developer only', 'reuseExistingServer: process.env.CI === undefined,'],
    ['a variable', 'reuseExistingServer: reuse,'],
  ])('is not found when it is %s', (_name, line) => {
    expect(find(line)).toEqual([])
  })
})

describe('the repository', () => {
  it('starts no server on a port of its own', () => {
    const tracked = execFileSync('git', ['ls-files', '-z'], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 << 20,
    })
      .split('\0')
      .filter((file) => file !== '' && isPortScanned(file))
    const findings = tracked.flatMap((file) => hardCodedPorts(file, readFileSync(join(root, file), 'utf8')))
    expect(
      findings.map((finding) => `${finding.file}:${finding.line}: ${finding.text}`),
      'Claim the port with claimPort / claimPorts (packages/tools free-ports.ts), and reuse a server on a developer’s machine only',
    ).toEqual([])
  })
})
