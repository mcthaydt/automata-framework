// SC-c through the content compiler: the self-intersecting loop is reported with its file and line, so an author can
// open it.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { compileContent } from '@mcthaydt/automata-content'
import { Effect, Either } from 'effect'
import { afterEach, expect, it } from 'vitest'
import { sectorMapContent } from './sector-map.content'

let root = ''
afterEach(() => rmSync(root, { recursive: true, force: true }))

it('names the file and line of a self-intersecting loop (SC-c)', async () => {
  root = mkdtempSync(join(tmpdir(), 'sectors-content-'))
  mkdirSync(join(root, 'content', 'maps'), { recursive: true })
  const toml = [
    '[[sectors]]',
    'id = "ward"',
    'zone = "ward"',
    'floor = 0',
    'ceiling = 3',
    'light = 1',
    'corners = [',
    '  [0, 0],',
    '  [2, 2],',
    '  [2, 0],',
    '  [0, 2],',
    ']',
    '',
  ].join('\n')
  writeFileSync(join(root, 'content', 'maps', 'ward.toml'), toml)
  const result = await Effect.runPromise(Effect.either(compileContent({ root, schemas: [sectorMapContent] })))
  if (Either.isRight(result)) throw new Error('the compile passed')
  const failure = result.left
  if (failure._tag !== 'ContentCompileFailed') throw new Error(failure.message)
  expect(failure.diagnostics.map((d) => ({ file: d.file, line: d.line, message: d.message }))).toEqual([
    {
      file: 'content/maps/ward.toml',
      // The compiler places a problem at the line of its key: the bad loop's `corners`. The message names the corner.
      line: 7,
      message: expect.stringContaining('ward: the wall from corner 2 crosses the wall from corner 0'),
    },
  ])
})
