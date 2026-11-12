// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { attachControls, HOLD_TO_SKIP } from '#src/app/controls.ts'

// The controls a held key cannot be: the lamp is a press (a held F would flick it every tick), and skipping a cutscene is a key
// or the pad's start held for a moment, so a stray press never throws a scene away. The input map's own keys (walking, the
// camera) are held ones; these send one command each.

const sent: { type: string }[] = []
const send = (command: { type: string }): void => void sent.push(command)
let stop: (() => void) | undefined

function attach(inCutscene = false): void {
  stop = attachControls({ target: window, send, inCutscene: () => inCutscene, pad: () => undefined })
}
const key = (type: 'keydown' | 'keyup', code: string, repeat = false): void => {
  window.dispatchEvent(new KeyboardEvent(type, { code, repeat }))
}

afterEach(() => {
  stop?.()
  stop = undefined
  sent.length = 0
  vi.useRealTimers()
})

describe('the lamp key', () => {
  it('sends one toggle for a press, and none for the repeats of a held key', () => {
    attach()
    key('keydown', 'KeyF')
    key('keydown', 'KeyF', true)
    key('keydown', 'KeyF', true)
    key('keyup', 'KeyF')
    expect(sent.map((each) => each.type)).toEqual(['systems.light-toggle'])
  })

  it('toggles again for the next press', () => {
    attach()
    for (let i = 0; i < 2; i++) {
      key('keydown', 'KeyF')
      key('keyup', 'KeyF')
    }
    expect(sent).toHaveLength(2)
  })
})

describe('skipping a cutscene', () => {
  it('needs the key held for a moment, in a cutscene', () => {
    vi.useFakeTimers()
    attach(true)
    key('keydown', 'KeyX')
    vi.advanceTimersByTime(HOLD_TO_SKIP - 50)
    expect(sent).toHaveLength(0)
    vi.advanceTimersByTime(100)
    expect(sent.map((each) => each.type)).toEqual(['cutscene.skip'])
  })

  it('is let go by releasing the key early', () => {
    vi.useFakeTimers()
    attach(true)
    key('keydown', 'KeyX')
    vi.advanceTimersByTime(HOLD_TO_SKIP - 100)
    key('keyup', 'KeyX')
    vi.advanceTimersByTime(500)
    expect(sent).toHaveLength(0)
  })

  it('does nothing outside a cutscene', () => {
    vi.useFakeTimers()
    attach(false)
    key('keydown', 'KeyX')
    vi.advanceTimersByTime(HOLD_TO_SKIP * 2)
    expect(sent).toHaveLength(0)
  })
})

describe('the pad', () => {
  it('toggles the lamp on the north button’s press, and skips on start held', () => {
    vi.useFakeTimers()
    let buttons: boolean[] = []
    const pad = () => ({ buttons })
    stop = attachControls({
      target: window,
      send,
      inCutscene: () => true,
      pad,
      poll: (tick) => void setTimeout(tick, 16),
    })
    buttons = Array.from({ length: 17 }, (_, index) => index === 3)
    vi.advanceTimersByTime(40)
    buttons = []
    vi.advanceTimersByTime(40)
    expect(sent.map((each) => each.type)).toEqual(['systems.light-toggle'])
    buttons = Array.from({ length: 17 }, (_, index) => index === 9)
    vi.advanceTimersByTime(HOLD_TO_SKIP + 100)
    expect(sent.map((each) => each.type)).toEqual(['systems.light-toggle', 'cutscene.skip'])
  })
})
