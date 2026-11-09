import '#src/shared/ui/theme.css'
import '#src/app/screens/screens.css'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import PlayScreen from '#src/app/screens/PlayScreen.svelte'
import { DEFAULT_SCREENS_COPY } from '#src/app/screens/screens-copy.ts'
import type { TouchButton } from '#src/features/input/keys.ts'
import { LetterboxFrame } from '#src/features/render/letterbox/letterbox.ts'
import { InputMethodTracker } from '#src/shared/ui/browser/input-method.svelte.ts'
import { clearSideBars, publishSideBars } from '#src/shared/ui/geometry/side-bars.ts'
import { mountFixture } from '#src/testing/fixtures/mount.ts'
import { REFERENCE_SIZES, VARIANTS } from '#src/testing/layout/reference-sizes.ts'
import { byTestId, checkLayout, publishConditions } from '#src/testing/ui/layout-contract.ts'
import { settleLayout } from '#src/testing/ui/settle.ts'

// A phone held sideways: the level is fitted in the view and the empty bars beside it hold the touch buttons, so no
// button covers the field. Where a bar is too narrow, or a column of buttons too tall, the row along the foot stays.

const nothing = (): void => {}
const BUTTONS: TouchButton[] = [
  { id: 'touch-0', label: '←', keys: ['ArrowLeft'] },
  { id: 'touch-1', label: '→', keys: ['ArrowRight'] },
  { id: 'touch-2', label: 'Jump', keys: ['Space'], side: 'end' },
]
const sizeNamed = (name: string) => {
  const found = REFERENCE_SIZES.find((size) => size.name === name)
  if (found === undefined) throw new Error(`no reference size ${name}`)
  return found
}

function mountPlay() {
  const tracker = new InputMethodTracker()
  tracker.note('touch')
  return mountFixture(PlayScreen, {
    onPause: nothing,
    tracker,
    touchButtons: BUTTONS,
    onHold: nothing,
    onRelease: nothing,
    copy: { current: DEFAULT_SCREENS_COPY },
  })
}

/** Lays out the letterbox of a 960 x 540 level in this view, as the renderer does, and publishes its bars. */
function publishLetterbox(width: number, height: number) {
  const geometry = new LetterboxFrame({ logicalWidth: 960, logicalHeight: 540 }).layout(width, height)
  publishSideBars(document.documentElement, geometry.sideBars)
  return geometry
}

afterEach(() => {
  clearSideBars(document.documentElement)
  document.body.innerHTML = ''
})

describe('the touch buttons of a phone held sideways', () => {
  test.each(['iphone-14-landscape', 'iphone-pro-max-landscape'])(
    '%s: stand in the bars, off the field',
    async (name) => {
      const size = sizeNamed(name)
      await page.viewport(size.width, size.height)
      const conditions = publishConditions(document.documentElement, size, VARIANTS[0]!)
      const field = publishLetterbox(size.width, size.height)
      const fixture = mountPlay()
      await settleLayout()
      const overlaps: string[] = []
      for (const id of ['touch-0', 'touch-1', 'touch-2']) {
        const box = byTestId(id).getBoundingClientRect()
        const insideField = box.right > field.x + 0.5 && box.left < field.x + field.width - 0.5
        if (insideField) overlaps.push(id)
      }
      expect(overlaps).toEqual([])
      expect(checkLayout(conditions, ['pause', 'touch-0', 'touch-1', 'touch-2'].map(byTestId))).toEqual([])
      await fixture.unmount()
    },
  )

  test('keeps the row along the foot where the bars are too narrow to hold a button', async () => {
    const size = sizeNamed('desktop-720p')
    await page.viewport(size.width, size.height)
    publishLetterbox(size.width, size.height)
    const fixture = mountPlay()
    await settleLayout()
    const first = byTestId('touch-0').getBoundingClientRect()
    const second = byTestId('touch-1').getBoundingClientRect()
    // With no bars the buttons stand in one row along the foot, as before, not in a column.
    expect(second.left).toBeGreaterThanOrEqual(first.right)
    expect(second.top).toBeCloseTo(first.top, 0)
    await fixture.unmount()
  })

  test('keeps the row where a column of buttons would be taller than the screen (TV text scale)', async () => {
    const size = sizeNamed('iphone-14-landscape')
    await page.viewport(size.width, size.height)
    const conditions = publishConditions(
      document.documentElement,
      size,
      VARIANTS.find((v) => v.name === 'tv-scale')!,
    )
    publishLetterbox(size.width, size.height)
    const fixture = mountPlay()
    await settleLayout()
    expect(checkLayout(conditions, ['pause', 'touch-0', 'touch-1', 'touch-2'].map(byTestId))).toEqual([])
    await fixture.unmount()
  })
})
