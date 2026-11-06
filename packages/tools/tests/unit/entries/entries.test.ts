import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as published from '#src/entries/index.ts'
import * as internal from '#src/entries/internal.ts'

// What a game author can import from `@mcthaydt/automata-tools` is one function; everything this repository's own
// tooling needs is in `./internal`, which is not published.

const pkg = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')) as {
  exports: Record<string, string>
  publishConfig: { exports: Record<string, unknown>; bin: Record<string, string> }
  bin: Record<string, string>
}

describe('the published entry', () => {
  it('holds defineShipConfig and nothing else at run time', () => {
    expect(Object.keys(published)).toEqual(['defineShipConfig'])
  })

  it('publishes only the root entry, and the bin', () => {
    expect(Object.keys(pkg.publishConfig.exports)).toEqual(['.'])
    expect(Object.keys(pkg.publishConfig.bin)).toEqual(['automata'])
  })

  it('keeps ./internal and ./e2e for the workspace only', () => {
    expect(pkg.exports['./internal']).toBe('./src/entries/internal.ts')
    expect(pkg.exports['./e2e']).toBe('./src/entries/e2e.ts')
  })
})

describe('the internal entry', () => {
  it('holds what the repository’s tooling imports', () => {
    for (const name of [
      'rukenHeaders',
      'checkManifest',
      'inputsProblems',
      'rukenToml',
      'findPixi3d',
      'prepareBuild',
    ]) {
      expect(internal, name).toHaveProperty(name)
    }
  })
})
