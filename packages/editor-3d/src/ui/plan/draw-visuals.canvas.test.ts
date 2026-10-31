import '@mcthaydt/automata-editor-kit/tokens.css'
import '@mcthaydt/automata-editor-kit/fonts.css'
import '../../main.css'
import { arrived, SIZES } from '@mcthaydt/automata-editor-kit/testing'
import { afterEach, describe, expect, inject, it } from 'vitest'
import { page } from 'vitest/browser'
import depotText from '../../testing/fixtures/depot.af-sector.json?raw'
import { startAt, stopEditor } from '../../testing/layout-start'

// The review images of the loupe, the nudge pad, the New sector card and the portal offer (plan ED3D.6g-b step 8), for
// the delegated visual acceptance. Written only with `ED3D_VISUALS=1`; never compared against, never a golden. Plan
// points become page points through the rulers' metre ticks.

const OUT = '../../../../../docs/evidence/owner-visual/2026-10-31-ed3d-6g-b'

afterEach(stopEditor)

const named = (name: string) => {
  const size = SIZES.find((each) => each.name === name)
  if (size === undefined) throw new Error(`no size ${name}`)
  return size
}

const plan = (): HTMLElement => {
  const found = document.querySelector<HTMLElement>('[data-testid="plan-canvas"]')
  if (found === null) throw new Error('no plan')
  return found
}

function pageOf(x: number, z: number): { x: number; y: number } {
  const ticks = (side: 'top' | 'left') =>
    [...plan().querySelectorAll<HTMLElement>(`.ruler.${side} span`)]
      .map((span) => [
        Number((span.textContent ?? '').replace('−', '-')),
        Number.parseFloat(side === 'top' ? span.style.left : span.style.top),
      ])
      .filter(([m, p]) => Number.isFinite(m) && Number.isFinite(p)) as [number, number][]
  const line = (pairs: [number, number][], value: number) => {
    const [[m0, p0], [m1, p1]] = pairs as [[number, number], [number, number]]
    return p0 + ((value - m0) * (p1 - p0)) / (m1 - m0)
  }
  const box = plan().getBoundingClientRect()
  return { x: box.left + line(ticks('top'), x), y: box.top + line(ticks('left'), z) }
}

function pointer(type: string, kind: 'mouse' | 'pen', x: number, z: number): void {
  const at = pageOf(x, z)
  plan().dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
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

async function tap(kind: 'mouse' | 'pen', x: number, z: number): Promise<void> {
  for (const type of ['pointermove', 'pointerdown', 'pointerup']) pointer(type, kind, x, z)
  await arrived()
}

async function openDepot(name: string): Promise<void> {
  await startAt(named(name), async (workspace) => {
    await workspace.store.write('depot/depot.json', depotText)
  })
  await expect.poll(() => document.querySelector('[role="option"]')).not.toBeNull()
  document.querySelector('[role="option"]')?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
  await expect.poll(() => document.querySelector('[data-phase="drawing"]')).not.toBeNull()
  await expect.poll(() => plan().querySelectorAll('.ruler.top span').length).toBeGreaterThan(1)
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }))
  await arrived()
}

const shoot = async (file: string): Promise<void> => {
  await new Promise((resolve) => requestAnimationFrame(resolve))
  await page.screenshot({ path: `${OUT}/${file}` })
}

describe.runIf(inject('writeVisuals'))('drawing images for review', () => {
  for (const name of ['ipad-pro-11-landscape', 'ipad-pro-11-portrait']) {
    it(`a Pencil drawing against the dock's south wall at ${name}: loupe, nudge pad and points`, async () => {
      await openDepot(name)
      await tap('pen', 8, 6)
      await tap('pen', 8, 8)
      await tap('pen', 11, 8)
      // The Pencil hovers over the dock's south wall at (11, 6): the loupe shows the corner it would place.
      pointer('pointermove', 'pen', 11, 6)
      await arrived()
      await shoot(`draw-loupe-${name}.png`)
    })
  }

  it('the portal offer after a rectangle against the dock at ipad-pro-11-landscape', async () => {
    await openDepot('ipad-pro-11-landscape')
    ;[...document.querySelectorAll<HTMLElement>('[role="radio"]')]
      .find((radio) => radio.textContent?.trim() === 'Rectangle')
      ?.click()
    await arrived()
    await tap('mouse', 8, 6)
    await tap('mouse', 14, 7.5)
    await tap('mouse', 14, 7.5)
    await shoot('portal-offer-ipad-pro-11-landscape.png')
  })
})
