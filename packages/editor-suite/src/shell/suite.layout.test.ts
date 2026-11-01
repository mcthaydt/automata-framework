import '@mcthaydt/automata-editor-kit/tokens.css'
import '@mcthaydt/automata-editor-kit/fonts.css'
import '../main.css'
import { type EditorSize, REST, SIZES } from '@mcthaydt/automata-editor-kit/testing'
import { checkLayout, publishConditions, settleLayout } from '@mcthaydt/automata-ui/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { EDITOR_LIST_PATH } from '../core'
import { FLOORFIFTY_SAMPLE, samplePorts } from '../testing/sample-ports'
import { type SuiteHandle, startSuite } from './boot'
import { createSuite } from './create-suite'

// The suite with the production CSS in a real browser at the editors' window sizes (editor suite spec §10, §12):
// region boxes, the nine entries, the 64 px tab bar, 44 px targets, no page scroll and no remount on rotation. jsdom
// has no layout, so only this file checks room. Started the way `main.ts` starts it, with the real window.

let started: SuiteHandle | undefined
let target: HTMLElement | undefined
afterEach(async () => {
  await started?.dispose()
  target?.remove()
  started = undefined
  target = undefined
})

async function open(size: EditorSize, files: Record<string, string> = FLOORFIFTY_SAMPLE) {
  await page.viewport(size.width, size.height)
  const conditions = publishConditions(document.documentElement, size, REST)
  target = document.body.appendChild(document.createElement('div'))
  target.id = 'app'
  started = await startSuite(target, {
    window,
    document,
    ports: await samplePorts(files),
    suite: createSuite({ editors: [] }),
    sample: true,
  })
  await settleLayout()
  return conditions
}

const tabs = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('[role="tab"]')]
const home = (): HTMLElement => {
  const found = document.querySelector<HTMLElement>('button[aria-current="page"]')
  if (found === null) throw new Error('no Home button')
  return found
}

describe.each(SIZES)('Suite at $name ($width x $height)', (size) => {
  test('the shell mode, nine tabs of at least 44 px, Home reachable, nothing clipped, no page scroll', async () => {
    const conditions = await open(size)
    expect(document.querySelector('[data-editor-shell]')).toHaveAttribute('data-mode', size.mode)
    const all = tabs()
    expect(all.map((tab) => tab.textContent?.trim())).toEqual([
      'Tuner',
      'Studio',
      'Audio',
      'Feel',
      'Writer',
      'Schematic',
      'Sequence',
      'Levels',
      'Review',
    ])
    for (const tab of all) {
      const box = tab.getBoundingClientRect()
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.height).toBeGreaterThanOrEqual(44)
    }
    // Every tab is whole in wide; below it the tabs past the window's edge are reached by scrolling the bar sideways,
    // which is a declared scroll region (nine 44 px tabs with their words need more than a phone's width).
    const rail = all[0]?.parentElement
    // Half a pixel for WebKit's and Firefox's sub-pixel boxes.
    const whole = all.filter((tab) => tab.getBoundingClientRect().right <= size.width + 0.5)
    if (size.mode === 'wide') expect(whole).toEqual(all)
    if (whole.length < all.length) {
      expect(rail).toHaveAttribute('data-scroll-region', 'both')
      all.at(-1)?.scrollIntoView({ inline: 'end', block: 'nearest' })
      await settleLayout()
      expect(all.at(-1)?.getBoundingClientRect().right).toBeLessThanOrEqual(size.width + 0.5)
      rail?.scrollTo({ left: 0 })
      await settleLayout()
    }
    expect(checkLayout(conditions, [home(), ...whole])).toEqual([])
    expect(document.documentElement.scrollLeft).toBe(0)
    expect(document.documentElement.scrollTop).toBe(0)
    await page.screenshot({ path: `.vitest/shots/suite-home-${size.name}.png` })
  })

  test('a double tap does not zoom the page and a hold does not select the chrome (the Owner, on an iPad)', async () => {
    await open(size)
    expect(getComputedStyle(document.documentElement).touchAction).toBe('manipulation')
    expect(getComputedStyle(document.body).touchAction).toBe('manipulation')
    expect(
      getComputedStyle(home()).userSelect || getComputedStyle(home()).getPropertyValue('-webkit-user-select'),
    ).toBe('none')
    expect(getComputedStyle(home()).getPropertyValue('-webkit-touch-callout') || 'none').toBe('none')
  })

  test('the rail is a column in wide and a 64 px tab bar at the foot below it', async () => {
    await open(size)
    const rail = document.querySelector<HTMLElement>('[role="tablist"]')
    if (rail === null) throw new Error('no rail')
    const box = rail.getBoundingClientRect()
    if (size.mode === 'wide') {
      expect(rail).toHaveAttribute('aria-orientation', 'vertical')
      expect(box.left).toBe(0)
    } else {
      expect(rail).toHaveAttribute('aria-orientation', 'horizontal')
      const bar = rail.parentElement?.getBoundingClientRect()
      expect(Math.round(bar?.height ?? 0)).toBe(64)
      expect(Math.round(bar?.bottom ?? 0)).toBeLessThanOrEqual(size.height)
    }
  })

  test("the list's problem and a read-only file stay inside the window", async () => {
    const conditions = await open(size, {
      [EDITOR_LIST_PATH]:
        'format = "af-editors/1"\n[[file]]\nglob = "a.toml"\neditor = "tuner"\nmodes = ["edit"]\nchecks = []\n',
    })
    const alert = document.querySelector<HTMLElement>('[role="alert"]')
    expect(alert?.getBoundingClientRect().right ?? Infinity).toBeLessThanOrEqual(size.width)
    expect(checkLayout(conditions, [home()])).toEqual([])
    await page.screenshot({ path: `.vitest/shots/suite-problem-${size.name}.png` })
  })
})

describe('Suite rotation', () => {
  test('1194 x 834 to 834 x 1194 keeps Home and the chosen entry and remounts nothing', async () => {
    const [landscape, portrait] = [SIZES[0], SIZES[4]] as [EditorSize, EditorSize]
    await open(landscape)
    const levels = tabs().find((tab) => tab.textContent?.trim() === 'Levels')
    levels?.click()
    await settleLayout()
    const shell = document.querySelector('[data-editor-shell]')
    const page1 = document.querySelector('[data-testid="suite-home"]')
    await page.viewport(portrait.width, portrait.height)
    await settleLayout()
    expect(document.querySelector('[data-editor-shell]')).toBe(shell)
    expect(document.querySelector('[data-testid="suite-home"]')).toBe(page1)
    expect(document.querySelector('[aria-selected="true"]')?.textContent?.trim()).toBe('Levels')
  })
})
