// What a running game shows, read the way a player sees it: a screenshot of the page, then the colour at the middle of
// one level cell. The game's canvas is WebGL, so its own pixels cannot be read back; the screenshot is what is on the
// screen. The level is drawn contained in the canvas (scaled to fit, centred), as the starter game draws it.
import type { Page } from '@playwright/test'

export interface LevelFrame {
  /** The level's size in its own pixels. */
  readonly width: number
  readonly height: number
  /** One cell, in the level's pixels. */
  readonly tile: number
}

/** The colour at the middle of a level cell on the game's screen, as `rrggbb`. */
export async function cellColour(
  page: Page,
  level: LevelFrame,
  cell: { col: number; row: number },
): Promise<string> {
  const box = await page.locator('#game canvas').boundingBox()
  if (box === null) throw new Error('the game has no canvas on the screen')
  const scale = Math.min(box.width / level.width, box.height / level.height)
  const x = box.x + (box.width - level.width * scale) / 2 + (cell.col + 0.5) * level.tile * scale
  const y = box.y + (box.height - level.height * scale) / 2 + (cell.row + 0.5) * level.tile * scale
  const shot = (await page.screenshot()).toString('base64')
  return page.evaluate(
    async ({ shot, x, y }) => {
      const image = new Image()
      image.src = `data:image/png;base64,${shot}`
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.width
      canvas.height = image.height
      const context = canvas.getContext('2d')
      if (context === null) throw new Error('no 2D context to read the screenshot with')
      context.drawImage(image, 0, 0)
      const [r, g, b] = context.getImageData(Math.round(x), Math.round(y), 1, 1).data
      return [r, g, b].map((value) => (value ?? 0).toString(16).padStart(2, '0')).join('')
    },
    { shot, x, y },
  )
}
