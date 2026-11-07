// How a walk ended: the walker arrived, or there was no way to its target (it stands where it was).
import { defineEvent, type EventDef } from '@mcthaydt/automata-sim'
import { z } from 'zod'

const pointSchema = z.strictObject({ x: z.number(), z: z.number() })

export interface NavArrivedPayload {
  readonly entity: number
  readonly at: { readonly x: number; readonly z: number }
}
const arrivedSchema: z.ZodType<NavArrivedPayload> = z.strictObject({
  entity: z.number().int(),
  at: pointSchema,
})
export const NavArrived: EventDef<z.ZodType<NavArrivedPayload>> = defineEvent('nav.arrived', arrivedSchema)

export interface NavUnreachablePayload {
  readonly entity: number
  readonly to: { readonly x: number; readonly z: number }
}
const unreachableSchema: z.ZodType<NavUnreachablePayload> = z.strictObject({
  entity: z.number().int(),
  to: pointSchema,
})
export const NavUnreachable: EventDef<z.ZodType<NavUnreachablePayload>> = defineEvent(
  'nav.unreachable',
  unreachableSchema,
)
