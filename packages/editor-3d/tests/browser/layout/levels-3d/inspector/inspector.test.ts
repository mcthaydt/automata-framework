import '@automata/editor/tokens.css'
import '@automata/editor/fonts.css'
import '#src/app/main.css'
import { arrived, type EditorSize, SIZES } from '@automata/editor/kit/testing'
import { byTestId, checkLayout } from '@automata/framework/testing'
import { afterEach, describe, expect, test } from 'vitest'
import depotText from '#src/testing/fixtures/depot.af-sector.json?raw'
import { startAt, stopEditor } from '#src/testing/layout-start.ts'

// The inspector with the production CSS in Chromium, WebKit and Firefox (plan ED3D.5f step 8; ED3D spec §9, §10): at
// `wide` the selected room's card in the inspector column, every control on screen at full size once scrolled to; below
// it the tool strip over the plan's foot, clear of the status line, and the sheet's tabs at full size. A room is selected
// with a finger's tap on the plan, as a person would.

afterEach(stopEditor)

async function openDepot(size: EditorSize) {
  const started = await startAt(size, async (workspace) => {
    await workspace.store.write('depot/depot.json', depotText)
  })
  await expect.poll(() => document.querySelectorAll('[role="option"]').length).toBeGreaterThan(0)
  document
    .querySelector<HTMLElement>('[role="option"]')
    ?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
  await expect.poll(() => document.querySelector('[data-testid="plan-canvas"]')).not.toBeNull()
  await arrived()
  return started
}

const statusWords = (): string =>
  document.querySelector('[data-widget="status-line"] [role="status"]')?.textContent?.trim() ?? ''

/** Taps across the plan with a finger until a room or a wall is selected. */
async function tapARoom(): Promise<void> {
  const plan = byTestId('plan-canvas')
  const { left, top, width, height } = plan.getBoundingClientRect()
  for (const fy of [0.45, 0.35, 0.55])
    for (const fx of [0.3, 0.5, 0.7]) {
      for (const type of ['pointerdown', 'pointerup'])
        plan.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            pointerId: 1,
            pointerType: 'touch',
            isPrimary: true,
            clientX: left + width * fx,
            clientY: top + height * fy,
            buttons: type === 'pointerdown' ? 1 : 0,
          }),
        )
      await arrived()
      if (/(Room|Wall) .+ selected/.test(statusWords())) return
    }
  throw new Error(`no room under the taps: ${statusWords()}`)
}

const statusTop = (): number =>
  document.querySelector('[data-widget="status-line"]')?.getBoundingClientRect().top ??
  Number.POSITIVE_INFINITY

describe.each(SIZES.filter((size) => size.mode !== 'compact'))(
  'the inspector at $name ($width x $height)',
  (size) => {
    test('the selected room’s card: its controls on screen at full size, scrolled to; the strip and sheet below wide', async () => {
      const { conditions } = await openDepot(size)
      await tapARoom()
      // A wide window narrower than 1100 px leaves the plan its width: no inspector column; the status line names the room.
      if (size.mode === 'wide' && size.width < 1100) {
        expect(document.querySelector('[data-testid="inspector"]')).toBeNull()
        expect(statusWords()).toMatch(/(Room|Wall) .+ selected/)
        return
      }
      const inspector = byTestId('inspector')
      const controls = [
        ...inspector.querySelectorAll<HTMLElement>('button, [role="spinbutton"], [role="slider"]'),
      ]
      expect(controls.length).toBeGreaterThan(3)
      const problems: string[] = []
      for (const control of controls) {
        if (control.hasAttribute('disabled')) continue
        control.scrollIntoView({ block: 'nearest' })
        await arrived()
        problems.push(...checkLayout(conditions, [control]))
      }
      expect(problems).toEqual([])
      if (size.mode === 'wide') return
      const strip = byTestId('tool-strip')
      expect(checkLayout(conditions, [...strip.querySelectorAll<HTMLElement>('button')])).toEqual([])
      expect(strip.getBoundingClientRect().bottom).toBeLessThanOrEqual(statusTop())
      const tabs = [...byTestId('portrait-sheet').querySelectorAll<HTMLElement>('[role="tab"]')]
      tabs[0]?.scrollIntoView({ block: 'nearest' })
      await arrived()
      expect(tabs.map((tab) => tab.textContent?.trim())).toEqual(['Sector', 'Walls', 'Things', 'Checks'])
      expect(checkLayout(conditions, tabs)).toEqual([])
    })
  },
)
