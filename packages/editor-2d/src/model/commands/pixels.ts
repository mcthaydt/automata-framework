/** Positions and sizes are whole pixels in the file. `+ 0` turns a rounded -0 into 0, which a file cannot hold. */
export function wholePixels(n: number): number {
  return Math.round(n) + 0
}
