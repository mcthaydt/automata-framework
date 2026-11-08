import { describe, expect, it, vi } from 'vitest'
import { forwardEvents } from '#src/features/watch/forward-events.ts'
import type { BusPort } from '#src/shared/host.ts'

// Watch (Schematic's pane): the game, framed by an editor, tells it which mode each character is in. The game only
// says so when the editor's address asked for it, only to the editor's own origin, and only the events it named.

const EDITOR = 'http://localhost:5174'

function fakeBus() {
  const listeners = new Map<string, Set<(fact: unknown) => void>>()
  const bus: BusPort = {
    subscribe(name, listener) {
      const set = listeners.get(name) ?? new Set()
      set.add(listener)
      listeners.set(name, set)
      return () => set.delete(listener)
    },
  }
  const publish = (name: string, fact: unknown): void => {
    for (const listener of listeners.get(name) ?? []) listener(fact)
  }
  return { bus, publish, count: (name: string) => listeners.get(name)?.size ?? 0 }
}
const parent = () => ({ postMessage: vi.fn() })
const step = (tick: number, ...events: { type: string; payload: unknown }[]) => ({ tick, events })

describe('forwardEvents', () => {
  it('posts each named event to the editor that framed the game, with its time, and only to that origin', () => {
    const { bus, publish } = fakeBus()
    const up = parent()
    forwardEvents(bus, { search: `?af-watch=${encodeURIComponent(EDITOR)}&events=systems.mode` }, up)
    publish(
      'sim.step',
      step(
        744,
        { type: 'systems.mode', payload: { agent: 'guard', from: 'patrol', to: 'hunt' } },
        { type: 'systems.noise', payload: { kind: 'step' } },
      ),
    )
    expect(up.postMessage).toHaveBeenCalledTimes(2)
    expect(up.postMessage).toHaveBeenLastCalledWith(
      {
        type: 'af-sim-event',
        name: 'systems.mode',
        payload: { agent: 'guard', from: 'patrol', to: 'hunt' },
        tick: 744,
        seconds: 12.4,
      },
      EDITOR,
    )
  })

  it('says once that it is listening, so the editor can tell a quiet game from one that cannot say', () => {
    const { bus } = fakeBus()
    const up = parent()
    forwardEvents(bus, { search: `?af-watch=${encodeURIComponent(EDITOR)}&events=systems.mode` }, up)
    expect(up.postMessage).toHaveBeenCalledTimes(1)
    expect(up.postMessage).toHaveBeenCalledWith({ type: 'af-watch-ready' }, EDITOR)
  })

  it('counts seconds at the sim’s own rate when the game says it', () => {
    const { bus, publish } = fakeBus()
    const up = parent()
    forwardEvents(bus, { search: `?af-watch=${encodeURIComponent(EDITOR)}&events=a` }, up, { tickHz: 30 })
    publish('sim.step', step(90, { type: 'a', payload: 1 }))
    expect(up.postMessage.mock.calls[1]?.[0]).toMatchObject({ tick: 90, seconds: 3 })
  })

  it('names several events with a comma, and posts each one', () => {
    const { bus, publish } = fakeBus()
    const up = parent()
    forwardEvents(bus, { search: `?af-watch=${encodeURIComponent(EDITOR)}&events=a,b` }, up)
    publish(
      'sim.step',
      step(1, { type: 'a', payload: 1 }, { type: 'b', payload: 2 }, { type: 'c', payload: 3 }),
    )
    expect(up.postMessage.mock.calls.slice(1).map((c) => (c[0] as { name: string }).name)).toEqual(['a', 'b'])
  })

  it('does not even listen when the page is not framed', () => {
    const { bus, count } = fakeBus()
    forwardEvents(bus, { search: `?af-watch=${encodeURIComponent(EDITOR)}&events=a` }, window)
    expect(count('sim.step')).toBe(0)
  })

  it('does not listen without the editor’s address, or without events, or with an address that is not an origin', () => {
    for (const search of [
      '',
      '?events=a',
      `?af-watch=${encodeURIComponent(EDITOR)}`,
      '?af-watch=*&events=a',
      '?af-watch=null&events=a',
      '?af-watch=not-a-url&events=a',
      `?af-watch=${encodeURIComponent(`${EDITOR}/some/page`)}&events=a`,
    ]) {
      const { bus, count } = fakeBus()
      const off = forwardEvents(bus, { search }, parent())
      expect(count('sim.step'), search).toBe(0)
      off()
    }
  })

  it('stops when told to', () => {
    const { bus, publish, count } = fakeBus()
    const up = parent()
    const off = forwardEvents(bus, { search: `?af-watch=${encodeURIComponent(EDITOR)}&events=a` }, up)
    off()
    expect(count('sim.step')).toBe(0)
    up.postMessage.mockClear()
    publish('sim.step', step(1, { type: 'a', payload: 1 }))
    expect(up.postMessage).not.toHaveBeenCalled()
  })
})
