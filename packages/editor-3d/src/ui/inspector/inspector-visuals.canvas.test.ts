import '@mcthaydt/automata-editor/tokens.css'
import '@mcthaydt/automata-editor/fonts.css'
import '../../main.css'
import { arrived, SIZES } from '@mcthaydt/automata-editor/kit/testing'
import { afterEach, describe, expect, inject, it } from 'vitest'
import { page } from 'vitest/browser'
import depotText from '../../testing/fixtures/depot.af-sector.json?raw'
import { startAt, stopEditor } from '../../testing/layout-start'

// The review images of the inspector and the portrait layout (plan ED3D.5f step 8), for the delegated visual acceptance.
// Written only with `ED3D_VISUALS=1`; never compared against, never a golden.

const OUT = '../../../../../docs/evidence/owner-visual/2026-10-31-ed3d-5f'

afterEach(stopEditor)

const named = (name: string) => {
  const size = SIZES.find((each) => each.name === name)
  if (size === undefined) throw new Error(`no size ${name}`)
  return size
}

async function openDepot(name: string): Promise<void> {
  await startAt(named(name), async (workspace) => {
    await workspace.store.write('depot/depot.json', depotText)
  })
  await expect.poll(() => document.querySelector('[role="option"]')).not.toBeNull()
  document.querySelector('[role="option"]')?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
  await expect.poll(() => document.querySelector('[data-phase="drawing"]')).not.toBeNull()
}

/** A finger's tap at a fraction of the plan. */
function tapPlan(fx: number, fy: number): void {
  const plan = document.querySelector<HTMLElement>('[data-testid="plan-canvas"]')
  if (plan === null) throw new Error('no plan')
  const box = plan.getBoundingClientRect()
  for (const type of ['pointerdown', 'pointerup'])
    plan.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        pointerId: 1,
        pointerType: 'touch',
        isPrimary: true,
        clientX: box.left + box.width * fx,
        clientY: box.top + box.height * fy,
      }),
    )
}

async function shoot(file: string): Promise<void> {
  await arrived()
  await new Promise((resolve) => requestAnimationFrame(resolve))
  await page.screenshot({ path: `${OUT}/${file}` })
}

describe.runIf(inject('writeVisuals'))('inspector images for review', () => {
  it('the hall’s card in the inspector at ipad-pro-11-landscape', async () => {
    await openDepot('ipad-pro-11-landscape')
    tapPlan(0.3, 0.5)
    await shoot('inspector-sector-ipad-pro-11-landscape.png')
  })

  it('the door wall’s card, chosen from the Walls tab, at ipad-pro-11-portrait', async () => {
    await openDepot('ipad-pro-11-portrait')
    tapPlan(0.3, 0.5)
    await arrived()
    const press = (name: string) =>
      [
        ...document.querySelectorAll<HTMLElement>(
          '[data-testid="portrait-sheet"] [role="tab"], [data-testid="portrait-sheet"] button',
        ),
      ]
        .find((each) => each.textContent?.trim() === name)
        ?.click()
    press('Walls')
    await arrived()
    press('Wall 4 · door · 6.00 m')
    await arrived()
    press('Sector')
    await shoot('portrait-wall-ipad-pro-11-portrait.png')
  })

  it('the portrait sheet with the hall selected at ipad-pro-11-portrait', async () => {
    await openDepot('ipad-pro-11-portrait')
    tapPlan(0.3, 0.5)
    await shoot('portrait-ipad-pro-11-portrait.png')
  })
})
