import '#src/shared/kit/tokens.css'
import '#src/shared/kit/fonts.css'
import '#src/app/editor-2d/main.css'
import { byTestId, checkLayout, publishConditions, settleLayout } from '@mcthaydt/automata/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { type EditorHandle, startEditor } from '#src/app/editor-2d/boot.ts'
import { printProject } from '#src/shared/level-2d/model/project-codec.ts'
import { arrived, type EditorSize, REST, SIZES } from '#src/testing/kit/layout-sizes.ts'
import { createTestClock } from '#src/testing/kit/test-clock.ts'
import { memoryWorkspace } from '#src/testing/level-2d/memory-workspace.ts'
import { mossgate } from '#src/testing/level-2d/samples.ts'
import { switcherControls } from '#src/testing/level-2d/view-switcher.ts'

// The Level view with the production CSS in a real browser, at the eight
// window sizes of Home's layout test, in Chromium, WebKit and Firefox: every control at least 44 px and never clipped,
// the top bar, the rail and (below wide) the Layers button reachable without scrolling, the canvas given real room and
// the page never scrolling, the layers reachable, and a rotation that keeps the chosen layer and tool. The editor
// starts as `main.ts` starts it, over a memory workspace with the Mossgate sample. ED2D.4c4b (step 8) adds the
// inspector and the dock: 320 px and 148 px in `wide`, drawers and sheets below it, Levels in the toolbar wherever the
// dock is a sheet, and the short height keeping the tools, Undo, Layers and Export in view.

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
  const card = document.querySelector<HTMLElement>('[aria-label="Levels"] .open')
  if (card === null) throw new Error('no level card')
  card.click()
  await expect.poll(() => document.querySelector('[data-testid="level-view"]')).not.toBeNull()
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

/** Opens the layer panel below wide, where it is a drawer or a sheet. */
async function showLayers(size: EditorSize): Promise<void> {
  if (size.mode === 'wide') return
  buttonNamed(byTestId('level-toolbar'), 'Layers').click()
  await arrived()
}

describe.each(SIZES)('Level view at $name ($width x $height)', (size) => {
  test('every control is sized and unclipped; the top bar, its view switcher and Layers are reachable', async () => {
    const { conditions } = await start(size)
    const bar = byTestId('document-bar')
    const tabs = switcherControls()
    // A phone has the switcher's menu button, named after the open view; wider screens the four views.
    expect(tabs.map((tab) => tab.textContent?.trim())).toEqual(
      size.mode === 'compact' ? ['Level'] : ['Level', 'Map', 'Tiles', 'Characters'],
    )
    const essentials = [buttonNamed(bar, 'Back'), ...['undo', 'redo', 'save'].map(byTestId), ...tabs]
    if (size.mode !== 'wide') essentials.push(buttonNamed(byTestId('level-toolbar'), 'Layers'))
    expect(checkLayout(conditions, essentials)).toEqual([])
    for (const tab of tabs) expectInside(tab, size)
    await page.screenshot({ path: `.vitest/shots/level-view-${size.name}.png` })
  })

  test('the canvas has real room and the page never scrolls', async () => {
    await start(size)
    const surface = byTestId('level-surface').getBoundingClientRect()
    // A third of the window, except a narrow `wide` window: there the rail, the 264 px panel and the 320 px inspector
    // (§12's reference layout) leave 260 px at 900 x 600, which still draws and edits.
    expect(surface.width).toBeGreaterThan(size.mode === 'wide' && size.width < 1000 ? 240 : size.width / 3)
    expect(surface.height).toBeGreaterThan(size.mode === 'compact' && size.height < 500 ? 80 : 200)
    expect(document.documentElement.scrollLeft).toBe(0)
    expect(document.documentElement.scrollTop).toBe(0)
  })

  test('the layers and the palette are reachable, and their rows are full-size targets', async () => {
    const { conditions } = await start(size)
    await showLayers(size)
    const list = document.querySelector<HTMLElement>('[role="listbox"][aria-label="Layers"]')
    if (list === null) throw new Error('no layer list')
    const rows = [...list.querySelectorAll<HTMLElement>('[role="option"]')]
    expect(rows.length).toBeGreaterThan(2)
    const first = rows[0] as HTMLElement
    expectInside(first, size)
    for (const control of first.querySelectorAll('button'))
      expect(control.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
    expect(checkLayout(conditions, [])).toEqual([])
    await page.screenshot({ path: `.vitest/shots/level-layers-${size.name}.png` })
  })
})

const region = (name: string): HTMLElement => {
  const found = byTestId('level-view').querySelector<HTMLElement>(`[data-region="${name}"]`)
  if (found === null) throw new Error(`no ${name} region`)
  return found
}

/** Presses a toolbar button until its region says it is open (a medium dock starts open as a strip). */
async function openFromToolbar(name: string, regionName: string): Promise<void> {
  if (region(regionName).dataset.open === 'true') return
  buttonNamed(byTestId('level-toolbar'), name).click()
  await arrived()
  expect(region(regionName).dataset.open).toBe('true')
}

describe.each(SIZES)('Level view inspector and dock at $name ($width x $height)', (size) => {
  const sheetDock = size.mode !== 'wide' || size.height < 700

  test('the inspector is a 320 px column in wide and opens from the toolbar below it', async () => {
    const { conditions } = await start(size)
    const toolbar = byTestId('level-toolbar')
    if (size.mode === 'wide') {
      expect(region('inspector').getBoundingClientRect().width).toBeCloseTo(320, 0)
      expect([...toolbar.querySelectorAll('button')].some((b) => b.textContent?.trim() === 'Inspector')).toBe(
        false,
      )
    } else {
      await openFromToolbar('Inspector', 'inspector')
    }
    const tablist = region('inspector').querySelector<HTMLElement>('[role="tablist"][aria-label="Inspector"]')
    if (tablist === null) throw new Error('no inspector tabs')
    const tabs = [...tablist.querySelectorAll<HTMLElement>('[role="tab"]')]
    expect(tabs.map((tab) => tab.textContent?.trim())).toEqual(['Entity', 'Level', 'Checks'])
    for (const tab of tabs) expectInside(tab, size)
    expect(checkLayout(conditions, tabs)).toEqual([])
    await page.screenshot({ path: `.vitest/shots/level-inspector-${size.name}.png` })
  })

  test('the dock is a 148 px strip under the canvas in wide, and a sheet behind Levels otherwise', async () => {
    const { conditions } = await start(size)
    const toolbar = byTestId('level-toolbar')
    const hasLevels = [...toolbar.querySelectorAll('button')].some((b) => b.textContent?.trim() === 'Levels')
    expect(hasLevels).toBe(sheetDock)
    if (sheetDock) {
      await openFromToolbar('Levels', 'dock')
    } else {
      const dock = region('dock')
      expect(dock.dataset.presentation).toBe('inline')
      expect(dock.getBoundingClientRect().height).toBeCloseTo(148, 0)
      expect(dock.getBoundingClientRect().top).toBeGreaterThanOrEqual(
        byTestId('level-surface').getBoundingClientRect().bottom - 0.5,
      )
    }
    const cards = [...byTestId('level-dock').querySelectorAll<HTMLElement>('button')]
    expect(cards.length).toBeGreaterThan(0)
    expectInside(cards[0] as HTMLElement, size)
    expect(checkLayout(conditions, cards.slice(0, 1))).toEqual([])
    await page.screenshot({ path: `.vitest/shots/level-dock-${size.name}.png` })
  })

  test('the tools, Undo, Layers, the view switcher and Save stay in view', async () => {
    const { conditions } = await start(size)
    const toolbar = byTestId('level-toolbar')
    const tools = [...toolbar.querySelectorAll<HTMLElement>('[role="radiogroup"] [role="radio"]')]
    expect(tools.length).toBe(6)
    const essentials = [tools[0] as HTMLElement, byTestId('undo'), byTestId('save'), ...switcherControls()]
    if (size.mode !== 'wide') essentials.push(buttonNamed(toolbar, 'Layers'))
    for (const control of essentials) expectInside(control, size)
    // The toolbar is a declared sideways scroll region (it scrolls rather than squeeze a label), so a narrow canvas
    // reaches the later tools by scrolling the row: each one comes fully into view without the page moving.
    expect(toolbar.dataset.scrollRegion).toBe('both')
    for (const tool of tools) {
      tool.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      await settleLayout()
      expectInside(tool, size)
      const row = toolbar.getBoundingClientRect()
      const box = tool.getBoundingClientRect()
      expect(box.left).toBeGreaterThanOrEqual(row.left - 0.5)
      expect(box.right).toBeLessThanOrEqual(row.right + 0.5)
    }
    expect(document.documentElement.scrollLeft).toBe(0)
    expect(document.documentElement.scrollTop).toBe(0)
    toolbar.scrollLeft = 0
    await settleLayout()
    expect(checkLayout(conditions, essentials)).toEqual([])
  })
})

// macOS draws an overlay scroll bar over a sideways-scrolling row's bottom edge once it scrolls, and WebKit there
// hit-tests it (about 15 px), so a tool laid out to the row's padding edge loses its lower taps (#272: Mac WebKit,
// 900 x 600 and 390 x 844; the same class as #265). Linux browsers lay overlay bars out of the hit test, so the rule is
// held here as a measure.
describe('Level view tool row', () => {
  test("keeps its tools clear of an overlay scroll bar's 15 px along its bottom edge", async () => {
    await start(SIZES.find((size) => size.name === 'phone-portrait') as EditorSize)
    const toolbar = document.querySelector<HTMLElement>('[data-testid="level-toolbar"]') as HTMLElement
    expect(Number.parseFloat(getComputedStyle(toolbar).paddingBottom)).toBeGreaterThanOrEqual(16)
  })
})

describe('Level view rotation', () => {
  test('1194 x 834 to 834 x 1194 keeps the chosen layer and tool and remounts nothing', async () => {
    const [landscape, portrait] = [SIZES[0], SIZES[4]] as [EditorSize, EditorSize]
    await start(landscape)
    const list = document.querySelector<HTMLElement>('[role="listbox"][aria-label="Layers"]') as HTMLElement
    const rows = [...list.querySelectorAll<HTMLElement>('[role="option"]')]
    const last = rows[rows.length - 1] as HTMLElement
    ;(last.querySelector('button') as HTMLElement).click()
    const fill = [...document.querySelectorAll<HTMLElement>('[role="radio"]')].find(
      (option) => option.textContent?.trim() === 'Fill',
    ) as HTMLElement
    fill.click()
    await arrived()
    const surface = byTestId('level-surface')

    await page.viewport(portrait.width, portrait.height)
    publishConditions(document.documentElement, portrait, REST)
    await settleLayout()
    await arrived()
    expect(byTestId('level-surface'), 'the canvas was not remounted').toBe(surface)
    expect(last.getAttribute('aria-selected')).toBe('true')
    expect(fill.getAttribute('aria-checked')).toBe('true')
  })
})
