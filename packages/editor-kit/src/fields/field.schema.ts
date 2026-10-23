import { z } from 'zod'
import { checkEntityDef, checkFieldDef } from './check-field-def'
import type { EntityDef, FieldDef, FieldValue, FieldValues } from './field-types'

// Zod is the one schema language (ADR 0003). The shapes are structural and strict, so a typo in a project file is a
// parse error at load; what a definition means (bounds, options, ids) is `checkFieldDef` and `checkEntityDef`, run
// from `superRefine`, so a file that parses has passed the rules the definitions editor shows, from one source.

const pointSchema = z.strictObject({ x: z.number(), y: z.number() })
const refSchema = z.strictObject({ target: z.string().min(1), container: z.string().optional() })

/** Any well-formed value shape. Whether it fits a definition is `checkValues`, which knows the definition. */
export const fieldValueSchema: z.ZodType<FieldValue> = z.lazy(() =>
  z.union([z.number(), z.boolean(), z.string(), pointSchema, refSchema, z.array(fieldValueSchema)]),
)

export const fieldValuesSchema: z.ZodType<FieldValues> = z.record(z.string(), fieldValueSchema)

export const fieldDefSchema: z.ZodType<FieldDef> = z
  .strictObject({
    id: z.string(),
    type: z.enum(['int', 'float', 'bool', 'text', 'enum', 'color', 'angle', 'ref', 'point']),
    label: z.string().optional(),
    list: z.boolean().optional(),
    required: z.boolean().optional(),
    default: fieldValueSchema.optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().optional(),
    options: z.array(z.string()).optional(),
    multiline: z.boolean().optional(),
    to: z.array(z.string()).optional(),
  })
  .superRefine((def, ctx) => {
    for (const problem of checkFieldDef(def as FieldDef)) {
      ctx.addIssue({ code: 'custom', message: problem.message })
    }
  })

export const entityDefSchema: z.ZodType<EntityDef> = z
  .strictObject({
    id: z.string(),
    label: z.string().optional(),
    color: z.string().optional(),
    single: z.boolean().optional(),
    fields: z.array(fieldDefSchema),
  })
  .superRefine((def, ctx) => {
    // A field's own problems were reported by `fieldDefSchema` at the field's path; add only the entity-level ones.
    for (const problem of checkEntityDef(def as EntityDef)) {
      if (problem.fieldIndex !== undefined && problem.code !== 'duplicateFieldId') continue
      const path = problem.fieldIndex === undefined ? [] : ['fields', problem.fieldIndex]
      ctx.addIssue({ code: 'custom', message: problem.message, path })
    }
  })
