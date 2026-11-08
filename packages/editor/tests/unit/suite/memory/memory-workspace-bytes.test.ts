import { describe, expect, it } from 'vitest'
import { createMemoryWorkspace } from '#src/features/suite/memory/memory-workspace.ts'
import type { UnlistedFile, WorkspaceFile } from '#src/shared/kit/ports/suite-ports.ts'

// The suite workspace carries pictures as well as text: a level's tiles are read to be drawn, and Add tiles writes the
// picture into the game. The same editor-list rules decide a picture's write as a text file's.

const classify = (path: string): WorkspaceFile | UnlistedFile =>
  path.startsWith('assets/')
    ? { path, editor: 'levels-2d', gates: [], checks: [], modes: ['edit'], writable: true }
    : { path, editor: 'levels-2d', gates: [], checks: [], modes: ['edit'], writable: false, why: 'generated' }

const PICTURE = new Uint8Array([137, 80, 78, 71, 0, 255])

describe('the memory workspace’s bytes', () => {
  it('writes a picture where the rules allow, reads it back byte for byte, and lists it', async () => {
    const workspace = await createMemoryWorkspace({ classify })
    const written = await workspace.writeBytes?.('assets/tiles.png', PICTURE, 'absent')
    expect(written?.ok).toBe(true)
    expect(await workspace.readBytes?.('assets/tiles.png')).toEqual(PICTURE)
    expect((await workspace.files()).map((file) => file.path)).toEqual(['assets/tiles.png'])
  })

  it('refuses a picture over one that is there, and a read-only path, with the reason', async () => {
    const workspace = await createMemoryWorkspace({ classify, files: { 'assets/tiles.png': 'old' } })
    const taken = await workspace.writeBytes?.('assets/tiles.png', PICTURE, 'absent')
    expect(taken).toMatchObject({ ok: false, reason: 'conflict' })
    const readOnly = await workspace.writeBytes?.('content/x.png', PICTURE, 'absent')
    expect(readOnly).toMatchObject({ ok: false, reason: 'policy' })
    expect(readOnly?.ok === false && readOnly.message).toMatch(/generated/)
  })

  it('reads nothing for a missing file or a path outside the game', async () => {
    const workspace = await createMemoryWorkspace({ classify })
    expect(await workspace.readBytes?.('assets/none.png')).toBeUndefined()
    expect(await workspace.readBytes?.('../secret.png')).toBeUndefined()
  })
})
