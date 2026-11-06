import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { REFERENCE_SIZES, VARIANTS } from '#src/testing/layout/reference-sizes.ts'
import { checkLayout, publishConditions, TOUCH_TARGETS } from '#src/testing/ui/layout-contract.ts'

// The target sizes `checkLayout` holds controls to. A game's screens are touch screens, so the default is the touch
// rule: 44 px, a primary 48. A tool held with a mouse (the editors) passes its own, smaller targets; the touch rule
// still holds wherever a finger is the pointer, because the tool's layout tests run once more with touch.

const size = REFERENCE_SIZES[0]
const rest = VARIANTS[0]
if (size === undefined || rest === undefined) throw new Error('no reference size')

afterEach(() => {
  document.body.innerHTML = ''
})

/** One plain icon button and one primary, both drawn `px` square. */
function buttons(px: number): void {
  const style = `width:${px}px;height:${px}px;padding:0`
  document.body.innerHTML = `
    <button aria-label="Undo" style="${style}"></button>
    <button aria-label="Save" data-kind="primary" style="${style}"></button>`
}

describe('checkLayout targets', () => {
  test('hold every control to the touch rule by default', async () => {
    await page.viewport(size.width, size.height)
    buttons(32)
    const conditions = publishConditions(document.documentElement, size, rest)
    expect(conditions.targets).toEqual(TOUCH_TARGETS)
    expect(TOUCH_TARGETS).toEqual({ hit: 44, primary: 48 })
    expect(checkLayout(conditions, [])).toEqual(['button is 32x32', 'button (primary) is 32x32'])
  })

  test('take smaller targets from the conditions for a screen held with a mouse', async () => {
    await page.viewport(size.width, size.height)
    buttons(32)
    const conditions = publishConditions(document.documentElement, size, rest, { hit: 32, primary: 32 })
    expect(checkLayout(conditions, [])).toEqual([])
    buttons(28)
    expect(checkLayout(conditions, [])).toHaveLength(2)
  })
})
