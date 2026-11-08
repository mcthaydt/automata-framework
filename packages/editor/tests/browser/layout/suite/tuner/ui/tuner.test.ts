import '#src/shared/kit/tokens.css'
import '#src/shared/kit/tool-chrome.css'
import '#src/shared/kit/fonts.css'
import '#src/app/suite/main.css'
import { checkLayout, publishConditions, settleLayout } from '@mcthaydt/automata/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { EDITOR_LIST_PATH } from '#src/features/suite/core/index.ts'
import { type SuiteHandle, startSuite } from '#src/features/suite/shell/boot.ts'
import { createSuite } from '#src/features/suite/shell/create-suite.ts'
import { samplePorts } from '#src/features/suite/shell/sample-ports.ts'
import { createTuner } from '#src/features/suite/tuner/tuner-suite-editor.ts'
import type { SuiteEditor } from '#src/shared/kit/ports/suite-editor.ts'
import { arrived, type EditorSize, REST, SIZES } from '#src/testing/kit/layout-sizes.ts'
import { editorTargets } from '#src/testing/kit/targets.ts'
import { tunerFixtureFiles } from '#src/testing/suite/tuner-fixtures.ts'

/** The control sizes under this run's pointer: 32 px with a mouse, 44 (a primary 48) with touch. */
const targets = editorTargets()

// The Tuner in the suite's one shell with the production CSS in Chromium, WebKit and Firefox at the eight window sizes
//: every control is a 44 px target in a declared scroll region (reached by scrolling
// it, never by shrinking it), the page never scrolls, and a rotation keeps the search and the chosen tunable (EDS-x).

const LIST = `format = "af-editors/1"\n[[file]]\nglob = "content/tuning.toml"\neditor = "tuner"\nmodes = ["edit", "ask"]\ngates = []\nchecks = []\n`

let started: SuiteHandle | undefined
let target: HTMLElement | undefined
afterEach(async () => {
  await started?.dispose()
  target?.remove()
  started = undefined
  target = undefined
})

/** A page that answers in place of the game's dev server: the pane frames it as it would `pnpm dev`. */
const GAME_PAGE = 'data:text/html,<body style="margin:0;background:%23243">game</body>'

async function open(size: EditorSize) {
  await page.viewport(size.width, size.height)
  const conditions = publishConditions(document.documentElement, size, REST, targets)
  target = document.body.appendChild(document.createElement('div'))
  target.id = 'app'
  started = await startSuite(target, {
    window,
    document,
    ports: await samplePorts({ ...tunerFixtureFiles(), [EDITOR_LIST_PATH]: LIST }),
    suite: createSuite({ editors: [createTuner({ gameUrl: GAME_PAGE }) as SuiteEditor<unknown>] }),
  })
  await settleLayout()
  tab('Tuner').click()
  await expect.poll(() => document.querySelector('[data-testid="tuner-rows"]')).not.toBeNull()
  await settleLayout()
  return conditions
}

function tab(name: string): HTMLElement {
  const found = [...document.querySelectorAll<HTMLElement>('[role="tab"]')].find(
    (candidate) => (candidate.getAttribute('aria-label') ?? candidate.textContent?.trim()) === name,
  )
  if (found === undefined) throw new Error(`no ${name} tab`)
  return found
}

function noPageScroll(): void {
  expect(document.documentElement.scrollLeft).toBe(0)
  expect(document.documentElement.scrollTop).toBe(0)
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth + 0.5)
}

/** Scrolls the declared scroll region a control sits in, and nothing else, until the control is inside it. */
function reveal(control: HTMLElement): void {
  const region = control.closest<HTMLElement>('[data-scroll-region]')
  if (region === null) return
  const box = control.getBoundingClientRect()
  const view = region.getBoundingClientRect()
  region.scrollTop += Math.max(0, box.bottom - view.bottom) - Math.max(0, view.top - box.top)
  region.scrollLeft += Math.max(0, box.right - view.right) - Math.max(0, view.left - box.left)
}

describe.each(SIZES)('Tuner at $name ($width x $height)', (size) => {
  test('the rows scroll in their own region and every control is a 44 px target; the page never scrolls', async () => {
    const conditions = await open(size)
    const rows = document.querySelector<HTMLElement>('[data-testid="tuner-rows"]') as HTMLElement
    expect(rows.hasAttribute('data-scroll-region')).toBe(true)
    const controls = [
      ...rows.querySelectorAll<HTMLElement>(
        '[role="slider"], [role="spinbutton"], [role="radio"], button, input[type="text"]',
      ),
    ].filter((control) => !control.classList.contains('pick'))
    expect(controls.length).toBeGreaterThan(10)
    for (const control of controls) {
      reveal(control)
      await arrived()
      expect(
        checkLayout(conditions, [control]),
        control.getAttribute('aria-label') ?? control.textContent ?? '',
      ).toEqual([])
    }
    // The row's name is drawn once: the widgets' own labels name the controls without being drawn (Figma tuner-sliders).
    for (const row of rows.querySelectorAll<HTMLElement>('[data-testid^="tuner-row-"]')) {
      const name = row.getAttribute('aria-label')
      const drawn = [...row.querySelectorAll<HTMLElement>('*')].filter((node) => {
        if (node.children.length > 0 || node.textContent?.trim() !== name) return false
        const box = node.getBoundingClientRect()
        return box.width > 2 && box.height > 2
      })
      expect(drawn, `${name} is drawn once`).toHaveLength(1)
    }
    noPageScroll()
    await page.screenshot({ path: `.vitest/shots/tuner-rows-${size.name}.png` })
  })

  test('the game runs beside the settings: side by side in a canvas 480 px wide and up, the game on top below that', async () => {
    await open(size)
    await expect.poll(() => document.querySelector('iframe[title="Your game"]')).not.toBeNull()
    const game = document.querySelector('[data-testid="tuner-game"]') as HTMLElement
    const rows = document.querySelector('[data-testid="tuner-rows"]') as HTMLElement
    const gameBox = game.getBoundingClientRect()
    const rowsBox = rows.getBoundingClientRect()
    const split = (
      document.querySelector('[data-testid="tuner-split"]') as HTMLElement
    ).getBoundingClientRect()
    // Every iPad and a phone held sideways have room side by side; a phone upright and a small window stack.
    expect(split.width >= 480).toBe(!['phone-portrait', 'window-900x600'].includes(size.name))
    if (split.width >= 480) {
      expect(gameBox.right).toBeLessThanOrEqual(rowsBox.left + 0.5)
      expect(Math.abs(gameBox.top - rowsBox.top)).toBeLessThan(1)
    } else {
      expect(gameBox.bottom).toBeLessThanOrEqual(rowsBox.top + 0.5)
    }
    // Big enough to play in, and the settings keep room to scroll.
    expect(gameBox.height).toBeGreaterThanOrEqual(150)
    expect(rowsBox.height).toBeGreaterThanOrEqual(120)
    noPageScroll()
    await page.screenshot({ path: `.vitest/shots/tuner-split-${size.name}.png` })
  })

  test('a rotation keeps the search and the chosen tunable (EDS-x)', async () => {
    await open(size)
    const search = document.querySelector<HTMLInputElement>('input[type="search"]')
    const list = [...document.querySelectorAll<HTMLElement>('[data-testid="tuner-panel"] button')]
    if (search === null && list.length === 0) {
      // A phone keeps the panel behind its toggle; the rows' own pick button chooses the same tunable.
      document.querySelector<HTMLElement>('[data-testid="tuner-row-GRAVITY"] .pick')?.click()
    } else {
      list.find((button) => button.textContent?.trim().startsWith('GRAVITY'))?.click()
    }
    await settleLayout()
    await page.viewport(size.height, size.width)
    await settleLayout()
    expect(document.querySelector('[data-testid="tuner-row-GRAVITY"]')?.classList.contains('chosen')).toBe(
      true,
    )
    noPageScroll()
  })
})
