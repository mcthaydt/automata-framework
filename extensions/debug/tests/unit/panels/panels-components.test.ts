// The shipped panels (M6 spec §4.2): sim, presentation bus and feel board. Each reads the host from the overlay's context.
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import BusPanel from '#src/features/panels/BusPanel.svelte'
import FeelPanel from '#src/features/panels/FeelPanel.svelte'
import SimPanel from '#src/features/panels/SimPanel.svelte'
import { type DebugHost, HOST_CONTEXT } from '#src/shared/host.ts'

const mount = (component: Parameters<typeof render>[0], host: Partial<DebugHost>) =>
  render(component, { context: new Map([[HOST_CONTEXT, { panels: [], ...host }]]) })
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('SimPanel', () => {
  it('shows tick, entities, hash and step time, and follows them', async () => {
    vi.useFakeTimers()
    let tick = 5
    mount(SimPanel, {
      sim: { tick: () => tick, entities: () => 12, hash: () => 'abc123', stepMs: () => 0.4 },
    })
    expect(screen.getByText('Step count').nextElementSibling).toHaveTextContent('5')
    expect(screen.getByText('Things in the game').nextElementSibling).toHaveTextContent('12')
    expect(screen.getByText('Game fingerprint').nextElementSibling).toHaveTextContent('abc123')
    expect(screen.getByText('Time per step (ms)').nextElementSibling).toHaveTextContent('0.4')
    tick = 9
    await vi.advanceTimersByTimeAsync(300)
    expect(screen.getByText('Step count').nextElementSibling).toHaveTextContent('9')
  })
  it('says so when no sim probe is installed', () => {
    mount(SimPanel, {})
    expect(screen.getByText('This game has not turned on the game readout.')).toBeInTheDocument()
  })
})

describe('BusPanel', () => {
  const bus = () => {
    const listeners = new Map<string, (fact: unknown) => void>()
    return {
      subscribe: (name: string, l: (fact: unknown) => void) => {
        listeners.set(name, l)
        return () => listeners.delete(name)
      },
      publish: (name: string, fact: unknown) => listeners.get(name)?.(fact),
      count: () => listeners.size,
    }
  }
  it('lists the facts heard, newest last', async () => {
    const b = bus()
    mount(BusPanel, { bus: b, facts: ['a', 'b'] })
    b.publish('a', { n: 1 })
    b.publish('b', 2)
    expect((await screen.findAllByRole('listitem')).map((li) => li.textContent)).toEqual(['a {"n":1}', 'b 2'])
  })
  it('stops listening when the panel goes away', () => {
    const b = bus()
    const { unmount } = mount(BusPanel, { bus: b, facts: ['a'] })
    expect(b.count()).toBe(1)
    unmount()
    expect(b.count()).toBe(0)
  })
  it('says so when no bus is installed', () => {
    mount(BusPanel, {})
    expect(screen.getByText('This game has not turned on the event log.')).toBeInTheDocument()
  })
})

describe('FeelPanel', () => {
  it('has a button for each entry that fires it', async () => {
    const fire = vi.fn()
    mount(FeelPanel, { feel: { entries: () => ['hit', 'door.*'], fire } })
    await fireEvent.click(screen.getByRole('button', { name: 'door.*' }))
    expect(fire).toHaveBeenCalledWith('door.*')
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })
  it('says so when there is no feel board', () => {
    mount(FeelPanel, {})
    expect(screen.getByText('This game has not turned on the feel board.')).toBeInTheDocument()
  })
})
