import '#src/shared/kit/tokens.css'
import '#src/shared/kit/tool-chrome.css'
import '#src/shared/kit/fonts.css'
import '#src/app/level-2d/main.css'
import { byTestId, checkLayout, publishConditions, settleLayout } from '@automata/framework/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { printProject } from '#src/shared/level-2d/model/project-codec.ts'
import { arrived, type EditorSize, REST, SIZES } from '#src/testing/kit/layout-sizes.ts'
import { editorTargets } from '#src/testing/kit/targets.ts'
import { createTestClock } from '#src/testing/kit/test-clock.ts'
import { memoryWorkspace } from '#src/testing/level-2d/memory-workspace.ts'
import { type OpenLevelScreen, openLevelScreen } from '#src/testing/level-2d/open-level-screen.ts'
import { mossgate } from '#src/testing/level-2d/samples.ts'
import { switcherControls } from '#src/testing/level-2d/view-switcher.ts'

/** The control sizes under this run's pointer: 32 px with a mouse, 44 (a primary 48) with touch. */
const targets = editorTargets()

// The Level view with the production CSS in a real browser, at the eight
// window sizes of Home's layout test, in Chromium, WebKit and Firefox: every control at least 44 px and never clipped,
// the top bar, the rail and (below wide) the Layers button reachable without scrolling, the canvas given real room and
// the page never scrolling, the layers reachable, and a rotation that keeps the chosen layer and tool. The editor
// starts as `main.ts` starts it, over a memory workspace with the Mossgate sample. The inspector is a 320 px column in
// `wide` and a drawer or sheet behind Details below it; the tools float in one pill over the canvas's foot, wholly
// inside the canvas and the window at every size (G5); the levels are a picker in the top bar (2D slice task 12.3).

const PROJECT = 'mossgate.af2d.json'

let started: OpenLevelScreen | undefined
let target: HTMLElement | undefined
afterEach(async () => {
  await started?.dispose()
  target?.remove()
  started = undefined
  target = undefined
})

async function start(size: EditorSize) {
  await page.viewport(size.width, size.height)
  const conditions = publishConditions(document.documentElement, size, REST, targets)
  const clock = createTestClock()
  const workspace = memoryWorkspace(clock)
  await workspace.store.write(PROJECT, printProject(mossgate()))
  target = document.body.appendChild(document.createElement('div'))
  target.id = 'app'
  started = await openLevelScreen(target, workspace, PROJECT)
  await settleLayout()
  await expect.poll(() => document.querySelector('[data-testid="level-view"]')).not.toBeNull()
  await arrived()
  return { conditions }
}

/** A button by its accessible name: its `aria-label` (an icon button) or else its text. */
const buttonNamed = (root: ParentNode, name: string): HTMLElement => {
  const found = [...root.querySelectorAll<HTMLElement>('button')].find(
    (candidate) => (candidate.getAttribute('aria-label') ?? candidate.textContent?.trim()) === name,
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

/** Opens the layer panel in the compact layout, where it is a sheet (it is always in view otherwise). */
async function showLayers(size: EditorSize): Promise<void> {
  if (size.mode !== 'compact') return
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
      size.mode === 'compact' ? ['Level'] : ['Level', 'Characters'],
    )
    const essentials = [buttonNamed(bar, 'Back'), ...['undo', 'redo', 'save'].map(byTestId), ...tabs]
    if (size.mode === 'compact') essentials.push(buttonNamed(byTestId('level-toolbar'), 'Layers'))
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
      expect(control.getBoundingClientRect().height).toBeGreaterThanOrEqual(targets.hit)
    expect(checkLayout(conditions, [])).toEqual([])
    await page.screenshot({ path: `.vitest/shots/level-layers-${size.name}.png` })
  })
})

const region = (name: string): HTMLElement => {
  const found = byTestId('level-view').querySelector<HTMLElement>(`[data-region="${name}"]`)
  if (found === null) throw new Error(`no ${name} region`)
  return found
}

describe.each(SIZES)('Level view inspector, tools and levels at $name ($width x $height)', (size) => {
  test('the inspector is a 320 px column in wide and opens from Details below it', async () => {
    const { conditions } = await start(size)
    const stage = byTestId('level-view')
    const details = [...stage.querySelectorAll('button')].filter(
      (b) => b.getAttribute('aria-label') === 'Details',
    )
    if (size.mode === 'wide') {
      expect(region('inspector').getBoundingClientRect().width).toBeCloseTo(320, 0)
      expect(details).toHaveLength(0)
    } else {
      expect(details).toHaveLength(1)
      ;(details[0] as HTMLElement).click()
      await arrived()
      expect(region('inspector').dataset.open).toBe('true')
    }
    // No tabs: with nothing chosen the inspector shows the level, label-left; every control can be scrolled into the
    // screen inside the inspector's own scroll region (a phone held sideways is short).
    const inspector = region('inspector').querySelector<HTMLElement>('[data-testid="level-inspector"]')
    if (inspector === null) throw new Error('no inspector')
    expect(inspector.querySelector('[role="tablist"]')).toBeNull()
    expect(inspector.querySelector('h2')?.textContent?.trim()).toBeTruthy()
    const controls = [...inspector.querySelectorAll<HTMLElement>('button, input, textarea')]
    for (const control of controls) {
      control.scrollIntoView({ block: 'nearest' })
      expectInside(control, size)
    }
    expect(checkLayout(conditions, controls)).toEqual([])
    await page.screenshot({ path: `.vitest/shots/level-inspector-${size.name}.png` })
  })

  test('the levels are a picker in the top bar, with no strip of cards', async () => {
    const { conditions } = await start(size)
    expect(document.querySelector('[data-testid="level-dock"]')).toBeNull()
    const picker = [...byTestId('document-bar').querySelectorAll<HTMLElement>('button')].find((b) =>
      b.getAttribute('aria-label')?.startsWith('Level: '),
    )
    if (picker === undefined) throw new Error('no level picker')
    expectInside(picker, size)
    expect(checkLayout(conditions, [picker])).toEqual([])
    picker.click()
    await arrived()
    const items = [...document.querySelectorAll<HTMLElement>('[role="menu"] [role="menuitem"]')]
    expect(items.map((item) => item.querySelector('.label')?.textContent).at(-1)).toBe('New level')
    for (const item of items) expectInside(item, size)
    await page.screenshot({ path: `.vitest/shots/level-picker-${size.name}.png` })
  })

  test('the tool pill floats wholly inside the canvas and the window, top or foot by size (G5)', async () => {
    await start(size)
    const pill = byTestId('level-toolbar')
    expectInside(pill, size)
    const surface = byTestId('level-surface').getBoundingClientRect()
    const box = pill.getBoundingClientRect()
    expect(box.left).toBeGreaterThanOrEqual(surface.left - 0.5)
    expect(box.right).toBeLessThanOrEqual(surface.right + 0.5)
    expect(box.bottom).toBeLessThanOrEqual(surface.bottom + 0.5)
    // Centred, at the canvas's foot on a phone and at its top from an iPad up (the revised mockup).
    if (size.mode === 'compact') expect(surface.bottom - box.bottom).toBeLessThan(24)
    else expect(box.top - surface.top).toBeLessThan(24)
    expect(Math.abs((box.left + box.right) / 2 - (surface.left + surface.right) / 2)).toBeLessThan(1)
  })

  test('the tools, Undo, Layers, the view switcher and Save stay in view', async () => {
    const { conditions } = await start(size)
    const toolbar = byTestId('level-toolbar')
    const tools = [...toolbar.querySelectorAll<HTMLElement>('[role="radiogroup"] [role="radio"]')]
    expect(tools.length).toBe(6)
    const essentials = [tools[0] as HTMLElement, byTestId('undo'), byTestId('save'), ...switcherControls()]
    if (size.mode === 'compact') essentials.push(buttonNamed(toolbar, 'Layers'))
    for (const control of essentials) expectInside(control, size)
    // The pill is a declared sideways scroll region (it scrolls rather than squeeze a label), so a canvas too narrow
    // for it reaches the later tools by scrolling it: each one comes fully into view without the page moving.
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
// hit-tests it (about 15 px), so a tool under it loses its lower taps (#272: Mac WebKit, 900 x 600 and 390 x 844; the
// same class as #265). Linux browsers lay overlay bars out of the hit test, so the rule is held here as a measure: the
// pill draws no scroll bar at all.
describe('Level view tool pill', () => {
  test('draws no scroll bar for an overlay bar to lie over its tools', async () => {
    await start(SIZES.find((size) => size.name === 'phone-portrait') as EditorSize)
    const toolbar = document.querySelector<HTMLElement>('[data-testid="level-toolbar"]') as HTMLElement
    expect(getComputedStyle(toolbar).scrollbarWidth).toBe('none')
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
    publishConditions(document.documentElement, portrait, REST, targets)
    await settleLayout()
    await arrived()
    expect(byTestId('level-surface'), 'the canvas was not remounted').toBe(surface)
    expect(last.getAttribute('aria-selected')).toBe('true')
    expect(fill.getAttribute('aria-checked')).toBe('true')
  })
})
