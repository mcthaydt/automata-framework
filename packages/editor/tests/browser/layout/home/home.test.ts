import '#src/shared/kit/tokens.css'
import '#src/shared/kit/fonts.css'
import '#src/app/editor-2d/main.css'
import { byTestId, checkLayout, publishConditions, settleLayout } from '@mcthaydt/automata/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { type EditorHandle, startEditor } from '#src/app/editor-2d/boot.ts'
import { printProject } from '#src/shared/level-2d/model/project-codec.ts'
import { arrived, type EditorSize, REST, SIZES } from '#src/testing/kit/layout-sizes.ts'
import { memoryWorkspace } from '#src/testing/level-2d/memory-workspace.ts'
import { hollowmere, mossgate } from '#src/testing/level-2d/samples.ts'
import { createTestClock } from '#src/testing/kit/test-clock.ts'

// Home with the production CSS in a real browser, at the window sizes the 2D editor is designed for. jsdom has no layout, so everything about room (overflow, target sizes, what covers what,
// which region scrolls) is only checked here. The editor is started the way `main.ts` starts it, with the real window
// and so the real geometry owner; only the workspace is a memory one, filled with projects.

const region = (name: string): HTMLElement => {
  const found = document.querySelector<HTMLElement>(`[data-region="${name}"]`)
  if (found === null) throw new Error(`no ${name} region`)
  return found
}
const cards = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('[role="option"]')]

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
  const conditions = publishConditions(document.documentElement, size, REST)
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

/** The controls a person must reach without scrolling: the search, and the buttons that open the drawers below `wide`. */
const essentials = (size: EditorSize): HTMLElement[] =>
  ['home-search', ...(size.mode === 'wide' ? [] : ['toggle-sources', 'toggle-details'])].map(byTestId)

describe.each(SIZES)('Home layout at $name ($width x $height)', (size) => {
  test('rest: no clipped, overlapping, small or unreachable controls, and the page never scrolls', async () => {
    const conditions = await open(size)
    expect(document.querySelector('[data-editor-shell]')).toHaveAttribute('data-mode', size.mode)
    expect(checkLayout(conditions, essentials(size))).toEqual([])
    await page.screenshot({ path: `.vitest/shots/home-${size.name}.png` })
  })

  test('the canvas has one scroll region, and it holds the projects and the templates', async () => {
    await open(size)
    const regions = region('canvas').querySelectorAll<HTMLElement>('[data-scroll-region]')
    expect(regions).toHaveLength(1)
    const scroller = regions[0] as HTMLElement
    expect(getComputedStyle(scroller).overflowY).toBe('auto')
    expect(getComputedStyle(scroller).touchAction).toBe('pan-y')
    expect(scroller).toContainElement(document.querySelector('[role="listbox"]'))
    expect(scroller).toContainElement(document.querySelector('[data-testid="home-search"]'))
    expect(scroller).toContainElement(document.querySelector('section.templates'))
  })

  test('a selected project’s actions are reachable, in the inspector or the drawer or sheet it opens', async () => {
    const conditions = await open(size)
    ;(cards()[1] as HTMLElement).click()
    await arrived()
    expect(region('inspector')).toHaveAttribute('data-open', 'true')
    expect(checkLayout(conditions, [byTestId('summary-open')])).toEqual([])
    const openButton = byTestId('summary-open').getBoundingClientRect()
    expect(openButton.height, 'Open is a primary action').toBeGreaterThanOrEqual(48)
    await page.screenshot({ path: `.vitest/shots/home-${size.name}-selected.png` })
  })

  test('the sources panel opens and Import is a full-size target', async () => {
    const conditions = await open(size)
    if (size.mode !== 'wide') {
      byTestId('toggle-sources').click()
      await arrived()
    }
    expect(region('panel')).toHaveAttribute('data-open', 'true')
    const input = region('panel').querySelector<HTMLElement>('input[type="file"]') as HTMLElement
    const box = input.getBoundingClientRect()
    expect(box.width).toBeGreaterThanOrEqual(44)
    expect(box.height).toBeGreaterThanOrEqual(44)
    expect(checkLayout(conditions, [])).toEqual([])
  })

  test('with many projects the list scrolls inside its region and the page and the shell stay put', async () => {
    await open(size, 24)
    const scroller = region('canvas').querySelector<HTMLElement>('[data-scroll-region]') as HTMLElement
    expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight)
    const list = document.querySelector<HTMLElement>('[role="listbox"]') as HTMLElement
    list.focus()
    list.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }))
    await settleLayout()
    const last = cards().at(-1) as HTMLElement
    expect(last).toHaveAttribute('aria-selected', 'true')
    const view = scroller.getBoundingClientRect()
    const box = last.getBoundingClientRect()
    expect(box.top, 'the selected card is scrolled into view').toBeGreaterThanOrEqual(view.top - 1)
    expect(box.bottom).toBeLessThanOrEqual(view.bottom + 1)
    expect(scroller.scrollTop).toBeGreaterThan(0)
    // The shell's own canvas and the document must not have been dragged along by scrollIntoView.
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
    ;(cards()[3] as HTMLElement).click()
    await settleLayout()
    const scroller = region('canvas').querySelector<HTMLElement>('[data-scroll-region]') as HTMLElement
    scroller.scrollTop = 120
    const before = {
      scroller,
      selected: cards().findIndex((card) => card.getAttribute('aria-selected') === 'true'),
    }

    await page.viewport(portrait.width, portrait.height)
    await settleLayout()
    expect(document.querySelector('[data-editor-shell]')).toHaveAttribute('data-mode', 'medium')
    expect(region('canvas').querySelector('[data-scroll-region]')).toBe(before.scroller)
    expect((byTestId('home-search') as HTMLInputElement).value).toBe('o')
    expect(cards().findIndex((card) => card.getAttribute('aria-selected') === 'true')).toBe(before.selected)
    expect(before.scroller.scrollTop).toBeGreaterThan(0)
  })
})
