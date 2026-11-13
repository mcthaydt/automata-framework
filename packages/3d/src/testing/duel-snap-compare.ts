// What the snap's tests share: a pass that draws a gradient covering a dense sample of the 8-bit colour cube (so the snap's
// input is exactly known), and a run that draws it through the table's snap and through the full loop and hands back
// the three pictures. Each pixel's colour is `(5 · pixel + frame · 1048573) mod 2^24`, so a frame of 2^18 pixels is a
// different quarter-million colours from every other, in every Bayer cell.

import { type EffectFragment, type EffectIO, type Pass3D, PostEffect, type RenderGraph } from '@pixi/3d'
import { UniformGroup } from 'pixi.js'
import type { Pixi3dRenderer } from '../app/create-renderer.ts'
import { DuelSnapEffect } from '../features/look/duel-snap-filter.ts'
import { addColourOnlyPass, PresentEffect } from '../features/look/present-pass.ts'
import { DuelSnapReferenceEffect } from './duel-snap-reference.ts'

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
): void {
  const frame = { alpha: 1, frameMs: 16, paused: false }
  const gradient = new GradientEffect()
  const table = new DuelSnapEffect(strength)
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
