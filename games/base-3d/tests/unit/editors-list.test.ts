import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { globMatch, loadEditorList } from '@automata/editor/editor-list'
import { describe, expect, it } from 'vitest'

// Ember Hall's editor list (`content/editors.toml`): the suite reads it to open the room in Levels 3D, Wick in
// Characters and the numbers in the Tuner, so the file must parse and each row must reach a file the game has.

const root = join(import.meta.dirname, '..', '..')

/** Every file under `folder`, as paths from the game's root with forward slashes. */
function filesUnder(folder: string): string[] {
  return readdirSync(join(root, folder), { withFileTypes: true }).flatMap((entry) => {
    const path = `${folder}/${entry.name}`
    return entry.isDirectory() ? filesUnder(path) : [path]
  })
}

const load = loadEditorList(readFileSync(join(root, 'content', 'editors.toml'), 'utf8'))

describe('the editor list', () => {
  it('parses', () => {
    expect(load.ok).toBe(true)
  })

  it('opens the room in Levels 3D, Wick in Characters and the numbers in the Tuner, each with no gates', () => {
    if (!load.ok) throw new Error('the list did not parse')
    expect(load.list.file.map((row) => [row.glob, row.editor])).toEqual([
      ['content/levels/*.af-sector.json', 'levels-3d'],
      ['content/figures/*.toml', 'studio'],
      // Wick is drawn from the swatches, gait and poses beside him, so Characters reads those folders too.
      ['content/figure-*/*.toml', 'studio'],
      ['content/tuning.toml', 'tuner'],
    ])
    expect(load.list.file.every((row) => row.gates.length === 0)).toBe(true)
  })

  it('has a file behind every glob', () => {
    if (!load.ok) throw new Error('the list did not parse')
    const files = filesUnder('content').map((path) => relative('.', path))
    for (const row of load.list.file)
      expect(
        files.some((path) => globMatch(row.glob, path) !== undefined),
        `${row.glob} matches no file`,
      ).toBe(true)
  })
})
