// Test images drawn in the browser: a PNG of solid cells, so a canvas test can read back exactly which frame
// of an image a sprite shows. Runs in the `canvas` project only (it needs `OffscreenCanvas`).

/** A PNG `columns × rows` cells of `tile` px, each cell filled with `colors[row * columns + column]` (`#rrggbb`). */
export async function cellsPng(
  columns: number,
  rows: number,
  tile: number,
  colors: readonly string[],
): Promise<Uint8Array> {
  const canvas = new OffscreenCanvas(columns * tile, rows * tile)
  const context = canvas.getContext('2d')
  if (context === null) throw new Error('no 2D context')
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      context.fillStyle = colors[row * columns + column] ?? '#000000'
      context.fillRect(column * tile, row * tile, tile, tile)
    }
  }
  const blob = await canvas.convertToBlob({ type: 'image/png' })
  return new Uint8Array(await blob.arrayBuffer())
}
