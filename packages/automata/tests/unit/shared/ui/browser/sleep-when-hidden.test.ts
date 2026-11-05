import { afterEach, describe, expect, it } from 'vitest'
import { sleepWhenHidden } from '#src/shared/ui/browser/sleep-when-hidden.ts'

/** Records what the page asked of the sound, in order. */
function recorder() {
  const calls: string[] = []
  return {
    calls,
    sleeper: {
      sleep: async () => void calls.push('sleep'),
      wake: async () => void calls.push('wake'),
      resumeOnGesture: async () => void calls.push('gesture'),
    },
  }
}

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
  document.dispatchEvent(new Event('visibilitychange'))
}

let release: (() => void) | undefined
afterEach(() => {
  release?.()
  release = undefined
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
})

describe('sleepWhenHidden', () => {
  it('sleeps when the phone is locked and wakes when it is unlocked', () => {
    const { calls, sleeper } = recorder()
    release = sleepWhenHidden(document, sleeper)
    setVisibility('hidden')
    setVisibility('visible')
    expect(calls).toEqual(['sleep', 'wake'])
  })

  it('sleeps on a page hide or a freeze too, which some browsers send first', () => {
    const { calls, sleeper } = recorder()
    release = sleepWhenHidden(document, sleeper)
    window.dispatchEvent(new Event('pagehide'))
    document.dispatchEvent(new Event('freeze'))
    expect(calls).toEqual(['sleep', 'sleep'])
  })

  it('keeps playing while another window has focus and the page is still in view', () => {
    // A second monitor, a chat app over the corner: the race goes on, so does its sound.
    const { calls, sleeper } = recorder()
    release = sleepWhenHidden(document, sleeper)
    window.dispatchEvent(new Event('blur'))
    window.dispatchEvent(new Event('focus'))
    expect(calls).toEqual([])
  })

  it('asks the sound to resume on a gesture, for a graph the system interrupted', () => {
    const { calls, sleeper } = recorder()
    release = sleepWhenHidden(document, sleeper)
    window.dispatchEvent(new Event('pointerup'))
    window.dispatchEvent(new Event('keydown'))
    expect(calls).toEqual(['gesture', 'gesture'])
  })

  it('stops listening once released', () => {
    const { calls, sleeper } = recorder()
    sleepWhenHidden(document, sleeper)()
    setVisibility('hidden')
    window.dispatchEvent(new Event('pointerup'))
    expect(calls).toEqual([])
  })
})
