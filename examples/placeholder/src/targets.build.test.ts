import { fileURLToPath } from 'node:url'
import { findRukenSdkMarkers, RUKEN_SDK_MARKERS } from '@mcthaydt/automata-host'
import { build, type Rolldown } from 'vite'
import { describe, expect, it } from 'vitest'

// PUB spec §7 (build row): one game, two targets. `pnpm build` (Ruken) keeps the SDK; `pnpm build:itch`
// (vite.config.ts, mode `itch`) holds the web adapter and none of the SDK's code.
const placeholder = fileURLToPath(new URL('..', import.meta.url))

/** All the JavaScript of a production build of the placeholder, in `mode`, with its own vite.config.ts. */
async function bundle(mode: 'production' | 'itch'): Promise<string> {
  const output = await build({ root: placeholder, mode, logLevel: 'silent', build: { write: false } })
  const results = (Array.isArray(output) ? output : [output]) as Rolldown.RolldownOutput[]
  return results
    .flatMap((result) => result.output)
    .flatMap((file) => (file.type === 'chunk' ? [file.code] : []))
    .join('\n')
}

describe('the placeholder built for each target', () => {
  it('an itch build has no Ruken SDK code and names itch.io as its host', async () => {
    const code = await bundle('itch')
    expect(findRukenSdkMarkers(code)).toEqual([])
    expect(code).toContain('itch.io')
  }, 60_000)

  it('a Ruken build still holds the SDK', async () => {
    expect(findRukenSdkMarkers(await bundle('production'))).toEqual(RUKEN_SDK_MARKERS)
  }, 60_000)
})
