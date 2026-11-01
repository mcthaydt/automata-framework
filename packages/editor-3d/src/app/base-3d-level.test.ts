import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { WorkspaceFile } from '@mcthaydt/automata-editor-kit/ports'
import { createMemoryPorts } from '@mcthaydt/automata-editor-kit/ports/testing'
import { describe, expect, it } from 'vitest'
import { openLevels3d } from './levels-3d-session'

// J4 (the Owner's journey: open base-3d's level in the 3D editor with no unexplained problems). The free game's hand-written
// level is read the way the editor reads it, and every problem the checks name is one the level's data has: the editor's
// checks are right. The test patches a copy with the two fixes the game's data needs and shows the checks then pass, so
// the list the Owner sees (4 `heights`, 13 `entities`) is fully explained:
// - a pit sector (floor -3) with a ceiling of 0 leaves no opening in its portals to the floor-0 rooms next to it;
// - an entity definition is `{ id, shape, fields }`, and the level's three are bare ids.
// The game's own file is not edited here: the fix is the game's data (its lane).

const LEVEL = join(import.meta.dirname, '../../../../games/base-3d/src/content/levels/room.af-sector.json')
const PATH = 'content/levels/room.af-sector.json'
const file = {
  path: PATH,
  editor: 'levels-3d',
  gates: [],
  checks: [],
  modes: ['edit'],
  writable: true,
} as WorkspaceFile

async function problemsOf(text: string) {
  const memory = await createMemoryPorts({ files: { [PATH]: text }, classify: () => file, changeSet: false })
  const session = await openLevels3d([file], memory.ports, { now: () => 0 })
  if (session.state.kind !== 'open') throw new Error(session.state.kind)
  const { editor } = session.state
  return editor.profile
    .checks(editor.level, undefined as never)
    .filter((result) => !result.ok && result.severity === 'error')
    .map((result) => [result.id, result.problems.length] as const)
}

describe('base-3d’s level in the 3D editor', () => {
  it('opens, and the checks name only what the level’s data has: pits with no opening, bare entity definitions', async () => {
    const found = await problemsOf(readFileSync(LEVEL, 'utf8'))
    for (const [id] of found) expect(['heights', 'entities']).toContain(id)
  })

  it('has no problem once the pits have a ceiling and the definitions have a shape and fields', async () => {
    const level = JSON.parse(readFileSync(LEVEL, 'utf8')) as {
      sectors: { floor: number; ceiling: number }[]
      entityDefs: { id: string; shape?: string; fields?: unknown[] }[]
    }
    for (const sector of level.sectors) if (sector.floor < 0) sector.ceiling = 3
    level.entityDefs = level.entityDefs.map((def) => ({ ...def, shape: 'point', fields: [] }))
    expect(await problemsOf(JSON.stringify(level, null, 2))).toEqual([])
  })
})
