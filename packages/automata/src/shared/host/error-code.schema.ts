import { z } from 'zod'

/**
 * Why a host call failed (DIST spec §4.1). The codes are Ruken's (`@ruken/protocol` `ERROR_CODES`), kept where they
 * fit; `ruken/conformance.test.ts` holds them to the vendored SDK.
 */
export const ERROR_CODES = [
  'UNSUPPORTED',
  'NOT_READY',
  'TIMEOUT',
  'RATE_LIMITED',
  'QUOTA_EXCEEDED',
  'INVALID_PAYLOAD',
  'DENIED',
  'OFFLINE',
  'CANCELLED',
  'INTERNAL',
] as const

/** One error code. */
export type ErrorCode = (typeof ERROR_CODES)[number]

/** Checks an error code. */
export const ErrorCodeSchema: z.ZodType<ErrorCode> = z.enum(ERROR_CODES)
