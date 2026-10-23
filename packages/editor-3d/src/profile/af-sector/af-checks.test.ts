// The checks of an `af-sector/1` level (ED3D.1b step 4): the id rules, then the generic checks over the sectors it
// builds, in Last Light's order and with its early-outs for a level that cannot be built or resolved.
import { describe, expect, it } from 'vitest'
import type { AfSector, AfSectorEntry } from '../../format/af-sector.schema'
import { loadAuthored } from '../../testing/fixtures'
import { toyAfSector, toyDock, toyHall } from '../../testing/toy-af-sector'
import { afIdProblems, afSectorChecks } from './af-checks'
import { afSectorCodec } from './af-codec'

const depot = (): AfSector => {
  const result = afSectorCodec.parse(loadAuthored('depot.af-sector'))
  if (!result.ok) throw new Error('the depot does not parse')
  return result.value
}

const summary = (results: ReturnType<typeof afSectorChecks>) =>
  results.map((result) => [result.id, result.ok] as const)

describe('afIdProblems', () => {
  it('finds nothing in the depot or the toy level', () => {
    expect(afIdProblems(depot())).toEqual([])
    expect(afIdProblems(toyAfSector())).toEqual([])
  })

  it('says a sector id twice at the second one, with the first beside it', () => {
    const level = toyAfSector({ sectors: [toyHall, { ...toyDock, id: 'hall' }] })
    expect(afIdProblems(level)).toEqual([
      {
        message: 'sector hall twice',
        locator: { selection: 'sector:hall', at: { x: 8, z: 0 } },
        related: [{ selection: 'sector:hall', at: { x: 0, z: 0 } }],
      },
    ])
  })

  it('says an entity id twice at the second, whatever its definition: ids are unique across the file', () => {
    const level = toyAfSector({
      entities: [
        { def: 'crate', id: 'crate1', x: 1, z: 2 },
        { def: 'box', id: 'crate1', x: 5, z: 6 },
      ],
    })
    expect(afIdProblems(level)).toEqual([
      {
        message: 'entity crate1 twice',
        locator: { selection: 'entity:box/crate1', at: { x: 5, z: 6 } },
        related: [{ selection: 'entity:crate/crate1', at: { x: 1, z: 2 } }],
      },
    ])
  })

  it('says a definition id twice with no place: definitions are not selectable', () => {
    const level = toyAfSector({ entityDefs: [{ id: 'crate' }, { id: 'spawn' }, { id: 'crate' }] })
    expect(afIdProblems(level)).toEqual([{ message: 'entity definition crate twice' }])
  })

  it('says each sentence once however many times the id comes up', () => {
    const level = toyAfSector({ sectors: [toyHall, toyHall, toyHall] })
    expect(afIdProblems(level).map((problem) => problem.message)).toEqual(['sector hall twice'])
  })

  it('reports a name that cannot be a selection id, without a place', () => {
    const odd = { ...toyHall, id: 'a/b' }
    const level = toyAfSector({
      sectors: [odd, odd],
      entities: [
        { def: 'crate', id: 'c:1', x: 0, z: 0 },
        { def: 'crate', id: 'c:1', x: 1, z: 1 },
      ],
    })
    expect(afIdProblems(level)).toEqual([
      { message: 'sector a/b twice', locator: undefined, related: [] },
      { message: 'entity c:1 twice', locator: undefined, related: [] },
    ])
  })
})

describe('afSectorChecks', () => {
  it('runs ids, shared-walls, openings, overlap, heights and entities, in that order, all ok on the toy level', () => {
    const results = afSectorChecks(toyAfSector())
    expect(results.map((result) => [result.id, result.ok, result.severity, result.detail])).toEqual([
      ['ids', true, 'error', 'ok'],
      ['shared-walls', true, 'error', 'ok'],
      ['openings', true, 'error', 'ok'],
      ['overlap', true, 'error', 'ok'],
      ['heights', true, 'error', 'ok'],
      ['entities', true, 'error', '0 things of 0 definitions'],
    ])
  })

  it('passes the depot on every check', () => {
    expect(summary(afSectorChecks(depot()))).toEqual([
      ['ids', true],
      ['shared-walls', true],
      ['openings', true],
      ['overlap', true],
      ['heights', true],
      ['entities', true],
    ])
  })

  it('answers build alone for a style that does not exist, with the engine data’s own sentence', () => {
    const level = toyAfSector({ sectors: [{ ...toyHall, style: 'brick' }, toyDock] })
    const results = afSectorChecks(level)
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({ id: 'build', ok: false, detail: 'unknown style brick' })
  })

  it('answers ids and rooms for a portal to a sector that is not there, located at the sector, and no more', () => {
    const results = afSectorChecks(toyAfSector({ sectors: [toyHall] }))
    expect(results.map((result) => result.id)).toEqual(['ids', 'rooms'])
    expect(results[1]).toMatchObject({
      ok: false,
      detail: 'hall: unknown portal target dock',
      problems: [{ locator: { selection: 'sector:hall' } }],
    })
  })

  it('keeps going after an id problem: the other checks still run', () => {
    const results = afSectorChecks(toyAfSector({ sectors: [toyHall, toyDock, { ...toyDock, id: 'dock' }] }))
    expect(results.map((result) => result.id)).toEqual([
      'ids',
      'shared-walls',
      'openings',
      'overlap',
      'heights',
      'entities',
    ])
    expect(results[0]).toMatchObject({ ok: false, detail: 'sector dock twice' })
  })

  it('fails entities for a thing outside every sector and for a value that does not fit, located at the thing', () => {
    const level = toyAfSector({
      entityDefs: [
        { id: 'crate', shape: 'box', size: [1, 1, 1], fields: [{ id: 'weight', type: 'int', max: 3 }] },
      ],
      entities: [
        { def: 'crate', id: 'c1', x: 2, z: 2, weight: 9 },
        { def: 'crate', id: 'c2', x: 50, z: 50 },
      ],
    })
    const entities = afSectorChecks(level).find((result) => result.id === 'entities')
    expect(entities).toMatchObject({
      ok: false,
      detail: 'entity c1: weight must be at most 3; entity c2 is outside every sector',
    })
    expect(entities?.problems.map((problem) => problem.locator)).toEqual([
      { selection: 'entity:crate/c1', at: { x: 2, z: 2 } },
      { selection: 'entity:crate/c2', at: { x: 50, z: 50 } },
    ])
  })

  it('fails openings when one side of the depot’s portal pair is gone, and locates the wall by its corner', () => {
    const level = depot()
    const [hall, dock] = level.sectors
    const brokenDock = {
      ...dock,
      corners: dock?.corners.map((corner) => (corner[2]?.next ? [corner[0], corner[1]] : corner)),
    }
    const results = afSectorChecks({ ...level, sectors: [hall, brokenDock] } as AfSector)
    const openings = results.find((result) => result.id === 'openings')
    expect(openings).toMatchObject({
      ok: false,
      detail: 'hall → dock from (8, 0) to (8, 6) has no matching portal back',
      problems: [{ locator: { selection: 'wall:hall/1', at: { x: 8, z: 0 } } }],
    })
  })

  it('fails overlap for a sector on the hall’s floor space', () => {
    const annex = {
      ...toyDock,
      id: 'annex',
      corners: [
        [1, 1],
        [3, 1],
        [3, 3],
        [1, 3],
      ],
    } as AfSectorEntry
    const overlap = afSectorChecks(toyAfSector({ sectors: [toyHall, toyDock, annex] })).find(
      (result) => result.id === 'overlap',
    )
    expect(overlap?.ok).toBe(false)
    expect(overlap?.problems).toHaveLength(1)
    expect(overlap?.problems[0]?.message).toMatch(/^(hall and annex|annex and hall) overlap near \(/)
  })

  it('does not hide a bug as a result: a level that is no level at all throws', () => {
    expect(() => afSectorChecks({} as AfSector)).toThrow()
  })

  it('fails heights for a ceiling that is not above its floor, located at the sector', () => {
    const level = toyAfSector({ sectors: [{ ...toyHall, ceiling: -1 }, toyDock] })
    const heights = afSectorChecks(level).find((result) => result.id === 'heights')
    expect(heights?.problems[0]).toMatchObject({
      message: 'hall: the ceiling (-1 m) is not above the floor (0 m)',
    })
  })
})
