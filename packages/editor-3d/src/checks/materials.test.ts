// The `materials` check (ED3D.2b-2): every material a level names is in the profile's list. Seeded over small rooms,
// then held to the shipped files with the game's own list.
import { describe, expect, it } from 'vitest'
import type { SectorDef } from '../format/sector.schema'
import { TRIM_PIECES, type WallDef } from '../format/sector.schema'
import { afSectorProfile } from '../profile/af-sector-profile'
import { lastLightProfile } from '../profile/last-light-profile'
import { plainContext } from '../testing/check-context'
import { FIXTURE_NAMES, loadAuthored, loadFixture } from '../testing/fixtures'
import { loadGameFacts } from '../testing/game-facts'
import { must } from '../testing/toy-blockout'
import { room, square } from '../testing/toy-sectors'
import { materialProblems } from './materials'

const known = new Set(['plaster', 'tile', 'brick'])

const check = (defs: SectorDef[], list: ReadonlySet<string> = known) =>
  materialProblems(plainContext(defs), list)

/** A square room whose wall from the corner at `index` is `wall`. */
const withWall = (index: number, wall: WallDef, more: Partial<SectorDef> = {}): SectorDef => {
  const corners = square(0, 0, 4, 4).map((corner, i) => (i === index ? [...corner, wall] : corner))
  return room('a', corners as SectorDef['corners'], more)
}

describe('materialProblems: sectors', () => {
  it('passes a level that names no material, and one that names only listed ones', () => {
    expect(check([room('a', square(0, 0, 4, 4))])).toEqual([])
    const named = room('a', square(0, 0, 4, 4), {
      floorTexture: 'tile',
      ceilingTexture: 'plaster',
      wallTexture: 'brick',
    })
    expect(check([named])).toEqual([])
  })

  it('says each field of a sector that names a material the list lacks, floor then ceiling then wall, at the sector', () => {
    const bad = room('a', square(0, 0, 4, 4), {
      wallTexture: 'marble',
      floorTexture: 'carpet',
      ceilingTexture: 'foam',
    })
    expect(check([bad])).toEqual([
      { message: 'a: floorTexture carpet is not a material', locator: { selection: 'sector:a' } },
      { message: 'a: ceilingTexture foam is not a material', locator: { selection: 'sector:a' } },
      { message: 'a: wallTexture marble is not a material', locator: { selection: 'sector:a' } },
    ])
  })

  it('says it at every sector that uses the material, in the order of the map', () => {
    const level = [
      room('a', square(0, 0, 4, 4), { floorTexture: 'carpet' }),
      room('b', square(10, 0, 14, 4), { floorTexture: 'carpet' }),
    ]
    expect(check(level).map((problem) => problem.message)).toEqual([
      'a: floorTexture carpet is not a material',
      'b: floorTexture carpet is not a material',
    ])
  })

  it('has no material to allow when the list is empty: every name is said', () => {
    const level = [room('a', square(0, 0, 4, 4), { floorTexture: 'tile' })]
    expect(check(level, new Set()).map((problem) => problem.message)).toEqual([
      'a: floorTexture tile is not a material',
    ])
  })

  it('gives a sector whose id cannot be a selection no place, and does not fail on it', () => {
    const [problem] = check([room('a/b', square(0, 0, 4, 4), { floorTexture: 'carpet' })])
    expect(problem?.message).toBe('a/b: floorTexture carpet is not a material')
    expect(problem?.locator).toBeUndefined()
  })
})

describe('materialProblems: walls', () => {
  it('says a wall whose texture the list lacks, at the wall', () => {
    expect(check([withWall(2, { texture: 'marble' })])).toEqual([
      {
        message: 'a: wall texture marble is not a material',
        locator: { selection: 'wall:a/2', at: { x: 4, z: 4 } },
      },
    ])
  })

  it('says each wall of a sector that names the same missing texture, at its own wall', () => {
    const corners = square(0, 0, 4, 4).map((corner, i) =>
      i === 0 || i === 2 ? [...corner, { texture: 'marble' }] : corner,
    )
    const problems = check([room('a', corners as SectorDef['corners'])])
    expect(problems.map((problem) => problem.locator?.selection)).toEqual(['wall:a/0', 'wall:a/2'])
    expect(new Set(problems.map((problem) => problem.message)).size).toBe(1)
  })

  it('says each trim piece whose texture the list lacks, in the order of the pieces, whatever the order in the file', () => {
    const wall: WallDef = {
      trimTexture: { capital: 'gilt', skirting: 'oak', rail: 'tile', wainscot: 'tile' },
    }
    expect(check([withWall(0, wall)]).map((problem) => problem.message)).toEqual([
      'a: wall trimTexture skirting oak is not a material',
      'a: wall trimTexture capital gilt is not a material',
    ])
    expect([...TRIM_PIECES]).toEqual(['skirting', 'wainscot', 'rail', 'capital'])
  })

  it('says a wall’s texture before its trim, and a sector’s own before its walls', () => {
    const level = withWall(1, { texture: 'marble', trimTexture: { rail: 'oak' } }, { floorTexture: 'carpet' })
    expect(check([level]).map((problem) => problem.message)).toEqual([
      'a: floorTexture carpet is not a material',
      'a: wall texture marble is not a material',
      'a: wall trimTexture rail oak is not a material',
    ])
  })

  it('passes walls whose textures and trim are all listed', () => {
    const wall: WallDef = { texture: 'brick', trimTexture: { skirting: 'tile', rail: 'plaster' } }
    expect(check([withWall(3, wall)])).toEqual([])
  })

  it('says a wall once when a pilaster notches it: the notch walls are not another place', () => {
    const wall: WallDef = { texture: 'marble', pilaster: { start: [1, 0.2] } }
    const problems = check([withWall(0, wall)]).filter((problem) => /wall texture/.test(problem.message))
    expect(problems).toHaveLength(1)
  })
})

describe('materialProblems: the shipped files', () => {
  const facts = loadGameFacts()

  it.each(FIXTURE_NAMES.filter((name) => name !== 'facility'))(
    'passes %s with the game’s own list of materials',
    (name) => {
      const parsed = lastLightProfile.parse(loadFixture(name))
      if (!parsed.ok) throw new Error(`${name} does not parse`)
      const layer = must(lastLightProfile.geometry(parsed.value).layers[0])
      if (layer.kind !== 'sectors') throw new Error('no sectors')
      const list = new Set(facts.options.materials)
      expect(materialProblems({ map: layer.map, wall: () => undefined }, list)).toEqual([])
    },
  )

  it('passes the depot with its own table', () => {
    const parsed = afSectorProfile.parse(loadAuthored('depot.af-sector'))
    if (!parsed.ok) throw new Error('the depot does not parse')
    const layer = must(afSectorProfile.geometry(parsed.value).layers[0])
    if (layer.kind !== 'sectors') throw new Error('no sectors')
    const list = new Set(Object.keys(parsed.value.materials ?? {}))
    expect(list.size).toBeGreaterThan(0)
    expect(materialProblems({ map: layer.map, wall: () => undefined }, list)).toEqual([])
  })

  it('says a texture the game’s list lacks in a shipped file: the clinic with a floor of marble', () => {
    const parsed = lastLightProfile.parse(loadFixture('blockout-clinic'))
    if (!parsed.ok) throw new Error('the clinic does not parse')
    const rooms = parsed.value.rooms.map((r, i) => (i === 0 ? { ...r, floorTexture: 'marble' } : r))
    const layer = must(lastLightProfile.geometry({ ...parsed.value, rooms }).layers[0])
    if (layer.kind !== 'sectors') throw new Error('no sectors')
    const problems = materialProblems(
      { map: layer.map, wall: () => undefined },
      new Set(facts.options.materials),
    )
    expect(problems.map((problem) => problem.message)).toEqual([
      `${must(rooms[0]).id}: floorTexture marble is not a material`,
    ])
  })
})
