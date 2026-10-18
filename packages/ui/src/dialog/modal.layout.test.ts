import '../theme.css'
import { mountFixture, REFERENCE_SIZES, VARIANTS } from '@mcthaydt/automata-testing'
import { describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { byTestId, publishConditions } from '../testing/layout-contract'
import ModalFixture from '../testing/ModalFixture.svelte'
import { settleLayout } from '../testing/settle'

// The Modal frame Pause and Settings share (Settings and Pause redo, step 3; FloorFifty `Modal.svelte` at a28dc44):
// on a short, wide band it widens so a long body can set its groups two across, and its content lays out by the
// dialog's own width (container `af-dialog`), not the window's.
const sizeNamed = (name: string) => {
  const size = REFERENCE_SIZES.find((candidate) => candidate.name === name)
  if (size === undefined) throw new Error(`no reference size ${name}`)
  return size
}

async function measure(name: string): Promise<{ width: number; columns: string; headBesideTitle: boolean }> {
  const size = sizeNamed(name)
  await page.viewport(size.width, size.height)
  publishConditions(document.documentElement, size, VARIANTS[0] ?? { name: 'rest' })
  const fixture = mountFixture(ModalFixture, {})
  await settleLayout()
  const width = byTestId('modal-panel').getBoundingClientRect().width
  const columns = getComputedStyle(byTestId('modal-probe')).columnCount
  const title = byTestId('modal-panel').querySelector('h2')?.getBoundingClientRect()
  const head = byTestId('modal-head-probe').getBoundingClientRect()
  const headBesideTitle = title !== undefined && head.top < title.bottom && head.left >= title.right
  await fixture.unmount()
  return { width, columns, headBesideTitle }
}

describe('Modal frame', () => {
  test('widens on a short, wide band, so its groups go two across', async () => {
    const wide = await measure('iphone-14-landscape')
    expect(wide.width).toBeGreaterThanOrEqual(560)
    expect(wide.columns).toBe('2')
  })

  // FloorFifty's tabs sit under its title; on a short band that costs the list a row, so where the dialog has the
  // width they move up beside the title (a 270 px band keeps the first row of the list in view).
  test('sets its head (the tabs) beside the title on a wide dialog, and under it on a narrow one', async () => {
    expect((await measure('iphone-14-landscape')).headBesideTitle).toBe(true)
    expect((await measure('iphone-14')).headBesideTitle).toBe(false)
  })

  test('stays one column on a phone held upright', async () => {
    const tall = await measure('iphone-14')
    expect(tall.width).toBeLessThan(560)
    expect(tall.columns).toBe('1')
  })
})
