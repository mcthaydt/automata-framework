import { describe, expect, it } from 'vitest'
import { dialogueBoxModel } from '#src/features/box/dialogue-box.ts'
import type { LineRecord } from '#src/shared/sim/lines.schema.ts'

// The box's words: what a conversation's current view is, in the player's language. The sim holds line ids and locale keys;
// the words exist only here.

const LINES: Record<string, LineRecord> = {
  'g.hello': { id: 'g.hello', kind: 'dialogue', speaker: 'nurse-jo', text: 'g.hello.text' },
  'g.bye': { id: 'g.bye', kind: 'dialogue', text: 'g.bye.text' },
  'g.ask': { id: 'g.ask', kind: 'dialogue', speaker: 'ada', text: 'g.ask.text' },
  'g.yes': { id: 'g.yes', kind: 'dialogue', text: 'g.yes.text' },
  'g.no': { id: 'g.no', kind: 'dialogue', text: 'g.no.text' },
}
const WORDS: Record<string, string> = {
  'g.hello.text': 'Good morning!',
  'g.bye.text': 'See you.',
  'g.ask.text': 'Will you help?',
  'g.yes.text': 'Of course.',
  'g.no.text': 'Not today.',
  'speaker.ada': 'Ada Reyes',
}
const lines = (id: string) => LINES[id]
const words = (key: string) => WORDS[key]

describe('dialogueBoxModel', () => {
  it('shows nothing when there is no conversation', () => {
    expect(dialogueBoxModel(null, lines, words, 'x')).toBeNull()
  })

  it('shows a line’s speaker and words with Next while more follows', () => {
    const model = dialogueBoxModel(
      { node: 'start', line: 'g.hello', choices: [], last: false },
      lines,
      words,
      'guide',
    )
    // The game gave "nurse-jo" no name: a player never reads an id, so the name is empty and the game is told.
    expect(model).toEqual({
      speaker: '',
      text: 'Good morning!',
      next: true,
      choices: [],
      missing: [],
      missingSpeakers: ['nurse-jo'],
    })
  })

  it('names a speaker by the game’s words when it has some, and falls back to the graph’s speaker', () => {
    const named = dialogueBoxModel(
      { node: 'a', line: 'g.ask', choices: [], last: false },
      lines,
      words,
      'guide',
    )
    expect(named?.speaker).toBe('Ada Reyes')
    const graphs = dialogueBoxModel(
      { node: 'a', line: 'g.bye', choices: [], last: true },
      lines,
      words,
      'ada',
    )
    expect(graphs?.speaker).toBe('Ada Reyes')
  })

  it('offers the choices, by the index the sim takes, and no Next', () => {
    const model = dialogueBoxModel(
      {
        node: 'ask',
        line: 'g.ask',
        choices: [
          { index: 0, line: 'g.yes' },
          { index: 2, line: 'g.no' },
        ],
        last: false,
      },
      lines,
      words,
      'guide',
    )
    expect(model?.next).toBe(false)
    expect(model?.choices).toEqual([
      { index: 0, text: 'Of course.' },
      { index: 2, text: 'Not today.' },
    ])
  })

  it('keeps Next on the last line of a conversation, so the player can end it', () => {
    const model = dialogueBoxModel(
      { node: 'bye', line: 'g.bye', choices: [], last: true },
      lines,
      words,
      'guide',
    )
    expect(model?.next).toBe(true)
  })

  it('never shows a key: a line with no words shows an empty line and is listed once as missing', () => {
    const model = dialogueBoxModel(
      { node: 'x', line: 'g.hello', choices: [{ index: 0, line: 'g.unknown' }], last: false },
      lines,
      (key) => (key === 'g.hello.text' ? undefined : WORDS[key]),
      'guide',
    )
    expect(model?.text).toBe('')
    expect(model?.choices).toEqual([{ index: 0, text: '' }])
    expect(model?.missing).toEqual(['g.hello', 'g.unknown'])
  })

  it('shows the speaker with an empty line when the conversation has no line to say', () => {
    const model = dialogueBoxModel({ node: 'x', line: null, choices: [], last: true }, lines, words, 'ada')
    expect(model).toEqual({
      speaker: 'Ada Reyes',
      text: '',
      next: true,
      choices: [],
      missing: [],
      missingSpeakers: [],
    })
  })
})
