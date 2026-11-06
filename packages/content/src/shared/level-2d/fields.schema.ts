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

/** The schema of the values an instance holds, by field id. */
export const fieldValuesSchema: z.ZodType<FieldValues> = z.record(z.string(), fieldValueSchema)

/** The schema of a field definition: strict shape, then the rules `checkFieldDef` applies. */
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

/**
 * The keys of an entity definition, for an editor to extend (`z.strictObject({ ...entityDefShape, shape: … })`) so
 * its own entity schema never copies the kit's keys (`EntityDef2D = EntityDef & { shape, size, … }`).
 */
export const entityDefShape: {
  id: z.ZodString
  label: z.ZodOptional<z.ZodString>
  color: z.ZodOptional<z.ZodString>
  single: z.ZodOptional<z.ZodBoolean>
  fields: z.ZodArray<z.ZodType<FieldDef>>
} = {
  id: z.string(),
  label: z.string().optional(),
  color: z.string().optional(),
  single: z.boolean().optional(),
  fields: z.array(fieldDefSchema),
}

/** One problem found in a parsed entity definition, with the path of the field at fault. */
export interface EntityDefIssue {
  readonly message: string
  /** Mutable, so it can be handed to `ctx.addIssue` as it is. */
  readonly path: (string | number)[]
}

/**
 * The entity-level problems of a definition, for `superRefine`: its id and color, and a repeated field id at the later
 * field's path. A field's own problems are reported by `fieldDefSchema` at the field's path, so they are not repeated.
 */
export function entityDefIssues(def: EntityDef): readonly EntityDefIssue[] {
  const issues: EntityDefIssue[] = []
  for (const problem of checkEntityDef(def)) {
    if (problem.fieldIndex !== undefined && problem.code !== 'duplicateFieldId') continue
    issues.push({
      message: problem.message,
      path: problem.fieldIndex === undefined ? [] : ['fields', problem.fieldIndex],
    })
  }
  return issues
}

/** The schema of an entity definition: strict shape, then the rules `checkEntityDef` applies. */
export const entityDefSchema: z.ZodType<EntityDef> = z
  .strictObject(entityDefShape)
  .superRefine((def, ctx) => {
    for (const issue of entityDefIssues(def)) ctx.addIssue({ code: 'custom', ...issue })
  })
