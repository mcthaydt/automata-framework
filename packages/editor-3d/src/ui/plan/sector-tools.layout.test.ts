import '@automata/editor/tokens.css'
import '@automata/editor/fonts.css'
import '../../main.css'
import { arrived, type EditorSize, SIZES } from '@automata/editor/kit/testing'
import { byTestId, checkLayout } from '@automata/framework/testing'
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

/** A Pencil hovering a point of the plan: the world point the status line then names, and the zoom. */
async function probe(x: number, y: number): Promise<{ wx: number; wz: number; perMetre: number }> {
  const box = plan().getBoundingClientRect()
  plan().dispatchEvent(
    new PointerEvent('pointermove', {
      bubbles: true,
      pointerId: 2,
      pointerType: 'pen',
      isPrimary: true,
      clientX: box.left + x,
      clientY: box.top + y,
    }),
  )
  await arrived()
  const text = document.querySelector('[data-widget="status-line"]')?.textContent ?? ''
  const match = /x (-?[\d.]+) m · z (-?[\d.]+) m · (\d+) px per metre/.exec(text.replace('−', '-'))
  if (match === null) throw new Error(`no position in the status line: ${text}`)
  return { wx: Number(match[1]), wz: Number(match[2]), perMetre: Number(match[3]) }
}

/**
 * Three corners above the framed level (the fit leaves a band there), clear of the toolbar and the actions. The first
 * sits exactly on a whole metre: a tap snaps to the grid, and the closing tap must land within a Pencil's reach of the
 * corner that snapping made, which a point a half cell away does not at the highest zoom a size gets. The others are
 * far enough apart to stay three corners at the lowest zoom (about 59 px per metre on an iPad mini held wide), and the third
 * goes up, away from the level, so the room never overlaps it.
 */
async function margin(): Promise<readonly (readonly [number, number])[]> {
  const { width, height } = plan().getBoundingClientRect()
  const x = Math.round(width * 0.3)
  const y = Math.max(84, Math.round(height * 0.12))
  const here = await probe(x, y)
  const there = await probe(x + 20, y + 20)
  const sx = Math.sign(there.wx - here.wx) || 1
  const sz = Math.sign(there.wz - here.wz) || 1
  const fx = Math.round(x + (Math.round(here.wx) - here.wx) * here.perMetre * sx)
  const fy = Math.round(y + (Math.round(here.wz) - here.wz) * here.perMetre * sz)
  return [
    [fx, fy],
    [fx + 72, fy],
    [fx + 72, fy - 40],
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
    const [first, second] = await margin()
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
      const corners = await margin()
      for (const [x, y] of corners) penTap(x, y)
      const [x0, y0] = corners[0] as [number, number]
      penTap(x0, y0)
      await arrived()
      expect(byTestId('undo').getAttribute('aria-label')).toMatch(/^Undo Draw sector/)
      expect(document.querySelector('[data-testid="tool-refusal"]')).toBeNull()
    },
  )
})
