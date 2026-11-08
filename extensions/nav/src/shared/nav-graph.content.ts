// The `nav-graph` content kind: every TOML file in `content/nav` is one scene's walking graph.
import { type ContentSchemaDef, defineContentSchema } from '@automata/content/schema'
import type { z } from 'zod'
import { type NavGraph, navGraphSchema } from './sim/nav-graph.schema'

export const navGraphContent: ContentSchemaDef<'nav-graph', z.ZodType<NavGraph>> = defineContentSchema(
  'nav-graph',
  navGraphSchema,
  { folder: 'nav' },
)
