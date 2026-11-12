// Sequence's plan over a 3D level: the walls of an `af-sector/2` file as plan segments (a sector edge that is not a portal,
// split round a door), and the names the level offers a script's pickers: its lamps, doors, props and things.
import { createMemoryPorts } from '@automataframework/editor/kit/ports/testing'
import { describe, expect, it } from 'vitest'
import { levelNamesOf, wallsOfFile } from '#src/features/sequence/plan-view.ts'
import { namesFor, readGameNames } from '#src/features/sequence/sequence-names.ts'

/** Three rooms in a row, each 4 m square: a ↔ b ↔ c by portals, solid walls all round, a door in c's east wall. */
const LEVEL = JSON.stringify({
  format: 'af-sector/2',
  name: 'row',
  sectors: [
    {
      id: 'a',
      floor: 0,
      ceiling: 3,
      light: 1,
      corners: [
        [0, 0],
        [4, 0, { next: 'b' }],
        [4, 4],
        [0, 4],
      ],
    },
    {
      id: 'b',
      floor: 0,
      ceiling: 3,
      light: 1,
      corners: [
        [4, 0],
        [8, 0, { next: 'c' }],
        [8, 4],
        [4, 4, { next: 'a' }],
      ],
    },
    {
      id: 'c',
      floor: 0,
      ceiling: 3,
      light: 1,
      corners: [
        [8, 0],
        [12, 0, { door: { at: 2, width: 1, height: 2, id: 'gate' } }],
        [12, 4],
        [8, 4, { next: 'b' }],
      ],
    },
  ],
  lamps: [{ id: 'hall', kind: 'bulb', at: [2, 2.5, 2] }],
  props: [{ id: 'table', kind: 'table', at: [6, 2] }],
  entityDefs: [{ id: 'hotspot' }],
  entities: [{ def: 'hotspot', id: 'jar', x: 2, z: 1 }],
})

const key = (s: readonly number[]): string => s.map((n) => n.toFixed(2)).join(',')

describe('wallsOfFile for a 3D level', () => {
  const read = wallsOfFile(LEVEL, 'content/levels/row.af-sector.json')
  const walls = 'walls' in read ? read.walls : []

  it('gives a segment for each solid wall and none across a portal', () => {
    expect('problem' in read).toBe(false)
    expect(walls.map(key)).not.toContain(key([4, 0, 4, 4]))
    expect(walls.map(key)).toContain(key([0, 4, 0, 0]))
    expect(walls.map(key)).toContain(key([0, 0, 4, 0]))
    expect(walls.map(key)).toContain(key([8, 0, 12, 0]))
  })

  it('gives two segments either side of a wall with a door, and not the door', () => {
    const doorWall = walls.filter((s) => s[0] === 12 && s[2] === 12)
    expect(doorWall.map(key).sort()).toEqual([key([12, 0, 12, 1.5]), key([12, 2.5, 12, 4])].sort())
  })

  it('counts them: a has 3 solid walls, b 2, c its north and south and the two halves of its door wall', () => {
    expect(walls).toHaveLength(9)
  })
})

describe('wallsOfFile for other files', () => {
  it('says in a sentence when a file is neither a 3D level nor a 2D one', () => {
    const read = wallsOfFile('{"format":"tiled/1"}', 'content/levels/x.json')
    expect(read).toEqual({ problem: expect.stringContaining('content/levels/x.json') })
    expect('problem' in read && read.problem).toMatch(/not a level/)
  })

  it('says so for text that does not read at all', () => {
    expect(wallsOfFile('][', 'content/levels/x.json')).toEqual({
      problem: expect.stringContaining('not a level'),
    })
  })
})

describe('the names a 3D level offers', () => {
  it('lists its lamps, the doors of its sectors, its props and its things', () => {
    const names = levelNamesOf(LEVEL, 'content/levels/row.af-sector.json')
    expect(names).toEqual({ lamps: ['hall'], doors: ['gate'], props: ['table'], things: ['jar'] })
  })

  it('offers nothing from a file that is not a 3D level', () => {
    expect(levelNamesOf('{"format":"tiled/1"}', 'x.json')).toEqual({
      lamps: [],
      doors: [],
      props: [],
      things: [],
    })
  })
})

describe('the pickers of a game with a 3D level', () => {
  it('offer the level’s lamps, doors, props and things, and its walls can be shown under the scene', async () => {
    const path = 'content/levels/row.af-sector.json'
    const { ports } = await createMemoryPorts({
      files: { [path]: LEVEL },
      classify: (file) => ({
        path: file,
        editor: 'sequence',
        gates: [],
        checks: [],
        modes: ['edit'],
        writable: true,
      }),
    })
    const game = await readGameNames(ports, await ports.workspace.files())
    const names = namesFor(game, undefined)
    expect(names.lamps).toEqual(['hall'])
    expect(names.doors).toEqual(['gate'])
    expect(names.props).toEqual(['table'])
    expect(names.anchors).toContain('jar')
    expect(game.levels).toEqual([{ name: 'row', path }])
  })
})
