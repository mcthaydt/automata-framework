import { expect, type Page } from '@playwright/test'

/**
 * What a player does at a new game's first screens: a first visit starts with "Language" (six languages, so a player
 * picks the one they read), then the title with its Play button, which they press. A page that opens straight on the
 * title (a language already chosen) just gets the Play press.
 */
export async function pressPlay(game: Page): Promise<void> {
  const language = game.getByRole('dialog', { name: 'Language' })
  const play = game.getByRole('button', { name: 'Play' })
  await expect(language.or(play)).toBeVisible({ timeout: 30_000 })
  if (await language.isVisible()) await language.getByRole('button', { name: 'English' }).click()
  await play.click()
}
