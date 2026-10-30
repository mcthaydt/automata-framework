import { describe, expect, it } from 'vitest'
import { SUITE_ENTRIES } from './suite-entries'

describe('the rail entries (editor suite spec §2, §10)', () => {
  it('are the seven editors, Levels and Review, in rail order', () => {
    expect(SUITE_ENTRIES.map((entry) => entry.label)).toEqual([
      'Tuner',
      'Studio',
      'Audio',
      'Feel',
      'Writer',
      'Schematic',
      'Sequence',
      'Levels',
      'Review',
    ])
  })

  it('give Levels both level editors and Review none, and no editor to two entries', () => {
    const levels = SUITE_ENTRIES.find((entry) => entry.id === 'levels')
    expect(levels?.editors).toEqual(['levels-2d', 'levels-3d'])
    expect(SUITE_ENTRIES.find((entry) => entry.id === 'review')?.editors).toEqual([])
    const ids = SUITE_ENTRIES.flatMap((entry) => entry.editors)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('name the package that provides each editor: the Plus four come with editor-plus', () => {
    const provider = (id: string) => SUITE_ENTRIES.find((entry) => entry.id === id)?.provider
    expect(['feel', 'writer', 'schematic', 'sequence'].map(provider)).toEqual(Array(4).fill('editor-plus'))
    expect(['tuner', 'studio', 'audio'].map(provider)).toEqual(Array(3).fill('editor-suite'))
    expect(provider('levels')).toBe('editor-2d and editor-3d')
  })
})
