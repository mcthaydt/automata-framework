// How a line is said: a direction for the writer, a pace, and pauses counted by sentence (not marked in the words, so a
// translation never has to carry them). The typed-out text and the content check both read the same split into sentences.
import { describe, expect, it } from 'vitest'
import { deliveryProblems, sentences, typed } from '#src/shared/sim/delivery.ts'
import { lineSchema } from '#src/shared/sim/lines.schema.ts'

const TWO = 'Cold tonight. The river is high.'

describe('sentences', () => {
  it('splits English on full stops, question marks and exclamations', () => {
    expect(sentences('Cold tonight. The river is high! Who is there?')).toEqual([
      'Cold tonight.',
      'The river is high!',
      'Who is there?',
    ])
  })

  it('splits Japanese on 。！？ with no spaces to help', () => {
    expect(sentences('今夜は寒い。川は高い！誰ですか？')).toEqual([
      '今夜は寒い。',
      '川は高い！',
      '誰ですか？',
    ])
  })

  it('splits a two-line note on its line break, and keeps a run of marks together', () => {
    expect(sentences('Bed 4\nAda, 28 years')).toEqual(['Bed 4', 'Ada, 28 years'])
    expect(sentences('Wait... what?!')).toEqual(['Wait...', 'what?!'])
  })

  it('gives words with no mark one sentence, and nothing for nothing', () => {
    expect(sentences('Not yet')).toEqual(['Not yet'])
    expect(sentences('')).toEqual([])
  })
})

describe('typed', () => {
  it('shows characters at the rate, from none to all', () => {
    expect(typed('abcd', undefined, 0, 10)).toEqual({ shown: 0, done: false })
    expect(typed('abcd', undefined, 0.2, 10)).toEqual({ shown: 2, done: false })
    expect(typed('abcd', undefined, 0.4, 10)).toEqual({ shown: 4, done: true })
    expect(typed('abcd', undefined, 9, 10)).toEqual({ shown: 4, done: true })
  })

  it('holds at the end of a sentence for a beat of 0.35 s, then goes on', () => {
    // "Cold tonight." is 13 characters; at 10 a second it is typed by 1.3 s, and held to 1.65 s.
    const delivery = { beats: [{ after: 1, pause: 1 }] }
    expect(typed(TWO, delivery, 1.3, 10).shown).toBe(13)
    expect(typed(TWO, delivery, 1.6, 10).shown).toBe(13)
    expect(typed(TWO, delivery, 1.75, 10).shown).toBe(14)
    expect(typed(TWO, undefined, 1.6, 10).shown).toBe(16)
  })

  it('a long beat (2) holds twice as long, and pace is a multiplier on the rate, not on the beat', () => {
    expect(typed(TWO, { beats: [{ after: 1, pause: 2 }] }, 1.95, 10).shown).toBe(13)
    expect(typed(TWO, { beats: [{ after: 1, pause: 2 }] }, 2.15, 10).shown).toBe(14)
    expect(typed('abcd', { pace: 2 }, 0.2, 10)).toEqual({ shown: 4, done: true })
  })

  it('does not wait after the last sentence', () => {
    const delivery = { beats: [{ after: 2, pause: 2 }] }
    expect(typed(TWO, delivery, 3.2, 10)).toEqual({ shown: 32, done: true })
  })

  it('says nothing is shown before it begins', () => {
    expect(typed(TWO, undefined, -1, 10)).toEqual({ shown: 0, done: false })
  })
})

describe('delivery in a line record', () => {
  const line = (delivery: unknown, words = TWO) => ({ id: 'a.b', kind: 'bark', text: 'a.b', words, delivery })

  it('is optional, and reads how, pace and beats', () => {
    expect(lineSchema.safeParse({ id: 'a.b', kind: 'bark', text: 'a.b' }).success).toBe(true)
    const delivery = { how: 'tired, half asleep', pace: 0.8, beats: [{ after: 1, pause: 2 }] }
    expect(lineSchema.parse(line(delivery)).delivery).toEqual(delivery)
  })

  it('refuses a pace or a pause that is not above zero, and a strange member', () => {
    expect(lineSchema.safeParse(line({ pace: 0 })).success).toBe(false)
    expect(lineSchema.safeParse(line({ beats: [{ after: 1, pause: 0 }] })).success).toBe(false)
    expect(lineSchema.safeParse(line({ speed: 2 })).success).toBe(false)
  })

  it('refuses a beat past the last sentence, naming the line and what the words have', () => {
    const read = lineSchema.safeParse(line({ beats: [{ after: 3, pause: 1 }] }))
    expect(read.success).toBe(false)
    expect(read.error?.issues[0]?.message).toBe(
      'line a.b: a beat follows sentence 3, but its words have only 2',
    )
    expect(deliveryProblems('a.b', { beats: [{ after: 2, pause: 1 }] }, TWO)).toEqual([])
  })
})
