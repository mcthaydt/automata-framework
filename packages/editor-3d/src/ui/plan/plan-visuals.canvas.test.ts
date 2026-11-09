import '@automataframework/automata-editor/tokens.css'
import '@automataframework/automata-editor/fonts.css'
import '../../main.css'
import { arrived, SIZES } from '@automataframework/automata-editor/kit/testing'
import { afterEach, describe, expect, inject, it } from 'vitest'
import { page } from 'vitest/browser'
import depotText from '../../testing/fixtures/depot.af-sector.json?raw'
import { startAt, stopEditor } from '../../testing/layout-start'

// The review images of the Plan view (plan ED3D.5d step 9), for the visual acceptance the Owner delegated ("Auto
// approve all visual acceptance too", recorded once a reviewer has opened them). Written only with `ED3D_VISUALS=1`;
// never compared against, never a golden.

declare module 'vitest' {
  interface ProvidedContext {
    writeVisuals: boolean
  }
}

/** From this file's folder to the evidence folder (screenshot paths are relative to the test file). */
const OUT = '../../../../../docs/evidence/owner-visual/2026-10-30-ed3d-5d'

afterEach(stopEditor)

const named = (name: string) => {
  const size = SIZES.find((each) => each.name === name)
  if (size === undefined) throw new Error(`no size ${name}`)
  return size
}

/** Taps the middle of the plan with a finger, as the layout journey does. */
function tapMiddle(): void {
  const plan = document.querySelector<HTMLElement>('[data-testid="plan-canvas"]')
  if (plan === null) throw new Error('no plan')
  const box = plan.getBoundingClientRect()
  for (const type of ['pointerdown', 'pointerup']) {
    plan.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        pointerId: 1,
        pointerType: 'touch',
        isPrimary: true,
        clientX: box.left + box.width / 2,
        clientY: box.top + box.height / 2,
      }),
    )
  }
}

describe.runIf(inject('writeVisuals'))('Plan view images for review', () => {
  for (const name of ['ipad-pro-11-landscape', 'ipad-pro-11-portrait', 'phone-portrait']) {
    it(`the depot at ${name}, a room selected`, async () => {
      await startAt(named(name), async (workspace) => {
        await workspace.store.write('depot/depot.json', depotText)
      })
      await expect.poll(() => document.querySelector('[role="option"]')).not.toBeNull()
      document.querySelector('[role="option"]')?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
      await expect.poll(() => document.querySelector('[data-phase="drawing"]')).not.toBeNull()
      tapMiddle()
      await arrived()
      await new Promise((resolve) => requestAnimationFrame(resolve))
      await page.screenshot({ path: `${OUT}/plan-${name}.png` })
    })
  }
})
