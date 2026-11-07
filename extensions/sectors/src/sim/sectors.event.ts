// What sectors tells a game about its walkers: a walker entered a sector, and a walker's zone changed (the adventure
// source's `crossed` probe). `from` is null when the walker was outside every sector (or just spawned or loaded).
import { defineEvent, type EventDef } from '@automata/sim'
import { z } from 'zod'

export interface SectorEnteredPayload {
  readonly entity: number
  readonly sector: string
  readonly from: string | null
}
const sectorEnteredSchema: z.ZodType<SectorEnteredPayload> = z.object({
  entity: z.number().int().min(0),
  sector: z.string(),
  from: z.string().nullable(),
})
export const SectorEntered: EventDef<z.ZodType<SectorEnteredPayload>> = defineEvent(
  'sector.entered',
  sectorEnteredSchema,
)

export interface ZoneCrossedPayload {
  readonly entity: number
  readonly zone: string
  readonly from: string | null
}
const zoneCrossedSchema: z.ZodType<ZoneCrossedPayload> = z.object({
  entity: z.number().int().min(0),
  zone: z.string(),
  from: z.string().nullable(),
})
export const ZoneCrossed: EventDef<z.ZodType<ZoneCrossedPayload>> = defineEvent(
  'zone.crossed',
  zoneCrossedSchema,
)
