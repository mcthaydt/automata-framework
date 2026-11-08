import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { Effect } from 'effect'
import { afterEach, describe, expect, it } from 'vitest'
import { levelsStep } from '#src/shared/check/levels-step.ts'
import { FilesLive } from '#src/shared/node/files.ts'

// The step reads a game folder: these tests copy Emberwick's content into a temp folder and change one thing.

const EMBERWICK = resolve(import.meta.dirname, '../../../../../../games/emberwick')
const made: string[] = []

/** A game folder holding a copy of Emberwick's `content/`. */
function copyOfEmberwick(): string {
  const dir = mkdtempSync(join(tmpdir(), 'levels-step-'))
  made.push(dir)
  cpSync(join(EMBERWICK, 'content'), join(dir, 'content'), { recursive: true })
  return dir
}

const run = (dir: string) => Effect.runPromise(Effect.provide(levelsStep(dir), FilesLive))

afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('levelsStep', () => {
  it('passes when the game files are what the project exports', async () => {
    expect(await run(copyOfEmberwick())).toEqual([])
  })

  it('passes on the real Emberwick, so its room and its game files stay together in pnpm check', async () => {
    expect(await run(EMBERWICK)).toEqual([])
  })

  it('says which game file disagrees with which project, and what to do', async () => {
    const dir = copyOfEmberwick()
    const path = join(dir, 'content/levels/room-1.toml')
    writeFileSync(path, `${readFileSync(path, 'utf8')}# edited by hand\n`)
    expect(await run(dir)).toEqual([
      {
        file: 'content/levels/room-1.toml',
        line: 0,
        col: 0,
        rule: 'levels',
        message:
          'content/levels/room-1.toml does not match content/rooms/room-1.af2d.json.\nOpen the level in the editor and press Save.',
      },
    ])
  })

  it('reports a game file that is missing', async () => {
    const dir = copyOfEmberwick()
    rmSync(join(dir, 'content/world.toml'))
    const findings = await run(dir)
    expect(findings.map((finding) => finding.file)).toEqual(['content/world.toml'])
  })

  it('reports a project that does not open with its first problem and the same last line', async () => {
    const dir = copyOfEmberwick()
    writeFileSync(join(dir, 'content/rooms/room-1.af2d.json'), '{ not json')
    const [finding, ...rest] = await run(dir)
    expect(rest).toEqual([])
    expect(finding?.file).toBe('content/rooms/room-1.af2d.json')
    expect(finding?.message).toMatch(/^content\/rooms\/room-1\.af2d\.json: This file is not valid JSON/)
    expect(finding?.message).toMatch(/\nOpen the level in the editor and press Save\.$/)
  })

  it('does nothing without an editor list, or when no row names exports', async () => {
    const without = copyOfEmberwick()
    rmSync(join(without, 'content/editors.toml'))
    expect(await run(without)).toEqual([])
    const noExports = copyOfEmberwick()
    const list = join(noExports, 'content/editors.toml')
    writeFileSync(list, readFileSync(list, 'utf8').replace('exports = "content"\n', ''))
    writeFileSync(join(noExports, 'content/world.toml'), '# no longer the export\n')
    expect(await run(noExports)).toEqual([])
  })
})
