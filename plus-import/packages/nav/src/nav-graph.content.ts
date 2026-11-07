// The `nav-graph` content kind (M6 spec §4.4): every TOML file in `content/nav` is one scene's walking graph.
import { type ContentSchemaDef, defineContentSchema } from '@mcthaydt/automata-content'
import type { z } from 'zod'
import { type NavGraph, navGraphSchema } from './sim/nav-graph.schema'

export const navGraphContent: ContentSchemaDef<'nav-graph', z.ZodType<NavGraph>> = defineContentSchema(
  'nav-graph',
  navGraphSchema,
  { folder: 'nav' },
)
