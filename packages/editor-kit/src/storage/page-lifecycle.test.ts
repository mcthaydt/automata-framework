import { describe, expect, it, vi } from 'vitest'
import { flushOnHide, type LifecycleDocument, type LifecycleWindow } from './page-lifecycle'

type Run = () => void

function fakeTarget() {
  const listeners = new Map<string, Set<Run>>()
  return {
    addEventListener(type: string, run: Run) {
      listeners.set(type, (listeners.get(type) ?? new Set()).add(run))
    },
    removeEventListener(type: string, run: Run) {
      listeners.get(type)?.delete(run)
    },
    fire(type: string) {
      for (const run of [...(listeners.get(type) ?? [])]) run()
    },
    count: (type: string) => listeners.get(type)?.size ?? 0,
  }
}

function setup() {
  const doc = fakeTarget()
  const win = fakeTarget()
  const page = { visibilityState: 'visible' }
  const document: LifecycleDocument = {
    get visibilityState() {
      return page.visibilityState
    },
    addEventListener: doc.addEventListener,
    removeEventListener: doc.removeEventListener,
  }
  const window: LifecycleWindow = {
    addEventListener: win.addEventListener,
    removeEventListener: win.removeEventListener,
  }
  const session = { flush: vi.fn(() => Promise.resolve()) }
  return { doc, win, page, session, env: { document, window } }
}

describe('flushOnHide', () => {
  it('flushes when the page becomes hidden', () => {
    const { doc, page, session, env } = setup()
    flushOnHide(session, env)
    page.visibilityState = 'hidden'
    doc.fire('visibilitychange')
    expect(session.flush).toHaveBeenCalledTimes(1)
  })

  it('does not flush when the page becomes visible again', () => {
    const { doc, page, session, env } = setup()
    flushOnHide(session, env)
    page.visibilityState = 'visible'
    doc.fire('visibilitychange')
    expect(session.flush).not.toHaveBeenCalled()
  })

  it('flushes on pagehide, which a tab being closed or put in the back-forward cache fires', () => {
    const { win, session, env } = setup()
    flushOnHide(session, env)
    win.fire('pagehide')
    expect(session.flush).toHaveBeenCalledTimes(1)
  })

  it('stops listening when the returned function is called', () => {
    const { doc, win, page, session, env } = setup()
    const stop = flushOnHide(session, env)
    expect(doc.count('visibilitychange')).toBe(1)
    expect(win.count('pagehide')).toBe(1)
    stop()
    expect(doc.count('visibilitychange')).toBe(0)
    expect(win.count('pagehide')).toBe(0)
    page.visibilityState = 'hidden'
    doc.fire('visibilitychange')
    win.fire('pagehide')
    expect(session.flush).not.toHaveBeenCalled()
  })

  it('does not raise an unhandled rejection when a flush fails: the session reports the problem itself', async () => {
    const { win, env } = setup()
    // Not a vi.fn: a mock watches the promises it returns, which would count as handling them.
    const session = { flush: (): Promise<void> => Promise.reject(new Error('disk full')) }
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    try {
      flushOnHide(session, env)
      win.fire('pagehide')
      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(unhandled).not.toHaveBeenCalled()
    } finally {
      process.off('unhandledRejection', unhandled)
    }
  })
})
