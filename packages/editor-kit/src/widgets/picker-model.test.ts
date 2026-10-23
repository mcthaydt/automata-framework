import { describe, expect, test } from 'vitest'
import { filterOptions, groupOptions, type PickerOption } from './picker-model'

const options: readonly PickerOption[] = [
  { id: 'grass', label: 'Grass', group: 'Ground' },
  { id: 'water', label: 'Water', detail: 'Animated', group: 'Liquid' },
  { id: 'sand', label: 'Sand', detail: 'Dry', group: 'Ground' },
  { id: 'none', label: 'None' },
  { id: 'lava', label: 'Lava', group: 'Liquid' },
]

describe('filterOptions', () => {
  test('an empty or blank query keeps everything', () => {
    expect(filterOptions(options, '')).toBe(options)
    expect(filterOptions(options, '   ')).toBe(options)
  })

  test('matches the label without regard to case', () => {
    expect(filterOptions(options, 'GRA').map((o) => o.id)).toEqual(['grass'])
  })

  test('matches anywhere in the label, not only at the start', () => {
    expect(filterOptions(options, 'nd').map((o) => o.id)).toEqual(['sand'])
    expect(filterOptions(options, 'a').map((o) => o.id)).toEqual(['grass', 'water', 'sand', 'lava'])
  })

  test('matches the detail too', () => {
    expect(filterOptions(options, 'animated').map((o) => o.id)).toEqual(['water'])
    expect(filterOptions(options, 'dry').map((o) => o.id)).toEqual(['sand'])
  })

  test('keeps the options in their order', () => {
    expect(filterOptions(options, 'a').map((o) => o.id)).toEqual(['grass', 'water', 'sand', 'lava'])
  })

  test('nothing matches: an empty list', () => {
    expect(filterOptions(options, 'zzz')).toEqual([])
  })

  test('ignores the space around the query', () => {
    expect(filterOptions(options, '  sand ').map((o) => o.id)).toEqual(['sand'])
  })
})

describe('groupOptions', () => {
  test('groups come in the order they first appear, and options keep their order inside them', () => {
    const groups = groupOptions(options)
    expect(groups.map((g) => g.heading)).toEqual(['Ground', 'Liquid', undefined])
    expect(groups.map((g) => g.options.map((o) => o.id))).toEqual([
      ['grass', 'sand'],
      ['water', 'lava'],
      ['none'],
    ])
  })

  test('options with no group form one heading-less group where the first of them appears', () => {
    const groups = groupOptions([
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B', group: 'X' },
      { id: 'c', label: 'C' },
    ])
    expect(groups.map((g) => g.heading)).toEqual([undefined, 'X'])
    expect(groups[0]?.options.map((o) => o.id)).toEqual(['a', 'c'])
  })

  test('no options: no groups', () => {
    expect(groupOptions([])).toEqual([])
  })
})
