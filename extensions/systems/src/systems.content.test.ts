// The `systems` content kind (M6 spec §4.6, §6): the converted clinic compiles, and an undeclared hook fails the
// content compile with its file and line.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { compileContentResult } from '@automata/content'
import { stringify } from 'smol-toml'
import { afterEach, expect, it } from 'vitest'
import { systemsContent, systemsSchema } from './systems.content'
import { converted } from './testing/converted-systems'
import { alarmToy } from './testing/toy'

let root = ''
afterEach(() => rmSync(root, { recursive: true, force: true }))

it('parses the converted clinic with its hooks declared', () => {
  const clinic = converted('clinic')
  const hooks = [
    ...clinic.agents.flatMap((a) => a.hooks ?? []),
    ...clinic.rules.flatMap((r) => r.then.flatMap((e) => ('call' in e ? [e.call] : []))),
  ]
  expect(systemsSchema({ hooks }).safeParse(clinic).success).toBe(true)
})

it('names the file and line of a hook the game did not give when content compiles', async () => {
  root = mkdtempSync(join(tmpdir(), 'systems-content-'))
  mkdirSync(join(root, 'content', 'systems'), { recursive: true })
  writeFileSync(join(root, 'content', 'systems', 'toy.toml'), stringify(alarmToy() as never))
  const result = await compileContentResult({ root, schemas: [systemsContent({ hooks: [] })] })
  if (result.ok) throw new Error('the compile passed')
  const failure = result.error
  if (failure._tag !== 'ContentCompileFailed') throw new Error(failure.message)
  expect(failure.diagnostics).toEqual([
    expect.objectContaining({
      file: 'content/systems/toy.toml',
      line: expect.any(Number),
      message: expect.stringContaining('rule wake: hook woke is not implemented'),
    }),
  ])
  expect(failure.diagnostics[0]?.line).toBeGreaterThan(1)
})
