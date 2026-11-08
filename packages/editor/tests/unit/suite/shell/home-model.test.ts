import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { loadEditorList } from '#src/features/suite/core/index.ts'
import { createSuite } from '#src/features/suite/shell/create-suite.ts'
import { fileTitle, homeOf, keyPathText } from '#src/features/suite/shell/home-model.ts'
import type { WorkspaceFile } from '#src/shared/kit/ports/suite-ports.ts'

/** The sample game's list sits beside the in-memory ports the suite page uses; the others are test fixtures. */
const fixture = (name: string): string =>
  readFileSync(
    new URL(
      `../../../../src/${name === 'platformer' ? 'features/suite/memory' : 'testing/suite/fixtures'}/${name}.editors.toml`,
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
      ['tuner', 'Tuner', undefined],
      ['levels-2d', 'Levels', undefined],
    ])
    expect(state.cards[0]?.files).toEqual([tuning])
    expect(state.cards[1]?.files).toEqual([])
  })

  it('calls the one level editor of a 3D game Levels, and the figure editor Characters', () => {
    const list = `format = "af-editors/1"
[[file]]
glob = "content/tuning.toml"
editor = "tuner"
modes = ["edit"]
gates = []
checks = ["content"]
[[file]]
glob = "content/levels/*.af-sector.json"
editor = "levels-3d"
modes = ["edit"]
gates = []
checks = ["content"]
[[file]]
glob = "content/figures/*.toml"
editor = "studio"
modes = ["edit"]
gates = []
checks = ["content"]
`
    const installed = (id: string, label: string) => ({ id, label, regions: {} }) as never
    const suite = createSuite({
      editors: [
        installed('tuner', 'Tuner'),
        installed('levels-2d', 'Levels'),
        installed('levels-3d', 'Levels 3D'),
        installed('studio', 'Characters'),
      ],
    })
    const state = homeOf(loadEditorList(list), new Map(), suite)
    if (state.kind !== 'cards') throw new Error(state.kind)
    expect(state.cards.map((card) => card.label)).toEqual(['Tuner', 'Levels', 'Characters'])
  })

  it('names a studio card Characters when the build lacks the editor', () => {
    const list = `format = "af-editors/1"
[[file]]
glob = "content/figures/*.toml"
editor = "studio"
modes = ["edit"]
gates = []
checks = ["content"]
`
    const state = homeOf(loadEditorList(list), new Map(), empty)
    if (state.kind !== 'cards') throw new Error(state.kind)
    expect(state.cards[0]?.label).toBe('Characters')
  })

  // Build audit G6: Home orders the cards as the rail does, and lists a level once, not the game files Save writes.
  it('puts the cards in the rail order, whatever order the list names them in', () => {
    const list = `format = "af-editors/1"
[[file]]
glob = "content/rooms/*.af2d.json"
editor = "levels-2d"
modes = ["edit"]
exports = "content"
gates = []
checks = ["content"]
[[file]]
glob = "content/tuning.toml"
editor = "tuner"
modes = ["edit"]
gates = []
checks = ["content"]
`
    const installed = (id: string) => ({ id, label: id, regions: {} }) as never
    const suite = createSuite({ editors: [installed('tuner'), installed('levels-2d')] })
    const state = homeOf(loadEditorList(list), new Map(), suite)
    if (state.kind !== 'cards') throw new Error(state.kind)
    expect(state.cards.map((card) => card.editor)).toEqual(['tuner', 'levels-2d'])
  })

  it('lists a level once: not the project, the world and the level files Save writes, or the pictures', () => {
    const list = `format = "af-editors/1"
[[file]]
glob = "content/rooms/*.af2d.json"
editor = "levels-2d"
modes = ["edit"]
exports = "content"
gates = []
checks = ["content"]
`
    const room = file('content/rooms/room-1.af2d.json', 'levels-2d')
    const saved = [
      'content/project.toml',
      'content/world.toml',
      'content/levels/room-1.toml',
      'assets/tiles.png',
    ]
    const state = homeOf(
      loadEditorList(list),
      new Map([['levels-2d', [room, ...saved.map((path) => file(path, 'levels-2d'))]]]),
      empty,
    )
    if (state.kind !== 'cards') throw new Error(state.kind)
    expect(state.cards[0]?.files).toEqual([room])
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

  it('EDS-l: marks Feel not installed, naming no package', () => {
    const list =
      'format = "af-editors/1"\n[[file]]\nglob = "content/feel.toml"\neditor = "feel"\nmodes = ["edit"]\ngates = []\nchecks = []\n'
    const tuner = { id: 'tuner' } as never
    const state = homeOf(loadEditorList(list), new Map(), createSuite({ editors: [tuner] }))
    if (state.kind !== 'cards') throw new Error(state.kind)
    expect(state.cards[0]).toMatchObject({
      editor: 'feel',
      label: 'Feel',
      entry: undefined,
      installed: false,
    })
    expect(state.cards[0]).not.toHaveProperty('provider')
  })

  it('marks an id no editor has as not installed, by its id', () => {
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
  })

  it('marks an editor the suite was given as installed, with its own label and its rail entry', () => {
    const state = homeOf(
      loadEditorList(fixture('platformer')),
      new Map(),
      createSuite({ editors: [{ id: 'tuner', label: 'Tuner' } as never] }),
    )
    if (state.kind !== 'cards') throw new Error(state.kind)
    expect(state.cards.map((card) => [card.installed, card.entry])).toEqual([
      [true, 'tuner'],
      [false, undefined],
    ])
  })

  it('lets an editor show fewer rows than it has files (one scene across several files)', () => {
    const file = (path: string): WorkspaceFile => ({
      path,
      editor: 'tuner',
      gates: [],
      checks: [],
      modes: ['edit'],
      writable: true,
    })
    const files = new Map([['tuner', [file('a/hall.toml'), file('b/hall.toml'), file('a/yard.toml')]]])
    const keepFirstOfEach = (listed: readonly WorkspaceFile[]) => [
      ...new Map(listed.map((f) => [fileTitle(f.path), f])).values(),
    ]
    const state = homeOf(
      loadEditorList(fixture('platformer')),
      files,
      createSuite({ editors: [{ id: 'tuner', label: 'Tuner', homeFiles: keepFirstOfEach } as never] }),
    )
    if (state.kind !== 'cards') throw new Error(state.kind)
    expect(state.cards[0]?.rows.map((f) => f.path)).toEqual(['b/hall.toml', 'a/yard.toml'])
    // Opening the card still gives the editor every file.
    expect(state.cards[0]?.files).toHaveLength(3)
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

// Home names each file in words (12.7 Step G): the folders and the format words a person never typed stay off screen.
describe('fileTitle', () => {
  it.each([
    ['content/rooms/room-1.af2d.json', 'Room 1'],
    ['content/tuning.toml', 'Tuning'],
    ['content/levels/world_map.af2d.json', 'World map'],
    ['README', 'README'],
  ])('%s reads as %s', (path, title) => {
    expect(fileTitle(path)).toBe(title)
  })
})
