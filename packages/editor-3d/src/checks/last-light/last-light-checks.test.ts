// The Last Light checks as one run over a blockout, in the order and with the short-circuits of `validate`
// (scripts/pipeline/blockout-lib.ts, 92e6704), and held to its answers on the corpus of seeded violations.
import { describe, expect, it } from 'vitest'
import type { Blockout } from '../../format/blockout.schema'
import { caseDocument, loadCheckCases, loadChecksGolden } from '../../testing/check-cases'
import { loadFixture } from '../../testing/fixtures'
import { BLOCKOUT_NAMES } from '../../testing/geometry-golden'
import { toyBlockout, toyOpening, toyRoom } from '../../testing/toy-blockout'
import { lastLightChecks } from './last-light-checks'

describe('lastLightChecks: what runs', () => {
  it('runs ids, shared walls, openings, overlap, heights and puzzle hotspots on a document that expands and resolves', () => {
    const results = lastLightChecks(toyBlockout())
    expect(results.map((result) => [result.id, result.ok])).toEqual([
      ['ids', true],
      ['shared-walls', true],
      ['openings', true],
      ['overlap', true],
      ['heights', true],
      ['puzzle-hotspots', true],
    ])
  })

  it('puts the portals and the doors in one `openings` result, portals first, as Last Light does', () => {
    const broken = toyBlockout({ openings: [{ ...toyOpening, door: 'ghost' }] })
    const openings = lastLightChecks(broken).find((result) => result.id === 'openings')
    expect(openings?.detail).toBe('opening ab: ghost is not a door box')
    expect(openings?.problems.map((problem) => problem.locator?.selection)).toEqual(['sector:ab'])
    const oneSided = toyBlockout({
      rooms: [
        {
          ...toyRoom('a'),
          corners: [
            [0, 0],
            [4, 0, { next: 'b' }],
            [4, 4],
            [0, 4],
          ],
        },
        {
          ...toyRoom('b'),
          corners: [
            [4, 0],
            [8, 0],
            [8, 4],
            [4, 4],
          ],
        },
      ],
      openings: [],
      boxes: [],
    })
    const portalOnly = lastLightChecks(oneSided).find((result) => result.id === 'openings')
    expect(portalOnly?.detail).toBe('a → b from (4, 0) to (4, 4) has no matching portal back')
  })

  it('says `no puzzle.ts` when it is given no puzzle, and counts the placed hotspots when it is given one', () => {
    const detail = (options?: Parameters<typeof lastLightChecks>[1]) =>
      lastLightChecks(toyBlockout(), options).find((result) => result.id === 'puzzle-hotspots')?.detail
    expect(detail()).toBe('no puzzle.ts')
    expect(detail({ puzzleHotspots: null })).toBe('no puzzle.ts')
    expect(detail({ puzzleHotspots: ['far'] })).toBe('1 placed')
    expect(detail({ puzzleHotspots: [] })).toBe('0 placed')
    expect(detail({ puzzleHotspots: ['far', 'drum'] })).toBe('puzzle hotspot drum is not placed')
  })

  it("answers with `expand` alone when the document does not expand, with the error's sentence and no place", () => {
    const results = lastLightChecks(toyBlockout({ openings: [{ ...toyOpening, to: 'nowhere' }] }))
    expect(results).toEqual([
      {
        id: 'expand',
        ok: false,
        severity: 'error',
        detail: 'opening ab: unknown room nowhere',
        problems: [{ message: 'opening ab: unknown room nowhere', locator: undefined, related: undefined }],
      },
    ])
  })

  it('answers with `ids` and `rooms` when a portal names no room, locating the room whose wall it is', () => {
    const lost = toyBlockout({
      rooms: [
        toyRoom('a'),
        {
          ...toyRoom('b'),
          corners: [
            [4.125, 0],
            [7, 0],
            [7, 4],
            [4.125, 4, { next: 'nowhere' }],
          ],
        },
      ],
      openings: [],
      boxes: [],
    })
    const results = lastLightChecks(lost)
    expect(results.map((result) => [result.id, result.ok, result.detail])).toEqual([
      ['ids', true, 'ok'],
      ['rooms', false, 'b: unknown portal target nowhere'],
    ])
    expect(results[1]?.problems[0]?.locator).toEqual({ selection: 'sector:b', at: undefined })
  })

  it('runs ids first even when it fails, and goes on to the checks after it', () => {
    const toy = toyBlockout()
    const results = lastLightChecks(
      toyBlockout({ boxes: [...toy.boxes, { ...toy.boxes[0], id: 'abDoor' } as never] }),
    )
    expect(results.map((result) => [result.id, result.ok])).toEqual([
      ['ids', false],
      ['shared-walls', true],
      ['openings', true],
      ['overlap', true],
      ['heights', true],
      ['puzzle-hotspots', true],
    ])
  })

  it("does not hide an error that is not the document's: a file that is not shaped like a blockout throws", () => {
    expect(() => lastLightChecks({ ...toyBlockout(), rooms: null as never })).toThrow(TypeError)
  })

  it('locates a wall by the corner of the file it came from', () => {
    const lonely = toyBlockout({
      rooms: [
        toyRoom('a'),
        {
          ...toyRoom('b'),
          corners: [
            [4, 0],
            [8, 0],
            [8, 4],
            [4, 4],
          ],
        },
      ],
      openings: [],
      boxes: [],
    })
    const shared = lastLightChecks(lonely).find((result) => result.id === 'shared-walls')
    expect(
      shared?.problems.map((problem) => [problem.locator?.selection, problem.related?.[0]?.selection]),
    ).toEqual([['wall:a/1', 'wall:b/3']])
  })
})

describe('lastLightChecks: the shipped blockouts', () => {
  for (const name of BLOCKOUT_NAMES) {
    it(`${name}: passes everything it runs`, () => {
      const failing = lastLightChecks(JSON.parse(loadFixture(name)) as Blockout).filter(
        (result) => !result.ok,
      )
      expect(failing.map((result) => `${result.id}: ${result.detail}`)).toEqual([])
    })
  }
})

describe('lastLightChecks: against Last Light on the corpus', () => {
  const golden = loadChecksGolden()
  /** The results this runner has so far, which Last Light has too: `nav` joins in the step after this one. */
  const SO_FAR = new Set(['expand', 'ids', 'rooms', 'shared-walls', 'openings', 'puzzle-hotspots'])
  const NEW_HERE = new Set(['overlap', 'heights'])

  for (const spec of loadCheckCases()) {
    const recorded = golden.cases[spec.id]
    if (recorded?.results === undefined) continue
    it(`${spec.id}: says what Last Light says, and nothing it does not (bar the new checks)`, () => {
      const results = lastLightChecks(caseDocument(spec), { puzzleHotspots: recorded.puzzle })
      const wanted = recorded.results ?? []
      for (const result of wanted.filter((r) => SO_FAR.has(r.id))) {
        const got = results.find((candidate) => candidate.id === result.id)
        expect([got?.ok, got?.detail]).toEqual([result.ok, result.detail])
      }
      // Short-circuits match: a result Last Light did not give, this does not (the new checks excepted).
      const ran = new Set(wanted.map((r) => r.id))
      for (const result of results)
        expect(ran.has(result.id) || NEW_HERE.has(result.id), result.id).toBe(true)
    })
  }

  it('answers the case Last Light could not, naming the node that is missing', () => {
    const spec = loadCheckCases().find((candidate) => candidate.id === 'nav-edge-unknown-node')
    const results = lastLightChecks(caseDocument(spec as never))
    expect(results.find((result) => result.id === 'ids')?.detail).toBe('nav: no node ghost')
  })

  it('has every case of the corpus answered, so none passes by being skipped', () => {
    const answered = loadCheckCases().filter((spec) => golden.cases[spec.id]?.results !== undefined)
    expect(answered.length).toBe(loadCheckCases().length - 1)
  })
})
