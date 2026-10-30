import '@mcthaydt/automata-editor-kit/tokens.css'
import '@mcthaydt/automata-editor-kit/fonts.css'
import '../../main.css'
import { arrived, type EditorSize, REST, SIZES } from '@mcthaydt/automata-editor-kit/testing'
import { byTestId, checkLayout, publishConditions, settleLayout } from '@mcthaydt/automata-ui/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { printProject } from '../../model/project-codec'
import { memoryWorkspace } from '../../testing/memory-workspace'
import { mossgate } from '../../testing/samples'
import { createTestClock } from '../../testing/test-clock'
import { type EditorHandle, startEditor } from '../boot'

// The Level view with the production CSS in a real browser (plan ED2D.4c4a step 9; 2D editor spec §12), at the eight
// window sizes of Home's layout test, in Chromium, WebKit and Firefox: every control at least 44 px and never clipped,
// the top bar, the rail and (below wide) the Layers button reachable without scrolling, the canvas given real room and
// the page never scrolling, the layers reachable, and a rotation that keeps the chosen layer and tool. The editor
// starts as `main.ts` starts it, over a memory workspace with the Mossgate sample.

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
  test('every control is sized and unclipped; the top bar, the rail and Layers are reachable', async () => {
    const { conditions } = await start(size)
    const bar = byTestId('document-bar')
    const tabs = [...document.querySelectorAll<HTMLElement>('[role="tab"]')]
    expect(tabs.map((tab) => tab.textContent?.trim())).toEqual([
      'Level',
      'World',
      'Tilesets',
      'Entities',
      'Checks',
      'Export',
    ])
    const essentials = [buttonNamed(bar, 'Back'), ...['undo', 'redo', 'save'].map(byTestId), ...tabs]
    if (size.mode !== 'wide') essentials.push(buttonNamed(byTestId('level-toolbar'), 'Layers'))
    expect(checkLayout(conditions, essentials)).toEqual([])
    for (const tab of tabs) expectInside(tab, size)
    await page.screenshot({ path: `.vitest/shots/level-view-${size.name}.png` })
  })

  test('the canvas has real room and the page never scrolls', async () => {
    await start(size)
    const surface = byTestId('level-surface').getBoundingClientRect()
    expect(surface.width).toBeGreaterThan(size.width / 3)
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
