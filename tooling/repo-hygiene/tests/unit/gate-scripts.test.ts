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

  it('is what `pnpm check` and `ci:local` run', () => {
    expect(scripts.check).toContain('pnpm test:unit:2d')
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
