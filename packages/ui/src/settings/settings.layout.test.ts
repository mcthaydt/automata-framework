import '../theme.css'
import { mountFixture, REFERENCE_SIZES, VARIANTS } from '@mcthaydt/automata-testing'
import { describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { byTestId, checkLayout, publishConditions } from '../testing/layout-contract'
import { FIXTURE_LOCALES, findUntranslated } from '../testing/locale-fixture'
import SettingsFixture, { SETTINGS_SHOWS, type SettingsShow } from '../testing/SettingsFixture.svelte'
import { settleLayout } from '../testing/settle'

// The core Settings screen (M4 spec §4.8, §7, §8) at every reference size and variant, keyboard, Ruken's strip and
// TV scale included, with production CSS, in Chromium, WebKit and Firefox. Every rebind button and option is a whole
// target; the sections scroll inside their list, so Back and the first row stay reachable on a short screen. The contract
// runs in English and again in the xx-long pseudo-locale (PRODUCT spec §4 item 7).

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
    show === 'settings' || show === 'settings-short'
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

for (const locale of FIXTURE_LOCALES) {
  describe(`Settings screen layout contract (${locale})`, () => {
    for (const show of SETTINGS_SHOWS) {
      test.each(REFERENCE_SIZES)(`${show} at $name ($width x $height)`, async (size) => {
        await page.viewport(size.width, size.height)
        const problems: string[] = []
        for (const variant of VARIANTS) {
          const conditions = publishConditions(document.documentElement, size, variant)
          const fixture = mountFixture(SettingsFixture, { show, locale })
          await settleLayout()
          if (show.startsWith('controls')) {
            byTestId('settings-tab-controls').click()
            await settleLayout()
          }
          const found = [
            ...checkLayout(conditions, essentials(show, variant.keyboard !== undefined)),
            ...(locale === 'en' ? [] : findUntranslated(document.body)),
          ]
          for (const problem of found) problems.push(`${variant.name}: ${problem}`)
          await fixture.unmount()
        }
        expect(problems).toEqual([])
      })
    }
  })
}

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

  // PRODUCT.L3a: in a long language the two tabs are wider than a narrow phone's dialog at TV scale. They took the
  // dialog's column with them, past the screen, and Close and Back with it; they wrap to a second row instead.
  test('wraps its tabs on a narrow dialog rather than widening it past the screen', async () => {
    const size = REFERENCE_SIZES.find((candidate) => candidate.name === 'phone-small')
    const tv = VARIANTS.find((variant) => variant.name === 'tv-scale')
    if (size === undefined || tv === undefined) throw new Error('no phone-small or tv-scale variant')
    await page.viewport(size.width, size.height)
    publishConditions(document.documentElement, size, tv)
    const fixture = mountFixture(SettingsFixture, { show: 'settings', locale: 'xx-long' })
    await settleLayout()
    const dialog = byTestId('settings-screen').getBoundingClientRect()
    const tabs = ['settings', 'controls'].map((id) => byTestId(`settings-tab-${id}`).getBoundingClientRect())
    await fixture.unmount()
    expect(dialog.right).toBeLessThanOrEqual(size.width + 0.5)
    for (const tab of tabs) expect(tab.right).toBeLessThanOrEqual(dialog.right + 0.5)
  })

  // PRODUCT.L3a: in a long language a group's widest row (a volume's name, track and percentage) is wider than a
  // narrow phone's list at TV scale. The one column took that width, and every group's options ran past the list's
  // side, cut; the column keeps the list's width and each group lays out inside it.
  test('keeps each group inside the list on a narrow dialog, however wide its widest row', async () => {
    const size = REFERENCE_SIZES.find((candidate) => candidate.name === 'phone-small')
    const tv = VARIANTS.find((variant) => variant.name === 'tv-scale')
    if (size === undefined || tv === undefined) throw new Error('no phone-small or tv-scale variant')
    await page.viewport(size.width, size.height)
    publishConditions(document.documentElement, size, tv)
    const fixture = mountFixture(SettingsFixture, { show: 'settings', locale: 'xx-long' })
    await settleLayout()
    const sections = document.querySelector('.af-settings__sections')?.getBoundingClientRect()
    const widths = [...document.querySelectorAll('.af-settings__section')].map(
      (section) => section.getBoundingClientRect().width,
    )
    await fixture.unmount()
    for (const width of widths) expect(width).toBeLessThanOrEqual((sections?.width ?? 0) + 0.5)
  })

  // PRODUCT.L3a: in xx-long a long toggle name ("Mute in the background") squeezed its state word ("⟦Óƒƒ··⟧") to three
  // characters on a narrow phone at TV scale, and the word ran past the toggle; held whole, it was pushed past the
  // toggle's edge by the name's longest word (WebKit and Firefox fonts). The name wraps, breaking a word too long for
  // its room; the state word keeps its whole width beside the track, inside the toggle.
  test('keeps a toggle’s state word whole beside its track, inside the toggle, however long its name', async () => {
    const size = REFERENCE_SIZES.find((candidate) => candidate.name === 'phone-small')
    const tv = VARIANTS.find((variant) => variant.name === 'tv-scale')
    if (size === undefined || tv === undefined) throw new Error('no phone-small or tv-scale variant')
    await page.viewport(size.width, size.height)
    publishConditions(document.documentElement, size, tv)
    const fixture = mountFixture(SettingsFixture, { show: 'settings', locale: 'xx-long' })
    await settleLayout()
    const state = byTestId('audio-mute-unfocused').querySelector('[data-toggle-state]') as HTMLElement
    const range = document.createRange()
    range.selectNodeContents(state)
    const words = range.getBoundingClientRect()
    const box = state.getBoundingClientRect()
    const toggle = byTestId('audio-mute-unfocused').getBoundingClientRect()
    await fixture.unmount()
    expect(words.right).toBeLessThanOrEqual(box.right + 0.5)
    expect(words.left).toBeGreaterThanOrEqual(box.left - 0.5)
    expect(box.right).toBeLessThanOrEqual(toggle.right + 0.5)
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

  // The Desk, 2026-10-18: on a phone Settings fills the band's height as FloorFifty's does, the list taking the rest
  // and Back at the bottom, rather than a small card in the middle of the screen.
  test('fills the band’s height on a phone, upright and sideways; keeps to its content on a desktop', async () => {
    const measure = async (name: string) => {
      const size = REFERENCE_SIZES.find((candidate) => candidate.name === name)
      if (size === undefined) throw new Error(`no ${name}`)
      await page.viewport(size.width, size.height)
      publishConditions(document.documentElement, size, VARIANTS[0] ?? { name: 'rest' })
      const fixture = mountFixture(SettingsFixture, { show: 'settings-short' })
      await settleLayout()
      const scrim = document.querySelector('[data-modal-scrim]') as HTMLElement
      const dialog = byTestId('settings-screen').getBoundingClientRect()
      const style = getComputedStyle(scrim)
      const room =
        scrim.getBoundingClientRect().height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
      await fixture.unmount()
      return dialog.height / room
    }
    expect(await measure('iphone-14')).toBeGreaterThan(0.99)
    expect(await measure('iphone-14-landscape')).toBeGreaterThan(0.99)
    expect(await measure('desktop-laptop')).toBeLessThan(0.99)
  })

  // The Desk, 2026-10-18: on a desktop Settings is not a narrow column with "+1 more"; it sets its groups two across,
  // Language beside Audio, and the groups a desktop shows fit without scrolling. (Touch controls, last in the fixture,
  // shows only on a coarse pointer, so a desktop never has it.)
  test('sets its groups two across on a desktop, and its desktop groups fit without scrolling', async () => {
    const size = REFERENCE_SIZES.find((candidate) => candidate.name === 'desktop-720p')
    if (size === undefined) throw new Error('no desktop-720p')
    await page.viewport(size.width, size.height)
    publishConditions(document.documentElement, size, VARIANTS[0] ?? { name: 'rest' })
    const fixture = mountFixture(SettingsFixture, { show: 'settings' })
    await settleLayout()
    const language = document.querySelector('[data-settings-section="language"]')?.getBoundingClientRect()
    const audio = document.querySelector('[data-settings-section="audio"]')?.getBoundingClientRect()
    const list = document.querySelector('[data-settings-tab] [data-scroll-region]')?.getBoundingClientRect()
    const display = document.querySelector('[data-settings-section="display"]')?.getBoundingClientRect()
    await fixture.unmount()
    expect(audio !== undefined && language !== undefined && audio.left >= language.right).toBe(true)
    expect(display !== undefined && list !== undefined && display.bottom <= list.bottom + 1).toBe(true)
  })
})
