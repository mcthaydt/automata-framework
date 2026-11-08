// The sector edits (ED3D.3 step 5): add, remove, duplicate and the property edits, on the depot (`af-sector/1`).

import type { AfSector2File, AfSectorEntry2File } from '@automata/3d/level'
import { describe, expect, it } from 'vitest'
import type { Edit, EditResult } from '#src/shared/edit/edit.ts'
import {
  addSector,
  duplicateSector,
  removeSector,
  removeSectors,
  setHeights,
  setLight,
  setMaterials,
  setPit,
  setTrim,
  setView,
} from '#src/shared/edit/sector-edits.ts'
import { afSectorCodec } from '#src/shared/level-session/af-sector/af-codec.ts'
import { afSectorAccess } from '#src/shared/level-session/af-sector/af-sectors.ts'
import { afSectorProfile } from '#src/shared/level-session/af-sector-profile.ts'
import type { LevelProfile } from '#src/shared/level-session/level-profile.ts'
import { type EditSector, SectorAccessError } from '#src/shared/level-session/sector-access.ts'
import { levelOf, must, reasonOf, rect } from '#src/testing/edit-helpers.ts'
import { loadAuthored } from '#src/testing/fixtures.ts'
import { changedRegion, literalEdits } from '#src/testing/text-diff.ts'
import { toyAfSector } from '#src/testing/toy-af-sector.ts'

const depotText = loadAuthored('depot.af-sector')
const depot = (() => {
  const result = afSectorProfile.parse(depotText)
  if (!result.ok) throw new Error('the depot does not parse')
  return result.value
})()

function run<D>(profile: LevelProfile<D>, level: D, edit: Edit<D>): EditResult<D> {
  return edit.run(profile, level)
}
const afRun = (edit: Edit<AfSector2File>) => run(afSectorProfile, depot, edit)
const sectorsOf = (level: AfSector2File): readonly EditSector[] => afSectorProfile.sectors.list(level)
/** The room as the file wrote it, which is what these edits are judged by. */
const sector = (level: AfSector2File, id: string): AfSectorEntry2File =>
  must(level.sectors.find((each) => each.id === id))

describe('sector.add on an af-sector level', () => {
  it('appends a sector with the heights of the last one, and selects it', () => {
    const result = afRun(addSector({ id: 'yard', corners: rect(14, 0, 18, 6) }))
    expect(result).toMatchObject({ ok: true, select: ['sector:yard'] })
    expect(sector(levelOf(result), 'yard')).toStrictEqual({
      id: 'yard',
      floor: -0.5,
      ceiling: 4,
      light: 0.7,
      corners: [
        [14, 0],
        [18, 0],
        [18, 6],
        [14, 6],
      ],
    })
    expect(sectorsOf(levelOf(result)).map((each) => each.id)).toEqual(['hall', 'dock', 'yard'])
  })

  it('takes the heights and the materials of the sector it is drawn like, and what it is told over those', () => {
    const like = sector(
      levelOf(afRun(addSector({ id: 'yard', corners: rect(14, 0, 18, 6), like: 'hall' }))),
      'yard',
    )
    expect(like).toStrictEqual({
      id: 'yard',
      floor: 0,
      ceiling: 4,
      light: 1,
      floorTexture: 'tile',
      wallTexture: 'brick',
      corners: [
        [14, 0],
        [18, 0],
        [18, 6],
        [14, 6],
      ],
    })
    const told = sector(
      levelOf(
        afRun(
          addSector({
            id: 'yard',
            corners: rect(14, 0, 18, 6),
            like: 'hall',
            floor: 1,
            ceiling: 3,
            light: 0.5,
            open: true,
          }),
        ),
      ),
      'yard',
    )
    expect(told).toMatchObject({ floor: 1, ceiling: 3, light: 0.5, open: true, floorTexture: 'tile' })
  })

  it('defaults to a floor of 0, a ceiling of 4 and a light of 1 in a level with no sector', () => {
    const empty = toyAfSector({ sectors: [] })
    const made = levelOf(run(afSectorProfile, empty, addSector({ id: 'a', corners: rect(0, 0, 3, 3) })))
    expect(sector(made, 'a')).toMatchObject({ floor: 0, ceiling: 4, light: 1 })
  })

  it('writes coordinates to four decimals, and takes a loop drawn clockwise as it is', () => {
    const rounded = afRun(
      addSector({
        id: 'yard',
        corners: [
          [14.00004, -0.00004],
          [18.12346, 0],
          [18, 6.00006],
        ],
      }),
    )
    expect(sector(levelOf(rounded), 'yard').corners).toEqual([
      [14, 0],
      [18.1235, 0],
      [18, 6.0001],
    ])
    const clockwise = afRun(
      addSector({
        id: 'yard',
        corners: [
          [14, 0],
          [14, 6],
          [18, 6],
          [18, 0],
        ],
      }),
    )
    expect(sector(levelOf(clockwise), 'yard').corners).toEqual([
      [14, 0],
      [14, 6],
      [18, 6],
      [18, 0],
    ])
  })

  it('writes the heights and the light to four decimals too', () => {
    const made = sector(
      levelOf(
        afRun(
          addSector({
            id: 'yard',
            corners: rect(14, 0, 18, 6),
            floor: 0.12346,
            ceiling: 3.50004,
            light: 0.70006,
          }),
        ),
      ),
      'yard',
    )
    expect(made).toMatchObject({ floor: 0.1235, ceiling: 3.5, light: 0.7001 })
  })

  it("is one patch of the file: the new sector goes in as a pure insert, in the neighbours' layout", () => {
    const next = levelOf(afRun(addSector({ id: 'yard', corners: rect(14, 0, 18, 6), like: 'hall' })))
    const patched = afSectorCodec.patch(depotText, depot, next)
    if (!patched.ok) throw new Error(`patch refused: ${patched.detail}`)
    expect(changedRegion(depotText, patched.text).removed).toBe('')
    expect(afSectorCodec.parse(patched.text)).toMatchObject({ ok: true, value: next })
  })

  it.each([
    ['empty', ''],
    ['starting with a digit', '9x'],
    ['holding a space', 'a b'],
    ['holding a slash', 'a/b'],
    ['holding a colon', 'a:b'],
  ])('refuses an id that is %s', (_what, id) => {
    expect(reasonOf(afRun(addSector({ id, corners: rect(14, 0, 18, 6) })))).toBe(
      'the sector id must be an id: a letter, then letters, digits, - or _',
    )
  })

  it('accepts an id of letters, digits, - and _', () => {
    expect(afRun(addSector({ id: 'Loading-bay_2', corners: rect(14, 0, 18, 6) })).ok).toBe(true)
  })

  it('refuses an id that is taken', () => {
    expect(reasonOf(afRun(addSector({ id: 'hall', corners: rect(14, 0, 18, 6) })))).toBe(
      'there is already a sector hall',
    )
  })

  it('refuses an outline that is not a polygon, in the words of the loop rules (ED3-m)', () => {
    const refused = (corners: readonly (readonly [number, number])[]) =>
      reasonOf(afRun(addSector({ id: 'yard', corners })))
    expect(
      refused([
        [14, 0],
        [18, 0],
      ]),
    ).toBe('a sector needs at least three corners')
    expect(
      refused([
        [14, 0],
        [18, 0],
        [18, 0],
        [14, 6],
      ]),
    ).toBe('corners 1 and 2 are the same point')
    expect(
      refused([
        [14, 0],
        [18, 6],
        [18, 0],
        [14, 6],
      ]),
    ).toBe('the outline crosses itself')
    expect(
      refused([
        [14, 0],
        [Number.NaN, 0],
        [18, 6],
      ]),
    ).toBe('corner 1 is not a point')
  })

  it('refuses an outline that overlaps a sector, naming it and pointing at it (ED3-d)', () => {
    const overlapping = afRun(addSector({ id: 'yard', corners: rect(6, 2, 10, 4) }))
    expect(overlapping).toEqual({ ok: false, reason: 'the new sector overlaps hall', at: 'sector:hall' })
    expect(afRun(addSector({ id: 'yard', corners: rect(2, 2, 4, 4) }))).toEqual({
      ok: false,
      reason: 'the new sector overlaps hall',
      at: 'sector:hall',
    })
    expect(afRun(addSector({ id: 'yard', corners: rect(9, 1, 12, 5) }))).toEqual({
      ok: false,
      reason: 'the new sector overlaps dock',
      at: 'sector:dock',
    })
  })

  it('lets a sector meet the others at a wall, and does not blame it for an overlap that was already there', () => {
    expect(afRun(addSector({ id: 'yard', corners: rect(14, 0, 18, 6) })).ok).toBe(true)
    const crowded = toyAfSector({
      sectors: [
        { id: 'a', floor: 0, ceiling: 3, light: 1, corners: [...rect(0, 0, 4, 4)] },
        { id: 'b', floor: 0, ceiling: 3, light: 1, corners: [...rect(2, 2, 6, 6)] },
      ],
    })
    expect(run(afSectorProfile, crowded, addSector({ id: 'c', corners: rect(10, 0, 12, 2) })).ok).toBe(true)
  })

  it('refuses heights that cannot be, a light that is not positive and a sector to be like that is not there', () => {
    const refused = (more: Partial<Parameters<typeof addSector>[0]>) =>
      reasonOf(afRun(addSector({ id: 'yard', corners: rect(14, 0, 18, 6), ...more })))
    expect(refused({ floor: 0, ceiling: 0.5 })).toBe('the ceiling must be more than 0.5 m above the floor')
    expect(refused({ floor: 2, ceiling: 1 })).toBe('the ceiling must be more than 0.5 m above the floor')
    expect(refused({ light: 0 })).toBe('the light must be more than 0')
    expect(refused({ light: -1 })).toBe('the light must be more than 0')
    expect(refused({ floor: Number.NaN })).toBe('the floor must be a number')
    expect(refused({ ceiling: Number.POSITIVE_INFINITY })).toBe('the ceiling must be a number')
    expect(refused({ light: Number.NaN })).toBe('the light must be a number')
    expect(refused({ like: 'nowhere' })).toBe('no sector nowhere')
  })

  it("answers with the engine's sentence for a level that does not build", () => {
    const broken = toyAfSector({ sectors: [{ ...must(depot.sectors[0]), style: 'plain' }] })
    expect(
      reasonOf(run(afSectorProfile, broken, addSector({ id: 'yard', corners: rect(14, 0, 18, 6) }))),
    ).toBe('unknown style plain')
  })

  it('is called sector.add and says what it adds', () => {
    const edit = addSector({ id: 'yard', corners: rect(14, 0, 18, 6) })
    expect(edit.id).toBe('sector.add')
    expect(edit.label).toBe('Add sector yard')
  })
})

describe('sector.remove', () => {
  it('removes a sector nothing names, and puts the file back when it follows an add', () => {
    const added = levelOf(afRun(addSector({ id: 'yard', corners: rect(14, 0, 18, 6) })))
    const removed = levelOf(run(afSectorProfile, added, removeSector({ id: 'yard' })))
    expect(removed).toEqual(depot)
    const patched = afSectorCodec.patch(depotText, depot, removed)
    expect(patched).toStrictEqual({ ok: true, text: depotText })
  })

  it('refuses a sector that is still referenced, with what refers to it', () => {
    expect(afRun(removeSector({ id: 'hall' }))).toEqual({
      ok: false,
      reason:
        'sector hall is still referenced: sector dock corner 3: a portal into hall; entity spawn stands in it',
      at: 'sector:hall',
    })
  })

  it('refuses a sector that is not there', () => {
    expect(afRun(removeSector({ id: 'nowhere' }))).toEqual({ ok: false, reason: 'no sector nowhere' })
  })

  it('answers for a sector whose id a selection cannot hold without pointing at it, and does not throw', () => {
    const odd = toyAfSector({
      sectors: [{ id: 'a:b', floor: 0, ceiling: 3, light: 1, corners: [...rect(0, 0, 4, 4)] }],
      entities: [{ def: 'spawn', id: 'spawn', x: 1, z: 1, facing: 0 }],
    } as Partial<AfSector2File>)
    expect(run(afSectorProfile, odd, removeSector({ id: 'a:b' }))).toEqual({
      ok: false,
      reason: 'sector a:b is still referenced: entity spawn stands in it',
    })
  })

  it('does not hide an error that is not a refusal', () => {
    const broken = {
      ...afSectorProfile,
      sectors: {
        ...afSectorAccess,
        withSectors: () => {
          throw new TypeError('a bug')
        },
      },
      geometry: () => {
        throw new RangeError('another bug')
      },
    }
    const added = levelOf(afRun(addSector({ id: 'yard', corners: rect(14, 0, 18, 6) })))
    expect(() => run(broken, added, removeSector({ id: 'yard' }))).toThrow('a bug')
    expect(() => run(broken, depot, addSector({ id: 'yard', corners: rect(14, 0, 18, 6) }))).toThrow('a bug')
    expect(() =>
      run({ ...broken, sectors: afSectorAccess }, depot, setMaterials({ id: 'hall', style: 'x' })),
    ).toThrow('another bug')
  })

  it('refuses with the sentence of a format that cannot hold what is left', () => {
    const picky = {
      ...afSectorProfile,
      sectors: {
        ...afSectorAccess,
        withSectors: () => {
          throw new SectorAccessError('this format cannot hold that')
        },
      },
    }
    const added = levelOf(afRun(addSector({ id: 'yard', corners: rect(14, 0, 18, 6) })))
    expect(run(picky, added, removeSector({ id: 'yard' }))).toEqual({
      ok: false,
      reason: 'this format cannot hold that',
    })
    expect(run(picky, depot, addSector({ id: 'yard', corners: rect(14, 0, 18, 6) }))).toEqual({
      ok: false,
      reason: 'this format cannot hold that',
    })
    expect(run(picky, depot, setLight({ id: 'hall', light: 0.5 }))).toEqual({
      ok: false,
      reason: 'this format cannot hold that',
    })
    expect(run(picky, depot, setMaterials({ id: 'hall', style: 'plain' }))).toEqual({
      ok: false,
      reason: 'this format cannot hold that',
    })
  })

  it('is called sector.remove and says what it removes', () => {
    const edit = removeSector({ id: 'yard' })
    expect(edit.id).toBe('sector.remove')
    expect(edit.label).toBe('Remove sector yard')
  })
})

describe('sector.remove of several sectors', () => {
  const yard: AfSector2File['sectors'][number] = {
    id: 'yard',
    floor: 0,
    ceiling: 4,
    light: 1,
    corners: rect(14, 0, 18, 6),
  }
  const idsOf = (level: AfSector2File): string[] => sectorsOf(level).map((each) => each.id)
  // The toy's hall and dock lead into each other; the yard stands alone beside them.
  const toy = toyAfSector({ sectors: [...toyAfSector().sectors, yard] })
  const toyRun = (edit: Edit<AfSector2File>) => run(afSectorProfile, toy, edit)

  it('removes sectors that lead into each other together, which one by one it would refuse', () => {
    expect(reasonOf(toyRun(removeSector({ id: 'hall' })))).toBe(
      'sector hall is still referenced: sector dock corner 3: a portal into hall',
    )
    expect(idsOf(levelOf(toyRun(removeSectors({ ids: ['hall', 'dock'] }))))).toEqual(['yard'])
    expect(idsOf(levelOf(toyRun(removeSectors({ ids: ['dock', 'hall'] }))))).toEqual(['yard'])
  })

  it('refuses all of them when a sector that stays still leads into one, and says which', () => {
    const joined = toyAfSector({
      sectors: [
        ...toyAfSector().sectors,
        { ...yard, corners: [[14, 0, { next: 'dock' }], ...rect(14, 0, 18, 6).slice(1)] },
      ],
    })
    expect(run(afSectorProfile, joined, removeSectors({ ids: ['hall', 'dock'] }))).toEqual({
      ok: false,
      reason: 'sector dock is still referenced: sector yard corner 0: a portal into dock',
      at: 'sector:dock',
    })
  })

  it('refuses a sector something that is not a sector stands in, as the single edit does', () => {
    expect(reasonOf(afRun(removeSectors({ ids: ['hall', 'dock'] })))).toBe(
      'sector hall is still referenced: entity spawn stands in it',
    )
  })

  it('names a sector that is not there before it looks at anything else', () => {
    expect(toyRun(removeSectors({ ids: ['yard', 'nowhere'] }))).toEqual({
      ok: false,
      reason: 'no sector nowhere',
    })
  })

  it('counts a sector once however often it is named, and does nothing for none', () => {
    const edit = removeSectors<AfSector2File>({ ids: ['yard', 'yard'] })
    expect(edit.label).toBe('Remove sector yard')
    expect(idsOf(levelOf(toyRun(edit)))).toEqual(['hall', 'dock'])
    expect(levelOf(toyRun(removeSectors({ ids: [] })))).toBe(toy)
  })

  it('is one edit called sector.remove, and says how many it removes', () => {
    const edit = removeSectors({ ids: ['hall', 'dock'] })
    expect(edit.id).toBe('sector.remove')
    expect(edit.label).toBe('Remove 2 sectors')
  })

  it('refuses with the sentence of a format that cannot hold what is left, and hides no other error', () => {
    const failing = (error: Error) => ({
      ...afSectorProfile,
      sectors: {
        ...afSectorAccess,
        withSectors: () => {
          throw error
        },
      },
    })
    const both = removeSectors<AfSector2File>({ ids: ['hall', 'dock'] })
    expect(run(failing(new SectorAccessError('no room for that')), toy, both)).toEqual({
      ok: false,
      reason: 'no room for that',
    })
    expect(() => run(failing(new TypeError('a bug')), toy, both)).toThrow('a bug')
  })
})

describe('sector.duplicate', () => {
  it('copies a sector at an offset under a fresh id, without its portals, and selects the copy', () => {
    const result = afRun(duplicateSector({ id: 'dock', offset: { x: 6, z: 0 } }))
    expect(result).toMatchObject({ ok: true, select: ['sector:dock2'] })
    expect(sector(levelOf(result), 'dock2')).toStrictEqual({
      id: 'dock2',
      floor: -0.5,
      ceiling: 4,
      light: 0.7,
      floorTexture: 'plank',
      wallTexture: 'brick',
      corners: [
        [14, 0],
        [20, 0],
        [20, 6],
        [14, 6],
      ],
    })
  })

  it("writes the copy's coordinates to four decimals", () => {
    const copy = sector(
      levelOf(afRun(duplicateSector({ id: 'dock', offset: { x: 6.00006, z: 0.00006 } }))),
      'dock2',
    )
    expect(copy.corners).toEqual([
      [14.0001, 0.0001],
      [20.0001, 0.0001],
      [20.0001, 6.0001],
      [14.0001, 6.0001],
    ])
  })

  it('takes the next free id, or the one it is given', () => {
    const once = levelOf(afRun(duplicateSector({ id: 'dock', offset: { x: 6, z: 0 } })))
    const twice = run(afSectorProfile, once, duplicateSector({ id: 'dock', offset: { x: 12, z: 0 } }))
    expect(sectorsOf(levelOf(twice)).map((each) => each.id)).toEqual(['hall', 'dock', 'dock2', 'dock3'])
    const named = afRun(duplicateSector({ id: 'dock', offset: { x: 6, z: 0 }, newId: 'annex' }))
    expect(sectorsOf(levelOf(named)).at(-1)?.id).toBe('annex')
    expect(reasonOf(afRun(duplicateSector({ id: 'dock', offset: { x: 6, z: 0 }, newId: 'hall' })))).toBe(
      'there is already a sector hall',
    )
    expect(reasonOf(afRun(duplicateSector({ id: 'dock', offset: { x: 6, z: 0 }, newId: '1' })))).toBe(
      'the sector id must be an id: a letter, then letters, digits, - or _',
    )
  })

  it("moves the holes with the outline, keeps every other wall member, and drops a door's id", () => {
    const ring = {
      id: 'ring',
      floor: 0,
      ceiling: 3,
      light: 1,
      corners: [
        [0, 0],
        [9, 0, { surface: 'brick', door: { at: 4, width: 1, height: 2, id: 'ringDoor' } }],
        [9, 9],
        [0, 9, { next: 'elsewhere' }],
      ],
      holes: [rect(3, 3, 6, 6)],
    }
    const level = toyAfSector({
      sectors: [
        {
          ...ring,
          corners: ring.corners.map((c, i) => (i === 3 ? ([c[0], c[1]] as const) : c)),
        } as AfSector2File['sectors'][number],
      ],
    })
    const copy = sector(
      levelOf(run(afSectorProfile, level, duplicateSector({ id: 'ring', offset: { x: 20, z: 1 } }))),
      'ring2',
    )
    expect(copy.corners).toEqual([
      [20, 1],
      [29, 1, { surface: 'brick', door: { at: 4, width: 1, height: 2 } }],
      [29, 10],
      [20, 10],
    ])
    expect(copy.holes).toEqual([rect(23, 4, 26, 7)])
  })

  it("takes a portal's own members with the portal, and nothing else of the wall", () => {
    const [hall, dock] = [must(depot.sectors[0]), must(depot.sectors[1])]
    const framed = toyAfSector({
      sectors: [
        hall,
        {
          ...dock,
          corners: dock.corners.map((corner, i) =>
            i === 3
              ? ([
                  8,
                  6,
                  {
                    next: 'hall',
                    frame: true,
                    mask: 'glass',
                    block: true,
                    maskTop: 2,
                    hatch: [1, 2],
                    surface: 'plank',
                  },
                ] as const)
              : corner,
          ),
        },
      ],
    } as Partial<AfSector2File>)
    const copy = sector(
      levelOf(run(afSectorProfile, framed, duplicateSector({ id: 'dock', offset: { x: 6, z: 0 } }))),
      'dock2',
    )
    expect(copy.corners[3]).toEqual([14, 6, { surface: 'plank' }])
    const solid = toyAfSector({
      sectors: [
        {
          ...hall,
          corners: hall.corners.map((corner, i) =>
            i === 1 ? ([8, 0, { frame: true, handrail: 1 }] as const) : corner,
          ),
        },
      ],
    } as Partial<AfSector2File>)
    const kept = sector(
      levelOf(run(afSectorProfile, solid, duplicateSector({ id: 'hall', offset: { x: 20, z: 0 } }))),
      'hall2',
    )
    expect(kept.corners[1]).toEqual([28, 0, { frame: true, handrail: 1 }])
  })

  it('drops a portal and leaves no empty wall behind', () => {
    const copy = sector(levelOf(afRun(duplicateSector({ id: 'dock', offset: { x: 6, z: 0 } }))), 'dock2')
    expect(must(copy.corners[3])).toHaveLength(2)
  })

  it('refuses a copy that overlaps a sector, and an offset that is not numbers', () => {
    expect(afRun(duplicateSector({ id: 'dock', offset: { x: 1, z: 0 } }))).toEqual({
      ok: false,
      reason: 'the new sector overlaps dock',
      at: 'sector:dock',
    })
    expect(reasonOf(afRun(duplicateSector({ id: 'dock', offset: { x: 0, z: 0 } })))).toBe(
      'the new sector overlaps dock',
    )
    expect(reasonOf(afRun(duplicateSector({ id: 'dock', offset: { x: Number.NaN, z: 0 } })))).toBe(
      'the offset must be two numbers',
    )
    expect(
      reasonOf(afRun(duplicateSector({ id: 'dock', offset: { x: 6, z: Number.POSITIVE_INFINITY } }))),
    ).toBe('the offset must be two numbers')
    expect(reasonOf(afRun(duplicateSector({ id: 'nowhere', offset: { x: 6, z: 0 } })))).toBe(
      'no sector nowhere',
    )
  })

  it('is called sector.duplicate and says what it copies', () => {
    const edit = duplicateSector({ id: 'dock', offset: { x: 6, z: 0 } })
    expect(edit.id).toBe('sector.duplicate')
    expect(edit.label).toBe('Duplicate sector dock')
  })
})

describe('sector.setHeights', () => {
  it('moves the ceiling, the floor or both, and writes four decimals', () => {
    expect(sector(levelOf(afRun(setHeights({ id: 'hall', ceiling: 5 }))), 'hall')).toMatchObject({
      floor: 0,
      ceiling: 5,
    })
    expect(sector(levelOf(afRun(setHeights({ id: 'hall', floor: 0.5 }))), 'hall')).toMatchObject({
      floor: 0.5,
      ceiling: 4,
    })
    expect(
      sector(levelOf(afRun(setHeights({ id: 'hall', floor: 1, ceiling: 6.12345 }))), 'hall'),
    ).toMatchObject({
      floor: 1,
      ceiling: 6.1235,
    })
    expect(sector(levelOf(afRun(setHeights({ id: 'hall', floor: 0.12346 }))), 'hall').floor).toBe(0.1235)
  })

  it('changes nothing when the heights are the ones it has', () => {
    expect(afRun(setHeights({ id: 'hall', floor: 0, ceiling: 4 }))).toEqual({ ok: true, level: depot })
    expect(levelOf(afRun(setHeights({ id: 'hall', ceiling: 4 })))).toBe(depot)
  })

  it('changes one number in the file, and undo puts the text back (ED3-b)', () => {
    const next = levelOf(afRun(setHeights({ id: 'hall', ceiling: 5.1 })))
    const patched = afSectorCodec.patch(depotText, depot, next)
    if (!patched.ok) throw new Error(`patch refused: ${patched.detail}`)
    expect(literalEdits(depotText, patched.text)).toEqual(['["sectors",0,"ceiling"]'])
    expect(changedRegion(depotText, patched.text)).toEqual({ removed: '4', added: '5.1' })
    const back = afSectorCodec.patch(patched.text, next, depot)
    expect(back).toStrictEqual({ ok: true, text: depotText })
  })

  it('refuses a ceiling that is not more than 0.5 m over the floor, in either direction of change', () => {
    expect(reasonOf(afRun(setHeights({ id: 'hall', ceiling: 0.5 })))).toBe(
      'the ceiling must be more than 0.5 m above the floor',
    )
    expect(reasonOf(afRun(setHeights({ id: 'hall', floor: 3.5 })))).toBe(
      'the ceiling must be more than 0.5 m above the floor',
    )
    expect(afRun(setHeights({ id: 'hall', ceiling: 0.51 })).ok).toBe(true)
  })

  it('refuses numbers that are not, a call that says nothing, and a sector that is not there', () => {
    expect(reasonOf(afRun(setHeights({ id: 'hall', ceiling: Number.NaN })))).toBe(
      'the ceiling must be a number',
    )
    expect(reasonOf(afRun(setHeights({ id: 'hall', floor: Number.POSITIVE_INFINITY })))).toBe(
      'the floor must be a number',
    )
    expect(reasonOf(afRun(setHeights({ id: 'hall' })))).toBe('give a floor or a ceiling')
    expect(reasonOf(afRun(setHeights({ id: 'nowhere', ceiling: 5 })))).toBe('no sector nowhere')
  })

  it('is called sector.setHeights, coalesces on the sector, and says what it moves', () => {
    const edit = setHeights({ id: 'hall', ceiling: 5 })
    expect(edit.id).toBe('sector.setHeights')
    expect(edit.coalesce).toBe('heights:hall')
    expect(edit.label).toBe('Set the heights of hall')
  })
})

describe('sector.setLight', () => {
  it('sets the light, and refuses one that is not more than 0', () => {
    expect(sector(levelOf(afRun(setLight({ id: 'hall', light: 0.25 }))), 'hall').light).toBe(0.25)
    expect(sector(levelOf(afRun(setLight({ id: 'hall', light: 1.23456 }))), 'hall').light).toBe(1.2346)
    expect(reasonOf(afRun(setLight({ id: 'hall', light: 0 })))).toBe('the light must be more than 0')
    expect(reasonOf(afRun(setLight({ id: 'hall', light: -2 })))).toBe('the light must be more than 0')
    expect(reasonOf(afRun(setLight({ id: 'hall', light: Number.NaN })))).toBe('the light must be a number')
    expect(reasonOf(afRun(setLight({ id: 'nowhere', light: 1 })))).toBe('no sector nowhere')
    expect(levelOf(afRun(setLight({ id: 'hall', light: 1 })))).toBe(depot)
  })

  it('is called sector.setLight and coalesces on the sector', () => {
    const edit = setLight({ id: 'hall', light: 0.5 })
    expect(edit.id).toBe('sector.setLight')
    expect(edit.coalesce).toBe('light:hall')
    expect(edit.label).toBe('Set the light of hall')
  })
})

describe('sector.setView (ED3D.4b)', () => {
  const view = (id: string, name: string | null, level = depot) =>
    run(afSectorProfile, level, setView({ id, view: name }))

  it('sets the camera view a sector takes, changes it and clears it, which leaves the sector as it was', () => {
    const set = levelOf(view('hall', 'hall-view'))
    expect(sector(set, 'hall').view).toBe('hall-view')
    expect(sector(levelOf(view('hall', 'wide', set)), 'hall').view).toBe('wide')
    const cleared = levelOf(view('hall', null, set))
    expect(cleared).toEqual(depot)
    expect('view' in sector(cleared, 'hall')).toBe(false)
  })

  it('changes nothing for the view the sector has already, or none to clear', () => {
    const set = levelOf(view('hall', 'hall-view'))
    expect(levelOf(view('hall', 'hall-view', set))).toBe(set)
    expect(levelOf(view('hall', null))).toBe(depot)
  })

  it('leaves the other sectors alone', () => {
    const set = levelOf(view('hall', 'hall-view'))
    expect(sector(set, 'dock')).toEqual(sector(depot, 'dock'))
  })

  it('refuses an empty id and a sector that is not there', () => {
    expect(reasonOf(view('hall', ''))).toBe('a view is an id, not empty')
    expect(reasonOf(view('hall', '  '))).toBe('a view is an id, not empty')
    expect(reasonOf(view('nowhere', 'hall-view'))).toBe('no sector nowhere')
  })

  it('is called sector.setView and coalesces on the sector', () => {
    const edit = setView({ id: 'hall', view: 'hall-view' })
    expect([edit.id, edit.label, edit.coalesce]).toEqual([
      'sector.setView',
      'Set the camera of hall',
      'view:hall',
    ])
  })
})

describe('sector.setPit', () => {
  const pit = (id: string, on: boolean, level = depot) => run(afSectorProfile, level, setPit({ id, pit: on }))

  it('makes a room a pit, and taking it back leaves the file as it was', () => {
    const made = levelOf(pit('hall', true))
    expect(sector(made, 'hall').pit).toBe(true)
    const undone = levelOf(pit('hall', false, made))
    expect(undone).toEqual(depot)
    expect('pit' in sector(undone, 'hall')).toBe(false)
  })

  it('changes nothing for a room that already is, or is not, a pit', () => {
    const made = levelOf(pit('hall', true))
    expect(levelOf(pit('hall', true, made))).toBe(made)
    expect(levelOf(pit('hall', false))).toBe(depot)
  })

  it('writes only the room’s `pit` member, and Undo puts the text back byte for byte', () => {
    const made = levelOf(pit('hall', true))
    const text = afSectorCodec.patch(depotText, depot, made)
    if (!text.ok) throw new Error(text.detail)
    const back = afSectorCodec.patch(text.text, made, depot)
    expect(back.ok && back.text).toBe(depotText)
  })

  it('is called sector.setPit, says what it does in words, and refuses a room that is not there', () => {
    const edit = setPit({ id: 'hall', pit: true })
    expect([edit.id, edit.label]).toEqual(['sector.setPit', 'Make hall a pit'])
    expect(setPit({ id: 'hall', pit: false }).label).toBe('Make hall not a pit')
    expect(reasonOf(pit('nowhere', true))).toBe('no sector nowhere')
  })
})

describe('sector.setTrim', () => {
  const trim = (args: Parameters<typeof setTrim>[0], level = depot) =>
    run(afSectorProfile, level, setTrim(args))

  it('writes the pieces one by one, and clearing them all takes the member off', () => {
    const skirted = levelOf(trim({ id: 'hall', skirting: 0.1 }))
    expect(sector(skirted, 'hall').trim).toEqual({ skirting: 0.1 })
    const both = levelOf(trim({ id: 'hall', rail: 0.9 }, skirted))
    expect(sector(both, 'hall').trim).toEqual({ skirting: 0.1, rail: 0.9 })
    const cleared = levelOf(trim({ id: 'hall', skirting: null, rail: null }, both))
    expect('trim' in sector(cleared, 'hall')).toBe(false)
    expect(cleared).toEqual(depot)
  })

  it('keeps a piece it was not asked about, as written', () => {
    const level = toyAfSector({
      sectors: [{ ...must(depot.sectors[0]), trim: { skirting: 0.2, wainscot: 1, capital: 0.3 } }],
    })
    const made = levelOf(trim({ id: must(level.sectors[0]).id, wainscot: 1.2 }, level))
    expect(must(made.sectors[0]).trim).toEqual({ skirting: 0.2, wainscot: 1.2, capital: 0.3 })
  })

  it('changes nothing for what is already so', () => {
    const skirted = levelOf(trim({ id: 'hall', skirting: 0.1 }))
    expect(levelOf(trim({ id: 'hall', skirting: 0.1 }, skirted))).toBe(skirted)
    expect(levelOf(trim({ id: 'hall', rail: null }))).toBe(depot)
  })

  it('writes only the room’s `trim` member, and Undo puts the text back byte for byte', () => {
    const made = levelOf(trim({ id: 'hall', wainscot: 1 }))
    const text = afSectorCodec.patch(depotText, depot, made)
    if (!text.ok) throw new Error(text.detail)
    const back = afSectorCodec.patch(text.text, made, depot)
    expect(back.ok && back.text).toBe(depotText)
  })

  it('says what it does in words, and refuses a height below nothing, or above the room, or a room that is not there', () => {
    expect(setTrim({ id: 'hall', skirting: 0.1 }).label).toBe('Change the trim of hall')
    expect(reasonOf(trim({ id: 'hall', skirting: -1 }))).toBe('the skirting is below the floor')
    expect(reasonOf(trim({ id: 'hall', rail: 9 }))).toBe('the rail is higher than the room (4 m)')
    expect(reasonOf(trim({ id: 'nowhere', rail: 1 }))).toBe('no sector nowhere')
  })
})

describe('sector.setMaterials', () => {
  const styled = toyAfSector({
    styles: { plain: { floorTexture: 'tile' } },
    sectors: [
      {
        ...must(depot.sectors[0]),
        corners: must(depot.sectors[0]).corners.map((corner, i) => (i === 1 ? ([8, 0] as const) : corner)),
      },
    ],
  } as Partial<AfSector2File>)
  const hallOf = (level: AfSector2File) => sector(level, 'hall')

  it('sets a texture and a style, and clears one with null', () => {
    const set = levelOf(
      run(
        afSectorProfile,
        styled,
        setMaterials({ id: 'hall', floorTexture: 'plank', style: 'plain', ceilingTexture: 'plaster' }),
      ),
    )
    expect(hallOf(set)).toMatchObject({ floorTexture: 'plank', style: 'plain', ceilingTexture: 'plaster' })
    const cleared = levelOf(
      run(
        afSectorProfile,
        set,
        setMaterials({ id: 'hall', floorTexture: null, style: null, wallTexture: null }),
      ),
    )
    expect(hallOf(cleared)).not.toHaveProperty('floorTexture')
    expect(hallOf(cleared)).not.toHaveProperty('style')
    expect(hallOf(cleared)).not.toHaveProperty('wallTexture')
    expect(hallOf(cleared)).toHaveProperty('ceilingTexture', 'plaster')
  })

  it('leaves a member alone that it is not told about, and changes nothing when told what is there', () => {
    const only = levelOf(
      run(afSectorProfile, styled, setMaterials({ id: 'hall', ceilingTexture: 'plaster' })),
    )
    expect(hallOf(only)).toMatchObject({
      floorTexture: 'tile',
      wallTexture: 'brick',
      ceilingTexture: 'plaster',
    })
    expect(levelOf(run(afSectorProfile, styled, setMaterials({ id: 'hall', floorTexture: 'tile' })))).toBe(
      styled,
    )
    expect(levelOf(run(afSectorProfile, styled, setMaterials({ id: 'hall', ceilingTexture: null })))).toBe(
      styled,
    )
  })

  it("refuses a style the level does not have, with the engine's sentence", () => {
    expect(reasonOf(run(afSectorProfile, styled, setMaterials({ id: 'hall', style: 'nope' })))).toBe(
      'unknown style nope',
    )
  })

  it('does not build the level for an edit that cannot change what the engine makes of it', () => {
    const broken = toyAfSector({ sectors: [{ ...must(depot.sectors[0]), style: 'plain' }] })
    expect(run(afSectorProfile, broken, setMaterials({ id: 'hall', floorTexture: 'plank' })).ok).toBe(true)
    expect(run(afSectorProfile, broken, setMaterials({ id: 'hall', style: null })).ok).toBe(true)
    expect(run(afSectorProfile, broken, setMaterials({ id: 'hall', style: 'plain' }))).toEqual({
      ok: true,
      level: broken,
    })
  })

  it('refuses an empty name, a call that says nothing and a sector that is not there', () => {
    expect(reasonOf(afRun(setMaterials({ id: 'hall', floorTexture: '' })))).toBe(
      'a texture is a name, not empty',
    )
    expect(reasonOf(afRun(setMaterials({ id: 'hall', style: '  ' })))).toBe('a style is a name, not empty')
    expect(reasonOf(afRun(setMaterials({ id: 'hall' })))).toBe('give a style or a texture')
    expect(reasonOf(afRun(setMaterials({ id: 'nowhere', floorTexture: 'tile' })))).toBe('no sector nowhere')
  })

  it('is called sector.setMaterials', () => {
    const edit = setMaterials({ id: 'hall', floorTexture: 'tile' })
    expect(edit.id).toBe('sector.setMaterials')
    expect(edit.label).toBe('Set the materials of hall')
  })
})
