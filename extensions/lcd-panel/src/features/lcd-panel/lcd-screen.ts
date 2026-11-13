// The panel's mesh, stripes and scanlines at the screen's own pixels: a framework screen filter (`postFilter(..., { at:
// 'screen' })`) runs on the field after it is upscaled, so a mesh cell can be a whole number of device pixels and its line can
// sit on a cell's last pixel instead of being integrated across a field pixel. At a whole scale of 2 and a figure texel of two
// field pixels, a 4-pixel cell is one texel, and every line falls between texels (a figure placed with the character kit's
// `grid: true`). The field pass (lcd-shader.ts) then keeps the rest of the panel: the colour split, halation, gamma, vignette.
//
// The maths here is the shader's, on the CPU, so Node tests where every line falls; the two shaders bake its numbers.

import { z } from 'zod'
import type { LcdProfile } from './lcd-profile.schema.ts'

const COS_TAU_6 = 0.5
const SIN_TAU_6 = Math.sqrt(3) / 2

/** What the screen pass is told beside the profile. */
export const lcdScreenOptionsSchema = z.strictObject({
  /** Device pixels a side of one mesh cell, two or more; the line is its last pixel. 4 is one texel of two field pixels at 2x. */
  cellPixels: z
    .number()
    .int('cellPixels is a whole number of device pixels')
    .min(2, 'cellPixels is at least 2')
    .default(4),
})

export type LcdScreenOptions = z.input<typeof lcdScreenOptionsSchema>

/** The numbers the screen pass bakes in. */
export interface LcdScreenValues {
  readonly cellPixels: number
  /** How much a column line takes, 0 to 1 (1 is black). */
  readonly lineColumns: number
  /** How much a row line (mesh rows and scanlines) takes, 0 to 1. */
  readonly lineRows: number
  readonly subpixels: number
  /** 1 for a BGR panel. */
  readonly layout: number
  /** The gain that gives back what the lines take (the profile's `brightness`, under the same square root). */
  readonly brightness: number
}

/** The names the two shaders define, from `LcdScreenValues`; both must define every one (a test checks it). */
export const LCD_SCREEN_CONSTANTS = [
  'CELL',
  'LINE_COLUMNS',
  'LINE_ROWS',
  'SUBPIXELS',
  'BGR',
  'BRIGHTNESS',
] as const

/**
 * The screen pass's numbers for a profile. Each axis's line is as dark as the field mesh of the same strength at its darkest: its
 * sinusoid runs from `1 + amp` to `1 - amp` (`amp` as lcd-shader.ts works it out at one cell a period), so its trough keeps
 * `(1 - amp) / (1 + amp)` of its peak and the line takes `2 · amp / (1 + amp)`. A line is one pixel of a cell, so it takes less light
 * on average than the sinusoid did: `brightness`, the gain that gives it back, is measured again for the screen mesh.
 */
export function lcdScreenValues(profile: LcdProfile, options: LcdScreenOptions = {}): LcdScreenValues {
  const { cellPixels } = lcdScreenOptionsSchema.parse(options)
  const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))
  const line = (amp: number): number => (2 * amp) / (1 + amp)
  return {
    cellPixels,
    lineColumns: line(clamp01(profile.grid * 2 * (1 - profile.balance))),
    lineRows: line(clamp01(profile.grid * 2 * profile.balance + profile.scanlines)),
    subpixels: profile.subpixels,
    layout: profile.layout === 'bgr' ? 1 : 0,
    brightness: profile.brightness,
  }
}

/**
 * The light the panel leaves on device pixel (`x`, `y`) counted from the field's origin: the stripe's tint per channel, and the
 * lines' share. The shader multiplies the colour by `sqrt(tint · lines · brightness)` (a gamma of 2, as the field pass).
 */
export function screenLight(
  values: LcdScreenValues,
  x: number,
  y: number,
): [tint: [number, number, number], lines: number] {
  const cell = values.cellPixels
  const lx = ((Math.floor(x) % cell) + cell) % cell
  const ly = ((Math.floor(y) % cell) + cell) % cell
  const lines = (lx === cell - 1 ? 1 - values.lineColumns : 1) * (ly === cell - 1 ? 1 - values.lineRows : 1)
  if (values.subpixels <= 0 || lx === cell - 1) return [[1, 1, 1], lines]
  // The columns inside the line, red to blue: the field pass's stripe, one period across them.
  const X = (2 * Math.PI * (lx + 0.5)) / (cell - 1)
  const r = 1 + values.subpixels * (COS_TAU_6 * Math.cos(X) + SIN_TAU_6 * Math.sin(X))
  const g = 1 - values.subpixels * Math.cos(X)
  const tint: [number, number, number] = [r, g, 3 - r - g]
  return [values.layout >= 0.5 ? [tint[2], tint[1], tint[0]] : tint, lines]
}

const f = (n: number): string => (Number.isInteger(n) ? n.toFixed(1) : String(n))

/** The screen pass in GLSL ES 3.00, a whole fragment shader; `uScreenOrigin` is the framework's (declared for it). */
export function lcdScreenGlsl(values: LcdScreenValues): string {
  return `in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform vec4 uInputPixel;
const float CELL = ${f(values.cellPixels)};
const float LINE_COLUMNS = ${f(values.lineColumns)};
const float LINE_ROWS = ${f(values.lineRows)};
const float SUBPIXELS = ${f(values.subpixels)};
const float BGR = ${f(values.layout)};
const float BRIGHTNESS = ${f(values.brightness)};
void main() {
  vec4 c = texture(uTexture, vTextureCoord);
  vec2 d = floor(vTextureCoord * uInputPixel.xy - uScreenOrigin);
  vec2 l = d - CELL * floor(d / CELL);
  float lines = (l.x == CELL - 1.0 ? 1.0 - LINE_COLUMNS : 1.0) * (l.y == CELL - 1.0 ? 1.0 - LINE_ROWS : 1.0);
  vec3 tint = vec3(1.0);
  if (SUBPIXELS > 0.0 && l.x < CELL - 1.0) {
    float X = 6.283185307 * (l.x + 0.5) / (CELL - 1.0);
    float r = 1.0 + SUBPIXELS * (0.5 * cos(X) + 0.866025404 * sin(X));
    float g = 1.0 - SUBPIXELS * cos(X);
    tint = vec3(r, g, 3.0 - r - g);
    if (BGR > 0.5) tint = tint.bgr;
  }
  vec3 m = sqrt(max(tint * (lines * BRIGHTNESS), 0.0));
  finalColor = vec4(clamp(c.rgb * m, 0.0, c.a), c.a);
}`
}

/** The screen pass in WGSL, the same maths; `screen` and `gfu` are the framework's. */
export function lcdScreenWgsl(values: LcdScreenValues): string {
  return `const CELL: f32 = ${f(values.cellPixels)};
const LINE_COLUMNS: f32 = ${f(values.lineColumns)};
const LINE_ROWS: f32 = ${f(values.lineRows)};
const SUBPIXELS: f32 = ${f(values.subpixels)};
const BGR: f32 = ${f(values.layout)};
const BRIGHTNESS: f32 = ${f(values.brightness)};
@fragment fn mainFragment(input: VSOutput) -> @location(0) vec4<f32> {
  let c = textureSample(uTexture, uSampler, input.uv);
  let d = floor(input.uv * gfu.uInputPixel.xy - screen.uScreenOrigin);
  let l = d - CELL * floor(d / CELL);
  var lines = 1.0;
  if (l.x == CELL - 1.0) { lines = lines * (1.0 - LINE_COLUMNS); }
  if (l.y == CELL - 1.0) { lines = lines * (1.0 - LINE_ROWS); }
  var tint = vec3<f32>(1.0);
  if (SUBPIXELS > 0.0 && l.x < CELL - 1.0) {
    let X = 6.283185307 * (l.x + 0.5) / (CELL - 1.0);
    let r = 1.0 + SUBPIXELS * (0.5 * cos(X) + 0.866025404 * sin(X));
    let g = 1.0 - SUBPIXELS * cos(X);
    tint = vec3<f32>(r, g, 3.0 - r - g);
    if (BGR > 0.5) { tint = tint.bgr; }
  }
  let m = sqrt(max(tint * (lines * BRIGHTNESS), vec3<f32>(0.0)));
  return vec4<f32>(clamp(c.rgb * m, vec3<f32>(0.0), vec3<f32>(c.a)), c.a);
}`
}
