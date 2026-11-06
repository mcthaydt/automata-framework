// @vitest-environment node
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, test } from 'vitest'
import type { BrowserCommandContext } from 'vitest/node'
import { goldenCommands } from '#src/testing/commands.ts'

let base: string
let root: string
beforeEach(async () => {
  base = await realpath(await mkdtemp(join(tmpdir(), 'af-commands-')))
  root = join(base, 'project')
  await mkdir(join(root, '__goldens__'), { recursive: true })
  await writeFile(join(root, '__goldens__', 'a.golden.json'), '{"a":1}')
  await writeFile(join(base, 'secret.golden.json'), '{"secret":1}')
})
afterEach(async () => {
  await rm(base, { recursive: true, force: true })
})

const read = (path: string) =>
  goldenCommands().readGolden?.({ project: { config: { root } } } as unknown as BrowserCommandContext, path)

test('readGolden returns a golden file inside the project as base64, and null when it is missing', async () => {
  expect(await read(join(root, '__goldens__', 'a.golden.json'))).toBe(
    Buffer.from('{"a":1}').toString('base64'),
  )
  expect(await read(join(root, '__goldens__', 'b.golden.json'))).toBeNull()
})

test('readGolden refuses a path outside the project, a relative path and a file that is not a golden', async () => {
  await expect(read(join(base, 'secret.golden.json'))).rejects.toThrow(/is not inside/)
  await expect(read(join(root, '..', 'secret.golden.json'))).rejects.toThrow(/is not inside/)
  await expect(read('__goldens__/a.golden.json')).rejects.toThrow(/is not inside/)
  await writeFile(join(root, 'notes.txt'), 'x')
  await expect(read(join(root, 'notes.txt'))).rejects.toThrow(/is not a golden file/)
})

test('readGolden refuses a symlink inside the project that points outside it', async () => {
  await symlink(join(base, 'secret.golden.json'), join(root, '__goldens__', 'link.golden.json'))
  await expect(read(join(root, '__goldens__', 'link.golden.json'))).rejects.toThrow(/is not inside/)
  await writeFile(join(root, 'notes.txt'), 'x')
  await symlink(join(root, 'notes.txt'), join(root, '__goldens__', 'notes.golden.json'))
  await expect(read(join(root, '__goldens__', 'notes.golden.json'))).rejects.toThrow(/is not a golden file/)
  await symlink(base, join(root, 'out'))
  await expect(read(join(root, 'out', 'secret.golden.json'))).rejects.toThrow(/is not inside/)
})

test('readGolden reads inside a wider root when one is given, and still refuses outside it', async () => {
  // A package whose goldens sit beside it (the examples runner reads examples/2d/__goldens__) names the folder
  // that holds both; the project root stays the package's own.
  const wider = (path: string) =>
    goldenCommands({ root: base }).readGolden?.(
      { project: { config: { root } } } as unknown as BrowserCommandContext,
      path,
    )
  expect(await wider(join(base, 'secret.golden.json'))).toBe(Buffer.from('{"secret":1}').toString('base64'))
  await expect(wider(join(base, '..', 'elsewhere.golden.json'))).rejects.toThrow(/is not inside/)
})
