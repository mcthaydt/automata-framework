// The browser-safe entries: what a game's page (and the packages it loads, such as figures and @automata/3d) may
// import from content without Node. The root entry is the compiler and reaches `node:fs/promises`; in Vite's dev
// server that throws at boot (a production build tree-shakes it away, so only `vite dev` showed a blank page). So
// each browser entry's whole import graph, not just its own file, must stay clear of Node built-ins.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const packageDir = resolve(import.meta.dirname, '../../..')
const manifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'))
const tsdown = readFileSync(join(packageDir, 'tsdown.config.ts'), 'utf8')

/** Every module specifier a file imports or re-exports for its value (type-only ones are erased). */
function valueImports(file: string): string[] {
  const source = readFileSync(file, 'utf8')
  const found: string[] = []
  for (const m of source.matchAll(/^(import|export)\s+(type\s+)?[^'"]*?from\s+'([^']+)'/gm))
    if (m[2] === undefined) found.push(m[3] as string)
  return found
}

/** The relative module `spec` names from `file`, as a source path. */
function resolveLocal(file: string, spec: string): string {
  const base = resolve(dirname(file), spec)
  for (const candidate of [base, `${base}.ts`, base.replace(/\.js$/, '.ts'), join(base, 'index.ts')])
    if (existsSync(candidate) && candidate.endsWith('.ts')) return candidate
  throw new Error(`cannot resolve ${spec} from ${file}`)
}

/** The bare specifiers (packages and built-ins) the entry's whole graph imports for its value. */
function externalsOf(entry: string): string[] {
  const seen = new Set<string>()
  const externals = new Set<string>()
  const walk = (file: string) => {
    if (seen.has(file)) return
    seen.add(file)
    for (const spec of valueImports(file))
      if (spec.startsWith('.')) walk(resolveLocal(file, spec))
      else externals.add(spec)
  }
  walk(join(packageDir, entry))
  return [...externals].sort()
}

const BROWSER_ENTRIES = {
  './level-2d': { source: './src/entries/level-2d.ts', build: 'level-2d' },
  './palette': { source: './src/entries/palette.ts', build: 'palette' },
  './schema': { source: './src/entries/schema.ts', build: 'schema' },
} as const

describe('the browser-safe entries', () => {
  for (const [entry, { source, build }] of Object.entries(BROWSER_ENTRIES))
    it(`${entry}: exported from the source, the published build and the build config, and Node-free`, () => {
      expect(manifest.exports[entry]).toBe(source)
      expect(manifest.publishConfig.exports[entry]).toEqual({
        types: `./dist/${build}.d.ts`,
        import: `./dist/${build}.js`,
      })
      expect(tsdown).toMatch(new RegExp(`['"]?${build}['"]?: '${source.slice(2)}'`))
      for (const external of externalsOf(source))
        expect(external, `${entry} imports ${external}`).not.toMatch(/^node:/)
    })

  it('./schema serves what schemas need in the browser: defineContentSchema, contentRef and localized, and only zod', async () => {
    const schema = await import('#src/entries/schema.ts')
    expect(Object.keys(schema).sort()).toEqual(['contentRef', 'defineContentSchema', 'localized'])
    expect(externalsOf(BROWSER_ENTRIES['./schema'].source)).toEqual(['zod'])
  })

  it("./level-2d imports only zod, so a game's sim may use it", () => {
    expect(externalsOf(BROWSER_ENTRIES['./level-2d'].source)).toEqual(['zod'])
  })

  it('./palette serves the default palette, DUEL', async () => {
    const { DEFAULT_PALETTE } = await import('#src/entries/palette.ts')
    expect(DEFAULT_PALETTE.name).toBe('DUEL')
    expect(DEFAULT_PALETTE.colors[45]).toBe('#96b2d9')
  })

  it('the root entry is the compiler and does reach Node (why the browser entries exist)', () => {
    expect(externalsOf('./src/entries/index.ts')).toContain('node:fs/promises')
  })
})
