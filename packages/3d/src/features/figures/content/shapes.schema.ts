// Small shapes the figure and library schemas share: vectors and number pairs as TOML arrays.

import { z } from 'zod'

export type Vec2 = [number, number]
export type Vec3 = [number, number, number]
/** A profile line: [angle round the skull, height] points, one for a level line. */
export type Line = Vec2[]

export const vec2: z.ZodType<Vec2> = z.tuple([z.number(), z.number()])
export const vec3: z.ZodType<Vec3> = z.tuple([z.number(), z.number(), z.number()])
export const line: z.ZodType<Line> = z.array(vec2).min(1)
export const side: z.ZodType<'L' | 'R'> = z.enum(['L', 'R'])
/** Free text that says what a library item is for. */
export const about: z.ZodOptional<z.ZodString> = z.string().min(1).optional()

/** Every key of T optional, the way zod types an optional field: `key?: T[key] | undefined`. */
export type Optional<T> = { [K in keyof T]?: T[K] | undefined }

/**
 * A schema of optional fields typed as `Partial<T>`. zod types an optional field as `key?: V | undefined`,
 * which `exactOptionalPropertyTypes` does not accept as `key?: V`; but a parsed object never holds `undefined`
 * (zod leaves an absent key absent, and TOML has no undefined), so the two types describe the same values.
 */
export const partialOf = <T>(schema: z.ZodType<Optional<T>>): z.ZodType<Partial<T>> =>
  schema as unknown as z.ZodType<Partial<T>>
