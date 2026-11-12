import { ACHIEVEMENT_TOP_PERCENTS, type Manifest, parseManifest } from '@ruken/manifest'
import { Effect } from 'effect'
import type { ShipConfig } from '../../config/ship-config.ts'
import { AchievementUnsupported, ManifestInvalid } from '../../errors.ts'

/** Checks `ruken.toml` text with Ruken's own parser, so AF accepts exactly what Ruken accepts. */
export function checkManifest(toml: string): Effect.Effect<Manifest, ManifestInvalid> {
  const result = parseManifest(toml)
  return result.ok
    ? Effect.succeed(result.manifest)
    : Effect.fail(new ManifestInvalid({ problems: result.errors }))
}

/**
 * `checkManifest` for a caller outside Effect (a game's tests): the manifest, or a thrown `ManifestInvalid` naming
 * each problem.
 */
export function manifestOf(toml: string): Manifest {
  const result = parseManifest(toml)
  if (!result.ok) throw new ManifestInvalid({ problems: result.errors })
  return result.manifest
}

/**
 * Refuses a top share Ruken has no rule for, naming the achievement and the shares Ruken allows. The list is Ruken's
 * own, read from its manifest package, never retyped here.
 */
export function checkAchievementGoals(config: ShipConfig): Effect.Effect<void, AchievementUnsupported> {
  const allowed: readonly number[] = ACHIEVEMENT_TOP_PERCENTS
  for (const [id, achievement] of Object.entries(config.achievements ?? {})) {
    if ('top_percent' in achievement.goal && !allowed.includes(achievement.goal.top_percent)) {
      return Effect.fail(
        new AchievementUnsupported({
          achievement: id,
          goal: String(achievement.goal.top_percent),
          allowed,
        }),
      )
    }
  }
  return Effect.void
}
