import { readFileSync } from 'node:fs'
import type { DistTarget } from './create-game-targets.ts'
import { type TemplateFile, targetsOf } from './template-file.ts'

// The game's own GitHub workflow: `template-ci/release.yml`, a real file so it reads (and lints) as the YAML it is.
// Some of it belongs to one target only, fenced by `# <target>:begin` and `# <target>:end` lines; a game keeps a
// fenced block when it builds for that target and loses it otherwise, and the fence lines never reach the game.
//
// Like `template-content/`, the folder sits next to this file from source and is copied to `dist/template-ci/` by
// `tsdown.config.ts`, so one relative URL finds it in both.

const RELEASE = new URL('./template-ci/release.yml', import.meta.url)

const FENCE = /^\s*# (\w+):(begin|end)$/

/** The workflow's text with the blocks of targets not in `targets` taken out. */
export function keepTargetBlocks(text: string, targets: readonly DistTarget[]): string {
  const kept: string[] = []
  let dropping: string | undefined
  for (const line of text.split('\n')) {
    const fence = FENCE.exec(line)
    if (fence === null) {
      if (dropping === undefined) kept.push(line)
      continue
    }
    const [, target, edge] = fence
    if (edge === 'begin' && !targets.includes(target as DistTarget)) dropping = target
    if (edge === 'end' && dropping === target) dropping = undefined
  }
  return kept.join('\n')
}

/** `.github/workflows/release.yml`: on a version tag, check and build the game, and push it to itch.io. */
export const CI_FILES: readonly TemplateFile[] = [
  {
    path: '.github/workflows/release.yml',
    content: (options) => keepTargetBlocks(readFileSync(RELEASE, 'utf8'), targetsOf(options)),
  },
]
