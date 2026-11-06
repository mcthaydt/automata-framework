import '@mcthaydt/automata-editor/tokens.css'
import '@mcthaydt/automata-editor/fonts.css'
import '../../main.css'
import { byTestId, checkLayout } from '@mcthaydt/automata/testing'
import { arrived, type EditorSize, SIZES } from '@mcthaydt/automata-editor/kit/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { createEditorApp } from '../../app/editor-app'
import depotText from '../../testing/fixtures/depot.af-sector.json?raw'
import { startAt, stopEditor } from '../../testing/layout-start'

// The 3D editor's open flows with the production CSS in a real browser (plan ED3D.5c step 9; 3D editor spec §11 and
// §12): the error panel with many JSON paths, the level's top bar, Restore, the held Save (ED3-o) and the conflict
// dialog (ED3-k), at the eight window sizes of Home's layout test. Chromium for now; EDK.6a adds WebKit and Firefox.

const DEPOT = 'depot/depot.json'
const BROKEN = 'broken/broken.json'

/** A depot whose sectors are all wrong in two members: forty schema issues, so the panel's list must scroll. */
function brokenText(): string {
  const depot = JSON.parse(depotText) as { sectors: Record<string, unknown>[] }
  const sector = depot.sectors[0] ?? {}
  depot.sectors = Array.from({ length: 20 }, (_, n) => ({
    ...sector,
    id: `s${n}`,
    floor: 'low',
    ceiling: 'high',
  }))
  return JSON.stringify(depot, null, 2)
}

afterEach(stopEditor)

/** The editor over the depot and a broken level; with `autosave`, an autosave of the depot with `floor` set. */
function start(size: EditorSize, autosave?: number) {
  return startAt(size, async (workspace) => {
    await workspace.store.write(DEPOT, depotText)
    await workspace.store.write(BROKEN, brokenText())
    if (autosave === undefined) return
    const clock = { now: () => Date.now(), setTimer: () => 0, clearTimer: () => {} }
    const app = createEditorApp({ workspace, clock })
    const opened = await app.open(DEPOT)
    if (opened.status !== 'opened') throw new Error(opened.status)
    opened.level.editor.history.apply('Set floor', (state) => {
      const level = structuredClone(state.level) as { sectors: Record<string, unknown>[] }
      const hall = level.sectors[0] as Record<string, unknown>
      hall.floor = autosave
      return { level }
    })
    await opened.level.document.session.flush()
    opened.level.document.dispose()
  })
}

async function openFromHome(path: string): Promise<void> {
  await expect.poll(() => document.querySelectorAll('[role="option"]').length).toBeGreaterThan(1)
  const card = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find((option) =>
    option.textContent?.includes(path),
  )
  if (card === undefined) throw new Error(`no card for ${path}`)
  card.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
  await expect
    .poll(() => document.querySelector('[role="dialog"], [data-testid="document-bar"]'))
    .not.toBeNull()
  await arrived()
}

const dialog = (): HTMLElement => {
  const found = document.querySelector<HTMLElement>('[role="dialog"]')
  if (found === null) throw new Error('no dialog')
  return found
}

const button = (root: HTMLElement, name: string): HTMLElement => {
  const found = [...root.querySelectorAll<HTMLElement>('button')].find(
    (candidate) => candidate.textContent?.trim() === name,
  )
  if (found === undefined) throw new Error(`no ${name} button`)
  return found
}

function expectInside(element: HTMLElement, size: EditorSize): void {
  const box = element.getBoundingClientRect()
  expect(box.left).toBeGreaterThanOrEqual(0)
  expect(box.top).toBeGreaterThanOrEqual(0)
  expect(box.right).toBeLessThanOrEqual(size.width)
  expect(box.bottom).toBeLessThanOrEqual(size.height)
}

async function nextDialog(): Promise<HTMLElement> {
  await expect.poll(() => document.querySelector('[role="dialog"]')).not.toBeNull()
  await arrived()
  return dialog()
}

describe.each(SIZES)('3D open flows at $name ($width x $height)', (size) => {
  test('the error panel: inside the screen, its actions sized, its JSON paths scrolling in themselves', async () => {
    const { conditions } = await start(size)
    await openFromHome('broken.json')
    const panel = dialog()
    expectInside(panel, size)
    const copy = button(panel, 'Copy details')
    const another = button(panel, 'Open another')
    expect(checkLayout(conditions, [copy, another])).toEqual([])
    expect(another.getBoundingClientRect().height, 'Open another is a primary action').toBeGreaterThanOrEqual(
      48,
    )
    if (size.width >= 700) expect(panel.getBoundingClientRect().width, 'the wide dialog').toBeGreaterThan(600)
    const rows = panel.querySelector<HTMLElement>('[data-scroll-region]') as HTMLElement
    expect(rows.querySelectorAll('li').length).toBe(40)
    expect(getComputedStyle(rows).overflowY).toBe('auto')
    expect(rows.scrollHeight, 'the list scrolls inside the panel').toBeGreaterThan(rows.clientHeight)
    expect(rows.scrollWidth, 'no row runs off sideways').toBeLessThanOrEqual(rows.clientWidth)
    expect(document.documentElement.scrollTop).toBe(0)
    await page.screenshot({ path: `.vitest/shots/ed3d-open-failed-${size.name}.png` })
  })

  test('the top bar: Back, Undo, Redo and Save are on screen at full size', async () => {
    const { conditions } = await start(size)
    await openFromHome(DEPOT)
    const back = button(byTestId('document-bar'), 'Back')
    expect(checkLayout(conditions, [back, ...['undo', 'redo', 'save'].map(byTestId)])).toEqual([])
    const heading = byTestId('document-bar').querySelector('h1') as HTMLElement
    expect(heading.getBoundingClientRect().width, 'the title keeps some room').toBeGreaterThan(40)
    await page.screenshot({ path: `.vitest/shots/ed3d-document-bar-${size.name}.png` })
  })

  test('Restore, then the held Save (ED3-o): inside the screen with their actions reachable', async () => {
    const { conditions } = await start(size, 1e21)
    await openFromHome(DEPOT)
    const recover = dialog()
    expectInside(recover, size)
    const restore = button(recover, 'Keep my changes')
    expect(checkLayout(conditions, [button(recover, 'Throw away'), restore])).toEqual([])
    expect(restore.getBoundingClientRect().height).toBeGreaterThanOrEqual(48)
    await page.screenshot({ path: `.vitest/shots/ed3d-recover-${size.name}.png` })

    restore.click()
    await arrived()
    byTestId('save').click()
    const held = await nextDialog()
    expectInside(held, size)
    expect(held.textContent).toContain('sectors.0.floor')
    const choices = ['Cancel', 'Export a copy', 'Save reformatted'].map((name) => button(held, name))
    expect(checkLayout(conditions, choices)).toEqual([])
    expect(
      button(held, 'Save reformatted').getBoundingClientRect().height,
      'the primary action',
    ).toBeGreaterThanOrEqual(48)
    await page.screenshot({ path: `.vitest/shots/ed3d-held-save-${size.name}.png` })
  })

  test('the conflict dialog (ED3-k): inside the screen with its four choices reachable', async () => {
    const { conditions, workspace } = await start(size, 0.5)
    await openFromHome(DEPOT)
    button(dialog(), 'Keep my changes').click()
    await arrived()
    await workspace.store.write(DEPOT, depotText.replace('"light": 1,', '"light": 0.25,'))
    byTestId('save').click()
    const conflict = await nextDialog()
    expectInside(conflict, size)
    const choices = ['Cancel', 'Use theirs', 'Use mine', 'Keep both'].map((name) => button(conflict, name))
    expect(checkLayout(conditions, choices)).toEqual([])
    expect(button(conflict, 'Keep both').getBoundingClientRect().height).toBeGreaterThanOrEqual(48)
    await page.screenshot({ path: `.vitest/shots/ed3d-conflict-${size.name}.png` })
  })
})
