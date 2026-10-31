import { z } from 'zod'

/** Where the player's saves stand with the host. */
export type SavesStatus =
  | 'checking'
  | 'syncing'
  | 'saved'
  | 'offline-queued'
  | 'retry'
  | 'conflict'
  | 'recovered'

/** Checks a saves status. */
export const SavesStatusSchema: z.ZodType<SavesStatus> = z.enum([
  'checking',
  'syncing',
  'saved',
  'offline-queued',
  'retry',
  'conflict',
  'recovered',
])

/**
 * Where a flush left the saves: the host's outbox, its server, or the device's own storage (`'device'`, the `web`,
 * `itch` and `tauri` targets; DIST-D3).
 */
export interface SavesFlushRes {
  persisted: 'host-outbox' | 'server' | 'device'
}

/** Checks a flush answer. */
export const SavesFlushResSchema: z.ZodType<SavesFlushRes> = z.object({
  persisted: z.enum(['host-outbox', 'server', 'device']),
})

/** Another device's write, or the host's conflict choice, reached this session. `null` is a removed key. */
export interface SavesChangedPayload {
  key: string
  value: string | null
  revision: number
}

/** Checks a saves change. */
export const SavesChangedPayloadSchema: z.ZodType<SavesChangedPayload> = z.object({
  key: z.string(),
  value: z.string().nullable(),
  revision: z.number(),
})
