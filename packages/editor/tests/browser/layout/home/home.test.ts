import '#src/shared/kit/tokens.css'
import '#src/shared/kit/tool-chrome.css'
import '#src/shared/kit/fonts.css'
import '#src/app/editor-2d/main.css'
import { byTestId, checkLayout, publishConditions, settleLayout } from '@automata/framework/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { type EditorHandle, startEditor } from '#src/app/editor-2d/boot.ts'
import { printProject } from '#src/shared/level-2d/model/project-codec.ts'
import { arrived, type EditorSize, REST, SIZES } from '#src/testing/kit/layout-sizes.ts'
import { editorTargets } from '#src/testing/kit/targets.ts'
import { createTestClock } from '#src/testing/kit/test-clock.ts'
import { memoryWorkspace } from '#src/testing/level-2d/memory-workspace.ts'
import { hollowmere, mossgate } from '#src/testing/level-2d/samples.ts'

/** The control sizes under this run's pointer: 32 px with a mouse, 44 (a primary 48) with touch. */
const targets = editorTargets()

// Home with the production CSS in a real browser, at the window sizes the 2D editor is designed for. jsdom has no layout, so everything about room (overflow, target sizes, what covers what,
// which region scrolls) is only checked here. The editor is started the way `main.ts` starts it, with the real window
// and so the real geometry owner; only the workspace is a memory one, filled with levels. The redesigned Home is one column: no side panel or inspector at any size.

const region = (name: string): HTMLElement => {
  const found = document.querySelector<HTMLElement>(`[data-region="${name}"]`)
  if (found === null) throw new Error(`no ${name} region`)
  return found
}
const cards = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('[aria-label="Levels"] .open')]
const moreButtons = (): HTMLElement[] => [
  ...document.querySelectorAll<HTMLElement>('[aria-label="Levels"] button.trigger'),
]

let started: EditorHandle | undefined
let target: HTMLElement | undefined
afterEach(async () => {
  await started?.dispose()
  target?.remove()
  started = undefined
  target = undefined
})

/** Starts the editor at `size` over a workspace holding `projects` copies of the samples. */
async function open(size: EditorSize, projects = 4) {
  await page.viewport(size.width, size.height)
  const conditions = publishConditions(document.documentElement, size, REST, targets)
  const clock = createTestClock()
  const workspace = memoryWorkspace(clock)
  for (let n = 0; n < projects; n += 1) {
    clock.advance(60_000)
    const sample = n % 2 === 0 ? mossgate() : hollowmere()
    await workspace.store.write(
      `${n % 2 === 0 ? 'mossgate' : 'hollowmere'}-${n + 1}.af2d.json`,
      printProject(sample),
    )
  }
  target = document.body.appendChild(document.createElement('div'))
  target.id = 'app'
  started = await startEditor(target, {
    window,
    document,
    workspace,
    clock: {
      now: () => Date.now(),
      setTimer: (ms, run) => window.setTimeout(run, ms),
      clearTimer: (handle) => window.clearTimeout(handle as number),
    },
    fillRandom: (bytes) => {
      crypto.getRandomValues(bytes)
    },
  })
  await settleLayout()
  return conditions
}

/** What a person must reach without scrolling: New level, the source control and the search. */
const essentials = (): HTMLElement[] => [byTestId('new-level'), byTestId('home-search')]

describe.each(SIZES)('Home layout at $name ($width x $height)', (size) => {
  test('rest: no clipped, overlapping, small or unreachable controls, and the page never scrolls', async () => {
    const conditions = await open(size)
    expect(document.querySelector('[data-editor-shell]')).toHaveAttribute('data-mode', size.mode)
    expect(checkLayout(conditions, essentials())).toEqual([])
    expect(
      byTestId('new-level').getBoundingClientRect().height,
      'New level is a primary action',
    ).toBeGreaterThanOrEqual(targets.primary)
    await page.screenshot({ path: `.vitest/shots/home-${size.name}.png` })
  })

  test('one column, no side regions, and every card and its More button inside the viewport', async () => {
    await open(size)
    const shell = document.querySelector('[data-editor-shell]') as HTMLElement
    for (const name of ['panel', 'inspector']) expect(shell).toHaveAttribute(`data-${name}`, 'none')
    const lefts = new Set(cards().map((card) => Math.round(card.getBoundingClientRect().left)))
    expect(lefts.size, 'every card starts at the same left edge').toBe(1)
    const more = moreButtons()
    expect(more).toHaveLength(cards().length)
    for (const button of more) {
      const box = button.getBoundingClientRect()
      expect(box.right).toBeLessThanOrEqual(window.innerWidth)
      expect(box.left).toBeGreaterThanOrEqual(0)
      expect(box.width).toBeGreaterThanOrEqual(targets.hit)
      expect(box.height).toBeGreaterThanOrEqual(targets.hit)
    }
    for (const card of cards())
      expect(card.getBoundingClientRect().height).toBeGreaterThanOrEqual(targets.primary)
    expect(document.documentElement.scrollWidth, 'no horizontal scroll').toBeLessThanOrEqual(
      window.innerWidth,
    )
  })

  test('the canvas has one scroll region, and it holds the source, the search, the cards and the storage line', async () => {
    await open(size)
    const regions = region('canvas').querySelectorAll<HTMLElement>('[data-scroll-region]')
    expect(regions).toHaveLength(1)
    const scroller = regions[0] as HTMLElement
    expect(getComputedStyle(scroller).overflowY).toBe('auto')
    expect(getComputedStyle(scroller).touchAction).toBe('pan-y')
    for (const id of ['home-search', 'home-storage']) expect(scroller).toContainElement(byTestId(id))
    expect(scroller).toContainElement(document.querySelector('[aria-label="Levels"]'))
  })

  test('New level opens its sheet with every template a full-size target, and Import files is one too', async () => {
    const conditions = await open(size)
    byTestId('new-level').click()
    await arrived()
    const sheet = document.querySelector<HTMLElement>('[role="dialog"]') as HTMLElement
    const templates = [...sheet.querySelectorAll<HTMLElement>('[aria-label="Templates"] button')]
    expect(templates.length).toBeGreaterThan(0)
    // On a short screen the sheet's body is its scroll region, so each template is checked once scrolled to.
    for (const template of templates) {
      template.scrollIntoView({ block: 'nearest' })
      await settleLayout()
      expect(checkLayout(conditions, [template])).toEqual([])
    }
    await page.screenshot({ path: `.vitest/shots/home-${size.name}-new.png` })
    ;(sheet.querySelector('[data-kind="plain"]') as HTMLElement).click()
    await arrived()
    ;(document.querySelector('[role="radio"]:not([aria-checked="true"])') as HTMLElement).click()
    await settleLayout()
    const input = document.querySelector<HTMLElement>('input[type="file"]') as HTMLElement
    const box = input.getBoundingClientRect()
    expect(box.width).toBeGreaterThanOrEqual(targets.hit)
    expect(box.height).toBeGreaterThanOrEqual(targets.hit)
    expect(checkLayout(conditions, [])).toEqual([])
  })

  test('with many levels the cards scroll inside their region and the page and the shell stay put', async () => {
    await open(size, 24)
    const scroller = region('canvas').querySelector<HTMLElement>('[data-scroll-region]') as HTMLElement
    expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight)
    const first = cards()[0] as HTMLElement
    first.focus()
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }))
    await settleLayout()
    const last = cards().at(-1) as HTMLElement
    expect(last).toHaveFocus()
    const view = scroller.getBoundingClientRect()
    const box = last.getBoundingClientRect()
    expect(box.top, 'the focused card is scrolled into view').toBeGreaterThanOrEqual(view.top - 1)
    expect(box.bottom).toBeLessThanOrEqual(view.bottom + 1)
    expect(scroller.scrollTop).toBeGreaterThan(0)
    expect(region('canvas').scrollTop).toBe(0)
    expect(document.documentElement.scrollTop).toBe(0)
    expect(document.scrollingElement?.scrollHeight).toBeLessThanOrEqual(window.innerHeight)
  })
})

describe('rotation', () => {
  test('keeps the search text, the selection and the scroll region’s place', async () => {
    const [landscape, portrait] = [SIZES[0], SIZES[4]] as [EditorSize, EditorSize]
    await open(landscape, 24)
    const search = byTestId('home-search') as HTMLInputElement
    search.value = 'o'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    await settleLayout()
    ;(cards()[3] as HTMLElement).focus()
    await settleLayout()
    const scroller = region('canvas').querySelector<HTMLElement>('[data-scroll-region]') as HTMLElement
    scroller.scrollTop = 120
    const selected = (): number => cards().findIndex((card) => card.getAttribute('tabindex') === '0')
    const before = { scroller, selected: selected() }

    await page.viewport(portrait.width, portrait.height)
    await settleLayout()
    expect(document.querySelector('[data-editor-shell]')).toHaveAttribute('data-mode', 'medium')
    expect(region('canvas').querySelector('[data-scroll-region]')).toBe(before.scroller)
    expect((byTestId('home-search') as HTMLInputElement).value).toBe('o')
    expect(selected()).toBe(before.selected)
    expect(before.scroller.scrollTop).toBeGreaterThan(0)
  })
})
