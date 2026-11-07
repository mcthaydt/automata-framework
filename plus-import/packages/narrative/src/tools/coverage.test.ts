// Beat coverage and the hint cross-check (M6.8b step 5), from the source's cases on toy traces: a required beat missed
// on one route, `after` order, an untagged hint, barks.
import { describe, expect, it } from 'vitest'
import type { LineRecord } from '../sim/index'
import type { Beat } from './beats.schema'
import { beatCoverage, hintCheck } from './coverage'
import { shown, type Trace, type TraceEvent } from './traces'

const trace = (route: string, ...lines: string[]): Trace => ({
  route,
  entry: 'start',
  goal: true,
  events: lines.map((id, i): TraceEvent => ({ kind: 'line', id, title: 'Toy', at: i })),
})
const beats: Beat[] = [
  { id: 'toy.wake', learn: 'Ada wakes.', required: true, deliveredBy: ['toy.bed'] },
  {
    id: 'toy.key',
    learn: 'A key.',
    required: true,
    deliveredBy: ['toy.key', 'toy.keyItem'],
    after: ['toy.wake'],
  },
  { id: 'toy.note', learn: 'A note.', required: false, deliveredBy: ['toy.note'], after: ['toy.wake'] },
]
const errors = (r: { findings: readonly { rule: string; level: string }[] }) =>
  r.findings.filter((f) => f.level === 'error').map((f) => f.rule)

describe('beat coverage', () => {
  it('passes when every required beat is on every route, in order, and reports optional reach', () => {
    const r = beatCoverage(beats, [
      trace('a', 'toy.bed', 'toy.note', 'toy.key'),
      trace('b', 'toy.bed', 'toy.keyItem'),
    ])
    expect(errors(r)).toEqual([])
    expect(r.beats.find((b) => b.id === 'toy.note')).toMatchObject({
      delivered: ['a'],
      missing: ['b'],
      reach: 0.5,
    })
  })
  it('catches a required beat missed on one route', () => {
    const r = beatCoverage(beats, [trace('a', 'toy.bed', 'toy.key'), trace('b', 'toy.bed')])
    expect(r.findings).toContainEqual(
      expect.objectContaining({
        level: 'error',
        rule: 'required',
        id: 'toy.key',
        detail: expect.stringContaining('"b"'),
      }),
    )
  })
  it('catches `after` out of order, and a beat delivered without the one it needs', () => {
    expect(errors(beatCoverage(beats, [trace('a', 'toy.key', 'toy.bed')]))).toEqual(['order'])
    expect(errors(beatCoverage(beats.slice(1), [trace('a', 'toy.key')]))).toEqual(['order'])
  })
  it('counts items, cutscene captions and what a conversation always says as shown, and fails a route that missed its goal', () => {
    const t: Trace = {
      route: 'a',
      entry: 'start',
      goal: false,
      events: [
        { kind: 'cutscene', id: 'opening', duration: 3, captions: ['toy.bed'], at: 0 },
        { kind: 'item', item: 'key', name: 'toy.keyItem.name', text: 'toy.keyItem', at: 3 },
        { kind: 'dialogue', id: 'talk', said: ['toy.ask'], at: 4 },
        { kind: 'unrecorded', text: 'x', at: 5 },
      ],
    }
    expect(shown(t)).toEqual(['toy.bed', 'toy.keyItem.name', 'toy.keyItem', 'toy.ask'])
    expect(errors(beatCoverage(beats, [t]))).toEqual(['route'])
  })
  it('warns about an optional beat no route delivers', () => {
    expect(beatCoverage(beats, [trace('a', 'toy.bed', 'toy.key')]).findings).toContainEqual(
      expect.objectContaining({ level: 'warning', rule: 'reach', id: 'toy.note' }),
    )
  })
})

describe('hint cross-check', () => {
  const records: LineRecord[] = [
    { id: 'toy.puddle', kind: 'examine', speaker: 'ada', text: 'toy.puddle', hints: ['liveWater'] },
    { id: 'toy.box', kind: 'examine', speaker: 'ada', text: 'toy.box' },
  ]
  const lethal = [{ id: 'liveWater', rule: 'A live puddle kills.', hintedBy: ['puddle.look', 'box.look'] }]
  const exposes = [{ lethal: 'liveWater', route: 'a', step: 3 }]
  const base = { records, lethal, exposes, scene: 'toy', barksRequired: true }
  it('passes when a hint action shows a tagged line before the risk', () => {
    const r = hintCheck({
      ...base,
      probes: [{ lethal: 'liveWater', route: 'a', action: 'puddle.look', lines: ['toy.puddle'] }],
    })
    expect(r.findings).toEqual([])
    expect(r.rules).toEqual([{ id: 'liveWater', tagged: ['toy.puddle'], ok: true }])
  })
  it('catches a rule no line is tagged for, a hint line without the tag, and a route with no hint before the risk', () => {
    const box = [{ lethal: 'liveWater', route: 'a', action: 'box.look', lines: ['toy.box'] }]
    expect(
      errors(hintCheck({ ...base, records: records.map((r) => ({ ...r, hints: undefined })), probes: box })),
    ).toEqual(['untagged', 'hint-line'])
    expect(errors(hintCheck({ ...base, probes: box }))).toEqual(['hint-line'])
    expect(errors(hintCheck({ ...base, probes: [] }))).toEqual(['unreachable'])
  })
  it('warns of a probe whose line is not tagged when another hint covers the route', () => {
    const r = hintCheck({
      ...base,
      probes: [
        { lethal: 'liveWater', route: 'a', action: 'puddle.look', lines: ['toy.puddle'] },
        { lethal: 'liveWater', route: 'a', action: 'box.look', lines: ['toy.box'] },
      ],
    })
    expect(r.findings.map((f) => `${f.level} ${f.rule}`)).toEqual(['warning hint-line'])
  })
  describe('systems', () => {
    const systems = {
      rules: [
        {
          id: 'P1',
          text: 'He catches Ada by the drum.',
          then: [{ emit: { caught: 'porter' } }, { emit: { line: 'toy.missing' } }],
        },
      ],
      agents: [{ id: 'porter', modes: ['sit', 'walk'], transitions: [] }],
    }
    const barks: LineRecord[] = ['sit.1', 'sit.2', 'walk.1'].map((n) => ({
      id: `toy.porter.${n}`,
      kind: 'bark',
      speaker: 'porter',
      text: n,
    }))
    const sys = {
      records: [...records, ...barks],
      lethal: [],
      exposes: [],
      probes: [],
      systems,
      scene: 'toy',
    }
    it('checks that lines a rule emits exist, that a catching rule is hinted, and two barks per agent mode', () => {
      const r = hintCheck({ ...sys, barksRequired: true })
      expect(r.findings.map((f) => `${f.rule} ${f.id}`)).toEqual([
        'line rule P1',
        'untagged P1',
        'barks porter.walk',
      ])
    })
    it('warns, not fails, for a missing bark when barks are not required yet, and for an agent the game excuses', () => {
      expect(
        hintCheck({ ...sys, barksRequired: false }).findings.find((f) => f.rule === 'barks')?.level,
      ).toBe('warning')
      const quiet = hintCheck({ ...sys, barksRequired: true, quiet: ['porter'] })
      expect(quiet.findings.filter((f) => f.rule === 'barks').map((f) => f.level)).toEqual(['warning'])
    })
    it('counts a lethal rule that names the systems rule first as its hint', () => {
      const named = hintCheck({
        ...sys,
        records: [
          ...sys.records,
          { id: 'toy.drum', kind: 'bark', speaker: 'porter', text: 'x', hints: ['drum'] },
        ],
        lethal: [{ id: 'drum', rule: 'P1: he catches Ada by the drum.', hintedBy: [] }],
        barksRequired: true,
      })
      expect(named.findings.map((f) => `${f.rule} ${f.id}`)).toEqual(['line rule P1', 'barks porter.walk'])
    })
  })
})
