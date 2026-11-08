import '@automata/editor/tokens.css'
import '@automata/editor/fonts.css'
import '#src/app/main.css'
import { arrived, SIZES } from '@automata/editor/kit/testing'
import { afterEach, describe, expect, inject, it } from 'vitest'
import { page } from 'vitest/browser'
import depotText from '#src/testing/fixtures/depot.af-sector.json?raw'
import { startAt, stopEditor } from '#src/testing/layout-start.ts'

// The review images of the Things tool (plan ED3D.7d step 6), for the delegated visual acceptance. Written only with
// `ED3D_VISUALS=1`; never compared against, never a golden.

const OUT = '../../../../../docs/evidence/owner-visual/2026-10-31-ed3d-7d'

afterEach(stopEditor)

describe.runIf(inject('writeVisuals'))('Things images for review', () => {
  for (const name of ['ipad-pro-11-landscape', 'ipad-pro-11-portrait']) {
    it(`the Things tool with crate picked and a pointer over the dock at ${name}`, async () => {
      const size = SIZES.find((each) => each.name === name)
      if (size === undefined) throw new Error(name)
      await startAt(size, async (workspace) => {
        await workspace.store.write('depot/depot.json', depotText)
      })
      await expect.poll(() => document.querySelector('[role="option"]')).not.toBeNull()
      document.querySelector('[role="option"]')?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
      await expect.poll(() => document.querySelector('[data-phase="drawing"]')).not.toBeNull()
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 't' }))
      await arrived()
      ;[...document.querySelectorAll<HTMLElement>('[data-testid="things-palette"] button')]
        .find((button) => button.textContent?.trim() === 'crate')
        ?.click()
      const plan = document.querySelector<HTMLElement>('[data-testid="plan-canvas"]')
      const box = plan?.getBoundingClientRect()
      if (plan === null || box === undefined) throw new Error('no plan')
      plan.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          pointerType: 'mouse',
          clientX: box.left + box.width * 0.72,
          clientY: box.top + box.height * 0.6,
        }),
      )
      await arrived()
      await new Promise((resolve) => requestAnimationFrame(resolve))
      await page.screenshot({ path: `${OUT}/things-${name}.png` })
    })
  }
})
