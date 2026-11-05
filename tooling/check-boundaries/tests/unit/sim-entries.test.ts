import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { simEntryVerdict } from '#src/sim-entries.ts'

// P5-D2: an extension declares which of its entries a game's sim may import, in its own package.json
// (`"automata": { "simEntries": ["./2d"] }`). The checker finds the package the way Node does, by walking up
// from the file being checked to the nearest node_modules that holds it.
const folders: string[] = []
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true })
})

/** A game folder with `name` installed under node_modules; returns a sim file path inside the game. */
function game(name: string, manifest: string | object, simFile = 'src/sim/a.ts'): string {
  const root = mkdtempSync(join(tmpdir(), 'af-sim-entries-'))
  folders.push(root)
  const installed = join(root, 'node_modules', name)
  mkdirSync(installed, { recursive: true })
  writeFileSync(
    join(installed, 'package.json'),
    typeof manifest === 'string' ? manifest : JSON.stringify(manifest),
  )
  const file = join(root, simFile)
  mkdirSync(dirname(file), { recursive: true })
  return file
}

const declaring = (...simEntries: unknown[]) => ({ name: '@x/ext', automata: { simEntries } })

describe('simEntryVerdict', () => {
  it('allows an entry the installed package declares', () => {
    const file = game('@x/ext', declaring('./2d', './3d'))
    expect(simEntryVerdict(file, '@x/ext/2d')).toEqual({ allowed: true })
    expect(simEntryVerdict(file, '@x/ext/3d')).toEqual({ allowed: true })
  })

  it('allows the package root when it declares "."', () => {
    const file = game('@x/ext', declaring('.'))
    expect(simEntryVerdict(file, '@x/ext')).toEqual({ allowed: true })
  })

  it('refuses an entry the package does not declare, naming what it does declare', () => {
    const file = game('@x/ext', declaring('./2d'))
    expect(simEntryVerdict(file, '@x/ext/3d')).toEqual({
      allowed: false,
      detail: '@x/ext declares only ./2d for a sim',
    })
    expect(simEntryVerdict(file, '@x/ext')).toMatchObject({ allowed: false })
  })

  it('refuses a deep path into a declared package', () => {
    const file = game('@x/ext', declaring('./2d'))
    expect(simEntryVerdict(file, '@x/ext/src/2d')).toMatchObject({ allowed: false })
  })

  it('says nothing for a package that declares nothing, or is not installed', () => {
    const file = game('@x/ext', { name: '@x/ext' })
    expect(simEntryVerdict(file, '@x/ext/2d')).toEqual({ allowed: false })
    expect(simEntryVerdict(file, '@x/other/2d')).toEqual({ allowed: false })
  })

  it('reads unscoped package names', () => {
    const file = game('ext', { name: 'ext', automata: { simEntries: ['./2d'] } })
    expect(simEntryVerdict(file, 'ext/2d')).toEqual({ allowed: true })
  })

  it('finds node_modules from a file nested below the game root', () => {
    const file = game('@x/ext', declaring('./2d'), 'src/sim/deep/er/a.ts')
    expect(simEntryVerdict(file, '@x/ext/2d')).toEqual({ allowed: true })
  })

  it.each([
    ['a string instead of an array', { name: '@x/ext', automata: { simEntries: './2d' } }],
    ['an entry that leaves the package', declaring('../outside')],
    ['an entry that climbs out after starting inside', declaring('./a/../../outside')],
    ['an entry that is not a subpath', declaring('2d')],
    ['a wildcard', declaring('./*')],
    ['a non-string entry', declaring(2)],
  ])('refuses every entry of a package whose declaration is malformed: %s', (_label, manifest) => {
    const file = game('@x/ext', manifest)
    const verdict = simEntryVerdict(file, '@x/ext/2d')
    expect(verdict.allowed).toBe(false)
    expect(verdict).toMatchObject({
      detail: expect.stringContaining('@x/ext declares automata.simEntries wrongly'),
    })
  })

  it('refuses a package.json that is not JSON, naming the package', () => {
    const file = game('@x/ext', '{ not json')
    expect(simEntryVerdict(file, '@x/ext/2d')).toMatchObject({
      allowed: false,
      detail: expect.stringContaining('@x/ext has a package.json that is not valid JSON'),
    })
  })
})
