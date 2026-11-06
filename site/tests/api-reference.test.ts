import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { parseApiReference, writeApiReference } from '../scripts/api-reference'
import { searchApi } from '../src/lib/api-reference'

// M10.4: the complete generated reference as pages, one JSON per published version. Parsed from llms-api.txt, so the pages and the
// plain-text file cannot disagree (the file's digest is in api-index.json).
const SAMPLE = `# Automata API reference, version 1.2.3

> Every export.

## \`@mcthaydt/automata-sim\`

### \`import { … } from '@mcthaydt/automata-sim'\`

#### \`createSim\` (function)

Creates a simulation.
Second line.

\`\`\`ts
function createSim(options: SimOptions): Promise<Sim>
\`\`\`

#### \`Sim\` (interface)

A running simulation.

\`\`\`ts
interface Sim {
  step(): void
}
\`\`\`

### \`import { … } from '@mcthaydt/automata-sim/math'\`

#### \`clamp\` (function)

\`\`\`ts
function clamp(x: number): number
\`\`\`
`
const temps: string[] = []
afterEach(() => { for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true }) })

describe('parseApiReference', () => {
  it('reads the version, each package, its entry points and every export with its kind, doc and signature', () => {
    const reference = parseApiReference(SAMPLE, 'abc')
    expect(reference.version).toBe('1.2.3')
    expect(reference.commit).toBe('abc')
    expect(reference.packages).toHaveLength(1)
    const [pkg] = reference.packages
    expect(pkg).toMatchObject({ name: '@mcthaydt/automata-sim', slug: 'automata-sim' })
    expect(pkg.entryPoints.map((e) => e.path)).toEqual(['@mcthaydt/automata-sim', '@mcthaydt/automata-sim/math'])
    expect(pkg.entryPoints[0].entries.map((e) => [e.name, e.kind])).toEqual([['createSim', 'function'], ['Sim', 'interface']])
    expect(pkg.entryPoints[0].entries[0].doc).toBe('Creates a simulation.\nSecond line.')
    expect(pkg.entryPoints[0].entries[0].signature).toBe('function createSim(options: SimOptions): Promise<Sim>')
    expect(pkg.entryPoints[1].entries[0]).toMatchObject({ name: 'clamp', doc: '' })
  })

  it('refuses a file with no version line or an export outside an entry point', () => {
    expect(() => parseApiReference('# Something else\n', 'abc')).toThrow(/version/)
    expect(() => parseApiReference('# Automata API reference, version 1.0.0\n\n#### `x` (function)\n', 'abc')).toThrow(/entry point/)
  })

  it('parses the published reference: as many exports as api-index.json counts', () => {
    const published = parseApiReference(readFileSync('static/llms-api.txt', 'utf8'), 'x')
    const count = published.packages.flatMap((p) => p.entryPoints).reduce((n, e) => n + e.entries.length, 0)
    expect(count).toBe(JSON.parse(readFileSync('src/data/api-index.json', 'utf8')).exports)
    for (const pkg of published.packages) for (const e of pkg.entryPoints.flatMap((x) => x.entries)) expect(e.signature, e.name).not.toBe('')
  })
})

describe('writeApiReference', () => {
  it('writes the reference and a small search list for its version', () => {
    const site = mkdtempSync(join(tmpdir(), 'api-ref-'))
    temps.push(site)
    mkdirSync(join(site, 'src/data'), { recursive: true })
    const reference = writeApiReference(SAMPLE, 'abc', site)
    expect(reference.version).toBe('1.2.3')
    const search = JSON.parse(readFileSync(join(site, 'src/data/api-search/1.2.3.json'), 'utf8'))
    expect(search[0]).toEqual({ name: 'createSim', kind: 'function', package: 'automata-sim', summary: 'Creates a simulation.' })
    expect(JSON.parse(readFileSync(join(site, 'src/data/api-reference/1.2.3.json'), 'utf8')).packages[0].slug).toBe('automata-sim')
  })
})

describe('searchApi', () => {
  const list = [
    { name: 'createSim', kind: 'function', package: 'automata-sim', summary: 'Creates a simulation.' },
    { name: 'Sim', kind: 'interface', package: 'automata-sim', summary: 'A running simulation.' },
    { name: 'clamp', kind: 'function', package: 'automata-sim', summary: 'Limits a number.' },
  ]
  it('matches every word against the name and the summary, best name first, and caps the results', () => {
    expect(searchApi(list, 'sim').map((r) => r.name)).toEqual(['Sim', 'createSim'])
    expect(searchApi(list, 'number limits').map((r) => r.name)).toEqual(['clamp'])
    expect(searchApi(list, 'sim', 1)).toHaveLength(1)
    expect(searchApi(list, '   ')).toEqual([])
  })
})
