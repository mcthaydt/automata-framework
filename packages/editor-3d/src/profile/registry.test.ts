// Picking a profile from a file (ED3D.1b step 5, acceptance ED3-q's second half): the same call opens an AF sector level
// and a Last Light blockout, and says why when it cannot.
import { describe, expect, it } from 'vitest'
import { AUTHORED_NAMES, FIXTURE_NAMES, loadAuthored, loadFixture } from '../testing/fixtures'
import { BLOCKOUT_NAMES } from '../testing/geometry-golden'
import { afSectorProfile } from './af-sector-profile'
import { lastLightProfile } from './last-light-profile'
import { detectProfile, hasFacility, profiles } from './registry'

const reasonOf = (text: string): string => {
  const found = detectProfile(text)
  if (!('reason' in found)) throw new Error(`expected a reason, got the profile ${found.profile.id}`)
  return found.reason
}

describe('profiles', () => {
  it('lists the af-sector profile and the Last Light blockout profile', () => {
    expect(profiles().map((profile) => profile.id)).toEqual(['af-sector', 'last-light-blockout'])
    expect(profiles()).toContain(afSectorProfile)
    expect(profiles()).toContain(lastLightProfile)
  })
})

describe('hasFacility', () => {
  it('is true for the Last Light blockout, whose levels a facility file joins, and false for af-sector', () => {
    expect(hasFacility(lastLightProfile)).toBe(true)
    expect(hasFacility(afSectorProfile)).toBe(false)
  })
})

describe('detectProfile', () => {
  it('picks the af-sector profile for the depot, by its format', () => {
    expect(detectProfile(loadAuthored(AUTHORED_NAMES[0]))).toEqual({ profile: afSectorProfile })
  })

  for (const name of BLOCKOUT_NAMES) {
    it(`picks the Last Light blockout profile for ${name}, by its rooms and scene`, () => {
      expect(detectProfile(loadFixture(name))).toEqual({ profile: lastLightProfile })
    })
  }

  it('picks by the format when it names af-sector at any version, whatever else is in the file', () => {
    expect(detectProfile('{"format": "af-sector/2", "rooms": [], "scene": "x"}')).toEqual({
      profile: afSectorProfile,
    })
    expect(detectProfile('{"format": "af-sector/1.4"}')).toEqual({ profile: afSectorProfile })
  })

  it('opens the depot and a Last Light level through the same call (ED3-q)', () => {
    const texts = [loadAuthored('depot.af-sector'), loadFixture('blockout-bay')]
    const opened = texts.map((text) => {
      const found = detectProfile(text)
      if (!('profile' in found)) throw new Error(found.reason)
      const parsed = found.profile.parse(text)
      if (!parsed.ok) throw new Error('does not parse')
      const geometry = found.profile.geometry(parsed.value)
      return [found.profile.id, geometry.layers.map((layer) => layer.kind)]
    })
    expect(opened).toEqual([
      ['af-sector', ['sectors']],
      ['last-light-blockout', ['sectors']],
    ])
  })

  it('says the facility file has a codec and no profile, and what to open instead', () => {
    expect(reasonOf(loadFixture('facility'))).toBe(
      'this is a Last Light facility file (last-light-facility): it has a codec but no level to draw; open one of its wings’ blockouts',
    )
  })

  it('says what it looks for when the JSON is a level of neither kind', () => {
    const expected =
      'not a level this editor opens: it reads an af-sector file (a "format" starting af-sector/) or a Last Light blockout (a "scene" and "rooms")'
    expect(reasonOf('{}')).toBe(expected)
    expect(reasonOf('[]')).toBe(expected)
    expect(reasonOf('"af-sector/1"')).toBe(expected)
    expect(reasonOf('null')).toBe(expected)
    expect(reasonOf('{"format": "other/1"}')).toBe(expected)
    expect(reasonOf('{"format": 1, "scene": "x"}')).toBe(expected)
    expect(reasonOf('{"scene": "x"}')).toBe(expected)
    expect(reasonOf('{"rooms": []}')).toBe(expected)
    expect(reasonOf('{"scene": "x", "rooms": {}}')).toBe(expected)
    expect(reasonOf('{"scene": 3, "rooms": []}')).toBe(expected)
    expect(reasonOf('{"format": "af-sector"}')).toBe(expected)
    expect(reasonOf('{"format": "af-sectors/1"}')).toBe(expected)
    expect(reasonOf('{"wings": []}')).toBe(expected)
    expect(reasonOf('{"joins": []}')).toBe(expected)
    expect(reasonOf('{"wings": {}, "joins": []}')).toBe(expected)
  })

  it('says where the text stops being JSON', () => {
    expect(reasonOf('{ "scene": }')).toMatch(/^not JSON: .*at \d+/)
    expect(reasonOf('')).toMatch(/^not JSON: /)
  })

  it('opens every shipped Last Light file or says why not', () => {
    const outcomes = FIXTURE_NAMES.map((name) => {
      const found = detectProfile(loadFixture(name))
      return [name, 'profile' in found ? found.profile.id : 'no profile']
    })
    expect(outcomes).toEqual([
      ['blockout-clinic', 'last-light-blockout'],
      ['blockout-clinic-dawn', 'last-light-blockout'],
      ['blockout-bay', 'last-light-blockout'],
      ['blockout-prologue', 'last-light-blockout'],
      ['facility', 'no profile'],
    ])
  })
})
