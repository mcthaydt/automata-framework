import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { build, type Plugin } from 'vite'
import { afterEach, describe, expect, it } from 'vitest'
import { copyFixture, fixtureOptions } from '../testing/fixture-game'
import { automataContent } from './automata-content'

// FR.3 (Plus DBG-D2): the plugin defines `__AUTOMATA_DEBUG__` for the game: true in the dev server and in a build made with
// AUTOMATA_DEBUG=1 (`automata build --debug`), false in a release build. A block a game guards with it is tree-shaken from a release
// bundle, which is what keeps a dev-only overlay (Plus's `debug`) out of what ships.

const MARKER = 'DEBUG_ONLY_MARKER_7f3a'
const saved = process.env.AUTOMATA_DEBUG
afterEach(() => {
  if (saved === undefined) delete process.env.AUTOMATA_DEBUG
  else process.env.AUTOMATA_DEBUG = saved
})

const options = (root: string) => {
  const { root: _root, ...rest } = fixtureOptions(root)
  return rest
}

type ConfigHook = (
  config: object,
  env: { command: 'build' | 'serve'; mode: string },
) => { define?: Record<string, string> } | undefined | null
const defineFor = (command: 'build' | 'serve'): string | undefined => {
  const plugin: Plugin = automataContent({ schemas: [] })
  const hook = plugin.config as unknown as ConfigHook
  return hook({}, { command, mode: command === 'serve' ? 'development' : 'production' })?.define
    ?.__AUTOMATA_DEBUG__
}

describe('the debug constant', () => {
  it('is true in the dev server, whatever the environment says', () => {
    delete process.env.AUTOMATA_DEBUG
    expect(defineFor('serve')).toBe('true')
  })

  it('is false in a build unless AUTOMATA_DEBUG=1', () => {
    delete process.env.AUTOMATA_DEBUG
    expect(defineFor('build')).toBe('false')
    process.env.AUTOMATA_DEBUG = '0'
    expect(defineFor('build')).toBe('false')
    process.env.AUTOMATA_DEBUG = '1'
    expect(defineFor('build')).toBe('true')
  })
})

/** The part of a build's result this test reads: each output file, with its code when it is a chunk. */
interface Bundle {
  readonly output: readonly { readonly code?: string }[]
}

async function bundleOf(debug: boolean): Promise<string> {
  if (debug) process.env.AUTOMATA_DEBUG = '1'
  else delete process.env.AUTOMATA_DEBUG
  const root = copyFixture('valid')
  writeFileSync(
    join(root, 'main.js'),
    `if (__AUTOMATA_DEBUG__) console.log('${MARKER}')\nconsole.log('game')\n`,
  )
  const output = await build({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [automataContent(options(root))],
    build: { write: false, minify: false, rolldownOptions: { input: join(root, 'main.js') } },
  })
  const result = output as unknown as Bundle | readonly Bundle[]
  const bundles: readonly Bundle[] = Array.isArray(result) ? result : [result as Bundle]
  return bundles.flatMap((b) => b.output.map((chunk) => chunk.code ?? '')).join('\n')
}

describe('a built bundle', () => {
  it('drops a debug-guarded block in a release build, and keeps the game', async () => {
    const code = await bundleOf(false)
    expect(code).not.toContain(MARKER)
    expect(code).toContain('game')
  }, 90_000)

  it('keeps it in a build made with AUTOMATA_DEBUG=1 (automata build --debug)', async () => {
    expect(await bundleOf(true)).toContain(MARKER)
  }, 90_000)
})
