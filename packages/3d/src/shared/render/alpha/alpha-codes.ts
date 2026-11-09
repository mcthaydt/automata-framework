// What the post chain must know about each pixel, carried in the alpha channel. The scene target is 8-bit, so the codes
// are whole bytes; a pixel is the code its alpha is nearest, within half a byte, and any other non-zero alpha is
// world (a wall the occluders fade leaves `a + dst * (1 - a)`, which is no code).
//
// Two rules keep a code honest. `@pixi/3d`'s material template writes `vec4(colour * alpha, alpha)`, so a material
// that writes a code divides its colour by the code in its last bit. And the last post pass is blended onto the 2D
// stage as premultiplied colour, so the finish writes colour 0 where it writes alpha 0.

/** The alpha a pixel carries, as 0 to 1 channel values (`n / 255`). */
export const ALPHA: {
  readonly none: 0
  readonly sky: number
  readonly painted: number
  readonly glowing: number
  readonly world: 1
} = {
  none: 0,
  sky: 160 / 255,
  painted: 192 / 255,
  glowing: 224 / 255,
  world: 1,
}

export type AlphaCode = keyof typeof ALPHA

/** Half a byte, in alpha units: a code is read within it. */
const HALF_BYTE = 0.5

/** What an alpha byte (0 to 255) means to the post chain. */
export function codeOfAlpha(byte: number): AlphaCode {
  if (byte === 0) return 'none'
  for (const code of ['sky', 'painted', 'glowing', 'world'] as const) {
    if (Math.abs(byte - ALPHA[code] * 255) <= HALF_BYTE) return code
  }
  return 'world'
}

/** The metres a cell's depth channel spans either side of its root. */
export const DEPTH_SPAN = 4

/**
 * A depth in metres toward the camera from the root, as 16-bit fixed point over −4 m to +4 m. WebGPU binds `r32float`
 * only as `unfilterable-float`, so a cell's depth travels as two 8-bit channels.
 */
export function packDepth(metres: number): number {
  const unit = (metres + DEPTH_SPAN) / (2 * DEPTH_SPAN)
  return Math.round(Math.min(1, Math.max(0, unit)) * 65535)
}

/** The metres a packed depth stands for. */
export function unpackDepth(packed: number): number {
  return (packed / 65535) * (2 * DEPTH_SPAN) - DEPTH_SPAN
}

/** A packed depth as the two bytes of a texel's `r` (high) and `g` (low). */
export function packedDepthBytes(packed: number): readonly [number, number] {
  return [packed >> 8, packed & 0xff]
}

const IS = ['painted:192.0', 'glowing:224.0', 'sky:160.0'] as const

/** The GLSL constants and tests for the codes, to be pasted into a fragment header. */
export function alphaCodeGlsl(): string {
  const tests = IS.map((entry) => {
    const [name, byte] = entry.split(':') as [string, string]
    return `bool is${name[0]?.toUpperCase()}${name.slice(1)}(float a) { return abs(a * 255.0 - ${byte}) < 0.5; }`
  })
  return `
const float ALPHA_SKY = 160.0 / 255.0;
const float ALPHA_PAINTED = 192.0 / 255.0;
const float ALPHA_GLOWING = 224.0 / 255.0;
${tests.join('\n')}
bool isWorld(float a) { return a > 0.0 && !isPainted(a) && !isGlowing(a) && !isSky(a); }
bool isDrawn(float a) { return a * 255.0 > 0.5; }
float unpackCellDepth(vec2 rg) {
  float q = floor(rg.x * 255.0 + 0.5) * 256.0 + floor(rg.y * 255.0 + 0.5);
  return q / 65535.0 * ${(2 * DEPTH_SPAN).toFixed(1)} - ${DEPTH_SPAN.toFixed(1)};
}
`
}

/** The WGSL twin of {@link alphaCodeGlsl}. */
export function alphaCodeWgsl(): string {
  const tests = IS.map((entry) => {
    const [name, byte] = entry.split(':') as [string, string]
    return `fn is${name[0]?.toUpperCase()}${name.slice(1)}(a: f32) -> bool { return abs(a * 255.0 - ${byte}) < 0.5; }`
  })
  return `
const ALPHA_SKY: f32 = 160.0 / 255.0;
const ALPHA_PAINTED: f32 = 192.0 / 255.0;
const ALPHA_GLOWING: f32 = 224.0 / 255.0;
${tests.join('\n')}
fn isWorld(a: f32) -> bool { return a > 0.0 && !isPainted(a) && !isGlowing(a) && !isSky(a); }
fn isDrawn(a: f32) -> bool { return a * 255.0 > 0.5; }
fn unpackCellDepth(rg: vec2<f32>) -> f32 {
  let q = floor(rg.x * 255.0 + 0.5) * 256.0 + floor(rg.y * 255.0 + 0.5);
  return q / 65535.0 * ${(2 * DEPTH_SPAN).toFixed(1)} - ${DEPTH_SPAN.toFixed(1)};
}
`
}
