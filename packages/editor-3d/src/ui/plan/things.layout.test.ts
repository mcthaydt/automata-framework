import '@automata/editor/tokens.css'
import '@automata/editor/fonts.css'
import '../../main.css'
import { arrived, type EditorSize, SIZES } from '@automata/editor/kit/testing'
import { byTestId, checkLayout } from '@automata/framework/testing'
import { afterEach, describe, expect, test } from 'vitest'
import depotText from '../../testing/fixtures/depot.af-sector.json?raw'
import { startAt, stopEditor } from '../../testing/layout-start'

// The Things tool with the production CSS in Chromium, WebKit and Firefox (plan ED3D.7d step 6; ED3D spec §4.7, §5.4):
// the palette's entries at full size; a journey: T, pick crate, tap the dock (a crate is added, one step), drag it (one
// step), Delete (one step). Plan points become page points through the status line's pointer read-out, as the draw
// journeys do. Phones have no tools (spec §10).

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

const plan = (): HTMLElement => byTestId('plan-canvas')
const statusWords = (): string =>
  document.querySelector('[data-widget="status-line"] [role="status"]')?.textContent?.trim() ?? ''
const undoLabel = (): string => byTestId('undo').getAttribute('aria-label') ?? ''

function pointerAt(type: string, at: { x: number; y: number }): void {
  plan().dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      clientX: at.x,
      clientY: at.y,
      buttons: type === 'pointerup' ? 0 : 1,
    }),
  )
}

/** Page pixels for plan metres, from two hovers and what the status line says they are. */
async function calibrate(): Promise<(x: number, z: number) => { x: number; y: number }> {
  const box = plan().getBoundingClientRect()
  const pages = [
    { x: box.left + box.width * 0.25, y: box.top + box.height * 0.25 },
    { x: box.left + box.width * 0.75, y: box.top + box.height * 0.75 },
  ]
  const read = (axis: 'x' | 'z') =>
    Number(new RegExp(`${axis} (\\S+) m`).exec(statusWords())?.[1]?.replace('−', '-'))
  const plans: { x: number; z: number }[] = []
  for (const at of pages) {
    plan().dispatchEvent(
      new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse', clientX: at.x, clientY: at.y }),
    )
    await arrived()
    plans.push({ x: read('x'), z: read('z') })
  }
  const [p0, p1] = pages as [{ x: number; y: number }, { x: number; y: number }]
  const [m0, m1] = plans as [{ x: number; z: number }, { x: number; z: number }]
  return (x, z) => ({
    x: p0.x + ((x - m0.x) * (p1.x - p0.x)) / (m1.x - m0.x),
    y: p0.y + ((z - m0.z) * (p1.y - p0.y)) / (m1.z - m0.z),
  })
}

function pressNamed(name: string): void {
  const found = [...document.querySelectorAll<HTMLElement>('button')].find(
    (button) => button.textContent?.trim() === name,
  )
  if (found === undefined) throw new Error(`no ${name}`)
  found.click()
}

describe.each(SIZES.filter((size) => size.mode !== 'compact'))(
  'the Things tool at $name ($width x $height)',
  (size) => {
    test('the palette at full size; place a crate, drag it, delete it, each one step', async () => {
      const { conditions } = await openDepot(size)
      const pageOf = await calibrate()
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 't' }))
      await arrived()
      const palette = byTestId('things-palette')
      expect(checkLayout(conditions, [...palette.querySelectorAll<HTMLElement>('button')])).toEqual([])
      pressNamed('crate')
      await arrived()
      const at = pageOf(11, 4.5)
      for (const type of ['pointermove', 'pointerdown', 'pointerup']) pointerAt(type, at)
      await arrived()
      expect(undoLabel()).toMatch(/^Undo Add crate/)
      const to = pageOf(12, 4.5)
      pointerAt('pointerdown', at)
      for (let step = 1; step <= 4; step++)
        pointerAt('pointermove', { x: at.x + ((to.x - at.x) * step) / 4, y: at.y })
      pointerAt('pointerup', to)
      await arrived()
      expect(undoLabel()).toMatch(/^Undo Move crate/)
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }))
      await arrived()
      expect(undoLabel()).toMatch(/^Undo Remove crate/)
    })
  },
)
