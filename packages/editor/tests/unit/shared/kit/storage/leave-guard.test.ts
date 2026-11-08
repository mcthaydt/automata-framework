import { describe, expect, it, vi } from 'vitest'
import { guardLeaving } from '#src/shared/kit/storage/leave-guard.ts'

function fakeWindow() {
  const listeners = new Set<(event: { preventDefault(): void; returnValue?: unknown }) => void>()
  return {
    addEventListener: (_type: 'beforeunload', run: (event: never) => void) => listeners.add(run as never),
    removeEventListener: (_type: 'beforeunload', run: (event: never) => void) =>
      listeners.delete(run as never),
    leave() {
      const event = { preventDefault: vi.fn(), returnValue: undefined as unknown }
      for (const run of listeners) run(event)
      return event
    },
    count: () => listeners.size,
  }
}

describe('guardLeaving', () => {
  it('asks the browser to ask while something is typed or being written', () => {
    const window = fakeWindow()
    let busy = true
    guardLeaving(window, () => busy)
    const asked = window.leave()
    expect(asked.preventDefault).toHaveBeenCalled()
    expect(asked.returnValue).toBe('')
    busy = false
    const quiet = window.leave()
    expect(quiet.preventDefault).not.toHaveBeenCalled()
  })

  it('stops listening when told to', () => {
    const window = fakeWindow()
    const stop = guardLeaving(window, () => true)
    expect(window.count()).toBe(1)
    stop()
    expect(window.count()).toBe(0)
  })
})
