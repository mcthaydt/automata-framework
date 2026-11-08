import '@mcthaydt/automata-editor/tokens.css'
import '@mcthaydt/automata-editor/fonts.css'
import '../../main.css'
import { checkLayout } from '@mcthaydt/automata/testing'
import { arrived, SIZES } from '@mcthaydt/automata-editor/kit/testing'
import { afterEach, describe, expect, test } from 'vitest'
import depotText from '../../testing/fixtures/depot.af-sector.json?raw'
import { startAt, stopEditor } from '../../testing/layout-start'

// New level and the definitions sheet with the production CSS in Chromium, WebKit and Firefox (plan ED3D.13b; ED3D spec
// §9, §10): New level's dialog from Home and the definitions sheet from the inspector, each inside the window with its
// controls at full touch size. The sheet is reached from the inspector (a column at wide, the sheet's Sector tab below).

afterEach(stopEditor)

const buttonNamed = (text: string): HTMLElement | undefined =>
  [...document.querySelectorAll<HTMLElement>('button')].find((each) => each.textContent?.trim() === text)

const dialogBox = (): DOMRect => {
  const found = document.querySelector('[role="dialog"]')
  if (found === null) throw new Error('no dialog')
  return found.getBoundingClientRect()
}

describe.each(SIZES.filter((size) => size.mode !== 'compact'))(
  'New level and definitions at $name ($width x $height)',
  (size) => {
    test('New level’s dialog from Home fits the window, its controls at full size', async () => {
      const { conditions } = await startAt(size, async (workspace) => {
        await workspace.store.write('depot/depot.json', depotText)
      })
      await expect.poll(() => buttonNamed('New level…')).toBeDefined()
      buttonNamed('New level…')?.click()
      await expect.poll(() => document.querySelector('[role="dialog"]')).not.toBeNull()
      await arrived()
      const box = dialogBox()
      expect(box.left).toBeGreaterThanOrEqual(0)
      expect(box.top).toBeGreaterThanOrEqual(0)
      expect(box.right).toBeLessThanOrEqual(window.innerWidth)
      expect(box.bottom).toBeLessThanOrEqual(window.innerHeight)
      const controls = [
        ...document.querySelectorAll<HTMLElement>('[role="dialog"] button, [role="dialog"] input'),
      ]
      expect(controls.length).toBeGreaterThan(1)
      expect(checkLayout(conditions, controls)).toEqual([])
    })

    test('the definitions sheet from the inspector fits the window, its controls at full size', async () => {
      const { conditions } = await startAt(size, async (workspace) => {
        await workspace.store.write('depot/depot.json', depotText)
      })
      await expect.poll(() => document.querySelectorAll('[role="option"]').length).toBeGreaterThan(0)
      document
        .querySelector<HTMLElement>('[role="option"]')
        ?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
      await expect.poll(() => document.querySelector('[data-testid="plan-canvas"]')).not.toBeNull()
      await arrived()
      // A wide window narrower than 1100 px leaves the plan its width: there is no inspector, so no sheet to reach.
      if (size.mode === 'wide' && size.width < 1100) return
      await expect.poll(() => buttonNamed('Definitions…')).toBeDefined()
      buttonNamed('Definitions…')?.click()
      await expect.poll(() => document.querySelector('[role="dialog"]')).not.toBeNull()
      await arrived()
      const box = dialogBox()
      expect(box.left).toBeGreaterThanOrEqual(0)
      expect(box.right).toBeLessThanOrEqual(window.innerWidth)
      expect(box.bottom).toBeLessThanOrEqual(window.innerHeight)
      const controls = [
        ...document.querySelectorAll<HTMLElement>(
          '[role="dialog"] button, [role="dialog"] input:not([type="checkbox"]), [role="dialog"] select',
        ),
      ]
      expect(controls.length).toBeGreaterThan(4)
      const problems: string[] = []
      for (const control of controls) {
        control.scrollIntoView({ block: 'nearest' })
        await arrived()
        problems.push(...checkLayout(conditions, [control]))
      }
      expect(problems).toEqual([])
    })
  },
)
