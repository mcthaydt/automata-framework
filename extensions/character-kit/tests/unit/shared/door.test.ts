// The figure builder is reached through the files of src/shared/figure-builder/ and nowhere else, so an upstream refactor
// breaks those files only: no other source or test file of the kit imports `figure-builder`. `door.ts` takes the builder's
// Pixi-free entries (safe in Node); `door-view.ts` takes the view entry, which loads Pixi.
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
  /\bfrom\s+['"]figure-builder(?:\/[^'"]*)?['"]|\bimport\s*\(\s*['"]figure-builder|\bimport\s+['"]figure-builder/
const SPECIFIERS = /\bfrom\s+['"](figure-builder(?:\/[^'"]*)?)['"]/g
const specifiersOf = (file: string) =>
  [...readFileSync(join(ROOT, file), 'utf8').matchAll(SPECIFIERS)].map((match) => match[1]).sort()

describe('the door', () => {
  it('is the only file that imports the figure builder', () => {
    const importers = [...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'tests'))]
      .filter((file) => IMPORTS.test(readFileSync(file, 'utf8')))
      .map((file) => relative(ROOT, file))
    expect(importers).toEqual(['src/shared/figure-builder/door-view.ts', 'src/shared/figure-builder/door.ts'])
  })

  it('takes the builder’s Pixi-free entries and nothing deeper', () => {
    for (const specifier of specifiersOf('src/shared/figure-builder/door.ts')) {
      expect(['figure-builder', 'figure-builder/kit']).toContain(specifier)
    }
  })

  it('takes the view entry, the one that loads Pixi, in a file of its own', () => {
    expect(specifiersOf('src/shared/figure-builder/door-view.ts')).toEqual(['figure-builder/view'])
  })

  it('hands over the builder’s sprite light (c8-lit): the function, its step count and its style', () => {
    expect(typeof lightSprite).toBe('function')
    expect(flatSteps([1, 1, 1])).toBe(0)
    expect(SPRITE_STYLE.stepRatio).toBeGreaterThan(1)
  })
})
