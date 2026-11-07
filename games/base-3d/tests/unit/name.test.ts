import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BASE3D_COPY } from '#src/features/screens/copy.ts'
import ship from '../../ship.config.ts'

// G4: one game, one name. The catalog's title is the source; the page, the store listing, the editor's game name and the
// design document say the same.
const read = (file: string): string => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8')

describe('the game has one name', () => {
  const name = BASE3D_COPY.en.title

  it('is Ember Hall in the catalog', () => expect(name).toBe('Ember Hall'))
  it('is the page title', () => expect(read('index.html')).toContain(`<title>${name}</title>`))
  it('is the store listing title', () => expect(ship.game.title).toBe(name))
  it('is the title the editor shows for the game (package.json automata.title)', () => {
    expect((JSON.parse(read('package.json')) as { automata?: { title?: string } }).automata?.title).toBe(name)
  })
  it('is the name DESIGN.md calls the game, and the old working names are gone', () => {
    const design = read('DESIGN.md')
    expect(design).toContain(name)
    expect(design).not.toMatch(/Emberwick in 3D|AF Base 3D/)
  })
})
