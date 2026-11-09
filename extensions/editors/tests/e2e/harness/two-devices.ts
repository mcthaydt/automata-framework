// One game kept on GitHub from two devices (two browser profiles), both open on it: what the sync journeys start from.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type BrowserContext, chromium, expect, type Page } from '@playwright/test'
import { createFakeGitHub, type FakeGitHub } from './fake-github-server.ts'
import { type StaticPage, serveSuitePage } from './static-page.ts'

export const SAVED: RegExp = /Saved on this device and on GitHub/

export interface Devices {
  readonly site: StaticPage
  readonly github: FakeGitHub
  readonly a: Page
  readonly b: Page
  /** Closes the browsers and the page server and removes the profiles. */
  readonly stop: () => Promise<void>
}

/** Alice keeps "Lantern Run" on GitHub from device A and gets it on device B; both pages show the game, saved on GitHub. */
export async function keptOnTwoDevices(
  size: { width: number; height: number } = { width: 390, height: 844 },
): Promise<Devices> {
  const site = await serveSuitePage()
  const github = createFakeGitHub({ login: 'alice', name: 'lantern-run' })
  const profiles = [mkdtempSync(join(tmpdir(), 'af-dev-a-')), mkdtempSync(join(tmpdir(), 'af-dev-b-'))]
  const contexts: BrowserContext[] = []
  const launch = async (profile: string): Promise<BrowserContext> => {
    const context = await chromium.launchPersistentContext(profile, { viewport: size })
    await github.install(context, site.url, profile)
    contexts.push(context)
    return context
  }
  const a = await (await launch(profiles[0] as string)).newPage()
  await a.goto(site.url)
  await a.getByRole('button', { name: 'New game' }).click()
  await a.getByLabel('What’s your game called?').fill('Lantern Run')
  await a.getByRole('button', { name: 'Make my game' }).click()
  await a.getByRole('link', { name: 'Lantern Run: all your games' }).click()
  await a.getByRole('button', { name: 'Sign in with GitHub (free)' }).click()
  await expect(a.getByText('Signed in as alice.')).toBeVisible()
  await a.getByRole('button', { name: 'Keep this game on GitHub' }).click()
  github.allowApp()
  await a.getByRole('button', { name: 'I made it' }).click()
  await expect(a.getByText('On this device and GitHub: alice/lantern-run')).toBeVisible()
  await a.getByRole('button', { name: 'Open Lantern Run' }).click()
  await expect(a.getByRole('status').filter({ hasText: SAVED })).toBeVisible()

  const b = await (await launch(profiles[1] as string)).newPage()
  await b.goto(`${site.url}?games`)
  await b.getByRole('button', { name: 'Sign in with GitHub (free)' }).click()
  await expect(b.getByText('Signed in as alice.')).toBeVisible()
  await b.getByRole('button', { name: 'Get Lantern Run' }).click()
  await expect(b.getByText('On this device and GitHub: alice/lantern-run')).toBeVisible()
  await b.getByRole('button', { name: 'Open Lantern Run' }).click()
  await expect(b.getByRole('status').filter({ hasText: SAVED })).toBeVisible()

  return {
    site,
    github,
    a,
    b,
    stop: async () => {
      for (const context of contexts) await context.close().catch(() => undefined)
      await site.stop()
      for (const profile of profiles) rmSync(profile, { recursive: true, force: true })
    },
  }
}

/** The tab comes to the front: the page pulls. */
export async function comeToFront(page: Page): Promise<void> {
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
}
