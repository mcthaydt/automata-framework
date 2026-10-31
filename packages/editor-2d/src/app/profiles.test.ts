import { describe, expect, it } from 'vitest'
import { counterIds } from '../model/ids'
import { plantedProfile } from '../testing/planted-profile'
import { createAppProfiles } from './profiles'

// The registration list (2D editor spec §4): the one place that names a profile. These tests read the registry the way
// the app does, so they hold for any profile that is added to the list.

describe('createAppProfiles', () => {
  it('registers the built-in level project first, then the FloorFifty stage', () => {
    const registry = createAppProfiles()
    expect(registry.list().map((profile) => profile.label)).toEqual(['Level project', 'FloorFifty stage'])
  })

  it('offers the stage templates and claims a stage file (EDFF.2a)', () => {
    const registry = createAppProfiles()
    const stage = registry.get('floorfifty-stage')
    expect(stage?.templates.map((template) => template.label)).toEqual(['Empty', 'Sky only', 'Simple city'])
    expect(
      registry.sniff('rooftops.toml', 'id = "rooftops"\nplatformAlias = "world.platform"\n').map((p) => p.id),
    ).toEqual(['floorfifty-stage'])
  })

  it('returns a new registry each time, so a test cannot leak a registration into the next', () => {
    const first = createAppProfiles()
    const second = createAppProfiles()
    first.register(plantedProfile())
    expect(first.list()).toHaveLength(3)
    expect(second.list()).toHaveLength(2)
  })

  it('finds the profile that claims a working file by name', () => {
    const registry = createAppProfiles()
    expect(registry.sniff('mossgate.af2d.json', '').map((profile) => profile.label)).toEqual([
      'Level project',
    ])
    expect(registry.sniff('notes.txt', 'hello')).toEqual([])
  })

  it('gives every profile a template and a working file the app can name a new document by', () => {
    for (const profile of createAppProfiles().list()) {
      expect(profile.templates.length, profile.id).toBeGreaterThan(0)
      expect(profile.exports.length, profile.id).toBeGreaterThan(0)
      for (const template of profile.templates) {
        const value = template.create(counterIds())
        const [file] = profile.exports[0]?.files(value, '') ?? []
        expect(file?.path, `${profile.id}/${template.id}`).toMatch(/\S/)
        expect(file?.path.startsWith('/'), `${profile.id}/${template.id}`).toBe(false)
      }
    }
  })
})
