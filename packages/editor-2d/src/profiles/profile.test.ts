import { describe, expect, it } from 'vitest'
import { counterIds } from '../model/ids'
import { createProfileRegistry, type Profile } from './profile'

/** A profile that opens a file when `claims` says so; the value it parses is the text's length. */
function fakeProfile(
  id: string,
  claims: (fileName: string, text: string) => boolean = () => false,
): Profile<number> {
  return {
    id,
    label: id,
    sniff: claims,
    parse: (text) => ({ ok: true, value: text.length }),
    print: (_base, value) => `${value}`,
    check: () => [],
    templates: [{ id: 'blank', label: 'Blank', create: () => 0 }],
    views: [{ id: 'level', label: 'Level', component: 'LevelView' }],
    exports: [
      { id: 'file', label: 'Working file', files: (value) => [{ path: 'a.txt', contents: `${value}` }] },
    ],
  }
}

describe('createProfileRegistry', () => {
  it('lists profiles in the order they were registered, and finds one by id', () => {
    const registry = createProfileRegistry()
    const a = fakeProfile('level-project')
    const b = fakeProfile('floorfifty-stage')
    registry.register(a)
    registry.register(b)
    expect(registry.list()).toEqual([a, b])
    expect(registry.get('floorfifty-stage')).toBe(b)
    expect(registry.get('nope')).toBeUndefined()
  })

  it('starts empty', () => {
    const registry = createProfileRegistry()
    expect(registry.list()).toEqual([])
    expect(registry.sniff('a.json', '{}')).toEqual([])
  })

  it('refuses a second profile with the same id and keeps the first', () => {
    const registry = createProfileRegistry()
    const first = fakeProfile('level-project')
    registry.register(first)
    expect(() => registry.register(fakeProfile('level-project'))).toThrow(/level-project.*already/)
    expect(registry.get('level-project')).toBe(first)
  })

  it('unregisters through the function register returned, once', () => {
    const registry = createProfileRegistry()
    const unregister = registry.register(fakeProfile('level-project'))
    unregister()
    expect(registry.list()).toEqual([])
    unregister()
    expect(registry.list()).toEqual([])
  })

  it('lets an unregistered id be registered again, and an old unregister does not remove the new one', () => {
    const registry = createProfileRegistry()
    const unregisterOld = registry.register(fakeProfile('level-project'))
    unregisterOld()
    const next = fakeProfile('level-project')
    registry.register(next)
    unregisterOld()
    expect(registry.get('level-project')).toBe(next)
  })

  it('hands out a snapshot: a later registration does not change a list already taken', () => {
    const registry = createProfileRegistry()
    registry.register(fakeProfile('level-project'))
    const before = registry.list()
    registry.register(fakeProfile('floorfifty-stage'))
    expect(before).toHaveLength(1)
    expect(registry.list()).toHaveLength(2)
  })

  describe('sniff', () => {
    it('returns every profile that claims the file, in registration order', () => {
      const registry = createProfileRegistry()
      const json = fakeProfile('level-project', (name) => name.endsWith('.af2d.json'))
      const toml = fakeProfile('floorfifty-stage', (name) => name.endsWith('.toml'))
      const greedy = fakeProfile('anything', () => true)
      for (const profile of [json, toml, greedy]) registry.register(profile)
      expect(registry.sniff('mossgate.af2d.json', '{}')).toEqual([json, greedy])
      expect(registry.sniff('stage.toml', '')).toEqual([toml, greedy])
    })

    it('gives a profile the file name and the text', () => {
      const registry = createProfileRegistry()
      const seen: [string, string][] = []
      registry.register(
        fakeProfile('spy', (name, text) => {
          seen.push([name, text])
          return false
        }),
      )
      registry.sniff('x.af2d.json', 'body')
      expect(seen).toEqual([['x.af2d.json', 'body']])
    })

    it('returns nothing when no profile claims the file, so the app can say so', () => {
      const registry = createProfileRegistry()
      registry.register(fakeProfile('level-project'))
      expect(registry.sniff('notes.txt', 'hello')).toEqual([])
    })
  })

  it('keeps a profile usable through the registry: its own parse feeds its own print', () => {
    const registry = createProfileRegistry()
    registry.register(fakeProfile('level-project'))
    const profile = registry.get('level-project')
    const parsed = profile?.parse('four')
    expect(parsed).toEqual({ ok: true, value: 4 })
    expect(profile?.templates[0]?.create(counterIds())).toBe(0)
  })
})
