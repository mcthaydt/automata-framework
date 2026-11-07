// The smallest content project: one kind of item, read from content/items.
import type { ContentConfig } from '@automata/content'
import { defineContentSchema } from '@automata/content'
import { z } from 'zod'

const ITEM = defineContentSchema('item', z.strictObject({ name: z.string(), weight: z.number() }), {
  folder: 'items',
})

const config: ContentConfig = { schemas: [ITEM] }
export default config
