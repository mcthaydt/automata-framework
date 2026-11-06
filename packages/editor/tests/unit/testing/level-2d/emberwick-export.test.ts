import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { openProject } from '#src/shared/level-2d/model/open-project.ts'
import { exportContent } from '#src/shared/level-2d/profiles/level-project/content-export.ts'

// GAME-2D.ED: Emberwick's compiled content is the editor's own export of its room. `games/emberwick/content/{project,world}.toml`
// and `levels/room-1.toml` are generated from `content/rooms/room-1.af2d.json`; this holds them equal, so the room the sim
// plays is the room the editor holds, and an edit in the editor that is not exported again fails here.

const GAME = new URL('../../../../../../games/emberwick/content/', import.meta.url)
const read = (path: string): string => readFileSync(new URL(path, GAME), 'utf8')

describe("Emberwick's exported content", () => {
  const opened = openProject(read('rooms/room-1.af2d.json'))

  it('opens with no problem', () => {
    expect(opened.status).toBe('opened')
  })

  it.each(['project.toml', 'levels/room-1.toml', 'world.toml'])('%s is what the editor exports', (path) => {
    if (opened.status !== 'opened') throw new Error('the room did not open')
    const file = exportContent(opened.project).find((candidate) => candidate.path === path)
    expect(file?.contents).toBe(read(path))
  })
})
