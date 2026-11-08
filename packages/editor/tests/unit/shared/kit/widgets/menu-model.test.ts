import { describe, expect, test } from 'vitest'
import { advanceTypeahead, findTypeahead } from '#src/shared/kit/widgets/menu-model.ts'

const labels = ['Rename', 'Duplicate', 'Delete', 'Export', 'Dock']
const all = () => true

describe('advanceTypeahead', () => {
  test('letters typed close together make one word', () => {
    let state = advanceTypeahead(undefined, 'd', 1000)
    state = advanceTypeahead(state, 'u', 1300)
    expect(state.text).toBe('du')
  })

  test('a pause starts a new word', () => {
    const state = advanceTypeahead({ text: 'du', at: 1000 }, 'e', 1800)
    expect(state.text).toBe('e')
  })

  test('the window can be changed', () => {
    const state = advanceTypeahead({ text: 'du', at: 1000 }, 'p', 1800, 1000)
    expect(state.text).toBe('dup')
  })
})

describe('findTypeahead', () => {
  test('finds the next item that starts with the typed text, ignoring case', () => {
    expect(findTypeahead(labels, 'ex', 0, all)).toBe(3)
    expect(findTypeahead(labels, 'REN', 2, all)).toBe(0)
  })

  test('a growing word stays on the current item while it still matches', () => {
    expect(findTypeahead(labels, 'du', 1, all)).toBe(1)
    expect(findTypeahead(labels, 'dup', 1, all)).toBe(1)
  })

  test('one letter pressed again cycles through the items that start with it', () => {
    expect(findTypeahead(labels, 'd', 1, all)).toBe(2)
    expect(findTypeahead(labels, 'd', 2, all)).toBe(4)
    expect(findTypeahead(labels, 'd', 4, all)).toBe(1)
    expect(findTypeahead(labels, 'dd', 1, all)).toBe(2)
  })

  test('skips disabled items', () => {
    expect(findTypeahead(labels, 'd', 1, (i) => i !== 2)).toBe(4)
  })

  test('nothing matches: undefined', () => {
    expect(findTypeahead(labels, 'z', 0, all)).toBeUndefined()
    expect(findTypeahead(labels, '', 0, all)).toBeUndefined()
  })
})
