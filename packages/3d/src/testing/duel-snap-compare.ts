// What the snap's tests share: a pass that draws a gradient covering a dense sample of the 8-bit colour cube (so the snap's
// input is exactly known), and a run that draws it through the table's snap and through the full loop and hands back
// the three pictures. Each pixel's colour is `(5 · pixel + frame · 1048573) mod 2^24`, so a frame of 2^18 pixels is a
// different quarter-million colours from every other, in every Bayer cell.

import { DEFAULT_PALETTE } from '@automata/content/palette'
import { type EffectFragment, type EffectIO, type Pass3D, PostEffect, type RenderGraph } from '@pixi/3d'
import { UniformGroup } from 'pixi.js'
import type { Pixi3dRenderer } from '../app/create-renderer.ts'
import { DuelSnapEffect } from '../features/look/duel-snap-filter.ts'
import { referenceSnap } from '../features/look/duel-snap-table.ts'
import { addColourOnlyPass, PresentEffect } from '../features/look/present-pass.ts'
import { DuelSnapReferenceEffect } from './duel-snap-reference.ts'

/** The stage colour of the rows the view does not cover. */
export const BACKGROUND = 0x2e222f

const STRIDE = 5
const SHIFT = 1048573
const MASK = 16777215

const FRAGMENT: EffectFragment = {
  gl: `
vec4 effect(vec2 uv) {
  vec2 p = floor(uv / texel());
  int w = int(1.0 / texel().x + 0.5);
  int n = ((int(p.y) * w + int(p.x)) * ${STRIDE} + int(uFrame) * ${SHIFT}) & ${MASK};
  return vec4(float(n >> 16) / 255.0, float((n >> 8) & 255) / 255.0, float(n & 255) / 255.0, 1.0);
}`,
  gpu: `
fn effect(uv: vec2<f32>) -> vec4<f32> {
  let p = floor(uv / texel());
  let w = i32(1.0 / texel().x + 0.5);
  let n = ((i32(p.y) * w + i32(p.x)) * ${STRIDE} + i32(fx.uFrame) * ${SHIFT}) & ${MASK};
  return vec4<f32>(f32(n >> 16u) / 255.0, f32((n >> 8u) & 255) / 255.0, f32(n & 255) / 255.0, 1.0);
}`,
}

/** Draws colour `frame`'s share of the cube, whatever the scene is. */
export class GradientEffect extends PostEffect {
  protected override readonly fragment: EffectFragment = FRAGMENT
  protected override readonly uniforms: UniformGroup = new UniformGroup({ uFrame: { value: 0, type: 'f32' } })

  set frame(value: number) {
    this.uniforms.uniforms.uFrame = value
  }

  override build(graph: RenderGraph, io: EffectIO): void {
    addColourOnlyPass(graph, io, 'GradientEffect', this.fragment, this.uniforms)
  }
}

/** One frame's three pictures, RGBA, top row first. */
export interface SnapFrame {
  readonly frame: number
  readonly input: ArrayLike<number>
  readonly table: ArrayLike<number>
  readonly loop: ArrayLike<number>
}

/** The colour index and Bayer cell the gradient drew at pixel `index` of `frame` in a `width`-wide view, whatever the row order. */
export function inputAt(
  rgb: readonly [number, number, number],
  frame: number,
  width: number,
): { cell: number } {
  const n = (rgb[0] << 16) | (rgb[1] << 8) | rgb[2]
  // 5 is odd, so its inverse mod 2^24 is 5^-1: the pixel index that made `n` this frame.
  const inverse = 13421773
  const q = (Math.imul((n - frame * SHIFT) & MASK, inverse) & MASK) >>> 0
  const x = q % width
  const y = Math.floor(q / width)
  return { cell: (x & 3) + ((y & 3) << 2) }
}

/**
 * Draws `frames` frames of the gradient through the snap with the table, through the one with the loop, and with no snap,
 * and hands each frame's pictures to `each`. `read` copies the canvas as the frame left it.
 */
export function compareSnaps(
  renderer: Pixi3dRenderer,
  strength: number,
  frames: number,
  read: (renderer: Pixi3dRenderer) => ArrayLike<number>,
  each: (frame: SnapFrame) => void,
  startedAt: number = strength,
): void {
  const frame = { alpha: 1, frameMs: 16, paused: false }
  const gradient = new GradientEffect()
  // `startedAt` differing from `strength` makes the table's effect change its dither after it was made.
  const table = new DuelSnapEffect(startedAt)
  table.dither = strength
  const loop = new DuelSnapReferenceEffect(strength)
  const present = new PresentEffect()
  const picture = (passes: Pass3D[], n: number): ArrayLike<number> => {
    gradient.frame = n
    renderer.view.passes = passes
    // The first frame after the list changes builds the graph again; the one after it is the settled picture.
    renderer.draw(frame)
    renderer.draw(frame)
    return Uint8Array.from(read(renderer))
  }
  try {
    for (let n = 0; n < frames; n++)
      each({
        frame: n,
        input: picture([gradient, present], n),
        table: picture([gradient, table], n),
        loop: picture([gradient, loop], n),
      })
  } finally {
    table.destroy()
  }
}

/** What `compareSnaps` found over all the frames. */
export interface SnapStats {
  /** Pixels the gradient drew (the view's rows; the rest keep the stage's background and are not counted). */
  readonly pixels: number
  readonly background: number
  /** Distinct input colours seen, and Bayer cells they met. */
  readonly colours: number
  readonly cells: number
  /** Pixels where the table's snap and the loop's differ in any byte: must be none. */
  readonly differ: number
  /** Pixels the table's snap left off the palette: must be none. */
  readonly notPalette: number
  /** Pixels where the GPU's answer is not the CPU model's (double precision): exact ties 32-bit arithmetic breaks the other way. */
  readonly offModel: number
}

/** Runs `compareSnaps` over `frames` frames of a `size` × `size` view, and counts what the pictures show. */
export function snapStats(
  renderer: Pixi3dRenderer,
  strength: number,
  frames: number,
  size: number,
  read: (renderer: Pixi3dRenderer) => ArrayLike<number>,
  startedAt: number = strength,
): SnapStats {
  const palette = DEFAULT_PALETTE.colors.map((hex) => Number.parseInt(hex.slice(1), 16))
  const colours = new Set<number>()
  const cells = new Set<number>()
  const found = { pixels: 0, background: 0, differ: 0, notPalette: 0, offModel: 0 }
  compareSnaps(
    renderer,
    strength,
    frames,
    read,
    (f) => {
      for (let i = 0; i < f.input.length; i += 4) {
        const rgb = [f.input[i] ?? 0, f.input[i + 1] ?? 0, f.input[i + 2] ?? 0] as const
        const key = (rgb[0] << 16) | (rgb[1] << 8) | rgb[2]
        // Rows the view does not cover keep the stage's background, which no pass draws.
        if (key === BACKGROUND) {
          found.background++
          continue
        }
        found.pixels++
        colours.add(key)
        if (f.table[i] !== f.loop[i] || f.table[i + 1] !== f.loop[i + 1] || f.table[i + 2] !== f.loop[i + 2])
          found.differ++
        const got = ((f.table[i] ?? 0) << 16) | ((f.table[i + 1] ?? 0) << 8) | (f.table[i + 2] ?? 0)
        if (!palette.includes(got)) found.notPalette++
        // The gradient's colour says which pixel drew it, so which Bayer cell it met.
        const { cell } = inputAt(rgb, f.frame, size)
        cells.add(cell)
        const want = referenceSnap([rgb[0] / 255, rgb[1] / 255, rgb[2] / 255], cell, strength)
        if (palette[want] !== got) found.offModel++
      }
    },
    startedAt,
  )
  return { ...found, colours: colours.size, cells: cells.size }
}
