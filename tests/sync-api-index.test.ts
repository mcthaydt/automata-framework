// @vitest-environment node
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { installApiIndex } from '../scripts/sync-api-index'

const COMMIT = 'a'.repeat(40)
const dirs: string[] = []
const temp = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'sync-api-index-'))
  dirs.push(dir)
  return dir
}
afterEach(() => { while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true }) })

const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex')

/** A folder shaped like the framework's `tooling/api-index/dist`. */
function dist(leaveOut?: string): string {
  const dir = temp()
  const files: Record<string, string> = {
    'api.json': `${JSON.stringify({ version: '0.0.3', exports: [{ name: 'createSim', version: '0.0.3' }, { name: 'runGame', version: '0.0.3' }] }, null, 2)}\n`,
    'llms-api.txt': '# API reference\n\n## createSim\n',
    'llms-full.txt': '# Automata Framework 0.0.3: full documentation\n\n---\n\n# API reference\n\n## createSim\n',
  }
  for (const [name, text] of Object.entries(files)) if (name !== leaveOut) writeFileSync(join(dir, name), text)
  return dir
}

/** A website folder with its `static` and `src/data` folders. */
function website(): string {
  const dir = temp()
  mkdirSync(join(dir, 'static'), { recursive: true })
  mkdirSync(join(dir, 'src/data'), { recursive: true })
  return dir
}

describe('installApiIndex', () => {
  it('publishes llms-full.txt and llms-api.txt byte for byte and records where they came from', () => {
    const from = dist()
    const to = website()
    installApiIndex(from, to, COMMIT, COMMIT)
    for (const name of ['llms-full.txt', 'llms-api.txt']) {
      expect(readFileSync(join(to, 'static', name), 'utf8')).toBe(readFileSync(join(from, name), 'utf8'))
    }
    expect(JSON.parse(readFileSync(join(to, 'src/data/api-index.json'), 'utf8'))).toEqual({
      commit: COMMIT,
      version: '0.0.3',
      exports: 2,
      files: {
        'llms-full.txt': sha256(readFileSync(join(from, 'llms-full.txt'), 'utf8')),
        'llms-api.txt': sha256(readFileSync(join(from, 'llms-api.txt'), 'utf8')),
      },
    })
  })

  it('refuses a checkout that is not at framework.ref and writes nothing', () => {
    const to = website()
    expect(() => installApiIndex(dist(), to, 'b'.repeat(40), COMMIT)).toThrow(/framework\.ref/)
    expect(existsSync(join(to, 'static/llms-full.txt'))).toBe(false)
    expect(existsSync(join(to, 'src/data/api-index.json'))).toBe(false)
  })

  it('names a missing file and writes nothing', () => {
    const to = website()
    expect(() => installApiIndex(dist('llms-api.txt'), to, COMMIT, COMMIT)).toThrow(/llms-api\.txt/)
    expect(existsSync(join(to, 'static/llms-full.txt'))).toBe(false)
  })

  it('refuses a full text that does not end with the API reference it is published beside', () => {
    const from = dist()
    writeFileSync(join(from, 'llms-api.txt'), '# API reference\n\n## somethingElse\n')
    const to = website()
    expect(() => installApiIndex(from, to, COMMIT, COMMIT)).toThrow(/API reference/)
    expect(existsSync(join(to, 'static/llms-full.txt'))).toBe(false)
  })
})
