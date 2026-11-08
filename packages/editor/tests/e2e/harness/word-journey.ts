// The journey every complete-game file shares for Feel's word: write it in the editor, play, and measure what the
// player saw; reload the editor and see it still there; stop the editor, start it again on the same game folder, see it
// again, wait for the game to serve it, play, and measure again. Nothing here writes a game file.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { BrowserContext, Page } from '@playwright/test'
import { openEditor, playFromEditors, pressInList, servedWith } from './complete-game.ts'
import { expect, test } from './fixtures.ts'
import { newGame } from './new-game.ts'
import { runEditor } from './run-editor.ts'
import { catchTheWord, keepWhitestFrame, measureWord } from './word-pixels.ts'

export const WORDS = 'Ouch, a wall!'
/** A word is at least this tall (CSS px) on a phone, where the picture alone would draw it under 6. */
const READABLE_CSS = 11
/** The soft edge of a stem is at most this many device px, which is what a sharp edge is. */
const SHARP_DEVICE = 2

/** A 3D game is played sideways; on a phone held upright it asks to be turned, so the person turns it. */
export function turnSideways(play: Page): Promise<void> | undefined {
  const size = play.viewportSize()
  if (size === null || size.width >= size.height) return undefined
  return play.setViewportSize({ width: size.height, height: size.width })
}

async function wordInFeel(page: Page, entry: RegExp): Promise<string> {
  await pressInList(page, entry)
  return page.getByRole('textbox', { name: 'What it says' }).first().inputValue()
}

/** Plays, bumps the wall and checks the word on the player's screen. */
async function seen(play: Page, key: string): Promise<void> {
  const { png, devicePerCss } = await catchTheWord(play, key)
  const word = measureWord(png, devicePerCss)
  test.info().annotations.push({ type: 'word', description: JSON.stringify(word) })
  if (test.info().project.name.includes('phone'))
    expect(word.letterHeightCss, 'the word is readable on a phone').toBeGreaterThanOrEqual(READABLE_CSS)
  expect(word.edgeRunDevice, 'the word has a sharp edge').toBeLessThanOrEqual(SHARP_DEVICE)
}

export async function wordJourney(
  page: Page,
  context: BrowserContext,
  kind: '2d' | '3d',
  source: string,
): Promise<void> {
  const entry = kind === '2d' ? /square bumped/ : /wick bumped/i
  const key = kind === '2d' ? 'ArrowLeft' : 'KeyD'
  const hold = kind === '2d' ? undefined : turnSideways
  const game = await newGame(source, kind === '3d' ? '3d' : undefined)
  await keepWhitestFrame(context)
  let editor = await runEditor(game.dir)
  try {
    await openEditor(page, editor, 'Feel')
    await pressInList(page, entry)
    const says = page.getByRole('textbox', { name: 'What it says' }).first()
    await says.fill(WORDS)
    await says.blur()
    // Held for five seconds, so the word is on screen while the frames are watched.
    const long = page.getByRole('article', { name: 'Show a word' }).getByLabel('How long')
    await long.fill('5000')
    await long.blur()
    await expect
      .poll(() => readFileSync(join(game.dir, 'content/feel/feel.toml'), 'utf8'), { timeout: 30_000 })
      .toContain(WORDS)
    await servedWith(editor, WORDS)
    let play = await playFromEditors(page, context, hold)
    await seen(play, key)
    await play.close()

    // The editor page reloaded: the word is still in Feel.
    await page.reload()
    await openEditor(page, editor, 'Feel')
    expect(await wordInFeel(page, entry)).toBe(WORDS)

    // The editor closed and opened again on the same game: still there, still served, still shown in play.
    await editor.stop()
    editor = await runEditor(game.dir)
    await page.goto(editor.url)
    await openEditor(page, editor, 'Feel')
    expect(await wordInFeel(page, entry)).toBe(WORDS)
    await servedWith(editor, WORDS)
    play = await playFromEditors(page, context, hold)
    await seen(play, key)
    await play.close()
  } finally {
    await editor.stop()
    game.remove()
  }
}
