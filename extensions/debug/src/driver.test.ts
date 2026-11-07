// The test driver (M6 spec §4.2): `window.__automataDebug`, for Playwright playthroughs in dev builds.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installDebug } from './host'
import { Blank } from './testing/blank'

const panels = [{ id: 'one', title: 'One', component: Blank }]
const handle = (): Record<string, unknown> | undefined =>
  (window as unknown as { __automataDebug?: Record<string, unknown> }).__automataDebug
let dispose: (() => void) | undefined
afterEach(() => {
  dispose?.()
  dispose = undefined
})

describe('__automataDebug', () => {
  it('exposes the game’s driver functions and the panel ids', () => {
    const click = vi.fn()
    dispose = installDebug({ panels, driver: { click, state: () => ({ tick: 3 }) } })
    const driver = handle() as { click(x: number, y: number): void; state(): unknown; panels(): string[] }
    driver.click(1, 2)
    expect(click).toHaveBeenCalledWith(1, 2)
    expect(driver.state()).toEqual({ tick: 3 })
    expect(driver.panels()).toEqual(['one'])
  })
  it('is not there when the host has no driver', () => {
    dispose = installDebug({ panels })
    expect(handle()).toBeUndefined()
  })
  it('is removed by the dispose', () => {
    installDebug({ panels, driver: { state: () => 1 } })()
    expect(handle()).toBeUndefined()
  })
  it('is left alone when a later install replaced it', () => {
    const first = installDebug({ panels, driver: { state: () => 1 } })
    dispose = installDebug({ panels, driver: { state: () => 2 } })
    first()
    expect((handle() as { state(): number }).state()).toBe(2)
  })
})
