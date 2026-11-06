// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { determinismText } from '../../src/lib/playground/determinism'

// The determinism row's words (spec §13): it says only what this browser checked.
describe('determinismText', () => {
  it('names the golden, the framework and the hash when the original replays it', () => {
    expect(determinismText({ kind: 'pass', ticks: 120, hash: '0123456789abcdef', framework: 'f8023a907725cccd84277372c0d4f1b73d2da90c' }, 'shapes-rects')).toBe(
      'Determinism: these 120 ticks replay in this browser to the golden recorded in the framework (examples/__goldens__/shapes-rects.replay, framework f8023a9). Hash 0123456789abcdef.',
    )
  })

  it('names the tick where this browser diverged', () => {
    expect(determinismText({ kind: 'diverged', tick: 37 }, 'shapes-rects')).toBe('Determinism: this browser diverged from the golden at tick 37.')
  })

  it('claims no golden for an edit', () => {
    expect(determinismText({ kind: 'edited', ticks: 180, hash: 'fedcba9876543210' }, 'audio-sound')).toBe(
      "Your edit: 180 ticks hash to fedcba9876543210 in this browser. The golden belongs to the original code; agreement across engines is checked in the framework's CI.",
    )
  })

  it('says the check is running', () => {
    expect(determinismText({ kind: 'checking', ticks: 240 }, 'core-leaderboard')).toBe('Determinism: checking 240 ticks in this browser…')
  })
})
