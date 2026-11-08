// The plan's colours (ED3D spec §6: the `Editor 3D` variables `ent/*` and `view/*`). The values are the mockups' own,
// from `docs/design/editor-3d/views.mjs`, which Figma binds to the "Editor 3D" collection; the accent is the kit's
// `--color-accent-default`. A renderer takes numbers, so they are written as numbers here, in one place.

export const PLAN_COLORS = {
  background: 0x0c0d10,
  /** A sector of no zone or style. */
  fill: 0x1f232b,
  wall: 0xb4bac6,
  portal: 0x5aa9e6,
  door: 0xd98c5f,
  window: 0x7fd1e8,
  box: 0x8f9bb3,
  accent: 0xe0a54a,
  grid: 0xffffff,
  ruler: 0x8b909a,
  /** The snap ring and the room Merge would take in (the mockup's `Draw sector` loupe ring). */
  snap: 0x4fd1c5,
  /** A target a tap would be refused at. */
  refused: 0xe5534b,
} as const

/** Fills for the zones and styles, muted so the walls and things stay readable over them. */
export const GROUP_FILLS: readonly number[] = [
  0x262b36, 0x252c38, 0x4a4032, 0x2d2a3a, 0x24332e, 0x3a2c2c, 0x2b3440, 0x34322a,
]

/** `#rgb` or `#rrggbb` as a number; anything else is `undefined`. */
export function parseHex(text: string): number | undefined {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text.trim())
  if (match === null) return undefined
  const digits = match[1] ?? ''
  const full = digits.length === 3 ? [...digits].map((digit) => digit + digit).join('') : digits
  return Number.parseInt(full, 16)
}
