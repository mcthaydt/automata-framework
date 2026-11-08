// Where to tap to hit a level cell on the real canvas. The canvas publishes the camera it last drew with as
// `data-camera="x,y,scale"` (LevelCanvas.svelte): a level pixel p is drawn at x + p * scale inside the canvas's box.
import type { Locator } from '@playwright/test'

export interface Camera {
  readonly x: number
  readonly y: number
  readonly scale: number
}

/** `"4,8,2"` → `{ x: 4, y: 8, scale: 2 }`; anything else is an error naming what was read. */
export function parseCamera(attribute: string | null): Camera {
  const [x = Number.NaN, y = Number.NaN, scale = Number.NaN] = (attribute ?? '').split(',').map(Number)
  if (!(Number.isFinite(x) && Number.isFinite(y) && scale > 0))
    throw new Error(`the canvas has no camera yet (data-camera="${attribute}")`)
  return { x, y, scale }
}

/** The page point at the centre of cell (`col`, `row`) of a `tile`-pixel grid, for a canvas whose box starts at `box`. */
export function cellCentre(
  cell: { col: number; row: number },
  tile: number,
  camera: Camera,
  box: { x: number; y: number },
): { x: number; y: number } {
  return {
    x: box.x + camera.x + (cell.col + 0.5) * tile * camera.scale,
    y: box.y + camera.y + (cell.row + 0.5) * tile * camera.scale,
  }
}

/** The page point of a cell on `canvas` (the `[data-level-canvas]` element), once it has drawn. */
export async function cellOnCanvas(
  canvas: Locator,
  cell: { col: number; row: number },
  tile: number,
): Promise<{ x: number; y: number }> {
  const camera = parseCamera(await canvas.getAttribute('data-camera'))
  const box = await canvas.boundingBox()
  if (box === null) throw new Error('the level canvas is not on the page')
  return cellCentre(cell, tile, camera, box)
}
