import { examplesPort } from '@mcthaydt/examples-runner/host/ports'
import { collectErrors, openHosted } from '@mcthaydt/examples-runner/host/testing'
import { expect, type Frame, type Page, test } from '@playwright/test'

// The display policy under the fake host (M4.7 plan step 11, M4 spec §4.9, §13): the touch buttons follow Ruken's
// reserved strip from one edge to the other mid-play (D-b), a keyboard rising keeps the form factor (D-c), and
// neither remounts the screen; under the host the landscape gate never shows, even on a phone held sideways (D-d).
const origin = `http://localhost:${examplesPort}`
const URL = `${origin}/core/input-keys/`

/** Plays with a finger, so the touch buttons show, and marks the play screen to tell a remount. */
async function playByTouch(page: Page): Promise<Frame> {
  const frame = await openHosted(page, URL, 'core-input-keys')
  await frame.getByTestId('play').tap()
  await expect(frame.getByTestId('play-screen')).toBeVisible()
  await frame.locator('body').tap({ position: { x: 20, y: 120 } })
  await expect(frame.getByTestId('touch-buttons')).toBeVisible()
  await frame.evaluate(() => {
    ;(document.querySelector('[data-testid="play-screen"]') as HTMLElement).dataset.marker = 'first'
  })
  return frame
}

const marker = (frame: Frame) =>
  frame.evaluate(
    () => (document.querySelector('[data-testid="play-screen"]') as HTMLElement | null)?.dataset.marker,
  )

/** Ruken's strip on one edge: what the host's `display.metrics` says. */
const strip = (edge: 'left' | 'right', width: number, height: number) => ({
  safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
  hostReserved: { edge, rect: { x: edge === 'left' ? 0 : width - 72, y: 0, w: 72, h: height } },
  orientation: width > height ? 'landscape' : 'portrait',
  fullscreen: false,
  scale: 1,
})

test('the touch buttons follow the host’s strip from right to left, and nothing remounts (D-b)', async ({
  page,
}) => {
  const errors = await collectErrors(page)
  const frame = await playByTouch(page)
  const { width, height } = page.viewportSize() ?? { width: 412, height: 915 }
  const buttons = frame.getByTestId('touch-buttons')
  await page.evaluate(
    (metrics) =>
      (window as unknown as { hostBridge: { setMetrics(m: unknown): void } }).hostBridge.setMetrics(metrics),
    strip('right', width, height),
  )
  await expect.poll(async () => (await buttons.boundingBox())?.x ?? -1).toBeGreaterThanOrEqual(0)
  const right = await buttons.boundingBox()
  await page.evaluate(
    (metrics) =>
      (window as unknown as { hostBridge: { setMetrics(m: unknown): void } }).hostBridge.setMetrics(metrics),
    strip('left', width, height),
  )
  await expect.poll(async () => (await buttons.boundingBox())?.x ?? -1).toBeGreaterThanOrEqual(72)
  const left = await buttons.boundingBox()
  expect(left?.x).not.toBe(right?.x)
  expect((right?.x ?? 0) + (right?.width ?? 0)).toBeLessThanOrEqual(width - 72 + 0.5)
  expect(await marker(frame)).toBe('first')
  expect(errors).toEqual([])
})

test('a keyboard rising keeps the form factor and the screen (D-c)', async ({ page }) => {
  const errors = await collectErrors(page)
  const frame = await playByTouch(page)
  const formFactor = () => frame.evaluate(() => document.documentElement.dataset.formFactor)
  const before = await formFactor()
  // The keyboard shrinks the visual viewport, not the layout: stand in for it and tell the page.
  await frame.evaluate(() => {
    const keyboard = 300
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      get: () => ({
        width: innerWidth,
        height: innerHeight - keyboard,
        offsetTop: 0,
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
    })
    window.dispatchEvent(new Event('resize'))
  })
  await expect
    .poll(() => frame.evaluate(() => document.documentElement.hasAttribute('data-visual-inset')))
    .toBe(true)
  expect(await formFactor()).toBe(before)
  expect(await marker(frame)).toBe('first')
  expect(errors).toEqual([])
})

test.describe('a phone held sideways under the host', () => {
  test.use({ viewport: { width: 844, height: 390 } })

  test('never shows the landscape gate (D-d)', async ({ page }) => {
    const errors = await collectErrors(page)
    const frame = await openHosted(page, URL, 'core-input-keys')
    await frame.getByTestId('play').tap()
    await expect(frame.getByTestId('play-screen')).toBeVisible()
    expect(await frame.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
    await expect(frame.getByTestId('landscape-gate')).toHaveCount(0)
    expect(errors).toEqual([])
  })
})
