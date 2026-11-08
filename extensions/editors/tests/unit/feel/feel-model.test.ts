import type { FeelEntry } from '@automata/feel'
import { describe, expect, it } from 'vitest'
import {
  addEffectEdit,
  addFeelEdit,
  effectLines,
  eventWords,
  feelProblemWords,
  fieldEdit,
  limitEdit,
  limitLines,
  removeEffectEdit,
} from '#src/features/feel/feel-model.ts'

describe('eventWords', () => {
  it('reads an event id as words', () => {
    expect(eventWords('player.hit')).toBe('player hit')
    expect(eventWords('enemy_died')).toBe('enemy died')
  })

  it('reads a pattern as any event of its kind', () => {
    expect(eventWords('door.*')).toBe('any door event')
    expect(eventWords('*')).toBe('anything')
  })
})

describe('effectLines', () => {
  const entry: FeelEntry = {
    on: 'player.hit',
    camera: [{ shake: 0.2 }],
    pose: [{ hit_stop_ms: 80 }],
    visual: [{ flash: 'white', frames: 2 }, { tint: 'red', ms: 120, alpha: 0.4 }, { squash: 0.3 }],
    word: [{ key: 'ouch' }],
    haptic: [{ strong: 0.6, weak: 0.2, ms: 90 }],
    audio: [{ cue: 'thud' }],
  }

  it('says each effect as a sentence, in the order a player feels them', () => {
    expect(effectLines(entry).map((line) => line.words)).toEqual([
      'Shake the screen',
      'Freeze the action',
      'Flash the screen',
      'Tint the screen',
      'Squash',
      'Show a word',
      'Rumble',
      'Play a sound',
    ])
  })

  it('gives each effect its fields, named for a person, with their values', () => {
    const [shake, freeze] = effectLines(entry)
    expect(shake?.fields).toEqual([
      { key: 'shake', label: 'How hard', kind: 'number', min: 0, max: 1, step: 0.05, value: 0.2 },
    ])
    expect(freeze?.fields).toEqual([
      {
        key: 'hit_stop_ms',
        label: 'How long',
        unit: 'ms',
        kind: 'number',
        min: 1,
        max: 1000,
        step: 10,
        value: 80,
      },
    ])
    const rumble = effectLines(entry).find((line) => line.words === 'Rumble')
    expect(rumble?.fields.map((field) => field.label)).toEqual(['Strong motor', 'Light motor', 'How long'])
    const sound = effectLines(entry).find((line) => line.words === 'Play a sound')
    expect(sound?.fields).toEqual([{ key: 'cue', label: 'Which sound', kind: 'text', value: 'thud' }])
  })

  it('places each line by its channel and row', () => {
    const lines = effectLines(entry)
    expect(lines.map((line) => [line.channel, line.index])).toEqual([
      ['camera', 0],
      ['pose', 0],
      ['visual', 0],
      ['visual', 1],
      ['visual', 2],
      ['word', 0],
      ['haptic', 0],
      ['audio', 0],
    ])
  })
})

describe('the edits', () => {
  it('change one field of one effect', () => {
    expect(fieldEdit(2, { channel: 'camera', index: 0 }, 'shake', 0.2, 0.4)).toEqual({
      keyPath: ['entry', 2, 'camera', 0, 'shake'],
      expected: 0.2,
      set: 0.4,
    })
  })

  it('add a feel at the end, or the first one when there are none', () => {
    expect(addFeelEdit({ entry: [{ on: 'a' }] }, 'player.hit')).toEqual([
      { keyPath: ['entry'], insert: { on: 'player.hit' } },
    ])
    expect(addFeelEdit({}, 'player.hit')).toEqual([
      { keyPath: ['entry'], insert: [] },
      { keyPath: ['entry'], insert: { on: 'player.hit' } },
    ])
  })

  it('add an effect to its channel, or the channel when the feel has none of it', () => {
    expect(addEffectEdit({ on: 'a', camera: [{ shake: 0.1 }] }, 0, 'shake')).toEqual({
      keyPath: ['entry', 0, 'camera'],
      insert: { shake: 0.3 },
    })
    expect(addEffectEdit({ on: 'a' }, 1, 'freeze')).toEqual({
      keyPath: ['entry', 1, 'pose'],
      insert: [{ hit_stop_ms: 60 }],
    })
  })

  it('remove one effect', () => {
    expect(removeEffectEdit(0, { channel: 'visual', index: 1 })).toEqual({
      keyPath: ['entry', 0, 'visual', 1],
      remove: true,
    })
  })
})

describe('the limits', () => {
  it('read the defaults where the file sets none', () => {
    expect(
      limitLines({ limits: { shake_px: 5 } }).map((line) => [line.label, line.value, line.unit]),
    ).toEqual([
      ['Most shake', 5, 'px'],
      ['Longest freeze', 120, 'ms'],
      ['Most flash frames', 3, undefined],
      ['Brightest flash', 0.85, undefined],
    ])
  })

  it('change a limit the file has, add one it does not, and add the table when there is none', () => {
    expect(limitEdit({ limits: { shake_px: 5 } }, 'shake_px', 6)).toEqual({
      keyPath: ['limits', 'shake_px'],
      expected: 5,
      set: 6,
    })
    expect(limitEdit({ limits: { shake_px: 5 } }, 'hit_stop_ms', 90)).toEqual({
      keyPath: ['limits', 'hit_stop_ms'],
      insert: 90,
    })
    expect(limitEdit({}, 'hit_stop_ms', 90)).toEqual({ keyPath: ['limits'], insert: { hit_stop_ms: 90 } })
  })
})

describe('feelProblemWords', () => {
  it("says two feels for one event in the person's words", () => {
    expect(
      feelProblemWords({ keyPath: ['entry', 1, 'on'], message: 'Two entries answer player.hit.' }, [
        { on: 'player.hit' },
        { on: 'player.hit' },
      ]),
    ).toBe('Another feel already answers player hit.')
  })

  it('keeps every other problem as it is', () => {
    expect(
      feelProblemWords({ keyPath: ['entry', 0, 'camera', 0, 'shake'], message: 'Must be 1 or less.' }, []),
    ).toBe('Must be 1 or less.')
  })
})
