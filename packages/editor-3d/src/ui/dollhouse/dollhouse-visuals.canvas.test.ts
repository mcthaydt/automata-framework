import '@mcthaydt/automata-editor-kit/tokens.css'
import '@mcthaydt/automata-editor-kit/fonts.css'
import '../../main.css'
import { arrived, SIZES } from '@mcthaydt/automata-editor-kit/testing'
import { afterEach, describe, expect, inject, it } from 'vitest'
import { page } from 'vitest/browser'
import depotText from '../../testing/fixtures/depot.af-sector.json?raw'
import { startAt, stopEditor } from '../../testing/layout-start'

// The review images of Split and the 3D view (plan ED3D.5e step 7), for the delegated visual acceptance. Written only
// with `ED3D_VISUALS=1`; never compared against, never a golden.

const OUT = '../../../../../docs/evidence/owner-visual/2026-10-31-ed3d-5e'

afterEach(stopEditor)

const named = (name: string) => {
  const size = SIZES.find((each) => each.name === name)
  if (size === undefined) throw new Error(`no size ${name}`)
  return size
}

function chooseView(name: string): void {
  ;[...document.querySelectorAll<HTMLElement>('[role="radiogroup"][aria-label="View"] [role="radio"]')]
    .find((each) => each.textContent?.trim() === name)
    ?.click()
}

function tapPlanMiddle(): void {
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
        clientX: box.left + box.width * 0.3,
        clientY: box.top + box.height / 2,
      }),
    )
}

async function shoot(file: string): Promise<void> {
  await arrived()
  await new Promise((resolve) => requestAnimationFrame(resolve))
  await new Promise((resolve) => requestAnimationFrame(resolve))
  await page.screenshot({ path: `${OUT}/${file}` })
}

describe.runIf(inject('writeVisuals'))('Split and 3D images for review', () => {
  for (const name of ['ipad-pro-11-landscape', 'ipad-pro-13-landscape']) {
    it(`Split at ${name}, a room selected on the plan`, async () => {
      await startAt(named(name), async (workspace) => {
        await workspace.store.write('depot/depot.json', depotText)
      })
      await expect.poll(() => document.querySelector('[role="option"]')).not.toBeNull()
      document.querySelector('[role="option"]')?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
      await expect.poll(() => document.querySelector('[data-testid="plan-canvas"]')).not.toBeNull()
      chooseView('Split')
      await expect
        .poll(() => document.querySelector('[data-testid="dollhouse-canvas"][data-phase="drawing"]'))
        .not.toBeNull()
      tapPlanMiddle()
      await shoot(`split-${name}.png`)
    })
  }

  it('3D at ipad-pro-11-landscape', async () => {
    await startAt(named('ipad-pro-11-landscape'), async (workspace) => {
      await workspace.store.write('depot/depot.json', depotText)
    })
    await expect.poll(() => document.querySelector('[role="option"]')).not.toBeNull()
    document.querySelector('[role="option"]')?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    await expect.poll(() => document.querySelector('[data-testid="plan-canvas"]')).not.toBeNull()
    chooseView('3D')
    await expect
      .poll(() => document.querySelector('[data-testid="dollhouse-canvas"][data-phase="drawing"]'))
      .not.toBeNull()
    await shoot('dollhouse-ipad-pro-11-landscape.png')
  })
})
