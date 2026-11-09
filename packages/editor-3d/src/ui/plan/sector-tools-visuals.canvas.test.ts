import '@automataframework/automata-editor/tokens.css'
import '@automataframework/automata-editor/fonts.css'
import '../../main.css'
import { arrived, SIZES } from '@automataframework/automata-editor/kit/testing'
import { afterEach, describe, expect, inject, it } from 'vitest'
import { page } from 'vitest/browser'
import depotText from '../../testing/fixtures/depot.af-sector.json?raw'
import { startAt, stopEditor } from '../../testing/layout-start'

// The review images of the Plan view's tools (plan ED3D.6g-a step 8), for the delegated visual acceptance ("Auto
// approve all visual acceptance too", recorded once a reviewer has opened them). Written only with `ED3D_VISUALS=1`;
// never compared against, never a golden. The `writeVisuals` flag is declared in `plan-visuals.canvas.test.ts`.

const OUT = '../../../../../docs/evidence/owner-visual/2026-10-31-ed3d-6g-a'

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

function pen(type: string, x: number, y: number): void {
  const box = plan().getBoundingClientRect()
  plan().dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
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

const penTap = (x: number, y: number): void => {
  for (const type of ['pointermove', 'pointerdown', 'pointerup']) pen(type, x, y)
}

describe.runIf(inject('writeVisuals'))('Plan tool images for review', () => {
  for (const name of ['ipad-pro-11-landscape', 'ipad-pro-11-portrait']) {
    it(`a Pencil drawing three corners at ${name}, hovering the fourth`, async () => {
      await startAt(named(name), async (workspace) => {
        await workspace.store.write('depot/depot.json', depotText)
      })
      await expect.poll(() => document.querySelector('[role="option"]')).not.toBeNull()
      document.querySelector('[role="option"]')?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
      await expect.poll(() => document.querySelector('[data-phase="drawing"]')).not.toBeNull()
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }))
      await arrived()
      const { width, height } = plan().getBoundingClientRect()
      const x = Math.round(width * 0.25)
      const y = Math.max(90, Math.round(height * 0.1))
      penTap(x, y)
      penTap(x + 150, y)
      penTap(x + 150, y + 70)
      pen('pointermove', x + 40, y + 70)
      await arrived()
      await new Promise((resolve) => requestAnimationFrame(resolve))
      await page.screenshot({ path: `${OUT}/draw-${name}.png` })
    })
  }

  it('no tool rail at phone-portrait: the plan keeps the height', async () => {
    await startAt(named('phone-portrait'), async (workspace) => {
      await workspace.store.write('depot/depot.json', depotText)
    })
    await expect.poll(() => document.querySelector('[role="option"]')).not.toBeNull()
    document.querySelector('[role="option"]')?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    await expect.poll(() => document.querySelector('[data-phase="drawing"]')).not.toBeNull()
    await arrived()
    await page.screenshot({ path: `${OUT}/phone-portrait.png` })
  })
})
