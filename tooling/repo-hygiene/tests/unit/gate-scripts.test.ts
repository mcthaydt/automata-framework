import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// The 2D gate (`pnpm check`, the pull request's browser job) has to see the 2D editors, and the 3D gate only the
// 3D packages. Before the 2D editors joined the gate, one filter (`!./packages/editor-*`) left every editor out of
// both, and nothing noticed that the editors' tests ran in no pull request job. This test pins the split.

const root = fileURLToPath(new URL('../../../..', import.meta.url))
const scripts = (
  JSON.parse(readFileSync(`${root}package.json`, 'utf8')) as { scripts: Record<string, string> }
).scripts

/** The packages a turbo script leaves out (`--filter='!<x>'`) and the ones it keeps (`--filter='<x>'`). */
function filters(script: string): { readonly excluded: string[]; readonly included: string[] } {
  const all = [...script.matchAll(/--filter='([^']+)'/g)].map((match) => match[1] as string)
  return {
    excluded: all.filter((filter) => filter.startsWith('!')).map((filter) => filter.slice(1)),
    included: all.filter((filter) => !filter.startsWith('!')),
  }
}

const GATES_2D = ['test:unit:2d', 'test:browser:2d', 'test:browser:affected']
const GATES_3D = ['test:unit:3d', 'test:browser:3d', 'test:journeys:3d']

describe('the 2D gate', () => {
  it.each(GATES_2D)('%s keeps the 2D editors in', (name) => {
    const script = scripts[name]
    expect(script, `${name} exists`).toBeDefined()
    const { excluded } = filters(script as string)
    // `editor-*` would drop `editor` with the 3D editor.
    expect(excluded).not.toContain('./packages/editor-*')
    expect(excluded).toContain('./packages/editor-3d')
    expect(excluded).not.toContain('./packages/editor')
  })

  it('has no gate named for the old "core" split', () => {
    expect(Object.keys(scripts).filter((name) => /:core$/.test(name))).toEqual([])
  })

  it('is what `ci:local` runs for the browser suites', () => {
    expect(scripts['ci:local']).toContain('pnpm test:browser:2d')
  })
})

describe('the 3D gate', () => {
  it.each(GATES_3D)('%s holds only the 3D editors, not the 2D ones', (name) => {
    const script = scripts[name]
    expect(script, `${name} exists`).toBeDefined()
    const { included } = filters(script as string)
    expect(included).toContain('./packages/editor-3d')
    expect(included).not.toContain('./packages/editor')
    expect(included).not.toContain('./packages/editor-*')
  })
})

/** A workflow file's text, for the invariants that are about what a job runs. */
function readWorkflow(name: string): string {
  return readFileSync(`${root}.github/workflows/${name}`, 'utf8')
}

// 3D is part of the product, so its unit tests are part of the gate (Owner, 2026-11-07: "we're on 3D now, so 3D tests
// MUST run"). The browser suites and journeys stay in their own jobs, which `ci:local` runs by name.
describe('every unit test is in the gate', () => {
  it('check runs every unit test', () => {
    expect(scripts.check).toContain('pnpm test:unit &&')
    expect(scripts.check).not.toContain('test:unit:2d')
  })

  it('the hosted core job runs every unit test', () => {
    expect(readWorkflow('ci.yml')).toMatch(/run: pnpm test:unit\n/)
  })

  it('ci:local runs the 3D browser suites and journeys', () => {
    expect(scripts['ci:local']).toContain('pnpm test:browser:3d')
    expect(scripts['ci:local']).toContain('pnpm test:journeys:3d')
    expect(scripts['ci:local']).toContain('--filter @af-games/base-3d')
    expect(scripts['ci:local']).toContain('--filter @af-examples/examples-3d')
  })
})

// Slow browser runs on a shared runner time out in setup when three packages start at once, so every browser script runs
// two at a time and gives a hook 90 s (the fix first made in a separate pull request, now carried here).
describe('the browser scripts', () => {
  it.each(Object.entries(scripts).filter(([name]) => name.startsWith('test:browser')))(
    '%s runs two at a time with a 90 s hook timeout',
    (_name, line) => {
      expect(line).toContain('--concurrency=2')
      expect(line).toContain('--hookTimeout=90000')
    },
  )
})
