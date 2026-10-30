import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { plusManifests } from '../core/manifest-rules.ts'

// PRODUCT.5f: what `pnpm check` runs once Plus has packages. A Plus extension's sim is held to the framework's sim
// rules by the same checker the framework runs on its own sims (`automata-check-boundaries <roots>`), so every
// package that declares sim entries a game may import (`automata.simEntries`, P5-D2) has its `src` on the root
// `boundaries` run. `check` runs that, and each package's own typecheck and Node tests; the browser parity
// projects are separate (`test:parity`), as in the framework.

const root = fileURLToPath(new URL('../..', import.meta.url))
const scripts = (
  JSON.parse(readFileSync(`${root}package.json`, 'utf8')) as { scripts: Record<string, string> }
).scripts

const simPackages = plusManifests(root)
  .filter(({ manifest }) => {
    const automata = manifest.automata as { simEntries?: unknown } | undefined
    return Array.isArray(automata?.simEntries)
  })
  .map(({ path }) => path.replace(/\/package\.json$/, ''))

describe('the root scripts', () => {
  it('has at least one package with sim entries to check', () => {
    expect(simPackages).toContain('packages/physics')
  })

  it('runs the boundaries checker on the src of every package that declares sim entries', () => {
    const [bin, ...roots] = (scripts.boundaries ?? '').split(/\s+/)
    expect(bin).toBe('automata-check-boundaries')
    for (const dir of simPackages) expect(roots).toContain(`${dir}/src`)
  })

  it('makes check run lint, typecheck, boundaries and the tests', () => {
    expect(scripts.check?.split(' && ')).toEqual([
      'pnpm lint',
      'pnpm typecheck',
      'pnpm boundaries',
      'pnpm test',
    ])
  })

  it('makes typecheck and test reach every package', () => {
    expect(scripts.typecheck).toBe('tsc -p . && pnpm -r --if-present typecheck')
    expect(scripts.test).toBe('vitest run && pnpm -r --if-present test:unit')
    expect(scripts['test:parity']).toBe('pnpm -r --if-present test:parity')
  })
})
