// The figure builder is reached through one file (src/features/painted/door.ts) and nowhere else, so an upstream refactor
// breaks that file only: no other source or test file of the kit imports `figure-builder`.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '../../..')
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : path.endsWith('.ts') ? [path] : []
  })
const IMPORTS =
  /\bfrom\s+['"]figure-builder(?:\/[^'"]*)?['"]|\bimport\s*\(\s*['"]figure-builder|\bimport\s+['"]figure-builder/

describe('the door', () => {
  it('is the only file that imports the figure builder', () => {
    const importers = [...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'tests'))]
      .filter((file) => IMPORTS.test(readFileSync(file, 'utf8')))
      .map((file) => relative(ROOT, file))
    expect(importers).toEqual(['src/features/painted/door.ts'])
  })
})
