// A world prop (the `world-prop` content kind): a preset for a generator, the generator's `kind` and the parameters it
// draws with (sizes in metres, swatch names by role, a seed). A level places it by name (`use`) and may override any
// parameter (`with`). A parameter is whatever its generator reads, so only `kind` is checked here: a kind an extension
// registers may arrive after the content is read, so the builder reports a kind with no generator, not the schema.
import { z } from 'zod'

export type WorldProp = Readonly<Record<string, unknown>> & { readonly kind: string }

export const worldPropSchema: z.ZodType<WorldProp> = z.looseObject({ kind: z.string().min(1) })
