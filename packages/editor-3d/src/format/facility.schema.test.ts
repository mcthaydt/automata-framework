import { describe, expect, it } from 'vitest'
import { loadFixture } from '../testing/fixtures'
import { facilitySchema } from './facility.schema'

// biome-ignore lint/suspicious/noExplicitAny: tests edit a parsed file by path
type Json = Record<string, any>
const facility = (): Json => JSON.parse(loadFixture('facility'))

/** The paths Zod reports for a value it refuses, or undefined when it accepts it. */
const refusedAt = (value: unknown): PropertyKey[][] | undefined => {
  const result = facilitySchema.safeParse(value)
  return result.success ? undefined : result.error.issues.map((issue) => issue.path)
}

describe('the facility schema', () => {
  it('parses facility.json, and the parse is the file own value (a validator, not a transform)', () => {
    const json = facility()
    const result = facilitySchema.safeParse(json)
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true)
    expect(result.data).toStrictEqual(json)
  })

  it('keeps a member it does not know, in a wing and in the file', () => {
    const json = facility()
    json.wings[0].mood = 'quiet'
    json.version = 3
    const result = facilitySchema.parse(json)
    expect((result.wings[0] as Json).mood).toBe('quiet')
    expect((result as Json).version).toBe(3)
  })

  const refusals: [string, (json: Json) => void, (string | number)[]][] = [
    [
      'a wing offset that is not three numbers',
      (json) => (json.wings[0].offset = [0, 0]),
      ['wings', 0, 'offset'],
    ],
    [
      'a phase whose rooms are not a list of strings',
      (json) => (json.phases[0].rooms = ['hall', 7]),
      ['phases', 0, 'rooms', 1],
    ],
    ['a lock without an id', (json) => delete json.locks[0].id, ['locks', 0, 'id']],
    ['a lock kind the map has no badge for', (json) => (json.locks[0].kind = 'magic'), ['locks', 0, 'kind']],
    [
      'a phase that carries something unknown',
      (json) => (json.phases[1].carry = 'some'),
      ['phases', 1, 'carry'],
    ],
    [
      'a door rule that is neither a word nor a fact',
      (json) => (json.phases[0].doors['p0.exit'] = 4),
      ['phases', 0, 'doors', 'p0.exit'],
    ],
    ['a join side that names nothing', (json) => (json.joins[0].a = {}), ['joins', 0, 'a']],
    ['a street without a clearance', (json) => delete json.street.clear, ['street', 'clear']],
    [
      'a street path point of three numbers',
      (json) => (json.street.path[0] = [1, 2, 3]),
      ['street', 'path', 0],
    ],
  ]
  for (const [what, edit, path] of refusals) {
    it(`refuses ${what}, at its own path`, () => {
      const json = facility()
      edit(json)
      expect(refusedAt(json)).toContainEqual(path)
    })
  }
})
