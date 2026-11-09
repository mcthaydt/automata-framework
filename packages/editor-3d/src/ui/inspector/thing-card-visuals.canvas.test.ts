import '@automataframework/automata-editor/tokens.css'
import '@automataframework/automata-editor/fonts.css'
import '../../main.css'
import { arrived, SIZES } from '@automataframework/automata-editor/kit/testing'
import { afterEach, describe, expect, inject, it } from 'vitest'
import { page } from 'vitest/browser'
import depotText from '../../testing/fixtures/depot.af-sector.json?raw'
import { startAt, stopEditor } from '../../testing/layout-start'

// The review image of a thing's card with its fields (plan "field form and journeys" B2), for the delegated visual
// acceptance. Written only with `ED3D_VISUALS=1`; never compared against, never a golden. A crate is placed with the
// Things tool, which leaves it selected, so the inspector shows its contents field.

const OUT = '../../../../../docs/evidence/owner-visual/2026-10-31-ed3d-7d-b'

afterEach(stopEditor)

describe.runIf(inject('writeVisuals'))('the thing card for review', () => {
  it('a placed crate’s card with its contents field at ipad-pro-11-landscape', async () => {
    const size = SIZES.find((each) => each.name === 'ipad-pro-11-landscape')
    if (size === undefined) throw new Error('no size')
    await startAt(size, async (workspace) => {
      await workspace.store.write('depot/depot.json', depotText)
    })
    await expect.poll(() => document.querySelector('[role="option"]')).not.toBeNull()
    document.querySelector('[role="option"]')?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    await expect.poll(() => document.querySelector('[data-phase="drawing"]')).not.toBeNull()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 't' }))
    await arrived()
    ;[...document.querySelectorAll<HTMLElement>('button')]
      .find((button) => button.textContent?.trim() === 'crate')
      ?.click()
    await arrived()
    const plan = document.querySelector<HTMLElement>('[data-testid="plan-canvas"]')
    if (plan === null) throw new Error('no plan')
    const box = plan.getBoundingClientRect()
    for (const type of ['pointermove', 'pointerdown', 'pointerup'])
      plan.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          pointerId: 1,
          pointerType: 'mouse',
          isPrimary: true,
          clientX: box.left + box.width * 0.7,
          clientY: box.top + box.height * 0.5,
          buttons: type === 'pointerup' ? 0 : 1,
        }),
      )
    await arrived()
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await page.screenshot({ path: `${OUT}/inspector-thing-ipad-pro-11-landscape.png` })
  })
})
