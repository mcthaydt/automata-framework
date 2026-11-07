import { z } from 'zod'

/*
 * The keys of a game's `ship.config.ts` that every distribution target reads, owned by AF. They keep
 * the names and snake_case of Ruken's manifest, so a config reads like the `ruken.toml` the Ruken target writes from it;
 * `ruken/conformance.test.ts` holds AF's lists to Ruken's. Fields only Ruken uses (`game.sdk`, `loading`,
 * `leaderboards`) are optional here; the Ruken target requires what Ruken requires.
 */

/** The renderers a game may ask for. */
export const RENDERERS = ['webgl2', 'webgl', 'canvas2d', 'wasm-webgl2'] as const
/** The orientations a game supports. */
export const ORIENTATIONS = ['landscape', 'portrait', 'any'] as const
/** The inputs a game can be played with. */
export const INPUTS = ['touch', 'keyboard', 'gamepad'] as const
/** The content ratings a game declares. */
export const RATINGS = ['everyone', 'teen', 'mature'] as const
/** The orders a score board sorts in. */
export const LEADERBOARD_ORDERS = ['asc', 'desc'] as const

/** One renderer a game may ask for. */
export type Renderer = (typeof RENDERERS)[number]
/** One orientation a game supports. */
export type Orientation = (typeof ORIENTATIONS)[number]
/** One input a game can be played with. */
export type Input = (typeof INPUTS)[number]
/** One content rating. */
export type Rating = (typeof RATINGS)[number]

/** A game id and a board id: lower-case letters, digits and hyphens, starting with a letter or digit, up to 64. */
export const GAME_ID_PATTERN: RegExp = /^[a-z0-9][a-z0-9-]{0,63}$/

/** A score board a game declares. */
export interface LeaderboardConfig {
  readonly order: (typeof LEADERBOARD_ORDERS)[number]
  readonly min: number
  readonly max: number
  readonly title?: string
}

/** What every target knows about a game. */
export interface GameConfig {
  readonly game: {
    readonly id: string
    readonly title: string
    readonly version: string
    /** The entry page in the build. */
    readonly entry: string
    /** The Ruken SDK's version range; the Ruken target requires it. */
    readonly sdk?: string
  }
  readonly runtime: {
    readonly renderer: Renderer
    readonly orientation: Orientation
    readonly inputs: readonly Input[]
    readonly pause_behavior: 'pause' | 'continue'
  }
  /** The origins the game connects to; empty means it works offline. */
  readonly network: { readonly connect: readonly string[] }
  readonly content: {
    readonly languages: readonly string[]
    readonly rating: Rating
    readonly estimated_hours?: number
    readonly descriptors: readonly string[]
  }
  /** The analytics events the game may send (`Hosting.track` drops any other). */
  readonly analytics?: { readonly custom_events: readonly string[] }
  /** Files to load before the game starts, besides those the entry page names (the Ruken target). */
  readonly loading?: { readonly preload: readonly string[] }
  readonly leaderboards?: Readonly<Record<string, LeaderboardConfig>>
}

/** Checks a game's config. */
export const gameConfigSchema: z.ZodType<GameConfig> = z.object({
  game: z.object({
    id: z.string().regex(GAME_ID_PATTERN, 'must be lower-case letters, digits and hyphens, at most 64'),
    title: z.string().min(1),
    version: z.string().min(1),
    entry: z.string().min(1),
    sdk: z.string().exactOptional(),
  }),
  runtime: z.object({
    renderer: z.enum(RENDERERS),
    orientation: z.enum(ORIENTATIONS),
    inputs: z.array(z.enum(INPUTS)),
    pause_behavior: z.enum(['pause', 'continue']),
  }),
  network: z.object({ connect: z.array(z.string()) }),
  content: z.object({
    languages: z.array(z.string()),
    rating: z.enum(RATINGS),
    estimated_hours: z.number().exactOptional(),
    descriptors: z.array(z.string()),
  }),
  analytics: z.object({ custom_events: z.array(z.string()) }).exactOptional(),
  loading: z.object({ preload: z.array(z.string()) }).exactOptional(),
  leaderboards: z
    .record(
      z.string(),
      z.object({
        order: z.enum(LEADERBOARD_ORDERS),
        min: z.number(),
        max: z.number(),
        title: z.string().exactOptional(),
      }),
    )
    .exactOptional(),
})
