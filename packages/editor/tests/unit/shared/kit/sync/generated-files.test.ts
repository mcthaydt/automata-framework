import { describe, expect, it } from 'vitest'
import { generatedFolders, generatedNote, isGeneratedPath } from '#src/shared/kit/sync/generated-files.ts'

const EDITORS = `format = "af-editors/1"

[[file]]
glob = "content/levels/*.af2d.json"
editor = "levels-2d"
modes = ["edit"]
exports = "content"
gates = []
checks = ["content"]

[[file]]
glob = "content/tuning.toml"
editor = "tuner"
modes = ["edit"]
gates = []
checks = ["content"]
`

describe('the files the app makes again from a level', () => {
  const folders = generatedFolders(EDITORS)

  it('are the ones a level editor’s export folder holds', () => {
    expect(folders).toEqual(['content'])
    expect(isGeneratedPath('content/levels/start.toml', folders)).toBe(true)
    expect(isGeneratedPath('content/project.toml', folders)).toBe(true)
    expect(isGeneratedPath('content/world.toml', folders)).toBe(true)
  })

  it('are not the files a person edits', () => {
    expect(isGeneratedPath('content/tuning.toml', folders)).toBe(false)
    expect(isGeneratedPath('content/feel.toml', folders)).toBe(false)
    expect(isGeneratedPath('content/levels/start.af2d.json', folders)).toBe(false)
    expect(isGeneratedPath('other/levels/start.toml', folders)).toBe(false)
  })

  it('are none when the game has no editor list or a broken one', () => {
    expect(generatedFolders(undefined)).toEqual([])
    expect(generatedFolders('this is = = not toml')).toEqual([])
  })

  it('say what happened to Claude’s edit of one', () => {
    expect(generatedNote('content/levels/start.toml')).toBe(
      "Claude edited content/levels/start.toml, but the app rebuilds that file from your level. Claude's edit is kept on GitHub, not in the game.",
    )
  })
})
