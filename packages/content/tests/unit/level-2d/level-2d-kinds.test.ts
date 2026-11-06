import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Effect, Either } from 'effect'
import { afterEach, describe, expect, it } from 'vitest'
import { compileContent } from '#src/shared/compile/compile-content.ts'
import { formatDiagnostic } from '#src/shared/diagnostics/diagnostic.ts'
import { level2dKinds } from '#src/shared/level-2d/level-2d-kinds.ts'

// A small game's exported level files (copied from the base 2D game's `content/`), compiled with the kinds the
// level format declares, as a game does.
const ROOM = fileURLToPath(new URL('./fixtures/room/', import.meta.url))

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

/** A temporary copy of the room game, so a test can break a file. */
function copyOfRoom(): string {
  const root = mkdtempSync(join(tmpdir(), 'level-2d-kinds-'))
  roots.push(root)
  cpSync(ROOM, root, { recursive: true })
  return root
}

const compile = (root: string) =>
  Effect.runPromise(Effect.either(compileContent({ root, schemas: level2dKinds() })))

describe('level2dKinds', () => {
  it('puts the levels in the sim content, and keeps the project and the world out of it', async () => {
    const result = await compile(copyOfRoom())
    if (Either.isLeft(result)) throw new Error(JSON.stringify(result.left, null, 2))
    const { data, sim } = result.right
    expect(Object.keys(data).sort()).toEqual(expect.arrayContaining(['levels', 'project', 'world']))
    expect(Object.keys(sim.data)).toContain('levels')
    expect(Object.keys(sim.data)).not.toContain('project')
    expect(Object.keys(sim.data)).not.toContain('world')
  })

  it('refuses a level the editor did not write, naming the key and the file', async () => {
    const root = copyOfRoom()
    const path = join(root, 'content/levels/room-1.toml')
    writeFileSync(path, `${readFileSync(path, 'utf8')}\nsurprise = 1\n`)
    const result = await compile(root)
    if (Either.isRight(result)) throw new Error('expected the compile to fail')
    if (result.left._tag !== 'ContentCompileFailed') throw new Error(result.left.message)
    const text = result.left.diagnostics.map(formatDiagnostic).join('\n')
    expect(text).toContain('levels/room-1.toml')
    expect(text).toContain('surprise')
  })

  it('takes another folder for the levels', async () => {
    expect(level2dKinds({ folder: 'rooms' })[0]?.place).toEqual({ folder: 'rooms' })
    expect(level2dKinds()[0]?.place).toEqual({ folder: 'levels' })
  })
})
