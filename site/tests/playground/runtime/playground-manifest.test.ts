// @vitest-environment node
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { playgroundManifest } from '../../../playground/src/playground-manifest.ts'

const COMMIT = 'b'.repeat(40)
const bytes = (text: string) => new TextEncoder().encode(text)
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex')

describe('playgroundManifest', () => {
  it('lists every file, sorted by path, with its bytes and sha256, and every bundled package with its licence', () => {
    const manifest = playgroundManifest({
      framework: COMMIT,
      siteOrigin: 'https://automata.example',
      files: [
        { path: 'runtime/zod-1.js', bytes: bytes('export const z = 1\n') },
        { path: 'catalog.json', bytes: bytes('[]') },
      ],
      packages: [
        { name: 'zod', version: '4.6.6', licence: 'MIT' },
        { name: 'koota', version: '0.6.6', licence: 'ISC' },
      ],
    })
    expect(manifest).toEqual({
      framework: COMMIT,
      siteOrigin: 'https://automata.example',
      files: [
        { path: 'catalog.json', bytes: 2, sha256: sha256('[]') },
        { path: 'runtime/zod-1.js', bytes: 19, sha256: sha256('export const z = 1\n') },
      ],
      packages: [
        { name: 'koota', version: '0.6.6', licence: 'ISC' },
        { name: 'zod', version: '4.6.6', licence: 'MIT' },
      ],
    })
  })

  it('refuses a bundled package that declares no licence, so the site never types one by hand', () => {
    expect(() =>
      playgroundManifest({
        framework: COMMIT,
        siteOrigin: 'https://automata.example',
        files: [],
        packages: [{ name: '@ruken/sdk-host', version: '0.0.0', licence: undefined }],
      }),
    ).toThrow(/@ruken\/sdk-host.*licence/)
  })
})
