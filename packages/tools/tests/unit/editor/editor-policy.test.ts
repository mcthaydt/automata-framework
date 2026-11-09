import { describe, expect, it } from 'vitest'
import { editorPolicy } from '#src/features/editor/editor-policy.ts'

// The server's policy and the suite's `fileAccess` are one rule: a row that names `exports` lets a browser write the
// game files of its level project, and nothing else new.
const LIST = `format = "af-editors/1"

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

describe('editorPolicy with a row that names exports', () => {
  const policy = editorPolicy(LIST)

  it('writes the project, the world and the level files', () => {
    for (const path of ['content/project.toml', 'content/world.toml', 'content/levels/room-1.toml']) {
      expect(policy.canWrite(path), path).toBe(true)
      expect(policy.canRead(path), path).toBe(true)
    }
  })

  it('writes the level project itself, and the tuning through its own row', () => {
    expect(policy.canWrite('content/rooms/room-1.af2d.json')).toBe(true)
    expect(policy.canWrite('content/tuning.toml')).toBe(true)
  })

  it('writes nothing else in the folder, and never the list', () => {
    for (const path of [
      'content/levels/x.json',
      'content/levels/deep/a.toml',
      'content/other.toml',
      'content/editors.toml',
    ])
      expect(policy.canWrite(path), path).toBe(false)
  })

  it('reads the list itself, so the suite can show its rules', () => {
    expect(policy.canRead('content/editors.toml')).toBe(true)
  })

  // Add tiles writes the picture of tiles beside the game, in `assets/`; the level project points at it.
  it('writes the pictures of tiles in assets/, and no other kind of file there', () => {
    for (const path of ['assets/my-tiles.png', 'assets/forest.webp', 'assets/a.jpg', 'assets/b.jpeg']) {
      expect(policy.canWrite(path), path).toBe(true)
      expect(policy.canRead(path), path).toBe(true)
    }
    for (const path of ['assets/run.js', 'assets/deep/a.png', 'assets/.png', 'other/a.png', 'a.png']) {
      expect(policy.canWrite(path), path).toBe(false)
    }
  })
})

describe('editorPolicy with a list that does not load', () => {
  it('reads only the list, so the suite can show its problem, and writes nothing', () => {
    const policy = editorPolicy('format = "af-editors/2"\n')
    expect(policy.canRead('content/editors.toml')).toBe(true)
    expect(policy.canRead('content/tuning.toml')).toBe(false)
    expect(policy.canWrite('content/editors.toml')).toBe(false)
  })
})

describe('editorPolicy with no editor list', () => {
  const policy = editorPolicy(undefined)

  it('reaches level files and nothing else, so a project file or config is never one write away', () => {
    for (const path of ['levels/a.af2d.json', 'content/rooms/room-1.af2d.json']) {
      expect(policy.canRead(path), path).toBe(true)
      expect(policy.canWrite(path), path).toBe(true)
    }
    for (const path of ['package.json', 'tsconfig.json', 'content/data.json', 'levels/a.json']) {
      expect(policy.canRead(path), path).toBe(false)
      expect(policy.canWrite(path), path).toBe(false)
    }
  })

  it('still leaves the folders a build or tool owns alone', () => {
    expect(policy.canWrite('node_modules/x/a.af2d.json')).toBe(false)
    expect(policy.canWrite('dist/a.af2d.json')).toBe(false)
    expect(policy.canWrite('../a.af2d.json')).toBe(false)
  })
})
