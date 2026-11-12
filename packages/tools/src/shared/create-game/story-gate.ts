import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// The 2D story (a keeper to talk to, a cutscene, a guard) plays on packages that stay private until the extensions are
// public: narrative, cutscenes, systems, nav, places and level-2d. A game made with the published tools could not install
// them, so `create-game` writes the story only where they are: inside this repository's workspace, or where AF_BETA_STORY=1
// says the author has them. Anywhere else it writes the plain game.

/** True when `dir` or a folder above it holds `extensions/narrative` with the narrative package in it. */
function workspaceHasStory(dir: string): boolean {
  for (let current = dir; ; current = dirname(current)) {
    const manifest = join(current, 'extensions/narrative/package.json')
    if (existsSync(manifest)) {
      try {
        if ((JSON.parse(readFileSync(manifest, 'utf8')) as { name?: unknown }).name === '@automata/narrative')
          return true
      } catch {
        // A manifest that cannot be read is not the narrative package.
      }
    }
    if (dirname(current) === current) return false
  }
}

/**
 * Whether this run can write the story: AF_BETA_STORY is exactly "1", or the tools run from a checkout of this repository
 * (found by walking up from `from`, which is this file from source and the bundle in a published install, where it finds nothing).
 */
export function storyAvailable(
  env: Readonly<Record<string, string | undefined>> = process.env,
  from: string = dirname(fileURLToPath(import.meta.url)),
): boolean {
  return env.AF_BETA_STORY === '1' || workspaceHasStory(from)
}
