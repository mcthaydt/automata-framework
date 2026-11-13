/**
 * What a fog does to a painted cell, asked of two readbacks of the same draw, one with no fog and one with it. A cell is an
 * unlit picture of display colours, and `@pixi/3d` 0.1.0-beta.2 fogged an unlit colour as a plain mix of display values toward the
 * fog's colour, `(1 - s) * colour + s * fog` with `s = smoothstep(near, far, depth)`. Beta.3 mixes the same colour in linear light
 * and encodes it again, which reads brighter everywhere between near and far (a power mean of exponent 2.2, not a straight mix), so
 * a painted figure in a fogged room would come out lighter than the room's other unlit things and than beta.2 drew it. The painter's
 * material does the beta.2 mix itself; this file is the proof. The cases share it between WebGL and WebGPU.
 */
import { expect } from 'vitest'
import { CASES } from './view-cases.ts'
import {
  type CaseReadback,
  drawCase,
  drawStanding,
  type Readback,
  type Renderer,
  type TestFog,
} from './view-draw.ts'

/** From 10 m to 30 m, to a warm colour no cell of the base figures is near, so a wrong mix cannot pass by chance. */
export const FOG: TestFog = { near: 10, far: 30, colour: [1, 0.5, 0.2] }

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Every opaque pixel of `fogged` is `plain`'s mixed toward the fog's colour by `s`, within one of 255; the alpha is untouched. */
function expectMixed(plain: Readback, fogged: Readback, s: number): void {
  expect([fogged.w, fogged.h], 'the canvas is the same').toEqual([plain.w, plain.h])
  let wrong = 0,
    first = '',
    opaque = 0,
    moved = 0
  for (let i = 0; i < plain.rgba.length; i += 4) {
    if (plain.rgba[i + 3] !== fogged.rgba[i + 3]) {
      wrong++
      first ||= `alpha at byte ${i}: ${plain.rgba[i + 3]} and ${fogged.rgba[i + 3]}`
      continue
    }
    if (plain.rgba[i + 3] === 0) continue
    opaque++
    for (let k = 0; k < 3; k++) {
      const want = (1 - s) * plain.rgba[i + k] + s * FOG.colour[k] * 255
      if (fogged.rgba[i + k] !== plain.rgba[i + k]) moved++
      if (Math.abs(fogged.rgba[i + k] - want) > 1) {
        wrong++
        first ||= `byte ${i + k}: plain ${plain.rgba[i + k]}, fog wants ${want.toFixed(1)}, drawn ${fogged.rgba[i + k]}`
      }
    }
  }
  expect(opaque, 'the figure is drawn').toBeGreaterThan(100)
  expect(moved, 'the fog changed the picture').toBeGreaterThan(opaque)
  expect(wrong, `${wrong} bytes are not the display mix of the cell and the fog: first ${first}`).toBe(0)
}

/** `zoom/2`: one figure drawn by `StageView` (a depth-writing quad), at the depth its frame gives it. */
export async function expectStageFogged(renderer: Renderer): Promise<void> {
  const depth = CASES['zoom/2'].frame().sprites[0].depth,
    s = smoothstep(FOG.near, FOG.far, depth),
    plain: CaseReadback = await drawCase('zoom/2', renderer),
    fogged = await drawCase('zoom/2', renderer, false, FOG)
  expect(s, 'the case sits inside the fog, not at either end of it').toBeGreaterThan(0.1)
  expect(s).toBeLessThan(0.9)
  expectMixed(plain, fogged, s)
}

/** One figure drawn as a `FigureSprite` (a quad with no depth of its own) about 20 m from an orthographic camera at 18°. */
export async function expectSpriteFogged(renderer: Renderer): Promise<void> {
  const plain = await drawStanding(0, 2, undefined, renderer),
    fogged = await drawStanding(0, 2, FOG, renderer),
    s = smoothstep(FOG.near, FOG.far, plain.depth)
  expect(s, 'the figure sits inside the fog, not at either end of it').toBeGreaterThan(0.1)
  expect(s).toBeLessThan(0.9)
  expectMixed(plain, fogged, s)
}
