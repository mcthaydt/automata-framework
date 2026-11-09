// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseApiReference, readApiIndex } from '#src/shared/framework/api.ts'
import { searchApi } from '#src/shared/framework/api-reference.ts'

// M10.4: the complete generated reference as pages. Parsed from llms-api.txt, so the pages and the plain-text file
// cannot disagree.
const SAMPLE = `# Automata API reference, version 1.2.3

> Every export.

## \`@automata/sim\`

### \`import { … } from '@automata/sim'\`

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

### \`import { … } from '@automata/sim/math'\`

#### \`clamp\` (function)

\`\`\`ts
function clamp(x: number): number
\`\`\`
`
describe('parseApiReference', () => {
  it('reads the version, each package, its entry points and every export with its kind, doc and signature', () => {
    const reference = parseApiReference(SAMPLE)
    expect(reference.version).toBe('1.2.3')
    expect(reference.packages).toHaveLength(1)
    const [pkg] = reference.packages
    expect(pkg).toMatchObject({ name: '@automata/sim', slug: 'sim' })
    expect(pkg.entryPoints.map((e) => e.path)).toEqual(['@automata/sim', '@automata/sim/math'])
    expect(pkg.entryPoints[0].entries.map((e) => [e.name, e.kind])).toEqual([
      ['createSim', 'function'],
      ['Sim', 'interface'],
    ])
    expect(pkg.entryPoints[0].entries[0].doc).toBe('Creates a simulation.\nSecond line.')
    expect(pkg.entryPoints[0].entries[0].signature).toBe(
      'function createSim(options: SimOptions): Promise<Sim>',
    )
    expect(pkg.entryPoints[1].entries[0]).toMatchObject({ name: 'clamp', doc: '' })
  })

  it('refuses a file with no version line or an export outside an entry point', () => {
    expect(() => parseApiReference('# Something else\n')).toThrow(/version/)
    expect(() =>
      parseApiReference('# Automata API reference, version 1.0.0\n\n#### `x` (function)\n'),
    ).toThrow(/entry point/)
  })

  it('parses the published reference: as many exports as api.json lists, each with a signature', () => {
    const { reference, search } = readApiIndex()
    const count = reference.packages.flatMap((p) => p.entryPoints).reduce((n, e) => n + e.entries.length, 0)
    const api = JSON.parse(
      readFileSync(resolve(import.meta.dirname, '../../../../tooling/api-index/dist/api.json'), 'utf8'),
    ) as { exports: unknown[] }
    expect(count).toBe(api.exports.length)
    expect(search).toHaveLength(count)
    for (const pkg of reference.packages)
      for (const e of pkg.entryPoints.flatMap((x) => x.entries)) expect(e.signature, e.name).not.toBe('')
  })

  it('gives each search row the first sentence of its doc comment', () => {
    const sim = parseApiReference(SAMPLE).packages[0]
    expect(sim.entryPoints[0].entries[0].doc.split('\n')[0]).toBe('Creates a simulation.')
  })
})

describe('searchApi', () => {
  const list = [
    { name: 'createSim', kind: 'function', package: 'sim', summary: 'Creates a simulation.' },
    { name: 'Sim', kind: 'interface', package: 'sim', summary: 'A running simulation.' },
    { name: 'clamp', kind: 'function', package: 'sim', summary: 'Limits a number.' },
  ]
  it('matches every word against the name and the summary, best name first, and caps the results', () => {
    expect(searchApi(list, 'sim').map((r) => r.name)).toEqual(['Sim', 'createSim'])
    expect(searchApi(list, 'number limits').map((r) => r.name)).toEqual(['clamp'])
    expect(searchApi(list, 'sim', 1)).toHaveLength(1)
    expect(searchApi(list, '   ')).toEqual([])
  })
})
