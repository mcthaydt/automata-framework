import { readFileSync } from 'node:fs'
import { passFirstRun } from '@automata/tools/e2e'
import { expect, test } from '@playwright/test'
import { gameUrl } from './origins.ts'

// The game in each of its six languages, one Playwright project per language (playwright.config.ts: the browser's
// language is the project's `locale`). It opens the game's own origin with no host page: Emberwick's other journeys run
// inside Ruken's fake host, whose session language is fixed at English and outranks the browser's, and a Ruken host skips
// the first-run screen, so only a standalone page shows what a stranger meets.

const FONTS = JSON.parse(
  readFileSync(new URL('../../content/generated/fonts/fonts.json', import.meta.url), 'utf8'),
) as Record<string, Record<string, string>>

// The expected words are read from the game's own catalog file (`messages/ui/<language>.json`), not through the game's
// code: Playwright loads this file with plain Node, which cannot load the framework's Svelte source that the game's
// `words.ts` imports for its locale matching.
const wordsOf = (tag: string) => {
  const catalog = JSON.parse(
    readFileSync(new URL(`../../messages/ui/${tag}.json`, import.meta.url), 'utf8'),
  ) as Record<string, string>
  return {
    play: catalog.play as string,
    menuTitle: catalog.menu_title as string,
    pause: catalog.pause as string,
    pausedTitle: catalog.paused_title as string,
    resume: catalog.resume as string,
    backToMenu: catalog.back_to_menu as string,
  }
}

/** The tag this project runs in: the browser's language, which the game matched to one of its six. */
const TAGS: Readonly<Record<string, string>> = {
  en: 'en',
  ja: 'ja',
  ko: 'ko',
  'es-419': 'es-419',
  'pt-BR': 'pt-BR',
  'zh-CN': 'zh-Hans',
}

test('a first run asks for the language the browser speaks, then plays and pauses in it', async ({
  page,
}, info) => {
  const browserLocale = info.project.use.locale ?? 'en'
  const tag = TAGS[browserLocale]
  if (tag === undefined) throw new Error(`no language for ${browserLocale}`)
  const words = wordsOf(tag)
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(String(error)))

  await page.goto(gameUrl)
  // The suggested language has focus; pressing it is the one press the screen needs.
  await passFirstRun(page)
  const game = page.locator('#game')
  await expect(page.locator('html')).toHaveAttribute('lang', tag)
  await expect(game).toHaveAttribute('data-screen', /splash|menu/)
  if ((await game.getAttribute('data-screen')) === 'splash') await page.keyboard.press('KeyX')
  await expect(game).toHaveAttribute('data-screen', 'menu')
  await expect(page.getByRole('button', { name: words.play })).toBeFocused()
  await expect(page.locator('#menu-title')).toHaveText(words.menuTitle)

  // The words are drawn in the face cut for this language, and it is loaded: nothing falls back to the device.
  const family = Object.entries(FONTS).find(([, byLocale]) => byLocale[tag] !== undefined)?.[0]
  if (family === undefined) throw new Error(`no font serves ${tag}`)
  const face = `${family} ${tag}`
  await expect(page.locator('body')).toHaveCSS(
    'font-family',
    new RegExp(face.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')),
  )
  expect(
    await page.evaluate(async (name) => (await document.fonts.load(`16px "${name}"`)).length, face),
  ).toBeGreaterThan(0)

  await page.getByRole('button', { name: words.play }).click()
  await expect(game).toHaveAttribute('data-screen', 'room', { timeout: 40_000 })
  await page.getByRole('button', { name: words.pause }).click({ timeout: 40_000 })
  await expect(game).toHaveAttribute('data-screen', 'paused', { timeout: 40_000 })
  await expect(page.getByRole('heading', { name: words.pausedTitle })).toBeVisible()
  await expect(page.getByRole('button', { name: words.resume })).toBeFocused()
  await page.getByRole('button', { name: words.backToMenu }).click()
  await expect(game).toHaveAttribute('data-screen', 'menu')
  expect(errors).toEqual([])
})
