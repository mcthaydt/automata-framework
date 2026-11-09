// The place along a wall that a pointer is at (ED3D.6f, taken out of the Wall and Vertex tools, which each had it inline):
// a wall hit becomes the sector and corner the document writes it by, its length, how far along it the pointer is
// (from the document's start corner, rounded by the keys) and the point there. The depot is the level: the hall runs from
// (0, 0) to (8, 6) and the dock from (8, 0) to (14, 6), joined by a portal along x = 8.
import type { PointerKind } from '@automataframework/automata-editor/kit/core'
import { describe, expect, it } from 'vitest'
import type { AfSector } from '../format/af-sector.schema'
import { createLevelEditor } from '../model/level-editor'
import { afSectorProfile } from '../profile/af-sector-profile'
import { loadAuthored } from '../testing/fixtures'
import { toyAfSector, toyDock, toyHall } from '../testing/toy-af-sector'
import type { WallHit } from '../view/plan/plan-pick'
import { planViewport, toScreen } from '../view/plan/plan-viewport'
import { createGeometryCache } from './geometry-cache'
import { outlinePlaceAt, wallPlaceOf } from './wall-place'

const depot: AfSector = (() => {
  const result = afSectorProfile.parse(loadAuthored('depot.af-sector'))
  if (!result.ok) throw new Error('the depot does not parse')
  return result.value
})()

const editor = (level: AfSector = depot) => ({ profile: afSectorProfile, level })

const hit = (selection: string, sector: string, x: number, z: number): WallHit => ({
  kind: 'wall',
  selection,
  sector,
  at: { x, z },
  distance: 0,
})

describe('wallPlaceOf', () => {
  it('names the sector and corner, the length, how far along the pointer is and the point there', () => {
    expect(wallPlaceOf(editor(), hit('wall:hall/2', 'hall', 5.93, 6), {})).toEqual({
      place: {
        sector: 'hall',
        corner: 2,
        selection: 'wall:hall/2',
        length: 8,
        along: 2.05,
        point: { x: 5.95, z: 6 },
      },
      wall: undefined,
    })
  })

  it('rounds the place to 5 cm, 1 cm with Shift, and keeps it as it is with Alt', () => {
    const wall = hit('wall:hall/2', 'hall', 5.934, 6)
    expect(wallPlaceOf(editor(), wall, {})?.place).toMatchObject({ along: 2.05, point: { x: 5.95, z: 6 } })
    expect(wallPlaceOf(editor(), wall, { shift: true })?.place).toMatchObject({
      along: 2.07,
      point: { x: 5.93, z: 6 },
    })
    expect(wallPlaceOf(editor(), wall, { alt: true })?.place).toMatchObject({
      along: 2.066,
      point: { x: 5.934, z: 6 },
    })
  })

  it('holds the place within the wall', () => {
    const past = wallPlaceOf(editor(), hit('wall:hall/2', 'hall', -3, 6), {})
    expect(past?.place).toMatchObject({ along: 8, point: { x: 0, z: 6 } })
  })

  it("measures from the start of the wall as the document writes it, whichever way the sector's loop runs", () => {
    const annex = toyAfSector({
      sectors: [
        toyHall,
        toyDock,
        {
          id: 'annex',
          floor: 0,
          ceiling: 4,
          light: 1,
          corners: [
            [-6, 6],
            [0, 6],
            [0, 0],
            [-6, 0],
          ],
        },
      ],
    })
    // The annex runs the other way round: its east wall starts at (0, 6) and ends at (0, 0).
    const place = wallPlaceOf(editor(annex), hit('wall:annex/1', 'annex', 0, 2), {})
    expect(place?.place).toMatchObject({
      sector: 'annex',
      corner: 1,
      length: 6,
      along: 4,
      point: { x: 0, z: 2 },
    })
  })

  it('answers the wall as the document writes it, for the tool that needs to know what it says', () => {
    const hall = wallPlaceOf(editor(), hit('wall:hall/1', 'hall', 8, 3), {})
    expect(hall?.wall).toEqual({ next: 'dock' })
  })

  it('answers nothing for a hit that is not the wall of a corner, or of a sector that is not there', () => {
    expect(wallPlaceOf(editor(), hit('sector:hall', 'hall', 4, 0), {})).toBeUndefined()
    expect(wallPlaceOf(editor(), hit('wall:ghost/0', 'ghost', 4, 0), {})).toBeUndefined()
    expect(wallPlaceOf(editor(), hit('wall:hall/9', 'hall', 4, 0), {})).toBeUndefined()
  })
})

describe('outlinePlaceAt', () => {
  const SIZE = { w: 800, h: 400 }
  const setup = (level: AfSector = depot) => {
    const editor = createLevelEditor({ profile: afSectorProfile, level })
    editor.view.set({ camera: { x: 7, z: 3, zoom: 1 } })
    const geometry = createGeometryCache(editor)
    const placeAt = (
      x: number,
      z: number,
      kind: PointerKind = 'mouse',
      keys: { shift?: boolean; alt?: boolean } = {},
    ) => {
      const viewport = planViewport(editor.view.state.camera, SIZE)
      return outlinePlaceAt(editor, geometry(), viewport, { ...toScreen(viewport, { x, z }), kind, ...keys })
    }
    return { editor, placeAt }
  }

  it('is the place along the wall under the pointer', () => {
    const { placeAt } = setup()
    expect(placeAt(5.93, 6.1)).toEqual({
      kind: 'wall',
      sector: 'hall',
      corner: 2,
      selection: 'wall:hall/2',
      length: 8,
      along: 2.05,
      point: { x: 5.95, z: 6 },
    })
    expect(placeAt(5.93, 6.1, 'mouse', { shift: true })).toMatchObject({ along: 2.07 })
  })

  it('is the corner under the pointer, and a corner wins over the wall beside it', () => {
    const { placeAt } = setup()
    expect(placeAt(0.05, 0.05)).toEqual({ kind: 'corner', sector: 'hall', corner: 0, point: { x: 0, z: 0 } })
    expect(placeAt(0.15, 0.02)).toMatchObject({ kind: 'corner', corner: 0 })
    expect(placeAt(0.4, 0.02)).toMatchObject({ kind: 'wall', corner: 0 })
  })

  it('is the corner of the sector that holds the pointer when two have one at a point', () => {
    const { placeAt } = setup()
    expect(placeAt(7.95, 5.95)).toMatchObject({ kind: 'corner', sector: 'hall', corner: 2 })
    expect(placeAt(8.05, 5.95)).toMatchObject({ kind: 'corner', sector: 'dock', corner: 3 })
  })

  it("is within the pointer kind's reach: 8 px for a mouse, 12 for a Pencil, 22 for a finger", () => {
    const { placeAt } = setup()
    // 0.3 m is 9.6 px from the north wall.
    expect(placeAt(3, 0.3, 'mouse')).toBeUndefined()
    expect(placeAt(3, 0.3, 'pen')).toMatchObject({ kind: 'wall', corner: 0 })
    expect(placeAt(3, 0.5, 'pen')).toBeUndefined()
    expect(placeAt(3, 0.5, 'touch')).toMatchObject({ kind: 'wall', corner: 0 })
  })

  it('is nothing over a sector fill, away from every wall and corner', () => {
    const { placeAt } = setup()
    expect(placeAt(4, 3)).toBeUndefined()
    expect(placeAt(20, 20)).toBeUndefined()
  })

  it('is nothing in a hidden or a locked walls layer', () => {
    const { editor, placeAt } = setup()
    editor.view.set({ hidden: ['walls'] })
    expect(placeAt(3, 0.05)).toBeUndefined()
    expect(placeAt(0.05, 0.05)).toBeUndefined()
    editor.view.set({ hidden: [], locked: ['walls'] })
    expect(placeAt(3, 0.05)).toBeUndefined()
    editor.view.set({ locked: [] })
    expect(placeAt(3, 0.05)).toMatchObject({ kind: 'wall' })
  })
})
