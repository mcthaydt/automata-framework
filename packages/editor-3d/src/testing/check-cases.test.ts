// The corpus of seeded violations (`check-cases.json`) and what The Last Light's own `validate` said of each
// (`checks.golden.json`): that the ported checks can be held to it, the corpus has to be sound first.
import { describe, expect, it } from 'vitest'
import { applyEdits, caseDigest, loadCheckCases, loadChecksGolden } from './check-cases'
import { BLOCKOUT_NAMES } from './geometry-golden'

const cases = loadCheckCases()
const golden = loadChecksGolden()

describe('applyEdits', () => {
  it('sets a value at a path, pushes onto an array (making it when absent) and deletes an element or a key', () => {
    const edited = applyEdits({ a: { b: [1, 2, 3], c: 1 }, list: [{ id: 'x' }, { id: 'y' }] }, [
      { op: 'set', path: ['a', 'b', 1], value: 20 },
      { op: 'push', path: ['a', 'b'], value: 4 },
      { op: 'push', path: ['a', 'later'], value: 'new' },
      { op: 'delete', path: ['a', 'c'] },
      { op: 'delete', path: ['list', 0] },
    ])
    expect(edited).toEqual({ a: { b: [1, 20, 3, 4], later: ['new'] }, list: [{ id: 'y' }] })
  })

  it('leaves the document it was given alone, and does not share what it sets with the edit', () => {
    const original = { a: [1] }
    const value = { deep: [1] }
    const edit = { op: 'set', path: ['a'], value } as const
    const edited = applyEdits(original, [edit]) as { a: { deep: number[] } }
    edited.a.deep.push(2)
    expect(original).toEqual({ a: [1] })
    expect(value).toEqual({ deep: [1] })
  })

  it('refuses a path that leads nowhere, and an edit it does not know', () => {
    expect(() => applyEdits({}, [{ op: 'set', path: ['missing', 'x'], value: 1 }])).toThrow(/path/)
    expect(() => applyEdits({}, [{ op: 'rename' as 'set', path: ['x'], value: 1 }])).toThrow(/rename/)
  })
})

describe('the corpus', () => {
  it('has unique ids, each on one of the four shipped blockouts', () => {
    expect(new Set(cases.map((spec) => spec.id)).size).toBe(cases.length)
    for (const spec of cases) expect(BLOCKOUT_NAMES, spec.id).toContain(spec.base)
    expect(Object.keys(golden.cases)).toEqual(cases.map((spec) => spec.id))
  })

  it('builds from each case the very document the recorder gave Last Light (sha256 of its JSON)', () => {
    for (const spec of cases) expect(caseDigest(spec), spec.id).toBe(golden.cases[spec.id]?.sha256)
  })

  it('records every shipped blockout as passing everything, with the puzzle it was checked against', () => {
    expect(Object.keys(golden.blockouts)).toEqual([...BLOCKOUT_NAMES])
    for (const name of BLOCKOUT_NAMES) {
      const entry = golden.blockouts[name]
      expect(
        entry.results.map((result) => result.id),
        name,
      ).toEqual(['ids', 'shared-walls', 'openings', 'puzzle-hotspots', 'nav'])
      expect(
        entry.results.every((result) => result.ok),
        name,
      ).toBe(true)
      expect(entry.puzzle.length, name).toBeGreaterThan(0)
    }
  })

  it('has each case fail the result it names with the sentence it names, and every other case fail nothing', () => {
    for (const spec of cases) {
      const recorded = golden.cases[spec.id]
      if (recorded?.results === undefined) continue
      const failing = recorded.results.filter((result) => !result.ok)
      if (spec.fails === undefined) {
        expect(failing, `${spec.id} fails nothing`).toEqual([])
        expect(spec.note, `${spec.id} says why it is in the corpus`).toBeTypeOf('string')
        continue
      }
      const named = recorded.results.find((result) => result.id === spec.fails)
      expect(named?.ok, `${spec.id}: ${spec.fails} fails`).toBe(false)
      expect(named?.detail, spec.id).toContain(spec.problem)
    }
  })

  it('keeps the one case Last Light could not answer, so a port is held to answering it', () => {
    const threw = cases.filter((spec) => golden.cases[spec.id]?.threw !== undefined)
    expect(threw.map((spec) => spec.id)).toEqual(['nav-edge-unknown-node'])
    expect(golden.cases['nav-edge-unknown-node']?.threw).toMatch(/TypeError/)
  })

  // One pattern per sentence `validate` can write about a document; each must be provoked by some case.
  const SENTENCES: Record<string, RegExp> = {
    'a duplicated room': /room \S+ twice/,
    'a duplicated box': /box \S+ twice/,
    'a duplicated hotspot': /hotspot \S+ twice/,
    'a duplicated lamp': /lamp \S+ twice/,
    'a duplicated zone': /zone \S+ twice/,
    'a box role that is no role': /role \S+ is not collider, seat or door/,
    'a door role on a box that is no door': /role door goes with kind door/,
    'an `on` naming no box': /: no such box/,
    'an `on` naming no wall': /: no such wall \(room\/corner index\)/,
    'an `on` naming neither': /: attach to box:<id> or wall:<room>\/<corner>/,
    'a first zone with an area': /the first zone has no area: it is the rest of the map/,
    'a later zone without one': /needs an area \(only the first zone covers the rest\)/,
    'a follow out of range': /follow \S+ is outside 0 \(fixed\) to 1 \(the follow camera\)/,
    'a nav node that does not exist': /nav: no node \S+/,
    'a nav edge through a box that is no door': /nav edge \S+: \S+ is not a door box/,
    'two solid walls on one line': /share a solid wall line from/,
    'a portal without its reverse': /has no matching portal back/,
    'an opening whose door is no door box': /opening \S+: \S+ is not a door box/,
    'an opening whose door does not straddle it': /opening \S+: door \S+ does not straddle it/,
    'a puzzle hotspot that is not placed': /puzzle hotspot \S+ is not placed/,
    'a node outside every room': /node \S+ is outside every room/,
    'a node inside a box': /node \S+ is inside box \S+/,
    'an edge that is not clear': /edge \S+ is not clear by 0\.3 m with the doors open/,
    'no node near the spawn': /no node is reachable from the spawn/,
    'a hotspot out of reach': /hotspot \S+ cannot be reached from the spawn within [\d.]+ m/,
    'an opening naming an unknown room': /opening \S+: unknown room \S+/,
    'an opening no facing walls cover':
      /opening \S+: no pair of facing axis-aligned walls of \S+ and \S+ covers/,
    'a portal naming no sector': /\S+: unknown portal target \S+/,
    'an unknown wall preset': /unknown wall preset \S+/,
    'an unknown style': /unknown style \S+/,
  }
  const details = Object.values(golden.cases).flatMap((recorded) =>
    (recorded.results ?? []).filter((result) => !result.ok).map((result) => result.detail),
  )
  for (const [what, pattern] of Object.entries(SENTENCES)) {
    it(`has a case that provokes ${what}`, () => {
      expect(details.some((detail) => pattern.test(detail))).toBe(true)
    })
  }
})
