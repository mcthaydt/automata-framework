import { describe, expect, it } from 'vitest'
import { partView, playChoose, structureProblems, wayOut } from '#src/features/writer/writer-problems.ts'

const lines = {
  lines: [{ id: 'shop.hi' }, { id: 'shop.look' }, { id: 'shop.bye' }, { id: 'shop.just' }],
} as never

const good = {
  id: 'shop.talk',
  speaker: 'shopkeeper',
  start: 'hello',
  nodes: {
    hello: {
      say: ['shop.hi'],
      choices: [
        { line: 'shop.just', next: 'goodbye', stance: 1 },
        { line: 'shop.just', next: 'browsing', set: { looked: true } },
      ],
    },
    browsing: { say: ['shop.look'], next: 'goodbye' },
    goodbye: { say: ['shop.bye'] },
  },
} as const

describe('structureProblems', () => {
  it('says nothing about a conversation that works', () => {
    expect(structureProblems(good, lines)).toEqual([])
  })

  it('says a part nothing leads to cannot be reached', () => {
    const graph = { ...good, nodes: { ...good.nodes, lonely: { say: [], next: 'goodbye' } } }
    expect(structureProblems(graph, lines)).toEqual([
      { part: 'lonely', words: 'Nothing leads to Lonely, so no one can reach it.' },
    ])
  })

  it('says when no part ends the conversation', () => {
    const graph = { ...good, nodes: { ...good.nodes, goodbye: { say: ['shop.bye'], next: 'hello' } } }
    expect(structureProblems(graph, lines)).toEqual([
      { part: 'hello', words: 'No part ends this conversation, so it never ends.' },
    ])
  })

  it('says a part that cannot reach the end', () => {
    const graph = {
      ...good,
      nodes: {
        ...good.nodes,
        browsing: { say: ['shop.look'], next: 'stuck' },
        stuck: { say: [], next: 'stuck2' },
        stuck2: { say: [], next: 'stuck' },
      },
    }
    const words = structureProblems(graph, lines).map((problem) => problem.words)
    expect(words).toContain('Goodbye is never reached from here, so this conversation never ends.')
  })

  it('says a second way out', () => {
    const graph = { ...good, nodes: { ...good.nodes, browsing: { say: ['shop.look'] } } }
    expect(structureProblems(graph, lines)).toEqual([
      { part: 'browsing', words: 'Browsing ends the conversation by itself. Make it go on to Goodbye.' },
    ])
  })

  it('blames the new branch, not the ending everything runs into', () => {
    // Two parts lead to Goodbye; Joke is the one new part nothing leads on from. Joke comes first in reading order.
    const graph = {
      ...good,
      nodes: {
        ...good.nodes,
        hello: {
          ...good.nodes.hello,
          choices: [{ line: 'shop.just', next: 'joke' }, ...good.nodes.hello.choices],
        },
        joke: { say: ['shop.look'] },
      },
    }
    expect(wayOut(graph as never)).toBe('goodbye')
    expect(structureProblems(graph as never, lines)).toEqual([
      { part: 'joke', words: 'Joke ends the conversation by itself. Make it go on to Goodbye.' },
    ])
  })

  it('says a part that says a line that is gone, without its id', () => {
    const graph = { ...good, nodes: { ...good.nodes, browsing: { say: ['shop.gone'], next: 'goodbye' } } }
    const problems = structureProblems(graph, lines)
    expect(problems).toEqual([{ part: 'browsing', words: 'This part says a line that no longer exists.' }])
    expect(JSON.stringify(problems)).not.toContain('shop.gone')
  })

  it('says a part that only sometimes happens needs a Then', () => {
    const graph = {
      ...good,
      nodes: {
        ...good.nodes,
        browsing: { say: ['shop.look'], next: 'goodbye', when: [{ has: 'key' }] },
        hello: { say: ['shop.hi'], next: 'browsing' },
      },
    }
    expect(structureProblems(graph, lines)).toEqual([])
    const gated = {
      ...graph,
      nodes: {
        ...graph.nodes,
        browsing: { say: ['shop.look'], when: [{ has: 'key' }] },
        goodbye: { say: [] },
      },
    }
    expect(structureProblems(gated, lines).map((p) => p.words)).toContain(
      'Something leads straight to Browsing, which only happens sometimes, so it needs a Then.',
    )
  })
})

describe('Play it', () => {
  it('shows a part’s lines and choices, then follows a choice with its facts', () => {
    const start = partView(good, 'hello', {})
    expect(start).toMatchObject({ at: 'hello', said: ['shop.hi'], ended: false })
    expect(start.choices).toEqual([
      { index: 0, line: 'shop.just' },
      { index: 1, line: 'shop.just' },
    ])
    const next = playChoose(good, 'hello', {}, 1)
    expect(next).toEqual({ at: 'browsing', facts: { looked: true } })
    expect(partView(good, next.at, next.facts)).toMatchObject({ said: ['shop.look'], goesOn: 'goodbye' })
  })

  it('stops at a part with no way out', () => {
    expect(partView(good, 'goodbye', {})).toMatchObject({ ended: true, choices: [], goesOn: undefined })
  })

  it('passes over a part whose conditions fail', () => {
    const graph = {
      ...good,
      nodes: {
        ...good.nodes,
        hello: { say: ['shop.hi'], next: 'browsing' },
        browsing: { say: ['shop.look'], next: 'goodbye', when: [{ fact: 'looked', is: true }] },
      },
    }
    expect(partView(graph, 'browsing', {}).at).toBe('goodbye')
    expect(partView(graph, 'browsing', { looked: true }).at).toBe('browsing')
  })
})
