import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { type ContentCompileFailed, compileContent } from '@mcthaydt/automata-content'
import { Effect, Either } from 'effect'
import { describe, expect, it } from 'vitest'
import { rooms } from './rooms.content.ts'

// base-2d's room is content: `content/rooms/*.toml`, checked and compiled by automata-content.
const BASE_ROOT = fileURLToPath(new URL('../../', import.meta.url))

const compile = (root: string) => Effect.runPromise(Effect.either(compileContent({ root, schemas: [rooms] })))

function rootWith(toml: string): string {
  const root = mkdtempSync(join(tmpdir(), 'base-2d-rooms-'))
  mkdirSync(join(root, 'content', 'rooms'), { recursive: true })
  writeFileSync(join(root, 'content', 'rooms', 'room-1.toml'), toml)
  return root
}

describe('the rooms kind', () => {
  it('compiles the shipped room with its size, start and goal found', async () => {
    const result = await compile(BASE_ROOT)
    if (Either.isLeft(result)) throw new Error(String(result.left))
    const room = (result.right.data.rooms as Record<string, Record<string, unknown>>)['room-1']
    expect(room).toMatchObject({
      tileSize: 8,
      width: 40,
      height: 24,
      start: { tx: 6, ty: 22 },
      goal: { tx: 15, ty: 3 },
    })
  })

  it('types the compiled room in content.d.ts, so typed access sees the grid, not unknown', async () => {
    const result = await compile(BASE_ROOT)
    if (Either.isLeft(result)) throw new Error(String(result.left))
    const types = result.right.files.get('content.d.ts') ?? ''
    expect(types).not.toContain('Rooms = unknown')
    const rooms = types.slice(types.indexOf('export type Rooms = {'), types.indexOf('export type ScreenId'))
    expect(rooms).toContain('readonly rows: readonly string[]')
    expect(rooms).toContain('readonly tileSize: number')
  })

  it('reports a malformed room in the file, not as a crash', async () => {
    const result = await compile(rootWith('tile_size = 8\nrows = ["####", "#P.#", "####"]\n'))
    expect(Either.isLeft(result)).toBe(true)
    const error = (result as Either.Left<ContentCompileFailed, unknown>).left
    expect(error._tag).toBe('ContentCompileFailed')
    expect(error.diagnostics.map((d) => [d.file, d.message])).toEqual([
      ['content/rooms/room-1.toml', expect.stringContaining('needs exactly one G')],
    ])
  })
})
