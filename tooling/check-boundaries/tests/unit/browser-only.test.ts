import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { browserOnlyFindings } from '#src/browser-only.ts'

// Core and 2D refactor spec §3.5 and §4 (D2): nothing a browser entry reaches imports Effect, a Node built-in or a
// Node-only library. Type-only imports bring no code and do not count.

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function pkg(files: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(join(tmpdir(), 'af-browser-'))
  roots.push(root)
  for (const [name, code] of Object.entries(files)) {
    mkdirSync(dirname(join(root, 'src', name)), { recursive: true })
    writeFileSync(join(root, 'src', name), code)
  }
  return root
}

describe('browserOnlyFindings', () => {
  it('fails a file reachable from an entry that imports effect, naming the file and the reason', () => {
    const root = pkg({
      'entries/index.ts': "export { run } from '../app/run.ts'\n",
      'app/run.ts': "import { Effect } from 'effect'\nexport const run = Effect.void\n",
    })
    const { findings } = browserOnlyFindings(root)
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({
      file: join(root, 'src/app/run.ts'),
      line: 1,
      rule: 'browser-import',
    })
    expect(findings[0]?.message).toContain(
      `"${join(root, 'src/app/run.ts')}" runs in the browser and imports "effect". Effect is for Node tooling only (ADR 0003).`,
    )
  })

  it('passes the same import in a file no entry reaches', () => {
    const root = pkg({
      'entries/index.ts': "export { run } from '../app/run.ts'\n",
      'app/run.ts': 'export const run = 1\n',
      'app/node-only.ts': "import { Effect } from 'effect'\nexport const x = Effect.void\n",
    })
    expect(browserOnlyFindings(root).findings).toEqual([])
  })

  it('passes an `import type` from effect, which brings no code', () => {
    const root = pkg({
      'entries/index.ts': "export { run } from '../app/run.ts'\n",
      'app/run.ts':
        "import type { Effect } from 'effect'\nexport type Run = Effect.Effect<void>\nexport const run = 1\n",
    })
    expect(browserOnlyFindings(root).findings).toEqual([])
  })

  it.each([
    ["import { readFileSync } from 'node:fs'", 'node:fs', 'Node built-ins'],
    ["import fontkit from 'fontkit'", 'fontkit', 'Node'],
    ["const x = await import('effect')", 'effect', 'Effect is for Node tooling only'],
  ])('fails `%s` in a reachable file', (code, specifier, hint) => {
    const root = pkg({
      'entries/index.ts': "export * from '../app/a.ts'\n",
      'app/a.ts': `${code}\nexport const a = 1\n`,
    })
    const { findings } = browserOnlyFindings(root)
    expect(findings).toHaveLength(1)
    expect(findings[0]?.message).toContain(`imports "${specifier}"`)
    expect(findings[0]?.message).toContain(hint)
  })

  it('follows imports through several files', () => {
    const root = pkg({
      'entries/index.ts': "export { a } from '../app/a.ts'\n",
      'app/a.ts': "export { b } from '../shared/b.ts'\nexport const a = 1\n",
      'shared/b.ts': "import { Effect } from 'effect'\nexport const b = Effect.void\n",
    })
    expect(browserOnlyFindings(root).findings).toMatchObject([{ file: join(root, 'src/shared/b.ts') }])
  })

  it('reads only the named entries when asked (a package with a Node entry and browser-safe ones)', () => {
    const root = pkg({
      'entries/index.ts': "export { compile } from '../app/compile.ts'\n",
      'entries/locale.ts': "export { t } from '../app/t.ts'\n",
      'app/compile.ts': "import { Effect } from 'effect'\nexport const compile = Effect.void\n",
      'app/t.ts': 'export const t = 1\n',
    })
    expect(browserOnlyFindings(root, ['locale']).findings).toEqual([])
    expect(browserOnlyFindings(root).findings).toHaveLength(1)
  })

  it('says so when a named entry does not exist', () => {
    const root = pkg({ 'entries/index.ts': 'export {}\n' })
    expect(() => browserOnlyFindings(root, ['missing'])).toThrow(/entries\/missing\.ts/)
  })
})
