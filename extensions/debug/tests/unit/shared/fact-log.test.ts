import { describe, expect, it } from 'vitest'
import { RUNTIME_FACTS, recordFacts } from '#src/shared/fact-log.ts'
import type { BusPort } from '#src/shared/host.ts'

const fakeBus = (): BusPort & { publish(name: string, fact: unknown): void; subscribed(): string[] } => {
  const listeners = new Map<string, Set<(fact: unknown) => void>>()
  return {
    subscribe(name, listener) {
      const set = listeners.get(name) ?? new Set()
      set.add(listener)
      listeners.set(name, set)
      return () => set.delete(listener)
    },
    publish(name, fact) {
      for (const l of listeners.get(name) ?? []) l(fact)
    },
    subscribed: () => [...listeners.keys()],
  }
}

describe('recordFacts', () => {
  it('records each fact with its name and a one-line text, newest last', () => {
    const bus = fakeBus()
    const log = recordFacts(bus, ['a', 'b'])
    bus.publish('a', { x: 1 })
    bus.publish('b', 'hi')
    expect(log.entries()).toEqual([
      { name: 'a', text: '{"x":1}' },
      { name: 'b', text: '"hi"' },
    ])
  })
  it('keeps only the last 50 by default and the last `limit` when given', () => {
    const bus = fakeBus()
    const log = recordFacts(bus, ['a'])
    for (let i = 0; i < 60; i++) bus.publish('a', i)
    expect(log.entries()).toHaveLength(50)
    expect(log.entries()[0]?.text).toBe('10')
    const small = recordFacts(bus, ['a'], 2)
    for (let i = 0; i < 5; i++) bus.publish('a', i)
    expect(small.entries().map((e) => e.text)).toEqual(['3', '4'])
  })
  it('cuts a long fact and survives one that cannot be written', () => {
    const bus = fakeBus()
    const log = recordFacts(bus, ['a'])
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    bus.publish('a', 'x'.repeat(500))
    bus.publish('a', cyclic)
    expect(log.entries()[0]?.text.length).toBeLessThanOrEqual(200)
    expect(log.entries()[1]?.text).toBe('[unprintable]')
  })
  it('tells listeners and stops recording after dispose', () => {
    const bus = fakeBus()
    const log = recordFacts(bus, ['a'])
    let calls = 0
    log.subscribe(() => calls++)
    bus.publish('a', 1)
    log.dispose()
    bus.publish('a', 2)
    expect(calls).toBe(1)
    expect(log.entries()).toHaveLength(1)
  })
  it('lists the runtime facts by name', () => {
    expect(RUNTIME_FACTS).toContain('sim.events')
    expect(RUNTIME_FACTS).toContain('screen.entered')
  })
})
