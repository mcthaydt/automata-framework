import { describe, expect, it } from 'vitest'
import { tabSlots } from '#src/shared/kit/nav/tab-slots.ts'

const ids = (list: readonly { id: string }[]) => list.map((entry) => entry.id)
const entries = (...names: string[]) => names.map((id) => ({ id }))

describe('tabSlots', () => {
  it('shows every editor when there are five or fewer, with no More', () => {
    const five = entries('a', 'b', 'c', 'd', 'e')
    expect(tabSlots(five, 'e').more).toEqual([])
    expect(ids(tabSlots(five, 'e').shown)).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('shows the first four and puts the rest under More', () => {
    const slots = tabSlots(entries('a', 'b', 'c', 'd', 'e', 'f'), 'b')
    expect(ids(slots.shown)).toEqual(['a', 'b', 'c', 'd'])
    expect(ids(slots.more)).toEqual(['e', 'f'])
  })

  it('gives the open editor the fourth slot when it would be under More, and moves the fourth to More', () => {
    const slots = tabSlots(entries('a', 'b', 'c', 'd', 'e', 'f'), 'f')
    expect(ids(slots.shown)).toEqual(['a', 'b', 'c', 'f'])
    expect(ids(slots.more)).toEqual(['d', 'e'])
  })

  it('on Home shows the first four', () => {
    expect(ids(tabSlots(entries('a', 'b', 'c', 'd', 'e', 'f'), undefined).shown)).toEqual([
      'a',
      'b',
      'c',
      'd',
    ])
  })
})
