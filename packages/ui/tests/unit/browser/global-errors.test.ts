import { afterEach, describe, expect, it, vi } from 'vitest'
import { installGlobalErrorHandlers } from '#src/browser/global-errors.ts'

let uninstall: (() => void) | undefined

afterEach(() => {
  uninstall?.()
  uninstall = undefined
})

const rejection = (reason: unknown): Event => Object.assign(new Event('unhandledrejection'), { reason })

describe('the last line of defence (release readiness §6.7)', () => {
  it('reports an uncaught error by its class alone', () => {
    const onFatal = vi.fn()
    uninstall = installGlobalErrorHandlers(window, onFatal)
    window.dispatchEvent(new ErrorEvent('error', { error: new RangeError('a name could be in here') }))
    expect(onFatal).toHaveBeenCalledTimes(1)
    expect(onFatal).toHaveBeenCalledWith('RangeError')
  })

  // A rejection nobody awaited -- a sound effect that failed to fetch on a
  // flaky phone -- leaves the race running; it is reported, never fatal.
  it('reports an unhandled rejection by its class, as a rejection and not a fatal error', () => {
    const onFatal = vi.fn()
    const onRejection = vi.fn()
    uninstall = installGlobalErrorHandlers(window, onFatal, onRejection)
    window.dispatchEvent(rejection(new TypeError('x')))
    expect(onRejection).toHaveBeenCalledWith('TypeError')
    expect(onFatal).not.toHaveBeenCalled()
  })

  it('names something rejected that is not an error by its type, never its value', () => {
    const onRejection = vi.fn()
    uninstall = installGlobalErrorHandlers(window, vi.fn(), onRejection)
    window.dispatchEvent(rejection("Kite's room ABC234"))
    expect(onRejection).toHaveBeenCalledWith('string')
  })

  // The browser reports a ResizeObserver loop, a cross-origin "Script error."
  // or an extension's error as an ErrorEvent with no error object. None is a
  // failure of the game, so none may put a player on the recovery panel.
  it('ignores an error event that carries no error', () => {
    const onFatal = vi.fn()
    uninstall = installGlobalErrorHandlers(window, onFatal)
    window.dispatchEvent(
      new ErrorEvent('error', { message: 'ResizeObserver loop completed with undelivered notifications.' }),
    )
    window.dispatchEvent(new ErrorEvent('error', { message: 'Script error.' }))
    expect(onFatal).not.toHaveBeenCalled()
  })

  it('installs once per window, so booting twice reports once', () => {
    const onFatal = vi.fn()
    uninstall = installGlobalErrorHandlers(window, onFatal)
    const second = installGlobalErrorHandlers(window, onFatal)
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('x') }))
    expect(onFatal).toHaveBeenCalledTimes(1)
    second()
  })

  it('can be removed, and installed again', () => {
    const first = vi.fn()
    installGlobalErrorHandlers(window, first)()
    const again = vi.fn()
    uninstall = installGlobalErrorHandlers(window, again)
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('x') }))
    expect(first).not.toHaveBeenCalled()
    expect(again).toHaveBeenCalledTimes(1)
  })
})
