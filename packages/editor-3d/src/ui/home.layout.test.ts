import '@mcthaydt/automata-editor/tokens.css'
import '@mcthaydt/automata-editor/fonts.css'
import '../main.css'
import { byTestId, checkLayout, settleLayout } from '@mcthaydt/automata/testing'
import { arrived, type EditorSize, SIZES } from '@mcthaydt/automata-editor/kit/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import clinicText from '../testing/fixtures/blockout-clinic.json?raw'
import depotText from '../testing/fixtures/depot.af-sector.json?raw'
import facilityText from '../testing/fixtures/facility.json?raw'
import { startAt, stopEditor } from '../testing/layout-start'

// The 3D editor's Home with the production CSS in a real browser (plan ED3D.5c step 9; 3D editor spec §10 and §12), at
// the eight window sizes both editors are laid out at: the kit's `HomeScreen` with the two imports and the level
// summary. jsdom has no layout, so room (overflow, target sizes, what covers what, which region scrolls) is only
// checked here. Chromium for now; EDK.6a adds WebKit and Firefox.

const region = (name: string): HTMLElement => {
  const found = document.querySelector<HTMLElement>(`[data-region="${name}"]`)
  if (found === null) throw new Error(`no ${name} region`)
  return found
}
const cards = (): HTMLElement[] => [...document.querySelectorAll<HTMLElement>('[role="option"]')]

afterEach(stopEditor)

/** A workspace with the depot, a Last Light clinic and its facility, and `extra` copies of the depot. */
function open(size: EditorSize, extra = 0) {
  return startAt(size, async (workspace) => {
    await workspace.store.write('art/blockout-facility/facility.json', facilityText)
    await workspace.store.write('art/blockout-clinic/blockout.json', clinicText)
    await workspace.store.write('depot/depot.json', depotText)
    for (let n = 0; n < extra; n += 1) await workspace.store.write(`copies/depot-${n + 1}.json`, depotText)
  })
}

const essentials = (size: EditorSize): HTMLElement[] =>
  ['home-search', ...(size.mode === 'wide' ? [] : ['toggle-sources', 'toggle-details'])].map(byTestId)

describe.each(SIZES)('3D Home layout at $name ($width x $height)', (size) => {
  test('rest: no clipped, overlapping, small or unreachable controls, and the page never scrolls', async () => {
    const { conditions } = await open(size)
    await expect.poll(() => cards().length).toBe(3)
    expect(document.querySelector('[data-editor-shell]')).toHaveAttribute('data-mode', size.mode)
    expect(checkLayout(conditions, essentials(size))).toEqual([])
    await page.screenshot({ path: `.vitest/shots/ed3d-home-${size.name}.png` })
  })

  test('a selected level’s Open is reachable and a primary action, in the inspector or the drawer or sheet', async () => {
    const { conditions } = await open(size)
    await expect.poll(() => cards().length).toBe(3)
    const depot = cards().find((card) => card.textContent?.includes('depot.json')) as HTMLElement
    depot.click()
    await arrived()
    expect(region('inspector')).toHaveAttribute('data-open', 'true')
    expect(checkLayout(conditions, [byTestId('summary-open')])).toEqual([])
    expect(byTestId('summary-open').getBoundingClientRect().height).toBeGreaterThanOrEqual(48)
    await page.screenshot({ path: `.vitest/shots/ed3d-home-${size.name}-selected.png` })
  })

  test('the sources panel opens with Import folder and Import zip as full-size targets', async () => {
    const { conditions } = await open(size)
    if (size.mode !== 'wide') {
      byTestId('toggle-sources').click()
      await arrived()
    }
    expect(region('panel')).toHaveAttribute('data-open', 'true')
    // A phone's half-height sheet shows the workspace row; the imports are a scroll of its body away.
    byTestId('import-zip').scrollIntoView({ block: 'nearest' })
    await settleLayout()
    for (const id of ['import-folder', 'import-zip']) {
      const box = byTestId(id).getBoundingClientRect()
      expect(box.width, id).toBeGreaterThanOrEqual(44)
      expect(box.height, id).toBeGreaterThanOrEqual(44)
      const input = (byTestId(id).querySelector('input') as HTMLElement).getBoundingClientRect()
      expect(input.height, `${id}: the input itself is a full-size target`).toBeGreaterThanOrEqual(44)
    }
    expect(checkLayout(conditions, [byTestId('import-folder'), byTestId('import-zip')])).toEqual([])
    await page.screenshot({ path: `.vitest/shots/ed3d-home-${size.name}-sources.png` })
  })

  test('with many levels the list scrolls inside its region and the page stays put', async () => {
    await open(size, 24)
    await expect.poll(() => cards().length).toBe(27)
    const scroller = region('canvas').querySelector<HTMLElement>('[data-scroll-region]') as HTMLElement
    expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight)
    const list = document.querySelector<HTMLElement>('[role="listbox"]') as HTMLElement
    list.focus()
    list.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }))
    await settleLayout()
    const last = cards().at(-1) as HTMLElement
    const view = scroller.getBoundingClientRect()
    expect(last.getBoundingClientRect().bottom).toBeLessThanOrEqual(view.bottom + 1)
    expect(region('canvas').scrollTop).toBe(0)
    expect(document.documentElement.scrollTop).toBe(0)
    expect(document.scrollingElement?.scrollHeight).toBeLessThanOrEqual(window.innerHeight)
  })
})
