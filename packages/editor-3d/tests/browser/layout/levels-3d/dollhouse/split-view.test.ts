import '@automata/editor/tokens.css'
import '@automata/editor/fonts.css'
import '#src/app/main.css'
import { arrived, type EditorSize, SIZES } from '@automata/editor/kit/testing'
import { byTestId, checkLayout } from '@automata/framework/testing'
import { afterEach, describe, expect, test } from 'vitest'
import depotText from '#src/testing/fixtures/depot.af-sector.json?raw'
import { startAt, stopEditor } from '#src/testing/layout-start.ts'

// Split and 3D with the production CSS in Chromium, WebKit and Firefox (plan ED3D.5e step 7; ED3D spec §9 the Split
// frame, §10) at the kit's `wide` sizes, where the bar offers the views: Split puts the plan and the 3D view side by side,
// each half of the canvas region and its full height; 3D fills the region; a finger's tap in the 3D view selects a room,
// which the status line names. Where the page cannot draw (Firefox here has no WebGL2), the tap still selects.

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

function chooseView(name: string): void {
  const radio = [
    ...document.querySelectorAll<HTMLElement>('[role="radiogroup"][aria-label="View"] [role="radio"]'),
  ].find((each) => each.textContent?.trim() === name)
  if (radio === undefined) throw new Error(`no ${name} view`)
  radio.click()
}

const box = (element: Element) => element.getBoundingClientRect()
const region = (): DOMRect => {
  const found = document.querySelector('[data-region="canvas"]')
  if (found === null) throw new Error('no canvas region')
  return found.getBoundingClientRect()
}
const statusWords = (): string =>
  document.querySelector('[data-widget="status-line"] [role="status"]')?.textContent?.trim() ?? ''

describe.each(SIZES.filter((size) => size.mode === 'wide'))(
  'Split and 3D at $name ($width x $height)',
  (size) => {
    test('Split puts the plan and the 3D view side by side; 3D fills the region; the views are at full size', async () => {
      const { conditions } = await openDepot(size)
      const views = [
        ...document.querySelectorAll<HTMLElement>('[role="radiogroup"][aria-label="View"] [role="radio"]'),
      ]
      expect(checkLayout(conditions, views)).toEqual([])
      chooseView('Split')
      await arrived()
      const plan = box(byTestId('plan-canvas'))
      const dollhouse = box(byTestId('dollhouse-canvas'))
      const whole = region()
      expect(Math.abs(plan.width - dollhouse.width)).toBeLessThanOrEqual(1)
      expect(plan.width + dollhouse.width).toBeGreaterThan(whole.width - 3)
      expect(dollhouse.left).toBeGreaterThanOrEqual(plan.right)
      expect(Math.abs(plan.height - whole.height)).toBeLessThanOrEqual(1)
      expect(Math.abs(dollhouse.height - whole.height)).toBeLessThanOrEqual(1)
      chooseView('3D')
      await arrived()
      expect(document.querySelector('[data-testid="plan-canvas"]')).toBeNull()
      expect(Math.abs(box(byTestId('dollhouse-canvas')).width - whole.width)).toBeLessThanOrEqual(1)
    })

    test('a finger’s tap in the 3D view selects a room, which the status line names', async () => {
      await openDepot(size)
      chooseView('3D')
      await arrived()
      const host = byTestId('dollhouse-canvas')
      const { left, top, width, height } = box(host)
      // The orbit looks at the middle of the level: a tap a little below the middle lands on a floor.
      for (const type of ['pointerdown', 'pointerup'])
        host.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            pointerId: 1,
            pointerType: 'touch',
            isPrimary: true,
            clientX: left + width / 2,
            clientY: top + height * 0.55,
            buttons: type === 'pointerdown' ? 1 : 0,
          }),
        )
      await arrived()
      expect(statusWords()).toMatch(/Room \S+ selected/)
    })
  },
)
