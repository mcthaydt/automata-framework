import { describe, expect, it } from 'vitest'
import { editorLabel, iconFor, suiteEntries } from '#src/features/suite/shell/suite-entries.ts'

// The rail lists what the build has: one entry per registered editor, in the order the page registers them.
const tuner = { id: 'tuner', label: 'Tuner' }
const levels = { id: 'levels-2d', label: 'Levels' }

describe("the editors' icons", () => {
  it.each([
    ['tuner', 'sliders'],
    ['levels-2d', 'levels'],
    ['levels-3d', 'levels'],
    ['studio', 'person'],
    ['characters-2d', 'person'],
    ['feel', 'zap'],
    ['audio', 'volume'],
    ['writer', 'message'],
    ['sequence', 'clapper'],
    ['schematic', 'workflow'],
  ])('%s is drawn as %s', (id, icon) => {
    expect(iconFor(id)).toBe(icon)
  })

  it('draws an editor it does not know as a list, never blank', () => {
    expect(iconFor('something-new')).toBe('list')
  })

  it('gives every editor of one game its own icon', () => {
    const entries = suiteEntries(
      ['tuner', 'levels-2d', 'studio', 'feel', 'audio', 'writer', 'sequence', 'schematic'].map((id) => ({
        id,
        label: id,
      })),
    )
    const icons = entries.map((entry) => entry.icon)
    expect(new Set(icons).size).toBe(icons.length)
  })
})

describe('the rail entries', () => {
  it('are the registered editors, in the order the page registers them, each opening itself', () => {
    expect(suiteEntries([tuner, levels])).toEqual([
      { id: 'tuner', label: 'Tuner', icon: 'sliders', editors: ['tuner'] },
      { id: 'levels-2d', label: 'Levels', icon: 'levels', editors: ['levels-2d'] },
    ])
  })

  it('draw each entry with an icon: its own where the rail knows the editor, the list for one it has no drawing for', () => {
    const entries = suiteEntries([
      tuner,
      levels,
      { id: 'levels-3d', label: 'Levels 3D' },
      { id: 'writer', label: 'Writer' },
    ])
    expect(entries.map((entry) => entry.icon)).toEqual(['sliders', 'levels', 'levels', 'message'])
  })

  describe('on a game that lists its editors', () => {
    const levels2d = { id: 'levels-2d', label: 'Levels' }
    const levels3d = { id: 'levels-3d', label: 'Levels 3D' }
    const studio = { id: 'studio', label: 'Characters' }

    it('show only the editors the game lists, with one Levels', () => {
      const entries = suiteEntries([tuner, levels2d, levels3d, studio], ['levels-3d', 'studio', 'tuner'])
      expect(entries.map((entry) => entry.label)).toEqual(['Tuner', 'Levels', 'Characters'])
    })

    it('say Levels 2D and Levels 3D when the game lists both', () => {
      expect(
        suiteEntries([levels2d, levels3d], ['levels-2d', 'levels-3d']).map((entry) => entry.label),
      ).toEqual(['Levels 2D', 'Levels 3D'])
    })

    it('show every editor when the list did not load', () => {
      expect(suiteEntries([tuner, levels2d, levels3d], undefined)).toHaveLength(3)
    })

    it('name an editor one way for the rail, Home and the Editors menu', () => {
      expect(editorLabel(levels3d, ['levels-3d'])).toBe('Levels')
      expect(editorLabel(levels2d, ['levels-2d', 'levels-3d'])).toBe('Levels 2D')
      expect(editorLabel(studio, ['studio'])).toBe('Characters')
      expect(editorLabel(levels3d, undefined)).toBe('Levels 3D')
    })
  })

  it('are empty for a build with no editors', () => {
    expect(suiteEntries([])).toEqual([])
  })
})
