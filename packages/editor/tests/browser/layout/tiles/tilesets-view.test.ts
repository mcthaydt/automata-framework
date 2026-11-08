import '#src/shared/kit/tokens.css'
import '#src/shared/kit/tool-chrome.css'
import '#src/shared/kit/fonts.css'
import '#src/app/editor-2d/main.css'
import { byTestId, checkLayout, publishConditions, settleLayout } from '@mcthaydt/automata/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { type EditorHandle, startEditor } from '#src/app/editor-2d/boot.ts'
import { printProject } from '#src/shared/level-2d/model/project-codec.ts'
import { arrived, type EditorSize, REST, SIZES } from '#src/testing/kit/layout-sizes.ts'
import { editorTargets } from '#src/testing/kit/targets.ts'
import { createTestClock } from '#src/testing/kit/test-clock.ts'
import { memoryWorkspace } from '#src/testing/level-2d/memory-workspace.ts'
import { mossgate } from '#src/testing/level-2d/samples.ts'
import { openView, switcherControls } from '#src/testing/level-2d/view-switcher.ts'

/** The control sizes under this run's pointer: 32 px with a mouse, 44 (a primary 48) with touch. */
const targets = editorTargets()

// The Tilesets view with the production CSS in a real browser, at the kit's
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
  const conditions = publishConditions(document.documentElement, size, REST, targets)
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
  await openView('Tiles')
  await expect.poll(() => document.querySelector('[data-testid="tilesets-view"]')).not.toBeNull()
  await arrived()
  return { conditions }
}

const buttonNamed = (root: ParentNode, name: string): HTMLElement => {
  const found = [...root.querySelectorAll<HTMLElement>('button:not([role]):not([aria-haspopup])')].find(
    (candidate) => candidate.textContent?.trim() === name || candidate.getAttribute('aria-label') === name,
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
async function openDrawer(
  size: EditorSize,
  name: 'All tiles' | 'Details',
  regionName: string,
): Promise<void> {
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
    const tabs = switcherControls()
    const essentials = [...['undo', 'redo', 'save'].map(byTestId), ...tabs]
    if (size.mode === 'compact') essentials.push(buttonNamed(byTestId('tilesets-view'), 'All tiles'))
    expect(checkLayout(conditions, essentials)).toEqual([])
    expect(document.documentElement.scrollLeft).toBe(0)
    expect(document.documentElement.scrollTop).toBe(0)
    await page.screenshot({ path: `.vitest/shots/tilesets-view-${size.name}.png` })
  })

  test('the pattern cells are 44 px and Duplicate and Delete are reachable', async () => {
    const { conditions } = await start(size)
    await openDrawer(size, 'Details', 'inspector')
    const cells = [...byTestId('pattern-editor').querySelectorAll<HTMLElement>('button')]
    expect(cells.length).toBeGreaterThan(0)
    for (const cell of cells) {
      const box = cell.getBoundingClientRect()
      expect(box.width).toBeGreaterThanOrEqual(targets.hit)
      expect(box.height).toBeGreaterThanOrEqual(targets.hit)
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
    await openDrawer(size, 'All tiles', 'panel')
    const strip = byTestId('tilesets-panel').querySelector<HTMLElement>('[aria-label="Rules"]')
    if (strip === null) throw new Error('no rule strip')
    const rows = [...strip.querySelectorAll<HTMLElement>('li')]
    expect(rows.length).toBeGreaterThan(1)
    const last = rows.at(-1) as HTMLElement
    await reach(last)
    expectInside(last, size)
    for (const control of last.querySelectorAll('button')) {
      expect(control.getBoundingClientRect().height).toBeGreaterThanOrEqual(targets.hit)
      expect(control.getBoundingClientRect().width).toBeGreaterThanOrEqual(targets.hit)
    }
    expect(checkLayout(conditions, [])).toEqual([])
    await page.screenshot({ path: `.vitest/shots/tilesets-rules-${size.name}.png` })
  })
})

/** A real 64 x 32 picture, as a person's file: two colours, so the grid has something to lie over. */
async function pictureFile(): Promise<File> {
  const canvas = new OffscreenCanvas(64, 32)
  const context = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D
  context.fillStyle = '#3a7d44'
  context.fillRect(0, 0, 64, 32)
  context.fillStyle = '#8a5a2b'
  context.fillRect(0, 16, 64, 16)
  const blob = await canvas.convertToBlob({ type: 'image/png' })
  return new File([blob], 'moss.png', { type: 'image/png' })
}

describe.each(SIZES)('Add tiles at $name ($width x $height)', (size) => {
  test('the dialog, its preview and Add tiles fit the window as full-size targets', async () => {
    const { conditions } = await start(size)
    await openDrawer(size, 'All tiles', 'panel')
    const opener = buttonNamed(byTestId('tilesets-panel'), 'Add tiles')
    await reach(opener)
    opener.click()
    await arrived()
    const dialog = document.querySelector<HTMLElement>(
      '[role="dialog"][aria-label="Add tiles"], [role="dialog"]',
    )
    if (dialog === null) throw new Error('no dialog')
    const input = dialog.querySelector<HTMLInputElement>('input[type="file"]') as HTMLInputElement
    const files = new DataTransfer()
    files.items.add(await pictureFile())
    input.files = files.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
    await expect.poll(() => dialog.textContent).toContain('This makes 8 tiles.')
    await arrived()
    const add = [...dialog.querySelectorAll<HTMLElement>('button')].find(
      (button) => button.textContent?.trim() === 'Add tiles',
    ) as HTMLElement
    expect(add).not.toBeDisabled()
    const controls = [
      input.closest('label') as HTMLElement,
      add,
      ...dialog.querySelectorAll<HTMLElement>('[role="radio"]'),
    ]
    for (const control of controls) {
      await reach(control)
      expectInside(control, size)
    }
    await reach(byTestId('add-tiles-preview'))
    expectInside(byTestId('add-tiles-preview'), size)
    expect(checkLayout(conditions, [])).toEqual([])
    await page.screenshot({ path: `.vitest/shots/add-tiles-${size.name}.png` })
  })
})
