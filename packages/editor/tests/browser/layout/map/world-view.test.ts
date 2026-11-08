import '#src/shared/kit/tokens.css'
import '#src/shared/kit/fonts.css'
import '#src/app/editor-2d/main.css'
import { byTestId, checkLayout, publishConditions, settleLayout } from '@mcthaydt/automata/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { type EditorHandle, startEditor } from '#src/app/editor-2d/boot.ts'
import { printProject } from '#src/shared/level-2d/model/project-codec.ts'
import { uncoveredArea } from '#src/shared/level-2d/model/world/world-model.ts'
import { arrived, type EditorSize, REST, SIZES } from '#src/testing/kit/layout-sizes.ts'
import { createTestClock } from '#src/testing/kit/test-clock.ts'
import { memoryWorkspace } from '#src/testing/level-2d/memory-workspace.ts'
import { hollowmere } from '#src/testing/level-2d/samples.ts'

// The World view with the production CSS in a real browser, at the kit's
// eight window sizes in Chromium, WebKit and Firefox: the map fills the canvas and has drawn (or says why not), the
// layout switch, the level rows and the inspector's controls are at least 44 px and never clipped (below wide, from the
// Levels and Inspector drawers), and the page never scrolls. The editor starts as `main.ts` starts it, over a memory
// workspace with the Hollowmere sample (an RPG map set), and the rail opens World.

const PROJECT = 'hollowmere.af2d.json'
const DRAW_TIMEOUT_MS = 30_000

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
  await workspace.store.write(PROJECT, printProject(hollowmere()))
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
  ].find((candidate) => candidate.textContent?.trim() === 'World')
  if (tab === undefined) throw new Error('no World tab')
  tab.click()
  await expect.poll(() => document.querySelector('[data-testid="world-view"]')).not.toBeNull()
  // The first draw in a cold browser can take longer than the default poll on a loaded runner.
  await expect
    .poll(() => document.querySelector<HTMLElement>('[data-world-canvas]')?.dataset.state, {
      timeout: DRAW_TIMEOUT_MS,
    })
    .toMatch(/^(drawn|unavailable)$/)
  await arrived()
  return { conditions }
}

const view = (): HTMLElement => byTestId('world-view')
const region = (name: string): HTMLElement => {
  const found = view().querySelector<HTMLElement>(`[data-region="${name}"]`)
  if (found === null) throw new Error(`no ${name} region`)
  return found
}
const buttonNamed = (root: ParentNode, name: string): HTMLElement => {
  const found = [...root.querySelectorAll<HTMLElement>('button')].find(
    (candidate) => candidate.textContent?.trim() === name,
  )
  if (found === undefined) throw new Error(`no ${name} button`)
  return found
}

/** Below wide, presses the map's drawer button until its region says it is open. */
async function openDrawer(size: EditorSize, name: 'Levels' | 'Inspector', regionName: string): Promise<void> {
  if (size.mode === 'wide' || region(regionName).dataset.open === 'true') return
  buttonNamed(view(), name).click()
  await arrived()
  expect(region(regionName).dataset.open).toBe('true')
}

async function closeDrawer(
  size: EditorSize,
  name: 'Levels' | 'Inspector',
  regionName: string,
): Promise<void> {
  if (size.mode === 'wide' || region(regionName).dataset.open !== 'true') return
  buttonNamed(view(), name).click()
  await arrived()
}

/** Scrolls an element into its scroll region, as a person would, and checks it is a full-size target in the window. */
async function expectTarget(control: HTMLElement, size: EditorSize): Promise<void> {
  control.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  await settleLayout()
  const box = control.getBoundingClientRect()
  expect(box.width).toBeGreaterThanOrEqual(44)
  expect(box.height).toBeGreaterThanOrEqual(44)
  expect(box.left).toBeGreaterThanOrEqual(-0.5)
  expect(box.top).toBeGreaterThanOrEqual(-0.5)
  expect(box.right).toBeLessThanOrEqual(size.width + 0.5)
  expect(box.bottom).toBeLessThanOrEqual(size.height + 0.5)
}

function noPageScroll(): void {
  expect(document.documentElement.scrollLeft).toBe(0)
  expect(document.documentElement.scrollTop).toBe(0)
}

describe.each(SIZES)('World view at $name ($width x $height)', (size) => {
  test('the map fills the canvas; the panel and inspector controls are full-size; the page never scrolls', async () => {
    const { conditions } = await start(size)
    const tabs = [
      ...document.querySelectorAll<HTMLElement>('[role="tablist"][aria-label="Views"] [role="tab"]'),
    ]
    const drawers =
      size.mode === 'wide' ? [] : ['Levels', 'Inspector'].map((name) => buttonNamed(view(), name))
    expect(checkLayout(conditions, [...tabs, ...drawers])).toEqual([])
    // The map fills the canvas below any drawer buttons, and the levels sit in the middle of it: the camera is fitted
    // to the box the map really has (review of #310: in wide the map took only its content's height).
    const mapElement = byTestId('world-map')
    const map = mapElement.getBoundingClientRect()
    const canvasRegion = region('canvas').getBoundingClientRect()
    expect(map.width).toBeGreaterThan(100)
    expect(map.bottom).toBeGreaterThanOrEqual(canvasRegion.bottom - 1)
    const [top, bottom] = (mapElement.dataset.levelsBox ?? '').split(',').map(Number)
    expect(top).toBeGreaterThan(0)
    expect(Math.abs((top ?? 0) - (map.height - (bottom ?? 0)))).toBeLessThanOrEqual(1.5)
    // And every level is inside the map across: the camera fits the real box, not the first one the page reported.
    const [left, right] = (mapElement.dataset.levelsSpan ?? '').split(',').map(Number)
    expect(left).toBeGreaterThanOrEqual(0)
    expect(right).toBeLessThanOrEqual(map.width + 0.5)
    // Fit sits over the map, a full-size target in view.
    await expectTarget(buttonNamed(view(), 'Fit'), size)

    await openDrawer(size, 'Levels', 'panel')
    const panel = region('panel')
    const layouts = [...panel.querySelectorAll<HTMLElement>('[role="radio"]')]
    expect(layouts.map((radio) => radio.textContent?.trim())).toEqual(['Free', 'Grid', 'Row', 'Column'])
    for (const radio of layouts) await expectTarget(radio, size)
    const rows = [...panel.querySelectorAll<HTMLElement>('ul[aria-label="Levels"] button')]
    expect(rows.length).toBeGreaterThan(1)
    for (const row of rows) await expectTarget(row, size)
    await expectTarget(buttonNamed(panel, 'Add level'), size)
    rows[0]?.click()
    await arrived()
    await closeDrawer(size, 'Levels', 'panel')

    await openDrawer(size, 'Inspector', 'inspector')
    if (size.mode !== 'wide') {
      // With the inspector open the levels fit the part of the map it leaves uncovered, and Fit is still a full-size
      // target in view (review of #328; plan ED2D.8b decision 2).
      await arrived()
      await settleLayout()
      const mapBox = byTestId('world-map').getBoundingClientRect()
      const boxOf = (rect: DOMRect) => ({ x: rect.left, y: rect.top, w: rect.width, h: rect.height })
      const area = uncoveredArea(boxOf(mapBox), [boxOf(region('inspector').getBoundingClientRect())])
      const [levelsTop, levelsBottom] = (byTestId('world-map').dataset.levelsBox ?? '').split(',').map(Number)
      const [levelsLeft, levelsRight] = (byTestId('world-map').dataset.levelsSpan ?? '')
        .split(',')
        .map(Number)
      expect(levelsLeft).toBeGreaterThanOrEqual(area.x - 0.5)
      expect(levelsRight).toBeLessThanOrEqual(area.x + area.w + 0.5)
      expect(levelsTop).toBeGreaterThanOrEqual(area.y - 0.5)
      expect(levelsBottom).toBeLessThanOrEqual(area.y + area.h + 0.5)
      await expectTarget(buttonNamed(view(), 'Fit'), size)
      const fit = buttonNamed(view(), 'Fit').getBoundingClientRect()
      const cover = region('inspector').getBoundingClientRect()
      const hidden =
        fit.left < cover.right && fit.right > cover.left && fit.top < cover.bottom && fit.bottom > cover.top
      expect(hidden).toBe(false)
    }
    // The inspector opens at its top (Name first); the checks below scroll it to reach each control.
    const inspectorScroll = region('inspector').querySelector<HTMLElement>('[data-scroll-region]')
    expect(inspectorScroll?.scrollTop ?? 0).toBe(0)
    const inspector = byTestId('world-inspector')
    const name = inspector.querySelector<HTMLElement>('input[type="text"]')
    if (name === null) throw new Error('no name field')
    await expectTarget(name, size)
    for (const spin of inspector.querySelectorAll<HTMLElement>('[role="spinbutton"]'))
      await expectTarget(spin, size)
    for (const radio of inspector.querySelectorAll<HTMLElement>('[role="radio"]'))
      await expectTarget(radio, size)
    await expectTarget(buttonNamed(inspector, 'Resize'), size)
    await expectTarget(buttonNamed(inspector, 'Duplicate'), size)
    await expectTarget(buttonNamed(inspector, 'Remove'), size)
    noPageScroll()
    // The image shows the inspector as it opens, at its top, not where the checks above left it.
    inspectorScroll?.scrollTo(0, 0)
    await settleLayout()
    await page.screenshot({ path: `.vitest/shots/world-view-${size.name}.png` })
  })
})
