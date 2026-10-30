import { join } from 'node:path'
import { resolveConfig } from 'vite'
import { describe, expect, it } from 'vitest'

const root = join(import.meta.dirname, '..')

describe('vite.config.ts', () => {
  // Vite would inline an asset under 4 kB as a `data:` URL, which Pixi's loader fetches and Ruken's CSP
  // (`connect-src` has no `data:`) refuses, so the asset would never load (DX.5a; `automata check`'s data-urls step).
  it('emits every asset as a file, so none becomes a data: URL the CSP refuses to fetch', async () => {
    const config = await resolveConfig(
      { root, configFile: join(root, 'vite.config.ts'), logLevel: 'silent' },
      'build',
    )
    expect(config.build.assetsInlineLimit).toBe(0)
  })
})
