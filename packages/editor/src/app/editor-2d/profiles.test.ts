import { describe, expect, it } from 'vitest'
import { counterIds } from '../../shared/level-2d/model/ids'
import { plantedProfile } from '../../testing/level-2d/planted-profile'
import { createAppProfiles } from './profiles'

// The registration list (2D editor spec §4): the one place that names a profile. These tests read the registry the way
// the app does, so they hold for any profile that is added to the list.

describe('createAppProfiles', () => {
  it('registers the built-in level project first', () => {
    const registry = createAppProfiles()
    expect(registry.list().map((profile) => profile.label)).toEqual(['Level project'])
  })

  it('returns a new registry each time, so a test cannot leak a registration into the next', () => {
    const first = createAppProfiles()
    const second = createAppProfiles()
    first.register(plantedProfile())
    expect(first.list()).toHaveLength(2)
    expect(second.list()).toHaveLength(1)
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
