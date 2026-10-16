import { describe, expect, it } from 'vitest'
import { type FlowEvent, next, type Screen } from './flow.ts'

describe('the screen flow', () => {
  it('goes splash, menu, room, end, and back round', () => {
    let screen: Screen = 'splash'
    for (const event of ['continue', 'play', 'goal', 'play', 'goal', 'quit'] as const)
      screen = next(screen, event)
    expect(screen).toBe('menu')
  })

  it.each([
    ['room', 'pause', 'paused'],
    ['room', 'background', 'paused'],
    ['room', 'menu-request', 'paused'],
    ['paused', 'resume', 'room'],
    ['paused', 'quit', 'menu'],
    ['end', 'play', 'room'],
    ['end', 'quit', 'menu'],
  ] as const)('%s + %s → %s', (from, event, to) => {
    expect(next(from, event)).toBe(to)
  })

  it('ignores events that make no sense on a screen', () => {
    const ignored: Array<[Screen, FlowEvent]> = [
      ['splash', 'play'],
      ['menu', 'pause'],
      ['menu', 'goal'],
      ['paused', 'goal'],
      ['paused', 'background'],
      ['end', 'pause'],
      ['room', 'continue'],
    ]
    for (const [screen, event] of ignored) expect(next(screen, event)).toBe(screen)
  })
})
