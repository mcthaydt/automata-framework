// The menu's Settings button with production CSS in Chromium, WebKit and Firefox: a 48 px target, wholly on screen in
// the corner, at the phone sizes first (844 x 390 held sideways, the compact 780 x 270) and upright.
import '@automata/framework/theme.css'
import '@automata/framework'
import { flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import MenuSettings from '#src/features/screens/MenuSettings.svelte'

describe('the menu’s Settings button', () => {
  let shown: ReturnType<typeof mount> | undefined
  afterEach(async () => {
    if (shown !== undefined) await unmount(shown)
    shown = undefined
    document.body.replaceChildren()
  })

  for (const [width, height] of [
    [844, 390],
    [780, 270],
    [390, 844],
    [1194, 834],
  ] as const)
    it(`is a 48 px target wholly on screen at ${width} x ${height}`, async () => {
      await page.viewport(width, height)
      shown = mount(MenuSettings, { target: document.body, props: { onSettings: () => {} } })
      flushSync()
      await document.fonts.ready
      const box = document.querySelector('[data-testid="menu-settings"]')?.getBoundingClientRect()
      expect(box).toBeDefined()
      if (box === undefined) return
      expect(box.height).toBeGreaterThanOrEqual(48)
      expect(box.width).toBeGreaterThanOrEqual(48)
      expect(box.left).toBeGreaterThanOrEqual(0)
      expect(box.top).toBeGreaterThanOrEqual(0)
      expect(box.right).toBeLessThanOrEqual(window.innerWidth)
      expect(box.bottom).toBeLessThanOrEqual(window.innerHeight)
    })
})
