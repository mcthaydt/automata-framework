import { defineResource, type ResourceDef } from '@mcthaydt/automata-sim'
import { z } from 'zod'

const counterSchema = z.object({ count: z.number().int() })

export const Counter: ResourceDef<typeof counterSchema> = defineResource('counter', counterSchema, () => ({
  count: 0,
}))
