import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { entryPoints, MissingTypesError } from './entry-points.ts'

const repo = fileURLToPath(new URL('../fixtures/repo', import.meta.url))
const unbuilt = fileURLToPath(new URL('../fixtures/unbuilt', import.meta.url))

describe('entryPoints', () => {
  it("lists each published package's typed entry points, skipping private packages, bins and untyped keys", () => {
    expect(
      entryPoints(repo).map(({ package: name, entryPoint, version }) => ({ name, entryPoint, version })),
    ).toEqual([
      { name: '@fixture/alpha', entryPoint: '.', version: '1.2.3' },
      { name: '@fixture/alpha', entryPoint: './sub', version: '1.2.3' },
    ])
  })

  it('points at the emitted .d.ts', () => {
    expect(entryPoints(repo)[1]?.typesFile).toBe(`${repo}/packages/alpha/types/sub.d.ts`)
  })

  it('fails when a types file is missing, since the index is built from emitted .d.ts after pnpm build', () => {
    expect(() => entryPoints(unbuilt)).toThrow(MissingTypesError)
    expect(() => entryPoints(unbuilt)).toThrow(/@fixture\/beta.*types\/index\.d\.ts.*pnpm build/)
  })
})
