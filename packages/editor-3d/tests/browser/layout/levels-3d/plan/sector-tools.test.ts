import '@automata/editor/tokens.css'
import '@automata/editor/fonts.css'
import '#src/app/main.css'
import { arrived, type EditorSize, SIZES } from '@automata/editor/kit/testing'
import { byTestId, checkLayout } from '@automata/framework/testing'
import { afterEach, describe, expect, test } from 'vitest'
import depotText from '#src/testing/fixtures/depot.af-sector.json?raw'
import { startAt, stopEditor } from '#src/testing/layout-start.ts'

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

/** The part of the plan the sheet and tools leave (`data-usable="x y w h"`), in canvas pixels. */
function usable(): { x: number; y: number; w: number; h: number } {
  const [x = 0, y = 0, w = 0, h = 0] = (plan().getAttribute('data-usable') ?? '').split(' ').map(Number)
  return { x, y, w, h }
}

/** Zooms the plan out about its centre (a Ctrl wheel), so there is bare plan round the level to draw on. */
async function zoomOut(): Promise<void> {
  const box = plan().getBoundingClientRect()
  for (let n = 0; n < 6; n++)
    plan().dispatchEvent(
      new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        ctrlKey: true,
        deltaY: 100,
        clientX: box.left + box.width / 2,
        clientY: box.top + box.height / 2,
      }),
    )
  await arrived()
}

/** Pixels to a metre, from the status line ("59 px per metre"). */
function pixelsPerMetre(): number {
  const text = document.querySelector('[data-widget="status-line"]')?.textContent ?? ''
  return Number(/([\d.]+) px per metre/.exec(text)?.[1] ?? 32)
}

/**
 * Three corners at the top of the area the sheet and tools leave (the fit leaves a band there above the level), a metre
 * apart so the snap grid keeps them three corners, clear of the toolbar and the actions.
 */
function margin(): readonly (readonly [number, number])[] {
  const area = usable()
  const step = Math.ceil(pixelsPerMetre())
  const x = Math.round(area.x + area.w * 0.3)
  const y = Math.round(area.y + 12)
  return [
    [x, y],
    [x + step, y],
    [x + step, y + step],
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
    railButton('Room').click()
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
    await zoomOut()
    const [first, second] = margin()
    penTap(...(first as [number, number]))
    penTap(...(second as [number, number]))
    await arrived()
    const actions = [buttonNamed('Undo point'), buttonNamed('Close sector')]
    expect(checkLayout(conditions, actions)).toEqual([])
    for (const action of actions)
      expect(action.getBoundingClientRect().bottom).toBeLessThanOrEqual(statusTop())
  })

  test('the area the level is framed in is clear of the sheet and the tool row', async () => {
    await openDepot(size)
    const area = usable()
    expect(area.w, 'the canvas names its usable area').toBeGreaterThan(0)
    const box = plan().getBoundingClientRect()
    expect(area.y, 'below the tool row').toBeGreaterThanOrEqual(56)
    for (const sheet of document.querySelectorAll<HTMLElement>('[data-region=dock]')) {
      const covers = sheet.getBoundingClientRect()
      if (covers.top < box.bottom && covers.bottom > box.top)
        expect(box.top + area.y + area.h, 'above the sheet').toBeLessThanOrEqual(covers.top + 0.5)
    }
  })

  test.runIf(size.mode !== 'compact')(
    'journey: a Pencil draws a room and closes it on its first corner',
    async () => {
      await openDepot(size)
      railButton('Room').click()
      await zoomOut()
      const corners = margin()
      for (const [x, y] of corners) penTap(x, y)
      const [x0, y0] = corners[0] as [number, number]
      penTap(x0, y0)
      await arrived()
      const refusal = document.querySelector('[data-testid="tool-refusal"]')?.textContent
      expect(
        byTestId('undo').getAttribute('aria-label'),
        `refused: ${refusal} at ${JSON.stringify(corners)} in ${JSON.stringify(usable())}`,
      ).toMatch(/^Undo Draw sector/)
      expect(refusal).toBeUndefined()
    },
  )
})
