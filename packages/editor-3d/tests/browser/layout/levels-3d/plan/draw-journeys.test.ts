import '@automata/editor/tokens.css'
import '@automata/editor/fonts.css'
import '#src/app/main.css'
import { arrived, type EditorSize, SIZES } from '@automata/editor/kit/testing'
import { byTestId, checkLayout } from '@automata/framework/testing'
import { afterEach, describe, expect, test } from 'vitest'
import depotText from '#src/testing/fixtures/depot.af-sector.json?raw'
import { startAt, stopEditor } from '#src/testing/layout-start.ts'

// The Sector tool's journeys with the production CSS in Chromium, WebKit and Firefox (plan ED3D.6g-b step 8; ED3D spec
// §13): the nudge pad on screen at full size and clear of the status line after a Pencil tap; ED3-c, a rectangle drawn
// against the dock's south wall, is offered a portal and Portal adds it with the checks still clear; ED3-d, a polygon
// over the hall, is refused naming the hall and adds nothing. Plan points become page points through the status line's
// pointer read-out, which works whether or not the page can draw (Firefox here has no WebGL2). Drawing is not a phone target (spec §10), so phones are left out.

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
  // The plan's renderer starts asynchronously: wait until it is drawing or has said it cannot, never mid-start.
  await expect.poll(() => plan().dataset.phase, { timeout: 10_000 }).not.toBe('starting')
  await arrived()
  await calibrate()
  return started
}

const plan = (): HTMLElement => byTestId('plan-canvas')

/** The status line's pointer read-out, in metres; it prints a true minus sign. */
function statusPoint(): { x: number; z: number } {
  const words = document.querySelector('[data-widget="status-line"] [role="status"]')?.textContent ?? ''
  const read = (axis: 'x' | 'z') =>
    Number(new RegExp(`${axis} (\\S+) m`).exec(words)?.[1]?.replace('\u2212', '-'))
  return { x: read('x'), z: read('z') }
}

/** Page pixels to plan metres, measured by hovering two points and reading where the status line says they are. */
let calibration:
  | {
      readonly page: readonly [{ x: number; y: number }, { x: number; y: number }]
      readonly plan: readonly [{ x: number; z: number }, { x: number; z: number }]
    }
  | undefined

async function calibrate(): Promise<void> {
  const box = plan().getBoundingClientRect()
  const pages = [
    { x: box.left + box.width * 0.25, y: box.top + box.height * 0.25 },
    { x: box.left + box.width * 0.75, y: box.top + box.height * 0.75 },
  ] as const
  const plans: { x: number; z: number }[] = []
  for (const at of pages) {
    const before = statusPoint()
    pointerAt('pointermove', 'mouse', at)
    await arrived()
    // The read-out follows the hover a frame or more later on a cold, loaded browser: wait until it shows a finite
    // point that differs from the one before the move, or the calibration (and every tap after it) is NaN.
    await expect
      .poll(() => {
        const read = statusPoint()
        return (
          Number.isFinite(read.x) && Number.isFinite(read.z) && (read.x !== before.x || read.z !== before.z)
        )
      })
      .toBe(true)
    plans.push(statusPoint())
  }
  calibration = { page: pages, plan: plans as [{ x: number; z: number }, { x: number; z: number }] }
}

/** The page point a plan point is drawn at. */
function pageOf(x: number, z: number): { x: number; y: number } {
  if (calibration === undefined) throw new Error('not calibrated')
  const [p0, p1] = calibration.page
  const [m0, m1] = calibration.plan
  return {
    x: p0.x + ((x - m0.x) * (p1.x - p0.x)) / (m1.x - m0.x),
    y: p0.y + ((z - m0.z) * (p1.y - p0.y)) / (m1.z - m0.z),
  }
}

function pointerAt(type: string, kind: 'mouse' | 'pen', at: { x: number; y: number }): void {
  plan().dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: kind === 'pen' ? 2 : 1,
      pointerType: kind,
      isPrimary: true,
      clientX: at.x,
      clientY: at.y,
      pressure: type === 'pointerup' ? 0 : 0.5,
      buttons: type === 'pointerdown' ? 1 : 0,
    }),
  )
}

async function tapPlan(kind: 'mouse' | 'pen', x: number, z: number): Promise<void> {
  const at = pageOf(x, z)
  for (const type of ['pointermove', 'pointerdown', 'pointerup']) pointerAt(type, kind, at)
  await arrived()
}

function chooseTool(name: string): void {
  const rail = document.querySelector<HTMLElement>('[role="toolbar"][aria-label="Tools"]')
  ;[...(rail?.querySelectorAll<HTMLElement>('button') ?? [])]
    .find((button) => button.textContent?.trim() === name)
    ?.click()
}

function buttonNamed(name: string): HTMLElement {
  const found = [...document.querySelectorAll<HTMLElement>('button')].find(
    (button) => (button.getAttribute('aria-label') ?? button.textContent?.trim()) === name,
  )
  if (found === undefined) throw new Error(`no ${name} button`)
  return found
}

const undoLabel = (): string => byTestId('undo').getAttribute('aria-label') ?? ''
const statusTop = (): number =>
  document.querySelector('[data-widget="status-line"]')?.getBoundingClientRect().top ??
  Number.POSITIVE_INFINITY

describe.each(SIZES.filter((size) => size.mode !== 'compact'))(
  'drawing at $name ($width x $height)',
  (size) => {
    test('the nudge pad is on screen at full size after a Pencil tap, clear of the status line', async () => {
      const { conditions } = await openDepot(size)
      chooseTool('Room')
      await arrived()
      await tapPlan('pen', 4, -1)
      // A page that cannot draw the plan (here, Firefox without WebGL2) says so and shows none of the plan's overlays.
      if (plan().dataset.phase !== 'drawing') {
        // Says why when it fails: a phase other than the no-WebGL2 one, or a calibration that is not finite.
        const why = `phase ${plan().dataset.phase}; calibration ${JSON.stringify(calibration)}`
        expect(plan().querySelector('[role="status"]')?.textContent, why).toContain('needs WebGL2')
        expect(document.querySelector('[role="group"][aria-label="Nudge the last corner"]')).toBeNull()
        return
      }
      const pad = document.querySelector<HTMLElement>('[role="group"][aria-label="Nudge the last corner"]')
      expect(pad).not.toBeNull()
      const buttons = [...(pad?.querySelectorAll<HTMLElement>('button') ?? [])]
      expect(buttons).toHaveLength(5)
      expect(checkLayout(conditions, buttons)).toEqual([])
      expect(pad?.getBoundingClientRect().bottom ?? 0).toBeLessThanOrEqual(statusTop())
      buttonNamed('Nudge right').click()
      await arrived()
      // The corner moved half a metre east: the edge to the next corner, 2 m east of where it was tapped, is 1.50 m.
      await tapPlan('pen', 6, -1)
      expect(plan().querySelector('.labels')?.textContent).toContain('1.50 m')
    })

    test('ED3-c: a rectangle against the dock’s south wall is offered a portal; Portal adds it and the checks stay clear', async () => {
      await openDepot(size)
      chooseTool('Room')
      await arrived()
      buttonNamed('Rectangle').click()
      await arrived()
      await tapPlan('mouse', 8, 6)
      await tapPlan('mouse', 14, 7.5)
      // A rectangle closes on a tap on its second corner.
      await tapPlan('mouse', 14, 7.5)
      expect(byTestId('document-frame').textContent).toContain(
        'Shares a 6.00 m wall with dock. Make it a portal?',
      )
      buttonNamed('Make portal').click()
      await arrived()
      expect(undoLabel()).toMatch(/^Undo Draw sector sector-1/)
      await expect
        .poll(() => byTestId('checks-pill').textContent ?? '', { timeout: 5000 })
        .toMatch(/No problems/)
    })

    test('ED3-d: a polygon over the hall is refused, naming the hall, and nothing is added', async () => {
      await openDepot(size)
      chooseTool('Room')
      await arrived()
      for (const [x, z] of [
        [2, -1],
        [4, -1],
        [4, 2],
        [2, 2],
        [2, -1],
      ] as const)
        await tapPlan('mouse', x, z)
      expect(byTestId('tool-refusal').textContent).toMatch(/hall/)
      expect(undoLabel()).toBe('Undo')
    })
  },
)
