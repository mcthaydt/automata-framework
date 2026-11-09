// What a journey can say about a word the game drew: how tall its letters are on the player's screen and how wide the
// soft edge of a stem is, read from the canvas the player saw. `keepWhitestFrame` and `catchTheWord` get that picture
// out of the game page: the frame with the most white in it, kept at the canvas's own resolution.
import type { BrowserContext, Page } from '@playwright/test'
import { expect } from './fixtures.ts'
import { readPng } from './read-png.ts'

/** A pixel counts as the word's white when its dimmest channel is at least this. */
const WHITE = 200
/** A pixel is on the edge of a stem when its dimmest channel is between these (a fraction of white). */
const EDGE = { low: 0.25, high: 0.9 } as const

export interface WordMeasure {
  /**
   * The height of the word's first letter, a capital, in CSS px (the screen the player looks at). A comma, an
   * exclamation mark or an accent changes the height of the whole word, never of that letter, so the same font size
   * reads the same whatever the words say.
   */
  readonly capitalHeightCss: number
  /** The median length, in device px, of a run of in-between pixels along a row of the letters: 1 or 2 is sharp. */
  readonly edgeRunDevice: number
}

/**
 * Measures the word in a picture of the game's canvas. `devicePerCss` is how many canvas pixels a CSS px of the page
 * takes. A picture with no white in it has no word: its height is 0 and its edge is infinite, so a check on either fails.
 */
export function measureWord(png: Buffer, devicePerCss: number): WordMeasure {
  const pixels = readPng(png)
  const dimmest = (x: number, y: number): number => Math.min(...pixels.at(x, y))
  let minX = pixels.width
  let minY = pixels.height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < pixels.height; y++)
    for (let x = 0; x < pixels.width; x++) {
      if (dimmest(x, y) < WHITE) continue
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }
  if (maxX < 0) return { capitalHeightCss: 0, edgeRunDevice: Number.POSITIVE_INFINITY }

  // The first letter: the white columns from the left edge of the ink up to the first column with none.
  let lastX = minX
  const whiteInColumn = (x: number): boolean => {
    for (let y = minY; y <= maxY; y++) if (dimmest(x, y) >= WHITE) return true
    return false
  }
  while (lastX < maxX && whiteInColumn(lastX + 1)) lastX++
  let top = pixels.height
  let bottom = -1
  for (let y = minY; y <= maxY; y++)
    for (let x = minX; x <= lastX; x++)
      if (dimmest(x, y) >= WHITE) {
        top = Math.min(top, y)
        bottom = Math.max(bottom, y)
      }

  const runs: number[] = []
  for (let y = minY; y <= maxY; y++) {
    let run = 0
    for (let x = Math.max(0, minX - 3); x <= Math.min(pixels.width - 1, maxX + 3); x++) {
      const coverage = dimmest(x, y) / 255
      if (coverage > EDGE.low && coverage < EDGE.high) run++
      else {
        if (run > 0) runs.push(run)
        run = 0
      }
    }
  }
  runs.sort((a, b) => a - b)
  return {
    capitalHeightCss: (bottom - top + 1) / devicePerCss,
    edgeRunDevice: runs[Math.floor(runs.length / 2)] ?? Number.POSITIVE_INFINITY,
  }
}

/**
 * Before the game's page loads: keeps what the game's canvas drew (a WebGL canvas drops it after each frame) and, every
 * frame, copies the one with the most white in it aside. Read it with `catchTheWord`.
 */
export async function keepWhitestFrame(context: BrowserContext): Promise<void> {
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
      return getContext.call(
        this,
        kind,
        kind.startsWith('webgl') ? { ...options, preserveDrawingBuffer: true } : options,
      )
    } as typeof HTMLCanvasElement.prototype.getContext
    const small = document.createElement('canvas')
    const best = document.createElement('canvas')
    const keep = globalThis as unknown as { __best: number; __bestCanvas: HTMLCanvasElement }
    keep.__best = 0
    keep.__bestCanvas = best
    const look = (): void => {
      const game = document.querySelector<HTMLCanvasElement>('#game canvas')
      if (game !== null && game.width > 0) {
        small.width = game.width
        small.height = game.height
        const pen = small.getContext('2d', { willReadFrequently: true })
        if (pen !== null) {
          pen.drawImage(game, 0, 0)
          const data = pen.getImageData(0, 0, small.width, small.height).data
          let white = 0
          for (let i = 0; i < data.length; i += 4)
            if ((data[i] ?? 0) > 200 && (data[i + 1] ?? 0) > 200 && (data[i + 2] ?? 0) > 200) white++
          if (white > keep.__best) {
            keep.__best = white
            best.width = game.width
            best.height = game.height
            best.getContext('2d')?.drawImage(game, 0, 0)
          }
        }
      }
      requestAnimationFrame(look)
    }
    requestAnimationFrame(look)
  })
}

/** Resolves when the whitest frame has not changed for `quietMs` of the page's own clock, polling the page. */
async function settled(play: Page, quietMs = 1500): Promise<void> {
  let last = -1
  let since = Date.now()
  await expect
    .poll(
      async () => {
        const best = await play.evaluate(() => (globalThis as unknown as { __best: number }).__best)
        if (best !== last) {
          last = best
          since = Date.now()
        }
        return Date.now() - since
      },
      { message: 'the word plays out', timeout: 20_000, intervals: [250] },
    )
    .toBeGreaterThanOrEqual(quietMs)
}

/**
 * Holds `key` (the one that bumps the wall) until the game has drawn a word, lets the word play out, and returns the
 * whitest frame the page kept and how many canvas pixels a CSS px takes.
 */
export async function catchTheWord(play: Page, key: string): Promise<{ png: Buffer; devicePerCss: number }> {
  await play.keyboard.down(key)
  try {
    await expect
      .poll(() => play.evaluate(() => (globalThis as unknown as { __best: number }).__best), {
        message: 'the game draws a word',
        // A 3D game on an iPad is slow to reach the wall when two journeys share the machine.
        timeout: 45_000,
      })
      .toBeGreaterThan(20)
    // The word plays out: the whitest frame is final once no whiter one has come for a moment.
    await settled(play)
  } finally {
    await play.keyboard.up(key)
  }
  const shot = await play.evaluate(() => {
    const keep = globalThis as unknown as { __bestCanvas: HTMLCanvasElement }
    const game = document.querySelector<HTMLCanvasElement>('#game canvas')
    return {
      url: keep.__bestCanvas.toDataURL('image/png'),
      devicePerCss: game === null ? 1 : game.width / game.getBoundingClientRect().width,
    }
  })
  return { png: Buffer.from(shot.url.split(',')[1] ?? '', 'base64'), devicePerCss: shot.devicePerCss }
}
