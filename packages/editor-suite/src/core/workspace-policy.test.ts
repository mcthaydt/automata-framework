import { describe, expect, it } from 'vitest'
import { loadEditorList } from './editor-list'
import type { EditorList } from './editors.schema'
import { fileAccess } from './workspace-policy'

function list(toml: string): EditorList {
  const load = loadEditorList(`format = "af-editors/1"\n${toml}`)
  if (!load.ok) throw new Error(JSON.stringify(load.problems))
  return load.list
}

const GAME = list(`
generated = ["content/generated/**"]
never = ["package.json"]

[[file]]
glob = "content/scenes/{scene}/puzzle.toml"
editor = "schematic"
modes = ["edit", "ask"]
gates = ["P-G1"]
checks = ["content"]

[[file]]
glob = "content/scenes/*/*.toml"
editor = "writer"
modes = ["ask"]
gates = []
checks = ["content"]

[[file]]
glob = "content/**"
editor = "tuner"
modes = ["edit"]
gates = []
checks = ["content"]

[[gate]]
id = "P-G1"
name = "Puzzle design"
records = "docs/art/**/puzzle/*.json"
`)

const reasonOf = (path: string, editorList: EditorList = GAME) => {
  const access = fileAccess(editorList, path)
  return access.writable ? 'writable' : access.reason
}

describe('fileAccess', () => {
  it('opens a file in the first row whose glob matches, with its scene', () => {
    const access = fileAccess(GAME, 'content/scenes/bay/puzzle.toml')
    expect(access).toMatchObject({ writable: true, path: 'content/scenes/bay/puzzle.toml', scene: 'bay' })
    expect(access.writable && access.row.editor).toBe('schematic')
    expect(access.writable && access.row.gates).toEqual(['P-G1'])
  })

  it('later rows take only what earlier rows leave', () => {
    const story = fileAccess(GAME, 'content/scenes/bay/story.toml')
    expect(story.writable && story.row.editor).toBe('writer')
    expect(story.writable && 'scene' in story).toBe(false)
    const tuning = fileAccess(GAME, 'content/tuning.toml')
    expect(tuning.writable && tuning.row.editor).toBe('tuner')
  })

  it('never writes the list itself, git internals or gate records, whatever the list says (EDS-n)', () => {
    const bare = list(`
[[file]]
glob = "**"
editor = "tuner"
modes = ["edit", "ask"]
gates = []
checks = []
`)
    for (const path of [
      'content/editors.toml',
      '.git/config',
      '.git/refs/heads/main',
      'docs/art/bay/gates.json',
      'gates.json',
    ]) {
      expect(reasonOf(path, bare), path).toBe('never')
    }
    expect(reasonOf('content/tuning.toml', bare)).toBe('writable')
  })

  it('refuses the always-never paths in any letter case, as a case-insensitive disk would read them', () => {
    for (const path of [
      'Content/Editors.toml',
      'CONTENT/EDITORS.TOML',
      '.GIT/config',
      '.Git/HEAD',
      'docs/Gates.json',
      'docs/art/bay/GATES.JSON',
    ]) {
      expect(reasonOf(path), path).toBe('never')
    }
  })

  it('refuses `.git` itself, not only what is inside it', () => {
    expect(reasonOf('.git')).toBe('never')
    expect(reasonOf('.GIT')).toBe('never')
  })

  it("refuses a declared gate's records in any letter case", () => {
    expect(reasonOf('Docs/Art/bay/Puzzle/review.json')).toBe('never')
  })

  it("refuses The Last Light's always-refused paths: agent and CI config, and env files", () => {
    for (const path of [
      '.claude/settings.json',
      '.github/workflows/ci.yml',
      '.GitHub/CODEOWNERS',
      '.env',
      'docker/.env.local',
      'content/.ENV',
    ]) {
      expect(reasonOf(path), path).toBe('never')
    }
  })

  it("never writes a declared gate's records", () => {
    expect(reasonOf('content/generated/x.json')).toBe('generated')
    expect(reasonOf('docs/art/bay/puzzle/review.json')).toBe('never')
  })

  it("refuses the list's own never globs before its generated globs", () => {
    expect(reasonOf('package.json')).toBe('never')
    const both = list('generated = ["content/a.toml"]\nnever = ["content/a.toml"]\n')
    expect(reasonOf('content/a.toml', both)).toBe('never')
  })

  it('says why a file is read only', () => {
    const access = fileAccess(GAME, 'content/generated/content.json')
    expect(access).toMatchObject({ writable: false, reason: 'generated' })
    expect(!access.writable && access.why).toContain('content/generated/**')
    const never = fileAccess(GAME, 'content/editors.toml')
    expect(!never.writable && never.why).toContain('content/editors.toml')
  })

  it('leaves a file no row matches read only', () => {
    const access = fileAccess(GAME, 'src/main.ts')
    expect(access).toMatchObject({ writable: false, reason: 'unlisted' })
    expect(!access.writable && access.why).toContain('content/editors.toml')
  })

  it('refuses any path outside the game root', () => {
    for (const path of [
      '/etc/passwd',
      '../other/file.toml',
      'content/../../x.toml',
      '',
      './content/tuning.toml',
      'content//tuning.toml',
      'content\\tuning.toml',
    ]) {
      expect(reasonOf(path), path).toBe('outside')
    }
  })
})
