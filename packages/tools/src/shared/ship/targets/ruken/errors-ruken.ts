import type { ManifestError } from '@ruken/manifest'
import { Data } from 'effect'
import type { TaggedErrorClass } from '../../../node/errors.ts'

// The Ruken target's own failure, re-exported by `errors.ts` with every other ship error.

const ManifestInvalidBase: TaggedErrorClass<
  'ManifestInvalid',
  {
    readonly problems: readonly ManifestError[]
  }
> = Data.TaggedError('ManifestInvalid')
/** The achievement an issue's path names: `achievements.score-20.title` is `score-20`. */
const achievementOf = (path: string): string => /^achievements\.([^.]+)/.exec(path)?.[1] ?? '?'

/** What each achievement or board-title problem means for the author, who wrote a goal and not a Ruken table. */
const PLAIN_WORDS: Readonly<Record<string, (path: string) => string>> = {
  ACHIEVEMENT_ID_INVALID: (path) =>
    `achievement "${achievementOf(path)}": Ruken refuses this id (an id may not start with "ruken-").`,
  ACHIEVEMENT_TEXT_INVALID: (path) =>
    `achievement "${achievementOf(path)}": its title or description is too long for Ruken.`,
  ACHIEVEMENT_LIMIT: () => 'this game declares more achievements than Ruken allows.',
  ACHIEVEMENT_RULE_INVALID: (path) => `achievement "${achievementOf(path)}": Ruken refused its goal.`,
  ACHIEVEMENT_BOARD_UNKNOWN: (path) => `achievement "${achievementOf(path)}": Ruken refused its goal.`,
  LEADERBOARD_TITLE_INVALID: (path) =>
    `leaderboard "${/^leaderboards\.([^.]+)/.exec(path)?.[1] ?? '?'}": Ruken refuses its title (1 to 48 characters).`,
}

/**
 * Ruken's parser refused the generated `ruken.toml`. `problems` are Ruken's own issues, unchanged. An achievement or
 * board-title problem is put in plain words first, since the author wrote a goal in `ship.config.ts`, not a Ruken
 * table; Ruken's own message follows it.
 */
export class ManifestInvalid extends ManifestInvalidBase {
  override get message(): string {
    return this.problems
      .map((problem) => {
        const plain = PLAIN_WORDS[problem.code]?.(problem.path)
        return plain === undefined
          ? `ruken.toml ${problem.path || '(file)'}: ${problem.message}`
          : `${plain} (ruken.toml ${problem.path}: ${problem.message})`
      })
      .join('\n')
  }
}

const AchievementUnsupportedBase: TaggedErrorClass<
  'AchievementUnsupported',
  { readonly achievement: string; readonly goal: string; readonly allowed: readonly number[] }
> = Data.TaggedError('AchievementUnsupported')
/**
 * A goal Ruken has no rule for. The game's declaration is the framework's own, so a share Ruken does not award is not
 * a mistake in the config, only something this host cannot do; prepare says which.
 */
export class AchievementUnsupported extends AchievementUnsupportedBase {
  override get message(): string {
    const list = this.allowed.join(', ').replace(/, (\d+)$/, ' or $1')
    return `achievement "${this.achievement}": Ruken can award a top share of ${list} percent, not ${this.goal}. Pick one of those.`
  }
}
