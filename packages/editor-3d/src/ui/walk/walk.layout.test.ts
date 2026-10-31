import '@mcthaydt/automata-editor-kit/tokens.css'
import '@mcthaydt/automata-editor-kit/fonts.css'
import '../../main.css'
import { arrived, type EditorSize, SIZES } from '@mcthaydt/automata-editor-kit/testing'
import { byTestId, checkLayout } from '@mcthaydt/automata-ui/testing'
import { afterEach, describe, expect, test } from 'vitest'
import depotText from '../../testing/fixtures/depot.af-sector.json?raw'
import { startAt, stopEditor } from '../../testing/layout-start'

// Walk with the production CSS in Chromium, WebKit and Firefox (plan ED3D.8b; ED3D spec §5.3 flow 4, §10): the view fills
// the canvas region; its HUD (the mode switch, the minimap, the sticks, Fly's Up and Down) is on screen inside the region
// at the touch sizes; the status line names what the crosshair is on or why the view cannot draw. Where the page cannot
// draw (Firefox here has no WebGL2) the notice takes the canvas's place and the HUD's words still show.

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

/** Whether the page could not draw: the notice, not the HUD, is the view. */
const cannotDraw = (): boolean => byTestId('walk-canvas').dataset.phase === 'unavailable'

const region = (): DOMRect => {
  const found = document.querySelector('[data-region="canvas"]')
  if (found === null) throw new Error('no canvas region')
  return found.getBoundingClientRect()
}

function inside(inner: DOMRect, outer: DOMRect): boolean {
  return (
    inner.left >= outer.left - 1 &&
    inner.top >= outer.top - 1 &&
    inner.right <= outer.right + 1 &&
    inner.bottom <= outer.bottom + 1
  )
}

describe.each(SIZES.filter((size) => size.mode === 'wide'))('Walk at $name ($width x $height)', (size) => {
  test('fills the canvas region, and its HUD is on screen inside it at full size', async () => {
    const { conditions } = await openDepot(size)
    chooseView('Walk')
    await arrived()
    await expect
      .poll(() => document.querySelector('[data-testid="walk-hud"]') !== null || cannotDraw())
      .toBe(true)
    const whole = region()
    const walk = byTestId('walk-canvas').getBoundingClientRect()
    expect(Math.abs(walk.width - whole.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(walk.height - whole.height)).toBeLessThanOrEqual(1)
    if (cannotDraw()) {
      const again = [...document.querySelectorAll<HTMLElement>('[data-testid="walk-canvas"] button')]
      expect(again).toHaveLength(1)
      expect(checkLayout(conditions, again)).toEqual([])
      return
    }
    const hud = byTestId('walk-hud')
    const controls = [...hud.querySelectorAll<HTMLElement>('button, [role="radio"]')]
    expect(controls.length).toBeGreaterThan(1)
    expect(checkLayout(conditions, controls)).toEqual([])
    for (const control of controls) expect(inside(control.getBoundingClientRect(), whole)).toBe(true)
    expect(inside(byTestId('walk-minimap').getBoundingClientRect(), whole)).toBe(true)
  })

  test('Fly offers Up and Down at full size', async () => {
    const { conditions } = await openDepot(size)
    chooseView('Walk')
    await arrived()
    await expect
      .poll(() => document.querySelector('[data-testid="walk-hud"]') !== null || cannotDraw())
      .toBe(true)
    if (cannotDraw()) return
    const mode = [...document.querySelectorAll<HTMLElement>('[role="radiogroup"] [role="radio"]')].find(
      (each) => each.textContent?.trim() === 'Fly',
    )
    if (mode === undefined) throw new Error('no Fly mode')
    mode.click()
    await arrived()
    const flying = [
      ...document.querySelectorAll<HTMLElement>('button[aria-label="Fly up"], button[aria-label="Fly down"]'),
    ]
    expect(flying).toHaveLength(2)
    expect(checkLayout(conditions, flying)).toEqual([])
  })
})
