// The smallest content project: one kind of item, read from content/items (M2.4 spec §3.6).
import type { ContentConfig } from '@mcthaydt/automata-content'
import { defineContentSchema } from '@mcthaydt/automata-content'
import { z } from 'zod'

const ITEM = defineContentSchema('item', z.strictObject({ name: z.string(), weight: z.number() }), {
  folder: 'items',
})

const config: ContentConfig = { schemas: [ITEM] }
export default config
