import '@mcthaydt/automata-editor/tokens.css'
import '@mcthaydt/automata-editor/fonts.css'
import '../../main.css'
import { byTestId, checkLayout } from '@mcthaydt/automata/testing'
import { arrived, type EditorSize, SIZES } from '@mcthaydt/automata-editor/kit/testing'
import { afterEach, describe, expect, test } from 'vitest'
import depotText from '../../testing/fixtures/depot.af-sector.json?raw'
import { startAt, stopEditor } from '../../testing/layout-start'

// The Plan view's tools with the production CSS in Chromium, WebKit and Firefox (plan ED3D.6g-a step 8; ED3D spec §9
// `Draw a sector`, §10) at the kit's eight window sizes: the rail's buttons, the sector toolbar and the drawing's
// actions are on screen at full size and clear of the status line; a phone has no rail. Then a
// Pencil draws a room in the band above the level and closes it on its first corner: one undo step.

const DEPOT = 'depot/depot.json'

afterEach(stopEditor)

async function openDepot(size: EditorSize) {
  const started = await startAt(size, async (workspace) => {
    await workspace.store.write(DEPOT, depotText)
  })
  await expect.poll(() => document.querySelectorAll('[role="option"]').length).toBeGreaterThan(0)
  document
    .querySelector<HTMLElement>('[role="option"]')
    ?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
  await expect.poll(() => document.querySelector('[data-testid="plan-canvas"]')).not.toBeNull()
  await arrived()
  return started
}

const plan = (): HTMLElement => byTestId('plan-canvas')
const rail = (): HTMLElement => {
  const found = document.querySelector<HTMLElement>('[role="toolbar"][aria-label="Tools"]')
  if (found === null) throw new Error('no tool rail')
  return found
}
const railButton = (name: string): HTMLElement => {
  const found = [...rail().querySelectorAll<HTMLElement>('button')].find(
    (button) => button.textContent?.trim() === name,
  )
  if (found === undefined) throw new Error(`no ${name} in the rail`)
  return found
}
const buttonNamed = (name: string): HTMLElement => {
  const found = [...document.querySelectorAll<HTMLElement>('button')].find(
    (button) => button.textContent?.trim() === name,
  )
  if (found === undefined) throw new Error(`no ${name} button`)
  return found
}

/** A Pencil tap at a point of the plan, in pixels from its top left. */
function penTap(x: number, y: number): void {
  const box = plan().getBoundingClientRect()
  for (const type of ['pointermove', 'pointerdown', 'pointerup'])
    plan().dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: 2,
        pointerType: 'pen',
        isPrimary: true,
        clientX: box.left + x,
        clientY: box.top + y,
        pressure: type === 'pointerup' ? 0 : 0.5,
        buttons: type === 'pointerdown' ? 1 : 0,
      }),
    )
}

/** Three corners above the framed level (the fit leaves a band there), clear of the toolbar and the actions. */
function margin(): readonly (readonly [number, number])[] {
  const { width, height } = plan().getBoundingClientRect()
  const x = Math.round(width * 0.3)
  const y = Math.max(84, Math.round(height * 0.12))
  return [
    [x, y],
    [x + 24, y],
    [x + 24, y + 20],
  ]
}

const statusTop = (): number =>
  document.querySelector('[data-widget="status-line"]')?.getBoundingClientRect().top ??
  Number.POSITIVE_INFINITY

describe.each(SIZES)('the Plan tools at $name ($width x $height)', (size) => {
  test('the rail, the sector toolbar and the drawing actions are on screen at full size, clear of the status line; no rail on a phone', async () => {
    const { conditions } = await openDepot(size)
    if (size.mode === 'compact') {
      expect(document.querySelector('[role="toolbar"][aria-label="Tools"]')).toBeNull()
      return
    }
    expect(checkLayout(conditions, [...rail().querySelectorAll<HTMLElement>('button')])).toEqual([])
    railButton('Sector').click()
    await arrived()
    const radios = [
      ...document.querySelectorAll<HTMLElement>('[data-testid="sector-options"] [role="radio"]'),
    ]
    expect(radios.map((radio) => radio.textContent?.trim())).toEqual([
      'Polygon',
      'Rectangle',
      'Split',
      'Merge',
    ])
    expect(checkLayout(conditions, radios)).toEqual([])
    const [first, second] = margin()
    penTap(...(first as [number, number]))
    penTap(...(second as [number, number]))
    await arrived()
    const actions = [buttonNamed('Undo point'), buttonNamed('Close sector')]
    expect(checkLayout(conditions, actions)).toEqual([])
    for (const action of actions)
      expect(action.getBoundingClientRect().bottom).toBeLessThanOrEqual(statusTop())
  })

  test.runIf(size.mode !== 'compact')(
    'journey: a Pencil draws a room and closes it on its first corner',
    async () => {
      await openDepot(size)
      railButton('Sector').click()
      await arrived()
      const corners = margin()
      for (const [x, y] of corners) penTap(x, y)
      const [x0, y0] = corners[0] as [number, number]
      penTap(x0, y0)
      await arrived()
      expect(byTestId('undo').getAttribute('aria-label')).toMatch(/^Undo Draw sector/)
      expect(document.querySelector('[data-testid="tool-refusal"]')).toBeNull()
    },
  )
})
