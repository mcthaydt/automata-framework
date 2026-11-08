// The steps the complete-game journeys take, by the roles and names a person sees: open an editor from the rail, play
// or publish from the top bar, and look at what the played game drew and played. Each looks at the game's own output (its
// canvas, the sounds it starts, the zip it ships); none reads a game file to decide what the game did.
import type { BrowserContext, Locator, Page } from '@playwright/test'
import { expect } from './fixtures.ts'
import { pressInList } from './press-in-list.ts'
import { boxOf, type Pixels, readPng } from './read-png.ts'
import type { RunningEditor } from './run-editor.ts'

export { pressInList }

/**
 * Whether the rail offers an editor by this name (the game's editor list names it and the page has it): its tab, or on a
 * phone, where four tabs and More share the width, its row in the sheet More opens. A sheet left open by an earlier look
 * is closed first, so a tab is never behind its scrim.
 */
export async function railHas(page: Page, name: string): Promise<Locator> {
  const sheet = page.getByRole('dialog', { name: 'More editors' })
  if (await sheet.isVisible()) {
    await page.keyboard.press('Escape')
    await expect(sheet).toBeHidden()
  }
  const tab = page.getByRole('tab', { name, exact: true })
  if (await tab.isVisible()) return tab
  const more = page.getByRole('button', { name: 'More', exact: true })
  if (!(await more.isVisible())) return tab
  await more.click()
  return sheet.getByRole('button', { name, exact: true })
}

/** Opens the editors and one editor from the rail: tabs of a bar on a phone, a column of buttons on a wide screen. */
export async function openEditor(page: Page, editor: RunningEditor, name: string): Promise<void> {
  if (!page.url().startsWith(editor.url.split('?')[0] ?? editor.url)) await page.goto(editor.url)
  await (await railHas(page, name)).click()
}

/** Plays or publishes: Play is a link and Publish a button in the header, at every size (a phone keeps both whole). */
export async function pressGame(page: Page, action: 'Play' | 'Publish'): Promise<void> {
  const publish = page.getByRole('button', { name: 'Publish' })
  await expect(publish).toBeVisible()
  if (action === 'Play') await page.getByRole('link', { name: 'Play' }).click()
  else await publish.click()
}

/**
 * Play from the top bar: the running game opens in a new tab, and its own Play button is pressed. `hold` is how the
 * person holds the device for the game (a 3D game is played sideways), done once the tab is open.
 */
export async function playFromEditors(
  page: Page,
  context: BrowserContext,
  hold?: (play: Page) => Promise<void> | undefined,
): Promise<Page> {
  const [play] = await Promise.all([context.waitForEvent('page'), pressGame(page, 'Play')])
  await hold?.(play)
  await expect(play.locator('#game canvas')).toBeVisible({ timeout: 30_000 })
  await play.getByRole('button', { name: /play/i }).first().click()
  return play
}

/**
 * Publish from the top bar: the game is built and the zip downloaded. `keep` names where a downloaded file is kept (the
 * test's output folder); resolves to the zip's name and where it was kept.
 */
export async function publishFromEditors(
  page: Page,
  keep: (name: string) => string,
): Promise<{ name: string; path: string }> {
  await pressGame(page, 'Publish')
  const dialog = page.getByRole('dialog', { name: 'Put your game online' })
  await dialog.getByRole('button', { name: 'Build my game' }).click()
  const ready = dialog.getByText('Your game is ready to upload.')
  const refused = dialog.getByRole('alert')
  await expect(ready.or(refused).first()).toBeVisible({ timeout: 120_000 })
  if (await refused.isVisible()) throw new Error(`Publish refused the game: ${await dialog.innerText()}`)
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    dialog.getByRole('button', { name: 'Download the zip' }).click(),
  ])
  const path = keep(download.suggestedFilename())
  await download.saveAs(path)
  await dialog.getByRole('button', { name: 'Close' }).click()
  return { name: download.suggestedFilename(), path }
}

/** The game's canvas, as pixels. */
export async function gamePixels(play: Page): Promise<Pixels> {
  return readPng(await play.locator('#game canvas').screenshot())
}

/**
 * Before the game's page loads, records the pitch of every tone it starts (an oscillator's frequency set at a time):
 * what the player hears, without listening. Read with `pitchesPlayed`.
 */
export async function recordPitches(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const heard: number[] = []
    ;(globalThis as unknown as { __pitches: number[] }).__pitches = heard
    const set = AudioParam.prototype.setValueAtTime
    AudioParam.prototype.setValueAtTime = function (this: AudioParam, value: number, time: number) {
      heard.push(value)
      return set.call(this, value, time)
    }
  })
}

/**
 * Before the game's page loads, has every frame's picture measured in the page itself: the game's WebGL canvas keeps
 * its drawing, and each animation frame its mean brightness (0 to 255) is taken from a small copy. A screenshot takes
 * longer than a flash lasts; this sees every frame. Read with `brightestSince`.
 */
export async function recordBrightness(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext as (
      this: HTMLCanvasElement,
      kind: string,
      options?: Record<string, unknown>,
    ) => RenderingContext | null
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      kind: string,
      options?: Record<string, unknown>,
    ) {
      const keep = kind.startsWith('webgl') ? { ...options, preserveDrawingBuffer: true } : options
      return getContext.call(this, kind, keep)
    } as typeof HTMLCanvasElement.prototype.getContext
    const seen: number[] = []
    const times: number[] = []
    ;(globalThis as unknown as { __brightness: number[] }).__brightness = seen
    ;(globalThis as unknown as { __frameTimes: number[] }).__frameTimes = times
    const small = document.createElement('canvas')
    small.width = 32
    small.height = 32
    const measure = () => {
      const game = document.querySelector<HTMLCanvasElement>('#game canvas')
      const pen = small.getContext('2d', { willReadFrequently: true })
      if (game !== null && pen !== null && game.width > 0) {
        pen.drawImage(game, 0, 0, 32, 32)
        const data = pen.getImageData(0, 0, 32, 32).data
        let sum = 0
        for (let i = 0; i < data.length; i += 4)
          sum += ((data[i] ?? 0) + (data[i + 1] ?? 0) + (data[i + 2] ?? 0)) / 3
        seen.push(sum / (32 * 32))
        times.push(performance.now())
      }
      requestAnimationFrame(measure)
    }
    requestAnimationFrame(measure)
  })
}

/** How many frames have been measured so far: a mark to read the brightest frame since. */
export function framesMeasured(play: Page): Promise<number> {
  return play.evaluate(() => (globalThis as unknown as { __brightness?: number[] }).__brightness?.length ?? 0)
}

/** The brightest frame measured since the mark, and the first frame's brightness after it. */
export function brightestSince(play: Page, mark: number): Promise<{ first: number; brightest: number }> {
  return play.evaluate((from) => {
    const seen = (globalThis as unknown as { __brightness?: number[] }).__brightness?.slice(from) ?? []
    return { first: seen[0] ?? 0, brightest: Math.max(0, ...seen) }
  }, mark)
}

/**
 * How long, in the game's own seconds from the mark's frame, the picture kept changing: up to the frame after which every
 * measured frame is within `still` of the one before it. Holding a key that walks into a wall, it is how long the walk to
 * the wall took (the camera follows, so the picture stops when the walker does). The game's loop counts a slow frame as
 * at most 100 ms (`MAX_FRAME_MS`), so a slow browser plays slower; each frame here counts the same, so two walks compare
 * whatever the browser's frame rate.
 */
export function secondsMoving(play: Page, mark: number, still = 0.05): Promise<number> {
  return play.evaluate(
    ({ from, still }) => {
      const page = globalThis as unknown as { __brightness?: number[]; __frameTimes?: number[] }
      const seen = page.__brightness?.slice(from) ?? []
      const times = page.__frameTimes?.slice(from) ?? []
      let last = 0
      for (let i = 1; i < seen.length; i++)
        if (Math.abs((seen[i] ?? 0) - (seen[i - 1] ?? 0)) > still) last = i
      let seconds = 0
      for (let i = 1; i <= last; i++) seconds += Math.min((times[i] ?? 0) - (times[i - 1] ?? 0), 100) / 1000
      return seconds
    },
    { from: mark, still },
  )
}

export function pitchesPlayed(play: Page): Promise<number[]> {
  return play.evaluate(() => [...((globalThis as unknown as { __pitches?: number[] }).__pitches ?? [])])
}

/** The level's background, which the new game's canvas shows around and between everything drawn. */
export const LEVEL_BACKGROUND: readonly [number, number, number] = [0x1b, 0x25, 0x40]

/**
 * The colour the played game drew in the middle of a cell of its level, found from the background's box (the level is
 * drawn at a scale). `width` is the level's width in pixels; undefined until the level is on the canvas.
 */
export async function cellOnScreen(
  play: Page,
  cell: { readonly col: number; readonly row: number },
  tile: number,
  width = 512,
): Promise<readonly [number, number, number] | undefined> {
  const picture = await gamePixels(play)
  const field = boxOf(picture, LEVEL_BACKGROUND)
  if (field === undefined) return undefined
  const scale = field.w / width
  return picture.at(
    Math.round(field.x + (cell.col + 0.5) * tile * scale),
    Math.round(field.y + (cell.row + 0.5) * tile * scale),
  )
}
