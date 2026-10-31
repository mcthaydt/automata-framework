import '@mcthaydt/automata-editor-kit/tokens.css'
import '@mcthaydt/automata-editor-kit/fonts.css'
import '../../main.css'
import { arrived, type EditorSize, SIZES } from '@mcthaydt/automata-editor-kit/testing'
import { byTestId, checkLayout } from '@mcthaydt/automata-ui/testing'
import { afterEach, describe, expect, test } from 'vitest'
import depotText from '../../testing/fixtures/depot.af-sector.json?raw'
import { startAt, stopEditor } from '../../testing/layout-start'

// The Sector tool's journeys with the production CSS in Chromium, WebKit and Firefox (plan ED3D.6g-b step 8; ED3D spec
// §13): the nudge pad on screen at full size and clear of the status line after a Pencil tap; ED3-c, a rectangle drawn
// against the dock's south wall, is offered a portal and Portal adds it with the checks still clear; ED3-d, a polygon
// over the hall, is refused naming the hall and adds nothing. Plan points become page points through the rulers' metre
// ticks, the same numbers a person reads. Drawing is not a phone target (spec §10), so phones are left out.

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

/** A ruler's ticks as (metres, pixels from the plan's edge); the rulers print a true minus sign. */
function ticks(side: 'top' | 'left'): readonly (readonly [number, number])[] {
  const spans = plan().querySelectorAll<HTMLElement>(`.ruler.${side} span`)
  return [...spans]
    .map((span) => {
      const metres = Number((span.textContent ?? '').replace('\u2212', '-'))
      const pixels = Number.parseFloat(side === 'top' ? span.style.left : span.style.top)
      return [metres, pixels] as const
    })
    .filter(([metres, pixels]) => Number.isFinite(metres) && Number.isFinite(pixels))
}

/** The page point a plan point is drawn at, from the rulers. */
function pageOf(x: number, z: number): { x: number; y: number } {
  const line = (pairs: readonly (readonly [number, number])[], value: number) => {
    const [[m0, p0], [m1, p1]] = pairs as [[number, number], [number, number]]
    return p0 + ((value - m0) * (p1 - p0)) / (m1 - m0)
  }
  const box = plan().getBoundingClientRect()
  return { x: box.left + line(ticks('top'), x), y: box.top + line(ticks('left'), z) }
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
      chooseTool('Sector')
      await arrived()
      await tapPlan('pen', 4, -1)
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
      chooseTool('Sector')
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
      chooseTool('Sector')
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
