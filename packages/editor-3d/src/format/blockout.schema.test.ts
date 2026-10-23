import { describe, expect, it } from 'vitest'
import { FIXTURE_NAMES, type FixtureName, loadFixture } from '../testing/fixtures'
import { blockoutSchema } from './blockout.schema'

const BLOCKOUTS = FIXTURE_NAMES.filter(
  (name): name is Exclude<FixtureName, 'facility'> => name !== 'facility',
)

// biome-ignore lint/suspicious/noExplicitAny: tests edit a parsed file by path
type Json = Record<string, any>
const clinic = (): Json => JSON.parse(loadFixture('blockout-clinic'))

/** The paths Zod reports for a value it refuses, or undefined when it accepts it. */
const refusedAt = (value: unknown): PropertyKey[][] | undefined => {
  const result = blockoutSchema.safeParse(value)
  return result.success ? undefined : result.error.issues.map((issue) => issue.path)
}

describe('the blockout schema', () => {
  for (const name of BLOCKOUTS) {
    it(`${name}: parses, and the parse is the file's own value (a validator, not a transform)`, () => {
      const json = JSON.parse(loadFixture(name))
      const result = blockoutSchema.safeParse(json)
      expect(result.success, JSON.stringify(result.error?.issues)).toBe(true)
      expect(result.data).toStrictEqual(json)
    })
  }

  it('keeps a member it does not know, in a room and in the file', () => {
    const json = clinic()
    json.rooms[0].propsHere = ['a', 'b']
    json.lighting = { bounce: 0.2 }
    const result = blockoutSchema.parse(json)
    expect((result.rooms[0] as Json).propsHere).toEqual(['a', 'b'])
    expect((result as Json).lighting).toEqual({ bounce: 0.2 })
  })

  const refusals: [string, (json: Json) => void, (string | number)[]][] = [
    ['a corner with one number', (json) => (json.rooms[1].corners[0] = [1]), ['rooms', 1, 'corners', 0]],
    [
      'a corner with a fourth element',
      (json) => (json.rooms[0].corners[0] = [0, 0, 'GLASS', 1]),
      ['rooms', 0, 'corners', 0],
    ],
    ['a lamp colour of two numbers', (json) => (json.lamps[0].color = [1, 2]), ['lamps', 0, 'color']],
    [
      'a zone area side that is not a pair',
      (json) => (json.zones[1].area = { x: [1, 2, 3] }),
      ['zones', 1, 'area', 'x'],
    ],
    ['a nav edge that holds a number', (json) => (json.nav.edges[2] = ['a', 1]), ['nav', 'edges', 2, 1]],
    ['a hotspot without a name', (json) => delete json.hotspots[0].name, ['hotspots', 0, 'name']],
    ['a box of an unknown role', (json) => (json.boxes[0].role = 'prop'), ['boxes', 0, 'role']],
    [
      'an item attached to nothing it can name',
      (json) => (json.hotspots[0].on = 'room:hall'),
      ['hotspots', 0, 'on'],
    ],
    [
      'a wall that is a number',
      (json) => (json.rooms[0].corners[0] = [0, 0, 7]),
      ['rooms', 0, 'corners', 0, 2],
    ],
    ['a ceiling that is text', (json) => (json.rooms[0].ceiling = '4.9'), ['rooms', 0, 'ceiling']],
    ['a spawn without a facing', (json) => delete json.spawn.facing, ['spawn', 'facing']],
  ]
  for (const [what, edit, path] of refusals) {
    it(`refuses ${what}, at its own path`, () => {
      const json = clinic()
      edit(json)
      expect(refusedAt(json)).toContainEqual(path)
    })
  }

  it('refuses a file that is not an object, and one without rooms', () => {
    expect(refusedAt([])).toBeDefined()
    const json = clinic()
    delete json.rooms
    expect(refusedAt(json)).toContainEqual(['rooms'])
  })
})
