// Picking a profile from a file (ED3D.1b step 5): the one call opens an af-sector level, and says why when it cannot.
import { describe, expect, it } from 'vitest'
import { AUTHORED_NAMES, loadAuthored } from '../testing/fixtures'
import { afSectorProfile } from './af-sector-profile'
import { detectProfile, profiles } from './registry'

const reasonOf = (text: string): string => {
  const found = detectProfile(text)
  if (!('reason' in found)) throw new Error(`expected a reason, got the profile ${found.profile.id}`)
  return found.reason
}

describe('profiles', () => {
  it('lists the af-sector profile, the only one the editor opens', () => {
    expect(profiles().map((profile) => profile.id)).toEqual(['af-sector'])
    expect(profiles()).toContain(afSectorProfile)
  })
})

describe('detectProfile', () => {
  it('picks the af-sector profile for the depot, by its format', () => {
    expect(detectProfile(loadAuthored(AUTHORED_NAMES[0]))).toEqual({ profile: afSectorProfile })
  })

  it('picks by the format when it names af-sector at any version, whatever else is in the file', () => {
    expect(detectProfile('{"format": "af-sector/2", "rooms": [], "scene": "x"}')).toEqual({
      profile: afSectorProfile,
    })
    expect(detectProfile('{"format": "af-sector/1.4"}')).toEqual({ profile: afSectorProfile })
  })

  it('opens the depot through the same call that parses and draws it', () => {
    const text = loadAuthored('depot.af-sector')
    const found = detectProfile(text)
    if (!('profile' in found)) throw new Error(found.reason)
    const parsed = found.profile.parse(text)
    if (!parsed.ok) throw new Error('does not parse')
    expect(found.profile.geometry(parsed.value).layers.map((layer) => layer.kind)).toEqual(['sectors'])
  })

  it('says what it looks for when the JSON is not an af-sector level', () => {
    const expected =
      'not a level this editor opens: it reads an af-sector file (a "format" starting af-sector/)'
    expect(reasonOf('{}')).toBe(expected)
    expect(reasonOf('[]')).toBe(expected)
    expect(reasonOf('"af-sector/1"')).toBe(expected)
    expect(reasonOf('null')).toBe(expected)
    expect(reasonOf('{"format": "other/1"}')).toBe(expected)
    expect(reasonOf('{"format": 1, "scene": "x"}')).toBe(expected)
    expect(reasonOf('{"scene": "x", "rooms": []}')).toBe(expected)
    expect(reasonOf('{"format": "af-sector"}')).toBe(expected)
    expect(reasonOf('{"format": "af-sectors/1"}')).toBe(expected)
    expect(reasonOf('{"wings": [], "joins": []}')).toBe(expected)
  })

  it('says where the text stops being JSON', () => {
    expect(reasonOf('{ "scene": }')).toMatch(/^not JSON: .*at \d+/)
    expect(reasonOf('')).toMatch(/^not JSON: /)
  })
})
