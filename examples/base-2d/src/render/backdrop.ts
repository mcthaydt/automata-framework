import { Graphics } from 'pixi.js'
import { endesga } from '../art/palette.ts'

// Celeste's layered night sky behind Bubble Bobble's bricks: three bands of navy, a scatter of stars at fixed
// places, and two rows of distant hills. Drawn once; the colors are Endesga 64 (PROVENANCE.md).

const STARS: ReadonlyArray<readonly [x: number, y: number, bright: boolean]> = [
  [22, 14, true],
  [61, 30, false],
  [97, 11, false],
  [140, 22, true],
  [176, 9, false],
  [205, 33, false],
  [251, 17, true],
  [290, 27, false],
  [38, 52, false],
  [118, 47, false],
  [232, 58, true],
  [306, 49, false],
  [74, 74, false],
  [268, 82, false],
]

export function drawBackdrop(width: number, height: number): Graphics {
  const g = new Graphics()
  g.rect(0, 0, width, height).fill(endesga(15)) // #0e071b
  g.rect(0, height * 0.45, width, height * 0.55).fill(endesga(14)) // #1a1932
  g.rect(0, height * 0.7, width, height * 0.3).fill(endesga(13)) // #2a2f4e
  for (const [x, y, bright] of STARS) g.rect(x, y, 1, 1).fill(bright ? endesga(9) : endesga(11))
  // Far hills, then near hills: stepped blocks, so they read as pixel art rather than smooth curves.
  hills(g, width, height - 44, 18, endesga(12)) // #424c6e
  hills(g, width, height - 30, 12, endesga(13))
  return g
}

function hills(g: Graphics, width: number, baseline: number, amplitude: number, color: string): void {
  for (let x = 0; x < width; x += 4) {
    const rise = Math.round(amplitude * (0.5 + 0.5 * Math.sin(x / 23) * Math.cos(x / 41)))
    g.rect(x, baseline - rise, 4, rise + 48).fill(color)
  }
}
