import { Container, Graphics, Sprite } from 'pixi.js'
import { endesga } from '../art/palette.ts'
import { lightTexture } from './pixels.ts'

// The night behind the ruins, in layers that drift a little against the character's position (parallax):
// a stepped teal sky with stars and a big moon, far ruined towers, nearer trees, and a fog band. Drawn once
// from Endesga 64 colors at fixed places (PROVENANCE.md); only the layers' offsets change per frame.

export interface Backdrop {
  readonly view: Container
  /** The moon and its glow, which the renderer draws above the light map: the moon gives off light. */
  readonly moon: Container
  /** Shifts the layers for the character's x (pixels) and twinkles the stars; `time` in milliseconds. */
  update(playerX: number, time: number): void
}

const STARS: ReadonlyArray<readonly [x: number, y: number]> = [
  [22, 14],
  [61, 30],
  [97, 11],
  [140, 22],
  [176, 9],
  [205, 33],
  [231, 15],
  [290, 27],
  [38, 52],
  [118, 47],
  [306, 49],
  [74, 64],
  [160, 58],
  [312, 12],
]

// Moon centre, in sky pixels: upper right, clear of the goal's light.
const MOON_X = 262
const MOON_Y = 34

export function createBackdrop(width: number, height: number): Backdrop {
  const view = new Container()
  const sky = new Graphics()
  const bands = [52, 39, 38] as const // #03193f, #0c2e44, #134c4c
  const bandHeight = Math.ceil(height / bands.length)
  bands.forEach((index, i) => {
    sky.rect(0, i * bandHeight, width, bandHeight).fill(endesga(index))
    // Dither the band's top edge into the band above (a 2 × 2 checker over four rows, thinning out), so the
    // steps read as a gradient rather than stripes.
    const above = bands[i - 1]
    if (above === undefined) return
    for (let row = 0; row < 4; row++)
      for (let x = (row % 2) * 2; x < width; x += row < 2 ? 4 : 8)
        sky.rect(x, i * bandHeight + row * 2, 2, 2).fill(endesga(above))
  })
  // A soft horizon line where the sky meets the fog.
  sky.rect(0, height - 56, width, 2).fill(endesga(37))
  view.addChild(sky)

  const stars = STARS.map(([x, y]) => {
    const star = new Sprite(lightTexture(1))
    star.position.set(x - 1, y - 1)
    star.tint = endesga(9)
    view.addChild(star)
    return star
  })

  const moonLayer = new Container()
  const moonGlow = new Sprite(lightTexture(30))
  moonGlow.anchor.set(0.5)
  moonGlow.position.set(MOON_X, MOON_Y)
  moonGlow.tint = endesga(45)
  moonGlow.alpha = 0.25
  moonGlow.blendMode = 'add'
  moonLayer.addChild(moonGlow)
  const moon = new Graphics()
  moon.circle(MOON_X, MOON_Y, 11).fill(endesga(9)) // #c7cfdd
  moon.circle(MOON_X - 3, MOON_Y - 2, 9).fill(endesga(8))
  moon.circle(MOON_X + 4, MOON_Y + 3, 2).fill(endesga(9)) // craters
  moon.circle(MOON_X - 5, MOON_Y + 4, 1).fill(endesga(10))
  moonLayer.addChild(moon)

  const far = new Graphics()
  towers(far, height - 60, endesga(52))
  view.addChild(far)
  const near = new Graphics()
  trees(near, width, height - 36, endesga(15))
  view.addChild(near)
  const fog = new Graphics()
  fog.rect(-16, height - 26, width + 32, 26).fill({ color: endesga(38), alpha: 0.55 })
  view.addChild(fog)

  return {
    view,
    moon: moonLayer,
    update(playerX, time) {
      const fromCentre = playerX - width / 2
      far.x = Math.round(-fromCentre * 0.03)
      near.x = Math.round(-fromCentre * 0.07)
      fog.x = Math.round(Math.sin(time / 2400) * 6)
      stars.forEach((star, i) => {
        star.alpha = 0.55 + 0.45 * Math.sin(time / 700 + i * 1.7)
      })
    },
  }
}

/** Ruined towers and a broken arch, as stepped blocks, a little wider than the screen for the parallax. */
function towers(g: Graphics, baseline: number, color: string): void {
  const shapes: ReadonlyArray<readonly [x: number, w: number, h: number]> = [
    [-12, 22, 34],
    [18, 10, 20],
    [46, 16, 46],
    [92, 24, 28],
    [150, 12, 38],
    [196, 30, 22],
    [244, 14, 52],
    [290, 20, 30],
    [318, 16, 40],
  ]
  for (const [x, w, h] of shapes) {
    g.rect(x, baseline - h, w, h + 60).fill(color)
    // Crenellations and a dark window, so they read as ruins rather than boxes.
    for (let cx = x; cx < x + w; cx += 4) g.rect(cx, baseline - h - 2, 2, 2).fill(color)
    g.rect(x + Math.floor(w / 2) - 1, baseline - h + 6, 2, 4).fill(endesga(39))
  }
  // The arch between two towers.
  g.rect(62, baseline - 30, 30, 4).fill(color)
}

/** A row of pointed tree tops, stepped two pixels at a time. */
function trees(g: Graphics, width: number, baseline: number, color: string): void {
  for (let x = -16; x < width + 16; x += 14) {
    const height = 10 + ((x * 7) % 13)
    for (let step = 0; step < height; step += 2) {
      const half = Math.floor(((height - step) * 6) / height) + 1
      g.rect(x + 7 - half, baseline - step, half * 2, 2).fill(color)
    }
  }
  g.rect(-16, baseline, width + 32, 40).fill(color)
}
