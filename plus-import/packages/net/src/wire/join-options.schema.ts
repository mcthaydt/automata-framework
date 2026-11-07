import { z } from 'zod'
import { SESSION_MAX_LENGTH } from './limits'
import { hex16Schema, nameSchema, uintSchema } from './primitives.schema'

/**
 * What a client presents when it joins (M7 spec §4.2). The schema and content hashes are the join check: two builds
 * with different content never share a room. Strict: an unrecognised field is a rejection.
 */
/** What a client presents when it joins; `name` is trimmed by the schema. */
export interface JoinOptions {
  readonly protocol: number
  readonly schemaHash: string
  readonly contentHash: string
  readonly name: string
  readonly session?: string | undefined
}

export const joinOptionsSchema: z.ZodType<JoinOptions> = z
  .object({
    protocol: uintSchema,
    schemaHash: hex16Schema,
    contentHash: hex16Schema,
    name: nameSchema,
    session: z
      .string()
      .min(1)
      .max(SESSION_MAX_LENGTH)
      .regex(/^[\x21-\x7e]+$/, 'a session token is printable ASCII')
      .optional(),
  })
  .strict()
