// The browser-safe `./palette` entry (base-3d art direction spec §3.3): a game page reads the default palette from it
// without bundling the compiler, so both reference games name Endesga 64's entries from one source.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_PALETTE } from './index'

const manifest = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))

describe('the palette entry', () => {
  it('serves the default palette, Endesga 64', () => {
    expect(DEFAULT_PALETTE.name).toBe('Endesga 64')
    expect(DEFAULT_PALETTE.colors[45]).toBe('#94fdff')
  })

  it('is exported from the workspace source, the published build and the build config', () => {
    expect(manifest.exports['./palette']).toBe('./src/palette/index.ts')
    expect(manifest.publishConfig.exports['./palette']).toEqual({
      types: './dist/palette.d.ts',
      import: './dist/palette.js',
    })
    expect(readFileSync(new URL('../../tsdown.config.ts', import.meta.url), 'utf8')).toContain(
      "palette: 'src/palette/index.ts'",
    )
  })

  it('imports nothing but the palette itself (no compiler, no Node built-ins)', () => {
    const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8')
    const imports = [...source.matchAll(/from '([^']+)'/g)].map((m) => m[1])
    expect(imports).toEqual(['./palette'])
  })
})
