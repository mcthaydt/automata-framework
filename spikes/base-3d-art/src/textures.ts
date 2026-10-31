// Procedural pixel-art textures for the art spike, painted on a canvas in Endesga 64 (the same palette entries as
// Emberwick's tiles), nearest-filtered and repeating. A seeded generator keeps every run's pixels identical.

import { Texture } from 'pixi.js'
import { ENDESGA_64 } from '../../../packages/content/src/palette/endesga-64.ts'

export const E = (index: number): string => ENDESGA_64[index] as string
export const hex = (index: number): number => Number.parseInt(E(index).slice(1), 16)

function seeded(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d') as CanvasRenderingContext2D]
}

function texture(c: HTMLCanvasElement, repeat: boolean, nearest = true): Texture {
  const t = Texture.from(c)
  t.source.style.addressMode = repeat ? 'repeat' : 'clamp-to-edge'
  t.source.style.scaleMode = nearest ? 'nearest' : 'linear'
  return t
}

/** Stone blocks, two rows of offset slabs per tile, mortar dark, a chipped highlight on each top edge; `moss` tops it green. */
export function stoneTexture(
  moss: number,
  seed = 1,
  palette = { stone: [13, 12], mortar: 14, light: 11 },
): Texture {
  const size = 32
  const [c, g] = canvas(size, size)
  const rand = seeded(seed)
  g.fillStyle = E(palette.mortar)
  g.fillRect(0, 0, size, size)
  const rows = 4
  const rowH = size / rows
  for (let r = 0; r < rows; r++) {
    const offset = r % 2 === 0 ? 0 : 6
    for (let x = -offset; x < size; x += 12) {
      const tone = palette.stone[Math.floor(rand() * palette.stone.length)] as number
      g.fillStyle = E(tone)
      g.fillRect(x + 1, r * rowH + 1, 11, rowH - 1)
      if (rand() < 0.5) {
        g.fillStyle = E(palette.light)
        g.fillRect(x + 2, r * rowH + 1, 4 + Math.floor(rand() * 6), 1)
      }
      for (let k = 0; k < 2; k++) {
        g.fillStyle = E(palette.stone[1] as number)
        g.fillRect(x + 1 + Math.floor(rand() * 11), r * rowH + 2 + Math.floor(rand() * (rowH - 3)), 1, 1)
      }
    }
  }
  if (moss > 0) {
    // Moss grows in clumps: a few blobs of dark and mid green, each a handful of pixels round a seed.
    const clumps = Math.round(moss * 40)
    for (let i = 0; i < clumps; i++) {
      const cx = Math.floor(rand() * size)
      const cy = Math.floor(rand() * size)
      const r = 2 + Math.floor(rand() * 3)
      for (let k = 0; k < r * r * 2; k++) {
        const x = (cx + Math.floor((rand() - 0.5) * 2 * r) + size) % size
        const y = (cy + Math.floor((rand() - 0.5) * 2 * r) + size) % size
        g.fillStyle = E([37, 37, 36, 38][Math.floor(rand() * 4)] as number)
        g.fillRect(x, y, 1, 1)
      }
    }
  }
  return texture(c, true)
}

/** Lava: dark red crust over bright cracks of orange and yellow. */
export function lavaTexture(seed = 3): Texture {
  const size = 32
  const [c, g] = canvas(size, size)
  const rand = seeded(seed)
  g.fillStyle = E(28)
  g.fillRect(0, 0, size, size)
  for (let i = 0; i < 40; i++) {
    g.fillStyle = E([26, 27][i % 2] as number)
    g.fillRect(
      Math.floor(rand() * size),
      Math.floor(rand() * size),
      2 + Math.floor(rand() * 4),
      2 + Math.floor(rand() * 3),
    )
  }
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(rand() * size)
    const y = Math.floor(rand() * size)
    const len = 2 + Math.floor(rand() * 5)
    g.fillStyle = E([28, 29, 30, 31][Math.floor(rand() * 4)] as number)
    if (rand() < 0.5) g.fillRect(x, y, len, 1)
    else g.fillRect(x, y, 1, len)
  }
  for (let i = 0; i < 18; i++) {
    g.fillStyle = E(32)
    g.fillRect(Math.floor(rand() * size), Math.floor(rand() * size), 1, 1)
  }
  return texture(c, true)
}

/** A soft round glow, white at the centre falling to nothing: tinted per particle for halos, motes and sparks. */
export function glowTexture(): Texture {
  const size = 64
  const [c, g] = canvas(size, size)
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.25, 'rgba(255,255,255,0.55)')
  grad.addColorStop(0.6, 'rgba(255,255,255,0.12)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  return texture(c, false, false)
}

/** A slanted soft band, for moonlight shafts drawn as one additive card. */
export function shaftTexture(): Texture {
  const size = 64
  const [c, g] = canvas(size, size)
  for (let y = 0; y < size; y++) {
    const fade = Math.min(1, (size - y) / (size * 0.85)) * Math.min(1, y / 6)
    const centre = size / 2 + (y - size / 2) * 0.35
    for (let x = 0; x < size; x++) {
      const d = Math.abs(x - centre) / 9
      const a = Math.max(0, 1 - d * d) * fade
      if (a <= 0) continue
      g.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`
      g.fillRect(x, y, 1, 1)
    }
  }
  return texture(c, false, false)
}

/** A grass tuft: pixel blades, rooted at the bottom edge; cut out with an alpha mask. */
export function grassTexture(seed = 5): Texture {
  const size = 16
  const [c, g] = canvas(size, size)
  const rand = seeded(seed)
  for (let i = 0; i < 9; i++) {
    const x = 1 + Math.floor(rand() * 14)
    const h = 4 + Math.floor(rand() * 9)
    g.fillStyle = E([36, 35, 37][i % 3] as number)
    g.fillRect(x, size - h, 1, h)
    g.fillStyle = E(34)
    g.fillRect(x, size - h, 1, 1)
  }
  return texture(c, false)
}

/** A hanging vine: a wavy stem with leaves, top edge at the card's top. */
export function vineTexture(seed = 7): Texture {
  const w = 8
  const h = 32
  const [c, g] = canvas(w, h)
  const rand = seeded(seed)
  for (let y = 0; y < h - Math.floor(rand() * 6); y++) {
    const x = 3 + Math.round(Math.sin(y * 0.5) * 1.2)
    g.fillStyle = E(37)
    g.fillRect(x, y, 1, 1)
    if (y % 4 === 1) {
      g.fillStyle = E(36)
      g.fillRect(x + (y % 8 === 1 ? 1 : -2), y, 2, 1)
    }
  }
  return texture(c, false)
}

/** A pine silhouette (or a ruined tower when `tower`), one flat colour, for the backdrop's layered cards. */
export function silhouetteTexture(colour: number, tower: boolean, seed = 11): Texture {
  const w = 32
  const h = 64
  const [c, g] = canvas(w, h)
  const rand = seeded(seed)
  g.fillStyle = E(colour)
  if (tower) {
    g.fillRect(8, 12, 16, 52)
    for (let x = 8; x < 24; x += 4) g.fillRect(x, 8, 2, 4)
    g.clearRect(14, 22, 4, 6)
  } else {
    g.fillRect(15, 50, 2, 14)
    for (let y = 4; y < 54; y++) {
      const half = Math.floor(((y - 4) / 50) * 14 * (0.75 + 0.25 * ((y % 8) / 8))) + 1
      g.fillRect(16 - half, y, half * 2, 1)
    }
    if (rand() < 2) g.fillRect(15, 1, 2, 4)
  }
  return texture(c, false)
}

/** The moon: a pale disc with craters (Emberwick's moon, scaled). */
export function moonTexture(): Texture {
  const size = 32
  const [c, g] = canvas(size, size)
  g.fillStyle = E(9)
  g.beginPath()
  g.arc(16, 16, 14, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = E(8)
  g.beginPath()
  g.arc(13, 13, 11, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = E(10)
  for (const [x, y, r] of [
    [10, 20, 2],
    [19, 11, 1.5],
    [21, 21, 2.5],
  ] as const) {
    g.beginPath()
    g.arc(x, y, r, 0, Math.PI * 2)
    g.fill()
  }
  return texture(c, false)
}
