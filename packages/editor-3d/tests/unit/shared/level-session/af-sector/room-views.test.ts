// The rooms of an `af-sector/2` file as the edits see them and back (Levels 3D spec §5): a number stays a number, an
// object stays an object, and what no edit touched is written as it was written.

import type { AfSector2File } from '@automata/3d/level'
import { describe, expect, it } from 'vitest'
import { moveCorner } from '#src/shared/edit/corner-edits.ts'
import type { Edit } from '#src/shared/edit/edit.ts'
import {
  addSector,
  duplicateSector,
  setHeights,
  setLight,
  setMaterials,
} from '#src/shared/edit/sector-edits.ts'
import { insertCorner } from '#src/shared/edit/vertex-edits.ts'
import { setWallMaterial } from '#src/shared/edit/wall-edits.ts'
import { reversedWall } from '#src/shared/edit/wall-geometry.ts'
import { afSectorCodec } from '#src/shared/level-session/af-sector/af-codec.ts'
import { afSectorAccess } from '#src/shared/level-session/af-sector/af-sectors.ts'
import { roomView, surfaceName, writeRoom } from '#src/shared/level-session/af-sector/room-views.ts'
import { afSectorProfile } from '#src/shared/level-session/af-sector-profile.ts'
import { levelOf, must, reasonOf, rect } from '#src/testing/edit-helpers.ts'
import { loadAuthored } from '#src/testing/fixtures.ts'
import { CREATE_GAME_ROOM, GRID, PLACED, SLOPED, TRIMMED, toyAfSector } from '#src/testing/toy-af-sector.ts'

const DEPOT_TEXT = loadAuthored('depot.af-sector')
const depot = (() => {
  const result = afSectorProfile.parse(DEPOT_TEXT)
  if (!result.ok) throw new Error('the depot does not parse')
  return result.value
})()

const V2_FILE_FIXTURES: readonly AfSector2File[] = [
  depot,
  toyAfSector(),
  SLOPED,
  PLACED,
  GRID,
  TRIMMED,
  CREATE_GAME_ROOM,
]

const apply = (level: AfSector2File, edit: Edit<AfSector2File>): AfSector2File =>
  levelOf(edit.run(afSectorProfile, level))
const first = (level: AfSector2File) => must(level.sectors[0])

describe('the views of the rooms of an af-sector/2 file', () => {
  it('lists the same view for the same room, and writes an untouched level back as itself', () => {
    for (const fixture of V2_FILE_FIXTURES) {
      const rooms = afSectorAccess.list(fixture)
      expect(afSectorAccess.list(fixture)[0]).toBe(rooms[0])
      expect(afSectorAccess.withSectors(fixture, rooms)).toBe(fixture)
    }
  })

  it('writes an untouched room back as the file’s own object', () => {
    expect(writeRoom(roomView(first(SLOPED)))).toBe(first(SLOPED))
  })

  it('writes a height into the plane as it was written', () => {
    expect(first(apply(depot, setHeights({ id: 'hall', floor: 0.5 }))).floor).toBe(0.5)
    expect(first(apply(SLOPED, setHeights({ id: 'ramp', floor: 1 }))).floor).toEqual({
      z: 1,
      slope: [0.25, 0],
      surface: 'stone',
    })
  })

  it('leaves a plane alone when its height was not touched', () => {
    const lit = apply(SLOPED, setLight({ id: 'ramp', light: 0.5 }))
    expect(first(lit).floor).toBe(first(SLOPED).floor)
  })

  it('writes a texture into the surface as it was written', () => {
    const level = apply(PLACED, setWallMaterial({ sector: 'shop', corner: 0, texture: 'brick' }))
    const wall = must(first(level).corners[0])[2]
    expect(wall).toEqual({ surface: { tile: 'brick', repeat: [2, 1] } })
    expect(surfaceName(must(wall).surface)).toBe('brick')
  })

  it('says a wall with only a surface is that texture, and nothing more', () => {
    const view = must(afSectorAccess.list(PLACED)[0])
    expect(must(view.corners[0])[2]).toMatchObject({ texture: 'tiles' })
    expect(must(view.corners[0])[2]).not.toHaveProperty('surface')
  })

  it('takes a texture off a wall and leaves the wall bare', () => {
    const level = apply(PLACED, setWallMaterial({ sector: 'shop', corner: 0, texture: null }))
    expect(must(first(level).corners[0])).toHaveLength(2)
  })

  it('a sloped floor stays put when its first corner moves', () => {
    const heightAt = (level: AfSector2File, x: number, z: number): number => {
      const plane = first(level).floor
      if (typeof plane === 'number') return plane
      const origin = must(first(level).corners[0])
      const [sx, sz] = plane.slope ?? [0, 0]
      return plane.z + sx * (x - origin[0]) + sz * (z - origin[1])
    }
    const moved = apply(SLOPED, moveCorner({ sector: 'ramp', corner: 0, x: 1, z: 0 }))
    expect(heightAt(moved, 4, 2)).toBeCloseTo(heightAt(SLOPED, 4, 2))
    expect(first(moved).floor).toMatchObject({ slope: [0.25, 0], surface: 'stone' })
  })

  it('keeps a room’s members in the order the file wrote them', () => {
    const level = apply(depot, setHeights({ id: 'hall', ceiling: 3 }))
    expect(Object.keys(first(level))).toEqual(Object.keys(first(depot)))
  })

  it('keeps a trim written as a surface through a split of its wall', () => {
    const level = apply(TRIMMED, insertCorner({ sector: 'shop', corner: 0, x: 3, z: 0 }))
    expect(first(level).corners.map((corner) => corner[2]?.trim)).toEqual([
      'trimWhite',
      'trimWhite',
      undefined,
      undefined,
      undefined,
    ])
  })

  it('moves a decor with a reversed wall', () => {
    const wall = { decor: [{ kind: 'sign', pos: 1, width: 1 }] } as const
    expect(reversedWall(wall, 4)).toMatchObject({ decor: [{ pos: 3 }] })
  })

  it('splits a wall’s decor between its halves', () => {
    const wall = {
      decor: [
        { kind: 'sign', pos: 1, width: 1 },
        { kind: 'shop', pos: 5, width: 2 },
      ],
    } as const
    const level = toyAfSector({
      sectors: [
        {
          id: 'shop',
          floor: 0,
          ceiling: 3,
          light: 1,
          corners: [
            [0, 0, wall],
            [6, 0],
            [6, 4],
            [0, 4],
          ],
        },
      ],
    })
    const split = apply(level, insertCorner({ sector: 'shop', corner: 0, x: 3, z: 0 }))
    expect(must(first(split).corners[0])[2]).toMatchObject({ decor: [{ kind: 'sign', pos: 1 }] })
    expect(must(first(split).corners[1])[2]).toMatchObject({ decor: [{ kind: 'shop', pos: 2 }] })
  })

  it('does not split a wall with a row of windows', () => {
    expect(reasonOf(insertCorner({ sector: 'shop', corner: 0, x: 3, z: 0 }).run(afSectorProfile, GRID))).toBe(
      'This wall has a row of windows. Take them off first, then split the wall.',
    )
  })
})

/** The text outside the `sectors` list, which a change to a room must leave byte for byte as it was. */
function outsideSectors(text: string): readonly [string, string] {
  const open = text.indexOf('"sectors": [') + '"sectors": ['.length
  let depth = 1
  let at = open
  while (depth > 0) {
    const char = text[at++]
    if (char === '[') depth++
    else if (char === ']') depth--
  }
  return [text.slice(0, open), text.slice(at)]
}

describe('what an edit leaves alone in the text', () => {
  const edits: readonly [string, Edit<AfSector2File>][] = [
    ['set a height', setHeights({ id: 'hall', floor: 0.5 })],
    ['dim a room', setLight({ id: 'hall', light: 0.4 })],
    ['move a corner', moveCorner({ sector: 'hall', corner: 2, x: 9, z: 6 })],
    ['split a wall', insertCorner({ sector: 'hall', corner: 2, x: 4, z: 6 })],
    ['set a wall texture', setWallMaterial({ sector: 'dock', corner: 0, texture: 'tile' })],
    ['set the room materials', setMaterials({ id: 'dock', wallTexture: 'tile' })],
    ['draw a room', addSector({ id: 'yard', corners: rect(20, 0, 24, 4) })],
    ['copy a room', duplicateSector({ id: 'dock', offset: { x: 6, z: 0 } })],
  ]

  it.each(edits)('%s, and its Undo, leave the rest of the file’s text unchanged', (_name, edit) => {
    const model = afSectorProfile.parse(DEPOT_TEXT)
    if (!model.ok) throw new Error('the depot does not parse')
    const after = levelOf(edit.run(afSectorProfile, model.value))
    const written = afSectorCodec.patch(DEPOT_TEXT, model.value, after)
    if (!written.ok) throw new Error(written.detail)
    const [before, behind] = outsideSectors(DEPOT_TEXT)
    const [head, tail] = outsideSectors(written.text)
    expect([head, tail]).toEqual([before, behind])
    const undone = afSectorCodec.patch(written.text, after, model.value)
    if (!undone.ok) throw new Error(undone.detail)
    expect(undone.text).toBe(DEPOT_TEXT)
  })
})
