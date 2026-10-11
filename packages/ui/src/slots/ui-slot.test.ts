import { describe, expect, expectTypeOf, it } from 'vitest'
import { UI_SLOT_NAMES, type UiSlotName } from './ui-slot'

describe('UiSlotName (M1 shared contracts §2; M1.6 spec §3.7)', () => {
  it('is exactly the closed list of slots', () => {
    expect([...UI_SLOT_NAMES]).toEqual([
      'title.actions',
      'pause.actions',
      'settings.sections',
      'hud.overlay',
      'debug.panels',
    ])
    expectTypeOf<UiSlotName>().toEqualTypeOf<
      'title.actions' | 'pause.actions' | 'settings.sections' | 'hud.overlay' | 'debug.panels'
    >()
  })
})
