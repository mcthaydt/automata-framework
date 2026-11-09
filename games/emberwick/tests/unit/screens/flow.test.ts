import { canonicalJson, hex64, utf8, xxhash64 } from '@automataframework/automata-sim/hash'
import { describe, expect, it } from 'vitest'
import { EMBERWICK_FLOW } from '#src/features/screens/flow.ts'

// Emberwick's flow as the runtime reads it (DX.3, decision E-2): the screens and transitions of the base's
// old table, with background and the host's menu handled by the runtime through the room's `openMenu`.
const { data, hash } = EMBERWICK_FLOW
const to = (from: string, event: string) =>
  data.flow.transitions.find((transition) => transition.from === from && transition.event === event)?.to

describe("Emberwick's flow", () => {
  it('starts on the splash and has the five screens', () => {
    expect(data.flow.entry).toBe('splash')
    expect(data.flow.screens).toEqual(['end', 'menu', 'paused', 'room', 'splash'])
  })

  it.each([
    ['splash', 'continue', 'menu'],
    ['menu', 'play', 'room'],
    ['room', 'pause', 'paused'],
    ['room', 'goal', 'end'],
    ['paused', 'resume', 'room'],
    ['paused', 'quit', 'menu'],
    ['end', 'play', 'room'],
    ['end', 'quit', 'menu'],
  ])('%s + %s → %s', (from, event, target) => {
    expect(to(from, event)).toBe(target)
  })

  it('has no other transitions, sorted as the content compiler sorts them', () => {
    const keys = data.flow.transitions.map(({ from, event, to }) => `${from}.${event}.${to}`)
    expect(keys).toHaveLength(8)
    expect([...keys].sort()).toEqual(keys)
  })

  it("is hashed with the content compiler's formula, so the runtime's boot check passes", () => {
    expect(hash).toBe(hex64(xxhash64(utf8(canonicalJson(data)))))
    expect(hash).toMatch(/^[0-9a-f]{16}$/)
  })
})
