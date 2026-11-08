import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { loadEditorList } from '#src/features/suite/core/index.ts'
import { createSuite } from '#src/features/suite/shell/create-suite.ts'
import { homeOf, keyPathText } from '#src/features/suite/shell/home-model.ts'
import type { WorkspaceFile } from '#src/shared/kit/ports/suite-ports.ts'

const fixture = (name: string): string =>
  readFileSync(
    new URL(
      // The sample game's list ships with the suite page; the other game's list is a test fixture.
      name === 'platformer'
        ? '../../../../src/features/suite/shell/platformer.editors.toml'
        : `../../../../src/testing/suite/fixtures/${name}.editors.toml`,
      import.meta.url,
    ),
    'utf8',
  )

const file = (path: string, editor: string): WorkspaceFile => ({
  path,
  editor,
  gates: [],
  checks: ['content'],
  modes: ['edit'],
  writable: true,
})

const empty = createSuite({ editors: [] })

describe('Home (editor suite spec §5 flow 2, §9 suite-home, §11)', () => {
  it("gives one card per editor the platformer's list names, in list order, with its files", () => {
    const tuning = file('content/tuning.toml', 'tuner')
    const state = homeOf(loadEditorList(fixture('platformer')), new Map([['tuner', [tuning]]]), empty)
    if (state.kind !== 'cards') throw new Error(state.kind)
    expect(state.cards.map((card) => [card.editor, card.label, card.entry])).toEqual([
      ['tuner', 'Tuner', 'tuner'],
      ['levels-2d', 'Levels 2D', 'levels'],
    ])
    expect(state.cards[0]?.files).toEqual([tuning])
    expect(state.cards[1]?.files).toEqual([])
  })

  it("lists the Bay game's editors once each", () => {
    const state = homeOf(loadEditorList(fixture('bay')), new Map(), empty)
    if (state.kind !== 'cards') throw new Error(state.kind)
    expect(state.cards.map((card) => card.editor)).toEqual([
      'writer',
      'schematic',
      'sequence',
      'feel',
      'audio',
      'studio',
      'levels-3d',
    ])
  })

  it('EDS-l: marks Feel not installed in the free build, with the package that provides it', () => {
    const list =
      'format = "af-editors/1"\n[[file]]\nglob = "content/feel.toml"\neditor = "feel"\nmodes = ["edit"]\ngates = []\nchecks = []\n'
    const tuner = { id: 'tuner' } as never
    const state = homeOf(loadEditorList(list), new Map(), createSuite({ editors: [tuner] }))
    if (state.kind !== 'cards') throw new Error(state.kind)
    expect(state.cards[0]).toMatchObject({
      editor: 'feel',
      label: 'Feel',
      installed: false,
      provider: 'editor-plus',
    })
  })

  it('marks an id no entry knows as not installed, by its id, with no provider', () => {
    const list =
      'format = "af-editors/1"\n[[file]]\nglob = "x.toml"\neditor = "maps"\nmodes = ["edit"]\ngates = []\nchecks = []\n'
    const state = homeOf(loadEditorList(list), new Map(), empty)
    if (state.kind !== 'cards') throw new Error(state.kind)
    expect(state.cards[0]).toMatchObject({
      editor: 'maps',
      label: 'maps',
      entry: undefined,
      installed: false,
    })
    expect(state.cards[0]?.provider).toBeUndefined()
  })

  it('marks an editor the suite was given as installed', () => {
    const state = homeOf(
      loadEditorList(fixture('platformer')),
      new Map(),
      createSuite({ editors: [{ id: 'tuner' } as never] }),
    )
    if (state.kind !== 'cards') throw new Error(state.kind)
    expect(state.cards.map((card) => card.installed)).toEqual([true, false])
  })

  it('EDS-m: a row without gates gives the problems, with that row key path, and no cards', () => {
    const list =
      'format = "af-editors/1"\n[[file]]\nglob = "content/tuning.toml"\neditor = "tuner"\nmodes = ["edit"]\nchecks = []\n'
    const state = homeOf(loadEditorList(list), new Map(), empty)
    if (state.kind !== 'problems') throw new Error(state.kind)
    expect(state.problems.map((problem) => keyPathText(problem.keyPath))).toEqual(['file[0].gates'])
  })

  it('a missing list and a newer format are problems too', () => {
    expect(homeOf(loadEditorList(undefined), new Map(), empty).kind).toBe('problems')
    expect(homeOf(loadEditorList('format = "af-editors/2"\n'), new Map(), empty).kind).toBe('problems')
  })
})

describe('keyPathText', () => {
  it('writes a key path the way the list reads', () => {
    expect(keyPathText(['file', 0, 'gates'])).toBe('file[0].gates')
    expect(keyPathText(['check', 2, 'run', 1])).toBe('check[2].run[1]')
    expect(keyPathText([])).toBe('the whole list')
  })
})
