// Facts about the game that only the game knows (`content/game.toml`), and the files each screen waits for
// (`content/assets.toml`). The compiler turns them into the game config's `content` and `analytics` sections
// (`ruken-fields.json`, which the Ruken target writes into `ruken.toml`) and, after a build, the preload list.
// Content never writes `ruken.toml`. The ratings are AF's game config's (DIST spec §4.4), held to Ruken's by
// `ruken/conformance.test.ts`; what else Ruken checks, Ruken's own parser checks (`ruken/ruken-check.ts`).

import { z } from 'zod'
import type { Problem } from '../diagnostics/diagnostic'
import { type GameConfig, RATINGS, type Rating } from './game-config.schema'

/**
 * What `content/game.toml` says about the game: its source language, rating, content descriptors, estimated
 * hours, the analytics events it may send, and the screens whose files are preloaded.
 */
export interface GameSource {
  /** The language the TOML is written in. Default `en`. */
  readonly source_language: string
  readonly rating: Rating
  readonly descriptors: string[]
  readonly estimated_hours?: number | undefined
  readonly custom_events: string[]
  /** The screens whose files Ruken preloads, in order. Default: the flow's entry. */
  readonly preload_screens?: string[] | undefined
}

export const gameSchema: z.ZodType<GameSource, unknown> = z.strictObject({
  source_language: z.string().default('en'),
  rating: z.enum(RATINGS),
  descriptors: z.array(z.string()).default([]),
  estimated_hours: z.optional(z.number().positive()),
  custom_events: z.array(z.string()).default([]),
  preload_screens: z.optional(z.array(z.string())),
})

/**
 * What `content/assets.toml` says: for each screen, the files it waits for (`dir/*` names every file in a
 * folder), and the atlases and fonts of the asset build it uses, by their names in `atlases.toml` and
 * `fonts.toml`. A preloaded screen's atlas pages and font subsets join the preload list (M5.6F.2).
 */
export interface AssetsSource {
  readonly screens: Readonly<
    Record<
      string,
      {
        readonly files: readonly string[]
        /** Atlases named in `content/atlases.toml`: each page's Spritesheet JSON and image. */
        readonly atlases?: readonly string[] | undefined
        /** Fonts named in `content/fonts.toml`: the subset of every language `fonts.json` lists. */
        readonly fonts?: readonly string[] | undefined
      }
    >
  >
}

// `atlases` and `fonts` are optional rather than defaulted, so an `assets.toml` that names none compiles to the
// same JSON, and the same content hash, as before they existed.
export const assetsSchema: z.ZodType<AssetsSource> = z.strictObject({
  screens: z.record(
    z.string(),
    z.strictObject({
      files: z.array(z.string()),
      atlases: z.optional(z.array(z.string())),
      fonts: z.optional(z.array(z.string())),
    }),
  ),
})

/**
 * The game config's `content` and `analytics` sections (Ruken's `[content]` and `[analytics]` tables), worked out
 * from `game.toml` and the languages present and written to `ruken-fields.json`.
 */
export type RukenFields = {
  readonly content: GameConfig['content']
  readonly analytics: NonNullable<GameConfig['analytics']>
}

/** BCP 47 tags of the shapes Ruken's store lists: `en`, `fr`, `pt-BR`, `zh-Hant`, `zh-Hant-TW`. */
export const LANGUAGE_TAG: RegExp = /^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2})?$/

/** The game's languages: never typed, derived from the source language and the translations present. */
export function languagesOf(sourceLanguage: string, translations: readonly string[]): string[] {
  const others = translations.filter((language) => language !== sourceLanguage).sort()
  return [sourceLanguage, ...others]
}

export function checkGame(
  game: GameSource,
  context: { readonly assetScreens?: readonly string[] | undefined },
): Problem[] {
  const problems: Problem[] = []
  const refuse = (path: Problem['path'], message: string): void => {
    problems.push({ path, code: 'invalidGame', message })
  }
  // Ruken's parser checks each name and that `en` is among the languages (ruken-check.ts). These are the
  // rules it does not have: a name listed twice, and a source language written as a language tag.
  const seen = new Set<string>()
  game.custom_events.forEach((event, index) => {
    if (seen.has(event)) refuse(['custom_events', index], `${event} is listed more than once`)
    seen.add(event)
  })
  if (!LANGUAGE_TAG.test(game.source_language)) {
    refuse(['source_language'], `${game.source_language} is not a language tag like en or pt-BR`)
  }
  const assetScreens = context.assetScreens
  if (assetScreens !== undefined) {
    game.preload_screens?.forEach((screen, index) => {
      if (!assetScreens.includes(screen))
        refuse(['preload_screens', index], `${screen} has no files in assets.toml`)
    })
  }
  return problems
}

/**
 * `screens` is the flow's screens, or undefined when the game has no flow. Each file's path is Ruken's to
 * judge (ruken-check.ts).
 */
export function checkAssets(assets: AssetsSource, screens: readonly string[] | undefined): Problem[] {
  const problems: Problem[] = []
  for (const screen of Object.keys(assets.screens).sort()) {
    if (screens !== undefined && !screens.includes(screen)) {
      problems.push({
        path: ['screens', screen],
        code: 'invalidGame',
        message: `${screen} is not a screen in flow.toml`,
      })
    }
  }
  return problems
}

export function rukenFields(game: GameSource, languages: readonly string[]): RukenFields {
  return {
    content: {
      languages: [...languages],
      rating: game.rating,
      descriptors: [...game.descriptors],
      ...(game.estimated_hours === undefined ? {} : { estimated_hours: game.estimated_hours }),
    },
    analytics: { custom_events: [...game.custom_events] },
  }
}
