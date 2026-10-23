import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

// `framework.ref` is the framework commit the site's copies (example sources, demo bundles) were taken from, and the
// commit CI checks the framework out at. The sync scripts record it from the checkout they read.

function git(framework: string, ...args: string[]): string {
  try {
    return execFileSync('git', ['-C', framework, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch {
    throw new Error(`${framework} is not a git checkout`)
  }
}

/**
 * The commit of the framework checkout. A checkout with edited or untracked files is refused: whatever was copied from
 * it would not be the commit that gets recorded.
 */
export function frameworkCommit(framework: string): string {
  const commit = git(framework, 'rev-parse', 'HEAD').trim()
  if (git(framework, 'status', '--porcelain').trim()) {
    throw new Error(`${framework} has uncommitted changes; commit or discard them so the site records the commit it copied`)
  }
  return commit
}

export function writeFrameworkRef(websiteDir: string, commit: string): void {
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error(`framework.ref needs a 40-character commit id, not "${commit}"`)
  writeFileSync(join(websiteDir, 'framework.ref'), `${commit}\n`)
}
