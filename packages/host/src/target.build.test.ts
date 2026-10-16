import { fileURLToPath } from 'node:url'
import { build, defaultClientConditions, type Rolldown } from 'vite'
import { describe, expect, it } from 'vitest'
import { WEB_STORAGE_PROBE_KEY } from './hosting-web'
import { findRukenSdkMarkers, RUKEN_SDK_MARKERS } from './sdk-markers'

// PUB spec §3 and §7 (build row): `./target` puts exactly one adapter in a bundle. The entry imports the host as
// the runtime's boot does; Vite builds it the way PUB.2's `--target` will, from the workspace sources.
const fixture = fileURLToPath(new URL('./testing/fixtures/target-bundle/', import.meta.url))

/** All the JavaScript of a production build of the fixture, optionally with the `automata-web` condition. */
async function bundle(target: 'ruken' | 'web' | 'itch'): Promise<string> {
  const output = await build({
    root: fixture,
    configFile: false,
    logLevel: 'silent',
    // `resolve.conditions` replaces Vite's defaults, so a target build adds its condition in front of them.
    resolve: target === 'ruken' ? {} : { conditions: ['automata-web', ...defaultClientConditions] },
    // What PUB.2's build sets for an itch build; only `hostName` reads it.
    define: target === 'itch' ? { __AUTOMATA_TARGET__: JSON.stringify('itch') } : {},
    build: {
      write: false,
      minify: true,
      rolldownOptions: { input: `${fixture}entry.ts` },
    },
  })
  const results = (Array.isArray(output) ? output : [output]) as Rolldown.RolldownOutput[]
  return results
    .flatMap((result) => result.output)
    .flatMap((file) => (file.type === 'chunk' ? [file.code] : []))
    .join('\n')
}

/**
 * A string Effect's stream machinery keeps through minification: the channel executor's state type id
 * (`Symbol.for("effect/ChannelState")`), which running any Stream needs. (`effect/Stream` itself is no marker:
 * every Effect carries that type id.)
 * A game that never subscribes to a host value must not carry Stream code (S8 budgets E1/E3,
 * docs/spikes/s8-effect.md): `Observed` is plain callbacks, and only `changes()` builds a Stream.
 */
const STREAM_MARKER = 'effect/ChannelState'

describe('the ./target export in a real bundle (PUB spec §3)', () => {
  it.each(['ruken', 'web'] as const)(
    'a %s game that reads host values but never subscribes carries no Stream code',
    async (target) => {
      expect(await bundle(target)).not.toContain(STREAM_MARKER)
    },
    60_000,
  )

  it('an automata-web build holds the web adapter and no Ruken SDK code', async () => {
    const code = await bundle('web')
    expect(findRukenSdkMarkers(code)).toEqual([])
    expect(code).not.toContain('RukenError')
    expect(code).toContain(WEB_STORAGE_PROBE_KEY)
  }, 60_000)

  it('an itch build is the web adapter with the build target filled in', async () => {
    const code = await bundle('itch')
    expect(findRukenSdkMarkers(code)).toEqual([])
    expect(code).not.toContain('__AUTOMATA_TARGET__')
    expect(code).toContain('itch.io')
  }, 60_000)

  it('a default build still holds the Ruken SDK, and not the web adapter', async () => {
    const code = await bundle('ruken')
    expect(findRukenSdkMarkers(code)).toEqual(RUKEN_SDK_MARKERS)
    expect(code).not.toContain(WEB_STORAGE_PROBE_KEY)
  }, 60_000)
})
