import '@mcthaydt/automata-editor-kit/tokens.css'
import '@mcthaydt/automata-editor-kit/fonts.css'
import '../../main.css'
import { arrived, type EditorSize, REST, SIZES } from '@mcthaydt/automata-editor-kit/testing'
import { byTestId, checkLayout, publishConditions, settleLayout } from '@mcthaydt/automata-ui/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { printProject } from '../../model/project-codec'
import { memoryWorkspace } from '../../testing/memory-workspace'
import { hollowmere } from '../../testing/samples'
import { createTestClock } from '../../testing/test-clock'
import { type EditorHandle, startEditor } from '../boot'

// The World view with the production CSS in a real browser (plan ED2D.6b step 7; 2D editor spec §12), at the kit's
// eight window sizes in Chromium, WebKit and Firefox: the map fills the canvas and has drawn (or says why not), the
// layout switch, the level rows and the inspector's controls are at least 44 px and never clipped (below wide, from the
// Levels and Inspector drawers), and the page never scrolls. The editor starts as `main.ts` starts it, over a memory
// workspace with the Hollowmere sample (an RPG map set), and the rail opens World.

const PROJECT = 'hollowmere.af2d.json'

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
  await expect
    .poll(() => document.querySelector<HTMLElement>('[data-world-canvas]')?.dataset.state)
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

    await openDrawer(size, 'Levels', 'panel')
    const panel = region('panel')
    const layouts = [...panel.querySelectorAll<HTMLElement>('[role="radio"]')]
    expect(layouts.map((radio) => radio.textContent?.trim())).toEqual(['Free', 'Grid', 'Row', 'Column'])
    for (const radio of layouts) await expectTarget(radio, size)
    const rows = [...panel.querySelectorAll<HTMLElement>('ul[aria-label="Levels"] button')]
    expect(rows.length).toBeGreaterThan(1)
    for (const row of rows) await expectTarget(row, size)
    rows[0]?.click()
    await arrived()
    await closeDrawer(size, 'Levels', 'panel')

    await openDrawer(size, 'Inspector', 'inspector')
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
    noPageScroll()
    // The image shows the inspector as it opens, at its top, not where the checks above left it.
    inspectorScroll?.scrollTo(0, 0)
    await settleLayout()
    await page.screenshot({ path: `.vitest/shots/world-view-${size.name}.png` })
  })
})
