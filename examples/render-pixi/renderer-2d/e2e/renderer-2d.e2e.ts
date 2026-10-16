import { collectErrors, openHosted } from '@mcthaydt/examples-runner/host/testing'
import { expect, type Page, test } from '@playwright/test'
import { GAME_ID, url } from './origin.ts'

const openDemo = (page: Page) => openHosted(page, url, GAME_ID)

test('renderer-2d boots under fake host with zero CSP violations and renders moving entity', async ({
  page,
}) => {
  const errors = await collectErrors(page)
  const frame = await openDemo(page)

  await expect(frame.locator('html')).toHaveAttribute('data-state', 'ready')

  const canvas = frame.locator('canvas')
  await expect(canvas).toBeVisible()
  await expect(canvas).toHaveClass(/af-stage/)

  // Verify renderer attribute (webgl by default)
  const rendererType = await canvas.getAttribute('data-renderer')
  expect(['webgl', 'webgpu']).toContain(rendererType)

  // Verify entity position changes over multiple animation frames
  await expect(canvas).toHaveAttribute('data-square-x')
  const initialX = await canvas.getAttribute('data-square-x')
  await expect.poll(async () => canvas.getAttribute('data-square-x')).not.toBe(initialX)

  // Verify zero CSP violations
  const cspErrors = errors.filter((err) => err.includes('CSP violation'))
  expect(cspErrors).toEqual([])
})
