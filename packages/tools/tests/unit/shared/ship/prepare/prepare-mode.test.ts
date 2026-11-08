import { describe, expect, it } from 'vitest'
import { prepareMode } from '#src/shared/ship/prepare/prepare-mode.ts'

// How `prepare` readies a build: who it is for, and whether ruken.toml is written.
describe('prepareMode', () => {
  it('prepares a public build with its manifest by default', () => {
    expect(prepareMode({})).toEqual({ audience: 'public', writeManifest: true })
    expect(prepareMode({ audience: 'public' })).toEqual({ audience: 'public', writeManifest: true })
  })

  it('checks a private game without writing ruken.toml, so nothing can publish it raw', () => {
    expect(prepareMode({ audience: 'private' })).toEqual({ audience: 'private', writeManifest: false })
  })
})
