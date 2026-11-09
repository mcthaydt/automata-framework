import { describe, expect, it } from 'vitest'
import { loadEditorList } from '#src/shared/editor-list/editor-list.ts'
import type { EditorList } from '#src/shared/editor-list/editors.schema.ts'
import { fileAccess } from '#src/shared/editor-list/workspace-policy.ts'

// A level project row can name `exports`, the folder its game files go into (project.toml, world.toml and
// levels/<id>.toml). Those files are writable through that row and nothing else in the folder is.

const ROW = `
[[file]]
glob = "content/rooms/*.af2d.json"
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

function list(toml: string): EditorList {
  const load = loadEditorList(`format = "af-editors/1"\n${toml}`)
  if (!load.ok) throw new Error(JSON.stringify(load.problems))
  return load.list
}

describe('a row that names exports', () => {
  const game = list(ROW)

  it('loads', () => {
    expect(game.file[0]?.exports).toBe('content')
    expect(game.file[1]?.exports).toBeUndefined()
  })

  it('makes the game files of the project writable through its row', () => {
    for (const path of ['content/project.toml', 'content/world.toml', 'content/levels/room-1.toml']) {
      const access = fileAccess(game, path)
      expect(access.writable, path).toBe(true)
      expect(access.row?.editor, path).toBe('levels-2d')
    }
  })

  it('leaves everything else in the folder alone', () => {
    for (const path of [
      'content/levels/x.json',
      'content/levels/deep/room.toml',
      'content/levels',
      'content/other.toml',
      'content/world.toml.bak',
    ])
      expect(fileAccess(game, path).writable, path).toBe(false)
  })

  it('does not widen another row: the tuning file is the tuner row, not the exports', () => {
    const access = fileAccess(game, 'content/tuning.toml')
    expect(access.writable).toBe(true)
    expect(access.row?.editor).toBe('tuner')
  })

  it('makes the pictures of tiles in assets/ writable through the same row', () => {
    for (const path of ['assets/my-tiles.png', 'assets/forest.webp', 'assets/a.jpg', 'assets/b.jpeg']) {
      const access = fileAccess(game, path)
      expect(access.writable, path).toBe(true)
      expect(access.row?.editor, path).toBe('levels-2d')
    }
    for (const path of ['assets/run.js', 'assets/deep/a.png', 'assets/.png', 'art/a.png'])
      expect(fileAccess(game, path).writable, path).toBe(false)
  })

  it('writes no picture when no level project exports', () => {
    const noExports = list(ROW.replace('exports = "content"\n', ''))
    expect(fileAccess(noExports, 'assets/my-tiles.png').writable).toBe(false)
  })

  it('still refuses what the list never writes or generates', () => {
    const guarded = list(`never = ["content/world.toml"]\ngenerated = ["content/levels/**"]\n${ROW}`)
    expect(fileAccess(guarded, 'content/world.toml')).toMatchObject({ writable: false, reason: 'never' })
    expect(fileAccess(guarded, 'content/levels/room-1.toml')).toMatchObject({
      writable: false,
      reason: 'generated',
    })
  })

  it('works for a folder other than content', () => {
    const other = list(ROW.replace('exports = "content"', 'exports = "game/data"'))
    expect(fileAccess(other, 'game/data/project.toml').writable).toBe(true)
    expect(fileAccess(other, 'content/project.toml').writable).toBe(false)
  })
})

describe('the exports folder', () => {
  it('may not be shared by two rows', () => {
    const twice = `${ROW}
[[file]]
glob = "content/more/*.af2d.json"
editor = "levels-2d"
modes = ["edit"]
exports = "content"
gates = []
checks = ["content"]
`
    const load = loadEditorList(`format = "af-editors/1"\n${twice}`)
    expect(load.ok).toBe(false)
    if (load.ok) return
    expect(load.problems[0]?.message).toBe(
      'Two level projects would write content/project.toml. Give each its own exports folder.',
    )
  })

  it('stays inside the game root', () => {
    for (const exports of ['../elsewhere', '/abs', 'a//b', 'a\\\\b']) {
      const load = loadEditorList(
        `format = "af-editors/1"\n${ROW.replace('exports = "content"', `exports = "${exports}"`)}`,
      )
      expect(load.ok, exports).toBe(false)
    }
  })
})
