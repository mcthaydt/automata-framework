// The bins' resolve hook (SB-D6): below a `.ts` module, an extensionless relative or `file:` import is a TypeScript
// source, `<specifier>.ts` or `<specifier>/index.ts`; everything else is Node's own resolution.
import { describe, expect, it } from 'vitest'
import { loadTs, resolveTs } from './ts-resolve.ts'

const FROM_TS = {
  conditions: [],
  importAttributes: {},
  parentURL: 'file:///w/packages/systems/src/bots/index.ts',
}
const FROM_JS = { ...FROM_TS, parentURL: 'file:///w/node_modules/zod/index.js' }

/** A fake `nextResolve` that knows only `files`, and records what it was asked. */
function node(files: readonly string[]) {
  const asked: string[] = []
  const next = (specifier: string, context?: { parentURL?: string | undefined }) => {
    asked.push(specifier)
    const url = new URL(specifier, context?.parentURL ?? 'file:///').href
    if (specifier.startsWith('.') || specifier.startsWith('file:')) {
      if (!files.includes(url))
        throw Object.assign(new Error(`Cannot find module '${url}'`), { code: 'ERR_MODULE_NOT_FOUND' })
      return { url, shortCircuit: true }
    }
    return { url: `node:${specifier}`, shortCircuit: true }
  }
  return { asked, next }
}

describe('resolveTs', () => {
  it('resolves an extensionless relative import below a .ts module to its .ts file', () => {
    const { next } = node(['file:///w/packages/systems/src/bots/bot.ts'])
    expect(resolveTs('./bot', FROM_TS, next).url).toBe('file:///w/packages/systems/src/bots/bot.ts')
  })

  it('then to the folder’s index.ts, and a file: URL the same way', () => {
    const { next } = node(['file:///w/packages/systems/src/sim/index.ts'])
    expect(resolveTs('../sim', FROM_TS, next).url).toBe('file:///w/packages/systems/src/sim/index.ts')
    expect(resolveTs('file:///w/packages/systems/src/sim', FROM_TS, next).url).toBe(
      'file:///w/packages/systems/src/sim/index.ts',
    )
  })

  it('gives Node’s own error when neither exists', () => {
    const { next } = node([])
    expect(() => resolveTs('./missing', FROM_TS, next)).toThrow(
      /Cannot find module 'file:\/\/\/w\/packages\/systems\/src\/bots\/missing'/,
    )
  })

  it('leaves bare, extensioned and from-JavaScript imports to Node alone', () => {
    const { asked, next } = node(['file:///w/packages/systems/src/bots/bot.ts'])
    resolveTs('zod', FROM_TS, next)
    resolveTs('./bot.ts', FROM_TS, next)
    expect(() => resolveTs('./fixtures/boxes.toml?raw', FROM_TS, next)).toThrow()
    expect(() => resolveTs('./v4', FROM_JS, next)).toThrow()
    expect(asked).toEqual(['zod', './bot.ts', './fixtures/boxes.toml?raw', './v4'])
  })
})

describe('loadTs', () => {
  const read = (path: string): string => {
    if (path !== '/w/node_modules/@x/fmt/src/index.ts') throw new Error(`unexpected read ${path}`)
    return 'export const n: number = 1\n'
  }
  const next = (url: string) => ({ format: 'native' as const, source: url, shortCircuit: true })

  it('strips a .ts source under node_modules itself, as a module', () => {
    const out = loadTs('file:///w/node_modules/@x/fmt/src/index.ts', {}, next, read)
    expect(out.format).toBe('module')
    expect(String(out.source)).toMatch(/^export const n\s*= 1/)
  })

  it('loads a `?raw` import as its file’s text, the default export (Vite’s convention)', () => {
    const raw = (path: string): string => {
      if (path !== '/w/packages/sectors/src/testing/fixtures/clinic.sector-map.toml')
        throw new Error(`unexpected read ${path}`)
      return 'id = "hall"\n'
    }
    const out = loadTs(
      'file:///w/packages/sectors/src/testing/fixtures/clinic.sector-map.toml?raw',
      {},
      next,
      raw,
    )
    expect(out).toEqual({
      format: 'module',
      source: 'export default "id = \\"hall\\"\\n"\n',
      shortCircuit: true,
    })
  })

  it('leaves every other module to Node', () => {
    expect(loadTs('file:///w/packages/systems/src/bots/bot.ts', {}, next, read).source).toBe(
      'file:///w/packages/systems/src/bots/bot.ts',
    )
    expect(loadTs('file:///w/node_modules/zod/index.js', {}, next, read).source).toBe(
      'file:///w/node_modules/zod/index.js',
    )
  })
})
