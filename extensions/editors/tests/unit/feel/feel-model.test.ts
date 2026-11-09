import { DEFAULT_LIMITS, type FeelEntry } from '@automata/feel'
import { describe, expect, it } from 'vitest'
import {
  addEffectEdit,
  addFeelEdit,
  answerEdit,
  type EffectLine,
  effectLines,
  eventWords,
  feelProblemWords,
  fieldChange,
  fieldEdit,
  limitEdit,
  limitLines,
  limitNote,
  removeEffectEdit,
  shakeReach,
  springEdit,
  springLines,
  subjectNote,
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

describe('eventWords for the extensions’ events', () => {
  it('says them as a person would, never as an id with the dots taken out', () => {
    expect(eventWords('systems.mode')).toBe('a character changes mode')
    expect(eventWords('narrative.choices')).toBe('a conversation offers choices')
    expect(eventWords('cutscene.ended')).toBe('a cutscene ends')
    expect(eventWords('narrative.*')).toBe('any conversation event')
    expect(eventWords('cutscene.*')).toBe('any cutscene event')
  })
})

describe('a shake a person can feel', () => {
  it('moves the screen whole pixels, so a small shake rounds to none and says so', () => {
    expect(shakeReach(0.3, 3)).toBe(0)
    expect(shakeReach(0.8, 3)).toBe(2)
    expect(shakeReach(1, 50)).toBe(50)
  })

  it('names what the value does in pixels', () => {
    const line = (shake: number, shake_px?: number) =>
      effectLines(
        { on: 'a', camera: [{ shake }] },
        shake_px === undefined ? undefined : { ...DEFAULT_LIMITS, shake_px },
      )[0]?.fields[0]?.hint
    expect(line(0.8)).toBe('Moves the screen up to 2 px')
    expect(line(0.8, 10)).toBe('Moves the screen up to 6 px')
    expect(line(0.1)).toBe('Too small to move the screen. Raise it, or raise Most shake.')
  })

  it('starts a new shake where it moves the screen', () => {
    const edit = addEffectEdit({ on: 'a' }, 0, 'shake')
    const row = (edit as { insert: [{ shake: number }] }).insert[0]
    expect(shakeReach(row.shake, DEFAULT_LIMITS.shake_px)).toBeGreaterThanOrEqual(1)
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
      {
        key: 'shake',
        label: 'How hard',
        kind: 'number',
        min: 0,
        max: 1,
        step: 0.05,
        value: 0.2,
        hint: 'Too small to move the screen. Raise it, or raise Most shake.',
      },
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
        hint: 'Freezes what was hit',
      },
    ])
    expect(effectLines(entry).find((line) => line.words === 'Freeze the action')?.fields).toHaveLength(1)
    const rumble = effectLines(entry).find((line) => line.words === 'Rumble')
    expect(rumble?.fields.map((field) => field.label)).toEqual([
      'Strong motor',
      'Light motor',
      'How long',
      'Phone buzz',
    ])
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

describe('Which sound', () => {
  const entry: FeelEntry = { on: 'a', audio: [{ cue: 'thud' }] }
  it('is a choice of the game’s sounds, and keeps a name the game lacks, saying so', () => {
    const field = (cues: string[]) =>
      effectLines(entry, DEFAULT_LIMITS, cues).find((line) => line.channel === 'audio')?.fields[0]
    expect(field(['coin', 'thud'])).toMatchObject({
      kind: 'choice',
      value: 'thud',
      options: [
        { value: 'coin', label: 'coin' },
        { value: 'thud', label: 'thud' },
      ],
    })
    expect(field(['coin'])).toMatchObject({
      options: [
        { value: 'coin', label: 'coin' },
        { value: 'thud', label: 'thud (the game has no sound by this name)' },
      ],
    })
    expect(field([])).toMatchObject({ kind: 'text', value: 'thud' })
  })

  it('starts a new sound row on a sound the game has', () => {
    expect(addEffectEdit({ on: 'a' }, 0, 'sound', ['coin', 'thud'])).toEqual({
      keyPath: ['entry', 0, 'audio'],
      insert: [{ cue: 'coin' }],
    })
  })
})

describe('what a freeze, a squash and a word over the subject need', () => {
  it('says nothing happens to the subject when the event is about nobody', () => {
    const freeze = effectLines({ on: 'a', pose: [{ hit_stop_ms: 60 }] })[0] as EffectLine
    const squash = effectLines({ on: 'a', visual: [{ squash: 0.3 }] })[0] as EffectLine
    const shake = effectLines({ on: 'a', camera: [{ shake: 0.8 }] })[0] as EffectLine
    expect(subjectNote(freeze, true)).toBe('Nothing is hit by this, so nothing freezes.')
    expect(subjectNote(squash, true)).toBe('Nothing is hit by this, so nothing squashes.')
    expect(subjectNote(shake, true)).toBeUndefined()
    expect(subjectNote(freeze, false)).toBeUndefined()
  })
})

describe('a word’s hidden name', () => {
  const word = (key: string) => ({ key, words: 'Pow!' })
  it('is never repeated after a word is removed, and never has a star in it', () => {
    const key = (entry: FeelEntry): string =>
      JSON.stringify((addEffectEdit(entry, 0, 'word') as { insert: unknown }).insert)
    expect(key({ on: 'a.b' })).toContain('"a.b.word"')
    expect(key({ on: 'a.b', word: [word('a.b.word'), word('a.b.word2')] })).toContain('"a.b.word3"')
    expect(key({ on: 'a.b', word: [word('a.b.word2')] })).toContain('"a.b.word"')
    expect(key({ on: 'player.*' })).toContain('"player.any.word"')
  })
})

describe('answerEdit', () => {
  it('changes only what a feel answers', () => {
    expect(answerEdit(1, 'player.hit', 'enemy.died')).toEqual({
      keyPath: ['entry', 1, 'on'],
      expected: 'player.hit',
      set: 'enemy.died',
    })
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
    expect(addFeelEdit({}, 'player.hit')).toEqual([{ keyPath: ['entry'], insert: [{ on: 'player.hit' }] }])
  })

  it('add an effect to its channel, or the channel when the feel has none of it', () => {
    expect(addEffectEdit({ on: 'a', camera: [{ shake: 0.1 }] }, 0, 'shake')).toEqual({
      keyPath: ['entry', 0, 'camera'],
      insert: { shake: 0.8 },
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

describe('every field of the file', () => {
  const entry: FeelEntry = {
    on: 'player.hit',
    pose: [{ hit_stop_ms: 200, target: 'subject' }],
    visual: [{ flash: 'white', frames: 5, alpha: 0.9 }, { flash: 'red' }],
    word: [{ key: 'ouch', at: 'subject' }],
    haptic: [{ strong: 0.6, weak: 0.2, ms: 90, phone_ms: 40 }],
  }
  const lines = effectLines(entry)
  const field = (words: string, key: string, at = 0) =>
    lines.filter((line) => line.words === words)[at]?.fields.find((candidate) => candidate.key === key)

  it('has the choices and controls of the spec’s table', () => {
    expect(field('Freeze the action', 'target')).toBeUndefined()
    expect(field('Flash the screen', 'alpha')).toMatchObject({ kind: 'number', value: 0.9, min: 0, max: 1 })
    expect(field('Show a word', 'at')).toMatchObject({ value: 'subject', fallback: 'middle' })
    expect(field('Show a word', 'ms')).toMatchObject({ max: 5000, value: 800 })
    expect(field('Rumble', 'phone_ms')).toMatchObject({ value: 40, max: 1000, fallback: 0 })
  })

  it('says an unset flash plays the most allowed, and has no value to fall back to', () => {
    const plain = field('Flash the screen', 'alpha', 1)
    expect(plain).toMatchObject({ value: 0.85, hint: 'As bright as allowed (0.85)' })
    expect(plain).not.toHaveProperty('fallback')
  })

  it('removes a key when a choice goes back to its default, and adds one when it leaves it', () => {
    const target = field('Show a word', 'at')
    if (target === undefined) throw new Error('no field')
    const place = { channel: 'word', index: 0 } as const
    expect(fieldChange(0, place, target, 'subject', 'middle')).toEqual({
      keyPath: ['entry', 0, 'word', 0, 'at'],
      remove: true,
    })
    expect(fieldChange(0, place, target, undefined, 'middle')).toBeUndefined()
    expect(fieldChange(0, place, target, undefined, 'subject')).toEqual({
      keyPath: ['entry', 0, 'word', 0, 'at'],
      insert: 'subject',
    })
    expect(fieldChange(0, place, target, 'subject', 'subject')).toEqual({
      keyPath: ['entry', 0, 'word', 0, 'at'],
      expected: 'subject',
      set: 'subject',
    })
  })

  it('says when a value is above a limit, and the value the player gets', () => {
    const freeze = lines.find((line) => line.words === 'Freeze the action')
    const flash = lines.find((line) => line.words === 'Flash the screen')
    if (freeze === undefined || flash === undefined) throw new Error('no line')
    expect(limitNote({}, freeze, 'hit_stop_ms')).toBe('Above the longest freeze. Players feel 120 ms.')
    expect(limitNote({ limits: { hit_stop_ms: 300 } }, freeze, 'hit_stop_ms')).toBeUndefined()
    expect(limitNote({}, flash, 'frames')).toBe('Above the most flash frames. Players see 3.')
    expect(limitNote({}, flash, 'alpha')).toBe('Brighter than allowed. Players see 0.85.')
  })
})

describe('what a word says', () => {
  it('shows the words a word says, not the name it is filed under', () => {
    const lines = effectLines({
      on: 'player.hit',
      word: [{ key: 'player.hit.word', words: 'Ouch!', at: 'subject' }],
    })
    const word = lines.find((line) => line.words === 'Show a word')
    expect(word?.fields.map((field) => field.label)).toEqual(['What it says', 'Where', 'How long'])
    expect(word?.fields.find((field) => field.key === 'words')).toMatchObject({
      kind: 'text',
      value: 'Ouch!',
    })
    expect(word?.fields.some((field) => field.key === 'key')).toBe(false)
  })

  it('files a new word under its event, and a second one under another name', () => {
    expect(addEffectEdit({ on: 'player.hit' }, 0, 'word')).toEqual({
      keyPath: ['entry', 0, 'word'],
      insert: [{ key: 'player.hit.word', words: 'Pow!' }],
    })
    expect(
      addEffectEdit({ on: 'player.hit', word: [{ key: 'player.hit.word', words: 'Ouch' }] }, 0, 'word'),
    ).toEqual({
      keyPath: ['entry', 0, 'word'],
      insert: { key: 'player.hit.word2', words: 'Pow!' },
    })
  })
})

describe('how squash moves', () => {
  it('shows the spring with the game’s defaults when the file sets none', () => {
    expect(springLines({}).map((line) => [line.key, line.label, line.value])).toEqual([
      ['f', 'Speed', 4],
      ['zeta', 'Wobble', 0.35],
      ['r', 'Wind-up', 0],
    ])
  })

  it('changes one value of a spring the file has', () => {
    expect(springEdit({ springs: { squash: { f: 4, zeta: 0.35, r: 0 } } }, 'zeta', 0.5)).toEqual({
      keyPath: ['springs', 'squash', 'zeta'],
      expected: 0.35,
      set: 0.5,
    })
  })

  it('writes the whole spring, since the file needs all three values, when it has none', () => {
    expect(springEdit({}, 'zeta', 0.5)).toEqual({
      keyPath: ['springs'],
      insert: { squash: { f: 4, zeta: 0.5, r: 0 } },
    })
    expect(springEdit({ springs: {} }, 'f', 6)).toEqual({
      keyPath: ['springs', 'squash'],
      insert: { f: 6, zeta: 0.35, r: 0 },
    })
  })
})
