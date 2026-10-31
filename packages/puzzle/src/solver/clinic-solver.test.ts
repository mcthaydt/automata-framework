// The solver on the clinic (M6 spec §4.5, P-c): the adventure source's three clinic cases and `clinic-puzzle.test.ts`'s
// data checks, on the converted clinic and its solver model, ported here by hand (PZ-D6). The model is the game's code
// and carries the game's own fields, so it lives in this test file (the game-leak rule exempts tests). Slow.
import { describe, expect, it } from 'vitest'
import { scenePuzzle } from '../testing/converted-puzzles'
import { toyScene } from '../testing/toy-scene'
import { budget, createSolver, type PuzzleModel, type State, type Step, validate } from './index'

// ---- The clinic's solver model ----
// The adventure source's clinic solver model, ported by hand (its calls are TypeScript, PZ-D6; provenance in the
// framework's docs/provenance/sources.md). What the clinic's `{ call }` effects do to the solver's abstract state:
// - `water`: how much puddle touches the fuse box (2 full, 1 one scoop short of dry, 0 dry). Shutting the valve drains
//   it; the cloth mops it at once; an empty basin scoops one level, which keeps only once the valve is shut. While the
//   valve is open, a mopped puddle refills as soon as the player walks elsewhere (`mopped`).
// - `knowsCode`: the player has seen 04:17 (the monitor, the clock, the record, the scratches). The right code needs it.
// - A lit curtain burns for one step (long enough to douse it), then both are ash.
// - The breaker: with a dry box it powers the exit; with a wet one it shorts.
// The route-test part of the source's model (`routes`) is M6.6c's.

type Facts = Record<string, string | number | boolean>
const set = (s: State, facts: Facts): State => ({ ...s, facts: { ...s.facts, ...facts } })
const without = (s: State, item: string): State => {
  const items = [...s.items]
  const i = items.indexOf(item)
  if (i >= 0) items.splice(i, 1)
  return { ...s, items }
}
const learn = { set: 'knowsCode', to: true } as const
/** Walking anywhere but the puddle and the fuse box (within reach of each other) gives the leak time. */
const away = (step: Step): boolean =>
  step.systemic !== true &&
  step.at !== 'puddle' &&
  step.at !== 'fuseBox' &&
  step.at !== 'combine' &&
  step.at !== 'floor'
/** A burning curtain lasts only the step that lit it: after any other step it is ash. */
const lit = (step: Step): boolean => /^curtain(West|East)\.(light|torch)$/.test(step.action)
const burnOut = (s: State, step: Step): State =>
  lit(step)
    ? s
    : set(
        s,
        Object.fromEntries(
          ['curtainWest', 'curtainEast'].filter((c) => s.facts[c] === 'burning').map((c) => [c, 'ash']),
        ),
      )

const CLINIC_MODEL: PuzzleModel = {
  facts: { water: 2, knowsCode: false, mopped: false },
  available: (s, at) =>
    at === 'scratches'
      ? s.facts.curtainWest === 'ash' || s.facts.curtainWest === 'cut'
      : at === 'shelf' || at === 'valve'
        ? s.facts.closetOpen === true
        : true,
  effects: {
    'monitor.read': [learn],
    'clock.read': [learn],
    'record.read': [learn],
    'scratches.read': [learn],
    'valve.shut': [{ set: 'water', to: 0 }],
  },
  require: { 'code.right': [{ fact: 'knowsCode', is: true }] },
  after: (s, step) =>
    burnOut(
      s.facts.mopped === true && (s.facts.valveShut === true || away(step))
        ? set(s, { mopped: false, water: s.facts.valveShut === true ? (s.facts.water as number) : 2 })
        : s,
      step,
    ),
  calls: {
    read: (s) => [s],
    ignite: (s) => [
      set(s, { curtainWest: 'ash', curtainEast: 'ash' }),
      set(s, { curtainWest: 'burning', curtainEast: 'burning' }),
    ],
    pourPuddle: (s) => [set(s, { basinFull: false, water: 2 })],
    pourFuseBox: (s) => [set(s, { basinFull: false, water: 2 })],
    pourFloor: (s) => [set(s, { basinFull: false })],
    throwBreaker: (s) => [Number(s.facts.water) > 0 ? s : set(s, { power: true })],
    lookFuseBox: (s) => [s],
    // The bolt is a systemic set-up (the Nurse waits at it), not a lock: it changes nothing the solver tracks.
    bolt: (s) => [s],
    puddle: (s, step) =>
      step.held === 'cloth'
        ? [set(without(s, 'cloth'), { water: 0, mopped: s.facts.valveShut !== true })]
        : step.held === 'basin' && s.facts.basinFull !== true
          ? [
              set(s, {
                basinFull: true,
                water:
                  s.facts.valveShut === true
                    ? Math.max(0, Number(s.facts.water) - 1)
                    : (s.facts.water as number),
              }),
            ]
          : [s],
    throwBottle: (s) => [without(s, 'bottle')],
    tools: (s, step) => {
      const [a, b] = step.pair ?? ['', '']
      const pair = (x: string, y: string) => (a === x && b === y) || (a === y && b === x)
      if (pair('lighter', 'cloth'))
        return Number(s.facts.fuel) > 0
          ? [{ ...without(s, 'cloth'), items: [...without(s, 'cloth').items, 'torch'] }]
          : [s]
      if (pair('lighter', 'fluid'))
        return [set(without(s, 'fluid'), { fuel: Math.min(80, Number(s.facts.fuel) + 40) })]
      return [s]
    },
  },
}

// ---- The tests ----
const clinic = scenePuzzle('clinic')
const solver = createSolver(clinic, CLINIC_MODEL)
const result = solver.solve()
const ids = (steps: readonly { action: string }[] | undefined) => steps?.map((s) => s.action)

describe('puzzle solver: the clinic', () => {
  it('is solvable, with every key to the code and the water', () => {
    expect(result.solvable).toBe(true)
    expect(result.capped).toBe(false)
    expect(ids(result.shortest?.steps)).toEqual([
      'monitor.read',
      'code.right',
      'closetDoor.unlock',
      'shelf.take',
      'valve.shut',
      'fuseBox.seat',
      'exit.leave',
    ])
    const replaced = (first: string) =>
      result.alternatives
        .filter((a) => a.banned.startsWith(first) && a.solution !== null)
        .map((a) => (a.solution?.steps ?? []).map((s) => s.action))
    // Four sources of 04:17: the monitor, the record, the clock, the scratches behind the curtain.
    expect(replaced('monitor.read').map((s) => s[s.indexOf('code.right') - 1])).toEqual([
      'record.read',
      'clock.read',
      'scratches.read',
    ])
    // Two ways to dry the fuse box: the valve, or the cloth cut from a curtain.
    expect(replaced('valve.shut')).toEqual([
      [
        'bed.search',
        'curtainWest.cut',
        'monitor.read',
        'code.right',
        'closetDoor.unlock',
        'shelf.take',
        'puddle.use',
        'fuseBox.seat',
        'exit.leave',
      ],
    ])
    expect(result.alternatives.find((a) => a.banned === 'valve.shut + puddle.use')?.solution).toBeNull()
  }, 120_000)

  it('has no softlocks, and hints every lethal rule before its risk', () => {
    const { count, capped } = solver.softlocks()
    expect(capped).toBe(false)
    expect(count).toBe(0)
    const solutions = [result.shortest, ...result.alternatives.map((a) => a.solution)].filter(
      (s) => s !== null,
    )
    expect(solver.hints(solutions).filter((h) => !h.ok)).toEqual([])
  }, 120_000)

  it('fits the design budget', () => {
    // Straight lines between the hotspots: the scene's own walk (nav, every door open) is the game adapter's.
    const at = (id: string) => clinic.hotspots[id === 'code' ? 'cabinet' : id] ?? { x: 0, z: 0 }
    const walk = (from: string | null, to: string) => {
      const p = from === null ? { x: 0, z: 0 } : at(from)
      const q = at(to)
      return Math.hypot(q.x - p.x, q.z - p.z)
    }
    if (result.shortest === null) throw new Error('unsolved')
    const b = budget(result.shortest, walk)
    // The design's 12:10 is a first-time player's; the shortest route is far inside it.
    expect(b.total).toBeGreaterThan(20)
    expect(b.total).toBeLessThan(12 * 60 + 10)
  })
})

describe('clinic puzzle data', () => {
  const clinic = scenePuzzle('clinic')
  const scene = {
    ...toyScene(),
    id: 'clinic',
    def: clinic,
    model: CLINIC_MODEL,
    // The converted fixture has no story text: its line keys are the ones the puzzle says.
    story: {
      lines: Object.fromEntries(
        [...clinic.actions.map((a) => a.say), ...Object.values(clinic.fallback)].map((k) => [k, k]),
      ),
      items: Object.fromEntries(clinic.items.map((i) => [i, i])),
    },
    cutscenes: [
      ...new Set(
        clinic.actions.flatMap((a) =>
          a.then.flatMap((e) => ('cutscene' in e ? [e.cutscene] : 'exit' in e ? [e.exit.cutscene] : [])),
        ),
      ),
    ],
  }

  it('has unique action ids', () => {
    expect(new Set(clinic.actions.map((a) => a.id)).size).toBe(clinic.actions.length)
  })

  it('names only hotspots it declares and items it lists, and validates with no error', () => {
    expect(validate(scene).filter((f) => f.level === 'error')).toEqual([])
  })

  it('reaches its goal through the exit, and every systemic and lethal entry names real actions', () => {
    const ids = new Set(clinic.actions.map((a) => a.id))
    expect(
      clinic.actions.some(
        (a) =>
          a.at === 'exit' &&
          a.then.some((e) => 'set' in e && clinic.goal.some((g) => 'fact' in g && g.fact === e.set)),
      ),
    ).toBe(true)
    for (const s of clinic.systemic) for (const v of s.via) expect(ids.has(v), `${s.id} via ${v}`).toBe(true)
    for (const l of clinic.lethal)
      for (const h of l.hintedBy) expect(ids.has(h), `${l.id} hinted by ${h}`).toBe(true)
  })
})
