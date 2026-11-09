import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type BrowserContext, chromium, expect, type Page, test } from '@playwright/test'
import { createFakeGitHub } from '../harness/fake-github-server.ts'
import { pressInList } from '../harness/fixtures.ts'
import { serveSuitePage } from '../harness/static-page.ts'

// One game on two devices, through GitHub. Alice makes a game in one browser, signs in, keeps it on GitHub; a second
// browser (another profile, as another device is) signs in and gets it. She changes the flash on one and the shake on
// the other; both end up on both. Closing and opening the browser changes nothing, and a lost connection says so and
// catches up. GitHub is a fake held by this test; the page, the browsers and the storage are real.

const SAVED = /Saved on this device and on GitHub/
const OFFLINE = /Saved on this device\. Not on GitHub yet: no internet\./

async function openFromRail(page: Page, name: string): Promise<void> {
  const tab = page.getByRole('tab', { name, exact: true })
  await expect(page.getByRole('tab', { name: 'Tuner', exact: true })).toBeVisible()
  if (await tab.isVisible()) {
    await tab.click()
    return
  }
  await page
    .getByRole('tab', { name: 'More' })
    .or(page.getByRole('button', { name: 'More' }))
    .first()
    .click()
  await page.getByRole('menuitem', { name }).click()
}

/** Types into a spin box the way a person does, key by key, and leaves the focus where it is. */
async function type(page: Page, name: string, text: string): Promise<void> {
  const field = page.getByRole('spinbutton', { name }).first()
  await field.click()
  await field.press('ControlOrMeta+A')
  await field.pressSequentially(text)
}

async function openFeel(page: Page): Promise<void> {
  await openFromRail(page, 'Feel')
  await pressInList(page, 'Never more than')
}

test('one game on two devices through GitHub: kept, got, changed on both, reopened, offline and back', async () => {
  const site = await serveSuitePage()
  const github = createFakeGitHub({ login: 'alice', name: 'lantern-run' })
  const profiles = [mkdtempSync(join(tmpdir(), 'af-sync-a-')), mkdtempSync(join(tmpdir(), 'af-sync-b-'))]
  const launch = async (profile: string): Promise<BrowserContext> => {
    const context = await chromium.launchPersistentContext(profile, { viewport: { width: 390, height: 844 } })
    await github.install(context, site.url, profile)
    return context
  }
  const contexts: BrowserContext[] = []
  try {
    // Device A: makes the game, signs in, and keeps it on GitHub.
    const a = await launch(profiles[0] as string)
    contexts.push(a)
    const pageA = await a.newPage()
    await pageA.goto(site.url)
    await pageA.getByRole('button', { name: 'New game' }).click()
    await pageA.getByLabel('What’s your game called?').fill('Lantern Run')
    await pageA.getByRole('button', { name: 'Make my game' }).click()
    await expect(pageA.getByRole('link', { name: 'Lantern Run: all your games' })).toBeVisible()
    await pageA.getByRole('link', { name: 'Lantern Run: all your games' }).click()
    await pageA.getByRole('button', { name: 'Sign in with GitHub (free)' }).click()
    await expect(pageA.getByText('Signed in as alice.')).toBeVisible()

    await pageA.getByRole('button', { name: 'Keep this game on GitHub' }).click()
    expect(github.opened.at(-1)).toBe('https://github.com/new?name=lantern-run&visibility=private')
    await expect(
      pageA.getByText(
        'On GitHub, press Create repository and change nothing else. Leave “Add a README” unticked. Then come back here.',
      ),
    ).toBeVisible()
    // The place is made, but Automata was not let into it yet: it says so, in words.
    await pageA.getByRole('button', { name: 'I made it' }).click()
    await expect(pageA.getByText('Automata can’t reach this game on GitHub yet.')).toBeVisible()
    github.allowApp()
    await pageA.getByRole('button', { name: 'Check again' }).click()
    await expect(pageA.getByText('On this device and GitHub: alice/lantern-run')).toBeVisible()

    // Opening the game puts it on GitHub, whole, without an edit.
    await pageA.getByRole('button', { name: 'Open Lantern Run' }).click()
    await expect(pageA.getByRole('status').filter({ hasText: SAVED })).toBeVisible()
    expect(github.rest.paths()).toContain('content/editors.toml')
    expect(github.rest.paths()).toContain('content/feel/feel.toml')

    // Device B: signs in and gets the game.
    const b = await launch(profiles[1] as string)
    contexts.push(b)
    const pageB = await b.newPage()
    await pageB.goto(`${site.url}?games`)
    await pageB.getByRole('button', { name: 'Sign in with GitHub (free)' }).click()
    await expect(pageB.getByText('Signed in as alice.')).toBeVisible()
    await expect(pageB.getByRole('heading', { name: 'Your games on GitHub' })).toBeVisible()
    await pageB.getByRole('button', { name: 'Get Lantern Run' }).click()
    await expect(pageB.getByText('On this device and GitHub: alice/lantern-run')).toBeVisible()
    await pageB.getByRole('button', { name: 'Open Lantern Run' }).click()
    await expect(pageB.getByRole('status').filter({ hasText: SAVED })).toBeVisible()

    // The flash on A, the shake on B. Each lands on GitHub as its own commit after ten quiet seconds.
    await openFeel(pageA)
    await type(pageA, 'Most flash frames', '12')
    await expect
      .poll(() => github.rest.file('content/feel/feel.toml'), { timeout: 40_000 })
      .toContain('flash_frames = 12')
    await openFeel(pageB)
    await type(pageB, 'Most shake', '20')
    await expect
      .poll(() => github.rest.file('content/feel/feel.toml'), { timeout: 40_000 })
      .toContain('shake_px = 20')
    expect(github.rest.file('content/feel/feel.toml')).toContain('flash_frames = 12')
    expect(github.rest.messages().filter((m) => m === 'Edited in Automata: Feel')).toHaveLength(2)

    // Coming back to the tab pulls. The open editor is read again from the files (it opens on its start, so the list is
    // chosen again), and both pages show both changes with no reload.
    for (const page of [pageA, pageB])
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
    for (const [who, page] of [
      ['A', pageA],
      ['B', pageB],
    ] as const) {
      // The pull opened the editor again, so the limits page is gone until it is chosen again.
      await expect(page.getByRole('spinbutton', { name: 'Most flash frames' })).toBeHidden({
        timeout: 20_000,
      })
      await pressInList(page, 'Never more than')
      await expect(
        page.getByRole('spinbutton', { name: 'Most flash frames' }).first(),
        `${who} flash`,
      ).toHaveValue('12', {
        timeout: 20_000,
      })
      await expect(page.getByRole('spinbutton', { name: 'Most shake' }).first(), `${who} shake`).toHaveValue(
        '20',
        {
          timeout: 20_000,
        },
      )
    }

    // B reloads, then the whole browser closes and opens: still both.
    await pageB.reload()
    await openFeel(pageB)
    await expect(pageB.getByRole('spinbutton', { name: 'Most flash frames' }).first()).toHaveValue('12')
    await b.close()
    const again = await launch(profiles[1] as string)
    contexts.push(again)
    const reopened = await again.newPage()
    await reopened.goto(site.url)
    await openFeel(reopened)
    await expect(reopened.getByRole('spinbutton', { name: 'Most flash frames' }).first()).toHaveValue('12')
    await expect(reopened.getByRole('spinbutton', { name: 'Most shake' }).first()).toHaveValue('20')

    // A loses its connection: it still saves here and says GitHub has not got it; back online, one new commit.
    const before = github.rest.messages().length
    github.rest.state.offline = true
    await type(pageA, 'Most flash frames', '7')
    await expect(pageA.getByRole('status').filter({ hasText: OFFLINE })).toBeVisible({ timeout: 40_000 })
    github.rest.state.offline = false
    await pageA.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
    await expect
      .poll(() => github.rest.file('content/feel/feel.toml'), { timeout: 40_000 })
      .toContain('flash_frames = 7')
    expect(github.rest.messages()).toHaveLength(before + 1)
    await expect(pageA.getByRole('status').filter({ hasText: SAVED })).toBeVisible()

    // Both change the flash while GitHub cannot be reached, and A gets there first. B's flash now clashes with A's: B is
    // asked, in words, and nothing of B's is lost. B can put it away, and the top bar brings the question back; a reload
    // keeps it; Keep both leaves B's flash in the game and GitHub's beside it, and A is given B's flash.
    await reopened.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
    await expect(reopened.getByRole('spinbutton', { name: 'Most flash frames' }).first()).toBeHidden({
      timeout: 20_000,
    })
    await openFeel(reopened)
    await expect(reopened.getByRole('spinbutton', { name: 'Most flash frames' }).first()).toHaveValue('7')
    github.rest.state.offline = true
    await type(pageA, 'Most flash frames', '3')
    await type(reopened, 'Most flash frames', '15')
    for (const page of [pageA, reopened])
      await expect(page.getByRole('status').filter({ hasText: OFFLINE })).toBeVisible({ timeout: 40_000 })
    github.rest.state.offline = false
    await pageA.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
    await expect
      .poll(() => github.rest.file('content/feel/feel.toml'), { timeout: 40_000 })
      .toContain('flash_frames = 3')

    await reopened.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
    const asked = reopened.getByRole('dialog', { name: 'Feel changed here and on GitHub' })
    await expect(asked).toBeVisible({ timeout: 20_000 })
    await expect(asked).toContainText('Nothing has been lost.')
    // Nothing is sent over GitHub's while it waits.
    expect(github.rest.file('content/feel/feel.toml')).toContain('flash_frames = 3')
    await asked.getByRole('button', { name: 'Not now' }).click()
    await expect(asked).toBeHidden()
    const line = reopened.getByRole('button', {
      name: 'A file changed here and on GitHub. Choose which to keep.',
    })
    await line.click()
    await expect(asked).toBeVisible()
    await reopened.reload()
    await expect(reopened.getByRole('dialog', { name: 'Feel changed here and on GitHub' })).toBeVisible({
      timeout: 20_000,
    })
    await reopened.getByRole('button', { name: 'Keep both' }).click()
    await expect(reopened.getByRole('dialog')).toBeHidden({ timeout: 20_000 })
    await expect
      .poll(() => github.rest.file('content/feel/feel.toml'), { timeout: 40_000 })
      .toContain('flash_frames = 15')
    expect(github.rest.file('content/feel/feel-github.toml')).toContain('flash_frames = 3')
    await expect(reopened.getByRole('status').filter({ hasText: SAVED })).toBeVisible({ timeout: 20_000 })

    await pageA.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
    await expect(pageA.getByRole('spinbutton', { name: 'Most flash frames' }).first()).toBeHidden({
      timeout: 20_000,
    })
    await pressInList(pageA, 'Never more than')
    await expect(pageA.getByRole('spinbutton', { name: 'Most flash frames' }).first()).toHaveValue('15', {
      timeout: 20_000,
    })
  } finally {
    for (const context of contexts) await context.close().catch(() => undefined)
    await site.stop()
    for (const profile of profiles) rmSync(profile, { recursive: true, force: true })
  }
})
