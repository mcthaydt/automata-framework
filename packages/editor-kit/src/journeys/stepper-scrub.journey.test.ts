import '../tokens.css'
import '../fonts.css'
import { type MountedFixture, mountFixture, settleLayout } from '@mcthaydt/automata/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { createHistory } from '../history/history'
import { IPAD_PROFILES } from '../testing/ipad-profiles'
import JourneyFixture, { type JourneyState } from '../testing/JourneyFixture.svelte'
import { createPointers } from '../testing/pointers'

// EK-a (kit spec §9) on each iPad: a finger drags the stepper's label 40 px right and lifts. One undo step; the value
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
