// `walk`, `stance` and `motifs` (M6.8b step 3): the source's path analyses on toy graphs. The endings a register must
// offer are the game's (the canon holds none), so `stance` takes them as an option (NR-D8).
import type { PuzzleDef } from '@automata/puzzle/sim'
import { describe, expect, it } from 'vitest'
import type { DialogueGraph } from '../sim/index'
import { CANON, rec, TALK } from '../testing/toy-dialogue'
import { type Act, motifs, stance, walk } from './dialogue-paths'

const BOUNDS = { min: -4, max: 4 }
const REGISTER: DialogueGraph = {
  id: 'register',
  speaker: 'register',
  start: 'page',
  nodes: {
    page: {
      say: ['toy.hello'],
      choices: [
        { line: 'toy.duty', set: { ending: 'vigil' }, next: 'end' },
        { line: 'toy.unsure', set: { ending: 'release' }, next: 'end' },
        { line: 'toy.yours', set: { ending: 'handover' }, next: 'hand' },
      ],
    },
    hand: {
      say: [],
      when: [
        { fact: 'stance', atLeast: -3 },
        { fact: 'stance', atMost: 3 },
        { fact: 'runSheet', is: true },
      ],
      next: 'end',
    },
    end: { say: ['toy.bye'] },
  },
}
const def = (actions: PuzzleDef['actions']): Act['def'] => ({
  facts: { runSheet: false },
  entry: [{ name: 'start', items: [] }],
  actions,
})
const one: Act = {
  scene: 'one',
  graphs: [TALK],
  def: def([{ id: 'meet', at: 'porter', then: [{ dialogue: 'meet' }], say: '' }]),
  routes: [{ name: 'shortest', actions: ['meet'] }],
}
const finale = (readSheet: boolean): Act => ({
  scene: 'three',
  graphs: [REGISTER],
  def: def([
    { id: 'sheet', at: 'sheet', then: [{ set: 'runSheet', to: true }], say: '' },
    { id: 'sign', at: 'register', then: [{ dialogue: 'register' }], say: '' },
  ]),
  routes: [{ name: 'shortest', actions: [...(readSheet ? ['sheet'] : []), 'sign'] }],
})
const ENDINGS = ['vigil', 'release', 'handover']
const keys = (r: { findings: readonly { rule: string; id: string }[] }) =>
  r.findings.map((f) => `${f.rule} ${f.id}`)

describe('walk', () => {
  it('walks every path of a graph to its exit states', () => {
    const ends = walk(TALK, { stance: 0, facts: {} }, undefined, BOUNDS).ends
    expect(ends.map((s) => s.stance).sort()).toEqual([-1, 0, 1])
  })
  it('stops at a node that offers nothing, has choices and no next (stuck)', () => {
    const g: DialogueGraph = {
      id: 'g',
      speaker: 'porter',
      start: 'a',
      nodes: {
        a: { say: ['toy.ask'], choices: [{ line: 'toy.duty', next: 'b' }] },
        b: { say: [], when: [{ fact: 'never', is: true }], next: 'c' },
        c: { say: ['toy.bye'] },
      },
    }
    // b's `when` fails, so a offers nothing, and `a` has no `next`.
    expect(walk(g, { stance: 0, facts: {} }, undefined, BOUNDS)).toMatchObject({ ends: [], stuck: ['a'] })
  })
})

describe('stance', () => {
  it('carries stance from act to act and finds every ending reachable', () => {
    const r = stance([one, finale(true)], { bounds: BOUNDS, endings: ENDINGS })
    expect(r.findings).toEqual([])
    expect(r.acts[0]).toMatchObject({ scene: 'one', min: -1, max: 1 })
    expect(r.register).toEqual({ graph: 'register', min: -1, max: 1 })
    expect(r.endings).toEqual([
      { ending: 'vigil', reachable: true },
      { ending: 'release', reachable: true },
      { ending: 'handover', reachable: true },
    ])
  })
  it('fails an ending no route reaches', () => {
    const r = stance([one, finale(false)], { bounds: BOUNDS, endings: ENDINGS })
    expect(r.ok).toBe(false)
    expect(keys(r)).toEqual(['ending handover'])
  })
  it('fails an ending the game does not have; with no endings given, it checks none', () => {
    expect(keys(stance([one, finale(true)], { bounds: BOUNDS, endings: ['vigil', 'release'] }))).toEqual([
      'ending handover',
    ])
    const free = stance([one, finale(false)], { bounds: BOUNDS })
    expect(free.findings).toEqual([])
    expect(free.endings).toEqual([])
  })
  it('reports the range alone until the register finale exists', () => {
    expect(stance([one], { bounds: BOUNDS, endings: ENDINGS })).toMatchObject({
      ok: true,
      register: null,
      endings: [],
    })
  })
  it('walks a graph that follows a cutscene, at its place on the route', () => {
    const quiet: Act = {
      ...one,
      def: def([{ id: 'meet', at: 'porter', then: [], say: '' }]),
      routes: [{ name: 'shortest', actions: ['meet'], follow: [{ after: 1, graph: 'meet' }] }],
    }
    const r = stance([quiet], { bounds: BOUNDS })
    expect(r.findings).toEqual([])
    expect(r.acts[0]).toMatchObject({ graphs: ['meet'], min: -1, max: 1 })
    const gone: Act = {
      ...quiet,
      routes: [{ name: 'shortest', actions: ['meet'], follow: [{ after: 0, graph: 'gone' }] }],
    }
    expect(keys(stance([gone], { bounds: BOUNDS }))).toEqual([
      'dialogue one/follows step 0',
      'started one/meet',
    ])
  })
  it('names a dialogue a route starts that the scene does not have', () => {
    expect(keys(stance([{ ...one, graphs: [] }], { bounds: BOUNDS }))).toEqual(['dialogue one/meet'])
  })
  it('clamps stance to the bounds it is given', () => {
    const r = stance([one], { bounds: { min: 0, max: 0 } })
    expect(r.acts[0]).toMatchObject({ min: 0, max: 0 })
  })
})

describe('motifs', () => {
  it('counts distinct canon motif tags across lines, files and shots', () => {
    const records = [
      rec('a', null, 'x', { motifs: ['four', 'clocks'] }).record,
      rec('b', null, 'y', { kind: 'file', motifs: ['clocks'] }).record,
    ]
    expect(motifs({ scene: 'one', records, shots: [] }, CANON)).toMatchObject({ distinct: 2, ok: false })
    const ok = motifs(
      { scene: 'one', records, shots: [{ cutscene: 'power', motifs: ['pools', 'shoes'] }] },
      CANON,
    )
    expect(ok.distinct).toBe(3)
    expect(ok.findings.map((f) => `${f.rule} ${f.id}`)).toEqual(['motif cutscene power'])
  })
})
