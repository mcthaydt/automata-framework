import { describe, expect, it } from 'vitest'
import {
  addChoiceEdit,
  addPartEdit,
  choiceFactEdit,
  conditionWords,
  layoutConversation,
  partIdOf,
  partWords,
  readingOrder,
  removeChoiceEdit,
  renamePartEdits,
  renameProblem,
  setNextEdit,
  setStanceEdit,
  stanceWords,
} from '#src/features/writer/dialogue-model.ts'

const graph = {
  id: 'shop.talk',
  speaker: 'shopkeeper',
  start: 'hello',
  nodes: {
    goodbye: { say: ['shop.bye'] },
    browsing: { say: ['shop.look'], next: 'goodbye' },
    hello: {
      say: ['shop.hi'],
      choices: [
        { line: 'shop.just_looking', next: 'browsing', stance: 1 },
        { line: 'shop.key', next: 'browsing', set: { askedKey: true } },
      ],
    },
    lost: { say: [], next: 'goodbye' },
  },
} as const

describe('readingOrder', () => {
  it('starts at the start, goes by first reach, and puts unreachable parts last', () => {
    expect(readingOrder(graph)).toEqual(['hello', 'browsing', 'goodbye', 'lost'])
  })
  it('ends on a loop', () => {
    const loop = { ...graph, nodes: { ...graph.nodes, goodbye: { say: [], next: 'hello' } } }
    expect(readingOrder(loop)).toEqual(['hello', 'browsing', 'goodbye', 'lost'])
  })
})

describe('part names', () => {
  it('read as words and write back as ids', () => {
    expect(partWords('browsing')).toBe('Browsing')
    expect(partWords('ask_about_key')).toBe('Ask about key')
    expect(partIdOf('Ask about the key!')).toBe('ask_about_the_key')
    expect(partIdOf('  ')).toBe('part')
  })
})

describe('conditionWords', () => {
  const names = (id: string) => id
  it('says each condition as a sentence', () => {
    expect(conditionWords({ has: 'key' }, names)).toBe('the player has the key')
    expect(conditionWords({ fact: 'trust', atLeast: 2 }, names)).toBe('trust is at least 2')
    expect(conditionWords({ fact: 'trust', atMost: 1 }, names)).toBe('trust is at most 1')
    expect(conditionWords({ fact: 'asked_key', is: true }, names)).toBe('asked key is yes')
    expect(conditionWords({ fact: 'mood', is: 'calm' }, names)).toBe('mood is calm')
    expect(conditionWords({ not: { has: 'key' } }, names)).toBe('not (the player has the key)')
    expect(conditionWords({ any: [{ has: 'key' }, { fact: 'trust', atLeast: 2 }] }, names)).toBe(
      'any of (the player has the key, trust is at least 2)',
    )
  })
})

describe('stanceWords', () => {
  it('says warmer and colder with the sign', () => {
    expect(stanceWords(1)).toBe('Warmer +1')
    expect(stanceWords(-1)).toBe('Colder −1')
    expect(stanceWords(0)).toBe('No change')
    expect(stanceWords(undefined)).toBe('No change')
  })
})

describe('choice edits', () => {
  const path = ['graphs', 0, 'nodes', 'hello', 'choices']
  it('adds, removes and retargets a choice', () => {
    expect(addChoiceEdit(0, 'goodbye', graph.nodes.goodbye, { line: 'shop.x', next: 'hello' })).toEqual({
      keyPath: ['graphs', 0, 'nodes', 'goodbye', 'choices'],
      insert: [{ line: 'shop.x', next: 'hello' }],
    })
    expect(addChoiceEdit(0, 'hello', graph.nodes.hello, { line: 'shop.x', next: 'hello' })).toEqual({
      keyPath: path,
      insert: { line: 'shop.x', next: 'hello' },
    })
    expect(removeChoiceEdit(0, 'hello', 1)).toEqual({ keyPath: [...path, 1], remove: true })
    expect(setNextEdit(0, 'hello', 0, 'browsing', 'goodbye')).toEqual({
      keyPath: [...path, 0, 'next'],
      expected: 'browsing',
      set: 'goodbye',
    })
  })
  it('sets standing, and removes the key for no change', () => {
    expect(setStanceEdit(0, 'hello', 0, 1, -1)).toEqual({
      keyPath: [...path, 0, 'stance'],
      expected: 1,
      set: -1,
    })
    expect(setStanceEdit(0, 'hello', 1, undefined, 1)).toEqual({ keyPath: [...path, 1, 'stance'], insert: 1 })
    expect(setStanceEdit(0, 'hello', 0, 1, 0)).toEqual({ keyPath: [...path, 0, 'stance'], remove: true })
    expect(setStanceEdit(0, 'hello', 1, undefined, 0)).toBeUndefined()
  })
  it('remembers and forgets a fact', () => {
    expect(choiceFactEdit(0, 'hello', 0, undefined, 'asked', true)).toEqual({
      keyPath: [...path, 0, 'set'],
      insert: { asked: true },
    })
    expect(choiceFactEdit(0, 'hello', 1, { askedKey: true }, 'met', 'yes')).toEqual({
      keyPath: [...path, 1, 'set', 'met'],
      insert: 'yes',
    })
    expect(choiceFactEdit(0, 'hello', 1, { askedKey: true }, 'askedKey', false)).toEqual({
      keyPath: [...path, 1, 'set', 'askedKey'],
      expected: true,
      set: false,
    })
    expect(choiceFactEdit(0, 'hello', 1, { askedKey: true }, 'askedKey', undefined)).toEqual({
      keyPath: [...path, 1, 'set'],
      remove: true,
    })
    expect(choiceFactEdit(0, 'hello', 1, { a: 1, b: 2 }, 'a', undefined)).toEqual({
      keyPath: [...path, 1, 'set', 'a'],
      remove: true,
    })
  })
})

describe('parts', () => {
  it('adds a part that says nothing yet', () => {
    expect(addPartEdit(0, 'asking')).toEqual({
      keyPath: ['graphs', 0, 'nodes', 'asking'],
      insert: { say: [] },
    })
  })

  it('renames a part everywhere it is named, in one list of edits', () => {
    const edits = renamePartEdits(0, graph, 'browsing', 'looking_around')
    // Both choices of "hello" lead to browsing: each follows.
    expect(edits).toContainEqual({
      keyPath: ['graphs', 0, 'nodes', 'hello', 'choices', 0, 'next'],
      expected: 'browsing',
      set: 'looking_around',
    })
    expect(edits).toContainEqual({
      keyPath: ['graphs', 0, 'nodes', 'hello', 'choices', 1, 'next'],
      expected: 'browsing',
      set: 'looking_around',
    })
    // The part itself moves to its new name and the old one goes.
    expect(edits).toContainEqual({
      keyPath: ['graphs', 0, 'nodes', 'looking_around'],
      insert: { say: ['shop.look'], next: 'goodbye' },
    })
    expect(edits.at(-1)).toEqual({ keyPath: ['graphs', 0, 'nodes', 'browsing'], remove: true })
  })

  it('renames the start and a part that leads to itself', () => {
    const edits = renamePartEdits(
      0,
      { ...graph, nodes: { ...graph.nodes, hello: { say: [], next: 'hello' } } },
      'hello',
      'greeting',
    )
    expect(edits).toContainEqual({ keyPath: ['graphs', 0, 'start'], expected: 'hello', set: 'greeting' })
    expect(edits).toContainEqual({
      keyPath: ['graphs', 0, 'nodes', 'greeting'],
      insert: { say: [], next: 'greeting' },
    })
  })

  it('refuses a name another part has, or no name', () => {
    expect(renameProblem(graph, 'browsing', 'goodbye')).toBe('There is already a part called Goodbye.')
    expect(renameProblem(graph, 'browsing', '  ')).toBe('Give the part a name.')
    expect(renameProblem(graph, 'browsing', 'Browsing')).toBeUndefined()
    expect(renameProblem(graph, 'browsing', 'Looking around')).toBeUndefined()
  })
})

describe('layoutConversation', () => {
  it('puts parts in rows by distance from the start and draws a way back as a loop', () => {
    const loop = { ...graph, nodes: { ...graph.nodes, goodbye: { say: [], next: 'hello' } } }
    const { boxes, arrows } = layoutConversation(loop)
    const row = (id: string) => boxes.find((box) => box.id === id)?.row
    expect(row('hello')).toBe(0)
    expect(row('browsing')).toBe(1)
    expect(row('goodbye')).toBe(2)
    expect(row('lost')).toBe(3)
    expect(arrows.find((arrow) => arrow.from === 'goodbye' && arrow.to === 'hello')?.back).toBe(true)
    expect(arrows.find((arrow) => arrow.from === 'hello' && arrow.to === 'browsing')?.back).toBe(false)
  })
})
