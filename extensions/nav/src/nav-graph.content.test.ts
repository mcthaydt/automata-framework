// The `nav-graph` content kind (M6 spec §4.4, §6): a bad reference fails the content compile with its file and line.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { compileContent } from '@automata/content'
import { Effect, Either } from 'effect'
import { afterEach, expect, it } from 'vitest'
import { navGraphContent } from './nav-graph.content'

let root = ''
afterEach(() => rmSync(root, { recursive: true, force: true }))

it('names the file and line of an edge to an unknown node when content compiles', async () => {
  root = mkdtempSync(join(tmpdir(), 'nav-content-'))
  mkdirSync(join(root, 'content', 'nav'), { recursive: true })
  writeFileSync(
    join(root, 'content', 'nav', 'room.toml'),
    'edges = [["a", "c"]]\n\n[nodes.a]\nx = 0\nz = 0\n\n[nodes.b]\nx = 1\nz = 0\n',
  )
  const result = await Effect.runPromise(Effect.either(compileContent({ root, schemas: [navGraphContent] })))
  if (Either.isRight(result)) throw new Error('the compile passed')
  const failure = result.left
  if (failure._tag !== 'ContentCompileFailed') throw new Error(failure.message)
  expect(failure.diagnostics).toEqual([
    expect.objectContaining({
      file: 'content/nav/room.toml',
      line: 1,
      message: expect.stringContaining('no node "c" in nodes'),
    }),
  ])
})
