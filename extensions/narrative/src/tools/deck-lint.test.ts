// `lintDeck` (M6.8b step 3): the storylet deck's checks from the source's `checkDeck`: a line that is not a record, a
// trigger that cannot fire, a condition that never holds, a fact stated before the scene that teaches it, a beat a
// storylet delivers. Who may not have storylets is the game's (NR-D8).
import { scenePuzzle } from '@mcthaydt/automata-puzzle/testing/converted-puzzles'
import clinicMapToml from '@mcthaydt/automata-sectors/testing/fixtures/clinic.sector-map.toml?raw'
import { parse } from 'smol-toml'
import { describe, expect, it } from 'vitest'
import type { Canon, DialogueGraph, LineRecord, Storylet } from '../sim/index'
import { fixture } from '../testing/converted-narrative'
import { RECORDS } from '../testing/toy-dialogue'
import { type DeckLintInput, lintDeck } from './deck-lint'

const records = [
  ...RECORDS,
  { id: 'toy.fact', kind: 'bark' as const, text: 'toy.fact', facts: ['ledger'] },
  { id: 'toy.beat', kind: 'bark' as const, text: 'toy.beat', beat: 'toy.learn' },
]
const ctx = (over: Partial<DeckLintInput> = {}): DeckLintInput => ({
  scene: 'toy',
  storylets: [],
  records,
  facts: [{ id: 'ledger', text: 'x', revealedIn: ['toy', 'later'] }],
  beats: [{ id: 'toy.learn', required: true }],
  hotspots: ['door', 'bed'],
  rooms: ['ward', 'Reception'],
  known: (name) => name === 'power',
  ...over,
})
const deck = (...s: Partial<Storylet>[]): Storylet[] =>
  s.map((x, i) => ({ id: `st.${i}`, trigger: 'inspect:door', lines: ['toy.hello'], ...x }))
const found = (storylets: Storylet[], over: Partial<DeckLintInput> = {}) =>
  lintDeck(ctx({ storylets, ...over })).map((f) => `${f.level} ${f.rule} ${f.id}`)

describe('lintDeck', () => {
  it('passes a sound deck', () => {
    const storylets = deck(
      {},
      {
        trigger: 'enter:ward',
        when: [
          { fact: 'power', is: true },
          { fact: 'played.st.0', atLeast: 1 },
        ],
      },
      { trigger: 'dwell:Reception:8', max: 3 },
      { trigger: 'system:fuel.low', once: true },
    )
    expect(found(storylets)).toEqual([])
  })
  it('fails two storylets with one id, a storylet with no lines, and once with max', () => {
    expect(found([...deck({}), ...deck({})])).toEqual(['error storylet st.0'])
    expect(found(deck({ lines: [] }))).toEqual(['error line st.0'])
    expect(found(deck({ once: true, max: 2 }))).toEqual(['error storylet st.0'])
  })
  it('fails a trigger that can never fire: no such hotspot, no such room', () => {
    expect(found(deck({ trigger: 'inspect:window' }))).toEqual(['error trigger st.0'])
    expect(found(deck({ trigger: 'enter:attic' }))).toEqual(['error trigger st.0'])
    expect(found(deck({ trigger: 'dwell:attic:4' }))).toEqual(['error trigger st.0'])
    expect(found(deck({ trigger: 'nonsense' }))).toEqual(['error trigger st.0'])
  })
  it('fails a condition that never holds, and passes a deck fact, a played count and a pending fact as a warning', () => {
    expect(found(deck({ when: [{ fact: 'unknown' }] }))).toEqual(['error when st.0'])
    expect(found(deck({ when: [{ not: { fact: 'unknown' } }] }))).toEqual(['error when st.0'])
    expect(found(deck({ when: [{ fact: 'played.nope', atLeast: 1 }] }))).toEqual(['error when st.0'])
    expect(
      found(deck({ when: [{ fact: 'director.state', is: 'relief' }] }), { pending: ['director'] }),
    ).toEqual(['warning pending st.0'])
  })
  it('fails a line that is no record, and a fact the record states before the scene that teaches it', () => {
    expect(found(deck({ lines: ['toy.nope'] }))).toEqual(['error line st.0'])
    expect(found(deck({ lines: ['toy.fact'] }))).toEqual([])
    expect(found(deck({ lines: ['toy.fact'] }), { scene: 'early' })).toEqual(['error order st.0'])
    expect(found(deck({ lines: ['toy.fact'] }), { facts: [] })).toEqual(['error fact st.0'])
  })
  it('fails a line that delivers a required beat: required beats stay proven by routes alone', () => {
    expect(found(deck({ lines: ['toy.beat'] }))).toEqual(['error beat st.0'])
  })
  it('keeps a speaker out of the deck, or in a scene, as the game says (NR-D8)', () => {
    const rules = { silent: ['porter'], only: { ada: ['clinic'] } }
    expect(found(deck({ lines: ['toy.hello'] }), { rules })).toEqual(['error speaker st.0'])
    expect(found(deck({ lines: ['toy.duty'] }), { rules })).toEqual(['error speaker st.0'])
    expect(found(deck({ lines: ['toy.duty'] }), { rules, scene: 'clinic' })).toEqual([])
  })
})

describe('the converted clinic deck', () => {
  it('passes with what the clinic’s game declares: its presentation room, its world facts and the director to come', () => {
    const map = parse(clinicMapToml) as unknown as { sectors: { id: string; zone: string }[] }
    const puzzle = scenePuzzle('clinic')
    const said = new Set(['stance'])
    for (const g of (fixture('clinic.dialogue.toml') as { graphs: DialogueGraph[] }).graphs)
      for (const n of Object.values(g.nodes))
        for (const c of n.choices ?? []) for (const k of Object.keys(c.set ?? {})) said.add(k)
    const deckFacts = new Set(['read.register', 'leaving'])
    const found = lintDeck({
      scene: 'clinic',
      storylets: (fixture('clinic.storylets.toml') as { storylets: Storylet[] }).storylets,
      records: (fixture('clinic.lines.toml') as { lines: LineRecord[] }).lines,
      facts: (fixture('canon.toml') as unknown as Canon).facts,
      beats: (fixture('clinic.beats.toml') as { beats: { id: string; required: boolean }[] }).beats,
      hotspots: Object.keys(puzzle.hotspots),
      rooms: [...map.sectors.flatMap((s) => [s.id, s.zone]), 'Reception'],
      known: (name) => name in puzzle.facts || said.has(name) || deckFacts.has(name),
      pending: ['director'],
      rules: { silent: ['nurse'], only: { porter: ['bay'] } },
    })
    expect(found.map((f) => `${f.level} ${f.rule} ${f.id}`)).toEqual(['warning pending st.p1.desk'])
  })
})
