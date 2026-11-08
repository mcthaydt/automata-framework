import '#src/shared/ui/theme.css'
import { describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { mountFixture } from '#src/testing/fixtures/mount.ts'
import { REFERENCE_SIZES, VARIANTS } from '#src/testing/layout/reference-sizes.ts'
import { byTestId, publishConditions } from '#src/testing/ui/layout-contract.ts'
import ModalFixture from '#src/testing/ui/ModalFixture.svelte'
import { settleLayout } from '#src/testing/ui/settle.ts'

// The Modal frame Pause and Settings share (Settings and Pause redo, step 3; FloorFifty `Modal.svelte` at a28dc44):
// on a short, wide band it widens so a long body can set its groups two across, and its content lays out by the
// dialog's own width (container `af-dialog`), not the window's.
const sizeNamed = (name: string) => {
  const size = REFERENCE_SIZES.find((candidate) => candidate.name === name)
  if (size === undefined) throw new Error(`no reference size ${name}`)
  return size
}

async function measure(
  name: string,
  wide = true,
): Promise<{ width: number; columns: string; headBesideTitle: boolean; ringClipped: boolean }> {
  const size = sizeNamed(name)
  await page.viewport(size.width, size.height)
  publishConditions(document.documentElement, size, VARIANTS[0] ?? { name: 'rest' })
  const fixture = mountFixture(ModalFixture, { wide })
  await settleLayout()
  // A focused control's ring (outside its box by the ring's room) stays inside the body that scrolls it.
  const ringed = byTestId('modal-ringed').getBoundingClientRect()
  const body = (
    byTestId('modal-panel').querySelector('.af-modal__body') as HTMLElement
  ).getBoundingClientRect()
  const room = 4
  const ringClipped =
    ringed.left - room < body.left || ringed.right + room > body.right || ringed.bottom + room > body.bottom
  const width = byTestId('modal-panel').getBoundingClientRect().width
  const columns = getComputedStyle(byTestId('modal-probe')).columnCount
  const title = byTestId('modal-panel').querySelector('h2')?.getBoundingClientRect()
  const head = byTestId('modal-head-probe').getBoundingClientRect()
  const headBesideTitle = title !== undefined && head.top < title.bottom && head.left >= title.right
  await fixture.unmount()
  return { width, columns, headBesideTitle, ringClipped }
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

  // FloorFifty widens only the dialog whose body sets its groups two across (Settings); its Pause stays compact.
  test('widens only when asked: a dialog that is not wide keeps its width on a short band', async () => {
    expect((await measure('iphone-14-landscape', false)).width).toBeLessThanOrEqual(512)
  })

  test('keeps room for a focused control’s ring inside its body', async () => {
    expect((await measure('iphone-14-landscape')).ringClipped).toBe(false)
    expect((await measure('iphone-14')).ringClipped).toBe(false)
  })

  test('stays one column on a phone held upright', async () => {
    const tall = await measure('iphone-14')
    expect(tall.width).toBeLessThan(560)
    expect(tall.columns).toBe('1')
  })
})
