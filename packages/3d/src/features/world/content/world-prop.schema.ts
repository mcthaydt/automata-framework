// A world prop (the `world-prop` content kind): a preset for a generator, the generator's `kind` and the parameters it
// draws with (sizes in metres, swatch names by role, a seed). A level places it by name (`use`) and may override any
// parameter (`with`). A parameter is whatever its generator reads, so only `kind` is checked here.
import { z } from 'zod'
import { GENERATORS } from '../props/generators.ts'

export type WorldProp = Readonly<Record<string, unknown>> & { readonly kind: string }

export const worldPropSchema: z.ZodType<WorldProp> = z.looseObject({
  kind: z.string().refine((kind) => Object.hasOwn(GENERATORS, kind), {
    error: (issue) =>
      `"${String(issue.input)}" is not a prop kind (${Object.keys(GENERATORS).sort().join(', ')})`,
  }),
})
