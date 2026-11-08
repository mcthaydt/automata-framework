// `buildSectors` turns an `af-sector/1` level into the engine data the geometry reads (ED3D.1b plan, step 2): a
// `SectorDef` per sector, with a named style layered under the sector's own fields, and
// nothing of the sector's other members.

import type { AfSector, AfSectorEntry } from '@automata/3d/level'
import { describe, expect, it } from 'vitest'
import { resolveMap } from '#src/shared/geometry/sectors.ts'
import { AfBuildError, buildSectors } from '#src/shared/level-session/af-sector/build.ts'
import { must } from '#src/testing/edit-helpers.ts'
import { toyAfSector, toyHall } from '#src/testing/toy-af-sector.ts'

const only = (entry: Partial<AfSectorEntry>, more: Partial<AfSector> = {}) =>
  buildSectors(toyAfSector({ sectors: [{ ...toyHall, ...entry }], ...more }))[0]

describe('buildSectors', () => {
  it('builds a sector per entry, in order, with the fields the engine reads and an empty zone', () => {
    const built = buildSectors(toyAfSector())
    expect(built.map((sector) => sector.id)).toEqual(['hall', 'dock'])
    expect(built[0]).toEqual({
      id: 'hall',
      zone: '',
      floor: 0,
      ceiling: 4,
      light: 1,
      corners: [
        [0, 0],
        [8, 0, { next: 'dock' }],
        [8, 6],
        [0, 6],
      ],
    })
    expect(built[1]).toMatchObject({ id: 'dock', floor: -0.5, light: 0.7, zone: '' })
  })

  it('carries a sector’s open flag, textures, trim and holes, and its walls as written', () => {
    const wall = { door: { at: 1, width: 1, height: 2.1 }, thick: 0.2 }
    const sector = only({
      open: true,
      floorTexture: 'tile',
      ceilingTexture: 'plaster',
      wallTexture: 'brick',
      trim: { skirting: 0.1 },
      corners: [
        [0, 0, wall],
        [8, 0],
        [8, 6],
        [0, 6],
      ],
      holes: [
        [
          [1, 1],
          [2, 1],
          [2, 2],
        ],
      ],
    })
    expect(sector).toMatchObject({
      open: true,
      floorTexture: 'tile',
      ceilingTexture: 'plaster',
      wallTexture: 'brick',
      trim: { skirting: 0.1 },
    })
    expect(sector?.corners[0]).toEqual([0, 0, wall])
    expect(sector?.holes).toEqual([
      [
        [1, 1],
        [2, 1],
        [2, 2],
      ],
    ])
  })

  it('layers a style under the sector’s own fields: the sector wins, and a trim replaces the style’s whole', () => {
    const styles = {
      plain: { wallTexture: 'brick', floorTexture: 'tile', trim: { skirting: 0.1, rail: 0.05, cap: true } },
    }
    const styled = only({ style: 'plain', floorTexture: 'oak', trim: { rail: 0.2 } }, { styles })
    expect(styled).toMatchObject({ wallTexture: 'brick', floorTexture: 'oak', trim: { rail: 0.2 } })
    expect(styled?.trim).toEqual({ rail: 0.2 })
    expect(only({ style: 'plain' }, { styles })?.trim).toEqual({ skirting: 0.1, rail: 0.05, cap: true })
    // A style with no trim leaves the sector's alone, and a sector with no style takes nothing.
    expect(
      only({ style: 'bare', trim: { rail: 0.2 } }, { styles: { bare: { wallTexture: 'b' } } })?.trim,
    ).toEqual({
      rail: 0.2,
    })
    expect(only({}, { styles })?.wallTexture).toBeUndefined()
  })

  it('refuses a style that is not in the table, or a table that is not there, with the style’s name', () => {
    expect(() => only({ style: 'ghost' }, { styles: { plain: {} } })).toThrow(
      new AfBuildError('unknown style ghost'),
    )
    expect(() => only({ style: 'ghost' })).toThrow(AfBuildError)
    expect(() => only({ style: 'ghost' })).toThrow('unknown style ghost')
    // Not an inherited name either.
    expect(() => only({ style: 'toString' }, { styles: {} })).toThrow('unknown style toString')
  })

  it('leaves out what the engine does not read: a sector’s and a style’s unknown members, and the style name', () => {
    const entry = { ...toyHall, style: 'plain', tags: ['indoors'], mood: 'dim' } as AfSectorEntry
    const [sector] = buildSectors(
      toyAfSector({ sectors: [entry], styles: { plain: { wallTexture: 'b', mood: 'x' } as never } }),
    )
    expect(Object.keys(sector ?? {}).sort()).toEqual([
      'ceiling',
      'corners',
      'floor',
      'id',
      'light',
      'wallTexture',
      'zone',
    ])
  })

  it('changes nothing in the level it is given', () => {
    const level = toyAfSector({ styles: { plain: { wallTexture: 'brick' } } })
    const before = JSON.stringify(level)
    const built = buildSectors(level)
    must(built[0]).corners.push([9, 9])
    expect(JSON.stringify(level)).toBe(before)
  })

  it('builds no sector for no sectors', () => {
    expect(buildSectors(toyAfSector({ sectors: [] }))).toEqual([])
  })
})

describe('the geometry of a built level', () => {
  it('names a portal to a sector that is not there, as the engine does', () => {
    const level = toyAfSector({ sectors: [toyHall] })
    expect(() => resolveMap(buildSectors(level))).toThrow('hall: unknown portal target dock')
  })
})
