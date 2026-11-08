// The journeys' shared start: a fresh copy of the 2D story and the real `automata editor` on it, both torn down after
// each test, and the steps every journey takes in the editors and in the game, by the roles and names a person sees.
import { mkdirSync, writeFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  test as base,
  expect,
  type Page,
  type PlaywrightTestArgs,
  type PlaywrightTestOptions,
  type PlaywrightWorkerArgs,
  type PlaywrightWorkerOptions,
  type TestType,
} from '@playwright/test'
import { type RunningEditor, runEditor } from './run-editor.ts'
import { copyStory, type StoryCopy } from './story-game.ts'
import { tone } from './wave.ts'

type JourneyFixtures = { tracks: readonly string[]; story: StoryCopy; editor: RunningEditor }

export const test: TestType<
  PlaywrightTestArgs & PlaywrightTestOptions & JourneyFixtures,
  PlaywrightWorkerArgs & PlaywrightWorkerOptions
> = base.extend<JourneyFixtures>({
  /** The music files a person has dropped into the game's assets/music folder before opening the editors (names). */
  tracks: [[], { option: true }],
  story: async ({ tracks }, use) => {
    const story = copyStory()
    if (tracks.length > 0) {
      mkdirSync(join(story.dir, 'assets/music'), { recursive: true })
      for (const name of tracks) writeFileSync(join(story.dir, 'assets/music', name), tone(name))
    }
    await use(story)
    story.remove()
  },
  editor: async ({ story }, use) => {
    const editor = await runEditor(story.dir)
    await use(editor)
    await editor.stop()
  },
})
export { expect }

/**
 * Opens the editors on the story and one editor in the rail (`Feel`, `Audio`, `Writer` or `Sequence`). The rail is a column
 * of buttons on a wide screen and the tabs of a bar on a phone.
 */
export async function openEditor(page: Page, editor: RunningEditor, name: string): Promise<void> {
  await page.goto(editor.url)
  await page
    .getByRole('tab', { name, exact: true })
    .or(page.getByRole('navigation', { name: 'Editor sections' }).getByRole('button', { name, exact: true }))
    .click()
}

/**
 * Presses a button of the editor's list. Below the wide layout the list sits in a sheet behind the top bar's Panel
 * button, so the sheet is opened first when the button is not on screen.
 */
export async function pressInList(page: Page, name: string | RegExp): Promise<void> {
  const button = page.getByRole('button', { name }).first()
  if (!(await button.isVisible())) await page.getByRole('button', { name: 'Panel' }).click()
  await button.click()
}

/**
 * Waits until the editor has written the person's edit into the game's folder: the file holds `text`. The editors save by
 * themselves (the top bar says so on a wide screen only), so a journey reads the folder to know the Save happened. The
 * edit itself is always made through the editor; this only waits for it to land.
 */
export async function savedInto(story: StoryCopy, file: string, text: string): Promise<void> {
  await expect
    .poll(() => readFile(join(story.dir, file), 'utf8').catch(() => ''), {
      message: `${file} saves "${text}"`,
    })
    .toContain(text)
}

/** The story, opened on its own page, and its Play button pressed. */
export async function playStory(page: Page, editor: RunningEditor): Promise<void> {
  await page.goto(editor.gameUrl)
  await page.getByRole('button', { name: 'Play' }).click()
}

/**
 * Walks the player to the keeper (right along the hall's floor), which starts the conversation. Holds the arrow until the
 * keeper's first words are up, as a person would.
 */
export async function walkToKeeper(page: Page): Promise<void> {
  await page.keyboard.down('ArrowRight')
  try {
    await expect(page.getByText('Keeper', { exact: true })).toBeVisible({ timeout: 15_000 })
  } finally {
    await page.keyboard.up('ArrowRight')
  }
}
