// The Last Light checks as one run over a blockout, in the order and with the short-circuits of `validate`
// (scripts/pipeline/blockout-lib.ts, 92e6704), and held to its answers on the corpus of seeded violations.
import { describe, expect, it } from 'vitest'
import type { Blockout } from '../../format/blockout.schema'
import { caseDocument, loadCheckCases, loadChecksGolden } from '../../testing/check-cases'
import { loadFixture } from '../../testing/fixtures'
import { loadGameFacts } from '../../testing/game-facts'
import { BLOCKOUT_NAMES } from '../../testing/geometry-golden'
import { must, toyBlockout, toyOpening, toyRoom } from '../../testing/toy-blockout'
import { lastLightChecks } from './last-light-checks'

/** The results this runner has that Last Light has too (its `overlap`, `heights`, `entities`, `materials` and `lamps` are new here). */
const SHARED = new Set(['expand', 'ids', 'rooms', 'shared-walls', 'openings', 'puzzle-hotspots', 'nav'])

describe('lastLightChecks: what runs', () => {
  it('runs ids, shared walls, openings, overlap, heights, puzzle hotspots, nav, entities, materials and lamps on a document that expands and resolves', () => {
    const results = lastLightChecks(toyBlockout())
    expect(results.map((result) => [result.id, result.ok])).toEqual([
      ['ids', true],
      ['shared-walls', true],
      ['openings', true],
      ['overlap', true],
      ['heights', true],
      ['puzzle-hotspots', true],
      ['nav', true],
      ['entities', true],
      ['materials', true],
      ['lamps', true],
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

  it('counts the things and the definitions of a blockout that passes `entities`', () => {
    const entities = lastLightChecks(toyBlockout()).find((result) => result.id === 'entities')
    expect(entities?.detail).toBe('3 things of 6 definitions')
  })

  it('fails entities for a box that stands outside every room, located at the box', () => {
    const toy = toyBlockout()
    const outside = {
      ...must(toy.boxes[0]),
      id: 'stray',
      role: 'collider',
      kind: 'furniture',
      x: 90,
      z: 90,
    } as const
    const entities = lastLightChecks(toyBlockout({ boxes: [...toy.boxes, outside] })).find(
      (result) => result.id === 'entities',
    )
    expect(entities).toMatchObject({ ok: false, detail: 'entity stray is outside every sector' })
    expect(entities?.problems[0]?.locator).toEqual({ selection: 'entity:box/stray', at: { x: 90, z: 90 } })
  })

  describe('materials', () => {
    const list = ['plaster', 'tile']
    const materials = (
      blockout: Blockout,
      options: Parameters<typeof lastLightChecks>[1] = { materials: list },
    ) => lastLightChecks(blockout, options).find((result) => result.id === 'materials')
    const withRoomA = (more: Partial<ReturnType<typeof toyRoom>>) =>
      toyBlockout({ rooms: [{ ...toyRoom('a'), ...more }, toyRoom('b')] })

    it('is skipped, and says so, when no list is given: absent or null', () => {
      const named = withRoomA({ floorTexture: 'anything' })
      expect(materials(named, {})).toMatchObject({ ok: true, detail: 'no material list' })
      expect(materials(named, { materials: null })).toMatchObject({ ok: true, detail: 'no material list' })
    })

    it('counts the list when every texture is in it', () => {
      expect(materials(withRoomA({ floorTexture: 'tile' }))).toMatchObject({
        ok: true,
        detail: 'within the list of 2 materials',
      })
    })

    it('says a texture the list lacks, at the room that names it', () => {
      const found = materials(withRoomA({ floorTexture: 'carpet' }))
      expect(found).toMatchObject({ ok: false, detail: 'a: floorTexture carpet is not a material' })
      expect(found?.problems[0]?.locator).toMatchObject({ selection: 'sector:a' })
    })

    it('says a wall that an opening cuts in two once, at the wall of the file', () => {
      const room = toyRoom('a')
      const corners = room.corners.map((corner, i) =>
        i === 1 ? [corner[0], corner[1], { texture: 'ghost' }] : corner,
      )
      const found = materials(withRoomA({ corners: corners as never }))
      expect(found?.problems.map((problem) => [problem.message, problem.locator?.selection])).toEqual([
        ['a: wall texture ghost is not a material', 'wall:a/1'],
      ])
    })

    it.each(BLOCKOUT_NAMES)('passes %s with the game’s own list', (name) => {
      const parsed = JSON.parse(loadFixture(name)) as Blockout
      const options = { materials: loadGameFacts().options.materials }
      expect(materials(parsed, options)).toMatchObject({
        ok: true,
        detail: 'within the list of 21 materials',
      })
    })
  })

  describe('lamps', () => {
    const kinds = loadGameFacts().options.lampKinds
    const lamps = (
      blockout: Blockout,
      options: Parameters<typeof lastLightChecks>[1] = { lampKinds: kinds },
    ) => lastLightChecks(blockout, options).find((result) => result.id === 'lamps')
    const lit = (more: Partial<Blockout['lamps'][number]>): Blockout =>
      toyBlockout({
        lamps: [
          {
            id: 'l1',
            x: 1,
            y: 3,
            z: 2,
            range: 7,
            radius: 0,
            color: [1, 0.835, 0.608],
            kind: 'pendant',
            ...more,
          },
        ],
      })

    it('is skipped, and says so, when no kinds are given: absent, null or empty', () => {
      const wrong = lit({ range: 99 })
      expect(lamps(wrong, {})).toMatchObject({ ok: true, detail: 'no lamp kinds' })
      expect(lamps(wrong, { lampKinds: null })).toMatchObject({ ok: true, detail: 'no lamp kinds' })
      expect(lamps(wrong, { lampKinds: {} })).toMatchObject({ ok: true, detail: 'no lamp kinds' })
    })

    it('counts the lamps that name a kind, of all the lamps, when they all keep to it', () => {
      const plain = toyBlockout({
        lamps: [...lit({}).lamps, { id: 'l2', x: 3, y: 3, z: 2, range: 99, radius: 0, color: [0, 0, 1] }],
      })
      expect(lamps(plain)).toMatchObject({
        ok: true,
        detail: 'lamps within their archetypes: 1 of 2 have a kind',
      })
    })

    it('says the game’s sentence for a lamp out of its band, at the lamp', () => {
      const found = lamps(lit({ range: 12 }))
      expect(found).toMatchObject({ ok: false, detail: 'lamp l1 (pendant): range 12 m outside 5.5–9 m' })
      expect(found?.problems[0]?.locator).toEqual({ selection: 'entity:lamp/l1', at: { x: 1, z: 2 } })
    })

    it('takes the tone it is given, and the game’s own when it is given none', () => {
      const shifted = lit({ color: [1, 0.7432941176470589, 0.6078431372549019] })
      expect(lamps(shifted, { lampKinds: kinds })?.ok).toBe(true)
      expect(lamps(shifted, { lampKinds: kinds, tone: null })?.ok).toBe(true)
      expect(lamps(shifted, { lampKinds: kinds, tone: 0.05 })?.ok).toBe(false)
    })

    it('holds a lamp to 0.06 when no tone is given: a colour 0.065 away fails with it and passes at 0.07', () => {
      const far = lit({ color: [1, 0.735, 0.6078431372549019] })
      expect(lamps(far, { lampKinds: kinds, tone: null })?.detail).toMatch(/over 0\.06 \(OKLab\)/)
      expect(lamps(far, { lampKinds: kinds, tone: 0.07 })?.ok).toBe(true)
    })

    it.each(BLOCKOUT_NAMES)('passes %s with the game’s own archetypes and tone', (name) => {
      const parsed = JSON.parse(loadFixture(name)) as Blockout
      const options = { lampKinds: kinds, tone: loadGameFacts().options.tone }
      expect(lamps(parsed, options)?.ok).toBe(true)
    })
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
      ['nav', true],
      ['entities', true],
      ['materials', true],
      ['lamps', true],
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

    it(`${name}: says what Last Light says of it, the counts included`, () => {
      const recorded = loadChecksGolden().blockouts[name]
      const results = lastLightChecks(JSON.parse(loadFixture(name)) as Blockout, {
        puzzleHotspots: recorded?.puzzle,
      })
      const shared = results.filter((result) => SHARED.has(result.id))
      expect(shared.map(({ id, ok, detail }) => ({ id, ok, detail }))).toEqual(recorded?.results)
    })
  }
})

describe('lastLightChecks: against Last Light on the corpus', () => {
  const golden = loadChecksGolden()
  const NEW_HERE = new Set(['overlap', 'heights', 'entities', 'materials', 'lamps'])

  for (const spec of loadCheckCases()) {
    const recorded = golden.cases[spec.id]
    if (recorded?.results === undefined) continue
    it(`${spec.id}: says what Last Light says, and nothing it does not (bar the new checks)`, () => {
      const results = lastLightChecks(caseDocument(spec), { puzzleHotspots: recorded.puzzle })
      const wanted = recorded.results ?? []
      for (const result of wanted.filter((r) => SHARED.has(r.id))) {
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
    // The edge to the missing node is `ids`' to report: nav, which threw in Last Light, passes over it.
    expect(results.find((result) => result.id === 'nav')?.ok).toBe(true)
  })

  it('has every case of the corpus answered, so none passes by being skipped', () => {
    const answered = loadCheckCases().filter((spec) => golden.cases[spec.id]?.results !== undefined)
    expect(answered.length).toBe(loadCheckCases().length - 1)
  })
})
