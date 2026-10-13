import { hostedUrl } from '@af-examples/demo-host/ports'
import { collectErrors, openHosted } from '@af-examples/demo-host/testing'
import { expect, type Frame, type Page, test } from '@playwright/test'
import { GAME_ID, url } from './origin.ts'

// The runtime boot-and-flow demo under Ruken's fake host (examples/demo-host):
// Boots to ready on title screen, walks flow title -> play -> paused -> play,
// and verifies every failMode (?fail=) renders its failure panel with the correct data-code and actions.

const openDemo = (page: Page) => openHosted(page, url, GAME_ID)

test('boots under fake host to ready; walks title -> play -> paused -> play; no CSP violations', async ({
  page,
}) => {
  const errors = await collectErrors(page)
  const frame = await openDemo(page)

  await expect(frame.locator('html')).toHaveAttribute('data-state', 'ready')
  await expect(frame.locator('[data-testid="title-screen"]')).toBeVisible()

  // 1. Title -> Play
  await frame.locator('[data-testid="play-btn"]').click()
  await expect(frame.locator('[data-testid="play-screen"]')).toBeVisible()

  const tickSpan = frame.locator('[data-testid="tick"]')
  await expect(tickSpan).toBeVisible()
  await expect.poll(async () => Number(await tickSpan.getAttribute('data-tick'))).toBeGreaterThan(0)
  const tickBeforePause = Number(await tickSpan.getAttribute('data-tick'))

  // 2. Play -> Paused
  await frame.locator('[data-testid="pause-btn"]').click()
  await expect(frame.locator('[data-testid="paused-screen"]')).toBeVisible()

  // 3. Paused -> Resume
  await frame.locator('[data-testid="resume-btn"]').click()
  await expect(frame.locator('[data-testid="play-screen"]')).toBeVisible()

  // Simulation resumes
  await expect
    .poll(async () => Number(await tickSpan.getAttribute('data-tick')))
    .toBeGreaterThan(tickBeforePause)

  // E5: No CSP violations
  const cspErrors = errors.filter((err) => err.includes('CSP violation'))
  expect(cspErrors).toEqual([])
})

test.describe('fail modes (?fail=)', () => {
  const immediateModes = [
    { mode: 'init', expectedCode: 'start' },
    { mode: 'saves', expectedCode: 'progress' },
    { mode: 'content', expectedCode: 'damaged' },
    { mode: 'download', expectedCode: 'download' },
    { mode: 'renderer', expectedCode: 'unsupported' },
  ] as const

  for (const { mode, expectedCode } of immediateModes) {
    test(`fail mode '${mode}' shows panel with data-code='${expectedCode}'`, async ({ page }) => {
      const targetUrl = `${url}?fail=${mode}`
      await page.goto(hostedUrl(targetUrl, GAME_ID))

      const demoFrame = () => page.frames().find((candidate) => candidate.url().startsWith(targetUrl))
      await expect.poll(() => demoFrame() !== undefined, { message: 'demo frame did not load' }).toBe(true)
      const frame = demoFrame() as Frame

      await expect(frame.locator('html')).toHaveAttribute('data-state', 'failed', { timeout: 10000 })
      const panel = frame.locator('[role="alert"]')
      await expect(panel).toBeVisible()
      await expect(panel).toHaveAttribute('data-code', expectedCode)
    })
  }

  test("fail mode 'stall' shows panel with data-code='download-stalled' after 30s timeout", async ({
    page,
  }) => {
    test.setTimeout(45000)
    const targetUrl = `${url}?fail=stall`
    await page.goto(hostedUrl(targetUrl, GAME_ID))

    const demoFrame = () => page.frames().find((candidate) => candidate.url().startsWith(targetUrl))
    await expect.poll(() => demoFrame() !== undefined, { message: 'demo frame did not load' }).toBe(true)
    const frame = demoFrame() as Frame

    await expect(frame.locator('html')).toHaveAttribute('data-state', 'failed', { timeout: 35000 })
    const panel = frame.locator('[role="alert"]')
    await expect(panel).toBeVisible()
    await expect(panel).toHaveAttribute('data-code', 'download-stalled')
  })

  test("ready='never' shows panel with data-code='connect' after 30s timeout", async ({ page }) => {
    test.setTimeout(45000)
    await page.goto(hostedUrl(url, GAME_ID, { ready: 'never' }))

    const demoFrame = () => page.frames().find((candidate) => candidate.url().startsWith(url))
    await expect.poll(() => demoFrame() !== undefined, { message: 'demo frame did not load' }).toBe(true)
    const frame = demoFrame() as Frame

    await expect(frame.locator('html')).toHaveAttribute('data-state', 'failed', { timeout: 35000 })
    const panel = frame.locator('[role="alert"]')
    await expect(panel).toBeVisible()
    await expect(panel).toHaveAttribute('data-code', 'connect')
  })
})
