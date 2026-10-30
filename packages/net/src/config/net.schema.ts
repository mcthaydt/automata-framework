import { z } from 'zod'

/** A WebSocket origin: `wss://` (or `ws://` for a local server), a host and an optional port, nothing after. */
const SOCKET_ORIGIN = /^wss?:\/\/[A-Za-z0-9.-]+(?::\d{1,5})?$/

const ticks = (fallback: number, max: number) => z.number().int().min(1).max(max).default(fallback)

/**
 * `content/net.toml` (M7 spec §4.2, `NetConfig`). The url must also be in `ruken.toml`'s `[network].connect`, which
 * ship prepare checks (M7.7a).
 */
/** `content/net.toml` after parsing: every field present. */
export interface NetConfig {
  readonly url: string
  readonly snapshotEvery: number
  readonly maxLeadTicks: number
  readonly interpolationTicks: number
  readonly reconnectGraceSeconds: number
}

/** `content/net.toml` as written: everything but `url` may be left to its default. */
export interface NetConfigInput {
  readonly url: string
  readonly snapshotEvery?: number | undefined
  readonly maxLeadTicks?: number | undefined
  readonly interpolationTicks?: number | undefined
  readonly reconnectGraceSeconds?: number | undefined
}

export const netConfigSchema: z.ZodType<NetConfig, NetConfigInput> = z
  .object({
    url: z.string().regex(SOCKET_ORIGIN, 'url is a wss:// (or ws://) origin with no path'),
    /** Ticks between authoritative snapshots [3: 20 Hz at 60 Hz]. */
    snapshotEvery: ticks(3, 60),
    /** How far a client may predict ahead [60: one second at 60 Hz]. */
    maxLeadTicks: ticks(60, 600),
    /** Remote render delay [6]. */
    interpolationTicks: ticks(6, 120),
    /** How long a dropped seat is held [30]. */
    reconnectGraceSeconds: z.number().int().min(1).max(600).default(30),
  })
  .strict()
