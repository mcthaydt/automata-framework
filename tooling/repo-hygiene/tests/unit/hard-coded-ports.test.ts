import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { hardCodedPorts, isPortScanned } from '#src/hard-coded-ports.ts'

// Several runner copies share one machine, and each shifts the browser journeys' ports by its own AF_RUNNER_PORT_OFFSET
// (packages/tools portsFor). A server that names its own port ignores the offset, so two jobs meet on it and the second
// dies with "http://localhost:4800/ is already used". These tests hold every server in the repository to ports it takes
// from portsFor.

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
    expect(isPortScanned('packages/tools/src/shared/ship/ports/ports-for.ts')).toBe(false)
    expect(isPortScanned('packages/tools/src/shared/ship/ports/browser-safe-port.ts')).toBe(false)
    expect(isPortScanned('packages/tools/tests/unit/editor/editor-args.test.ts')).toBe(false)
    expect(isPortScanned('games/emberwick/playwright.config.ts')).toBe(true)
    expect(isPortScanned('examples/ui/primitives/package.json')).toBe(true)
    expect(isPortScanned('.github/workflows/ci.yml')).toBe(true)
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
      'Take the port from portsFor (packages/tools) or tooling/examples-runner/host/ports.ts, so AF_RUNNER_PORT_OFFSET moves it',
    ).toEqual([])
  })
})
