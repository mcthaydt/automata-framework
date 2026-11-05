import { describe, expect, it } from 'vitest'
import { CURSOR_IDLE_MS, CursorRunner, cursorHidden } from '#src/shared/ui/focus/cursor-policy.ts'

// From FloorFifty `tests/client/ui/cursor-policy.test.ts` at `ac72660`; the screen is a ScreenDef's `kind`.
describe('the cursor policy', () => {
  const playing = { kind: 'gameplay' as const, paused: false, msSincePointerMove: 0 }

  it.each([
    [{ ...playing, lastInput: 'keyboard' as const }, true],
    [{ ...playing, lastInput: 'gamepad' as const }, true],
    [{ ...playing, lastInput: 'pointer' as const }, false],
    [{ ...playing, lastInput: 'pointer' as const, msSincePointerMove: CURSOR_IDLE_MS }, true],
    [{ ...playing, lastInput: 'keyboard' as const, paused: true }, false],
    [{ ...playing, lastInput: 'keyboard' as const, kind: 'menu' as const }, false],
    [{ ...playing, lastInput: 'keyboard' as const, kind: undefined }, false],
  ])('%o hides: %s', (state, hidden) => {
    expect(cursorHidden(state)).toBe(hidden)
  })

  it('brings the cursor back on movement and hides it again after 2 s idle', () => {
    let now = 0
    const target = document.createElement('div')
    const runner = new CursorRunner(target, { now: () => now, kind: () => 'gameplay' })
    const detach = runner.attach(document)

    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }))
    runner.tick()
    expect(target.style.cursor).toBe('none')

    document.dispatchEvent(new MouseEvent('pointermove'))
    runner.tick()
    expect(target.style.cursor).toBe('')

    now = CURSOR_IDLE_MS
    runner.tick()
    expect(target.style.cursor).toBe('none')

    detach()
    expect(target.style.cursor).toBe('')
  })
})
