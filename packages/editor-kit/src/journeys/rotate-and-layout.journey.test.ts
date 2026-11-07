import '../tokens.css'
import '../fonts.css'
import {
  byTestId,
  checkLayout,
  type MountedFixture,
  mountFixture,
  publishConditions,
  settleLayout,
} from '@mcthaydt/automata/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { createHistory } from '../history/history'
import { IPAD_PROFILES, turned } from '../testing/ipad-profiles'
import JourneyFixture, { type JourneyState } from '../testing/JourneyFixture.svelte'
import { REST, SIZES } from '../testing/layout-sizes'
import { createPointers } from '../testing/pointers'
import ShellFixture from '../testing/ShellFixture.svelte'

// EK-c and EK-g (kit spec §9) in the iPad context.

let mounted: MountedFixture | undefined
afterEach(async () => {
  await mounted?.unmount()
  mounted = undefined
})

describe('EK-c: the iPad turns mid-drag of a slider', () => {
  it.each(IPAD_PROFILES)(
    'ends the drag cancelled with the value unchanged, without a remount, the panel scrolled where it was, from $name',
    async (profile) => {
      await page.viewport(profile.width, profile.height)
      const history = createHistory<JourneyState>({ hp: 3, volume: 50 })
      mounted = mountFixture(JourneyFixture, { history, onsurface: () => {} })
      await settleLayout()
      const panel = document.querySelector<HTMLElement>('[data-testid="panel"]')
      const slider = document.querySelector<HTMLElement>('[role="slider"]')
      const root = document.querySelector<HTMLElement>('[data-mount]')
      if (panel === null || slider === null || root === null) throw new Error('fixture incomplete')
      slider.scrollIntoView({ block: 'center' })
      await settleLayout()
      const scrolled = panel.scrollTop
      expect(scrolled).toBeGreaterThan(0)
      const mount = root.dataset.mount
      const finger = await createPointers(slider).down('touch', { x: 20, y: 10 })
      await finger.move({ x: 120, y: 10 })
      expect(history.state.volume).not.toBe(50)
      // The iPad turns: the window takes the other orientation and iPadOS cancels the touches in flight.
      const quarter = turned(profile)
      await page.viewport(quarter.width, quarter.height)
      await finger.cancel()
      await settleLayout()
      expect(history.state.volume).toBe(50)
      expect(history.canUndo).toBe(false)
      expect(document.querySelector<HTMLElement>('[data-mount]')?.dataset.mount).toBe(mount)
      expect(panel.scrollTop).toBe(scrolled)
    },
  )
})

/** The controls the shell must keep reachable without scrolling: the top bar and the rail. */
const CHROME = [
  'toggle-panel',
  'toggle-inspector',
  'toggle-dock',
  'rail-Stage',
  'rail-Path',
  'rail-Parts',
  'rail-Checks',
  'rail-Export',
]

describe('EK-g: the shell at each iPad', () => {
  it.each(IPAD_PROFILES)(
    'passes the layout contract with every action reachable at $name',
    async (profile) => {
      const size = SIZES.find((each) => each.name === profile.name)
      if (size === undefined) throw new Error(`no layout size ${profile.name}`)
      await page.viewport(size.width, size.height)
      const conditions = publishConditions(document.documentElement, size, REST)
      mounted = mountFixture(ShellFixture, { geometry: { current: conditions.geometry } })
      await settleLayout()
      expect(checkLayout(conditions, CHROME.map(byTestId))).toEqual([])
    },
  )
})
