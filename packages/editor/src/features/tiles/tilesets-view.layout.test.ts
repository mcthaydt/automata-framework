import '../../shared/kit/tokens.css'
import '../../shared/kit/fonts.css'
import '../../app/editor-2d/main.css'
import { byTestId, checkLayout, publishConditions, settleLayout } from '@mcthaydt/automata/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { type EditorHandle, startEditor } from '../../app/editor-2d/boot'
import { printProject } from '../../shared/level-2d/model/project-codec'
import { arrived, type EditorSize, REST, SIZES } from '../../testing/kit/layout-sizes.ts'
import { memoryWorkspace } from '../../testing/level-2d/memory-workspace'
import { mossgate } from '../../testing/level-2d/samples'
import { createTestClock } from '../../testing/level-2d/test-clock'

// The Tilesets view with the production CSS in a real browser (plan ED2D.5b step 8; 2D editor spec §12), at the kit's
// eight window sizes in Chromium, WebKit and Firefox: every control at least 44 px and never clipped, the page never
// scrolling, the 44 px pattern cells and the inspector's Duplicate and Delete reachable, and the rule strip's rows
// full-size targets inside the window (below wide, from the Rules and Inspector drawers). The editor starts as
// `main.ts` starts it, over a memory workspace with the Mossgate sample, and the rail opens Tilesets.

const PROJECT = 'mossgate.af2d.json'

let started: EditorHandle | undefined
let target: HTMLElement | undefined
afterEach(async () => {
  await started?.dispose()
  target?.remove()
  started = undefined
  target = undefined
})

async function start(size: EditorSize) {
  await page.viewport(size.width, size.height)
  const conditions = publishConditions(document.documentElement, size, REST)
  const clock = createTestClock()
  const workspace = memoryWorkspace(clock)
  await workspace.store.write(PROJECT, printProject(mossgate()))
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
  const card = document.querySelector<HTMLElement>('[role="option"]')
  if (card === null) throw new Error('no project card')
  card.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
  await expect.poll(() => document.querySelector('[data-testid="level-view"]')).not.toBeNull()
  const tab = [
    ...document.querySelectorAll<HTMLElement>('[role="tablist"][aria-label="Views"] [role="tab"]'),
  ].find((candidate) => candidate.textContent?.trim() === 'Tilesets')
  if (tab === undefined) throw new Error('no Tilesets tab')
  tab.click()
  await expect.poll(() => document.querySelector('[data-testid="tilesets-view"]')).not.toBeNull()
  await arrived()
  return { conditions }
}

const buttonNamed = (root: ParentNode, name: string): HTMLElement => {
  const found = [...root.querySelectorAll<HTMLElement>('button')].find(
    (candidate) => candidate.textContent?.trim() === name,
  )
  if (found === undefined) throw new Error(`no ${name} button`)
  return found
}

function expectInside(element: Element, size: EditorSize): void {
  const box = element.getBoundingClientRect()
  expect(box.left).toBeGreaterThanOrEqual(-0.5)
  expect(box.top).toBeGreaterThanOrEqual(-0.5)
  expect(box.right).toBeLessThanOrEqual(size.width + 0.5)
  expect(box.bottom).toBeLessThanOrEqual(size.height + 0.5)
}

const region = (name: string): HTMLElement => {
  const found = byTestId('tilesets-view').querySelector<HTMLElement>(`[data-region="${name}"]`)
  if (found === null) throw new Error(`no ${name} region`)
  return found
}

/** Below wide, presses the canvas's drawer button until its region says it is open. */
async function openDrawer(size: EditorSize, name: 'Rules' | 'Inspector', regionName: string): Promise<void> {
  if (size.mode === 'wide' || region(regionName).dataset.open === 'true') return
  buttonNamed(byTestId('tilesets-view'), name).click()
  await arrived()
  expect(region(regionName).dataset.open).toBe('true')
}

/** Scrolls an element into its scroll region, as a person would, and waits for the layout. */
async function reach(element: HTMLElement): Promise<void> {
  element.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  await settleLayout()
}

describe.each(SIZES)('Tilesets view at $name ($width x $height)', (size) => {
  test('every control is sized and unclipped, and the page never scrolls', async () => {
    const { conditions } = await start(size)
    const tabs = [
      ...document.querySelectorAll<HTMLElement>('[role="tablist"][aria-label="Views"] [role="tab"]'),
    ]
    const essentials = [...['undo', 'redo', 'save'].map(byTestId), ...tabs]
    if (size.mode !== 'wide') essentials.push(buttonNamed(byTestId('tilesets-view'), 'Rules'))
    expect(checkLayout(conditions, essentials)).toEqual([])
    expect(document.documentElement.scrollLeft).toBe(0)
    expect(document.documentElement.scrollTop).toBe(0)
    await page.screenshot({ path: `.vitest/shots/tilesets-view-${size.name}.png` })
  })

  test('the pattern cells are 44 px and Duplicate and Delete are reachable', async () => {
    const { conditions } = await start(size)
    await openDrawer(size, 'Inspector', 'inspector')
    const cells = [...byTestId('pattern-editor').querySelectorAll<HTMLElement>('button')]
    expect(cells.length).toBeGreaterThan(0)
    for (const cell of cells) {
      const box = cell.getBoundingClientRect()
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.height).toBeGreaterThanOrEqual(44)
    }
    const inspector = byTestId('tilesets-inspector')
    for (const name of ['Duplicate', 'Delete']) {
      const button = buttonNamed(inspector, name)
      await reach(button)
      expectInside(button, size)
    }
    expect(checkLayout(conditions, [])).toEqual([])
    await page.screenshot({ path: `.vitest/shots/tilesets-inspector-${size.name}.png` })
  })

  test('the rule strip’s rows and grips are full-size targets inside the window', async () => {
    const { conditions } = await start(size)
    await openDrawer(size, 'Rules', 'panel')
    const strip = byTestId('tilesets-panel').querySelector<HTMLElement>('[aria-label="Rules"]')
    if (strip === null) throw new Error('no rule strip')
    const rows = [...strip.querySelectorAll<HTMLElement>('li')]
    expect(rows.length).toBeGreaterThan(1)
    const last = rows.at(-1) as HTMLElement
    await reach(last)
    expectInside(last, size)
    for (const control of last.querySelectorAll('button')) {
      expect(control.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
      expect(control.getBoundingClientRect().width).toBeGreaterThanOrEqual(44)
    }
    expect(checkLayout(conditions, [])).toEqual([])
    await page.screenshot({ path: `.vitest/shots/tilesets-rules-${size.name}.png` })
  })
})
