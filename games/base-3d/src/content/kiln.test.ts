// The Cold Kiln as a level file (GAME-3D.1i): it loads and compiles with the first slice, passes the content check
// (G3-p) and the dungeon solver (G3-q) over its three rooms and the niche, and a broken copy fails naming the file and
// the JSON path (G3-F2).
import { describe, expect, it } from 'vitest'
import { AreaLoadError, checkWorld, compileWorld } from '../systems/index.ts'
import { solveWorld } from '../testing/solver.ts'
import { KILN, KILN_VIEWS } from './kiln.ts'
import file from './levels/kiln.af-sector.json'
import { areaFromSector } from './levels/sector-area.ts'
import { WORLD_SOURCES } from './world.ts'

const world = compileWorld(WORLD_SOURCES)

describe('the Cold Kiln (DESIGN.md §0.2)', () => {
  it('is three rooms and the niche, with the pits, the exit’s landing and the cast the design names', () => {
    expect(KILN.rooms.map((room) => room.view)).toEqual([
      'furnace-mouth',
      'bellows-gallery',
      'bellows-gallery',
      'niche',
      'hearth-chamber',
    ])
    expect(KILN.pits).toHaveLength(1)
    const count = (foe: string) => (KILN.foes ?? []).filter((candidate) => candidate.kind === foe).length
    expect([count('sootling'), count('ash-knight'), count('warden')]).toEqual([4, 1, 1])
    const chests = (KILN.entities ?? [])
      .filter((entity) => entity.def === 'chest')
      .map((entity) => entity.contents)
    expect(chests.sort()).toEqual(['bombs', 'compass', 'embers:50', 'hookchain', 'map', 'sling', 'small-key'])
    expect(world.areas.map((area) => area.id)).toEqual(['first-slice', 'cold-kiln'])
  })

  it('names a view the area defines in every room (G3-F2)', () => {
    const ids = new Set(KILN_VIEWS.map((view) => view.id))
    expect(KILN.rooms.every((room) => ids.has(room.view))).toBe(true)
  })

  it('passes the content check (G3-p)', () => {
    expect(checkWorld(world)).toEqual([])
  })

  it('can be played through whichever order its one key door is met in (G3-q)', () => {
    const result = solveWorld(world)
    expect(result.softLocks).toEqual([])
    expect(result.bossRooms).toEqual(['cold-kiln/hearth-chamber'])
    expect(result.rooms).toEqual([
      'cold-kiln/bellows-gallery',
      'cold-kiln/furnace-mouth',
      'cold-kiln/hearth-chamber',
      'cold-kiln/niche',
      'first-slice/hall',
      'first-slice/kiln',
    ])
    expect(result.chests).toEqual(
      ['bombs', 'compass', 'embers', 'hook', 'key', 'map', 'sling']
        .map((name) => (name === 'embers' ? 'cold-kiln/embers-chest' : `cold-kiln/${name}-chest`))
        .sort(),
    )
  })

  it('fails a broken copy of the file naming the file and the JSON path (G3-F2)', () => {
    const broken = structuredClone(file) as { sectors: { corners: number[][] }[] }
    broken.sectors[1]?.corners.pop()
    try {
      areaFromSector(broken, { file: 'kiln.af-sector.json', views: KILN_VIEWS })
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(AreaLoadError)
      expect((error as AreaLoadError).path).toBe('sectors[1]')
      expect((error as Error).message).toContain('kiln.af-sector.json')
    }
  })
})
