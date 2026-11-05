import { describe, expect, it } from 'vitest'
import { prepareMode } from '#src/prepare/prepare-mode.ts'

// How each command prepares a build (M3 spec §4.8): who it is for, and whether ruken.toml is written.
describe('prepareMode', () => {
  it('prepares a public build with its manifest by default', () => {
    expect(prepareMode('prepare', {})).toEqual({ audience: 'public', writeManifest: true })
    expect(prepareMode('prepare', { audience: 'public' })).toEqual({
      audience: 'public',
      writeManifest: true,
    })
  })

  it('checks a private game without writing ruken.toml, so nothing can publish it raw', () => {
    expect(prepareMode('prepare', { audience: 'private' })).toEqual({
      audience: 'private',
      writeManifest: false,
    })
  })

  it('prepares deploy-dev privately with its manifest, whatever the config says', () => {
    expect(prepareMode('deploy-dev', {})).toEqual({ audience: 'private', writeManifest: true })
    expect(prepareMode('deploy-dev', { audience: 'private' })).toEqual({
      audience: 'private',
      writeManifest: true,
    })
  })
})
