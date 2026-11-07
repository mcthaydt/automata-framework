/**
 * One server log line: a JSON object per line on stdout, which journald keeps for 14 days.
 *
 * The schema is the redaction. It is strict, and no field can hold an address, a player name, a room code, a token
 * or a payload: the free strings of a log event are narrowed here, so `room` is the room's serial in this process (digits, never
 * its code) and `code` is an identifier (a refusal's limit, an error's class, a drain's result), which no address,
 * bearer header or sentence matches. Every line is parsed by it before it is written (`log-writer.ts`).
 */

import { z } from 'zod'

export type LogLevel = 'info' | 'warn' | 'fatal'

export interface ServerLogLine {
  readonly ts: number
  readonly level: LogLevel
  readonly event: string
  readonly room?: string | undefined
  readonly seat?: number | undefined
  readonly code?: string | undefined
  readonly ms?: number | undefined
  readonly count?: number | undefined
}

export const serverLogLine: z.ZodType<ServerLogLine> = z
  .object({
    ts: z.number().int(),
    level: z.enum(['info', 'warn', 'fatal']),
    event: z.string().regex(/^[a-z][a-z0-9_.]{1,47}$/),
    room: z
      .string()
      .regex(/^[0-9]{1,12}$/)
      .optional(),
    seat: z.number().int().optional(),
    code: z
      .string()
      .regex(/^[A-Za-z][A-Za-z0-9_.-]{0,47}$/)
      .optional(),
    ms: z.number().optional(),
    count: z.number().int().optional(),
  })
  .strict()
