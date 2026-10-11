import { describe, expect, it } from 'vitest'
import { releasedVersion, verifyPublished } from './verify-published.ts'

const names = ['@mcthaydt/automata-sim', '@mcthaydt/automata-host']

/** A registry where each package appears after `appearsAfter` lookups (Infinity: never). */
function fakeRegistry(appearsAfter: Record<string, number>, failing: string[] = []) {
  const calls: Record<string, number> = {}
  const lookup = async (name: string, version: string): Promise<string | undefined> => {
    calls[name] = (calls[name] ?? 0) + 1
    if (failing.includes(name)) throw new Error('E401 unauthorized')
    return calls[name] > (appearsAfter[name] ?? 0) ? version : undefined
  }
  return { lookup, calls }
}

function fakeClock() {
  const waits: number[] = []
  return { waits, sleep: async (ms: number) => void waits.push(ms) }
}

describe('verifyPublished', () => {
  it('passes when every package is on the registry at the version', async () => {
    const clock = fakeClock()
    const result = await verifyPublished(names, '0.0.1', { ...fakeRegistry({}), sleep: clock.sleep })
    expect(result).toEqual({ ok: true, missing: [] })
    expect(clock.waits).toEqual([])
  })

  it('waits for registry lag: missing twice then present on the third try passes', async () => {
    const clock = fakeClock()
    const registry = fakeRegistry({ '@mcthaydt/automata-host': 2 })
    const result = await verifyPublished(names, '0.0.1', { lookup: registry.lookup, sleep: clock.sleep })
    expect(result.ok).toBe(true)
    expect(registry.calls['@mcthaydt/automata-host']).toBe(3)
    expect(clock.waits.length).toBe(2)
  })

  it('fails naming a package still missing after 5 tries, having waited about a minute', async () => {
    const clock = fakeClock()
    const registry = fakeRegistry({ '@mcthaydt/automata-host': Number.POSITIVE_INFINITY })
    const result = await verifyPublished(names, '0.0.1', { lookup: registry.lookup, sleep: clock.sleep })
    expect(result).toEqual({ ok: false, missing: ['@mcthaydt/automata-host@0.0.1'] })
    expect(registry.calls['@mcthaydt/automata-host']).toBe(5)
    const waited = clock.waits.reduce((sum, ms) => sum + ms, 0)
    expect(waited).toBeGreaterThanOrEqual(50_000)
    expect(waited).toBeLessThanOrEqual(70_000)
  })

  it('never counts a lookup error as present', async () => {
    const clock = fakeClock()
    const registry = fakeRegistry({}, ['@mcthaydt/automata-sim'])
    const result = await verifyPublished(names, '0.0.1', { lookup: registry.lookup, sleep: clock.sleep })
    expect(result.ok).toBe(false)
    expect(result.missing[0]).toMatch(/^@mcthaydt\/automata-sim@0\.0\.1 \(.*E401/)
  })
})

describe('releasedVersion (from changesets/action published-packages)', () => {
  it('is the one version every published package shares', () => {
    const published = JSON.stringify([
      { name: '@mcthaydt/automata-sim', version: '0.0.3' },
      { name: '@mcthaydt/automata-host', version: '0.0.3' },
    ])
    expect(releasedVersion(published)).toBe('0.0.3')
  })

  it('fails when the versions disagree or nothing was published', () => {
    const mixed = JSON.stringify([
      { name: 'a', version: '0.0.3' },
      { name: 'b', version: '0.0.4' },
    ])
    expect(() => releasedVersion(mixed)).toThrow(/0\.0\.3, 0\.0\.4/)
    expect(() => releasedVersion('[]')).toThrow(/nothing/)
  })
})
