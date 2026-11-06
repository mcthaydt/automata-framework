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

// The Entities view with the production CSS in a real browser (plan ED2D.5c step 6; 2D editor spec §12), at the kit's
// eight window sizes in Chromium, WebKit and Firefox: every control at least 44 px and never clipped, the page never
// scrolling, the definition form's Duplicate and Delete reachable, the field editor's type chips full-size targets,
// and the refusal dialog's list and actions inside the window (below wide, from the Definitions and Inspector
// drawers). The editor starts as `main.ts` starts it, over a memory workspace with the Mossgate sample (three slimes),
// and the rail opens Entities.

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
  ].find((candidate) => candidate.textContent?.trim() === 'Entities')
  if (tab === undefined) throw new Error('no Entities tab')
  tab.click()
  await expect.poll(() => document.querySelector('[data-testid="entities-view"]')).not.toBeNull()
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
  const found = byTestId('entities-view').querySelector<HTMLElement>(`[data-region="${name}"]`)
  if (found === null) throw new Error(`no ${name} region`)
  return found
}

/** Below wide, presses the canvas's drawer button until its region says it is open. */
async function openDrawer(
  size: EditorSize,
  name: 'Definitions' | 'Inspector',
  regionName: string,
): Promise<void> {
  if (size.mode === 'wide' || region(regionName).dataset.open === 'true') return
  buttonNamed(byTestId('entities-view'), name).click()
  await arrived()
  expect(region(regionName).dataset.open).toBe('true')
}

/** Scrolls an element into its scroll region, as a person would, and waits for the layout. */
async function reach(element: HTMLElement): Promise<void> {
  element.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  await settleLayout()
}

/** Chooses the slime in the panel (from the drawer below wide), then closes the drawer again. */
async function chooseSlime(size: EditorSize): Promise<void> {
  await openDrawer(size, 'Definitions', 'panel')
  const row = [...byTestId('entities-panel').querySelectorAll<HTMLElement>('[role="radio"]')].find(
    (candidate) => candidate.textContent?.trim().startsWith('slime'),
  )
  if (row === undefined) throw new Error('no slime row')
  row.click()
  await arrived()
  if (size.mode !== 'wide' && region('panel').dataset.open === 'true') {
    buttonNamed(byTestId('entities-view'), 'Definitions').click()
    await arrived()
  }
}

function expectTarget(control: Element): void {
  const box = control.getBoundingClientRect()
  expect(box.width).toBeGreaterThanOrEqual(44)
  expect(box.height).toBeGreaterThanOrEqual(44)
}

describe.each(SIZES)('Entities view at $name ($width x $height)', (size) => {
  test('every control is sized and unclipped, and the page never scrolls', async () => {
    const { conditions } = await start(size)
    await chooseSlime(size)
    const tabs = [
      ...document.querySelectorAll<HTMLElement>('[role="tablist"][aria-label="Views"] [role="tab"]'),
    ]
    const essentials = [...['undo', 'redo', 'save'].map(byTestId), ...tabs]
    if (size.mode !== 'wide') essentials.push(buttonNamed(byTestId('entities-view'), 'Definitions'))
    expect(checkLayout(conditions, essentials)).toEqual([])
    expect(document.documentElement.scrollLeft).toBe(0)
    expect(document.documentElement.scrollTop).toBe(0)
    await page.screenshot({ path: `.vitest/shots/entities-view-${size.name}.png` })
  })

  test('the definition form is full-size and Duplicate and Delete are reachable', async () => {
    const { conditions } = await start(size)
    await chooseSlime(size)
    await openDrawer(size, 'Inspector', 'inspector')
    const inspector = byTestId('entities-inspector')
    for (const name of ['Duplicate', 'Delete']) {
      const button = buttonNamed(inspector, name)
      await reach(button)
      expectInside(button, size)
      expectTarget(button)
    }
    expect(checkLayout(conditions, [])).toEqual([])
    await page.screenshot({ path: `.vitest/shots/entities-definition-${size.name}.png` })
  })

  test('the field editor’s type chips are full-size and Delete field is reachable', async () => {
    const { conditions } = await start(size)
    await chooseSlime(size)
    await openDrawer(size, 'Inspector', 'inspector')
    const inspector = byTestId('entities-inspector')
    const fieldsTab = [...inspector.querySelectorAll<HTMLElement>('[role="tab"]')].find((tab) =>
      tab.textContent?.trim().startsWith('Fields'),
    )
    if (fieldsTab === undefined) throw new Error('no Fields tab')
    fieldsTab.click()
    await arrived()
    const editor = byTestId('field-def-editor')
    const chips = [...editor.querySelectorAll<HTMLElement>('[role="radio"]')]
    expect(chips).toHaveLength(9)
    for (const chip of chips) expectTarget(chip)
    const remove = buttonNamed(editor, 'Delete field')
    await reach(remove)
    expectInside(remove, size)
    expect(checkLayout(conditions, [])).toEqual([])
    await page.screenshot({ path: `.vitest/shots/entities-fields-${size.name}.png` })
  })

  test('the refusal dialog lists the slimes and its actions are inside the window', async () => {
    const { conditions } = await start(size)
    await chooseSlime(size)
    await openDrawer(size, 'Inspector', 'inspector')
    const remove = buttonNamed(byTestId('entities-inspector'), 'Delete')
    await reach(remove)
    remove.click()
    await expect.poll(() => document.querySelector('[role="dialog"]')).not.toBeNull()
    await arrived()
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement
    expect(dialog.querySelectorAll('li')).toHaveLength(3)
    for (const name of ['Cancel', 'Delete anyway']) {
      const button = buttonNamed(dialog, name)
      expectInside(button, size)
      expectTarget(button)
    }
    expect(checkLayout(conditions, [])).toEqual([])
    await page.screenshot({ path: `.vitest/shots/entities-refusal-${size.name}.png` })
  })
})
