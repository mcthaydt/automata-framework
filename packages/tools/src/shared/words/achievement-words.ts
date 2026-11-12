import type { AchievementConfig } from '@automataframework/content/game-config'
import type { Catalog } from './catalog.ts'

// A game's achievements are declared once in `ship.config.ts`; their titles and descriptions are words like the rest, so
// they are translated by the same command. The declaration is the source: `automata words` writes the source catalog
// from it, and `automata check` says when the file has fallen behind.

/** Where a game keeps the achievements' words, beside `messages/ui`. */
export const ACHIEVEMENTS_FOLDER = 'messages/achievements'

/** `score-20` becomes `score_20`: a message key is lower-case letters, digits and underscores. */
const keyOf = (id: string): string => id.replace(/-/g, '_')

/**
 * The achievements' source words, by message key (`achievement_<id>_title` and `achievement_<id>_description`), in id
 * order, so the same declaration always gives the same file.
 */
export function achievementWords(
  achievements: Readonly<Record<string, AchievementConfig>> | undefined,
): Catalog {
  const words: Record<string, string> = {}
  const ids = Object.keys(achievements ?? {}).sort()
  for (const id of ids) {
    const achievement = achievements?.[id]
    if (achievement === undefined) continue
    words[`achievement_${keyOf(id)}_title`] = achievement.title
    words[`achievement_${keyOf(id)}_description`] = achievement.description
  }
  return words
}
