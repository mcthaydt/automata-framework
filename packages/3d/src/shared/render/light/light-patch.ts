// A patch of light on the floor: where a window's light lands, as pale stripes between the bars' shadows, brightest a little way
// from the window and fading as it goes. The room's baked light is per vertex and cannot say a pattern a few centimetres across, so
// the patch is a picture lying on the floor and added to it (`light-patch-view.ts` draws it); this is its geometry and its texels.

/** One patch of window light. */
export interface LightPatch {
  readonly id: string
  /** The window the light comes through, on the plan `[x, z]`: the patch is bright at the end nearest it. */
  readonly window: readonly [number, number]
  /** The middle of the patch on the plan; the patch runs along the line from the window through it. */
  readonly centre: readonly [number, number]
  /** Metres across the stripes, and along the light. */
  readonly width: number
  readonly length: number
  /** How many bars of light there are across (the window's bars, 4 unless it says). */
  readonly bars?: number | undefined
  /** How strongly it shows, 0 to 1 (0.5 unless it says). */
  readonly gain?: number | undefined
  /** The rooms it shows in, by sector id: it is drawn while one of them is, and always if it names none. */
  readonly rooms?: readonly string[] | undefined
  /** The light's colour, `#rrggbb` (a pale moonlight blue unless it says). */
  readonly colour?: string | undefined
}

/** Metres a texel covers: a whole-texel picture the look's snap can keep as pixels. */
export const TEXEL = 0.045
/** Where on the floor a patch lies, in metres above it: enough that the floor's own depth does not fight it. */
export const LIFT = 0.017

const MOON = '#96b2e1'

/** A point on the floor as `[x, y, z]`. */
type Corner = [number, number, number]

/** The four corners of the patch as `[x, y, z]`: the window end's two first (u = 0, then 1), then the far end's (u = 1, then 0). */
export function lightPatchCorners(patch: LightPatch): [Corner, Corner, Corner, Corner] {
  const [wx, wz] = patch.window
  const [cx, cz] = patch.centre
  const run = Math.hypot(cx - wx, cz - wz) || 1
  // Along the light, away from the window; across it, a quarter turn to the right.
  const along: [number, number] = [(cx - wx) / run, (cz - wz) / run]
  const across: [number, number] = [-along[1], along[0]]
  const half = patch.length / 2
  const side = patch.width / 2
  const corner = (u: number, v: number): Corner => [
    cx + along[0] * (v - half) + across[0] * (u - side),
    LIFT,
    cz + along[1] * (v - half) + across[1] * (u - side),
  ]
  return [corner(0, 0), corner(patch.width, 0), corner(patch.width, patch.length), corner(0, patch.length)]
}

/** The patch's texels as straight-alpha RGBA, row 0 at the window end: one texel is about 4.5 cm. */
export function lightPatchPixels(patch: LightPatch): { width: number; height: number; rgba: Uint8Array } {
  const width = Math.max(4, Math.round(patch.width / TEXEL))
  const height = Math.max(4, Math.round(patch.length / TEXEL))
  const bars = Math.max(1, patch.bars ?? 4)
  const gain = patch.gain ?? 0.5
  const colour = Number.parseInt((patch.colour ?? MOON).slice(1), 16)
  const rgb = [(colour >> 16) & 255, (colour >> 8) & 255, colour & 255]
  // The bars across a margin of two texels each side: a whole number of equal periods, the last texels of each being the shadow of a bar.
  const margin = 2
  const period = (width - margin * 2) / bars
  const dark = Math.max(1, Math.round((period * 2) / 7))
  const rgba = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    // Fading in over the first ten texels, then out along the length.
    const fade = Math.min(1, y / 10) * (1 - y / height) ** 0.8
    for (let x = margin; x < width - margin; x++) {
      const at = x - margin
      if (at % period >= period - dark) continue
      const edge = Math.min(1, (x - margin + 1) / 3, (width - margin - x) / 3)
      const alpha = Math.min(1, gain * fade * edge)
      const i = (y * width + x) * 4
      rgba[i] = rgb[0] as number
      rgba[i + 1] = rgb[1] as number
      rgba[i + 2] = rgb[2] as number
      rgba[i + 3] = Math.round(alpha * 255)
    }
  }
  return { width, height, rgba }
}

/** Whether a patch is drawn while `drawn` rooms are (`undefined` is every room). */
export function patchShown(patch: LightPatch, drawn: ReadonlySet<string> | undefined): boolean {
  if (drawn === undefined || patch.rooms === undefined || patch.rooms.length === 0) return true
  return patch.rooms.some((room) => drawn.has(room))
}
