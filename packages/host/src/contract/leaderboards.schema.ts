import { z } from 'zod'

/** Extra facts sent with a score, passed to the host as they are. */
export type LeaderboardSubmitMeta = Record<string, string | number>

/** Checks a score's extra facts. */
export const LeaderboardSubmitMetaSchema: z.ZodType<LeaderboardSubmitMeta> = z.record(
  z.string(),
  z.union([z.string(), z.number()]),
)

/** Which entries to read from a board. */
export interface LeaderboardQuery {
  scope?: 'top' | 'around-me'
  limit?: number
}

/** Checks a board query. */
export const LeaderboardQuerySchema: z.ZodType<LeaderboardQuery> = z.object({
  scope: z.enum(['top', 'around-me']).exactOptional(),
  limit: z.number().exactOptional(),
})

/** The host's answer to a submitted score. */
export interface LeaderboardSubmitRes {
  accepted: boolean
  personalBest: number
  rank?: number | undefined
}

/** Checks a submit answer. */
export const LeaderboardSubmitResSchema: z.ZodType<LeaderboardSubmitRes> = z.object({
  accepted: z.boolean(),
  personalBest: z.number(),
  rank: z.number().optional(),
})

/** One row of a board. */
export interface LeaderboardEntry {
  rank: number
  displayName: string
  score: number
  isMe: boolean
}

/** The rows of a board. */
export interface LeaderboardGetRes {
  entries: LeaderboardEntry[]
}

/** Checks a board's rows. */
export const LeaderboardGetResSchema: z.ZodType<LeaderboardGetRes> = z.object({
  entries: z.array(
    z.object({ rank: z.number(), displayName: z.string(), score: z.number(), isMe: z.boolean() }),
  ),
})
