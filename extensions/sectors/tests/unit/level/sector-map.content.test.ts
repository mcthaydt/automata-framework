// Through the content compiler: the self-intersecting loop is reported with its file and line, so an author can
// open it.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { compileContentResult } from '@automata/content'
import { afterEach, expect, it } from 'vitest'
import { sectorMapContent } from '#src/features/level/sector-map.content.ts'

let root = ''
afterEach(() => rmSync(root, { recursive: true, force: true }))

it('names the file and line of a self-intersecting loop', async () => {
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
  const result = await compileContentResult({ root, schemas: [sectorMapContent] })
  if (result.ok) throw new Error('the compile passed')
  const failure = result.error
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
