import { describe, expect, it } from 'vitest'
import {
  addLineEdits,
  newLineId,
  removeLineEdit,
  scriptLines,
  speakerChoices,
  wordsEdit,
} from '#src/features/writer/writer-model.ts'
import { KIND_WORDS } from '#src/features/writer/writer-words.ts'

const people = { shopkeeper: { name: 'Shopkeeper', role: 'keeps the shop' } }
const file = {
  lines: [
    {
      id: 'shop.welcome_in',
      kind: 'dialogue',
      speaker: 'shopkeeper',
      text: 'shop.welcome_in',
      words: 'Welcome in.',
    },
    { id: 'shop.creak', kind: 'bark', text: 'shop.creak' },
    { id: 'shop.sign', kind: 'examine', speaker: 'old_sign', text: 'shop.sign', words: 'Closed.' },
  ],
} as const

describe('the words for a kind', () => {
  it('say what the line is for, never its name', () => {
    expect(KIND_WORDS.dialogue).toBe('Said in a conversation')
    expect(KIND_WORDS.bark).toBe('Called out')
    expect(KIND_WORDS.caption).toBe('On screen in a cutscene')
    expect(KIND_WORDS.examine).toBe('Read when you look at something')
  })
})

describe('scriptLines', () => {
  it('gives who says each line, the words and the kind in words', () => {
    expect(scriptLines(file, people)).toEqual([
      {
        index: 0,
        id: 'shop.welcome_in',
        who: 'Shopkeeper',
        words: 'Welcome in.',
        kind: 'Said in a conversation',
      },
      { index: 1, id: 'shop.creak', who: '', words: undefined, kind: 'Called out' },
      {
        index: 2,
        id: 'shop.sign',
        who: 'Old sign',
        words: 'Closed.',
        kind: 'Read when you look at something',
      },
    ])
  })

  it('reads a game with no canon', () => {
    expect(scriptLines(file, undefined)[0]?.who).toBe('Shopkeeper')
  })
})

describe('newLineId', () => {
  it('is the scene and the first four words, lower case', () => {
    expect(newLineId('shop', 'Welcome in. Mind the step.', new Set())).toBe('shop.welcome_in_mind_the')
  })
  it('stays unique in the scene', () => {
    const taken = new Set(['shop.welcome_in_mind_the'])
    expect(newLineId('shop', 'Welcome in. Mind the step.', taken)).toBe('shop.welcome_in_mind_the_2')
    taken.add('shop.welcome_in_mind_the_2')
    expect(newLineId('shop', 'Welcome in. Mind the step.', taken)).toBe('shop.welcome_in_mind_the_3')
  })
  it('keeps at most 40 characters after the scene', () => {
    const id = newLineId(
      'shop',
      'Supercalifragilisticexpialidocious pneumonoultramicroscopic extraordinarily long',
      new Set(),
    )
    expect(id.slice('shop.'.length).length).toBeLessThanOrEqual(40)
  })
  it('falls back to “line” when the words have no letters', () => {
    expect(newLineId('shop', '...', new Set())).toBe('shop.line')
  })
})

describe('edits', () => {
  const line = { id: 'shop.hi', kind: 'dialogue', speaker: 'shopkeeper', words: 'Hi.' } as const

  it('adds the first line when the file has no lines key', () => {
    expect(addLineEdits(undefined, line)).toEqual([
      { keyPath: ['lines'], insert: [] },
      {
        keyPath: ['lines'],
        insert: { id: 'shop.hi', kind: 'dialogue', speaker: 'shopkeeper', text: 'shop.hi', words: 'Hi.' },
      },
    ])
  })
  it('appends to a file that has lines, with the id as the key', () => {
    expect(addLineEdits(file, line)).toEqual([
      {
        keyPath: ['lines'],
        insert: { id: 'shop.hi', kind: 'dialogue', speaker: 'shopkeeper', text: 'shop.hi', words: 'Hi.' },
      },
    ])
  })
  it('leaves out an empty speaker', () => {
    const edit = addLineEdits(file, { id: 'shop.x', kind: 'bark', words: 'Hm.' })
    expect(JSON.stringify(edit)).not.toContain('speaker')
  })
  it('sets, inserts and removes the words', () => {
    expect(wordsEdit(0, 'Welcome in.', 'Come in.')).toEqual({
      keyPath: ['lines', 0, 'words'],
      expected: 'Welcome in.',
      set: 'Come in.',
    })
    expect(wordsEdit(1, undefined, 'Hm.')).toEqual({ keyPath: ['lines', 1, 'words'], insert: 'Hm.' })
    expect(wordsEdit(0, 'Welcome in.', '  ')).toEqual({ keyPath: ['lines', 0, 'words'], remove: true })
    expect(wordsEdit(1, undefined, '')).toBeUndefined()
  })
  it('removes a line by place', () => {
    expect(removeLineEdit(2)).toEqual({ keyPath: ['lines', 2], remove: true })
  })
})

describe('speakerChoices', () => {
  it('offers the canon’s people, then the speakers already in the scene', () => {
    expect(speakerChoices(people, file)).toEqual([
      { value: 'shopkeeper', label: 'Shopkeeper' },
      { value: 'old_sign', label: 'Old sign' },
    ])
  })
})
