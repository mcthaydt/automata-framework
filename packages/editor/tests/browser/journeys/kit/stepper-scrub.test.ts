import '#src/shared/kit/tokens.css'
import '#src/shared/kit/fonts.css'
import { type MountedFixture, mountFixture, settleLayout } from '@mcthaydt/automata/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { createHistory } from '#src/shared/kit/history/history.ts'
import { IPAD_PROFILES } from '#src/testing/kit/ipad-profiles.ts'
import JourneyFixture, { type JourneyState } from '#src/testing/kit/JourneyFixture.svelte'
import { createPointers } from '#src/testing/kit/pointers.ts'

// EK-a on each iPad: a finger drags the stepper's label 40 px right and lifts. One undo step; the value
// moved by the configured rate (one step per 8 px, so 5); undo puts it back.

let mounted: MountedFixture | undefined
afterEach(async () => {
  await mounted?.unmount()
  mounted = undefined
})

describe('EK-a: scrub a stepper by its label', () => {
  it.each(IPAD_PROFILES)(
    'is one undo step at the configured rate, and undo restores it, at $name',
    async (profile) => {
      await page.viewport(profile.width, profile.height)
      const history = createHistory<JourneyState>({ hp: 3, volume: 50 })
      mounted = mountFixture(JourneyFixture, { history, onsurface: () => {} })
      await settleLayout()
      const label = document.querySelector<HTMLElement>('[data-widget="stepper"] [data-scrub-handle]')
      if (label === null) throw new Error('no stepper label')
      await createPointers(label).drag([
        { x: 4, y: 8 },
        { x: 24, y: 8 },
        { x: 44, y: 8 },
      ])
      expect(history.state.hp).toBe(8)
      expect(history.canUndo).toBe(true)
      history.undo()
      expect(history.state.hp).toBe(3)
      expect(history.canUndo).toBe(false)
    },
  )
})
