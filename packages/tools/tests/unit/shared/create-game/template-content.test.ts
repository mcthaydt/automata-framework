import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { entitiesOf, intGridRows, levelContentSchema } from '@automata/content/level-2d'
import { editorRows, loadEditorList } from '@automata/editor/editor-list'
import { Effect } from 'effect'
import { parse } from 'smol-toml'
import { afterAll, describe, expect, it } from 'vitest'
import { levelsStep } from '#src/shared/check/levels-step.ts'
import { createGame } from '#src/shared/create-game/create-game.ts'
import { readTemplateContent } from '#src/shared/create-game/template-content.ts'
import { FilesLive } from '#src/shared/node/files.ts'
import { templateContentDrift } from '../../../../scripts/write-template-content.ts'

// A new game starts with a level: a level project the 2D editor opens (`content/levels/start.af2d.json`) and the game
// files the editor's Save writes from it. The game files are checked in beside the project and made by the same export
// code Save runs, so this test regenerates them and compares: they cannot drift.

const made: string[] = []
afterAll(() => {
  for (const dir of made) rmSync(dir, { recursive: true, force: true })
})

describe('the starter level', () => {
  it('has game files equal to a fresh export of its level project', () => {
    expect(templateContentDrift()).toEqual([])
  })

  it('is a floor, two platforms and one player start standing on the floor', () => {
    const level = levelContentSchema.parse(parse(readTemplateContent('levels/start.toml')))
    const rows = intGridRows(level, 'collision')
    const solidRows = rows
      .map((row, y) => ({ y, solid: row.filter((cell) => cell === 1).length }))
      .filter(({ solid }) => solid > 0)
    const width = rows[0]?.length ?? 0
    // Two full rows of floor at the bottom, and two short platforms above it.
    expect(solidRows.filter(({ solid }) => solid === width).map(({ y }) => y)).toEqual([
      rows.length - 2,
      rows.length - 1,
    ])
    expect(solidRows.filter(({ solid }) => solid < width)).toHaveLength(2)
    const starts = entitiesOf(level, 'entities').filter((item) => item.def === 'player-start')
    expect(starts).toHaveLength(1)
    const tile = level.size.w / width
    expect(starts[0]?.y).toBe((rows.length - 2) * tile)
  })
})

describe('a new game', () => {
  it('passes the levels step of automata check as it was made', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'af-template-content-'))
    made.push(dir)
    const game = join(dir, 'game')
    await Effect.runPromise(createGame({ targetDir: game, id: 'level-game', title: 'Level Game' }))
    expect(await Effect.runPromise(Effect.provide(levelsStep(game), FilesLive))).toEqual([])
  })
})

describe('the starter editor list', () => {
  it('names the files Schematic edits, as rows the editor list accepts', () => {
    const list = readTemplateContent('editors.toml')
    const rows = (parse(list) as { file: { glob: string; editor: string }[] }).file
    expect(rows.filter((row) => row.editor === 'schematic').map((row) => row.glob)).toEqual([
      'content/systems/*.toml',
      'content/nav/*.toml',
      'content/puzzles/*.toml',
    ])
    expect(loadEditorList(list).ok).toBe(true)
  })
})

describe('the starter tuning', () => {
  it('holds the square’s speed as one tunable, with the words the Tuner shows beside it', () => {
    const text = readTemplateContent('tuning.toml')
    expect(text).toMatch(/^# .*\n/)
    expect(parse(text)).toEqual({
      SPEED: {
        value: 2,
        min: 1,
        max: 4,
        step: 1,
        label: 'Speed',
        feel: 'How far the square moves each step.',
        unit: 'pixels a step',
      },
    })
  })

  it('is listed for the Tuner, in the Tuner’s own rows', () => {
    const list = readTemplateContent('editors.toml')
    const rows = (parse(list) as { file: { glob: string; editor: string }[] }).file
    expect(rows.filter((row) => row.editor === 'tuner').map((row) => row.glob)).toEqual([
      'content/tuning.toml',
      'content/controls.toml',
    ])
    for (const glob of (editorRows('tuner')?.match(/glob = "([^"]+)"/g) ?? []).map((line) =>
      line.slice(8, -1),
    ))
      expect(rows.some((row) => row.glob === glob && row.editor === 'tuner')).toBe(true)
  })
})
