// Which labels a pad's buttons carry, sniffed from its `id` (M4 spec §4.2), from FloorFifty
// `apps/client/src/ui/glyphs.ts` at `ac72660`. The labels themselves are prompts (M4.4).

export type GlyphFamily = 'xbox' | 'playstation' | 'generic'

export function glyphFamily(id: string): GlyphFamily {
  const lower = id.toLowerCase()
  if (/xinput|045e|xbox/.test(lower)) return 'xbox'
  if (/054c|dualsense|dualshock|playstation/.test(lower)) return 'playstation'
  return 'generic'
}
