import '@mcthaydt/automata-editor-kit/tokens.css'
import '@mcthaydt/automata-editor-kit/fonts.css'
import '../../main.css'
import { arrived, type EditorSize, SIZES } from '@mcthaydt/automata-editor-kit/testing'
import { byTestId } from '@mcthaydt/automata-ui/testing'
import { afterEach, describe, expect, test } from 'vitest'
import depotText from '../../testing/fixtures/depot.af-sector.json?raw'
import { startAt, stopEditor } from '../../testing/layout-start'
import { textOf } from '../../testing/memory-workspace'

// The ED3-r placement journey with the production CSS in Chromium, WebKit and Firefox (plan "field form and journeys" B3;
// ED3D spec §4.7, §13): pick crate and place two on the dock, set the second one's contents in the inspector, Save and
// reopen: both crates and the value are in the file. Picking spawn and placing a second is refused by `single`, in
// words. Plan points become page points through the status line's pointer read-out, as the draw journeys do. Phones
// have no tools (spec §10).

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

const DEPOT = 'depot/depot.json'

describe.each(SIZES.filter((size) => size.mode !== 'compact'))(
  'the placement journey at $name ($width x $height)',
  (size) => {
    test('place two crates, set one’s contents, Save, reopen; a second spawn is refused', async () => {
      const { workspace } = await openDepot(size)
      const pageOf = await calibrate()
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 't' }))
      await arrived()

      pressNamed('crate')
      await arrived()
      for (const place of [pageOf(10, 4.5), pageOf(12.5, 4.5)])
        for (const type of ['pointermove', 'pointerdown', 'pointerup']) pointerAt(type, place)
      await arrived()
      expect(undoLabel()).toMatch(/^Undo Add crate/)

      // The second crate is selected. Where the layout has an inspector (a column from 1100 px, or the portrait sheet) its
      // card has the contents field; the 900 x 600 window has none yet (veto item of #350), so there the crates keep the
      // default.
      const inspector = document.querySelector<HTMLElement>('[data-testid="inspector"]')
      if (inspector !== null) {
        const radios = (): HTMLElement[] => [...inspector.querySelectorAll<HTMLElement>('[role="radio"]')]
        const empty = radios().find((radio) => radio.textContent?.trim() === 'empty')
        expect(empty, 'the thing card shows the contents field').toBeDefined()
        expect(
          radios()
            .find((radio) => radio.getAttribute('aria-checked') === 'true')
            ?.textContent?.trim(),
        ).toBe('supplies')
        empty?.click()
        await arrived()
        expect(undoLabel()).toMatch(/^Undo Set contents of/)
      }
      const second = inspector === null ? 'supplies' : 'empty'

      byTestId('save').click()
      await expect
        .poll(async () => {
          const file = JSON.parse(textOf(await workspace.store.read(DEPOT)) ?? '{}') as {
            entities?: { def: string; contents?: string }[]
          }
          return file.entities
            ?.filter((thing) => thing.def === 'crate')
            .map((thing) => thing.contents ?? null)
        })
        .toEqual(['tools', 'supplies', second])

      pressNamed('spawn')
      await arrived()
      const spot = pageOf(9, 1.5)
      for (const type of ['pointermove', 'pointerdown', 'pointerup']) pointerAt(type, spot)
      await arrived()
      expect(byTestId('tool-refusal').textContent).toMatch(/spawn/)
    })
  },
)
