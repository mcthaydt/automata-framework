import { readFileSync } from 'node:fs'

// The four stages FloorFifty ships, as text (see PROVENANCE.md). Tests read them once; the editor never does.

export const SHIPPED_STAGE_IDS = ['dawn', 'rooftops', 'snow-shrine', 'sunken-dome'] as const

export type ShippedStageId = (typeof SHIPPED_STAGE_IDS)[number]

export function shippedStage(id: ShippedStageId): string {
  return readFileSync(new URL(`./stages/${id}.toml`, import.meta.url), 'utf8')
}
