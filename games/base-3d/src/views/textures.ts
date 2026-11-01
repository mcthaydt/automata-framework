// The scene's procedural textures (art direction spec §3.4, §4.4): Emberwick-style pixel art painted into RGBA pixel
// buffers from the night palette, then uploaded once as nearest-filtered textures. Painting into buffers (no canvas)
// keeps them testable in Node and identical on every run: each painter draws from its own fixed seed.
import { BufferImageSource, Texture } from 'pixi.js'
import { hexOf, TOKENS, type Token } from './palette.ts'

/** An RGBA image, rows top to bottom. */
export interface Pixels {
  readonly width: number
  readonly height: number
  readonly data: Uint8ClampedArray
}

/** A small linear congruential generator: the painters' only randomness, seeded, so their output never changes. */
function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

interface Painter extends Pixels {
  /** Paints the pixel at (x, y), wrapped round the edges, in a token's colour. */
  dot(x: number, y: number, token: Token): void
  /** Fills a rectangle (clipped) in a token's colour. */
  rect(x: number, y: number, w: number, h: number, token: Token): void
  /** Sets the pixel to white at `alpha` (0…1), for the soft textures that cards tint. */
  white(x: number, y: number, alpha: number): void
}

function painter(width: number, height: number): Painter {
  const data = new Uint8ClampedArray(width * height * 4)
  const rgb = (token: Token): [number, number, number] => {
    const value = Number.parseInt(hexOf(TOKENS[token]).slice(1), 16)
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
  }
  const put = (x: number, y: number, r: number, g: number, b: number, a: number): void => {
    const i = (y * width + x) * 4
    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
    data[i + 3] = a
  }
  return {
    width,
    height,
    data,
    dot(x, y, token) {
      put(((x % width) + width) % width, ((y % height) + height) % height, ...rgb(token), 255)
    },
    rect(x, y, w, h, token) {
      const [r, g, b] = rgb(token)
      for (let j = Math.max(0, y); j < Math.min(height, y + h); j++)
        for (let i = Math.max(0, x); i < Math.min(width, x + w); i++) put(i, j, r, g, b, 255)
    },
    white(x, y, alpha) {
      put(x, y, 255, 255, 255, Math.round(Math.min(1, Math.max(0, alpha)) * 255))
    },
  }
}

/** Which stone: the platforms' mossy flagstones, the channels' bare sides, or the walls' darker bricks. */
export type StoneKind = 'floor' | 'side' | 'wall'

/**
 * Stone blocks, 32 px a tile (the floor 64, laid over twice the length, so its moss repeats less): rows 8 px high of
 * offset 11 px slabs in two tones over mortar, a chipped lighter edge on about half of them, one tone a slab; the
 * floor's grows solid clumps of moss.
 */
export function paintStone(kind: StoneKind): Pixels {
  const size = kind === 'floor' ? 64 : 32
  const p = painter(size, size)
  const rand = seeded(kind === 'floor' ? 1 : kind === 'side' ? 2 : 3)
  const tones: readonly Token[] = kind === 'wall' ? ['stoneLight', 'stone'] : ['stone', 'stoneLight']
  p.rect(0, 0, size, size, kind === 'wall' ? 'mortarDeep' : 'mortar')
  const rowHeight = 8
  for (let row = 0; row < size / rowHeight; row++) {
    const offset = row % 2 === 0 ? 0 : 6
    for (let x = -offset; x < size; x += 12) {
      const tone = tones[Math.floor(rand() * tones.length)] as Token
      p.rect(x + 1, row * rowHeight + 1, 11, rowHeight - 1, tone)
      if (rand() < 0.5) p.rect(x + 2, row * rowHeight + 1, 4 + Math.floor(rand() * 6), 1, 'stoneEdge')
    }
  }
  if (kind === 'floor') {
    // Moss grows in solid clumps (no scattered specks: at the view's resolution each reads as noise): a disc of dark
    // green, a smaller lighter one inside it, wrapping so the tile repeats seamlessly.
    const disc = (cx: number, cy: number, r: number, token: Token): void => {
      for (let y = -r; y <= r; y++)
        for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r) p.dot(cx + x, cy + y, token)
    }
    for (let clump = 0; clump < 26; clump++) {
      const cx = Math.floor(rand() * size)
      const cy = Math.floor(rand() * size)
      const r = 2 + Math.floor(rand() * 3)
      disc(cx, cy, r, 'moss')
      disc(cx - 1, cy - 1, r - 2, 'mossMid')
    }
  }
  return p
}

/** A grass tuft, 16 px: nine blades of three greens with bright tips, rooted on the bottom row. */
export function paintGrass(): Pixels {
  const size = 16
  const p = painter(size, size)
  const rand = seeded(5)
  const blades: readonly Token[] = ['mossMid', 'grass', 'moss']
  for (let i = 0; i < 9; i++) {
    const x = 1 + Math.floor(rand() * 14)
    const h = 4 + Math.floor(rand() * 9)
    p.rect(x, size - h, 1, h, blades[i % 3] as Token)
    p.dot(x, size - h, 'grassTip')
  }
  return p
}

/** A hanging vine, 8 × 32 px: a wavy stem from the top edge with a leaf every four rows. */
export function paintVine(): Pixels {
  const p = painter(8, 32)
  const rand = seeded(7)
  const length = 32 - Math.floor(rand() * 6)
  for (let y = 0; y < length; y++) {
    const x = 3 + Math.round(Math.sin(y * 0.5) * 1.2)
    p.dot(x, y, 'moss')
    if (y % 4 === 1) p.rect(x + (y % 8 === 1 ? 1 : -2), y, 2, 1, 'mossMid')
  }
  return p
}

/** A backdrop silhouette, 32 × 64 px, in one flat colour: a pine (Emberwick's near layer) or a ruined tower (its far one). */
export function paintSilhouette(kind: 'pine' | 'tower'): Pixels {
  const p = painter(32, 64)
  if (kind === 'tower') {
    p.rect(8, 12, 16, 52, 'tower')
    for (let x = 8; x < 24; x += 4) p.rect(x, 8, 2, 4, 'tower')
    // A window: cut back out.
    for (let y = 22; y < 28; y++)
      for (let x = 14; x < 18; x++) p.data.fill(0, (y * 32 + x) * 4, (y * 32 + x) * 4 + 4)
    return p
  }
  p.rect(15, 50, 2, 14, 'night')
  for (let y = 4; y < 54; y++) {
    const half = Math.floor(((y - 4) / 50) * 14 * (0.75 + 0.25 * ((y % 8) / 8))) + 1
    p.rect(16 - half, y, half * 2, 1, 'night')
  }
  p.rect(15, 1, 2, 4, 'night')
  return p
}

/**
 * The moon, 128 px: a pale disc, a brighter face up and to the left, and five craters. Painted at 128 so the 16 m disc
 * stays round where the view shows it a hundred pixels or more across.
 */
export function paintMoon(): Pixels {
  const size = 128
  const p = painter(size, size)
  const disc = (cx: number, cy: number, r: number, token: Token): void => {
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++)
        if ((x + 0.5 - cx) * (x + 0.5 - cx) + (y + 0.5 - cy) * (y + 0.5 - cy) <= r * r) p.dot(x, y, token)
  }
  disc(64, 64, 58, 'moon')
  disc(56, 56, 47, 'moonBright')
  disc(40, 82, 9, 'moonShade')
  disc(77, 44, 6, 'moonShade')
  disc(86, 85, 11, 'moonShade')
  disc(60, 96, 4, 'moonShade')
  disc(93, 62, 3, 'moonShade')
  return p
}

/** A soft round glow, 64 px, white: full in the middle, nothing at the rim; cards tint it for halos and motes. */
export function paintGlow(): Pixels {
  const size = 64
  const p = painter(size, size)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / (size / 2)
      if (d >= 1) continue
      // Bright core, long soft tail: (1 − d)² over a gentler (1 − d) so the rim fades to nothing.
      p.white(x, y, (1 - d) * (1 - d) * 0.75 + (1 - d) * 0.25 + (d < 0.08 ? 0.2 : 0))
    }
  return p
}

/** A slanted soft band, 64 px, white: one moonlight shaft, leaning a third of its height to the right as it falls. */
export function paintShaft(): Pixels {
  const size = 64
  const p = painter(size, size)
  for (let y = 0; y < size; y++) {
    const fade = Math.min(1, (size - y) / (size * 0.7)) * Math.min(1, y / 6)
    const centre = size / 2 + (y - size / 2) * 0.35
    for (let x = 0; x < size; x++) {
      const d = Math.abs(x + 0.5 - centre) / 9
      const alpha = Math.max(0, 1 - d * d) * fade
      if (alpha > 0) p.white(x, y, alpha)
    }
  }
  return p
}

/** Uploads painted pixels as a texture: nearest-filtered pixel art, repeating when it tiles a surface. */
export function toTexture(pixels: Pixels, repeat: boolean, smooth = false): Texture {
  const source = new BufferImageSource({
    resource: new Uint8Array(pixels.data.buffer),
    width: pixels.width,
    height: pixels.height,
    format: 'rgba8unorm',
    alphaMode: 'premultiply-alpha-on-upload',
    addressMode: repeat ? 'repeat' : 'clamp-to-edge',
    scaleMode: smooth ? 'linear' : 'nearest',
  })
  return new Texture({ source })
}
