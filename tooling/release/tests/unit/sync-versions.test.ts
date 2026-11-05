import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { syncSimVersion } from '#src/sync-versions.ts'

function repo(version: string, source?: string): string {
  const root = mkdtempSync(join(tmpdir(), 'af-sync-'))
  mkdirSync(join(root, 'packages/sim/src'), { recursive: true })
  writeFileSync(join(root, 'packages/sim/package.json'), JSON.stringify({ name: 'x', version }))
  if (source !== undefined) writeFileSync(join(root, 'packages/sim/src/version.ts'), source)
  return root
}
const read = (root: string) => readFileSync(join(root, 'packages/sim/src/version.ts'), 'utf8')

describe('syncSimVersion (after changeset version)', () => {
  it("rewrites SIM_VERSION to sim's package.json version, keeping the rest of the file", () => {
    const root = repo(
      '0.0.2',
      "// header\nexport const SIM_VERSION: string = '0.0.1'\nexport const OTHER = 1\n",
    )
    expect(syncSimVersion(root)).toBe('updated')
    expect(read(root)).toBe("// header\nexport const SIM_VERSION: string = '0.0.2'\nexport const OTHER = 1\n")
  })

  it('is idempotent', () => {
    const root = repo('0.0.2', "export const SIM_VERSION = '0.0.2'\n")
    expect(syncSimVersion(root)).toBe('unchanged')
    expect(read(root)).toBe("export const SIM_VERSION = '0.0.2'\n")
  })

  it('does nothing until sim has a version.ts (M2.3 adds it)', () => {
    expect(syncSimVersion(repo('0.0.2'))).toBe('no-version-file')
  })

  it('fails when version.ts has no SIM_VERSION to rewrite', () => {
    expect(() => syncSimVersion(repo('0.0.2', 'export const X = 1\n'))).toThrow(/SIM_VERSION/)
  })
})
