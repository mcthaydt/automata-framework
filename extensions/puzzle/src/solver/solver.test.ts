// The solver (M6 spec §4.5, P-c): the adventure source's toy cases, re-pointed at AF's `PuzzleDef`. The solver
// resolves each verb with the interpreter's own rule, so it and the sim always pick the same action.
import { describe, expect, it } from 'vitest'
import { match, type PuzzleDef } from '../sim/index'
import { budget, createSolver, matrix } from './index'

const toy = (actions: PuzzleDef['actions'], extra: Partial<PuzzleDef> = {}): PuzzleDef => ({
  scene: 'toy',
  facts: { doorOpen: false },
  items: ['key', 'bar'],
  hotspots: {},
  entry: [{ name: 'start', items: [] }],
  actions,
  systemic: [],
  lethal: [],
  goal: [{ fact: 'doorOpen', is: true }],
  fallback: { '*': 'nothing' },
  ...extra,
})
const ids = (steps: readonly { action: string }[] | undefined) => steps?.map((s) => s.action)

describe('puzzle solver: toy puzzles', () => {
  it('finds a softlock: the only key used up in the wrong lock', () => {
    const def = toy(
      [
        {
          id: 'drawer',
          at: 'drawer',
          when: [{ fact: 'drawerOpen', is: false }],
          then: [{ set: 'drawerOpen', to: true }, { give: 'key' }],
          say: 'x',
        },
        { id: 'cupboard', at: 'cupboard', use: 'key', then: [{ take: 'key' }], say: 'x' },
        {
          id: 'door',
          at: 'door',
          use: 'key',
          then: [{ take: 'key' }, { set: 'doorOpen', to: true }],
          say: 'x',
        },
      ],
      { facts: { doorOpen: false, drawerOpen: false } },
    )
    const solver = createSolver(def)
    expect(ids(solver.solve().shortest?.steps)).toEqual(['drawer', 'door'])
    const { count, softlocks } = solver.softlocks()
    expect(count).toBe(1)
    expect(softlocks[0]?.trail).toEqual(['drawer', 'cupboard (key)'])
  })

  it('finds both keys to one lock, and that neither alone is necessary', () => {
    const def = toy(
      [
        {
          id: 'drawer',
          at: 'drawer',
          then: [{ give: 'key' }, { set: 'drawerOpen', to: true }],
          when: [{ fact: 'drawerOpen', is: false }],
          say: 'x',
        },
        {
          id: 'crate',
          at: 'crate',
          then: [{ give: 'bar' }, { set: 'crateOpen', to: true }],
          when: [{ fact: 'crateOpen', is: false }],
          say: 'x',
        },
        { id: 'door.key', at: 'door', use: 'key', then: [{ set: 'doorOpen', to: true }], say: 'x' },
        { id: 'door.bar', at: 'door', use: 'bar', then: [{ set: 'doorOpen', to: true }], say: 'x' },
      ],
      { facts: { doorOpen: false, drawerOpen: false, crateOpen: false } },
    )
    const r = createSolver(def).solve()
    expect(r.keySets.map((k) => k.join(' '))).toEqual(['door.key drawer', 'crate door.bar'])
    expect(r.alternatives.find((a) => a.banned === 'door.key + door.bar')?.solution).toBeNull()
  })

  it('flags a lethal rule whose hint comes after the risk', () => {
    const def = toy(
      [
        { id: 'breaker', at: 'breaker', then: [{ set: 'doorOpen', to: true }], say: 'x' },
        {
          id: 'sign',
          at: 'sign',
          when: [{ fact: 'doorOpen', is: true }],
          then: [{ set: 'read', to: true }],
          say: 'x',
        },
      ],
      {
        facts: { doorOpen: false, read: false, shocked: false },
        systemic: [
          {
            id: 'shock',
            note: 'The breaker shocks.',
            enables: [{ fact: 'shocked', is: true }],
            via: ['breaker'],
            risk: 'lethal',
          },
        ],
        lethal: [{ id: 'shock', rule: 'The breaker kills.', hintedBy: ['sign'] }],
      },
    )
    const solver = createSolver(def)
    const r = solver.solve()
    if (r.shortest === null) throw new Error('unsolved')
    const [hint] = solver.hints([r.shortest])
    expect(hint?.ok).toBe(false)
    expect(hint?.failures[0]).toContain('step 1 (breaker)')
    // Readable before the breaker: satisfied.
    const fair = { ...def, actions: [def.actions[0], { ...def.actions[1], when: [] }] } as PuzzleDef
    expect(createSolver(fair).hints([r.shortest])[0]?.ok).toBe(true)
  })

  it('adds walking time at 3 m/s to the action seconds', () => {
    // A three-node graph: start (0,0) → a (3,0) → b (3,4); walking 3 + 4 = 7 m.
    const at: Record<string, { x: number; z: number }> = { a: { x: 3, z: 0 }, b: { x: 3, z: 4 } }
    const walk = (from: string | null, to: string) => {
      const p = from === null ? { x: 0, z: 0 } : (at[from] as { x: number; z: number })
      const q = at[to] as { x: number; z: number }
      return Math.hypot(q.x - p.x, q.z - p.z)
    }
    const solution = {
      entry: 'start',
      seconds: 5,
      steps: [
        { action: 'x', at: 'a' },
        { action: 'c', at: 'combine', pair: ['key', 'bar'] as [string, string] },
        { action: 'y', at: 'b' },
      ],
    }
    const b = budget(solution, walk)
    expect(b.actions).toBe(5)
    expect(b.walking).toBeCloseTo(7 / 3, 9)
    expect(b.total).toBeCloseTo(5 + 7 / 3, 9)
  })

  it('builds the item × hotspot matrix', () => {
    const m = matrix(
      toy([
        { id: 'door.key', at: 'door', use: 'key', then: [], say: 'x' },
        { id: 'sign', at: 'sign', then: [], say: 'x' },
        { id: 'pry', at: 'combine', use: ['key', 'bar'], then: [], say: 'x' },
      ]),
    )
    expect(m.rows).toEqual([
      { item: 'key', cells: { door: 'door.key', sign: 'any' } },
      { item: 'bar', cells: { door: 'fallback', sign: 'any' } },
    ])
    expect(m.combines).toEqual([{ pair: ['key', 'bar'], action: 'pry' }])
  })
})

it('picks the action the interpreter picks, for every verb in a state (PZ-D1)', () => {
  const def = toy([
    { id: 'door.a', at: 'door', when: [{ fact: 'n', atLeast: 1 }], then: [], say: 'x' },
    { id: 'door.b', at: 'door', use: 'key', then: [], say: 'x' },
    { id: 'door.c', at: 'door', then: [], say: 'x' },
    { id: 'code.right', at: 'code', when: [{ fact: 'code', is: '0417' }], then: [], say: 'x' },
  ])
  const solver = createSolver(def)
  const state = { facts: { doorOpen: false, n: 0 }, items: ['key'], seen: [] }
  const reader = {
    fact: (name: string) => state.facts[name as 'n'],
    has: (item: string) => state.items.includes(item),
  }
  for (const verb of [
    { at: 'door' },
    { at: 'door', held: 'key' },
    { at: 'code', code: '0417' },
    { at: 'code', code: '1111' },
  ])
    expect(solver.match(state, verb.at, verb.held, undefined, verb.code)?.id ?? null).toBe(
      match(def, reader, verb)?.id ?? null,
    )
})
