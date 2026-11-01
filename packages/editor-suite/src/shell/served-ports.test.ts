import { createMemoryStore } from '@mcthaydt/automata-editor-kit/core'
import { describe, expect, it } from 'vitest'
import { EDITOR_LIST_PATH } from '../core'
import { servedPorts } from './served-ports'

// The suite over a served game checkout (the Owner, testing `automata editor`: the suite page always showed the sample
// game): the files and the list come from the store the editor server backs, and a write goes back to it.

const LIST = `format = "af-editors/1"
[[file]]
glob = "content/levels/*.json"
editor = "levels-3d"
modes = ["edit"]
gates = []
checks = []
`

async function store(files: Record<string, string>) {
  const memory = createMemoryStore()
  for (const [path, text] of Object.entries(files)) await memory.write(path, text)
  return memory
}

describe('servedPorts', () => {
  it('lists the files of the served checkout by the checkout’s own editor list', async () => {
    const ports = await servedPorts(
      await store({ [EDITOR_LIST_PATH]: LIST, 'content/levels/room.json': '{}' }),
    )
    const files = await ports.workspace.files('levels-3d')
    expect(files.map((file) => file.path)).toEqual(['content/levels/room.json'])
    expect(files[0]?.writable).toBe(true)
  })

  it('writes a listed file back to the served store, and refuses an unlisted one', async () => {
    const served = await store({
      [EDITOR_LIST_PATH]: LIST,
      'content/levels/room.json': '{}',
      'notes.txt': 'x',
    })
    const ports = await servedPorts(served)
    const read = await ports.workspace.read('content/levels/room.json')
    const wrote = await ports.workspace.write('content/levels/room.json', '{ "a": 1 }', {
      mtime: read?.mtime ?? 0,
    })
    expect(wrote.ok).toBe(true)
    expect(new TextDecoder().decode(await served.read('content/levels/room.json'))).toBe('{ "a": 1 }')
    expect((await ports.workspace.write('notes.txt', 'y', { mtime: 0 })).ok).toBe(false)
  })

  it('opens a checkout with no editor list read only, and says so', async () => {
    const ports = await servedPorts(await store({ 'content/levels/room.json': '{}' }))
    const wrote = await ports.workspace.write('content/levels/room.json', '[]', { mtime: 0 })
    expect(wrote.ok).toBe(false)
  })

  it('has no change set: edits save to the checkout and Ship stays hidden', async () => {
    const ports = await servedPorts(await store({ [EDITOR_LIST_PATH]: LIST }))
    expect(ports.changeSet).toBeUndefined()
  })
})
