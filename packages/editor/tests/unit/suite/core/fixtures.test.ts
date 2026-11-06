// The two games' editor lists (editor suite spec §8, §12): The Last Light's Bay scene, converted AF-side at 92e6704,
// and FloorFifty at 677d456, which has no gates and says so.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { loadEditorList } from '#src/shared/editor-list/editor-list.ts'
import type { EditorList } from '#src/shared/editor-list/editors.schema.ts'
import { fileAccess } from '#src/shared/editor-list/workspace-policy.ts'

const fixture = (name: string): string =>
  readFileSync(
    new URL(`../../../../src/testing/suite/fixtures/${name}.editors.toml`, import.meta.url),
    'utf8',
  )

function load(name: string): EditorList {
  const result = loadEditorList(fixture(name))
  if (!result.ok) throw new Error(JSON.stringify(result.problems, null, 2))
  return result.list
}

const opened = (list: EditorList, path: string) => {
  const access = fileAccess(list, path)
  if (!access.writable) throw new Error(`${path}: ${access.why}`)
  return {
    editor: access.row.editor,
    gates: access.row.gates,
    checks: access.row.checks,
    scene: access.scene,
  }
}

describe("FloorFifty's editor list (677d456)", () => {
  const list = load('floorfifty')

  it('declares no gates, and every row says so with an empty list', () => {
    expect(list.gate).toEqual([])
    expect(list.file.length).toBeGreaterThan(0)
    for (const row of list.file) expect(row.gates, row.glob).toEqual([])
    expect(fixture('floorfifty')).toMatch(/^gates = \[\]$/m)
  })

  it('has no scenes', () => {
    expect(list.scenes).toBeUndefined()
  })

  it('opens its tuning, its modes and its stages in their editors', () => {
    expect(opened(list, 'content/tuning.toml')).toEqual({
      editor: 'tuner',
      gates: [],
      checks: ['content', 'content-check'],
      scene: undefined,
    })
    expect(opened(list, 'content/modes/floors-50.toml').editor).toBe('tuner')
    expect(opened(list, 'content/stages/rooftops.toml').editor).toBe('levels-2d')
  })

  it("leaves its compiler's output, its juice and its characters read only", () => {
    expect(fileAccess(list, 'content/generated/content.json')).toMatchObject({ reason: 'generated' })
    expect(fileAccess(list, 'content/juice.toml')).toMatchObject({ reason: 'unlisted' })
    expect(fileAccess(list, 'content/characters/frog.toml')).toMatchObject({ reason: 'unlisted' })
    expect(fileAccess(list, 'content/editors.toml')).toMatchObject({ reason: 'never' })
  })

  it('names its source commit', () => {
    expect(fixture('floorfifty')).toContain('677d456')
  })
})

describe("The Last Light's Bay editor list (92e6704)", () => {
  const list = load('last-light-bay')

  it('opens each Bay file in its editor with its gates and its scene', () => {
    expect(opened(list, 'content/scenes/bay/puzzle.toml')).toEqual({
      editor: 'schematic',
      gates: ['P-G1'],
      checks: ['content', 'puzzle-check'],
      scene: 'bay',
    })
    expect(opened(list, 'content/scenes/bay/story.toml')).toMatchObject({ editor: 'writer', gates: ['N-G1'] })
    expect(opened(list, 'content/scenes/bay/agents.toml')).toMatchObject({
      editor: 'schematic',
      gates: ['S-G2'],
    })
    expect(opened(list, 'content/cutscenes/bay-arrival.toml')).toMatchObject({
      editor: 'sequence',
      gates: ['C-G1'],
    })
    expect(opened(list, 'content/figures/ada.toml')).toMatchObject({ editor: 'studio', gates: ['G1', 'G6'] })
    expect(opened(list, 'docs/art/blockout-bay/blockout.json')).toMatchObject({
      editor: 'levels-3d',
      gates: ['E1', 'E2', 'E3', 'E4', 'LOOK-G1', 'baseline'],
      scene: 'bay',
    })
  })

  it('declares the fairness check as a measure and the blockout generator as a before check that joins files', () => {
    expect(list.check.find((check) => check.id === 'fairness')).toMatchObject({
      measure: true,
      when: 'after',
    })
    expect(list.check.find((check) => check.id === 'blockout-generate')).toMatchObject({
      when: 'before',
      joins: ['src/scenes/{scene}/map.ts', 'src/scenes/{scene}/level.ts'],
    })
  })

  it('never writes its gate records, frozen contracts or the files its pipelines generate', () => {
    expect(fileAccess(list, 'docs/art/bay/puzzle/gates.json')).toMatchObject({ reason: 'never' })
    expect(fileAccess(list, 'src/game/contracts/narrative.ts')).toMatchObject({ reason: 'never' })
    expect(fileAccess(list, 'src/scenes/bay/level.ts')).toMatchObject({ reason: 'generated' })
    expect(fileAccess(list, 'docs/narrative/act-two-script.md')).toMatchObject({ reason: 'generated' })
  })

  it('has scenes', () => {
    expect(list.scenes).toBe('content/scenes/{scene}/')
  })

  it('names its source commit', () => {
    expect(fixture('last-light-bay')).toContain('92e6704')
  })
})
