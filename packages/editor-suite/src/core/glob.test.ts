import { describe, expect, it } from 'vitest'
import { globMatch } from './glob'

const matches = (glob: string, path: string): boolean => globMatch(glob, path) !== undefined

describe('globMatch', () => {
  it('matches `*` within one segment only', () => {
    expect(matches('content/modes/*.toml', 'content/modes/floors-20.toml')).toBe(true)
    expect(matches('content/modes/*.toml', 'content/modes/deep/floors-20.toml')).toBe(false)
    expect(matches('content/*.toml', 'content/tuning.toml')).toBe(true)
  })

  it('matches `**` across segments, and `**/` also at no depth', () => {
    expect(matches('content/generated/**', 'content/generated/content.json')).toBe(true)
    expect(matches('content/generated/**', 'content/generated/a/b.json')).toBe(true)
    expect(matches('**/gates.json', 'gates.json')).toBe(true)
    expect(matches('**/gates.json', 'docs/art/bay/puzzle/gates.json')).toBe(true)
    expect(matches('docs/**/gates.json', 'docs/gates.json')).toBe(true)
    expect(matches('.git/**', '.git/config')).toBe(true)
  })

  it('matches `?` as one character of a segment', () => {
    expect(matches('content/stage-?.toml', 'content/stage-1.toml')).toBe(true)
    expect(matches('content/stage-?.toml', 'content/stage-12.toml')).toBe(false)
    expect(matches('a?b', 'a/b')).toBe(false)
  })

  it('treats regular-expression characters as literal', () => {
    expect(matches('content/tuning.toml', 'content/tuningxtoml')).toBe(false)
    expect(matches('content/(a)+.toml', 'content/(a)+.toml')).toBe(true)
    expect(matches('content/a$.toml', 'content/a$.toml')).toBe(true)
  })

  it('anchors both ends', () => {
    expect(matches('content/tuning.toml', 'x/content/tuning.toml')).toBe(false)
    expect(matches('content/tuning.toml', 'content/tuning.toml.bak')).toBe(false)
  })

  it('captures `{scene}` as one non-empty segment', () => {
    expect(globMatch('content/scenes/{scene}/puzzle.toml', 'content/scenes/bay/puzzle.toml')).toEqual({
      scene: 'bay',
    })
    expect(
      globMatch('docs/art/blockout-{scene}/blockout.json', 'docs/art/blockout-clinic-dawn/blockout.json'),
    ).toEqual({ scene: 'clinic-dawn' })
    expect(matches('content/scenes/{scene}/puzzle.toml', 'content/scenes/a/b/puzzle.toml')).toBe(false)
    expect(matches('content/scenes/{scene}/puzzle.toml', 'content/scenes//puzzle.toml')).toBe(false)
    expect(globMatch('content/tuning.toml', 'content/tuning.toml')).toEqual({})
  })

  // The Last Light's policy cases (editor/tests/policy.test.ts at 92e6704) on its manifest's globs.
  it("matches The Last Light's manifest globs as its guard does", () => {
    expect(matches('src/scenes/*/cutscenes.ts', 'src/scenes/bay/cutscenes.ts')).toBe(true)
    expect(matches('src/scenes/*/level.ts', 'src/scenes/bay/level.ts')).toBe(true)
    expect(matches('docs/narrative/*-script.md', 'docs/narrative/act-two-script.md')).toBe(true)
    expect(matches('**/gates.json', 'docs/art/porter-3d/gates.json')).toBe(true)
    expect(matches('src/game/contracts/**', 'src/game/contracts/narrative.ts')).toBe(true)
    expect(matches('.github/**', '.github/workflows/approve-gate.yml')).toBe(true)
    expect(matches('src/scenes/*/cutscenes.ts', 'src/main.ts')).toBe(false)
  })
})
