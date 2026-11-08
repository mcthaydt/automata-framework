import { describe, expect, it } from 'vitest'
import { editorLabel, suiteEntries } from '#src/features/suite/shell/suite-entries.ts'

// The rail lists what the build has: one entry per registered editor, in the order the page registers them.
const tuner = { id: 'tuner', label: 'Tuner' }
const levels = { id: 'levels-2d', label: 'Levels', kind: '2d' as const }

describe('the rail entries', () => {
  it('are the registered editors, in the order the page registers them, each opening itself', () => {
    expect(suiteEntries([tuner, levels])).toEqual([
      { id: 'tuner', label: 'Tuner', icon: 'sliders', editors: ['tuner'] },
      { id: 'levels-2d', label: 'Levels', icon: 'grid', kind: '2d', editors: ['levels-2d'] },
    ])
  })

  it('draw each entry with an icon: its own where the rail knows the editor, the list for one it does not', () => {
    const entries = suiteEntries([
      tuner,
      levels,
      { id: 'levels-3d', label: 'Levels' },
      { id: 'writer', label: 'Writer' },
    ])
    expect(entries.map((entry) => entry.icon)).toEqual(['sliders', 'grid', 'grid', 'list'])
  })

  describe('on a game that lists its editors', () => {
    const l2 = { id: 'levels-2d', label: 'Levels', kind: '2d' as const }
    const l3 = { id: 'levels-3d', label: 'Levels', kind: '3d' as const }
    const studio = { id: 'studio', label: 'Characters', kind: '3d' as const }
    const feel = { id: 'feel', label: 'Feel' }
    const all = [tuner, l2, l3, studio, feel]
    const ids = (entries: ReturnType<typeof suiteEntries>) => entries.map((entry) => entry.id)

    it('show every editor of a 2D game, listed or not, and none of 3D', () => {
      expect(ids(suiteEntries(all, ['levels-2d', 'tuner']))).toEqual(['tuner', 'levels-2d', 'feel'])
    })

    it('show every editor of a 3D game, listed or not, and none of 2D', () => {
      expect(ids(suiteEntries(all, ['levels-3d']))).toEqual(['tuner', 'levels-3d', 'studio', 'feel'])
    })

    it('show both kinds when the list names neither level editor, or did not load', () => {
      const every = ['tuner', 'levels-2d', 'levels-3d', 'studio', 'feel']
      expect(ids(suiteEntries(all, ['tuner']))).toEqual(every)
      expect(ids(suiteEntries(all, undefined))).toEqual(every)
    })

    it('name both kinds apart in a game with both level editors', () => {
      expect(suiteEntries(all, ['levels-2d', 'levels-3d']).map((entry) => entry.label)).toEqual([
        'Tuner',
        'Levels 2D',
        'Levels 3D',
        'Characters 3D',
        'Feel',
      ])
    })

    it('name one kind plainly, even when the list did not load', () => {
      expect(suiteEntries([tuner, l2, feel], undefined).map((entry) => entry.label)).toEqual([
        'Tuner',
        'Levels',
        'Feel',
      ])
      expect(suiteEntries(all, ['levels-3d']).map((entry) => entry.label)).toEqual([
        'Tuner',
        'Levels',
        'Characters',
        'Feel',
      ])
    })

    it('say which kind an entry is for', () => {
      expect(suiteEntries(all, ['levels-3d']).map((entry) => entry.kind)).toEqual([
        undefined,
        '3d',
        '3d',
        undefined,
      ])
    })

    it('name an editor one way for the rail, Home and the Editors menu', () => {
      expect(editorLabel(l3, ['levels-3d'], all)).toBe('Levels')
      expect(editorLabel(l2, ['levels-2d', 'levels-3d'], all)).toBe('Levels 2D')
      expect(editorLabel(studio, ['levels-2d', 'levels-3d'], all)).toBe('Characters 3D')
      expect(editorLabel(l3, undefined, [tuner, l3])).toBe('Levels')
    })
  })

  describe('of an editor with more than one', () => {
    const levels2d = {
      id: 'levels-2d',
      label: 'Levels',
      kind: '2d' as const,
      entries: [
        { id: 'levels-2d', label: 'Levels', icon: 'grid' as const, kind: '2d' as const, view: 'level' },
        {
          id: 'characters-2d',
          label: 'Characters',
          icon: 'person' as const,
          kind: '2d' as const,
          view: 'characters',
        },
      ],
    }
    const levels3d = { id: 'levels-3d', label: 'Levels', kind: '3d' as const }
    const studio = { id: 'studio', label: 'Characters', kind: '3d' as const }
    const feel = { id: 'feel', label: 'Feel' }

    it('are one rail entry each, right after the editor’s first, each opening its editor at its view', () => {
      const entries = suiteEntries([tuner, levels2d, feel], ['levels-2d'])
      expect(entries.map((entry) => entry.id)).toEqual(['tuner', 'levels-2d', 'characters-2d', 'feel'])
      expect(entries[2]).toMatchObject({ editors: ['levels-2d'], view: 'characters', label: 'Characters' })
      expect(entries[1]).toMatchObject({ editors: ['levels-2d'], view: 'level' })
    })

    it('name both kinds apart when the game has both', () => {
      const labels = suiteEntries([levels2d, levels3d, studio], ['levels-2d', 'levels-3d']).map(
        (entry) => entry.label,
      )
      expect(labels).toEqual(['Levels 2D', 'Characters 2D', 'Levels 3D', 'Characters 3D'])
    })

    it('draw both kinds’ Characters alike, with the person', () => {
      const entries = suiteEntries([levels2d, levels3d, studio], ['levels-2d', 'levels-3d'])
      const icons = Object.fromEntries(entries.map((entry) => [entry.id, entry.icon]))
      expect(icons['characters-2d']).toBe('person')
      expect(icons.studio).toBe('person')
    })

    it('are dropped with the editor for a kind the game is not', () => {
      expect(suiteEntries([levels2d, levels3d], ['levels-3d']).map((entry) => entry.id)).toEqual([
        'levels-3d',
      ])
    })
  })

  it('are empty for a build with no editors', () => {
    expect(suiteEntries([])).toEqual([])
  })
})
