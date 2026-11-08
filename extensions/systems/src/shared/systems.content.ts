// The `systems` content kind: every TOML file in `content/systems` is one scene's systems. The game says
// which hooks it gives `createSystems`, so a hook a def names but the game lacks fails when content compiles.
import { type ContentSchemaDef, defineContentSchema } from '@automata/content/schema'
import type { z } from 'zod'
import { type SystemsDef, systemsDefShape } from './sim/systems.schema'
import { checkSystems, type SystemsCheckOptions } from './sim/systems-checks'

export const systemsSchema = (options: SystemsCheckOptions): z.ZodType<SystemsDef> =>
  systemsDefShape.superRefine((def, context) =>
    checkSystems(def, options, (path, message) =>
      context.addIssue({ code: 'custom', path: [...path], message }),
    ),
  )

export const systemsContent = (
  options: SystemsCheckOptions,
): ContentSchemaDef<'systems', z.ZodType<SystemsDef>> =>
  defineContentSchema('systems', systemsSchema(options), { folder: 'systems' })
