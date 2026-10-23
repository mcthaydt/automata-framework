// The part of a level profile ED3D.1 delivers (spec §4.1): read a file into a schema-checked model, and write a model
// change back into the file's text byte for byte. A profile extends this with geometry, entities, checks and
// materials as their tasks land.
import type { z } from 'zod'
import { type JsonPath, JsonScanError, scan } from '../codec/locate'
import { type PatchResult, type PatchRules, patchJson } from '../codec/patch'

export interface ParseIssue {
  readonly path: JsonPath
  readonly message: string
}

export type ParseResult<D> =
  /** `warnings` is there only when a file opens with something to say (a newer minor version): it is never an empty list. */
  | { readonly ok: true; readonly value: D; readonly warnings?: readonly ParseIssue[] }
  | { readonly ok: false; readonly issues: readonly ParseIssue[] }

export interface FileCodec<D> {
  /** 'last-light-blockout', 'last-light-facility' */
  readonly id: string
  readonly schema: z.ZodType<D>
  /** Invalid JSON is one issue at path `[]`; a schema error carries the JSON path of the member. */
  parse(text: string): ParseResult<D>
  /** `before` is what `text` parses to. See `patchJson` for the refusals. */
  patch(text: string, before: D, after: D): PatchResult
}

export function createFileCodec<D>(spec: {
  readonly id: string
  readonly schema: z.ZodType<D>
  readonly rules: PatchRules
  /** What to say about a file that opens: the issues a schema cannot, as a file of a newer minor version. */
  readonly warn?: (value: D) => readonly ParseIssue[]
}): FileCodec<D> {
  return {
    id: spec.id,
    schema: spec.schema,
    parse(text) {
      try {
        scan(text)
      } catch (error) {
        if (error instanceof JsonScanError)
          return { ok: false, issues: [{ path: [], message: error.message }] }
        throw error
      }
      const result = spec.schema.safeParse(JSON.parse(text))
      if (result.success) {
        const warnings = spec.warn?.(result.data) ?? []
        return warnings.length === 0
          ? { ok: true, value: result.data }
          : { ok: true, value: result.data, warnings }
      }
      return {
        ok: false,
        issues: result.error.issues.map((issue) => ({
          path: issue.path.map((key) => (typeof key === 'number' ? key : String(key))),
          message: issue.message,
        })),
      }
    },
    patch: (text, before, after) => patchJson(text, before, after, spec.rules),
  }
}
