import '#src/shared/ui/theme.css'
import { describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { mountFixture } from '#src/testing/fixtures/mount.ts'
import { REFERENCE_SIZES, TIGHT_SIZES, VARIANTS } from '#src/testing/layout/reference-sizes.ts'
import { byTestId, type Conditions, checkLayout, publishConditions } from '#src/testing/ui/layout-contract.ts'
import { FIXTURE_LOCALES, findUntranslated } from '#src/testing/ui/locale-fixture.ts'
import SaveSlotsFixture, {
  SAVE_SLOTS_SHOWS,
  type SaveSlotsShow,
} from '#src/testing/ui/SaveSlotsFixture.svelte'
import { settleLayout } from '#src/testing/ui/settle.ts'

// SaveSlots at every reference size and variant, keyboard, Ruken's strip and TV scale included, with production CSS, in
// Chromium, WebKit and Firefox (M5 spec §8). The rows scroll inside their list; what a player must always reach, with
// the list scrolled or not, is the action bar and Back. With the keyboard up the screen frame scrolls what does not fit
// (as `screen-frame.layout.test.ts` holds), so the bar names no essentials then. The contract runs in English and again
// in the xx-long pseudo-locale (PRODUCT spec §4 item 7).

/** What a player must reach without scrolling. */
function essentials(show: SaveSlotsShow, keyboard: boolean): HTMLElement[] {
  if (keyboard) return []
  switch (show) {
    case 'slots':
    case 'slots-long':
      return [byTestId('save-slots-load'), byTestId('save-slots-delete')]
    case 'newer':
      return [byTestId('save-slots-delete')]
    case 'loading':
      return []
  }
}

/** Rows are 48 px at the scale, and at least one whole row stays on screen, however short the screen is. */
function rowProblems(show: SaveSlotsShow, conditions: Conditions): string[] {
  if (show === 'loading') return []
  const rows = [...document.querySelectorAll<HTMLElement>('[data-save-slot]')]
  const target = 48 * conditions.geometry.scale
  const problems: string[] = []
  for (const row of rows) {
    const height = row.getBoundingClientRect().height
    if (height + 0.5 < target)
      problems.push(
        `slot ${row.dataset.saveSlot} is ${Math.round(height)}px tall, under ${Math.round(target)}px`,
      )
  }
  const first = rows[0]
  if (first !== undefined) {
    const box = first.getBoundingClientRect()
    if (box.bottom > innerHeight + 0.5 || box.top < -0.5) problems.push('the first slot is not on screen')
    if (box.right > innerWidth + 0.5 || box.left < -0.5) problems.push('the first slot runs past the sides')
  }
  return problems
}

/** A label and a time wrap to two lines then are cut: no row grows past three lines of text and a little more. */
function clampProblems(show: SaveSlotsShow): string[] {
  const problems: string[] = []
  for (const part of document.querySelectorAll<HTMLElement>('.af-save-slot__name, .af-save-slot__detail')) {
    const line = Number.parseFloat(getComputedStyle(part).lineHeight)
    if (part.clientHeight > line * 2 + 1)
      problems.push(`a ${show} slot's text shows ${Math.round(part.clientHeight / line)} lines, over two`)
  }
  return problems
}

for (const locale of FIXTURE_LOCALES) {
  describe(`SaveSlots layout contract (${locale})`, () => {
    for (const show of SAVE_SLOTS_SHOWS) {
      test.each([...REFERENCE_SIZES, ...TIGHT_SIZES])(`${show} at $name ($width x $height)`, async (size) => {
        await page.viewport(size.width, size.height)
        const problems: string[] = []
        for (const variant of VARIANTS) {
          const conditions = publishConditions(document.documentElement, size, variant)
          const fixture = mountFixture(SaveSlotsFixture, { show, locale })
          await settleLayout()
          const found = [
            ...checkLayout(conditions, essentials(show, variant.keyboard !== undefined)),
            ...(variant.keyboard === undefined ? rowProblems(show, conditions) : []),
            ...clampProblems(show),
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
