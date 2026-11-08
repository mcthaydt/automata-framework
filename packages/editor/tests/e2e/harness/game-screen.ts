// What a running game shows, read the way a player sees it: a screenshot of the page, then the colour at the middle of
// one level cell. The game's canvas is WebGL, so its own pixels cannot be read back; the screenshot is what is on the
// screen. Where the level sits on the screen depends on the screen's shape, so it is found by its walls: the starter
// level's floor fills its bottom rows from edge to edge, so the box around every wall-coloured pixel is the level's
// left, right and bottom edges.
import type { Page } from '@playwright/test'

export interface LevelFrame {
  /** The level's size in its own pixels. */
  readonly width: number
  readonly height: number
  /** One cell, in the level's pixels. */
  readonly tile: number
  /** The colour the game draws a wall in (`rrggbb`). */
  readonly wall: string
}

/** The colour at the middle of each level cell asked for, on the game's screen now, as `rrggbb`. */
export async function cellColours(
  page: Page,
  level: LevelFrame,
  cells: readonly { col: number; row: number }[],
): Promise<string[]> {
  const shot = (await page.screenshot()).toString('base64')
  return page.evaluate(
    async ({ shot, level, cells }) => {
      const image = new Image()
      image.src = `data:image/png;base64,${shot}`
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.width
      canvas.height = image.height
      const context = canvas.getContext('2d')
      if (context === null) throw new Error('no 2D context to read the screenshot with')
      context.drawImage(image, 0, 0)
      const { data, width, height } = context.getImageData(0, 0, image.width, image.height)
      const hex = (at: number) =>
        [data[at], data[at + 1], data[at + 2]]
          .map((value) => (value ?? 0).toString(16).padStart(2, '0'))
          .join('')
      let left = width
      let right = -1
      let bottom = -1
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++)
          if (hex((y * width + x) * 4) === level.wall) {
            left = Math.min(left, x)
            right = Math.max(right, x)
            bottom = Math.max(bottom, y)
          }
      if (right < 0) throw new Error('no wall on the screen: is the game past its title?')
      const scale = (right + 1 - left) / level.width
      const top = bottom + 1 - level.height * scale
      return cells.map(({ col, row }) => {
        const x = Math.round(left + (col + 0.5) * level.tile * scale)
        const y = Math.round(top + (row + 0.5) * level.tile * scale)
        return hex((y * width + x) * 4)
      })
    },
    { shot, level, cells },
  )
}
