/**
 * Per-key token buckets, in memory and bounded.
 *
 * A key is an address (`clientIp`). It is never written anywhere: the map is the only place one lives, and it holds
 * at most `maxKeys`, dropping the least recently used, so a spray of addresses costs a bounded amount of memory.
 *
 * Time is injected (`now`): the server passes its Effect `Clock`, a test a variable, and nothing here reads the wall
 * clock.
 */

import type { Bucket } from '../../shared/game/server-config'

interface KeyBucket {
  tokens: number
  at: number
}

/**
 * How a set of buckets behaves: the burst a quiet key may take, how long one token takes to come
 * back, how many keys to remember and the clock.
 */
export interface TokenBucketOptions {
  /** How many a quiet key may take at once. */
  readonly burst: number
  /** How long one token takes to come back; `Infinity` never refills. */
  readonly refillMs: number
  readonly maxKeys: number
  /** The clock, in milliseconds. */
  readonly now: () => number
}

/** A config bucket as `TokenBuckets` reads it. `perSecond` 0 never refills. */
export function bucketOptions(bucket: Bucket): { burst: number; refillMs: number } {
  return { burst: bucket.burst, refillMs: bucket.perSecond > 0 ? 1000 / bucket.perSecond : Infinity }
}

/**
 * A token bucket for each key, usually an address, held in memory and capped at a number of keys.
 * The least recently used key is forgotten first.
 */
export class TokenBuckets {
  private readonly buckets = new Map<string, KeyBucket>()
  private readonly options: TokenBucketOptions

  constructor(options: TokenBucketOptions) {
    this.options = options
  }

  get size(): number {
    return this.buckets.size
  }

  /** Takes one token for `key`, and says whether there was one. */
  take(key: string): boolean {
    const now = this.options.now()
    const bucket = this.refilled(this.buckets.get(key) ?? { tokens: this.options.burst, at: now }, now)
    // Re-inserting moves the key to the back, so the front is the least recently used.
    this.buckets.delete(key)
    this.buckets.set(key, bucket)
    if (this.buckets.size > this.options.maxKeys) {
      const oldest = this.buckets.keys().next().value
      if (oldest !== undefined) this.buckets.delete(oldest)
    }
    if (bucket.tokens < 1) return false
    bucket.tokens -= 1
    return true
  }

  /** Drops every bucket that has refilled to its burst: it would behave exactly like a new one. */
  sweep(): void {
    const now = this.options.now()
    for (const [key, bucket] of this.buckets) {
      if (this.refilled(bucket, now).tokens >= this.options.burst) this.buckets.delete(key)
    }
  }

  private refilled(bucket: KeyBucket, now: number): KeyBucket {
    const earned = Math.floor((now - bucket.at) / this.options.refillMs)
    if (!(earned > 0)) return bucket
    return {
      tokens: Math.min(this.options.burst, bucket.tokens + earned),
      at: bucket.at + earned * this.options.refillMs,
    }
  }
}
