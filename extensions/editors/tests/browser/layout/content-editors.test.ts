import '@automata/editor/tokens.css'
import '@automata/editor/fonts.css'
import '@automata/editor/suite.css'
import type { SuiteEditor } from '@automata/editor/kit/ports'
import { editorTargets, SIZES } from '@automata/editor/kit/testing'
import { fixtureEditor } from '@automata/editor/suite/testing'
import { inShell, noPageScroll, type OpenedSuite, openSuite } from '@automata/editor/suite/testing/layout'
import { settleLayout } from '@automata/framework/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { contentEditors } from '#src/app/suite/content-editors.ts'
import { CONTENT_SAMPLE_GAME } from '#src/app/suite/sample-game.ts'

// The four content editors in the suite's one shell with the production CSS in a real browser, at the two sizes the Owner
// holds them to: a phone (390 x 844) and an iPad (820 x 1180). Each opens on the sample game's file, nothing covers it,
// every control a finger can press is 44 px (a primary 48), and the page never scrolls (only the editor's own regions do).

const phone = SIZES.find((size) => size.name === 'phone-portrait')
if (phone === undefined) throw new Error('the kit has no phone size')
const ipad = { ...phone, name: 'ipad-air-portrait', width: 820, height: 1180, mode: 'medium' as const }
const sizes = [phone, ipad]

/** What each editor shows once its file is open, to wait for. */
const READY: Readonly<Record<string, string>> = {
  Feel: 'section[aria-label="Feel"]',
  Audio: '[aria-label="Sounds and music"], [aria-label="Audio"]',
  Writer: 'textarea',
  Sequence: '[aria-label="Playing"]',
}

let opened: OpenedSuite | undefined
afterEach(async () => {
  await opened?.close()
  opened = undefined
})

/** Every control in the shell's page that is on screen. */
const controls = (): HTMLElement[] =>
  [
    ...document.querySelectorAll<HTMLElement>(
      '[data-editor-shell] main :is(button, input, select, textarea)',
    ),
  ].filter((element) => element.getClientRects().length > 0)

describe.each(sizes)('Content editors at $name ($width x $height)', (size) => {
  test.each(Object.keys(READY))(
    '%s fits: its controls are touch size and the page never scrolls',
    async (name) => {
      opened = await openSuite(
        size,
        [fixtureEditor as SuiteEditor<unknown>, ...contentEditors()],
        CONTENT_SAMPLE_GAME,
        READY[name] as string,
        name,
      )
      const main = inShell('main')
      const box = main.getBoundingClientRect()
      expect(box.width).toBeGreaterThan(size.width / 3)
      expect(box.right).toBeLessThanOrEqual(size.width + 0.5)
      // The editors scroll inside their own regions, so each control is brought into view before it is measured: what
      // matters is that a finger can reach it, press it and not miss it, not that it is on the first screen.
      const targets = editorTargets()
      const problems: string[] = []
      for (const control of controls()) {
        control.scrollIntoView({ block: 'center', inline: 'center' })
        await settleLayout()
        const label =
          control.getAttribute('aria-label') ?? control.textContent?.trim().slice(0, 30) ?? control.tagName
        const rect = control.getBoundingClientRect()
        const at = `${label || control.tagName}`
        if (rect.left < -0.5 || rect.right > size.width + 0.5) problems.push(`${at} runs off the side`)
        const boxed = control instanceof HTMLInputElement && ['checkbox', 'radio'].includes(control.type)
        if (!boxed && (rect.height < targets.hit - 0.5 || rect.width < targets.hit - 0.5))
          problems.push(
            `${at} is ${Math.round(rect.width)} x ${Math.round(rect.height)}, under ${targets.hit}`,
          )
        const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
        if (top === null || !(control.contains(top) || top.contains(control)))
          problems.push(`${at} is covered by ${top?.tagName ?? 'nothing'}`)
      }
      noPageScroll()
      expect(problems).toEqual([])
      noPageScroll()
      await page.screenshot({ path: `.vitest/shots/content-${name.toLowerCase()}-${size.name}.png` })
    },
  )
})

describe.each(sizes)('Sequence’s step sheet at $name ($width x $height)', (size) => {
  test('a chosen step’s fields can all be read, from the top of the page and from the bottom', async () => {
    opened = await openSuite(
      size,
      [fixtureEditor as SuiteEditor<unknown>, ...contentEditors()],
      CONTENT_SAMPLE_GAME,
      READY.Sequence as string,
      'Sequence',
    )
    const mark = document.querySelector<HTMLElement>('.mark:not(:disabled)')
    if (mark === null) throw new Error('the sample cutscene has no step to choose')
    mark.click()
    await settleLayout()
    const sheet = document.querySelector<HTMLElement>('section[aria-label="This step"]')
    if (sheet === null) throw new Error('choosing a step shows no fields')
    const hidden: string[] = []
    // The sheet is looked at where the person might be: the page scrolled to its top, and to its bottom.
    for (const place of ['top', 'bottom'] as const) {
      for (const scroller of document.querySelectorAll<HTMLElement>('*')) {
        if (
          scroller.scrollHeight > scroller.clientHeight + 1 &&
          getComputedStyle(scroller).overflowY !== 'visible'
        )
          scroller.scrollTop = place === 'top' ? 0 : scroller.scrollHeight
      }
      await settleLayout()
      for (const label of sheet.querySelectorAll<HTMLElement>('label')) {
        const rect = label.getBoundingClientRect()
        // A field scrolled out of the editor's own region is not covered, it is simply further down.
        const region = inShell('main').getBoundingClientRect()
        if (rect.bottom < region.top || rect.top > region.bottom) continue
        const top = document.elementFromPoint(rect.left + 4, rect.top + rect.height / 2)
        if (top === null) continue
        if (!(label.contains(top) || top.contains(label) || sheet.contains(top)))
          hidden.push(
            `${label.textContent?.trim().slice(0, 20)} (${place}) is covered by ${top?.tagName ?? 'nothing'}`,
          )
      }
    }
    expect(hidden).toEqual([])
  })
})
