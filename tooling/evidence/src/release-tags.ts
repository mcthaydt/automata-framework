import { execFileSync } from 'node:child_process'

/**
 * Every git tag of the checkout. Not only the ones in the packages' current scope: whether a version was released
 * is `<name>@<version>` being among them (collect.ts), so the scope is whatever the packages' names say and is never
 * written here. A scope renamed before its first release leaves only the older scope's tags, which is a true "no
 * release yet"; a checkout with no tags at all (a shallow clone) is what collect.ts refuses.
 */
export function releaseTags(root: string): string[] {
  return execFileSync('git', ['tag', '--list'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean)
}
