import '#src/shared/kit/tokens.css'
import '#src/shared/kit/tool-chrome.css'
import '#src/shared/kit/fonts.css'
import { type MountedFixture, mountFixture, settleLayout } from '@automata/framework/testing'
import { afterEach, describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import AnimationSection from '#src/features/characters/AnimationSection.svelte'
import { newAnimation } from '#src/features/characters/animation-model.ts'
import { editorTargets } from '#src/testing/kit/targets.ts'

// The Animation section with production CSS in a real browser at phone size first, then compact height and the iPad's
// two shapes: the page never scrolls sideways, every control is at least as big as the pointer needs (32 px with a mouse,
// 44 px with touch), and the frames sit in a strip that scrolls inside itself.

const SIZES = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'compact height', width: 844, height: 390 },
  { name: 'ipad portrait', width: 834, height: 1194 },
  { name: 'ipad landscape', width: 1024, height: 768 },
]

let mounted: MountedFixture | undefined
afterEach(async () => {
  await mounted?.unmount()
  mounted = undefined
})

/** Sixteen frames of 16 px: more than a phone shows at once, so the strip has to scroll. */
const PICTURE = new Uint8Array([1])
const props = () => ({
  animation: {
    ...newAnimation('assets/hero.png', { w: 16, h: 24 }),
    clips: [
      { id: 'idle', frames: [0, 1], fps: 6, loop: true },
      { id: 'run', frames: [2, 3, 4], fps: 12, loop: true },
    ],
  },
  size: { w: 16, h: 24 },
  files: { list: async () => [], write: async () => ({ ok: true as const, mtime: 1 }) },
  read: async () => PICTURE,
  measure: async () => ({ w: 16 * 16, h: 24 }),
  onedit: () => ({ ok: true as const }),
})

describe.each(SIZES)('the Animation section at $name ($width x $height)', (size) => {
  async function open() {
    await page.viewport(size.width, size.height)
    mounted = mountFixture(AnimationSection, props())
    await expect.poll(() => document.querySelectorAll('[aria-label^="Frame "]').length).toBe(16)
    await settleLayout()
  }

  test('the page never scrolls sideways', async () => {
    await open()
    const root = document.documentElement
    expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth)
  })

  test('every button and field is as big as the pointer needs', async () => {
    await open()
    const HIT = editorTargets().hit
    const small = [
      ...document.querySelectorAll<HTMLElement>('button, input:not([type="file"]), [role="spinbutton"]'),
    ].flatMap((element) => {
      const box = element.getBoundingClientRect()
      return box.width > 0 && box.height > 0 && (box.height < HIT - 0.5 || box.width < HIT - 0.5)
        ? [
            `${element.getAttribute('aria-label') ?? element.textContent?.trim()} is ${box.width.toFixed(1)} x ${box.height.toFixed(1)}`,
          ]
        : []
    })
    expect(small).toEqual([])
  })

  test('the frames sit in a strip that scrolls inside itself, which stays inside the window', async () => {
    await open()
    const strip = document.querySelector<HTMLElement>('[aria-label="Frames"]')
    if (strip === null) throw new Error('no strip')
    expect(getComputedStyle(strip).overflowX).toBe('auto')
    // Only a phone is too narrow for sixteen frames; wider windows show them all.
    if (size.width < 500) expect(strip.scrollWidth).toBeGreaterThan(strip.clientWidth)
    expect(strip.getBoundingClientRect().right).toBeLessThanOrEqual(size.width)
  })
})
