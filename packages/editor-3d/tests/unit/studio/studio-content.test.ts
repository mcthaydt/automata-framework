// What the Studio reads of a game's figure content (EDS.9a; editor suite spec §6.2): every file of the content kinds it
// edits or draws with, parsed by the figures package's own schemas, with the problems it finds listed and nothing thrown.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { kindOf, readStudioContent, type StudioFile } from '#src/features/studio/studio-content.ts'

const ROOT = new URL('../../../src/app/suite/sample-3d/', import.meta.url).pathname

/** The recorded fixture game: Wick, a few poses, the roll, and what they use. */
function fixtureFiles(): StudioFile[] {
  const found: StudioFile[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`
      if (entry.isDirectory()) walk(path)
      else found.push({ path, text: readFileSync(join(ROOT, path), 'utf8') })
    }
  }
  walk('content')
  return found
}

describe('kindOf', () => {
  it('names a file’s content kind from the folder it is in', () => {
    expect(kindOf('content/figures/wick.toml')).toBe('figure')
    expect(kindOf('src/content/figure-poses/stand.toml')).toBe('pose')
    expect(kindOf('content/figure-clips/roll.toml')).toBe('clip')
    expect(kindOf('content/figure-swatches/brass.toml')).toBe('swatch')
    expect(kindOf('content/tuning.toml')).toBeUndefined()
    expect(kindOf('content/figures/notes.md')).toBeUndefined()
  })
})

describe('readStudioContent', () => {
  it('reads the fixture game: Wick, four poses, three clips and the library they use, with no problems', () => {
    const content = readStudioContent(fixtureFiles())
    expect(content.problems).toEqual([])
    expect(content.figures.map((entry) => entry.id)).toEqual(['wick'])
    expect(content.poses.map((entry) => entry.id)).toEqual(['guard-high', 'pickup-low', 'point', 'stand'])
    expect(content.clips.map((entry) => entry.id)).toEqual(['guard', 'pickup', 'roll'])
    expect(content.figures[0]?.value?.gait).toBe('bounce')
    expect(Object.keys(content.library.swatches)).toContain('wick-cloak')
    expect(Object.keys(content.motion.gaits)).toEqual(['bounce'])
    expect(content.motion.clips['roll']?.length).toBe(0.4)
  })

  it('lists a file that does not parse or fails its schema, with its path and the place, and keeps the rest', () => {
    const files = fixtureFiles().map((file) =>
      file.path.endsWith('roll.toml')
        ? { ...file, text: file.text.replace('t = 0.12', 't = 0.5') }
        : file.path.endsWith('guard.toml')
          ? { ...file, text: 'length = [' }
          : file,
    )
    const content = readStudioContent(files)
    const byPath = Object.fromEntries(content.problems.map((problem) => [problem.path, problem.message]))
    expect(byPath['content/figure-clips/roll.toml']).toMatch(/keys\.1\.t.*not after key 0|key 1 at 0.5 s/)
    expect(byPath['content/figure-clips/guard.toml']).toMatch(/toml|parse|invalid/i)
    expect(content.clips.map((entry) => entry.id)).toEqual(['guard', 'pickup', 'roll'])
    expect(content.clips.find((entry) => entry.id === 'roll')?.value).toBeUndefined()
    expect(content.figures[0]?.value).toBeDefined()
  })
})
