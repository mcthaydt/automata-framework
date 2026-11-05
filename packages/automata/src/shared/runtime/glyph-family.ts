// Which labels a pad's buttons carry, sniffed from its `id`, from FloorFifty
// `apps/client/src/ui/glyphs.ts` at `ac72660`. The labels themselves are prompts.

/** Which labels a pad's buttons carry, read from its id. */
export type GlyphFamily = 'xbox' | 'playstation' | 'generic'

export function glyphFamily(id: string): GlyphFamily {
  const lower = id.toLowerCase()
  if (/xinput|045e|xbox/.test(lower)) return 'xbox'
  if (/054c|dualsense|dualshock|playstation/.test(lower)) return 'playstation'
  return 'generic'
}
