// The dialogue runtime (M6 spec §4.7, NR-a): the adventure source's four runtime cases, on its toy graph, as pure
// functions over a conversation's place (the sim keeps the place in a resource).
import { describe, expect, it } from 'vitest'
import {
  advance,
  applyChoice,
  choose,
  type DialogueGraph,
  freshDialogue,
  readerOf,
  start,
  view,
} from './index'

/** A conversation: two lines, three answers that join again, a line only a warm player hears, one exit. */
const TALK: DialogueGraph = {
  id: 'meet',
  speaker: 'porter',
  start: 'open',
  nodes: {
    open: {
      say: ['toy.hello', 'toy.ask'],
      choices: [
        { line: 'toy.duty', stance: -1, next: 'join' },
        { line: 'toy.unsure', next: 'join' },
        { line: 'toy.yours', stance: 1, set: { metPorter: true }, next: 'join' },
      ],
    },
    join: { say: [], next: 'warm' },
    warm: { say: ['toy.warm'], when: [{ fact: 'light', is: 'lighter' }], next: 'bye' },
    bye: { say: ['toy.bye'] },
  },
}
const BOUNDS = { min: -4, max: 4 }

describe('dialogue runtime', () => {
  it('says each line on an advance, offers the choices with the last line, and never moves on its own', () => {
    let state = freshDialogue()
    const read = () => readerOf(state)
    let at = start(TALK, read())
    expect(view(TALK, at, read())).toMatchObject({ node: 'open', line: 'toy.hello', choices: [] })
    at = advance(TALK, at, read())
    expect(view(TALK, at, read())).toMatchObject({
      line: 'toy.ask',
      choices: [{ index: 0, line: 'toy.duty' }, { index: 1 }, { index: 2 }],
    })
    // A choice is waiting: an advance changes nothing.
    expect(advance(TALK, at, read())).toEqual(at)
    const picked = choose(TALK, at, 2, read())
    if (picked === null) throw new Error('not on offer')
    expect(picked.choice.line).toBe('toy.yours')
    state = applyChoice(state, picked.choice, BOUNDS)
    expect(state).toEqual({ stance: 1, facts: { metPorter: true } })
    // `warm` needs a lit lighter: passed over, so the next line is the exit's.
    at = choose(TALK, at, 2, read())?.at ?? null
    expect(view(TALK, at, read())).toMatchObject({ node: 'bye', line: 'toy.bye', last: true })
    at = advance(TALK, at, read())
    expect(at).toBeNull()
    expect(view(TALK, at, read())).toBeNull()
  })

  it('reads stance, the dialogue facts, then the base (puzzle facts and items)', () => {
    const r = readerOf(
      { stance: -2, facts: { asked: true } },
      { fact: (n) => (n === 'light' ? 'off' : undefined), has: (i) => i === 'lighter' },
    )
    expect([r.fact('stance'), r.fact('asked'), r.fact('light'), r.fact('player'), r.has('lighter')]).toEqual([
      -2,
      true,
      'off',
      undefined,
      true,
    ])
  })

  it('clamps stance to the canon axis and keeps earlier facts (NR-a)', () => {
    const s = applyChoice({ stance: 3, facts: { a: 1 } }, { stance: 5, set: { b: 2 } }, BOUNDS)
    expect(s).toEqual({ stance: 4, facts: { a: 1, b: 2 } })
    expect(applyChoice(s, { stance: -20 }, BOUNDS).stance).toBe(-4)
    expect(applyChoice(s, { stance: -20 }, { min: -1, max: 1 }).stance).toBe(-1)
  })

  it('hides a choice whose target node is gated shut', () => {
    const graph: DialogueGraph = {
      ...TALK,
      nodes: {
        ...TALK.nodes,
        open: {
          say: ['toy.ask'],
          choices: [
            { line: 'toy.duty', next: 'warm' },
            { line: 'toy.unsure', next: 'bye' },
          ],
        },
      },
    }
    const cold = readerOf(freshDialogue())
    expect(view(graph, start(graph, cold), cold)?.choices).toEqual([{ index: 1, line: 'toy.unsure' }])
    const warm = readerOf(freshDialogue(), { fact: (n) => (n === 'light' ? 'lighter' : undefined) })
    expect(view(graph, start(graph, warm), warm)?.choices.map((c) => c.index)).toEqual([0, 1])
  })
})
