// The figure painter (`@automata/figures`, a package of this repository) is reached through the files of
// src/shared/figure-builder/ and nowhere else, so a change in the painter breaks those files only: no other source or test
// file of the kit imports it. `door.ts` takes the painter's Pixi-free entries (safe in Node); `door-view.ts` takes the view
// entry, which loads Pixi.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { flatSteps, lightSprite, SPRITE_STYLE } from '#src/shared/figure-builder/door.ts'

const ROOT = join(import.meta.dirname, '../../..')
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : path.endsWith('.ts') ? [path] : []
  })
const IMPORTS =
  /\bfrom\s+['"]@automata\/figures(?:\/[^'"]*)?['"]|\bimport\s*\(\s*['"]@automata\/figures|\bimport\s+['"]@automata\/figures/
const SPECIFIERS = /\bfrom\s+['"](@automata\/figures(?:\/[^'"]*)?)['"]/g
const specifiersOf = (file: string) =>
  [...readFileSync(join(ROOT, file), 'utf8').matchAll(SPECIFIERS)].map((match) => match[1]).sort()

describe('the door', () => {
  it('is the only file that imports the figure painter', () => {
    const importers = [...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'tests'))]
      .filter((file) => IMPORTS.test(readFileSync(file, 'utf8')))
      .map((file) => relative(ROOT, file))
    expect(importers).toEqual(['src/shared/figure-builder/door-view.ts', 'src/shared/figure-builder/door.ts'])
  })

  it('takes the painter’s Pixi-free entries and nothing deeper', () => {
    expect([...new Set(specifiersOf('src/shared/figure-builder/door.ts'))]).toEqual([
      '@automata/figures',
      '@automata/figures/kit',
    ])
  })

  it('takes the view entry, the one that loads Pixi, in a file of its own', () => {
    expect(specifiersOf('src/shared/figure-builder/door-view.ts')).toEqual(['@automata/figures/view'])
  })

  it('cannot reach past the three entries', () => {
    const manifest = JSON.parse(
      readFileSync(new URL('../../../../figures/package.json', import.meta.url), 'utf8'),
    )
    expect(Object.keys(manifest.exports)).toEqual(['.', './kit', './view'])
  })

  it('hands over the painter’s sprite light (c8-lit): the function, its step count and its style', () => {
    expect(typeof lightSprite).toBe('function')
    expect(flatSteps([1, 1, 1])).toBe(0)
    expect(SPRITE_STYLE.stepRatio).toBeGreaterThan(1)
  })
})
