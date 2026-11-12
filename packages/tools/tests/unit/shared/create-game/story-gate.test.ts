import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { storyAvailable } from '#src/shared/create-game/story-gate.ts'

// The story (a keeper, a cutscene, a guard) needs six packages that stay private until the extensions are public. A new
// 2D game gets it where they are found (inside this repository's workspace) and where AF_BETA_STORY=1 says the author
// has them; anywhere else it is the plain game, which installs from the registry.

const made: string[] = []
afterAll(() => {
  for (const dir of made) rmSync(dir, { recursive: true, force: true })
})

/** A folder tree with `extensions/narrative/package.json` named `name` at its root when given; returns a folder below it. */
function tree(name: string | undefined): string {
  const root = mkdtempSync(join(tmpdir(), 'af-story-gate-'))
  made.push(root)
  if (name !== undefined) {
    mkdirSync(join(root, 'extensions/narrative'), { recursive: true })
    writeFileSync(join(root, 'extensions/narrative/package.json'), JSON.stringify({ name }))
  }
  mkdirSync(join(root, 'packages/tools/src/shared/create-game'), { recursive: true })
  return join(root, 'packages/tools/src/shared/create-game')
}

describe('the 2D story gate', () => {
  it('is open inside the repository, where extensions/narrative sits beside the tools', () => {
    expect(storyAvailable({}, tree('@automata/narrative'))).toBe(true)
  })

  it('is shut where no narrative package is found, and for a package of another name', () => {
    expect(storyAvailable({}, tree(undefined))).toBe(false)
    expect(storyAvailable({}, tree('@someone/narrative'))).toBe(false)
  })

  it('is open with AF_BETA_STORY=1 wherever the tools run, and only for exactly 1', () => {
    expect(storyAvailable({ AF_BETA_STORY: '1' }, tree(undefined))).toBe(true)
    expect(storyAvailable({ AF_BETA_STORY: '0' }, tree(undefined))).toBe(false)
    expect(storyAvailable({ AF_BETA_STORY: 'true' }, tree(undefined))).toBe(false)
  })
})
