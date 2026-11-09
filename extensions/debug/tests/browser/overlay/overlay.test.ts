// DBG-L: the overlay's layout in a real browser (the jsdom tests cannot lay anything out). At phone sizes in both orientations:
// the overlay fills the screen and nothing scrolls the page, every control is at least 44 px, and a long panel scrolls inside the
// declared region, so Close and the tabs stay on screen.

import { flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import DebugOverlay from '#src/features/overlay/DebugOverlay.svelte'
import { shippedPanels } from '#src/features/panels/shipped-panels.ts'
import { installDebug } from '#src/shared/host.ts'
import { debugPanels, summaryPanel } from '#src/shared/panels.ts'

const rows = (count: number): Record<string, number> =>
  Object.fromEntries(Array.from({ length: count }, (_, i) => [`row-${String(i).padStart(3, '0')}`, i]))

let host: HTMLElement | undefined
let app: ReturnType<typeof mount> | undefined
let dispose: (() => void) | undefined
afterEach(async () => {
  if (app !== undefined) await unmount(app)
  host?.remove()
  dispose?.()
  app = host = dispose = undefined
})

const open = async (): Promise<HTMLElement> => {
  host = document.createElement('div')
  host.style.cssText = 'position:fixed;inset:0;margin:0'
  document.body.append(host)
  dispose = installDebug({
    panels: debugPanels(...shippedPanels, summaryPanel('puzzle', 'Puzzle')),
    summaries: { puzzle: { summary: () => rows(120) } },
    setPaused: () => {},
  })
  app = mount(DebugOverlay, { target: host })
  flushSync() // onMount adds the key listener
  window.dispatchEvent(new KeyboardEvent('keydown', { key: '`' }))
  await expect.poll(() => host?.querySelector('[role="dialog"]')).not.toBeNull()
  return host
}

const SIZES = [
  { name: 'phone portrait', width: 360, height: 640 },
  { name: 'phone landscape', width: 640, height: 360 },
]

describe.each(SIZES)('the debug overlay on a $name screen', ({ width, height }) => {
  it('fills the screen without scrolling the page', async () => {
    await page.viewport(width, height)
    const root = await open()
    const box = (root.querySelector('[role="dialog"]') as HTMLElement).getBoundingClientRect()
    expect([box.left, box.top, box.width, box.height]).toEqual([0, 0, width, height])
    expect(document.documentElement.scrollHeight).toBeLessThanOrEqual(height)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width)
  })

  it('keeps every control at least 44 px and on screen', async () => {
    await page.viewport(width, height)
    const root = await open()
    const controls = [...root.querySelectorAll<HTMLElement>('button, input[type="checkbox"], label')]
    expect(controls.length).toBeGreaterThan(6)
    for (const control of controls) {
      const r = control.getBoundingClientRect()
      const name = control.textContent?.trim() || control.getAttribute('type') || control.tagName
      if (control.tagName !== 'INPUT') expect(r.height, `${name} height`).toBeGreaterThanOrEqual(44)
      if (control.tagName === 'BUTTON') expect(r.width, `${name} width`).toBeGreaterThanOrEqual(44)
      expect(r.left, `${name} left`).toBeGreaterThanOrEqual(0)
      expect(r.right, `${name} right`).toBeLessThanOrEqual(width)
      expect(r.bottom, `${name} bottom`).toBeLessThanOrEqual(height)
    }
  })

  it('scrolls a long panel inside its region and leaves Close reachable', async () => {
    await page.viewport(width, height)
    const root = await open()
    ;(root.querySelector('[role="tab"][aria-selected="false"]:last-of-type') as HTMLElement).click()
    await expect.poll(() => root.textContent).toContain('row-119')
    const body = root.querySelector('[role="region"]') as HTMLElement
    expect(getComputedStyle(body).overflowY).toBe('auto')
    expect(body.scrollHeight).toBeGreaterThan(body.clientHeight)
    expect(body.getBoundingClientRect().height).toBeGreaterThanOrEqual(120)
    const close = [...root.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Close',
    ) as HTMLElement
    expect(close.getBoundingClientRect().bottom).toBeLessThanOrEqual(height)
    body.scrollTop = body.scrollHeight
    expect(close.getBoundingClientRect().bottom).toBeLessThanOrEqual(height)
  })
})
