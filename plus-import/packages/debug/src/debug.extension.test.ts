// The debug extension: the overlay in `hud.overlay`, and no sim plugin or content (presentation never changes the sim, law 1).
import { expect, it } from 'vitest'
import DebugOverlay from './DebugOverlay.svelte'
import { debugExtension } from './index'

it('puts the overlay in the hud slot and nothing in the sim', () => {
  expect(debugExtension.name).toBe('debug')
  expect(debugExtension.ui?.slots?.['hud.overlay']).toBe(DebugOverlay)
  expect(debugExtension.sim ?? []).toEqual([])
  expect(debugExtension.content ?? []).toEqual([])
})
