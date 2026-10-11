// Facts Ruken's manifest asks for that only the game knows (`content/game.toml`), and the files each screen
// waits for (`content/assets.toml`). The compiler turns them into Ruken's `[content]` and `[analytics]`
// tables (`ruken-fields.json`) and, after a build, the `[loading] preload` list. The ship lane writes
// `ruken.toml` from these; content never writes it, and every rule here is Ruken's own, imported from
// `@ruken/manifest` (RATINGS, ANALYTICS_NAME_RE) rather than copied.

import { ANALYTICS_NAME_RE, type Manifest, RATINGS, type Rating } from '@ruken/manifest'
import { z } from 'zod'
import type { Problem } from '../diagnostics/diagnostic'

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

export interface AssetsSource {
  readonly screens: Readonly<Record<string, { readonly files: readonly string[] }>>
}

export const assetsSchema: z.ZodType<AssetsSource> = z.strictObject({
  screens: z.record(z.string(), z.strictObject({ files: z.array(z.string()) })),
})

export type RukenFields = Pick<Manifest, 'content' | 'analytics'>

/** BCP 47 tags of the shapes Ruken's store lists: `en`, `fr`, `pt-BR`, `zh-Hant`, `zh-Hant-TW`. */
const LANGUAGE_TAG = /^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2})?$/

/** The game's languages: never typed, derived from the source language and the translations present. */
export function languagesOf(sourceLanguage: string, translations: readonly string[]): string[] {
  const others = translations.filter((language) => language !== sourceLanguage).sort()
  return [sourceLanguage, ...others]
}

export function checkGame(
  game: GameSource,
  context: { readonly languages: readonly string[]; readonly assetScreens?: readonly string[] | undefined },
): Problem[] {
  const problems: Problem[] = []
  const refuse = (path: Problem['path'], message: string): void => {
    problems.push({ path, code: 'invalidGame', message })
  }
  const seen = new Set<string>()
  game.custom_events.forEach((event, index) => {
    if (!ANALYTICS_NAME_RE.test(event)) {
      refuse(['custom_events', index], `event names match ${ANALYTICS_NAME_RE.source}, received ${event}`)
    } else if (seen.has(event)) refuse(['custom_events', index], `${event} is listed more than once`)
    seen.add(event)
  })
  if (!LANGUAGE_TAG.test(game.source_language)) {
    refuse(['source_language'], `${game.source_language} is not a language tag like en or pt-BR`)
  }
  if (!context.languages.includes('en')) {
    refuse(
      ['source_language'],
      `Ruken needs en among the languages (LANGUAGES_MISSING_EN); they are ${context.languages.join(', ')}`,
    )
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
 * A path inside the build, as Ruken's preload rule wants it: relative, `/`-separated, no `..`, or a folder
 * written `dir/*`.
 */
export function isBuildPath(path: string): boolean {
  if (path === '' || path.startsWith('/') || path.includes('\\')) return false
  const segments = path.split('/')
  return segments.every((segment, index) => {
    if (segment === '' || segment === '.' || segment === '..') return false
    return segment !== '*' || index === segments.length - 1
  })
}

/** `screens` is the flow's screens, or undefined when the game has no flow. */
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
    assets.screens[screen]?.files.forEach((file, index) => {
      if (isBuildPath(file)) return
      problems.push({
        path: ['screens', screen, 'files', index],
        code: 'invalidGame',
        message: `${file} must be a relative path inside the build, such as audio/menu.m4a or audio/*`,
      })
    })
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
