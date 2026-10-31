import { describe, expect, it } from 'vitest'
import type { MusicRule, Slot } from './audio.schema'
import { createMusicDirector, holds, resolveSlot, slotFor, slotsFor } from './music'

const slot = (id: string, more: Partial<Slot> = {}): Slot => ({ id, mode: 'loop', volume: 0.5, ...more })
const SLOTS: readonly Slot[] = [
  slot('title', { volume: 0.45 }),
  slot('explore', { volume: 0.25 }),
  slot('chase', { volume: 0.4, linger: 5, fallback: [{ sound: 'explore', volume: 0.5 }] }),
  slot('save', { volume: 0.25, relief: true }),
  slot('radio', { resume: true, fallback: [{ sound: 'title', volume: 0.8, filter: 'radio' }] }),
]

describe('resolveSlot', () => {
  it('plays the slot’s own file first, then each fallback that exists, at the fallback’s level', () => {
    const chase = SLOTS[2] as Slot
    expect(resolveSlot(chase, new Set(['chase', 'explore']))).toEqual([
      { sound: 'chase', volume: 0.4, placeholder: false },
      { sound: 'explore', volume: 0.2, placeholder: true },
    ])
  })
  it('skips a fallback that is missing and is empty when nothing exists', () => {
    const radio = SLOTS[4] as Slot
    expect(resolveSlot(radio, new Set(['title']))).toEqual([
      { sound: 'title', volume: 0.5 * 0.8, filter: 'radio', placeholder: true },
    ])
    expect(resolveSlot(radio, new Set())).toEqual([])
  })
  it('names the file by the slot’s sound alias when it has one', () => {
    expect(resolveSlot(slot('a', { sound: 'a-theme' }), new Set(['a-theme']))[0]?.sound).toBe('a-theme')
  })
})

describe('holds', () => {
  it('matches a value, one of a list, and a range; a missing key fails', () => {
    expect(holds('a', 'a')).toBe(true)
    expect(holds(['a', 'b'], 'b')).toBe(true)
    expect(holds(['a', 'b'], 'c')).toBe(false)
    expect(holds({ atMost: 5 }, 5)).toBe(true)
    expect(holds({ atMost: 5 }, 6)).toBe(false)
    expect(holds({ atLeast: 2, atMost: 4 }, 3)).toBe(true)
    expect(holds({ atLeast: 2 }, 'x')).toBe(false)
    expect(holds('a', undefined)).toBe(false)
  })
})

const RULES: readonly MusicRule[] = [
  { when: { phase: 'paused' }, slot: 'hold' },
  { when: { phase: 'title' }, slot: 'title' },
  { when: { hidden: true }, slot: 'silence' },
  { when: { safe: true }, slot: 'save' },
  { when: { threat: { atMost: 10 } }, slot: 'chase' },
  { when: {}, slot: 'explore' },
]
describe('slotFor', () => {
  it('the first row that matches wins', () => {
    expect(slotFor(RULES, { phase: 'title' })).toBe('title')
    expect(slotFor(RULES, { phase: 'play', threat: 4 })).toBe('chase')
    expect(slotFor(RULES, { phase: 'play', threat: 40 })).toBe('explore')
  })
  it('answers hold and silence as themselves', () => {
    expect(slotFor(RULES, { phase: 'paused' })).toBe('hold')
    expect(slotFor(RULES, { phase: 'play', hidden: true })).toBe('silence')
  })
  it('is undefined when no row matches', () => {
    expect(slotFor([{ when: { phase: 'x' }, slot: 'title' }], { phase: 'y' })).toBeUndefined()
  })
})

describe('slotsFor', () => {
  it('lists the loops a state key value plays in, best first, for loading ahead', () => {
    expect(slotsFor(RULES, SLOTS, 'phase', 'title')).toEqual(['title'])
  })
})

describe('the director', () => {
  const director = () => createMusicDirector({ slots: SLOTS, rules: RULES })
  it('follows the rules at once for a slot with no linger', () => {
    const d = director()
    expect(d.step({ phase: 'title' }, 0.1)).toBe('title')
    expect(d.step({ phase: 'play', threat: 99 }, 0.1)).toBe('explore')
  })
  it('lingers on a chase for its seconds after the state ends, then moves on', () => {
    const d = director()
    expect(d.step({ phase: 'play', threat: 3 }, 0.1)).toBe('chase')
    expect(d.step({ phase: 'play', threat: 99 }, 2)).toBe('chase')
    expect(d.step({ phase: 'play', threat: 99 }, 2)).toBe('chase')
    expect(d.step({ phase: 'play', threat: 99 }, 2)).toBe('explore')
  })
  it('starts the linger over when the chase comes back', () => {
    const d = director()
    d.step({ phase: 'play', threat: 3 }, 0.1)
    d.step({ phase: 'play', threat: 99 }, 4)
    d.step({ phase: 'play', threat: 3 }, 0.1)
    expect(d.step({ phase: 'play', threat: 99 }, 4)).toBe('chase')
  })
  it('does not linger into a place of relief or into silence', () => {
    const a = director()
    a.step({ phase: 'play', threat: 3 }, 0.1)
    expect(a.step({ phase: 'play', safe: true, threat: 3 }, 0.1)).toBe('save')
    const b = director()
    b.step({ phase: 'play', threat: 3 }, 0.1)
    expect(b.step({ phase: 'play', hidden: true }, 0.1)).toBeNull()
  })
  it('holds what plays under an overlay and leaves the linger clock where it was', () => {
    const d = director()
    d.step({ phase: 'play', threat: 3 }, 0.1)
    d.step({ phase: 'play', threat: 99 }, 4)
    expect(d.step({ phase: 'paused' }, 100)).toBe('chase')
    expect(d.step({ phase: 'play', threat: 99 }, 0.5)).toBe('chase')
    expect(d.step({ phase: 'play', threat: 99 }, 1)).toBe('explore')
  })
  it('is silent (null) when no row matches', () => {
    expect(createMusicDirector({ slots: SLOTS, rules: [] }).step({}, 1)).toBeNull()
  })
})
