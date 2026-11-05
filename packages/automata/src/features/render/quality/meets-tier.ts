import type { QualityTier } from '../../settings/display-settings.schema.ts'

const RANK: Readonly<Record<QualityTier, number>> = { low: 0, medium: 1, high: 2 }

/** Whether `tier` is `min` or higher: a pass registered for `medium` runs at `medium` and `high`. */
export function meetsTier(tier: QualityTier, min: QualityTier): boolean {
  return RANK[tier] >= RANK[min]
}
