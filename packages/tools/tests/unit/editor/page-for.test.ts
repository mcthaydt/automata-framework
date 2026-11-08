import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { pageFor } from '#src/features/editor/page-for.ts'

// Which editor page a game gets (plan task 15.2): the game's own editor list decides, so there is no flag to remember.
// A game that names a 3D editor gets the full page; every other game, or none with a list, gets the 2D page.

const list = (...editors: string[]): string =>
  `format = "af-editors/1"\n${editors
    .map(
      (editor) =>
        `[[file]]\nglob = "content/${editor}/*.toml"\neditor = "${editor}"\nmodes = ["edit"]\ngates = []\nchecks = []\n`,
    )
    .join('\n')}`

const gameList = (game: string): string =>
  readFileSync(new URL(`../../../../../games/${game}/content/editors.toml`, import.meta.url), 'utf8')

describe('pageFor', () => {
  it('gives base-3d the full page, because its list names Levels 3D and the Characters editor', () => {
    expect(pageFor(gameList('base-3d'))).toBe('suite-full')
  })

  it('gives Emberwick the 2D page', () => {
    expect(pageFor(gameList('emberwick'))).toBe('suite-2d')
  })

  it('gives the full page for either 3D editor alone', () => {
    expect(pageFor(list('levels-3d'))).toBe('suite-full')
    expect(pageFor(list('studio', 'tuner'))).toBe('suite-full')
  })

  it('gives the 2D page to a game with no list, or one that does not load, which shows its problems there', () => {
    expect(pageFor(undefined)).toBe('suite-2d')
    expect(pageFor('this is not a list')).toBe('suite-2d')
  })
})
