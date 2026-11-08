import { describe, expect, it } from 'vitest'
import { createMemoryWorkspace } from '#src/features/suite/memory/memory-workspace.ts'
import type { UnlistedFile, WorkspaceFile } from '#src/shared/kit/ports/suite-ports.ts'

// A level reads the game's furniture and materials, which no row of the editor list names, so the workspace can list a
// folder of the game, listed or not (the rules refuse writes, not reads).

const classify = (path: string): WorkspaceFile | UnlistedFile => ({
  path,
  writable: false,
  why: 'no row',
})

const FILES = {
  'content/world-props/crate.toml': 'a',
  'content/world-props/barrel.toml': 'b',
  'content/world-props.bak': 'c',
  'content/world-swatches/lava.toml': 'd',
}

describe('the memory workspace’s list', () => {
  it('lists the paths under a folder, sorted, and not a sibling that shares its start', async () => {
    const workspace = await createMemoryWorkspace({ classify, files: FILES })
    expect(await workspace.list?.('content/world-props')).toEqual([
      'content/world-props/barrel.toml',
      'content/world-props/crate.toml',
    ])
  })

  it('lists nothing for a folder the game lacks, or a path outside the game', async () => {
    const workspace = await createMemoryWorkspace({ classify, files: FILES })
    expect(await workspace.list?.('content/figures')).toEqual([])
    expect(await workspace.list?.('../secret')).toEqual([])
  })
})
