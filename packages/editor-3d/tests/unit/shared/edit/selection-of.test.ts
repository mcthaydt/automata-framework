// The selection ids a plan, a pick and a mesh share (ED3D.4 step 2): `sector:<id>` for a sector the document lists and
// `wall:<sector>/<corner>` for the wall that starts at one of its corners, and nothing for what only the geometry has.

import type { AfSector } from '@automata/3d/level'
import { describe, expect, it } from 'vitest'
import { selectionOf } from '#src/shared/edit/selection-of.ts'
import type { Edge } from '#src/shared/geometry/sectors.ts'
import { afSectorProfile } from '#src/shared/level-session/af-sector-profile.ts'
import { loadAuthored } from '#src/testing/fixtures.ts'
import { toyAfSector, toyDock, toyHall } from '#src/testing/toy-af-sector.ts'

const depot = (): AfSector => {
  const parsed = afSectorProfile.parse(loadAuthored('depot.af-sector'))
  if (!parsed.ok) throw new Error('the depot does not parse')
  return parsed.value
}

const edgesOf = (level: AfSector, sector: string): readonly Edge[] => {
  const found = afSectorProfile.geometry(level).layers[0]?.map.sectors.find((s) => s.id === sector)
  return found?.loops.flat() ?? []
}

describe('selectionOf on an af-sector level', () => {
  it('names a sector the document lists, and nothing for any other', () => {
    const select = selectionOf(afSectorProfile, depot())
    expect(select.sector('hall')).toBe('sector:hall')
    expect(select.sector('dock')).toBe('sector:dock')
    expect(select.sector('nowhere')).toBeUndefined()
  })

  it('names a wall by the corner it starts at', () => {
    const level = depot()
    const select = selectionOf(afSectorProfile, level)
    expect(edgesOf(level, 'hall').map((edge) => select.edge(edge))).toEqual([
      'wall:hall/0',
      'wall:hall/1',
      'wall:hall/2',
      'wall:hall/3',
    ])
    expect(select.edge(edgesOf(level, 'dock')[3] as Edge)).toBe('wall:dock/3')
  })

  it('names the sector for a wall that starts at no corner: a hole, and the walls round a pilaster', () => {
    const holed = toyAfSector({
      sectors: [
        {
          ...toyHall,
          corners: [
            [0, 0, { pilaster: { start: [0.5, 0.3] } }],
            [8, 0, { next: 'dock' }],
            [8, 6],
            [0, 6],
          ],
          holes: [
            [
              [2, 2],
              [4, 2],
              [4, 4],
              [2, 4],
            ],
          ],
        },
        toyDock,
      ],
    })
    const select = selectionOf(afSectorProfile, holed)
    const hall = afSectorProfile.geometry(holed).layers[0]?.map.sectors.find((s) => s.id === 'hall')
    const names = (edges: readonly Edge[]) => edges.map((edge) => select.edge(edge))
    expect(names(hall?.loops[1] ?? [])).toEqual(['sector:hall', 'sector:hall', 'sector:hall', 'sector:hall'])
    const notches = (hall?.loops[0] ?? []).filter((edge) => edge.notch)
    expect(notches.length).toBeGreaterThan(0)
    expect(names(notches).every((name) => name === 'sector:hall')).toBe(true)
    // The walls that are the file's own still say which corner they are.
    expect(names((hall?.loops[0] ?? []).filter((edge) => !edge.notch))).toEqual([
      'wall:hall/0',
      'wall:hall/1',
      'wall:hall/2',
      'wall:hall/3',
    ])
  })

  it('has nothing for a name that cannot be part of an id, and does not throw for it', () => {
    const odd = toyAfSector({
      sectors: [
        {
          ...toyHall,
          corners: [
            [0, 0],
            [8, 0, { next: 'a/b' }],
            [8, 6],
            [0, 6],
          ],
        },
        { ...toyDock, id: 'a/b' },
      ],
    })
    const select = selectionOf(afSectorProfile, odd)
    expect(select.sector('a/b')).toBeUndefined()
    expect(select.edge(edgesOf(odd, 'a/b')[0] as Edge)).toBeUndefined()
    expect(select.sector('hall')).toBe('sector:hall')
    expect(select.edge(edgesOf(odd, 'hall')[1] as Edge)).toBe('wall:hall/1')
  })

  it('gives the corners of the outline of a listed sector in document order, and none for any other sector', () => {
    const select = selectionOf(afSectorProfile, depot())
    expect(select.corners('hall')).toEqual([
      { x: 0, z: 0 },
      { x: 8, z: 0 },
      { x: 8, z: 6 },
      { x: 0, z: 6 },
    ])
    expect(select.corners('dock')[3]).toEqual({ x: 8, z: 6 })
    expect(select.corners('nowhere')).toEqual([])
  })

  it('reads the first sector of an id twice listed, as the wall locator does', () => {
    const twice = toyAfSector({
      sectors: [
        toyHall,
        {
          ...toyHall,
          corners: [
            [20, 20],
            [24, 20],
            [24, 24],
            [20, 24],
          ],
        },
      ],
    })
    expect(selectionOf(afSectorProfile, twice).corners('hall')[0]).toEqual({ x: 0, z: 0 })
  })

  it('belongs to the level it was made for: a sector of another level has none', () => {
    const level = depot()
    const select = selectionOf(afSectorProfile, toyAfSector({ sectors: [toyDock] }))
    expect(select.sector('hall')).toBeUndefined()
    expect(select.edge(edgesOf(level, 'hall')[0] as Edge)).toBeUndefined()
    expect(select.sector('dock')).toBe('sector:dock')
  })
})
