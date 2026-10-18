// The Display section's words (M4 spec §4.8, §7). The tiers are runtime's `QUALITY_TIERS`, best first.

export type DisplayQuality = 'high' | 'medium' | 'low'
export const DISPLAY_QUALITIES: readonly DisplayQuality[] = ['high', 'medium', 'low']

export interface DisplayCopy {
  readonly title: string
  /** The quality choice's name. */
  readonly quality: string
  readonly qualities: Readonly<Record<DisplayQuality, string>>
  /** Reduced motion as the browser reports it: "Reduced motion: on (from your device)". */
  reducedMotion(reduced: boolean): string
}
