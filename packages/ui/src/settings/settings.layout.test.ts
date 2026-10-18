import '../theme.css'
import { mountFixture, REFERENCE_SIZES, VARIANTS } from '@mcthaydt/automata-testing'
import { describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { byTestId, checkLayout, publishConditions } from '../testing/layout-contract'
import SettingsFixture, { SETTINGS_SHOWS, type SettingsShow } from '../testing/SettingsFixture.svelte'
import { settleLayout } from '../testing/settle'

// The core Settings screen (M4 spec §4.8, §7, §8) at every reference size and variant, keyboard, Ruken's strip and
// TV scale included, with production CSS, in Chromium, WebKit and Firefox. Every rebind button and option is a whole
// target; the sections scroll inside their list, so Back and the first row stay reachable on a short screen.

/**
 * What a player must reach without scrolling: the dialog's Close (named Back), Back under the dialog where the band is
 * tall enough to draw it, the tabs, and the tab's first row: on Settings the first group's
 * first choice (Language's Automatic), on Controls the first row's rebind button in the section of the device in use; while a capture waits, the button that waits (the section
 * keeps it in view), as the row's other buttons may wrap below it on a short screen.
 */
function essentials(show: SettingsShow, keyboard: boolean): HTMLElement[] {
  // With the keyboard up the frame scrolls what does not fit (screen-frame.layout.test.ts holds that).
  if (keyboard) return []
  const first =
    show === 'settings'
      ? [document.querySelector<HTMLElement>('[data-settings-section] label.af-option') as HTMLElement]
      : show === 'controls-capturing'
        ? [...document.querySelectorAll<HTMLElement>('[data-control-row="left"] [data-capturing]')]
        : [...document.querySelectorAll<HTMLElement>('[data-in-use] [data-control-row="left"] [data-rebind]')]
  const close = document.querySelector<HTMLElement>('[data-testid="settings-screen"] [data-modal-close]')
  const back = document.documentElement.dataset.height === undefined ? [byTestId('settings-back')] : []
  return [
    ...(close === null ? [] : [close]),
    ...back,
    byTestId('settings-tab-settings'),
    byTestId('settings-tab-controls'),
    ...first,
  ]
}

describe('Settings screen layout contract', () => {
  for (const show of SETTINGS_SHOWS) {
    test.each(REFERENCE_SIZES)(`${show} at $name ($width x $height)`, async (size) => {
      await page.viewport(size.width, size.height)
      const problems: string[] = []
      for (const variant of VARIANTS) {
        const conditions = publishConditions(document.documentElement, size, variant)
        const fixture = mountFixture(SettingsFixture, { show })
        await settleLayout()
        if (show !== 'settings') {
          byTestId('settings-tab-controls').click()
          await settleLayout()
        }
        for (const problem of checkLayout(conditions, essentials(show, variant.keyboard !== undefined)))
          problems.push(`${variant.name}: ${problem}`)
        await fixture.unmount()
      }
      expect(problems).toEqual([])
    })
  }
})

describe('Settings screen tabs', () => {
  // Two sections across is for a tab with several groups (FloorFifty: Language beside Audio); a tab of one section,
  // Controls, takes the dialog's width, its device sections one under another as FloorFifty's Controls tab.
  test('a tab with one section spans the dialog on a short, wide band', async () => {
    const size = REFERENCE_SIZES.find((candidate) => candidate.name === 'iphone-14-landscape')
    if (size === undefined) throw new Error('no iphone-14-landscape')
    await page.viewport(size.width, size.height)
    publishConditions(document.documentElement, size, VARIANTS[0] ?? { name: 'rest' })
    const fixture = mountFixture(SettingsFixture, { show: 'controls' })
    await settleLayout()
    byTestId('settings-tab-controls').click()
    await settleLayout()
    const sections = document.querySelector('.af-settings__sections')?.getBoundingClientRect()
    const controls = document.querySelector('[data-settings-section="controls"]')?.getBoundingClientRect()
    await fixture.unmount()
    expect(Math.round(controls?.width ?? 0)).toBe(Math.round(sections?.width ?? -1))
  })

  // Two groups across where the dialog is 560 px wide: Language beside Audio, as FloorFifty's.
  test('sets Language beside Audio on a short, wide band, and Audio under Language on an upright phone', async () => {
    const place = async (name: string) => {
      const size = REFERENCE_SIZES.find((candidate) => candidate.name === name)
      if (size === undefined) throw new Error(`no ${name}`)
      await page.viewport(size.width, size.height)
      publishConditions(document.documentElement, size, VARIANTS[0] ?? { name: 'rest' })
      const fixture = mountFixture(SettingsFixture, { show: 'settings' })
      await settleLayout()
      const display = document.querySelector('[data-settings-section="language"]')?.getBoundingClientRect()
      const audio = document.querySelector('[data-settings-section="audio"]')?.getBoundingClientRect()
      await fixture.unmount()
      if (display === undefined || audio === undefined) throw new Error('no Language or Audio group')
      return {
        beside: audio.left >= display.right && Math.abs(audio.top - display.top) < 1,
        under: audio.top >= display.bottom,
      }
    }
    expect((await place('iphone-14-landscape')).beside).toBe(true)
    expect((await place('iphone-14')).under).toBe(true)
  })

  // FloorFifty's volume rows: the bus's name, its slider and its percentage on one 44 px row, not a label above a track.
  test('sets each audio slider on one row: name, track and percentage', async () => {
    for (const name of ['iphone-14', 'iphone-14-landscape']) {
      const size = REFERENCE_SIZES.find((candidate) => candidate.name === name)
      if (size === undefined) throw new Error(`no ${name}`)
      await page.viewport(size.width, size.height)
      publishConditions(document.documentElement, size, VARIANTS[0] ?? { name: 'rest' })
      const fixture = mountFixture(SettingsFixture, { show: 'settings' })
      await settleLayout()
      const music = document.querySelector('[data-audio-bus="music"]') as HTMLElement
      const parts = ['label', 'input', '.af-slider__value'].map((selector) =>
        (music.querySelector(selector) as HTMLElement).getBoundingClientRect(),
      )
      const middles = parts.map((box) => box.top + box.height / 2)
      await fixture.unmount()
      expect(Math.max(...middles) - Math.min(...middles), `${name}: one row`).toBeLessThan(4)
    }
  })
})
